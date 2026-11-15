// Flight-plan mini-game: two short physics problems built from the team's own
// design. How well they answer changes the mission (fuel, lifetime, health,
// image sharpness) and earns "Flight math" points.
import { ORBITS, PROPULSION, byId } from './catalog.ts'
import { computeMetrics } from './calc.ts'
import type { Design, Scenario, SimState } from './types.ts'

export const G = 9.8

/** Simplified rocket physics per launcher (illustrative, rounded). */
const ROCKET_PHYS: Record<string, { name: string; thrustKN: number; massT: number; upperAccel: number }> = {
  rideshare: { name: 'Big rideshare rocket', thrustKN: 7600, massT: 549, upperAccel: 14 },
  small: { name: 'Small launcher', thrustKN: 224, massT: 13, upperAccel: 18 },
  medium: { name: 'Medium launcher', thrustKN: 7600, massT: 549, upperAccel: 14 },
  heavy: { name: 'Heavy launcher', thrustKN: 22800, massT: 1420, upperAccel: 11 },
}

/** Speed the spacecraft must reach (m/s), and the speed it already has before the burn. */
const ASCENT: Record<string, { v0: number; target: number; from: string; to: string }> = {
  'leo-400': { v0: 5000, target: 7670, from: 'after the first stage', to: 'circle Earth at 400 km' },
  'sso-600': { v0: 5000, target: 7560, from: 'after the first stage', to: 'circle Earth at 600 km' },
  geo: { v0: 7800, target: 10250, from: 'in a low parking orbit', to: 'start the long climb to geostationary orbit' },
}

/** Thrust of the spacecraft's own engine, used for the lunar braking burn (newtons). */
const ENGINE_THRUST_N: Record<string, number> = { 'prop-biprop': 440, 'prop-mono': 90, 'prop-cold': 10 }

export interface CalcChallenge {
  twr: { rocket: string; thrustKN: number; rocketT: number; craftT: number; answer: number }
  burn:
    | { kind: 'ascent'; v0: number; target: number; from: string; to: string; dv: number; accel: number; answer: number }
    | { kind: 'capture'; dv: number; thrustN: number; massKg: number; accel: number; answer: number }
}

export type Grade = 'bullseye' | 'good' | 'off' | 'wayoff' | 'autopilot'

export interface CalcResult {
  twrAnswer: number | null
  twrOk: boolean
  burnAnswer: number | null
  ratio: number
  grade: Grade
  points: number
  by: string
  verdict: string
  effect: string
}

export interface FlightCalc { challenge: CalcChallenge; result: CalcResult | null }

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

export function buildChallenge(design: Design, sc: Scenario): CalcChallenge {
  const m = computeMetrics(design, sc)
  const rp = ROCKET_PHYS[design.rocketId] ?? ROCKET_PHYS.medium
  const craftT = round(m.launchMassKg / 1000, 3)
  const twr = { rocket: rp.name, thrustKN: rp.thrustKN, rocketT: rp.massT, craftT, answer: round(rp.thrustKN / ((rp.massT + craftT) * G), 2) }
  const orbit = byId(ORBITS, design.orbitId)
  if (orbit.dest === 'moon') {
    const thrustN = ENGINE_THRUST_N[design.propulsionId] ?? 440
    const massKg = Math.round(m.massPerSatKg)
    const accel = round(thrustN / massKg, 3)
    return { twr, burn: { kind: 'capture', dv: orbit.insertionDv, thrustN, massKg, accel, answer: round(orbit.insertionDv / accel, 0) } }
  }
  const a = ASCENT[orbit.id] ?? ASCENT['sso-600']
  const dv = a.target - a.v0
  return { twr, burn: { kind: 'ascent', ...a, dv, accel: rp.upperAccel, answer: round(dv / rp.upperAccel, 0) } }
}

// ---------- safe arithmetic: numbers, + - * / ^ ( ), commas ignored ----------
export function evalExpr(input: string): number | null {
  const src = input.replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/').trim()
  if (!src || src.length > 80) return null
  let i = 0
  const peek = () => src[i]
  const skip = () => { while (src[i] === ' ') i++ }
  const num = (): number => {
    skip()
    if (peek() === '(') { i++; const v = expr(); skip(); if (src[i] !== ')') throw new Error('paren'); i++; return v }
    if (peek() === '-') { i++; return -num() }
    const m = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i))
    if (!m) throw new Error('num')
    i += m[0].length
    return parseFloat(m[0])
  }
  const pow = (): number => { const b = num(); skip(); if (peek() === '^') { i++; return Math.pow(b, pow()) } return b }
  const term = (): number => {
    let v = pow()
    for (;;) { skip(); const c = peek(); if (c === '*') { i++; v *= pow() } else if (c === '/') { i++; v /= pow() } else return v }
  }
  const expr = (): number => {
    let v = term()
    for (;;) { skip(); const c = peek(); if (c === '+') { i++; v += term() } else if (c === '-') { i++; v -= term() } else return v }
  }
  try {
    const v = expr()
    skip()
    return i === src.length && Number.isFinite(v) ? v : null
  } catch { return null }
}

