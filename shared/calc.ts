// Design math: turns a Design into live metrics, review checks and advisor hints.
// Every number on the shared dashboard comes from here.
import {
  ADCS, ANTENNAS, BATTERIES, BUSES, NETWORKS, ORBITS, PROPULSION, REDUNDANCY, ROCKETS, RULES, SOLAR, STORAGE, byId,
} from './catalog.ts'
import type { Check, Design, Instrument, Metrics, Role, Scenario } from './types.ts'

export const r1 = (n: number) => Math.round(n * 10) / 10
export const fmtM = (n: number) => `$${r1(n)}M`

export function parts(design: Design, scenario: Scenario) {
  const orbit = byId(ORBITS, design.orbitId)
  return {
    orbit,
    rocket: byId(ROCKETS, design.rocketId),
    bus: byId(BUSES, design.busId),
    solar: byId(SOLAR, design.solarId),
    battery: byId(BATTERIES, design.batteryId),
    adcs: byId(ADCS, design.adcsId),
    prop: byId(PROPULSION, design.propulsionId),
    antenna: byId(ANTENNAS, design.antennaId),
    ground: byId(NETWORKS, design.groundId),
    storage: byId(STORAGE, design.storageId),
    instruments: design.instruments.map((id) => scenario.instruments.find((i) => i.id === id)).filter(Boolean) as Instrument[],
  }
}

/** Data the ground network can pull down per day, per spacecraft (GB). */
export function downlinkPerDay(design: Design, scenario: Scenario) {
  const p = parts(design, scenario)
  const rate = p.antenna.rateMbps[p.orbit.comms]
  const minutes = p.ground.contactMin[p.orbit.comms]
  return (rate * minutes * 60 * RULES.linkEfficiency) / 8000
}

/** Average power the comms system draws (it only transmits during contacts). */
function commsPowerW(design: Design, scenario: Scenario) {
  const p = parts(design, scenario)
  const minutes = p.ground.contactMin[p.orbit.comms]
  return (p.antenna.powerW ?? 0) * Math.min(1, minutes / 1440) + 2
}

export function pointingQuality(inst: Instrument, adcsAccuracy: number) {
  return adcsAccuracy <= inst.pointingDeg ? 1 : RULES.badPointingQuality
}

