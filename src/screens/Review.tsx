import { ROCKETS, byId } from '../../shared/catalog.ts'
import { canLaunch, computeMetrics, fmtM } from '../../shared/calc.ts'
import { activePlayers, overtimeCost, ownsRole, ROLE_SHORT } from '../../shared/game.ts'
import { getScenario } from '../../shared/scenarios.ts'
import { Dashboard, Feed, Timer } from './Design.tsx'
import { useCtx } from '../ui.tsx'

export function Review() {
  const { state, dispatch, me, now } = useCtx()
  const sc = getScenario(state.scenarioId!)
  const design = state.design!
  const overtime = overtimeCost(state, now())
  const m = computeMetrics(design, sc, overtime)
  const ok = canLaunch(m)
  const team = state.mode === 'team'
  const players = activePlayers(state)
  const allApproved = !team || players.every((p) => state.approvals[p.id])
  const iLead = ownsRole(state, me, 'lead')
  const rocket = byId(ROCKETS, design.rocketId)
  const fails = m.checks.filter((c) => c.blocking && c.status === 'fail')
  const warns = m.checks.filter((c) => c.status === 'warn' || (!c.blocking && c.status === 'fail'))

  return (
    <main className="page review">
      <section className="stack">
        <div className="row wrap" style={{ gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 22 }}>Design review</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>Real missions pass formal reviews before launch. Red items block launch; amber items are risks you can accept.</p>
          </div>
          <div className="spacer" />
          <Timer />
        </div>
        <div className="panel">
          {m.checks.map((c) => (
            <div key={c.id} className="check-row">
              <span className={`check-icon ${c.status}`} aria-label={c.status}>{c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✕'}</span>
              <div>
                <b>{c.label}</b>{c.status === 'fail' && c.blocking && <span className="bad small"> · blocks launch</span>}
                <div className="small muted">{c.detail}</div>
                {c.fix && <div className="fix">{c.fix}</div>}
              </div>
            </div>
          ))}
        </div>
        <div className="panel stack">
          {!ok ? (
            <p style={{ margin: 0 }}><b className="bad">{fails.length} check{fails.length > 1 ? 's' : ''} failed.</b> The team can't launch until {fails.length > 1 ? 'they are' : 'it is'} fixed.</p>
          ) : (
            <p style={{ margin: 0 }}><b className="good">All launch-critical checks pass.</b> {warns.length ? `${warns.length} risk${warns.length > 1 ? 's' : ''} to accept.` : 'Clean review.'} The {rocket.name.toLowerCase()} succeeds {Math.round(rocket.reliability * 1000) / 10}% of the time.</p>
          )}
          {overtime > 0 && <p className="small bad" style={{ margin: 0 }}>Schedule slip: {fmtM(overtime)} added to the budget for going over the design timer.</p>}

          {team && ok && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="small muted">Every player must approve. Any design change resets approvals.</span>
              <div className="row wrap">
                {players.map((p) => (
                  <span key={p.id} className="chip" style={{ borderColor: state.approvals[p.id] ? 'var(--good)' : undefined }}>
                    {state.approvals[p.id] ? '✓' : '…'} {p.name} <span className="faint">{p.roles.map((r) => ROLE_SHORT[r]).join(', ')}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="row wrap">
            <button className="btn" onClick={() => dispatch({ type: 'backToDesign' })}>← Back to design</button>
            <span className="spacer" />
            {team && ok && (
              <button className={`btn ${state.approvals[me] ? '' : 'primary'}`} onClick={() => dispatch({ type: 'approve', value: !state.approvals[me] })}>
                {state.approvals[me] ? 'Withdraw approval' : 'I approve this design'}
              </button>
            )}
            {(!team || iLead) && (
              <button className="btn primary big" disabled={!ok || !allApproved} onClick={() => dispatch({ type: 'launch' })}
                title={!ok ? 'Fix the failed checks first' : !allApproved ? 'Waiting for every player to approve' : 'Go for launch'}>
                🚀 {team ? 'Go for launch' : 'Approve & launch'}
              </button>
            )}
            {team && !iLead && ok && <span className="small muted">The Mission Lead gives the final go.</span>}
          </div>
        </div>
      </section>
      <aside className="side">
        <Dashboard design={design} sc={sc} m={m} overtime={overtime} />
        <Feed />
      </aside>
    </main>
  )
}
