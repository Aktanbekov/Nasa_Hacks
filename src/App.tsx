import { useEffect, useMemo, useState } from 'react'
import { ROLE_NAMES } from '../shared/game.ts'
import { scenarioOf } from '../shared/scenarios.ts'
import { InviteOverlay } from './invite.tsx'
import { SourcesOverlay } from './screens/Sources.tsx'
import { Briefing } from './screens/Briefing.tsx'
import { Design } from './screens/Design.tsx'
import { FlightCalc } from './screens/FlightCalc.tsx'
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
  const [invite, setInvite] = useState(false)
  const [sources, setSources] = useState(false)
  const sourcesOverlay = sources && <SourcesOverlay onClose={() => setSources(false)} />

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
    return <><Home onSources={() => setSources(true)} name={name} setName={(n) => { setName(n); try { localStorage.setItem('lw-name', n) } catch { /* private mode */ } }} onStart={setSession} />{sourcesOverlay}</>
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
  const scenario = state.scenarioId ? scenarioOf(state) : null
  const others = Object.values(state.players).filter((p) => p.connected)

  return (
    <GameCtx.Provider value={{ state, dispatch, me: playerId, now }}>
      <header className="topbar">
        <div className="brand"><Logo /><div>Launch Window<small>{scenario ? `${scenario.name} · ${scenario.level?.label ?? 'Cadet'} · Flight ${state.flight}` : 'Space mission design game'}</small></div></div>
        <Steps phase={state.phase} />
        <div className="spacer" />
        {state.mode === 'team' && (
          <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
            <button className="chip mono chip-btn" title="Show the QR code to invite teammates" onClick={() => setInvite(true)}>▦ Room {state.code}</button>
            {invite && <InviteOverlay code={state.code} onClose={() => setInvite(false)} />}
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
        <button className="btn ghost sm" onClick={() => setSources(true)} title="Where the numbers come from">Sources</button>
        <button className="btn ghost sm" onClick={leave}>Exit</button>
        {sourcesOverlay}
      </header>
      {error && <div className="page error">{error}</div>}
      {state.phase === 'lobby' && <Lobby />}
      {state.phase === 'briefing' && <Briefing />}
      {state.phase === 'design' && <Design />}
      {state.phase === 'review' && <Review />}
      {state.phase === 'calc' && state.calc && <FlightCalc />}
      {state.phase === 'launch' && <Launch />}
      {state.phase === 'ops' && <Ops />}
      {state.phase === 'report' && <Report />}
    </GameCtx.Provider>
  )
}
