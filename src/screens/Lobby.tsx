import { activePlayers, ROLE_NAMES, uncoveredRoles } from '../../shared/game.ts'
import { COMING_SOON, SCENARIOS } from '../../shared/scenarios.ts'
import { ROLES, type Role } from '../../shared/types.ts'
import { ScenarioArt } from '../stages.tsx'
import { ROLE_COLOR, useCtx } from '../ui.tsx'

const ROLE_INFO: Record<Role, { controls: string; wants: string }> = {
  lead: { controls: 'Budget, orbit, rocket, fleet size, final launch call', wants: 'Stay under budget, launch on time' },
  science: { controls: 'Instruments', wants: 'Maximum science, so more instruments' },
  engineer: { controls: 'Bus, solar arrays, battery, pointing, propulsion', wants: 'Low mass, positive power' },
  comms: { controls: 'Antenna, ground stations, data recorder', wants: 'Enough downlink for all the data' },
}

export function Lobby() {
  const { state, dispatch, me } = useCtx()
  const team = state.mode === 'team'
  const missing = uncoveredRoles(state)
  const players = activePlayers(state)
  const canStart = !!state.scenarioId && (!team || missing.length === 0)
  const shareUrl = `${location.origin}${location.pathname}?room=${state.code}`

  return (
    <main className="page lobby">
      <section className="stack">
        <div>
          <h2 style={{ fontSize: 24 }}>Choose a mission brief</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>Each brief has a budget, a deadline, must-have goals and bonus goals.</p>
        </div>
        <div className="scenarios">
          {SCENARIOS.map((s) => {
            const sel = state.scenarioId === s.id
            return (
              <button key={s.id} className={`scenario ${sel ? 'sel' : ''}`} onClick={() => dispatch({ type: 'chooseScenario', scenarioId: s.id })} aria-pressed={sel}>
                <ScenarioArt id={s.id} />
                <div className="row"><h2>{s.name}</h2><span className="spacer" /><span className={`small diff-${s.difficulty}`}>{s.difficulty}</span></div>
                <div className="muted small">{s.objective}</div>
                <div className="facts">
                  <span className="chip mono">${s.budgetM}M budget</span>
                  <span className="chip mono">{s.lifetimeYears} yr mission</span>
                  <span className="chip mono">{state.relaxed ? 'no timer' : `${s.designMinutes} min design`}</span>
                  {s.maxSatellites > 1 && <span className="chip mono">up to {s.maxSatellites} satellites</span>}
                </div>
                <div className="small"><b>Must-have</b></div>
                <ul>{s.objectives.filter((o) => o.kind === 'primary').map((o) => <li key={o.id}>{o.name}</li>)}</ul>
                <div className="small"><b>Bonus</b></div>
                <ul>{s.objectives.filter((o) => o.kind === 'bonus').map((o) => <li key={o.id}>{o.name}</li>)}</ul>
              </button>
            )
          })}
          {COMING_SOON.map((s) => (
            <button key={s.name} className="scenario" disabled>
              <div className="row"><h2>{s.name}</h2><span className="spacer" /><span className={`small diff-${s.difficulty}`}>{s.difficulty}</span></div>
              <div className="muted small">{s.tagline}</div>
              <span className="chip" style={{ alignSelf: 'flex-start' }}>Coming soon</span>
            </button>
          ))}
        </div>
      </section>

      <aside className="stack">
        {team && (
          <div className="panel">
            <h3>Room code</h3>
            <div className="code">{state.code}</div>
            <p className="small muted">Teammates join from the home screen with this code, or with this link:</p>
            <div className="row">
              <input type="text" readOnly value={shareUrl} style={{ flex: 1, fontSize: 12 }} onFocus={(e) => e.target.select()} />
              <button className="btn sm" onClick={() => navigator.clipboard?.writeText(shareUrl)}>Copy</button>
            </div>
          </div>
        )}
        <div className="panel">
          <h3>{team ? 'Take a role' : 'Your roles'}</h3>
          {team && <p className="small muted" style={{ marginTop: 0 }}>Each role owns part of the spacecraft, and their goals conflict. With fewer than 4 players, someone takes two roles.</p>}
          {!team && <p className="small muted" style={{ marginTop: 0 }}>Solo: you control everything. Advisors for each role will warn you when their part of the mission is in trouble.</p>}
          <div className="roles">
            {ROLES.map((r) => {
              const holder = players.find((p) => p.roles.includes(r))
              const mine = holder?.id === me
              return (
                <button key={r} className={`role-card ${mine ? 'mine' : ''}`} style={{ color: ROLE_COLOR[r] }}
                  onClick={() => team && dispatch({ type: 'claimRole', role: r })} disabled={!team} aria-pressed={mine}>
                  <b>{ROLE_NAMES[r]}</b>
                  <span className="small" style={{ color: 'var(--text)' }}>{ROLE_INFO[r].controls}</span>
                  <span className="tiny muted">Wants: {ROLE_INFO[r].wants}</span>
                  {team && <span className="who">{holder ? (mine ? 'You (click to release)' : holder.name) : 'Open: click to take'}</span>}
                </button>
              )
            })}
          </div>
        </div>
        <div className="panel stack">
          <label className="toggle small">
            <input type="checkbox" checked={state.relaxed} onChange={(e) => dispatch({ type: 'setRelaxed', relaxed: e.target.checked })} />
            Relaxed mode: no design timer (good for classrooms and first plays)
          </label>
          <button className="btn primary big" disabled={!canStart} onClick={() => dispatch({ type: 'startDesign' })}>Start design phase</button>
          {!state.scenarioId && <span className="small faint">Pick a mission brief first.</span>}
          {state.scenarioId && team && missing.length > 0 && <span className="small warn">Still open: {missing.map((r) => ROLE_NAMES[r]).join(', ')}</span>}
        </div>
      </aside>
    </main>
  )
}
