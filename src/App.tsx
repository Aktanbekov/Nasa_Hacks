import { useEffect, useMemo, useState } from 'react'
import { ROLE_NAMES } from '../shared/game.ts'
import { getScenario } from '../shared/scenarios.ts'
import { Design } from './screens/Design.tsx'
import { Home } from './screens/Home.tsx'
import { Launch } from './screens/Launch.tsx'
import { Lobby } from './screens/Lobby.tsx'
import { Ops } from './screens/Ops.tsx'
import { Report } from './screens/Report.tsx'
import { Review } from './screens/Review.tsx'
import { getPlayerId, useGame, type Session } from './transport.ts'
import { GameCtx, Logo, RoleChip, Steps } from './ui.tsx'

export default function App() {
  const playerId = useMemo(getPlayerId, [])
  const [name, setName] = useState(() => { try { return localStorage.getItem('lw-name') ?? '' } catch { return '' } })
  const [session, setSession] = useState<Session | null>(() => {
    const room = new URLSearchParams(location.search).get('room')
    return room && sessionStorage.getItem('lw-joined') === room ? { mode: 'team', code: room } : null
  })
  const { state, dispatch, error, connected, now } = useGame(session, playerId, name)

  useEffect(() => {
    if (session?.mode === 'team') {
      const url = new URL(location.href)
      url.searchParams.set('room', session.code)
      history.replaceState(null, '', url)
      sessionStorage.setItem('lw-joined', session.code)
    }
  }, [session])

  const leave = () => {
    sessionStorage.removeItem('lw-joined')
    history.replaceState(null, '', location.pathname)
    setSession(null)
  }

  if (!session) {
    return <Home name={name} setName={(n) => { setName(n); try { localStorage.setItem('lw-name', n) } catch { /* private mode */ } }} onStart={setSession} />
  }
  if (!state) {
    return (
      <div className="page stack" style={{ paddingTop: 80, alignItems: 'center' }}>
        <Logo size={40} />
        <p className="muted">{error ?? 'Connecting to mission control…'}</p>
        {error && <button className="btn" onClick={leave}>Back</button>}
      </div>
    )
  }

  const me = state.players[playerId]
  const scenario = state.scenarioId ? getScenario(state.scenarioId) : null
  const others = Object.values(state.players).filter((p) => p.connected)

  return (
    <GameCtx.Provider value={{ state, dispatch, me: playerId, now }}>
      <header className="topbar">
        <div className="brand"><Logo /><div>Launch Window<small>{scenario ? `${scenario.name} · Flight ${state.flight}` : 'Space mission design game'}</small></div></div>
        <Steps phase={state.phase} />
        <div className="spacer" />
        {state.mode === 'team' && (
          <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
            <span className="chip mono" title="Room code">Room {state.code}</span>
            {others.map((p) => (
              <span key={p.id} className="chip" title={p.roles.map((r) => ROLE_NAMES[r]).join(', ') || 'No role yet'}>
                {p.name}{p.id === playerId ? ' (you)' : ''}
                {p.roles.map((r) => <span key={r} className="dot" style={{ background: `var(--${r})` }} />)}
              </span>
            ))}
            {!connected && <span className="chip bad">Reconnecting…</span>}
          </div>
        )}
        {state.mode === 'solo' && me && <RoleChip role="lead" label="Solo: all four roles" />}
        <button className="btn ghost sm" onClick={leave}>Exit</button>
      </header>
      {error && <div className="page error">{error}</div>}
      {state.phase === 'lobby' && <Lobby />}
      {state.phase === 'design' && <Design />}
      {state.phase === 'review' && <Review />}
      {state.phase === 'launch' && <Launch />}
      {state.phase === 'ops' && <Ops />}
      {state.phase === 'report' && <Report />}
    </GameCtx.Provider>
  )
}
