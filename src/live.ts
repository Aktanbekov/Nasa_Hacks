// Live NASA FIRMS fire detections over California, via our server (cached there for 20 minutes).
import { useEffect, useState } from 'react'
import type { LiveFires } from '../shared/wildfires.ts'

let pending: Promise<LiveFires | null> | null = null
let last: { at: number; data: LiveFires | null } | null = null

function load(): Promise<LiveFires | null> {
  if (last && Date.now() - last.at < 10 * 60 * 1000) return Promise.resolve(last.data)
  if (!pending) {
    pending = fetch('/api/fires/live')
      .then((r) => (r.ok ? (r.json() as Promise<LiveFires>) : null))
      .catch(() => null)
      .then((d) => { last = { at: Date.now(), data: d && !d.error ? d : null }; pending = null; return last.data })
  }
  return pending
}

/** Live detections, or null while loading / when offline (the game works without them). */
export function useLiveFires(enabled = true) {
  const [data, setData] = useState<LiveFires | null>(last?.data ?? null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    load().then((d) => { if (live) setData(d) })
    return () => { live = false }
  }, [enabled])
  return enabled ? data : null
}
