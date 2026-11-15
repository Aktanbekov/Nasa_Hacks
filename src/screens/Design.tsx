import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ADCS, ANTENNAS, BATTERIES, BUSES, NETWORKS, ORBITS, PROPULSION, REDUNDANCY, ROCKETS, RULES, SOLAR, STORAGE, byId,
} from '../../shared/catalog.ts'
import { advisors, computeMetrics, downlinkPerDay, fmtM, parts, r1 } from '../../shared/calc.ts'
import { overtimeCost, ownsRole, ROLE_NAMES, ROLE_SHORT } from '../../shared/game.ts'
import { getScenario } from '../../shared/scenarios.ts'
import { ROLES, type Design as DesignT, type Metrics, type Role, type Scenario } from '../../shared/types.ts'
import { HudIcon, PartArt } from '../art.tsx'
import { CraftView, GraphicsToggle, OrbitView, RocketView } from '../scene3d.tsx'
import { Avatar, INSTRUMENT_COLORS, Meter, OptionCard, ROLE_COLOR, Stat, Term, useCtx } from '../ui.tsx'

export function useClock(ms = 1000) {
  const [, setT] = useState(0)
  useEffect(() => { const id = setInterval(() => setT((t) => t + 1), ms); return () => clearInterval(id) }, [ms])
}

export function Timer() {
  const { state, now } = useCtx()
  useClock()
  if (state.relaxed || !state.scenarioId) return <span className="timer" title="Relaxed mode">no timer</span>
  const sc = getScenario(state.scenarioId)
  const left = sc.designMinutes * 60 - Math.floor((now() - state.designStartedAt) / 1000)
  const over = left < 0
  const a = Math.abs(left)
  return (
    <span className={`timer ${over ? 'over' : ''}`} title={over ? 'Over time: each started minute costs money' : 'Design time left'}>
      {over ? '+' : ''}{Math.floor(a / 60)}:{String(a % 60).padStart(2, '0')}
    </span>
  )
}

export function Design() {
  const { state, dispatch, me, now } = useCtx()
  const sc = getScenario(state.scenarioId!)
  const design = state.design!
  useClock(5000)
  const overtime = overtimeCost(state, now())
  const m = useMemo(() => computeMetrics(design, sc, overtime), [design, sc, overtime])
  const myRoles = ROLES.filter((r) => ownsRole(state, me, r))
  const [tab, setTab] = useState<Role>(myRoles[0] ?? 'lead')
  const [view, setView] = useState<StageView>(myRoles[0] === 'lead' ? 'orbit' : 'craft')
  const adv = advisors(design, sc, m)
  const pickTab = (r: Role) => { setTab(r); setView(r === 'lead' ? 'orbit' : 'craft') }

  return (
    <main className="page hangar">
      <div className="row wrap hangar-head">
        <div style={{ minWidth: 0, flex: '1 1 300px' }}>
          <h2 style={{ fontSize: 22 }}>Design phase · {sc.name}</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>{sc.objective}</p>
        </div>
        <Timer />
        <button className="btn primary" onClick={() => dispatch({ type: 'goReview' })}>Call design review →</button>
      </div>
      <Hud design={design} sc={sc} m={m} overtime={overtime} />
      <div className="hangar-grid">
        <section className="bay">
          <div className="stage-card">
            <div className="stage-tabs" role="tablist" aria-label="View">
              {(['craft', 'rocket', 'orbit'] as StageView[]).map((v) => (
                <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                  {v === 'craft' ? 'Spacecraft' : v === 'rocket' ? 'On the rocket' : 'In orbit'}
                </button>
              ))}
            </div>
            <GraphicsToggle />
            {view === 'craft' && <CraftView design={design} sc={sc} m={m} />}
            {view === 'rocket' && <RocketView design={design} sc={sc} m={m} />}
            {view === 'orbit' && <OrbitView design={design} sc={sc} />}
          </div>
          <div className="crew">
            {adv.map((a) => (
              <div key={a.role} className={`bubble ${a.tone}`}>
                <Avatar role={a.role} />
                <span><b style={{ color: ROLE_COLOR[a.role] }}>{ROLE_SHORT[a.role]}</b> {a.text}</span>
              </div>
            ))}
          </div>
          <Feed />
        </section>
        <section className="tray">
          <div className="tabs" role="tablist" aria-label="Stations">
            {ROLES.map((r) => {
              const alert = adv.find((a) => a.role === r)?.tone === 'bad'
              const owner = Object.values(state.players).find((p) => p.connected && p.roles.includes(r))
              return (
                <button key={r} role="tab" aria-selected={tab === r} className={`tab ${tab === r ? 'on' : ''}`} style={{ color: tab === r ? ROLE_COLOR[r] : undefined }} onClick={() => pickTab(r)}>
                  <Avatar role={r} />
                  <span style={{ color: 'var(--text)' }}>{ROLE_SHORT[r]}</span>
                  {state.mode === 'team' && <span className="owner">{owner?.id === me ? 'you' : owner?.name ?? 'open'}</span>}
                  {alert && <span className="alert" title="Advisor warning" />}
                </button>
              )
            })}
          </div>
          {!ownsRole(state, me, tab) && (
            <div className="readonly-banner">You are viewing the {ROLE_NAMES[tab]}'s station. Only they can change it, so use the team feed to ask for changes.</div>
          )}
          {tab === 'lead' && <LeadPanel design={design} sc={sc} m={m} />}
          {tab === 'science' && <SciencePanel design={design} sc={sc} m={m} />}
          {tab === 'engineer' && <EngineerPanel design={design} sc={sc} m={m} />}
          {tab === 'comms' && <CommsPanel design={design} sc={sc} m={m} />}
        </section>
      </div>
    </main>
  )
}

