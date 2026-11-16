// Connects the UI to a game. Solo games run the shared reducer in the browser;
// team games poll the room server for state and post actions back.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame, reduce, tick, TICK_MS, type Action } from '../shared/game.ts'
import type { GameState } from '../shared/types.ts'
import { api } from './api.ts'

/** How often team players fetch the room state. */
const POLL_MS = 1000

export type Session = { mode: 'solo' } | { mode: 'team'; code: string }

// Distributive Omit so each action variant keeps its own fields.
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type UiAction = DistOmit<Action, 'playerId'>
export type Dispatch = (a: UiAction) => void

export function getPlayerId() {
  try {
    let id = sessionStorage.getItem('lw-player')
    if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('lw-player', id) }
    return id
  } catch { return Math.random().toString(36).slice(2, 10) }
}

export function useGame(session: Session | null, playerId: string, name: string) {
  const [state, setState] = useState<GameState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const offset = useRef(0)
  const local = useRef<GameState | null>(null)
  const [, force] = useState(0)

  // ---- Solo: local reducer + clock ----
  useEffect(() => {
    if (session?.mode !== 'solo') return
    const g = createGame('SOLO', 'solo', Date.now())
    reduce(g, { type: 'join', playerId, name }, Date.now())
    local.current = g
    setState(g)
    setConnected(true)
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      if (tick(g, now, now - last)) force((n) => n + 1)
      last = now
    }, TICK_MS)
    return () => { clearInterval(id); local.current = null }
  }, [session?.mode, playerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Team: poll the room about once a second; actions return the new state at once ----
  const code = session?.mode === 'team' ? session.code : null
  const rev = useRef(-1)
  const accept = useCallback((body: { state?: GameState; now?: number }) => {
    if (typeof body.now === 'number') offset.current = body.now - Date.now()
    if (body.state && body.state.rev >= rev.current) { rev.current = body.state.rev; setState(body.state) }
  }, [])
  useEffect(() => {
    if (!code) return
    setError(null)
    rev.current = -1
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    const poll = async () => {
      try {
        const q = `player=${encodeURIComponent(playerId)}&name=${encodeURIComponent(name)}&rev=${rev.current}`
        const r = await fetch(api(`/api/rooms/${code}/state?${q}`), { cache: 'no-store' })
        if (!live) return
        if (r.status === 404) { setError('Room not found. It may have expired.'); setConnected(false); return }
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`)
        accept(body)
        failures = 0
        setConnected(true)
      } catch (e) {
        if (!live) return
        failures += 1
        setConnected(false)
        if (failures >= 3) setError((e as Error).message.startsWith('HTTP') || (e as Error).message === 'Failed to fetch' ? 'Lost connection to the room server. Retrying…' : (e as Error).message)
      }
      if (live) timer = setTimeout(poll, failures ? Math.min(5000, 1000 * failures) : POLL_MS)
    }
    void poll()
    return () => { live = false; clearTimeout(timer) }
  }, [code, playerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const dispatch: Dispatch = useCallback((a) => {
    const action = { ...a, playerId } as Action
    if (session?.mode === 'solo' && local.current) {
      reduce(local.current, action, Date.now())
      force((n) => n + 1)
    } else if (code) {
      const q = `player=${encodeURIComponent(playerId)}&name=${encodeURIComponent(name)}`
      fetch(api(`/api/rooms/${code}/action?${q}`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action) })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(body.error ?? 'Lost connection to the room server.')
          setError(null)
          accept(body)
        })
        .catch((e) => setError((e as Error).message === 'Failed to fetch' ? 'Lost connection to the room server.' : (e as Error).message))
    }
  }, [session?.mode, code, playerId, name, accept])

  const now = () => Date.now() + offset.current
  return { state: session?.mode === 'solo' ? local.current : state, dispatch, error, connected, now }
}

export async function createRoom(): Promise<string> {
  const r = await fetch(api('/api/rooms'), { method: 'POST', signal: AbortSignal.timeout(20_000) }).catch(() => null)
  if (!r) throw new Error('Could not reach the room server. Is it running?')
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not create a room. Try again.')
  return (await r.json()).code
}
