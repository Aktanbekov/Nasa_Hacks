// Real California wildfires, replayed during Wildfire Watch.
// Data: NIFC WFIGS Incident Locations (discovery time in UTC, origin point,
// incident size in acres, cause), queried November 2026.
// The detection model below is a simplified game model, not a fire science tool.
import { ANTENNAS, NETWORKS, ORBITS, byId } from './catalog.ts'
import { hashRand } from './rng.ts'
import type { Design, Scenario, SimState } from './types.ts'

export interface FireRecord { id: string; name: string; discoveredUtc: string; lat: number; lon: number; acres: number; cause: string }

export const WILDFIRES: FireRecord[] = [
  { id: '2021-CABTU-009205', name: 'Dixie Fire', discoveredUtc: '2021-07-14T00:15Z', lat: 39.876, lon: -121.3788, acres: 963309, cause: 'Undetermined' },
  { id: '2020-CAMNF-000730', name: 'Doe Fire (August Complex)', discoveredUtc: '2020-08-16T15:48Z', lat: 39.7654, lon: -122.6734, acres: 589368, cause: 'Lightning' },
  { id: '2024-CABTU-013761', name: 'Park Fire', discoveredUtc: '2024-07-24T21:52Z', lat: 39.8186, lon: -121.8026, acres: 429603, cause: 'Undetermined' },
  { id: '2020-CASCU-005740', name: 'SCU Lightning Complex', discoveredUtc: '2020-08-16T12:56Z', lat: 37.4239, lon: -121.5677, acres: 396624, cause: 'Unknown' },
  { id: '2020-CASNF-001391', name: 'Creek Fire', discoveredUtc: '2020-09-05T01:33Z', lat: 37.1957, lon: -119.2638, acres: 379895, cause: 'Not identified' },
  { id: '2020-CALNU-013407', name: 'LNU Lightning Complex', discoveredUtc: '2020-08-17T18:57Z', lat: 38.5974, lon: -122.9979, acres: 363220, cause: 'Unknown' },
  { id: '2018-CAWNP-001084', name: 'Carr Fire', discoveredUtc: '2018-07-23T20:18Z', lat: 40.6541, lon: -122.6234, acres: 229651, cause: 'Human' },
  { id: '2021-CASHF-001187', name: 'Monument Fire', discoveredUtc: '2021-07-31T01:10Z', lat: 40.7523, lon: -123.3367, acres: 223124, cause: 'Lightning' },
  { id: '2021-CAENF-024030', name: 'Caldor Fire', discoveredUtc: '2021-08-15T01:54Z', lat: 38.6272, lon: -120.4893, acres: 221835, cause: 'Undetermined' },
  { id: '2020-CASQF-002541', name: 'Castle Fire (SQF Complex)', discoveredUtc: '2020-08-19T14:20Z', lat: 36.1697, lon: -118.4587, acres: 174178, cause: 'Natural' },
  { id: '2025-CALPF-002181', name: 'Gifford Fire', discoveredUtc: '2025-08-01T20:57Z', lat: 35.0961, lon: -120.0602, acres: 131612, cause: 'Undetermined' },
  { id: '2020-CAANF-003687', name: 'Bobcat Fire', discoveredUtc: '2020-09-06T19:21Z', lat: 34.2678, lon: -118.1412, acres: 115997, cause: 'Undetermined' },
  { id: '2018-CASNF-000745', name: 'Ferguson Fire', discoveredUtc: '2018-07-14T04:36Z', lat: 37.6305, lon: -119.9457, acres: 96901, cause: 'Unknown' },
  { id: '2020-CACZU-005205', name: 'CZU Lightning Complex', discoveredUtc: '2020-08-16T13:41Z', lat: 37.2581, lon: -122.2176, acres: 86509, cause: 'Unknown' },
  { id: '2019-CALNU-019376', name: 'Kincade Fire', discoveredUtc: '2019-10-24T04:24Z', lat: 38.7962, lon: -122.7666, acres: 77758, cause: 'Unknown' },
  { id: '2022-CATNF-001371', name: 'Mosquito Fire', discoveredUtc: '2022-09-07T01:27Z', lat: 39.0012, lon: -120.7246, acres: 76788, cause: 'Undetermined' },
  { id: '2020-CALNU-015947', name: 'Glass Fire', discoveredUtc: '2020-09-27T10:48Z', lat: 38.5543, lon: -122.531, acres: 67484, cause: 'Equipment' },
]

export const FIRES_PER_MISSION = 8

export interface FireOutcome {
  fireIndex: number
  day: number
  /** Hours from ignition until the spacecraft saw it (null = never). */
  seenHours: number | null
  /** Hours from ignition until the alert reached the ground (null = never). */
  alertHours: number | null
  by: string | null
  why: string
  points: number
}

