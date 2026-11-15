// Mission report: score, outcome tier, "why it happened" and real-world match.
// Science only counts if the data actually reached the ground.
import { ADCS, ANTENNAS, BATTERIES, NETWORKS, PROPULSION, ROCKETS, RULES, SOLAR, STORAGE, byId } from './catalog.ts'
import { computeMetrics, downlinkPerDay, fmtM, parts, pointingQuality, r1 } from './calc.ts'
import type { Design, GameState, Report, Scenario, SimState, Tier } from './types.ts'
import { fireDate, fmtHours, WILDFIRES } from './wildfires.ts'

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const pct = (x: number) => `${Math.round(x * 100)}%`

/** Science points each instrument delivered to the ground. */
export function scienceByInstrument(sim: SimState, design: Design, scenario: Scenario) {
  const p = parts(design, scenario)
  const n = design.satellites
  const deliveredRatio = sim.generatedGB > 0 ? sim.downlinkedGB / sim.generatedGB : 0
  const constellation = 1 + RULES.constellationBonus * (n - 1)
  const out: Record<string, number> = {}
  for (const i of p.instruments) {
    const st = sim.instrumentState[i.id]
    const planned = i.dataGBPerDay * n * sim.plannedDays
    const fraction = planned > 0 ? (st.generatedGB * deliveredRatio) / planned : 0
    const quality = (p.orbit.quality[i.kind] ?? 1) * pointingQuality(i, p.adcs.accuracyDeg) * st.quality
    out[i.id] = i.science * fraction * quality * constellation
  }
  return out
}

export function objectiveStatus(sim: SimState | null, design: Design, scenario: Scenario) {
  const p = parts(design, scenario)
  const m = computeMetrics(design, scenario)
  const sci = sim ? scienceByInstrument(sim, design, scenario) : {}
  return scenario.objectives.map((o) => {
    if (o.survive) {
      const met = !!sim && sim.day >= sim.plannedDays && sim.health > 0
      return { id: o.id, name: o.name, kind: o.kind, met, detail: met ? 'Survived the full mission.' : sim ? `Operated ${r1(sim.day / 365)} of ${scenario.lifetimeYears} years.` : 'Did not launch.' }
    }
    if (o.minFastAlerts) {
      const fast = (sim?.fires ?? []).filter((f) => f.alertHours !== null && f.alertHours <= 3).length
      const done = !!sim && (sim.ended || sim.day >= sim.plannedDays)
      const met = fast >= o.minFastAlerts
      return { id: o.id, name: o.name, kind: o.kind, met, detail: `${fast} of ${o.minFastAlerts} needed fires alerted within 3 hours${done || met ? '' : ' so far'}.` }
    }
    if (o.minDelivered) {
      const frac = sim && sim.generatedGB > 0 ? (sim.downlinkedGB) / sim.generatedGB : 0
      const met = !!sim && sim.generatedGB > 0 && frac >= o.minDelivered
      return { id: o.id, name: o.name, kind: o.kind, met, detail: `${Math.round(frac * 100)}% of data delivered (needs ${Math.round(o.minDelivered * 100)}%).` }
    }
    const pts = p.instruments.reduce((s, i) => s + (sci[i.id] ?? 0) * (i.objectives[o.id] ?? 0), 0)
    const revisitOk = !o.minRevisitPerDay || m.revisitPerDay >= o.minRevisitPerDay
    const met = pts >= o.threshold && revisitOk && (o.threshold > 0 || pts > 0)
    let detail = `${Math.floor(pts)} of ${o.threshold} science points delivered.`
    if (!revisitOk) detail = `Only ${r1(m.revisitPerDay)} looks per day (needs ${o.minRevisitPerDay}).`
    else if (pts === 0) detail = 'No instrument on board feeds this goal.'
    return { id: o.id, name: o.name, kind: o.kind, met, detail }
  })
}