type StageView = 'craft' | 'rocket' | 'orbit'

function Gauge({ icon, label, value, sub, frac, tone, mark }: { icon: Parameters<typeof HudIcon>[0]['name']; label: ReactNode; value: string; sub: ReactNode; frac: number; tone: 'good' | 'bad' | 'warn' | 'info'; mark?: number }) {
  return (
    <div className={`gauge ${tone}`}>
      <span className="gauge-icon"><HudIcon name={icon} /></span>
      <div className="gauge-body">
        <div className="gauge-label">{label}</div>
        <div className="gauge-value">{value}</div>
        <div className="gauge-bar"><i style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%` }} />{mark !== undefined && <span style={{ left: `${mark * 100}%` }} />}</div>
        <div className="gauge-sub">{sub}</div>
      </div>
    </div>
  )
}

export function Hud({ design, sc, m, overtime }: { design: DesignT; sc: Scenario; m: Metrics; overtime: number }) {
  const p = parts(design, sc)
  const revisitGoal = sc.objectives.find((o) => o.minRevisitPerDay)?.minRevisitPerDay
  const dataPerSat = m.dataGBPerDay / design.satellites
  const downPerSat = m.downlinkGBPerDay / design.satellites
  return (
    <div className="hud" aria-label="Shared dashboard">
      <Gauge icon="budget" label="Budget" value={`${fmtM(m.costM)}`} frac={m.costM / m.budgetM}
        tone={m.costM > m.budgetM ? 'bad' : m.costM > m.budgetM * 0.95 ? 'warn' : 'good'}
        sub={overtime > 0 ? <span className="bad">+{fmtM(overtime)} <Term id="standingarmy">late</Term></span> : `of ${fmtM(m.budgetM)}`} />
      <Gauge icon="mass" label={<Term id="mass">Mass</Term>} value={`${Math.round(m.launchMassKg)} kg`} frac={m.rocketCapacityKg ? m.launchMassKg / m.rocketCapacityKg : 1}
        tone={m.rocketCapacityKg === 0 || m.launchMassKg > m.rocketCapacityKg ? 'bad' : m.launchMassKg > m.rocketCapacityKg * 0.9 ? 'warn' : 'good'}
        sub={m.rocketCapacityKg ? `of ${m.rocketCapacityKg} kg` : "rocket can't reach"} />
      <Gauge icon="power" label={<Term id="power">Power</Term>} value={`${m.powerMarginW >= 0 ? '+' : ''}${Math.round(m.powerMarginW)} W`} frac={m.solarAvgW ? m.loadW / Math.max(m.solarAvgW, m.loadW) : 1}
        tone={m.powerMarginW < 0 ? 'bad' : m.powerMarginEolW < 0 ? 'warn' : 'good'}
        sub={`${Math.round(m.loadW)} of ${Math.round(m.solarAvgW)} W`} />
      <Gauge icon="battery" label={<Term id="eclipse">Eclipse</Term>} value={m.eclipseShortW > 0 ? `−${Math.ceil(m.eclipseShortW)} W` : `${Math.round(m.depthOfDischarge * 100)}% used`} frac={m.eclipseNeedWh / p.battery.capacityWh} mark={RULES.maxDepthOfDischarge}
        tone={m.eclipseShortW > 0 ? 'bad' : m.depthOfDischarge > 0.4 ? 'warn' : 'good'}
        sub={`${p.orbit.eclipseMin} min in shadow`} />
      <Gauge icon="data" label={<Term id="downlink">Downlink</Term>} value={dataPerSat === 0 ? '—' : `${r1(dataPerSat)}/${r1(downPerSat)}`} frac={dataPerSat / Math.max(dataPerSat, downPerSat, 0.01)}
        tone={dataPerSat === 0 ? 'info' : dataPerSat > downPerSat ? 'bad' : m.downlinkMargin < 0.2 ? 'warn' : 'good'}
        sub="GB/day made / sent" />
      <Gauge icon="life" label={<Term id="deltav">Lifetime</Term>} value={m.lifetimeYears === 0 ? 'no orbit' : `${m.lifetimeYears > 30 ? '30+' : r1(m.lifetimeYears)} yr`} frac={m.lifetimeYears / (sc.lifetimeYears * 1.5)} mark={1 / 1.5}
        tone={m.lifetimeYears === 0 ? 'bad' : m.lifetimeYears >= sc.lifetimeYears ? 'good' : 'warn'}
        sub={`need ${sc.lifetimeYears} yr`} />
      {revisitGoal && (
        <Gauge icon="eye" label={<Term id="revisit">Looks/day</Term>} value={m.revisitPerDay > 50 ? 'nonstop' : `${r1(m.revisitPerDay)}`} frac={m.revisitPerDay / (revisitGoal * 2)} mark={0.5}
          tone={m.revisitPerDay >= revisitGoal ? 'good' : 'bad'} sub={`need ${revisitGoal}`} />
      )}
    </div>
  )
}

export function Dashboard({ design, sc, m, overtime }: { design: DesignT; sc: Scenario; m: Metrics; overtime: number }) {
  const p = parts(design, sc)
  const revisitGoal = sc.objectives.find((o) => o.minRevisitPerDay)?.minRevisitPerDay
  const dataPerSat = m.dataGBPerDay / design.satellites
  const downPerSat = m.downlinkGBPerDay / design.satellites
  const lifeOk = m.lifetimeYears >= sc.lifetimeYears
  return (
    <div className="panel">
      <h3>Shared dashboard</h3>
      <div className="stage-card" style={{ marginBottom: 4 }}><GraphicsToggle /><CraftView design={design} sc={sc} m={m} /></div>
      <div className="stack" style={{ gap: 12, marginTop: 8 }}>
        <Meter label="Budget" value={m.costM} max={m.budgetM} tone={m.costM > m.budgetM ? 'bad' : m.costM > m.budgetM * 0.95 ? 'warn' : 'good'}
          text={`${fmtM(m.costM)} / ${fmtM(m.budgetM)}`}
          sub={overtime > 0 ? <span className="bad">Includes {fmtM(overtime)} <Term id="standingarmy">over-time cost</Term></span> : `${fmtM(m.budgetM - m.costM)} reserve`} />
        <Meter label={<Term id="mass">Launch mass</Term>} value={m.launchMassKg} max={m.rocketCapacityKg || 1}
          tone={m.rocketCapacityKg === 0 || m.launchMassKg > m.rocketCapacityKg ? 'bad' : m.launchMassKg > m.rocketCapacityKg * 0.9 ? 'warn' : 'good'}
          text={m.rocketCapacityKg === 0 ? `${r1(m.launchMassKg)} kg / can't reach` : `${r1(m.launchMassKg)} / ${m.rocketCapacityKg} kg`}
          sub={`${p.rocket.name}, ${Math.round(p.rocket.reliability * 100)}% reliable`} />
        <Meter label={<Term id="power">Power (sunlit average)</Term>} value={m.loadW} max={Math.max(m.solarAvgW, m.loadW)}
          tone={m.powerMarginW < 0 ? 'bad' : m.powerMarginEolW < 0 ? 'warn' : 'good'}
          text={`${Math.round(m.loadW)} W used / ${Math.round(m.solarAvgW)} W`}
          sub={m.powerMarginW < 0 ? <span className="bad">{Math.ceil(-m.powerMarginW)} W short</span> : `${Math.round(m.powerMarginW)} W spare${m.powerMarginEolW < 0 ? `, short by year ${sc.lifetimeYears} as cells age` : ''}`} />
        <Meter label={<Term id="eclipse">Eclipse battery</Term>} value={m.eclipseNeedWh} max={p.battery.capacityWh} mark={RULES.maxDepthOfDischarge}
          tone={m.eclipseShortW > 0 ? 'bad' : m.depthOfDischarge > 0.4 ? 'warn' : 'good'}
          text={`${Math.round(m.eclipseNeedWh)} / ${p.battery.capacityWh} Wh`}
          sub={m.eclipseShortW > 0 ? <span className="bad">{Math.ceil(m.eclipseShortW)} W short in a {p.orbit.eclipseMin}-min eclipse</span> : <>Each eclipse uses {Math.round(m.depthOfDischarge * 100)}% of the <Term id="battery">battery</Term> (line = 60% hard limit)</>} />
        <Meter label={<Term id="downlink">Data vs downlink</Term>} value={dataPerSat} max={Math.max(dataPerSat, downPerSat, 0.01)}
          tone={dataPerSat === 0 ? 'info' : dataPerSat > downPerSat ? 'bad' : m.downlinkMargin < 0.2 ? 'warn' : 'good'}
          text={`${r1(dataPerSat)} / ${r1(downPerSat)} GB/day`}
          sub={dataPerSat === 0 ? 'No instruments yet' : dataPerSat > downPerSat ? <span className="bad">{r1(dataPerSat - downPerSat)} GB/day can't get home</span> : `${Math.round(m.downlinkMargin * 100)}% margin · recorder holds ${r1(m.storageDays)} days`} />
        <Meter label={<Term id="deltav">Lifetime</Term>} value={Math.min(m.lifetimeYears, sc.lifetimeYears * 1.5)} max={sc.lifetimeYears * 1.5} mark={1 / 1.5}
          tone={m.lifetimeYears === 0 ? 'bad' : lifeOk ? 'good' : 'warn'}
          text={m.lifetimeYears === 0 ? "can't reach orbit" : `${m.lifetimeYears > 30 ? '30+' : r1(m.lifetimeYears)} / ${sc.lifetimeYears} yr`}
          sub={m.lifetimeYears === 0 ? <span className="bad">Needs {p.orbit.insertionDv} m/s to brake into orbit</span> : `Limited by ${m.lifetimeLimit}`} />
        {revisitGoal && (
          <Meter label={<Term id="revisit">Looks at target per day</Term>} value={Math.min(m.revisitPerDay, revisitGoal * 2)} max={revisitGoal * 2} mark={0.5}
            tone={m.revisitPerDay >= revisitGoal ? 'good' : 'bad'} text={`${m.revisitPerDay > 50 ? 'constant' : r1(m.revisitPerDay)} / ${revisitGoal} needed`} />
        )}
      </div>
    </div>
  )
}

export function Feed() {
  const { state, dispatch } = useCtx()
  const [text, setText] = useState('')
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }) }, [state.feed.length])
  return (
    <div className="panel">
      <h3>{state.mode === 'team' ? 'Team feed' : 'Change log'}</h3>
      <div className="feed" ref={box} aria-live="polite">
        {state.feed.length === 0 && <span className="faint small">Every change shows its consequences here.</span>}
        {state.feed.map((f) => (
          <div key={f.id} className={`feed-item ${f.tone ?? ''}`}>
            {f.who && <span className="who" style={{ color: f.role && f.role in ROLE_COLOR ? ROLE_COLOR[f.role as Role] : undefined }}>{f.who}</span>}
            {f.text}
          </div>
        ))}
      </div>
      {state.mode === 'team' && (
        <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); dispatch({ type: 'chat', text }); setText('') }}>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the team…" style={{ flex: 1 }} />
          <button className="btn sm" disabled={!text.trim()}>Send</button>
        </form>
      )}
    </div>
  )
}