export function computeMetrics(design: Design, scenario: Scenario, extraCostM = 0): Metrics {
  const p = parts(design, scenario)
  const n = design.satellites
  const years = scenario.lifetimeYears

  // ---- Mass ----
  const payloadKg = p.instruments.reduce((s, i) => s + i.massKg, 0)
  const massPerSatKg =
    p.bus.massKg + payloadKg + p.solar.massKg + p.battery.massKg + p.adcs.massKg + p.prop.massKg +
    p.antenna.massKg + p.storage.massKg + (design.redundancy ? REDUNDANCY.massKg : 0)
  const launchMassKg = massPerSatKg * n
  const rocketCapacityKg = p.rocket.onlyOrbits && !p.rocket.onlyOrbits.includes(p.orbit.id) ? 0 : p.rocket.capacity[p.orbit.dest]

  // ---- Cost ----
  const instCost = p.instruments.reduce((s, i) => s + i.costM, 0)
  const busCost = p.bus.costM + p.solar.costM + p.battery.costM + p.adcs.costM + p.prop.costM + (design.redundancy ? REDUNDANCY.costM : 0)
  const commsCost = p.antenna.costM + p.storage.costM
  const unit = instCost + busCost + commsCost
  const extraUnits = (n - 1) * unit * RULES.repeatUnitCost
  const groundCost = p.ground.costPerYearM * years
  const opsCost = scenario.opsCostPerYearM * years
  const costBreakdown = [
    { label: 'Instruments', costM: instCost * (1 + (n - 1) * RULES.repeatUnitCost) },
    { label: 'Spacecraft bus & power', costM: busCost * (1 + (n - 1) * RULES.repeatUnitCost) },
    { label: 'Antenna & storage', costM: commsCost * (1 + (n - 1) * RULES.repeatUnitCost) },
    { label: 'Launch', costM: p.rocket.costM },
    { label: `Ground stations (${years} yr)`, costM: groundCost },
    { label: `Operations team (${years} yr)`, costM: opsCost },
  ]
  if (extraCostM > 0) costBreakdown.push({ label: 'Schedule overrun', costM: extraCostM })
  const costM = unit + extraUnits + p.rocket.costM + groundCost + opsCost + extraCostM

  // ---- Power ----
  const instrumentLoadW = p.instruments.reduce((s, i) => s + i.powerW, 0)
  const loadW =
    p.bus.basePowerW + instrumentLoadW + (p.adcs.powerW ?? 0) + commsPowerW(design, scenario) +
    (design.redundancy ? REDUNDANCY.powerW : 0)
  const sunFrac = 1 - p.orbit.eclipseMin / p.orbit.periodMin
  const solarAvgW = p.solar.outputW * sunFrac * RULES.chargeEfficiency
  const powerMarginW = solarAvgW - loadW
  const eolFactor = Math.pow(1 - p.orbit.solarDegradation, years)
  const powerMarginEolW = solarAvgW * eolFactor - loadW
  const eclipseNeedWh = (loadW * p.orbit.eclipseMin) / 60
  const batteryUsableWh = p.battery.capacityWh * RULES.maxDepthOfDischarge
  const eclipseShortW = Math.max(0, loadW - batteryUsableWh / (p.orbit.eclipseMin / 60))
  const depthOfDischarge = eclipseNeedWh / p.battery.capacityWh

  // ---- Data ----
  const dataPerSat = p.instruments.reduce((s, i) => s + i.dataGBPerDay, 0)
  const downPerSat = downlinkPerDay(design, scenario)
  const dataGBPerDay = dataPerSat * n
  const downlinkGBPerDay = downPerSat * n
  const downlinkMargin = dataPerSat > 0 ? downPerSat / dataPerSat - 1 : Infinity
  const storageDays = dataPerSat > 0 ? p.storage.capacityGB / dataPerSat : Infinity

  // ---- Lifetime ----
  const dvAfterInsertion = p.prop.deltaV - p.orbit.insertionDv
  let lifetimeYears: number
  let lifetimeLimit: string
  if (dvAfterInsertion < 0) {
    lifetimeYears = 0
    lifetimeLimit = 'cannot brake into orbit'
  } else {
    const fuelYears = p.orbit.stationKeepingDv > 0 ? dvAfterInsertion / p.orbit.stationKeepingDv : 99
    lifetimeYears = fuelYears + p.orbit.naturalLifeYears
    lifetimeLimit = p.orbit.dest === 'moon' ? 'fuel, then crashes into the Moon'
      : p.orbit.dest === 'geo' ? 'fuel, then drifts out of position' : 'fuel, then air drag pulls it down'
  }

  const revisitPerDay = p.orbit.revisitPerSat * n
  const pointingIssues = p.instruments
    .filter((i) => p.adcs.accuracyDeg > i.pointingDeg)
    .map((i) => `${i.name} needs ${i.pointingDeg}° pointing`)

  const m: Metrics = {
    massPerSatKg, launchMassKg, rocketCapacityKg, payloadKg, costM, costBreakdown, budgetM: scenario.budgetM,
    loadW, instrumentLoadW, solarAvgW, powerMarginW, powerMarginEolW, eclipseNeedWh, batteryUsableWh,
    eclipseShortW, depthOfDischarge, dataGBPerDay, downlinkGBPerDay, downlinkMargin, storageDays,
    lifetimeYears, lifetimeLimit, revisitPerDay, slotsUsed: p.instruments.length, slots: p.bus.slots,
    pointingIssues, checks: [],
  }
  m.checks = runChecks(design, scenario, m)
  return m
}