export function buildReport(state: GameState, scenario: Scenario): Report {
  const design = state.design!
  const sim = state.sim
  const p = parts(design, scenario)
  const m = computeMetrics(design, scenario, state.overtimeM)
  const launchFailed = !!state.launch && !state.launch.success
  const why: Report['why'] = []

  const sci = sim ? scienceByInstrument(sim, design, scenario) : {}
  const sciencePts = Math.round(Object.values(sci).reduce((a, b) => a + b, 0))
  const objectives = objectiveStatus(launchFailed ? null : sim, design, scenario)
  const primaries = objectives.filter((o) => o.kind === 'primary')
  const bonuses = objectives.filter((o) => o.kind === 'bonus')
  const primaryMet = primaries.filter((o) => o.met).length
  const bonusMet = bonuses.filter((o) => o.met).length
  const objPts = primaryMet * 100 + bonusMet * 50

  const finalCost = m.costM + (sim?.extraCostM ?? 0)
  const left = scenario.budgetM - finalCost
  const budgetPts = Math.round(clamp((100 * left) / (0.25 * scenario.budgetM), 0, 100))

  const massMargin = m.rocketCapacityKg > 0 ? 1 - m.launchMassKg / m.rocketCapacityKg : 0
  const powerMargin = m.loadW > 0 ? m.powerMarginW / m.loadW : 0
  const dataMargin = Number.isFinite(m.downlinkMargin) ? m.downlinkMargin : 1
  const mf = (x: number) => clamp(x / 0.2, 0, 1)
  const marginPts = Math.round((mf(massMargin) + mf(powerMargin) + mf(dataMargin)) * 33.4)

  const decisions = sim?.decisions ?? []
  const decisionAvg = decisions.length ? decisions.reduce((s, d) => s + d.quality, 0) / decisions.length : 0.75
  const players = Object.values(state.players)
  const everyoneBuilt = state.mode === 'team'
    ? players.filter((pl) => pl.roles.length > 0).every((pl) => pl.edits > 0)
    : m.checks.every((c) => c.status === 'pass')
  const teamPts = Math.round(decisionAvg * 60 + (state.reviewAttempts <= 1 ? 20 : 0) + (everyoneBuilt ? 20 : 0))

  const calc = state.calc?.result
  const calcRow = calc ? {
    label: 'Flight math',
    points: calc.points,
    detail: calc.grade === 'autopilot'
      ? `Autopilot flew the burn${calc.twrOk ? '; liftoff check correct' : ''}.`
      : `Burn ${Math.round((1 - Math.abs(calc.ratio - 1)) * 100)}% accurate${calc.twrOk ? ', liftoff check correct' : ', liftoff check missed'} (up to 80).`,
  } : null
  // Real wildfire replay: fires the mission never reached count as missed.
  const fires: NonNullable<Report['fires']> = !sim || launchFailed ? [] : (sim.fireSchedule ?? []).map((f) => {
    const out = (sim.fires ?? []).find((o) => o.fireIndex === f.fireIndex)
    const fr = WILDFIRES[f.fireIndex]
    return {
      name: fr.name, date: fireDate(fr), acres: fr.acres, lat: fr.lat, lon: fr.lon,
      seenHours: out?.seenHours ?? null, alertHours: out?.alertHours ?? null, by: out?.by ?? null,
      why: out?.why ?? 'The mission had already ended.', points: out?.points ?? 0,
    }
  })
  const fireRow = fires.length ? {
    label: 'Real fire replay',
    points: Math.min(100, fires.reduce((a, f) => a + f.points, 0)),
    detail: `${fires.filter((f) => f.alertHours !== null && f.alertHours <= 3).length}/${fires.length} real fires alerted within 3 hours (up to 12 points each).`,
  } : null
  const breakdown: Report['breakdown'] = launchFailed
    ? [
        { label: 'Science delivered', points: 0, detail: 'The rocket failed. No science reached the ground.' },
        { label: 'Objectives met', points: 0, detail: '0 objectives.' },
        { label: 'Budget efficiency', points: 0, detail: `${fmtM(finalCost)} spent.` },
        { label: 'Engineering margins', points: marginPts, detail: 'Credit for a sound design.' },
        { label: 'Teamwork & ops calls', points: Math.round(teamPts / 2), detail: 'Partial credit.' },
        ...(calcRow ? [calcRow] : []),
        ...(fireRow ? [fireRow] : []),
      ]
    : [
        { label: 'Science delivered', points: sciencePts, detail: `From ${p.instruments.length} instrument${p.instruments.length === 1 ? '' : 's'}, counting only data that reached the ground.` },
        { label: 'Objectives met', points: objPts, detail: `${primaryMet}/${primaries.length} must-have (100 each), ${bonusMet}/${bonuses.length} bonus (50 each).` },
        { label: 'Budget efficiency', points: budgetPts, detail: left >= 0 ? `${fmtM(left)} left of ${fmtM(scenario.budgetM)}.` : `${fmtM(-left)} over budget.` },
        { label: 'Engineering margins', points: marginPts, detail: `Mass ${pct(massMargin)}, power ${pct(powerMargin)}, downlink ${pct(dataMargin)} (20%+ each is full marks).` },
        { label: 'Teamwork & ops calls', points: teamPts, detail: `${decisions.length} event decision${decisions.length === 1 ? '' : 's'}${state.reviewAttempts <= 1 ? ', passed review first try' : ''}${everyoneBuilt ? (state.mode === 'team' ? ', every role contributed' : ', clean review') : ''}.` },
        ...(calcRow ? [calcRow] : []),
        ...(fireRow ? [fireRow] : []),
      ]
  const level = scenario.level
  if (level && level.scoreMultiplier > 1) {
    const base = breakdown.reduce((s, b) => s + b.points, 0)
    breakdown.push({ label: `${level.label} difficulty bonus`, points: Math.round(base * (level.scoreMultiplier - 1)), detail: `×${level.scoreMultiplier} for playing on ${level.label}.` })
  }
  const score = breakdown.reduce((s, b) => s + b.points, 0)

  // ---- Tier ----
  let tier: Tier
  const earlyLoss = !sim || sim.day < sim.plannedDays * 0.25
  if (launchFailed || earlyLoss || primaryMet === 0) tier = 'Failure'
  else if (primaryMet < primaries.length) tier = 'Partial'
  else if (bonusMet >= 2) tier = 'Exceeded'
  else tier = 'Success'

  // ---- Why it happened ----
  if (launchFailed) {
    const better = scenario.rockets.map((id) => byId(ROCKETS, id)).find((r) => r.reliability > p.rocket.reliability && r.capacity[p.orbit.dest] >= m.launchMassKg)
    why.push({ tone: 'bad', text: `The ${p.rocket.name.toLowerCase()} failed. It had a ${pct(1 - p.rocket.reliability)} chance of failure.${better ? ` A ${better.name.toLowerCase()} (+${fmtM(better.costM - p.rocket.costM)}) fails only ${pct(1 - better.reliability)} of the time.` : ''} Cheap rides carry real risk.` })
  }
  if (sim && !launchFailed) {
    const lossFrac = sim.generatedGB > 0 ? sim.lostGB / sim.generatedGB : 0
    const dlFrac = sim.generatedGB > 0 ? sim.lostDownlinkGB / sim.generatedGB : 0
    const stFrac = sim.generatedGB > 0 ? sim.lostStorageGB / sim.generatedGB : 0
    if (dlFrac >= 0.03) {
      const fix = cheapestDownlinkFix(design, scenario)
      why.push({ tone: 'bad', text: `You lost ${pct(dlFrac)} of your data because your downlink was too small for the data you made${m.downlinkMargin < 0.2 ? ` (only ${pct(Math.max(0, m.downlinkMargin))} margin; real passes get missed)` : ''}.${fix ? ` ${fix}` : ''}` })
    }
    if (stFrac >= 0.01) {
      const bigger = STORAGE.find((s) => s.capacityGB >= (m.dataGBPerDay / design.satellites) * 14)
      why.push({ tone: 'bad', text: `A ground outage filled the ${p.storage.capacityGB} GB recorder and ${pct(stFrac)} of the data was lost.${bigger && bigger.id !== p.storage.id ? ` A ${bigger.name} (+${r1(bigger.massKg - p.storage.massKg)} kg, +${fmtM(bigger.costM - p.storage.costM)}) would have held it.` : ''}` })
    }
    if (lossFrac < 0.02 && sim.generatedGB > 0) why.push({ tone: 'good', text: `${pct(1 - lossFrac)} of all data made it home. Your downlink and storage margins did their job.` })

    if (sim.powerShortDays > 0) {
      const next = SOLAR.find((s) => s.outputW > p.solar.outputW)
      const cause = m.powerMarginW < 0 ? 'the arrays were too small from day one' : 'aging solar cells and storm damage ate the margin'
      why.push({ tone: 'bad', text: `On ${sim.powerShortDays} days instruments were throttled because ${cause}.${next ? ` ${next.name} (+${r1(next.massKg - p.solar.massKg)} kg, +${fmtM(next.costM - p.solar.costM)}) would have covered it.` : ''}` })
    }
    if (sim.eclipseShortDays > 0) {
      const next = BATTERIES.find((b) => b.capacityWh > p.battery.capacityWh)
      why.push({ tone: 'bad', text: `On ${sim.eclipseShortDays} days the battery couldn't carry the spacecraft through eclipse${m.depthOfDischarge > 0.4 ? `; draining it to ${pct(1 - m.depthOfDischarge)} every orbit wore it out` : ''}.${next ? ` A ${next.name} (+${r1(next.massKg - p.battery.massKg)} kg, +${fmtM(next.costM - p.battery.costM)}) gives more headroom.` : ''}` })
    }
    if (m.pointingIssues.length) {
      const fix = ADCS.find((a) => a.worksAt.includes(p.orbit.dest) && p.instruments.every((i) => a.accuracyDeg <= i.pointingDeg))
      why.push({ tone: 'bad', text: `Blurry data: ${m.pointingIssues[0]}, but the ${p.adcs.name.toLowerCase()} only point to ${p.adcs.accuracyDeg}°. That cut its science by more than half.${fix ? ` ${fix.name} (+${r1(fix.massKg - p.adcs.massKg)} kg, +${fmtM(fix.costM - p.adcs.costM)}) would fix it.` : ''}` })
    }
    if (sim.day < sim.plannedDays) {
      if (sim.endReason.includes('drag') || sim.endReason.includes('impacted') || sim.endReason.includes('Drifted')) {
        const prop = PROPULSION.find((x) => x.deltaV - p.orbit.insertionDv >= p.orbit.stationKeepingDv * scenario.lifetimeYears * 1.1)
        why.push({ tone: 'bad', text: `The mission ended after ${r1(sim.day / 365)} years: ${sim.endReason.toLowerCase()} ${p.orbit.name} needs ${p.orbit.stationKeepingDv} m/s of fuel per year to hold.${prop && prop.id !== p.prop.id ? ` ${prop.name} (+${r1(prop.massKg - p.prop.massKg)} kg, +${fmtM(prop.costM - p.prop.costM)}) would have lasted.` : ''}` })
      } else if (sim.health <= 0) {
        why.push({ tone: 'bad', text: `The spacecraft was lost on day ${sim.day}. ${design.redundancy ? '' : 'A redundant flight computer (+6 kg, +$4M) softens storm and fault damage.'}` })
      } else {
        why.push({ tone: 'bad', text: `The mission ended early on day ${sim.day}: ${sim.endReason.toLowerCase()}` })
      }
    } else why.push({ tone: 'good', text: `The spacecraft survived all ${scenario.lifetimeYears} years with ${Math.round(sim.health)}% health.` })

    if (fires.length) {
      const fast = fires.filter((f) => f.alertHours !== null && f.alertHours <= 3).length
      const best = fires.filter((f) => f.alertHours !== null).sort((a, b) => a.alertHours! - b.alertHours!)[0]
      why.push({ tone: fast >= fires.length / 2 ? 'good' : 'bad', text: `Real fire replay: your design would have alerted crews within 3 hours for ${fast} of ${fires.length} real California fires${best ? `, fastest the ${best.name} (${fmtHours(best.alertHours!)})` : ''}.` })
    }
    if (calc && calc.grade !== 'autopilot') {
      why.push({ tone: calc.grade === 'bullseye' || calc.grade === 'good' ? 'good' : 'bad', text: `Flight math: ${calc.verdict} ${calc.effect}` })
    }
    for (const d of sim.decisions) {
      if (d.templateId === 'budget-cut' && d.optionId === 'reserve') why.push({ tone: 'good', text: 'Keeping a budget reserve let you absorb the funding cut with no loss of science.' })
      if (d.templateId === 'solar-storm' && d.quality < 0.3) why.push({ tone: 'bad', text: 'Observing through the solar storm damaged the spacecraft. Safe mode costs a few days but protects the mission.' })
    }
  }
  for (const o of objectives.filter((x) => !x.met && x.kind === 'primary' && !x.detail.startsWith('Operated') && !launchFailed)) {
    why.push({ tone: 'bad', text: `Missed must-have goal "${o.name}": ${o.detail}` })
  }
  if (left >= scenario.budgetM * 0.15 && !launchFailed) why.push({ tone: 'good', text: `You finished with ${fmtM(left)} unspent, which counts for budget efficiency.` })

  // ---- Real-world match ----
  const matches = scenario.realMissions
    .map((rm) => {
      const a = new Set(design.instruments)
      const b = new Set(rm.instruments)
      const inter = [...a].filter((x) => b.has(x)).length
      const union = new Set([...a, ...b]).size || 1
      const similarity = 0.55 * (inter / union) + 0.3 * (rm.orbitIds.includes(design.orbitId) ? 1 : 0) + 0.15 * (1 - Math.min(1, Math.abs(rm.satellites - design.satellites) / 2))
      return { ...rm, similarity }
    })
    .sort((x, y) => y.similarity - x.similarity)
    .slice(0, 2)

  const stats = sim && !launchFailed ? [
    { label: 'Days operated', value: `${sim.day} / ${sim.plannedDays}` },
    { label: 'Data collected', value: `${Math.round(sim.generatedGB).toLocaleString()} GB` },
    { label: 'Data delivered', value: `${Math.round(sim.downlinkedGB).toLocaleString()} GB` },
    { label: 'Data lost', value: sim.generatedGB > 0 ? pct(sim.lostGB / sim.generatedGB) : '0%' },
    { label: 'Final cost', value: `${fmtM(finalCost)} / ${fmtM(scenario.budgetM)}` },
    { label: 'Final health', value: `${Math.round(sim.health)}%` },
  ] : [{ label: 'Final cost', value: `${fmtM(finalCost)} / ${fmtM(scenario.budgetM)}` }]

  return { tier, score, breakdown, objectives, why: why.slice(0, 8), matches, stats, launchFailed, fires }
}

