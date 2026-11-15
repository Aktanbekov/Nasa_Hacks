import { useEffect, useRef } from 'react'
import { computeMetrics, parts, r1 } from '../../shared/calc.ts'
import { activePlayers, ownsRole } from '../../shared/game.ts'
import { getScenario } from '../../shared/scenarios.ts'
import { objectiveStatus } from '../../shared/score.ts'
import type { SimPoint } from '../../shared/types.ts'
import { liveFrom, OrbitStage } from '../stages.tsx'
import { Term, useCtx } from '../ui.tsx'
import { Feed } from './Design.tsx'

interface Series { key: keyof SimPoint; label: string; color: string; dash?: string; fill?: boolean }

function Chart({ data, series, xMax, yMax, unit, height = 180 }: { data: SimPoint[]; series: Series[]; xMax: number; yMax?: number; unit: string; height?: number }) {
  const W = 640
  const H = height
  const pad = { l: 44, r: 10, t: 10, b: 22 }
  const maxY = yMax ?? Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]))))
  const x = (d: number) => pad.l + (d / xMax) * (W - pad.l - pad.r)
  const y = (v: number) => H - pad.b - (v / maxY) * (H - pad.t - pad.b)
  const ticks = [0, 0.5, 1].map((f) => f * maxY)
  const years = Math.floor(xMax / 365)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--faint)" fontFamily="IBM Plex Mono">{t >= 1000 ? `${r1(t / 1000)}k` : Math.round(t)}{unit}</text>
        </g>
      ))}
      {Array.from({ length: years + 1 }).map((_, k) => (
        <text key={k} x={x(k * 365)} y={H - 6} fontSize="11" fill="var(--faint)" textAnchor={k === 0 ? 'start' : k * 365 >= xMax - 30 ? 'end' : 'middle'} fontFamily="IBM Plex Mono">{k === 0 ? 'launch' : `yr ${k}`}</text>
      ))}
      {series.map((s) => {
        if (data.length < 2) return null
        const pts = data.map((d) => `${x(d.day)},${y(Number(d[s.key]))}`).join(' ')
        return (
          <g key={s.key}>
            {s.fill && <polygon points={`${x(data[0].day)},${y(0)} ${pts} ${x(data[data.length - 1].day)},${y(0)}`} fill={s.color} opacity=".12" />}
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} strokeLinejoin="round" />
          </g>
        )
      })}
    </svg>
  )
}