/** Pick fires for this mission and place them on the mission timeline by their real calendar dates. */
export function scheduleFires(seed: number, plannedDays: number) {
  const years = Math.max(1, Math.floor(plannedDays / 365))
  const picks = WILDFIRES.map((f, i) => ({ i, r: hashRand(seed, 'fire-pick', f.id) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, FIRES_PER_MISSION)
  return picks.map(({ i }, k) => {
    const d = new Date(WILDFIRES[i].discoveredUtc)
    const doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000)
    return { fireIndex: i, day: Math.min(plannedDays - 1, (k % years) * 365 + doy) }
  }).sort((a, b) => a.day - b.day)
}

/** Ground pixel size of a fire-detecting camera at each orbit (m), modelled on real instruments. */
const PIXEL_M: Record<string, number> = { 'leo-400': 70, 'sso-600': 100, geo: 2000 }

/**
 * Simplified detection model:
 * - Only thermal, shortwave-infrared or (by day, once smoke shows) visible cameras can spot a fire.
 * - The spacecraft must fly over: waiting time depends on looks per day.
 * - The fire must be big enough for the pixel size (a fire ~0.1% of a pixel is detectable, per MODIS),
 *   assuming a fire area that starts at 100 m² and grows ~e-fold every 40 minutes.
 * - The alert must then reach the ground: waiting for the next ground-station pass.
 */
export function detectFire(fireIndex: number, day: number, design: Design, sc: Scenario, sim: SimState, seed: number): FireOutcome {
  const fire = WILDFIRES[fireIndex]
  const orbit = byId(ORBITS, design.orbitId)
  const insts = design.instruments.map((id) => sc.instruments.find((i) => i.id === id)!).filter((i) => i && sim.instrumentState[i.id]?.on)
  const thermal = insts.find((i) => i.kind === 'thermal')
  const swir = insts.find((i) => i.id === 'swir')
  const visible = insts.find((i) => i.kind === 'optical')
  const best = thermal ?? swir ?? visible
  const base = { fireIndex, day }
  if (sim.ended) return { ...base, seenHours: null, alertHours: null, by: null, why: 'The spacecraft was no longer operating.', points: 0 }
  if (!best) return { ...base, seenHours: null, alertHours: null, by: null, why: 'No working fire-detecting instrument (thermal, shortwave infrared or visible).', points: 0 }

  const dayOnly = best === visible
  const looksPerDay = orbit.revisitPerSat * design.satellites * (dayOnly ? 0.5 : 1)
  const passWait = hashRand(seed, 'fire-pass', fire.id) * (24 / Math.max(0.1, looksPerDay))

  const blur = sim.instrumentState[best.id].quality < 1 ? 1.5 : 1
  const pixel = (PIXEL_M[orbit.id] ?? 100) * blur
  const minArea = Math.max(100, 0.001 * pixel * pixel * (dayOnly ? 30 : 1)) // m²
  const growHours = Math.log(minArea / 100) / Math.log(Math.E) * (40 / 60)
  const seenHours = Math.max(passWait, growHours)

  const ground = byId(NETWORKS, design.groundId)
  const ant = byId(ANTENNAS, design.antennaId)
  const contact = ground.contactMin[orbit.comms] * (ant.rateMbps[orbit.comms] > 0 ? 1 : 0) * sim.contactFactor
  let alertDelay: number
  if (contact <= 0) alertDelay = Infinity
  else if (contact >= 1440) alertDelay = 0.1
  else {
    const passes = Math.max(0.5, contact / 8) // ~8-minute passes
    alertDelay = hashRand(seed, 'fire-downlink', fire.id) * (24 / passes)
  }
  if (sim.outageDaysLeft > 0 && sim.outageFactor < 0.5) alertDelay += sim.outageDaysLeft * 24
  const alertHours = seenHours + alertDelay
  if (!Number.isFinite(alertHours)) {
    return { ...base, seenHours, alertHours: null, by: best.name, why: 'Seen by the spacecraft, but the ground could not hear the alert.', points: 0 }
  }
  const points = alertHours <= 1 ? 12 : alertHours <= 3 ? 9 : alertHours <= 6 ? 6 : alertHours <= 12 ? 3 : 0
  // Explain the biggest source of delay.
  const looks = Math.round(looksPerDay * 10) / 10
  const biggest = Math.max(passWait, growHours, alertDelay)
  const why = alertHours <= 3
    ? `Caught early: ${looks > 50 ? 'constant watch' : `${looks} looks per day`} and a quick downlink.`
    : biggest === growHours
      ? `${Math.round(pixel)} m pixels only see a fire once it has grown (${fmtHours(growHours)}).${dayOnly ? ' A visible camera also needs daylight and smoke.' : ''}`
      : biggest === passWait
        ? `Only ${looks} look${looks === 1 ? '' : 's'} per day${dayOnly ? ' in daylight' : ''}: it burned ${fmtHours(passWait)} before your next pass.`
        : `Seen after ${fmtHours(seenHours)}, but the alert waited ${fmtHours(alertDelay)} for a ground-station pass.`
  return { ...base, seenHours, alertHours, by: best.name, why, points }
}

export const fmtHours = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h < 10 ? h.toFixed(1) : Math.round(h)} h`)
export const fireDate = (f: FireRecord) => new Date(f.discoveredUtc).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })

// ---------- live data helpers ----------

/** Coarse California outline (lon, lat), good enough to filter fire detections. */
export const CA_OUTLINE: [number, number][] = [[-124.2, 42], [-120, 42], [-120, 39], [-114.6, 35], [-114.7, 32.7], [-117.1, 32.5], [-118.5, 34], [-120.6, 34.5], [-121.9, 36.6], [-122.5, 37.8], [-123.8, 39.5], [-124.4, 40.4]]

export function inCalifornia(lat: number, lon: number) {
  let inside = false
  for (let i = 0, j = CA_OUTLINE.length - 1; i < CA_OUTLINE.length; j = i++) {
    const [xi, yi] = CA_OUTLINE[i], [xj, yj] = CA_OUTLINE[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export interface Hotspot { lat: number; lon: number; frp: number; sat: string; when: string; night: boolean }
export interface LiveFires { updated: string; window: '24h' | '7d'; count: number; hotspots: Hotspot[]; feeds: string[]; error?: string }