function runChecks(design: Design, scenario: Scenario, m: Metrics): Check[] {
  const p = parts(design, scenario)
  const checks: Check[] = []
  const dest = p.orbit.dest

  // 1. Mass vs rocket
  if (m.rocketCapacityKg === 0) {
    checks.push({
      id: 'mass', label: 'Rocket can reach the orbit', status: 'fail', blocking: true,
      detail: p.rocket.onlyOrbits
        ? `${p.rocket.name} only goes to ${p.rocket.onlyOrbits.map((o) => byId(ORBITS, o).name).join(', ')}.`
        : `${p.rocket.name} cannot reach ${p.orbit.name}.`,
      fix: 'Pick a bigger rocket or a different orbit.',
    })
  } else {
    const margin = 1 - m.launchMassKg / m.rocketCapacityKg
    checks.push({
      id: 'mass', label: 'Mass fits the rocket', blocking: true,
      status: margin < 0 ? 'fail' : margin < 0.1 ? 'warn' : 'pass',
      detail: `${r1(m.launchMassKg)} kg on a rocket that lifts ${m.rocketCapacityKg} kg to this orbit (${Math.round(margin * 100)}% margin).`,
      fix: margin < 0 ? `Cut ${Math.ceil(m.launchMassKg - m.rocketCapacityKg)} kg or choose a bigger rocket.` : margin < 0.1 ? 'Engineers like at least 10% mass margin: designs always gain weight.' : undefined,
    })
  }

  // 2. Bus fit
  const slotsOk = m.slotsUsed <= m.slots
  const payloadOk = m.payloadKg <= p.bus.maxPayloadKg
  checks.push({
    id: 'bus', label: 'Instruments fit on the bus', blocking: true,
    status: slotsOk && payloadOk ? 'pass' : 'fail',
    detail: `${m.slotsUsed}/${m.slots} instrument slots, ${r1(m.payloadKg)}/${p.bus.maxPayloadKg} kg payload.`,
    fix: slotsOk && payloadOk ? undefined : 'Choose a larger bus or remove an instrument.',
  })

  // 3. Power (sunlit average and eclipse)
  const powerOk = m.powerMarginW >= 0 && m.eclipseShortW === 0
  const powerWarn = powerOk && (m.powerMarginEolW < 0 || m.depthOfDischarge > 0.4)
  checks.push({
    id: 'power', label: 'Power is positive, including in eclipse', blocking: true,
    status: !powerOk ? 'fail' : powerWarn ? 'warn' : 'pass',
    detail: m.powerMarginW < 0
      ? `Solar arrays average ${r1(m.solarAvgW)} W but the spacecraft needs ${r1(m.loadW)} W.`
      : m.eclipseShortW > 0
        ? `In the ${p.orbit.eclipseMin}-minute eclipse the battery can only supply ${r1(m.loadW - m.eclipseShortW)} W of the ${r1(m.loadW)} W needed.`
        : `${r1(m.powerMarginW)} W spare in sunlight; each eclipse uses ${Math.round(m.depthOfDischarge * 100)}% of the battery.` +
          (m.powerMarginEolW < 0 ? ` By year ${scenario.lifetimeYears} the aging arrays fall ${r1(-m.powerMarginEolW)} W short.` : ''),
    fix: m.powerMarginW < 0 ? 'Bigger solar arrays or fewer power-hungry instruments.'
      : m.eclipseShortW > 0 ? 'A bigger battery.'
      : m.powerMarginEolW < 0 ? 'Solar cells wear out in radiation. Add margin for end of life.'
      : m.depthOfDischarge > 0.4 ? 'Using more than 40% of the battery every orbit wears it out faster.' : undefined,
  })

  // 4. Downlink
  const dataPerSat = m.dataGBPerDay / design.satellites
  const downPerSat = m.downlinkGBPerDay / design.satellites
  if (dataPerSat === 0) {
    checks.push({ id: 'data', label: 'Downlink handles all the data', blocking: true, status: 'fail', detail: 'No instruments on board: there is no science to send home.', fix: 'Science Lead: add at least one instrument.' })
  } else if (downPerSat === 0) {
    checks.push({
      id: 'data', label: 'Downlink handles all the data', blocking: true, status: 'fail',
      detail: `${p.ground.name} cannot hear a spacecraft ${dest === 'moon' ? 'at the Moon' : 'in this orbit'} with a ${p.antenna.name}.`,
      fix: dest === 'moon' ? 'Use the Deep Space Network and a stronger antenna.' : 'Pick a stronger antenna or another network.',
    })
  } else {
    const margin = m.downlinkMargin
    checks.push({
      id: 'data', label: 'Downlink handles all the data', blocking: true,
      status: margin < 0 ? 'fail' : margin < 0.2 ? 'warn' : 'pass',
      detail: `Instruments make ${r1(dataPerSat)} GB/day; the link sends ${r1(downPerSat)} GB/day per spacecraft (${margin === Infinity ? '' : Math.round(margin * 100) + '% margin'}).`,
      fix: margin < 0 ? 'Faster antenna, more ground station time, or fewer data-heavy instruments.'
        : margin < 0.2 ? 'Real passes get missed and weather blocks signals. Plan 20%+ downlink margin.' : undefined,
    })
  }

  // 5. Budget
  const left = m.budgetM - m.costM
  checks.push({
    id: 'budget', label: 'Mission is under budget', blocking: true,
    status: left < 0 ? 'fail' : left < m.budgetM * 0.05 ? 'warn' : 'pass',
    detail: `${fmtM(m.costM)} of ${fmtM(m.budgetM)} (${left >= 0 ? fmtM(left) + ' reserve' : fmtM(-left) + ' over'}).`,
    fix: left < 0 ? 'Cut cost: cheaper rocket, fewer instruments, or fewer satellites.' : left < m.budgetM * 0.05 ? 'Real projects keep a reserve for surprises during operations.' : undefined,
  })

  // 6. Reaching orbit / lifetime
  if (m.lifetimeYears === 0) {
    checks.push({
      id: 'life', label: 'Spacecraft can get into its orbit', blocking: true, status: 'fail',
      detail: `Braking into ${p.orbit.name} takes ${p.orbit.insertionDv} m/s of velocity change; ${p.prop.name} gives ${p.prop.deltaV} m/s.`,
      fix: 'Engineer: add a bipropellant engine.',
    })
  } else {
    const short = m.lifetimeYears < scenario.lifetimeYears
    checks.push({
      id: 'life', label: `Lasts the planned ${scenario.lifetimeYears} years`, blocking: false,
      status: short ? 'warn' : 'pass',
      detail: short
        ? `Expected life only ${r1(m.lifetimeYears)} years (limited by ${m.lifetimeLimit}).`
        : `Expected life ${m.lifetimeYears > 30 ? '30+' : r1(m.lifetimeYears)} years.`,
      fix: short ? 'More propulsion, or a higher, more stable orbit.' : undefined,
    })
  }

  // 7. Pointing
  const adcsOk = p.adcs.worksAt.includes(dest)
  checks.push({
    id: 'pointing', label: 'Pointing is accurate enough', blocking: !adcsOk,
    status: !adcsOk ? 'fail' : m.pointingIssues.length ? 'warn' : 'pass',
    detail: !adcsOk ? `${p.adcs.name} need Earth's magnetic field, which is far too weak ${dest === 'moon' ? 'at the Moon' : 'here'}.`
      : m.pointingIssues.length ? `${p.adcs.name} point to ${p.adcs.accuracyDeg}°, but ${m.pointingIssues.join('; ')}. Its data will be blurry.`
      : `${p.adcs.name} point to ${p.adcs.accuracyDeg}°, good enough for every instrument.`,
    fix: !adcsOk || m.pointingIssues.length ? 'Upgrade to reaction wheels or star trackers.' : undefined,
  })

  // 8. Storage buffer
  if (dataPerSat > 0) {
    checks.push({
      id: 'storage', label: 'Storage can ride out a missed pass', blocking: false,
      status: m.storageDays < 1 ? 'warn' : 'pass',
      detail: `Recorder holds ${m.storageDays === Infinity ? 'unlimited' : r1(m.storageDays)} days of data.`,
      fix: m.storageDays < 1 ? 'If a ground station goes down, a small recorder overflows and data is lost.' : undefined,
    })
  }
  return checks
}