export function gradeCalc(ch: CalcChallenge, twrAnswer: number | null, burnAnswer: number | null, autopilot: boolean, by: string): CalcResult {
  const twrOk = twrAnswer !== null && Math.abs(twrAnswer - ch.twr.answer) <= Math.max(0.05, ch.twr.answer * 0.04)
  if (autopilot || burnAnswer === null || burnAnswer <= 0) {
    return {
      twrAnswer, twrOk, burnAnswer: null, ratio: 1, grade: 'autopilot', points: twrOk && !autopilot ? 20 : 0, by,
      verdict: 'The autopilot flew the burn. Close, but it needed a small correction.',
      effect: ch.burn.kind === 'capture' ? 'Correction burn: −15 m/s of fuel.' : 'Correction burn: a little fuel used.',
    }
  }
  const ratio = burnAnswer / ch.burn.answer
  const err = Math.abs(ratio - 1)
  const grade: Grade = err <= 0.03 ? 'bullseye' : err <= 0.1 ? 'good' : err <= 0.25 ? 'off' : 'wayoff'
  const under = ratio < 1
  const pct = Math.round(err * 100)
  const capture = ch.burn.kind === 'capture'
  const verdict = {
    bullseye: capture ? 'Bullseye! The Moon captured the spacecraft into exactly the planned orbit.' : 'Bullseye! The spacecraft slid into a perfect circular orbit.',
    good: `Within ${pct}% of the perfect burn. A small correction fixes the orbit.`,
    off: under ? `The burn was ${pct}% too short: the orbit came out too low.` : `The burn was ${pct}% too long: the orbit came out too high.`,
    wayoff: under ? `The burn was ${pct}% too short! The orbit dips dangerously low.` : `The burn was ${pct}% too long! The orbit overshot badly.`,
  }[grade]
  const effect = describeEffect(grade, under, capture)
  const points = (twrOk ? 20 : 0) + { bullseye: 60, good: 40, off: 15, wayoff: 0 }[grade]
  return { twrAnswer, twrOk, burnAnswer, ratio, grade, points, by, verdict, effect }
}

function describeEffect(grade: Grade, under: boolean, capture: boolean) {
  if (grade === 'bullseye') return capture ? 'Fuel saved: +20 m/s for later.' : 'No correction needed: fuel saved.'
  if (grade === 'good') return capture ? 'Correction burn: −15 m/s of fuel.' : 'Correction burn: a little fuel used.'
  if (capture) return grade === 'off' ? 'Correction burn: −80 m/s of fuel.' : 'Emergency correction: −180 m/s of fuel and some hardware stress.'
  if (under) return grade === 'off' ? 'Lower orbit: more drag. Thrusters must burn fuel to fix it, or the spacecraft comes down early.' : 'Very low orbit: heavy drag and stress on the spacecraft. Without thrusters, it comes down long before the mission ends.'
  return grade === 'off' ? 'Higher orbit: fixing it costs fuel, or images are a bit blurrier.' : 'Much higher orbit: fixing it costs lots of fuel, or images are much blurrier.'
}

/** Apply the flight-plan outcome to a fresh simulation. Returns a log line. */
export function applyCalc(sim: SimState, res: CalcResult, design: Design, sc: Scenario): string {
  const orbit = byId(ORBITS, design.orbitId)
  const prop = byId(PROPULSION, design.propulsionId)
  const hasFuel = sim.fuelDv > 0
  const capture = orbit.dest === 'moon'
  const under = res.ratio < 1
  const useFuel = (dv: number) => { sim.fuelDv = Math.max(0, sim.fuelDv - dv) }
  switch (res.grade) {
    case 'bullseye':
      if (hasFuel || capture) sim.fuelDv += capture ? 20 : 10
      return 'Perfect insertion: no correction burn needed.'
    case 'good':
    case 'autopilot':
      if (hasFuel) useFuel(capture ? 15 : 8)
      return res.grade === 'autopilot' ? 'Autopilot burn complete. Small correction made.' : 'Good burn. Small correction made.'
    case 'off':
    case 'wayoff': {
      const big = res.grade === 'wayoff'
      if (capture) {
        useFuel(big ? 180 : 80)
        if (big) sim.health -= 15
        return big ? 'Emergency correction after a bad braking burn.' : 'Correction burn after an imprecise braking burn.'
      }
      if (prop.deltaV > 0 && hasFuel) {
        useFuel(big ? 100 : 40)
        if (under && big) sim.health -= 15
        return under ? 'Thrusters raised the low orbit, using extra fuel.' : 'Thrusters lowered the high orbit, using extra fuel.'
      }
      if (under) {
        sim.endDayCap = Math.min(sim.endDayCap, Math.round(sim.plannedDays * (big ? 0.6 : 0.85)))
        if (big) sim.health -= 15
        return 'No thrusters to fix the low orbit: drag will bring the spacecraft down early.'
      }
      for (const st of Object.values(sim.instrumentState)) st.quality *= big ? 0.8 : 0.92
      void sc
      return 'No thrusters to fix the high orbit: images are blurrier from up here.'
    }
  }
}
