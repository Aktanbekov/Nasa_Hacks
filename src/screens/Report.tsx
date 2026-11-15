import { useEffect, useState } from 'react'
import { ORBITS, byId } from '../../shared/catalog.ts'
import { ownsRole } from '../../shared/game.ts'
import { getScenario } from '../../shared/scenarios.ts'
import { Medal } from '../art.tsx'
import { computeMetrics } from '../../shared/calc.ts'
import { CraftStage } from '../stages.tsx'
import { useCtx } from '../ui.tsx'

interface Entry { key: string; team: string; score: number; tier: string; summary: string; date: string }

function loadBoard(scenarioId: string): Entry[] {
  try { return JSON.parse(localStorage.getItem(`lw-board-${scenarioId}`) ?? '[]') } catch { return [] }
}

export function Report() {
  const { state, dispatch, me } = useCtx()
  const sc = getScenario(state.scenarioId!)
  const r = state.report!
  const design = state.design!
  const [board, setBoard] = useState<Entry[]>(() => loadBoard(sc.id))

  // Save this flight to the per-scenario leaderboard (once per flight).
  useEffect(() => {
    const key = `${state.code}-${state.seed}-${state.flight}`
    const entries = loadBoard(sc.id)
    if (entries.some((e) => e.key === key)) return
    const team = Object.values(state.players).filter((p) => p.roles.length).map((p) => p.name).join(', ')
    const summary = `${byId(ORBITS, design.orbitId).name.split(',')[0]} · ${design.satellites > 1 ? design.satellites + ' sats · ' : ''}${design.instruments.length} instruments`
    entries.push({ key, team, score: r.score, tier: r.tier, summary, date: new Date().toLocaleDateString() })
    entries.sort((a, b) => b.score - a.score)
    const top = entries.slice(0, 10)
    try { localStorage.setItem(`lw-board-${sc.id}`, JSON.stringify(top)) } catch { /* storage unavailable */ }
    setBoard(top)
  }, [state.code, state.seed, state.flight]) // eslint-disable-line react-hooks/exhaustive-deps

  const canAct = state.mode === 'solo' || ownsRole(state, me, 'lead')
  const max = Math.max(...r.breakdown.map((b) => b.points), 1)
  const headline = r.tier === 'Exceeded' ? 'Mission exceeded expectations'
    : r.tier === 'Success' ? 'Mission success'
    : r.tier === 'Partial' ? 'Partial success'
    : r.launchFailed ? 'Lost at launch' : 'Mission failure'

  return (
    <main className="page report">
      <section className="stack">
        <div className="panel">
          <div className="row wrap" style={{ gap: 20, alignItems: 'flex-end' }}>
            <Medal tier={r.tier} />
            <div>
              <span className={`tier ${r.tier}`}>{r.tier}</span>
              <h2 style={{ fontSize: 28, marginTop: 10 }}>{headline}</h2>
              <p className="muted" style={{ margin: '4px 0 0' }}>{sc.name} · Flight {state.flight}</p>
            </div>
            <div className="spacer" />
            <div style={{ textAlign: 'right' }}>
              <div className="score">{r.score}</div>
              <div className="small muted">mission score</div>
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>Why it happened</h3>
          <div className="why">
            {r.why.map((w, k) => (
              <div key={k}><span className={w.tone === 'good' ? 'good' : w.tone === 'bad' ? 'bad' : 'info'}>{w.tone === 'good' ? '✓' : w.tone === 'bad' ? '✕' : '•'}</span><span>{w.text}</span></div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3>Score breakdown</h3>
          {r.breakdown.map((b) => (
            <div key={b.label} className="bd-row">
              <span>{b.label}</span><span className="pts">{b.points}</span>
              <div className="bar" style={{ gridColumn: '1 / -1' }}><i style={{ width: `${(b.points / max) * 100}%`, background: 'var(--accent)' }} /></div>
              <span className="detail">{b.detail}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3>Objectives</h3>
          {r.objectives.map((o) => (
            <div key={o.id} className="inst-row">
              <span><span className={`tag ${o.kind}`} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, marginRight: 8 }}>{o.kind === 'primary' ? 'Must' : 'Bonus'}</span>{o.name}<span className="faint small"> · {o.detail}</span></span>
              <span className={o.met ? 'good' : 'bad'}>{o.met ? '✓ met' : '✕'}</span>
            </div>
          ))}
        </div>

        <div className="row wrap">
          {canAct ? (
            <>
              <button className="btn primary big" onClick={() => dispatch({ type: 'redesign' })}>Redesign and fly again</button>
              <button className="btn big" onClick={() => dispatch({ type: 'newMission' })}>Choose a new mission</button>
            </>
          ) : <span className="muted">The Mission Lead decides whether to fly again.</span>}
        </div>
      </section>

      <aside className="side">
        <div className="panel">
          <h3>Your spacecraft</h3>
          <div className="stage-card" style={{ marginBottom: 8 }}><CraftStage design={design} sc={sc} m={computeMetrics(design, sc)} /></div>
          {r.stats.map((s) => <div key={s.label} className="inst-row"><span className="muted">{s.label}</span><span className="mono">{s.value}</span></div>)}
        </div>
        <div className="panel stack">
          <h3 style={{ marginBottom: 0 }}>Real-world match</h3>
          {r.matches.map((mt, k) => (
            <div key={mt.name} className="match">
              <div className="row"><b>{k === 0 ? `Your design is most like ${mt.name}` : `Also similar: ${mt.name}`}</b></div>
              <div className="small faint">{mt.agency} · {mt.year} · {Math.round(mt.similarity * 100)}% match</div>
              <p className="small" style={{ margin: '6px 0' }}>{mt.note}</p>
              {mt.url && <a className="small" href={mt.url} target="_blank" rel="noreferrer">Learn about {mt.name} →</a>}
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>Leaderboard · {sc.name}</h3>
          <table className="lb">
            <tbody>
              {board.map((e, k) => (
                <tr key={e.key} style={e.key === `${state.code}-${state.seed}-${state.flight}` ? { color: 'var(--accent)' } : undefined}>
                  <td className="mono faint">{k + 1}</td>
                  <td>{e.team}<div className="tiny faint">{e.summary} · {e.tier}</div></td>
                  <td className="n">{e.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny faint">Saved on this device. Different designs can all win: try another orbit or payload.</p>
        </div>
      </aside>
    </main>
  )
}