export const canLaunch = (m: Metrics) => m.checks.every((c) => !(c.blocking && c.status === 'fail'))

/** Short teammate-style hints, one per role, from the live metrics. */
export function advisors(design: Design, scenario: Scenario, m: Metrics): { role: Role; text: string; tone: 'good' | 'bad' | 'info' }[] {
  const out: { role: Role; text: string; tone: 'good' | 'bad' | 'info' }[] = []
  const p = parts(design, scenario)
  const left = m.budgetM - m.costM

  // Mission Lead
  if (left < 0) out.push({ role: 'lead', tone: 'bad', text: `We're ${fmtM(-left)} over budget. Something has to go.` })
  else if (m.rocketCapacityKg > 0 && m.launchMassKg > m.rocketCapacityKg) out.push({ role: 'lead', tone: 'bad', text: `We're ${Math.ceil(m.launchMassKg - m.rocketCapacityKg)} kg too heavy for the ${p.rocket.name.toLowerCase()}.` })
  else if (m.rocketCapacityKg === 0) out.push({ role: 'lead', tone: 'bad', text: `The ${p.rocket.name.toLowerCase()} can't take us to that orbit.` })
  else if (p.rocket.reliability < 0.95) out.push({ role: 'lead', tone: 'info', text: `The ${p.rocket.name.toLowerCase()} fails about ${Math.round((1 - p.rocket.reliability) * 100)} launches in 100. Cheap, but are we OK with that risk?` })
  else out.push({ role: 'lead', tone: 'good', text: `${fmtM(left)} in reserve, ${Math.round((1 - m.launchMassKg / m.rocketCapacityKg) * 100)}% mass margin on the rocket.` })

  // Science
  const unmet = scenario.objectives.filter((o) => o.kind === 'primary' && !o.survive && !p.instruments.some((i) => (i.objectives[o.id] ?? 0) > 0))
  if (p.instruments.length === 0) out.push({ role: 'science', tone: 'bad', text: 'We have no instruments yet. No instruments, no science!' })
  else if (unmet.length) out.push({ role: 'science', tone: 'bad', text: `Nothing on board covers "${unmet[0].name}". That's a must-have goal.` })
  else if (m.pointingIssues.length) out.push({ role: 'science', tone: 'bad', text: `${m.pointingIssues[0]}, or the data comes out blurry.` })
  else {
    const rev = scenario.objectives.find((o) => o.minRevisitPerDay)
    if (rev && m.revisitPerDay < (rev.minRevisitPerDay ?? 0)) out.push({ role: 'science', tone: 'bad', text: `We only see the target ${r1(m.revisitPerDay)}x a day. We need ${rev.minRevisitPerDay}x: different orbit or more satellites.` })
    else out.push({ role: 'science', tone: 'good', text: 'Payload covers every must-have goal. Could we fit a bonus instrument?' })
  }

  // Engineer
  if (m.powerMarginW < 0) out.push({ role: 'engineer', tone: 'bad', text: `We're ${Math.ceil(-m.powerMarginW)} W short in sunlight!` })
  else if (m.eclipseShortW > 0) out.push({ role: 'engineer', tone: 'bad', text: `We're ${Math.ceil(m.eclipseShortW)} W short in eclipse! Need a bigger battery.` })
  else if (m.lifetimeYears === 0) out.push({ role: 'engineer', tone: 'bad', text: `We can't brake into orbit: need ${p.orbit.insertionDv} m/s, have ${p.prop.deltaV}.` })
  else if (!p.adcs.worksAt.includes(p.orbit.dest)) out.push({ role: 'engineer', tone: 'bad', text: 'Magnetic torquers won\'t work out here. We need reaction wheels.' })
  else if (m.slotsUsed > m.slots || m.payloadKg > p.bus.maxPayloadKg) out.push({ role: 'engineer', tone: 'bad', text: 'The instruments don\'t fit on this bus.' })
  else if (m.lifetimeYears < scenario.lifetimeYears) out.push({ role: 'engineer', tone: 'bad', text: `We'll only last ${r1(m.lifetimeYears)} years, limited by ${m.lifetimeLimit}.` })
  else if (m.powerMarginEolW < 0) out.push({ role: 'engineer', tone: 'info', text: `Power is fine now, but aging arrays leave us ${Math.ceil(-m.powerMarginEolW)} W short by the last year.` })
  else out.push({ role: 'engineer', tone: 'good', text: `${Math.round(m.powerMarginW)} W power margin, ${r1(m.massPerSatKg)} kg per spacecraft.` })

  // Comms
  const dataPerSat = m.dataGBPerDay / design.satellites
  const downPerSat = m.downlinkGBPerDay / design.satellites
  if (dataPerSat > 0 && downPerSat === 0) out.push({ role: 'comms', tone: 'bad', text: `We can't hear the spacecraft at all with this antenna and network.` })
  else if (dataPerSat > downPerSat) out.push({ role: 'comms', tone: 'bad', text: `We make ${r1(dataPerSat)} GB/day but can only send ${r1(downPerSat)} GB/day home.` })
  else if (dataPerSat > 0 && m.downlinkMargin < 0.2) out.push({ role: 'comms', tone: 'info', text: `Downlink margin is only ${Math.round(m.downlinkMargin * 100)}%. One bad week and we lose data.` })
  else if (dataPerSat > 0 && m.storageDays < 1) out.push({ role: 'comms', tone: 'info', text: 'The recorder fills in under a day. An outage would cost us data.' })
  else if (dataPerSat > 0) out.push({ role: 'comms', tone: 'good', text: `Link sends ${r1(downPerSat)} GB/day for ${r1(dataPerSat)} GB/day of data.` })
  else out.push({ role: 'comms', tone: 'info', text: 'Waiting on the instrument list to size the downlink.' })
  return out
}

