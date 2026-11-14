// Operations simulation: one step per mission day. Power, battery wear, data
// flow, fuel and random events all play out here.
import { RULES } from './catalog.ts'
import { computeMetrics, downlinkPerDay, parts } from './calc.ts'
import { hashRand } from './rng.ts'
import type { Design, PendingEvent, Scenario, SimState } from './types.ts'

export function initSim(design: Design, scenario: Scenario, seed: number): SimState {
  const p = parts(design, scenario)
  const plannedDays = Math.round(scenario.lifetimeYears * 365)
  const instrumentState: SimState['instrumentState'] = {}
  for (const i of p.instruments) instrumentState[i.id] = { on: true, quality: 1, activeDays: 0, generatedGB: 0 }

  // Pick up to 4 events in a seeded order, spread across the mission.
  const pool = scenario.events
    .filter((e) => e !== 'instrument-glitch' || p.instruments.length > 0)
    .map((e) => ({ e, r: hashRand(seed, 'event-order', e) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, 4)
    .map((x) => x.e)
  const slots = [0.1, 0.33, 0.56, 0.78]
  const eventSchedule = pool.map((templateId, k) => {
    const day = Math.round(plannedDays * (slots[k] + hashRand(seed, 'event-day', k) * 0.12))
    const instrumentId = templateId === 'instrument-glitch'
      ? p.instruments[Math.floor(hashRand(seed, 'glitch-inst') * p.instruments.length)].id
      : undefined
    return { day, templateId, instrumentId }
  })

  return {
    day: 0, plannedDays, ended: false, endReason: '',
    generatedGB: 0, downlinkedGB: 0, lostGB: 0, lostStorageGB: 0, lostDownlinkGB: 0, bufferGB: 0,
    batteryHealth: 1, solarHealth: 1, health: 100,
    fuelDv: Math.max(0, p.prop.deltaV - p.orbit.insertionDv),
    extraCostM: 0, instrumentState, powerShortDays: 0, eclipseShortDays: 0,
    outageDaysLeft: 0, outageFactor: 1, contactFactor: 1, safeModeDaysLeft: 0,
    endDayCap: 1e9, history: [{ day: 0, generated: 0, downlinked: 0, lost: 0, battery: 100, health: 100, powerOk: 1 }],
    log: [{ day: 0, text: 'Spacecraft deployed. Systems check: all green.', tone: 'good' }],
    eventSchedule, decisions: [],
  }
}

/** Advance one day. Returns a pending event if one fires today. */
export function stepDay(sim: SimState, design: Design, scenario: Scenario, seed: number): PendingEvent | null {
  if (sim.ended) return null
  const p = parts(design, scenario)
  const m = computeMetrics(design, scenario)
  const n = design.satellites
  sim.day += 1
  const day = sim.day

  // Aging: solar cells degrade with radiation; batteries wear faster when drained deeply.
  sim.solarHealth = Math.pow(1 - p.orbit.solarDegradation, day / 365)
  const onInst = p.instruments.filter((i) => sim.instrumentState[i.id]?.on)
  const instLoad = onInst.reduce((s, i) => s + i.powerW, 0)
  const busLoad = m.loadW - m.instrumentLoadW
  const eclipseHr = p.orbit.eclipseMin / 60
  const solar = m.solarAvgW * sim.solarHealth
  const batteryWh = p.battery.capacityWh * sim.batteryHealth
  const dod = ((busLoad + instLoad) * eclipseHr) / batteryWh
  sim.batteryHealth = Math.max(0.05, sim.batteryHealth - (0.02 + 0.8 * Math.max(0, dod - 0.4)) / 365)

  // Power: throttle instruments when the arrays or the battery can't keep up.
  let duty = 1
  let powerShort = false
  let eclipseShort = false
  if (instLoad > 0) {
    const sunDuty = (solar - busLoad) / instLoad
    const eclipseDuty = ((batteryWh * 0.8) / eclipseHr - busLoad) / instLoad
    if (sunDuty < 1) powerShort = true
    if (eclipseDuty < 1 && eclipseDuty < sunDuty) eclipseShort = true
    duty = Math.max(0, Math.min(1, sunDuty, eclipseDuty))
  }
  if (busLoad > solar || busLoad * eclipseHr > batteryWh * 0.8) {
    sim.health -= 0.6 // brownouts: the spacecraft itself can't stay powered
    eclipseShort = true
  }
  if (powerShort) sim.powerShortDays++
  if (eclipseShort) sim.eclipseShortDays++
  if (sim.safeModeDaysLeft > 0) { duty = 0; sim.safeModeDaysLeft-- }

  // Data: generate, downlink what the link allows, store the rest, lose overflow.
  let generated = 0
  for (const i of onInst) {
    const g = i.dataGBPerDay * duty * n
    const st = sim.instrumentState[i.id]
    st.generatedGB += g
    st.activeDays += duty
    generated += g
  }
  const outage = sim.outageDaysLeft > 0
  const variation = RULES.realWorldDownlink + (hashRand(seed, 'link', day) - 0.5) * 0.24
  const capacity = downlinkPerDay(design, scenario) * n * variation * sim.contactFactor * (outage ? sim.outageFactor : 1)
  if (outage) sim.outageDaysLeft--
  sim.bufferGB += generated
  const down = Math.min(sim.bufferGB, capacity)
  sim.bufferGB -= down
  const storageCap = p.storage.capacityGB * n
  if (sim.bufferGB > storageCap) {
    const lost = sim.bufferGB - storageCap
    sim.bufferGB = storageCap
    sim.lostGB += lost
    if (outage) sim.lostStorageGB += lost
    else sim.lostDownlinkGB += lost
    const tag = outage ? 'Recorder overflowing during the outage' : 'Recorder full'
    if (!sim.log.some((l) => l.text.startsWith(tag))) {
      sim.log.push({ day, text: outage ? `${tag}: data is being lost until contact returns.` : `${tag}: the link can't keep up, so new data overwrites old data.`, tone: 'bad' })
    }
  }
  sim.generatedGB += generated
  sim.downlinkedGB += down

  // Fuel: station-keeping each day; when it runs out, drag or gravity takes over.
  if (p.orbit.stationKeepingDv > 0 && sim.endDayCap >= 1e9) {
    sim.fuelDv -= p.orbit.stationKeepingDv / 365
    if (sim.fuelDv <= 0) {
      sim.fuelDv = 0
      sim.endDayCap = day + Math.round(p.orbit.naturalLifeYears * 365)
      const matters = sim.endDayCap < sim.plannedDays
      const had = p.prop.deltaV > 0
      sim.log.push(matters
        ? { day, text: `${had ? 'Out of fuel' : 'No propulsion'}: ${p.orbit.dest === 'moon' ? 'the orbit will slowly decay toward the surface' : p.orbit.dest === 'geo' ? 'we will drift out of our slot' : 'air drag will pull us down'} in about ${Math.round((sim.endDayCap - day) / 30)} months.`, tone: 'bad' }
        : { day, text: `${had ? 'Station-keeping fuel used up' : 'No propulsion'}, but this orbit stays up for ~${Math.round(p.orbit.naturalLifeYears)} years on its own.`, tone: 'info' })
    }
  }

  // Milestones
  if (powerShort && sim.powerShortDays === 1) sim.log.push({ day, text: 'Power shortfall: instruments throttled to keep the spacecraft alive.', tone: 'bad' })
  if (eclipseShort && sim.eclipseShortDays === 1) sim.log.push({ day, text: 'Battery can\'t cover the eclipse: instruments cut during shadow passes.', tone: 'bad' })
  if (day === Math.round(sim.plannedDays / 2)) sim.log.push({ day, text: 'Halfway through the mission.', tone: 'info' })

  // End conditions
  if (sim.health <= 0) { sim.health = 0; end(sim, 'Spacecraft lost: power or hardware failure.') }
  else if (day >= sim.endDayCap) {
    end(sim, p.orbit.dest === 'moon' ? 'Orbit decayed: the spacecraft impacted the Moon.'
      : p.orbit.dest === 'geo' ? 'Drifted out of its geostationary slot and was retired.'
      : 'Air drag pulled the spacecraft down: it burned up on reentry.')
  } else if (day >= sim.plannedDays) end(sim, 'Planned mission complete.')

  if (day % 5 === 0 || sim.ended) {
    sim.history.push({
      day, generated: sim.generatedGB, downlinked: sim.downlinkedGB, lost: sim.lostGB,
      battery: Math.round(Math.max(0, 100 - Math.min(1, dod) * 100)),
      health: Math.round(sim.health), powerOk: duty,
    })
  }

  if (sim.ended) return null
  const ev = sim.eventSchedule.find((e) => e.day === day)
  return ev ? buildEvent(ev.templateId, sim, design, scenario, ev.instrumentId) : null
}

function end(sim: SimState, reason: string) {
  sim.ended = true
  sim.endReason = reason
  // Data still sitting on the recorder never made it home.
  if (sim.bufferGB > 0) { sim.lostGB += sim.bufferGB; sim.lostDownlinkGB += sim.bufferGB; sim.bufferGB = 0 }
  sim.log.push({ day: sim.day, text: reason, tone: reason.startsWith('Planned') ? 'good' : 'bad' })
}

// ---------------- Random events ----------------

export function buildEvent(templateId: string, sim: SimState, design: Design, scenario: Scenario, instrumentId?: string): PendingEvent | null {
  const p = parts(design, scenario)
  const m = computeMetrics(design, scenario)
  const base = { id: `${templateId}-${sim.day}`, templateId, day: sim.day, disabled: {} as Record<string, string>, instrumentId }
  switch (templateId) {
    case 'solar-storm':
      return {
        ...base, title: 'Solar storm incoming',
        body: 'The Sun just blasted out a cloud of charged particles. It reaches us in 6 hours. Radiation can scramble electronics.',
        options: [
          { id: 'safe', label: 'Enter safe mode for 4 days', detail: 'Turn off instruments, point arrays at the Sun, wait it out. Lose 4 days of science.' },
          { id: 'risk', label: 'Keep observing', detail: `No lost days, but a real chance of damage.${design.redundancy ? ' Our backup computer softens the blow.' : ''}` },
        ],
      }
    case 'instrument-glitch': {
      const inst = p.instruments.find((i) => i.id === instrumentId)
      if (!inst || !sim.instrumentState[inst.id]?.on) return null
      return {
        ...base, title: `Instrument fault: ${inst.name}`,
        body: `The ${inst.name.toLowerCase()} is reporting errors and running hot. The team needs a call.`,
        options: [
          { id: 'off', label: 'Switch it off for good', detail: 'Protects the rest of the spacecraft. We lose this instrument\'s science from now on.' },
          { id: 'patch', label: 'Upload a software patch ($3M)', detail: `Engineers think it has a ${design.redundancy ? 85 : 65}% chance to work. If not, the instrument is lost.` },
          { id: 'degraded', label: 'Keep it running at reduced quality', detail: 'Its data will be 40% less useful for the rest of the mission.' },
        ],
      }
    }
    case 'budget-cut': {
      const reserve = scenario.budgetM - m.costM - sim.extraCostM
      const disabled: Record<string, string> = {}
      if (reserve < 6) disabled.reserve = `Only $${Math.max(0, Math.round(reserve * 10) / 10)}M left in reserve`
      return {
        ...base, disabled, title: 'Budget cut',
        body: 'The agency cut $6M from operations. Something has to give.',
        options: [
          { id: 'reserve', label: 'Cover it from our reserve', detail: 'Uses unspent budget. No impact on the mission.' },
          { id: 'contact', label: 'Halve ground station time', detail: 'Saves the money, but downlink drops 50% for the rest of the mission.' },
          { id: 'early', label: 'End the mission 6 months early', detail: 'Saves the money, but we lose the last 6 months of science and miss the full-lifetime goal.' },
        ],
      }
    }
    case 'station-outage':
      return {
        ...base, title: 'Ground station outage',
        body: 'A storm knocked out our main ground station. Repairs take 14 days.',
        options: [
          { id: 'rent', label: 'Rent backup antennas ($1.5M)', detail: 'Keeps 80% of our downlink during the outage.' },
          { id: 'wait', label: 'Wait it out and store data onboard', detail: `Our recorder holds ${p.storage.capacityGB} GB per spacecraft. Anything beyond that is lost.` },
        ],
      }
    case 'debris': {
      const disabled: Record<string, string> = {}
      if (sim.fuelDv < 2) disabled.dodge = 'No propulsion (or fuel) to maneuver'
      return {
        ...base, disabled, title: 'Space debris alert',
        body: 'A piece of an old rocket will pass within 200 m. Collision odds are about 1 in 8.',
        options: [
          { id: 'dodge', label: 'Dodge it (uses a little fuel)', detail: 'A small thruster burn moves us out of the way.' },
          { id: 'hope', label: 'Hold course and hope it misses', detail: 'Costs nothing, unless it hits.' },
        ],
      }
    }
    case 'lunar-eclipse':
      return {
        ...base, title: 'Lunar eclipse ahead',
        body: 'Earth will block the Sun for 3 hours, far longer than our normal 48-minute shadow passes. Can the battery cope?',
        options: [
          { id: 'powerdown', label: 'Power down to essentials', detail: 'Instruments off for a day so the battery only runs the core systems.' },
          { id: 'run', label: 'Keep everything running', detail: `Needs about ${Math.round(m.loadW * 3)} Wh. Our battery has ${Math.round(p.battery.capacityWh * sim.batteryHealth)} Wh.` },
        ],
      }
    case 'dsn-conflict':
      return {
        ...base, title: 'Deep Space Network is busy',
        body: 'A Mars landing needs the big dishes. We lose 60% of our contact time for 3 weeks.',
        options: [
          { id: 'pay', label: 'Pay for priority time ($2M)', detail: 'Keep 90% of our contact time.' },
          { id: 'accept', label: 'Accept less time', detail: 'Data piles up on the recorder until the dishes free up.' },
        ],
      }
  }
  return null
}

/** Apply a decision. Returns narration and a 0..1 "how sensible was this call" rating. */
export function resolveEvent(ev: PendingEvent, optionId: string, sim: SimState, design: Design, scenario: Scenario, seed: number): { text: string; tone: 'good' | 'bad' | 'info'; quality: number } {
  const p = parts(design, scenario)
  const m = computeMetrics(design, scenario)
  const roll = hashRand(seed, 'resolve', ev.id, optionId)
  const red = design.redundancy
  let out: { text: string; tone: 'good' | 'bad' | 'info'; quality: number }
  switch (ev.templateId) {
    case 'solar-storm':
      if (optionId === 'safe') { sim.safeModeDaysLeft = 4; out = { text: 'Safe mode held. The storm passed without damage; 4 days of science paused.', tone: 'good', quality: 1 } }
      else if (roll < 0.55) {
        const dmg = red ? 12 : 30
        sim.health -= dmg
        sim.solarHealth *= 0.97
        out = { text: `The storm hit hard: electronics damaged (health −${dmg}%)${red ? '. The backup computer took over.' : '.'}`, tone: 'bad', quality: 0.2 }
      } else out = { text: 'We got lucky: the storm passed with no damage.', tone: 'info', quality: 0.5 }
      break
    case 'instrument-glitch': {
      const st = sim.instrumentState[ev.instrumentId!]
      const name = p.instruments.find((i) => i.id === ev.instrumentId)?.name ?? 'Instrument'
      if (optionId === 'off') { st.on = false; out = { text: `${name} switched off permanently.`, tone: 'bad', quality: 0.5 } }
      else if (optionId === 'patch') {
        sim.extraCostM += 3
        if (roll < (red ? 0.85 : 0.65)) out = { text: `Patch worked! ${name} is back to normal.`, tone: 'good', quality: 0.9 }
        else { st.on = false; out = { text: `The patch failed and ${name} shut down for good.`, tone: 'bad', quality: 0.6 } }
      } else { st.quality *= 0.6; out = { text: `${name} keeps running, with noisier data.`, tone: 'info', quality: 0.7 } }
      break
    }
    case 'budget-cut':
      if (optionId === 'reserve') { sim.extraCostM += 6; out = { text: 'Covered the cut from reserve. Good thing we kept some.', tone: 'good', quality: 1 } }
      else if (optionId === 'contact') {
        sim.contactFactor = 0.5
        const short = m.downlinkGBPerDay * 0.5 * RULES.realWorldDownlink < m.dataGBPerDay
        out = { text: `Ground time halved.${short ? ' Our link can no longer keep up with the data.' : ' Our downlink margin absorbs it.'}`, tone: short ? 'bad' : 'info', quality: short ? 0.3 : 0.9 }
      } else { sim.endDayCap = Math.min(sim.endDayCap, sim.plannedDays - 182); out = { text: 'Mission end moved 6 months earlier.', tone: 'bad', quality: 0.4 } }
      break
    case 'station-outage':
      sim.outageDaysLeft = 14
      if (optionId === 'rent') { sim.outageFactor = 0.8; sim.extraCostM += 1.5; out = { text: 'Backup antennas booked. Data keeps flowing.', tone: 'good', quality: 1 } }
      else {
        sim.outageFactor = 0
        const fits = (m.dataGBPerDay / design.satellites) * 14 <= p.storage.capacityGB
        out = { text: fits ? 'Waiting it out. The recorder is big enough to hold two weeks of data.' : 'Waiting it out. The recorder will fill up before the station is back.', tone: fits ? 'info' : 'bad', quality: fits ? 0.9 : 0.4 }
      }
      break
    case 'debris':
      if (optionId === 'dodge') { sim.fuelDv = Math.max(0, sim.fuelDv - 2); out = { text: 'Burn complete. The debris passed 3 km away.', tone: 'good', quality: 1 } }
      else if (roll < 0.125) { sim.health -= 60; out = { text: 'Impact! A fragment punched through a solar panel (health −60%).', tone: 'bad', quality: 0.2 } }
      else out = { text: 'The debris missed. Phew.', tone: 'info', quality: ev.disabled.dodge ? 0.6 : 0.4 }
      break
    case 'lunar-eclipse': {
      const battWh = p.battery.capacityWh * sim.batteryHealth * 0.9
      const busLoad = m.loadW - m.instrumentLoadW
      if (optionId === 'powerdown') {
        sim.safeModeDaysLeft = Math.max(sim.safeModeDaysLeft, 1)
        if (busLoad * 3 > battWh) { sim.health -= 20; out = { text: 'Even the core systems drained the battery. Some hardware got too cold (health −20%).', tone: 'bad', quality: 0.8 } }
        else out = { text: 'Powered down and rode out the eclipse safely.', tone: 'good', quality: 1 }
      } else if (m.loadW * 3 > battWh) {
        sim.health -= 45; sim.batteryHealth *= 0.85
        out = { text: 'The battery ran flat in the dark. Brownout damaged the spacecraft (health −45%).', tone: 'bad', quality: 0.1 }
      } else out = { text: 'Our big battery carried everything through the eclipse.', tone: 'good', quality: 0.9 }
      break
    }
    case 'dsn-conflict':
      sim.outageDaysLeft = 21
      if (optionId === 'pay') { sim.outageFactor = 0.9; sim.extraCostM += 2; out = { text: 'Priority time booked on the big dishes.', tone: 'good', quality: 1 } }
      else { sim.outageFactor = 0.4; out = { text: 'Contact cut for 3 weeks. Data is piling up on the recorder.', tone: 'info', quality: 0.7 } }
      break
    default:
      out = { text: 'Noted.', tone: 'info', quality: 0.5 }
  }
  if (sim.health <= 0) { sim.health = 0; end(sim, 'Spacecraft lost after the ' + ev.title.toLowerCase() + '.') }
  sim.decisions.push({ templateId: ev.templateId, optionId, quality: out.quality })
  sim.log.push({ day: sim.day, text: out.text, tone: out.tone })
  return out
}