// Look up the antenna / network change that gives 25%+ downlink margin for the least money.
function cheapestDownlinkFix(design: Design, scenario: Scenario): string | null {
  const p = parts(design, scenario)
  const need = (p.instruments.reduce((s, i) => s + i.dataGBPerDay, 0)) * 1.25
  const options: { text: string; cost: number }[] = []
  for (const a of ANTENNAS) {
    for (const gId of scenario.networks) {
      const g = byId(NETWORKS, gId)
      if (a.id === p.antenna.id && g.id === p.ground.id) continue
      const d = { ...design, antennaId: a.id, groundId: g.id }
      if (downlinkPerDay(d, scenario) < need) continue
      const cost = (a.costM - p.antenna.costM) * design.satellites + (g.costPerYearM - p.ground.costPerYearM) * scenario.lifetimeYears
      const bits = []
      if (a.id !== p.antenna.id) bits.push(`a ${a.name} (+${r1(a.massKg - p.antenna.massKg)} kg)`)
      if (g.id !== p.ground.id) bits.push(`the ${g.name}`)
      options.push({ text: `Switching to ${bits.join(' and ')} (${cost >= 0 ? '+' : '−'}${fmtM(Math.abs(cost))}) would have fixed it.`, cost })
    }
  }
  options.sort((x, y) => x.cost - y.cost)
  return options[0]?.text ?? null
}
