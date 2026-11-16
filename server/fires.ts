// Live wildfire detections over California from NASA FIRMS (public CSV files, no account needed).
// Cached in memory for 20 minutes; used by both the local server and the Vercel function.
import { inCalifornia, type Hotspot, type LiveFires } from '../shared/wildfires.ts'

const FIRMS = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire'
const FEEDS = {
  '24h': [
    ['VIIRS NOAA-20', `${FIRMS}/noaa-20-viirs-c2/csv/J1_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv`],
    ['VIIRS NOAA-21', `${FIRMS}/noaa-21-viirs-c2/csv/J2_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv`],
    ['MODIS Terra/Aqua', `${FIRMS}/modis-c6.1/csv/MODIS_C6_1_USA_contiguous_and_Hawaii_24h.csv`],
  ],
  '7d': [['VIIRS NOAA-20', `${FIRMS}/noaa-20-viirs-c2/csv/J1_VIIRS_C2_USA_contiguous_and_Hawaii_7d.csv`]],
} as const
let liveCache: { at: number; data: LiveFires } | null = null

async function fetchFeed(label: string, url: string): Promise<Hotspot[]> {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`${label}: HTTP ${r.status}`)
  const [head, ...rows] = (await r.text()).trim().split('\n')
  const cols = head.split(',')
  const at = (name: string) => cols.indexOf(name)
  const iLat = at('latitude'), iLon = at('longitude'), iFrp = at('frp'), iDate = at('acq_date'), iTime = at('acq_time'), iDn = at('daynight')
  const out: Hotspot[] = []
  for (const row of rows) {
    const c = row.split(',')
    const lat = parseFloat(c[iLat]), lon = parseFloat(c[iLon])
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inCalifornia(lat, lon)) continue
    const t = (c[iTime] ?? '').padStart(4, '0')
    out.push({ lat, lon, frp: parseFloat(c[iFrp]) || 0, sat: label, when: `${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}Z`, night: c[iDn] === 'N' })
  }
  return out
}

export async function liveFires(): Promise<LiveFires> {
  if (liveCache && Date.now() - liveCache.at < 20 * 60 * 1000) return liveCache.data
  const load = async (window: '24h' | '7d') => {
    const results = await Promise.allSettled(FEEDS[window].map(([l, u]) => fetchFeed(l, u)))
    const ok = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    const feeds = FEEDS[window].filter((_, i) => results[i].status === 'fulfilled').map(([l]) => l)
    return { ok, feeds, failed: results.every((r) => r.status === 'rejected') }
  }
  let window: '24h' | '7d' = '24h'
  let res = await load('24h')
  if (!res.failed && res.ok.length === 0) { window = '7d'; res = await load('7d') }
  const data: LiveFires = res.failed
    ? { updated: new Date().toISOString(), window, count: 0, hotspots: [], feeds: [], error: 'NASA FIRMS could not be reached.' }
    : { updated: new Date().toISOString(), window, count: res.ok.length, hotspots: res.ok.sort((a, b) => b.frp - a.frp).slice(0, 400), feeds: res.feeds }
  if (!res.failed) liveCache = { at: Date.now(), data }
  return data
}