// ---------------- Role panels ----------------

interface PanelProps { design: DesignT; sc: Scenario; m: Metrics }

function Section({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="section">
      <div className="section-head"><h2>{title}</h2>{hint && <p>{hint}</p>}</div>
      {children}
    </div>
  )
}

function useSet(role: Role) {
  const { state, dispatch, me } = useCtx()
  const locked = !ownsRole(state, me, role)
  const set = (patch: Partial<DesignT>) => { if (!locked) dispatch({ type: 'setDesign', patch }) }
  return { locked, set }
}

function LeadPanel({ design, sc, m }: PanelProps) {
  const { locked, set } = useSet('lead')
  const p = parts(design, sc)
  return (
    <>
      <Section title="Orbit" hint="Where the spacecraft lives decides what it sees, how much power it gets, and how hard it is to reach.">
        <div className="options">
          {sc.orbits.map((id) => {
            const o = byId(ORBITS, id)
            const blocked = p.rocket.onlyOrbits && !p.rocket.onlyOrbits.includes(id)
            return (
              <OptionCard key={id} art={<PartArt id={id} />} selected={design.orbitId === id} locked={locked} onClick={() => set({ orbitId: id })} name={o.name} blurb={o.blurb}
                note={blocked ? `${p.rocket.name} can't go here` : undefined}
                stats={<>
                  <Stat k="eclipse" v={`${o.eclipseMin} min`} />
                  {o.dest !== 'moon' && <Stat k="looks/day" v={o.revisitPerSat > 50 ? 'constant' : o.revisitPerSat} />}
                  <Stat k="hold" v={`${o.stationKeepingDv} m/s/yr`} />
                  {o.insertionDv > 0 && <Stat k="brake in" v={`${o.insertionDv} m/s`} />}
                </>} />
            )
          })}
        </div>
      </Section>
      <Section title="Launch vehicle" hint={<>Capacity shown for your current orbit. Cheaper rockets have lower <Term id="reliability">reliability</Term>.</>}>
        <div className="options">
          {sc.rockets.map((id) => {
            const r = byId(ROCKETS, id)
            const cap = r.onlyOrbits && !r.onlyOrbits.includes(design.orbitId) && !r.onlyOrbits.some((o) => sc.orbits.includes(o)) ? 0 : r.capacity[p.orbit.dest]
            return (
              <OptionCard key={id} art={<PartArt id={id} />} selected={design.rocketId === id} locked={locked} onClick={() => set({ rocketId: id })} name={r.name} blurb={r.blurb}
                note={r.onlyOrbits ? 'Sets the orbit to 600 km sun-synchronous' : cap === 0 ? 'Cannot reach this orbit' : undefined}
                stats={<>
                  <Stat k="lifts" v={cap ? `${cap} kg` : '—'} />
                  <Stat k="cost" v={fmtM(r.costM)} />
                  <Stat k="success" v={`${Math.round(r.reliability * 1000) / 10}%`} />
                </>} />
            )
          })}
        </div>
      </Section>
      {sc.maxSatellites > 1 && (
        <Section title={<Term id="constellation">Fleet size</Term>} hint={`More satellites mean more looks per day and more science, but each copy costs ${Math.round(RULES.repeatUnitCost * 100)}% of the first and adds launch mass.`}>
          <div className="row" style={{ gap: 16 }}>
            <div className="stepper">
              <button disabled={locked || design.satellites <= 1} onClick={() => set({ satellites: design.satellites - 1 })} aria-label="Fewer satellites">−</button>
              <span>{design.satellites}</span>
              <button disabled={locked || design.satellites >= sc.maxSatellites} onClick={() => set({ satellites: design.satellites + 1 })} aria-label="More satellites">+</button>
            </div>
            <span className="small muted">{r1(m.revisitPerDay)} looks/day · {r1(m.launchMassKg)} kg total</span>
          </div>
        </Section>
      )}
      <Section title="Budget breakdown">
        <div className="panel" style={{ padding: 12 }}>
          {m.costBreakdown.map((c) => (
            <div key={c.label} className="row small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span>{c.label}</span><span className="spacer" /><span className="mono">{fmtM(c.costM)}</span>
            </div>
          ))}
          <div className="row" style={{ paddingTop: 8 }}>
            <b>Total</b><span className="spacer" /><b className={`mono ${m.costM > m.budgetM ? 'bad' : ''}`}>{fmtM(m.costM)} / {fmtM(m.budgetM)}</b>
          </div>
        </div>
      </Section>
    </>
  )
}

