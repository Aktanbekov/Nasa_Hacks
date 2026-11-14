// Connects the UI to a game. Solo games run the shared reducer in the browser;
// team games stream state from the server and post actions back.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame, reduce, tick, TICK_MS, type Action } from '../shared/game.ts'
import type { GameState } from '../shared/types.ts'

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

  // ---- Team: server-sent events ----
  const code = session?.mode === 'team' ? session.code : null
  useEffect(() => {
    if (!code) return
    setError(null)
    const es = new EventSource(`/api/rooms/${code}/stream?player=${encodeURIComponent(playerId)}&name=${encodeURIComponent(name)}`)
    es.onopen = () => setConnected(true)
    es.onmessage = (e) => {
      const s = JSON.parse(e.data) as GameState
      offset.current = s.now - Date.now()
      setState(s)
    }
    es.onerror = () => {
      setConnected(false)
      fetch(`/api/rooms/${code}`).then((r) => {
        if (r.status === 404) { setError('Room not found. It may have expired.'); es.close() }
      }).catch(() => {})
    }
    return () => es.close()
  }, [code, playerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const dispatch: Dispatch = useCallback((a) => {
    const action = { ...a, playerId } as Action
    if (session?.mode === 'solo' && local.current) {
      reduce(local.current, action, Date.now())
      force((n) => n + 1)
    } else if (code) {
      fetch(`/api/rooms/${code}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action) })
        .catch(() => setError('Lost connection to the room server.'))
    }
  }, [session?.mode, code, playerId])

  const now = () => Date.now() + offset.current
  return { state: session?.mode === 'solo' ? local.current : state, dispatch, error, connected, now }
}

export async function createRoom(): Promise<string> {
  const r = await fetch('/api/rooms', { method: 'POST' })
  if (!r.ok) throw new Error('Could not reach the room server. Is it running?')
  return (await r.json()).code
}