export function Ops() {
  const { state, dispatch } = useCtx()
  const sc = getScenario(state.scenarioId!)
  const design = state.design!
  const sim = state.sim!
  const p = parts(design, sc)
  const m = computeMetrics(design, sc)
  const pct = sim.day / sim.plannedDays
  const objectives = objectiveStatus(sim, design, sc)
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }) }, [sim.log.length])
  const fuelYears = p.orbit.stationKeepingDv > 0 ? sim.fuelDv / p.orbit.stationKeepingDv : 99
  const storageCap = p.storage.capacityGB * design.satellites

  return (
    <main className="page ops">
      <section className="stack">
        <div className="row wrap" style={{ gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 22 }}>Operations · Day {sim.day} <span className="muted" style={{ fontWeight: 400 }}>of {sim.plannedDays} (year {Math.min(sc.lifetimeYears, Math.floor(sim.day / 365) + 1)})</span></h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>{design.satellites > 1 ? `${design.satellites} spacecraft` : 'Spacecraft'} in {p.orbit.name.toLowerCase()}. Watch data, power and health as the years fly by.</p>
          </div>
          <div className="spacer" />
          <div className="row">
            <button className="btn sm" onClick={() => dispatch({ type: 'setPaused', paused: !state.paused })}>{state.paused ? '▶ Resume' : '❚❚ Pause'}</button>
            {[1, 4, 16].map((s) => (
              <button key={s} className={`btn sm ${state.speed === s ? 'primary' : ''}`} onClick={() => dispatch({ type: 'setSpeed', speed: s })}>{s}×</button>
            ))}
          </div>
        </div>
        <div className="progress" aria-label="Mission progress">
          <i style={{ width: `${pct * 100}%` }} />
          {sim.eventSchedule.map((e) => <span key={e.day} className="ev" style={{ left: `${(e.day / sim.plannedDays) * 100}%` }} title="Event" />)}
        </div>
        <div className="scene stage-card">
          <OrbitStage design={design} sc={sc} live={liveFrom(sim, state.pendingEvent?.templateId ?? null)} />
          <div className="scene-hud">
            <span className="chip">Year {Math.min(sc.lifetimeYears, Math.floor(sim.day / 365) + 1)} · day {sim.day % 365}</span>
            <span className={`chip ${sim.health < 50 ? 'bad' : ''}`}>♥ {Math.round(sim.health)}%</span>
            <span className="chip">▲ {Math.round(sim.downlinkedGB).toLocaleString()} GB home</span>
            {sim.lostGB > 0 && <span className="chip bad">✕ {Math.round(sim.lostGB).toLocaleString()} GB lost</span>}
          </div>
        </div>
        <div className="tiles">
          <div className="tile"><div className="k">Data delivered</div><div className="v">{Math.round(sim.downlinkedGB).toLocaleString()} GB</div></div>
          <div className="tile"><div className="k">Data lost</div><div className={`v ${sim.lostGB > 0 ? 'bad' : ''}`}>{sim.generatedGB > 0 ? Math.round((sim.lostGB / sim.generatedGB) * 100) : 0}%</div></div>
          <div className="tile"><div className="k">Health</div><div className={`v ${sim.health < 50 ? 'bad' : sim.health < 90 ? 'warn' : 'good'}`}>{Math.round(sim.health)}%</div></div>
          <div className="tile"><div className="k"><Term id="storage">Recorder</Term></div><div className={`v ${sim.bufferGB > storageCap * 0.8 ? 'bad' : ''}`}>{Math.round((sim.bufferGB / storageCap) * 100)}% full</div></div>
        </div>
        <div className="panel">
          <h3>Data: collected vs. delivered to the ground</h3>
          <Chart data={sim.history} xMax={sim.plannedDays} unit="" series={[
            { key: 'generated', label: 'Collected', color: 'var(--science)', fill: true },
            { key: 'downlinked', label: 'Delivered', color: 'var(--good)' },
            { key: 'lost', label: 'Lost', color: 'var(--bad)', dash: '4 3' },
          ]} />
          <div className="legend"><span><i className="dot" style={{ background: 'var(--science)' }} />Collected (GB)</span><span><i className="dot" style={{ background: 'var(--good)' }} />Delivered</span><span><i className="dot" style={{ background: 'var(--bad)' }} />Lost</span></div>
        </div>
        <div className="panel">
          <h3>Battery and spacecraft health</h3>
          <Chart data={sim.history} xMax={sim.plannedDays} yMax={100} unit="%" height={150} series={[
            { key: 'battery', label: 'Battery', color: 'var(--engineer)' },
            { key: 'health', label: 'Health', color: 'var(--accent)' },
          ]} />
          <div className="legend"><span><i className="dot" style={{ background: 'var(--engineer)' }} />Lowest battery charge in <Term id="eclipse">eclipse</Term></span><span><i className="dot" style={{ background: 'var(--accent)' }} />Spacecraft health</span></div>
        </div>
      </section>
      <aside className="side">
        <div className="panel">
          <h3>Systems</h3>
          <div className="inst-row"><span>Solar output</span><span className="mono">{Math.round(sim.solarHealth * 100)}%</span></div>
          <div className="inst-row"><span><Term id="battery">Battery capacity</Term></span><span className={`mono ${sim.batteryHealth < 0.7 ? 'bad' : ''}`}>{Math.round(sim.batteryHealth * 100)}%</span></div>
          <div className="inst-row"><span><Term id="deltav">Fuel</Term></span><span className="mono">{sim.fuelDv <= 0 ? (p.orbit.naturalLifeYears * 365 + sim.day >= sim.plannedDays && sim.endDayCap >= sim.plannedDays ? 'not needed' : 'empty') : fuelYears > 30 ? 'plenty' : `${r1(fuelYears)} yr left`}</span></div>
          <div className="inst-row"><span>Power margin today</span><span className={`mono ${m.solarAvgW * sim.solarHealth < m.loadW ? 'bad' : ''}`}>{Math.round(m.solarAvgW * sim.solarHealth - m.loadW)} W</span></div>
          {p.instruments.map((i) => {
            const st = sim.instrumentState[i.id]
            return <div key={i.id} className="inst-row"><span>{i.name}</span><span className={st.on ? (st.quality < 1 ? 'warn' : 'good') : 'bad'}>{st.on ? (st.quality < 1 ? 'degraded' : 'nominal') : 'off'}</span></div>
          })}
        </div>
        <div className="panel">
          <h3>Goals (live)</h3>
          {objectives.map((o) => (
            <div key={o.id} className="inst-row"><span><span className={`tag ${o.kind}`} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, marginRight: 6 }}>{o.kind === 'primary' ? 'Must' : 'Bonus'}</span>{o.name}</span><span className={o.met ? 'good' : 'faint'}>{o.met ? '✓' : '…'}</span></div>
          ))}
        </div>
        <div className="panel">
          <h3>Mission log</h3>
          <div className="log" ref={logRef}>
            {sim.log.map((l, k) => <div key={k}><span className="mono faint">Day {l.day}</span><span className={l.tone === 'bad' ? 'bad' : l.tone === 'good' ? 'good' : ''}>{l.text}</span></div>)}
          </div>
        </div>
        {state.mode === 'team' && <Feed />}
      </aside>
      {state.pendingEvent && <EventModal />}
    </main>
  )
}

function EventModal() {
  const { state, dispatch, me } = useCtx()
  const ev = state.pendingEvent!
  const team = state.mode === 'team'
  const players = activePlayers(state)
  const iLead = ownsRole(state, me, 'lead')
  const myVote = state.votes[me]
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="ev-title">
      <div className="modal">
        <span className="chip mono">Day {ev.day} · {team ? 'team decision' : 'your call'}</span>
        <h2 id="ev-title">{ev.title}</h2>
        <p className="muted" style={{ marginTop: 0 }}>{ev.body}</p>
        {ev.options.map((o) => {
          const voters = players.filter((p) => state.votes[p.id] === o.id)
          const disabled = ev.disabled[o.id]
          return (
            <button key={o.id} className={`btn choice ${myVote === o.id ? 'voted' : ''}`} disabled={!!disabled} onClick={() => dispatch({ type: 'vote', optionId: o.id })}>
              <b>{o.label}</b>
              <span className="small muted">{disabled ?? o.detail}</span>
              {team && voters.length > 0 && <span className="votes">{voters.map((v) => <span key={v.id} className="chip">{v.name}</span>)}</span>}
            </button>
          )
        })}
        {team && (
          <div className="row wrap small" style={{ marginTop: 14 }}>
            <span className="muted">{Object.keys(state.votes).length}/{players.length} voted. Majority wins when everyone has voted{players.some((p) => p.roles.includes('lead')) ? '; the Mission Lead breaks ties' : ''}.</span>
            <span className="spacer" />
            {iLead && myVote && <button className="btn sm primary" onClick={() => dispatch({ type: 'decide', optionId: myVote })}>Make the final call now</button>}
          </div>
        )}
      </div>
    </div>
  )
}