function SciencePanel({ design, sc }: PanelProps) {
  const { state, dispatch, me } = useCtx()
  const locked = !ownsRole(state, me, 'science')
  const p = parts(design, sc)
  return (
    <>
      <Section title="Mission goals" hint="Science only counts if the data reaches the ground.">
        <div className="objective-list">
          {sc.objectives.map((o) => {
            const feeders = p.instruments.filter((i) => (i.objectives[o.id] ?? 0) > 0)
            return (
              <div key={o.id} className="objective">
                <span className={`tag ${o.kind}`}>{o.kind === 'primary' ? 'Must' : 'Bonus'}</span>
                <div style={{ flex: 1 }}>
                  <b>{o.name}</b> <span className="muted">{o.blurb}</span>
                  {!o.survive && <div className="tiny" style={{ marginTop: 2 }}>{feeders.length ? <span className="good">Covered by {feeders.map((f) => f.name).join(', ')}</span> : <span className="faint">Nothing on board covers this yet</span>}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </Section>
      <Section title="Instruments" hint={<>Bus has {p.bus.slots} slots and {p.bus.maxPayloadKg} kg for payload. <Term id="pointing">Pointing</Term> matters for sharp instruments.</>}>
        <div className="options">
          {sc.instruments.map((inst, k) => {
            const on = design.instruments.includes(inst.id)
            const q = p.orbit.quality[inst.kind] ?? 1
            const blurry = p.adcs.accuracyDeg > inst.pointingDeg
            return (
              <OptionCard key={inst.id} art={<PartArt id={inst.id} kind={inst.kind} />} multi selected={on} locked={locked} onClick={() => dispatch({ type: 'toggleInstrument', instrumentId: inst.id })} name={inst.name} blurb={inst.blurb}
                note={on && blurry ? `Needs ${inst.pointingDeg}° pointing: current system gives ${p.adcs.accuracyDeg}°` : q < 0.8 ? `Only ${Math.round(q * 100)}% as useful from this orbit` : q > 1.05 ? `${Math.round(q * 100)}% as useful from this orbit` : undefined}
                stats={<>
                  <span className="dot" style={{ background: INSTRUMENT_COLORS[k % INSTRUMENT_COLORS.length], alignSelf: 'center' }} />
                  <Stat k="" v={`${inst.massKg} kg`} /><Stat k="" v={`${inst.powerW} W`} /><Stat k="" v={fmtM(inst.costM)} />
                  <Stat k="" v={`${inst.dataGBPerDay} GB/day`} /><Stat k="science" v={inst.science} /><Stat k="aim" v={`${inst.pointingDeg}°`} />
                </>}>
                <span className="goals">
                  {Object.keys(inst.objectives).map((oid) => {
                    const o = sc.objectives.find((x) => x.id === oid)
                    return o ? <span key={oid} className={`goal-tag ${o.kind === 'primary' ? 'p' : ''}`}>{o.name}</span> : null
                  })}
                </span>
              </OptionCard>
            )
          })}
        </div>
      </Section>
    </>
  )
}

function EngineerPanel({ design, sc, m }: PanelProps) {
  const { locked, set } = useSet('engineer')
  const p = parts(design, sc)
  const sunFrac = 1 - p.orbit.eclipseMin / p.orbit.periodMin
  return (
    <>
      <Section title="Spacecraft bus" hint="The frame, computer and wiring. Bigger buses carry more but weigh and cost more.">
        <div className="options">
          {BUSES.map((b) => (
            <OptionCard key={b.id} art={<PartArt id={b.id} />} selected={design.busId === b.id} locked={locked} onClick={() => set({ busId: b.id })} name={b.name} blurb={b.blurb}
              note={design.busId === b.id && (m.slotsUsed > b.slots || m.payloadKg > b.maxPayloadKg) ? 'Instruments don\'t fit' : undefined}
              stats={<><Stat k="" v={`${b.massKg} kg`} /><Stat k="" v={fmtM(b.costM)} /><Stat k="uses" v={`${b.basePowerW} W`} /><Stat k="slots" v={b.slots} /><Stat k="payload" v={`${b.maxPayloadKg} kg`} /></>} />
          ))}
        </div>
      </Section>
      <Section title="Solar arrays" hint={<>Average power after <Term id="eclipse">eclipse</Term> and charging losses at this orbit.</>}>
        <div className="options">
          {SOLAR.map((s) => (
            <OptionCard key={s.id} art={<PartArt id={s.id} />} selected={design.solarId === s.id} locked={locked} onClick={() => set({ solarId: s.id })} name={s.name} blurb={s.blurb}
              stats={<><Stat k="avg" v={`${Math.round(s.outputW * sunFrac * RULES.chargeEfficiency)} W`} /><Stat k="" v={`${s.massKg} kg`} /><Stat k="" v={fmtM(s.costM)} /></>} />
          ))}
        </div>
      </Section>
      <Section title="Battery" hint={<>Runs the spacecraft through each {p.orbit.eclipseMin}-minute eclipse. Keep the <Term id="battery">depth of discharge</Term> under 40% for long life.</>}>
        <div className="options">
          {BATTERIES.map((b) => {
            const dod = m.eclipseNeedWh / b.capacityWh
            return (
              <OptionCard key={b.id} art={<PartArt id={b.id} />} selected={design.batteryId === b.id} locked={locked} onClick={() => set({ batteryId: b.id })} name={b.name} blurb={b.blurb}
                note={dod > RULES.maxDepthOfDischarge ? 'Too small for the current eclipse load' : undefined}
                stats={<><Stat k="drains" v={`${Math.round(dod * 100)}%`} /><Stat k="" v={`${b.massKg} kg`} /><Stat k="" v={fmtM(b.costM)} /></>} />
            )
          })}
        </div>
      </Section>
      <Section title={<Term id="pointing">Pointing control</Term>}>
        <div className="options">
          {ADCS.map((a) => (
            <OptionCard key={a.id} art={<PartArt id={a.id} />} selected={design.adcsId === a.id} locked={locked} onClick={() => set({ adcsId: a.id })} name={a.name} blurb={a.blurb}
              note={!a.worksAt.includes(p.orbit.dest) ? 'Does not work at this orbit' : undefined}
              stats={<><Stat k="aim" v={`${a.accuracyDeg}°`} /><Stat k="" v={`${a.powerW} W`} /><Stat k="" v={`${a.massKg} kg`} /><Stat k="" v={fmtM(a.costM)} /></>} />
          ))}
        </div>
      </Section>
      <Section title="Propulsion" hint={<>Gives <Term id="deltav">delta-v</Term> for braking into orbit and <Term id="stationkeeping">station-keeping</Term>.</>}>
        <div className="options">
          {PROPULSION.map((pr) => {
            const after = pr.deltaV - p.orbit.insertionDv
            const life = after < 0 ? 0 : (p.orbit.stationKeepingDv > 0 ? after / p.orbit.stationKeepingDv : 99) + p.orbit.naturalLifeYears
            return (
              <OptionCard key={pr.id} art={<PartArt id={pr.id} />} selected={design.propulsionId === pr.id} locked={locked} onClick={() => set({ propulsionId: pr.id })} name={pr.name} blurb={pr.blurb}
                note={after < 0 ? `Can't brake into this orbit (needs ${p.orbit.insertionDv} m/s)` : undefined}
                stats={<><Stat k="Δv" v={`${pr.deltaV} m/s`} /><Stat k="life here" v={after < 0 ? '0' : life > 30 ? '30+ yr' : `${r1(life)} yr`} /><Stat k="" v={`${pr.massKg} kg`} /><Stat k="" v={fmtM(pr.costM)} /></>} />
            )
          })}
        </div>
      </Section>
      <Section title={<Term id="redundancy">Redundancy</Term>}>
        <label className="toggle">
          <input type="checkbox" checked={design.redundancy} disabled={locked} onChange={(e) => set({ redundancy: e.target.checked })} />
          <span>Backup flight computer <span className="muted small">(+{REDUNDANCY.massKg} kg, +{REDUNDANCY.powerW} W, +{fmtM(REDUNDANCY.costM)}: halves damage from storms and faults)</span></span>
        </label>
      </Section>
    </>
  )
}

function CommsPanel({ design, sc, m }: PanelProps) {
  const { locked, set } = useSet('comms')
  const p = parts(design, sc)
  const dataPerSat = m.dataGBPerDay / design.satellites
  const where = p.orbit.comms === 'moon' ? 'at the Moon' : p.orbit.comms === 'geo' ? 'at geostationary distance' : 'in low orbit'
  return (
    <>
      <div className="panel small" style={{ marginBottom: 18 }}>
        Instruments make <b className="mono">{r1(dataPerSat)} GB/day</b> per spacecraft. Your link sends <b className={`mono ${m.downlinkGBPerDay / design.satellites < dataPerSat ? 'bad' : 'good'}`}>{r1(m.downlinkGBPerDay / design.satellites)} GB/day</b>.
        <span className="muted"> Downlink = <Term id="datarate">data rate</Term> × <Term id="contact">contact time</Term>. Plan 20%+ margin: real passes get missed.</span>
      </div>
      <Section title="Antenna" hint={`Rates shown ${where}.`}>
        <div className="options">
          {ANTENNAS.map((a) => (
            <OptionCard key={a.id} art={<PartArt id={a.id} />} selected={design.antennaId === a.id} locked={locked} onClick={() => set({ antennaId: a.id })} name={a.name} blurb={a.blurb}
              note={a.rateMbps[p.orbit.comms] === 0 ? 'Too weak to be heard from here' : undefined}
              stats={<>
                <Stat k="rate" v={`${a.rateMbps[p.orbit.comms]} Mbps`} />
                <Stat k="→" v={`${r1(downlinkPerDay({ ...design, antennaId: a.id }, sc))} GB/day`} />
                <Stat k="" v={`${a.massKg} kg`} /><Stat k="" v={fmtM(a.costM)} />
              </>} />
          ))}
        </div>
      </Section>
      <Section title="Ground stations" hint={p.orbit.comms === 'moon' ? <>Only the <Term id="dsn">Deep Space Network</Term> can hear a spacecraft at the Moon.</> : 'More stations means more passes per day.'}>
        <div className="options">
          {sc.networks.map((id) => {
            const g = byId(NETWORKS, id)
            const min = g.contactMin[p.orbit.comms]
            return (
              <OptionCard key={id} art={<PartArt id={id} />} selected={design.groundId === id} locked={locked} onClick={() => set({ groundId: id })} name={g.name} blurb={g.blurb}
                note={min === 0 ? 'Can\'t reach a spacecraft here' : undefined}
                stats={<>
                  <Stat k="contact" v={min >= 1440 ? '24 h/day' : `${min} min/day`} />
                  <Stat k="→" v={`${r1(downlinkPerDay({ ...design, groundId: id }, sc))} GB/day`} />
                  <Stat k="" v={`${fmtM(g.costPerYearM)}/yr`} />
                </>} />
            )
          })}
        </div>
      </Section>
      <Section title={<Term id="storage">Data recorder</Term>} hint="Holds data between passes and through outages.">
        <div className="options">
          {STORAGE.map((s) => (
            <OptionCard key={s.id} art={<PartArt id={s.id} />} selected={design.storageId === s.id} locked={locked} onClick={() => set({ storageId: s.id })} name={s.name} blurb={s.blurb}
              stats={<><Stat k="holds" v={dataPerSat > 0 ? `${r1(s.capacityGB / dataPerSat)} days` : `${s.capacityGB} GB`} /><Stat k="" v={`${s.massKg} kg`} /><Stat k="" v={fmtM(s.costM)} /></>} />
          ))}
        </div>
      </Section>
    </>
  )
}