/** Human summary of what a design change did, e.g. "+12 kg, +35 W, +$28M, +4 GB/day. Power is now negative." */
export function describeChange(before: Metrics, after: Metrics): { text: string; bad: boolean } {
  const bits: string[] = []
  const d = (a: number, b: number) => b - a
  const sign = (n: number) => (n > 0 ? '+' : '−')
  const dm = d(before.launchMassKg, after.launchMassKg)
  const dp = d(before.loadW, after.loadW)
  const dc = d(before.costM, after.costM)
  const dd = d(before.dataGBPerDay, after.dataGBPerDay)
  const dl = d(before.downlinkGBPerDay, after.downlinkGBPerDay)
  const ds = d(before.solarAvgW, after.solarAvgW)
  if (Math.abs(dm) >= 0.1) bits.push(`${sign(dm)}${r1(Math.abs(dm))} kg`)
  if (Math.abs(dp) >= 0.5) bits.push(`${sign(dp)}${Math.round(Math.abs(dp))} W used`)
  if (Math.abs(ds) >= 0.5) bits.push(`${sign(ds)}${Math.round(Math.abs(ds))} W solar`)
  if (Math.abs(dc) >= 0.05) bits.push(`${sign(dc)}$${r1(Math.abs(dc))}M`)
  if (Math.abs(dd) >= 0.05) bits.push(`${sign(dd)}${r1(Math.abs(dd))} GB/day data`)
  if (Math.abs(dl) >= 0.05) bits.push(`${sign(dl)}${r1(Math.abs(dl))} GB/day downlink`)

  // Name checks that flipped.
  const flips: string[] = []
  let bad = false
  const SHORT: Record<string, string> = { mass: 'Mass', bus: 'Bus fit', power: 'Power', data: 'Downlink', budget: 'Budget', life: 'Lifetime', pointing: 'Pointing', storage: 'Storage' }
  for (const c of after.checks) {
    const prev = before.checks.find((x) => x.id === c.id)
    if (!prev || prev.status === c.status) continue
    if (c.status === 'fail') { flips.push(`⚠ ${SHORT[c.id] ?? c.label} check now failing`); bad = true }
    else if (prev.status === 'fail') flips.push(`✓ ${SHORT[c.id] ?? c.label} check fixed`)
  }
  const text = (bits.length ? bits.join(', ') + '.' : 'No change to the numbers.') + (flips.length ? ' ' + flips.join('. ') + '.' : '')
  return { text, bad }
}
