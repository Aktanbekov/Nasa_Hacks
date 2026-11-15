// Game state machine. The same reducer runs on the server (team rooms) and in
// the browser (solo), so both modes behave identically.
import { ROCKETS, RULES, byId } from './catalog.ts'
import { canLaunch, computeMetrics, describeChange } from './calc.ts'
import { hashRand, newSeed } from './rng.ts'
import { scenarioOf } from './scenarios.ts'
import { buildReport } from './score.ts'
import { applyCalc, buildChallenge, gradeCalc } from './flightcalc.ts'
import { initSim, resolveEvent, stepDay } from './sim.ts'
import type { Design, Difficulty, FeedItem, GameState, Role, Scenario } from './types.ts'
import { ROLES } from './types.ts'

export const ROLE_NAMES: Record<Role, string> = {
  lead: 'Mission Lead', science: 'Science Lead', engineer: 'Spacecraft Engineer', comms: 'Comms & Ops',
}
export const ROLE_SHORT: Record<Role, string> = { lead: 'Lead', science: 'Science', engineer: 'Engineer', comms: 'Comms' }

/** Which role owns which design field. */
export const FIELD_OWNER: Record<Exclude<keyof Design, 'growth'>, Role> = {
  orbitId: 'lead', rocketId: 'lead', satellites: 'lead',
  instruments: 'science',
  busId: 'engineer', solarId: 'engineer', batteryId: 'engineer', adcsId: 'engineer', propulsionId: 'engineer', redundancy: 'engineer',
  antennaId: 'comms', groundId: 'comms', storageId: 'comms',
}

export const LAUNCH_ANIMATION_MS = 7000
export const TICK_MS = 150
/** Real seconds the operations phase should take at 1x speed. */
const OPS_SECONDS = 180

export type Action =
  | { type: 'join'; playerId: string; name: string }
  | { type: 'disconnect'; playerId: string }
  | { type: 'claimRole'; playerId: string; role: Role }
  | { type: 'chooseScenario'; playerId: string; scenarioId: string }
  | { type: 'setRelaxed'; relaxed: boolean }
  | { type: 'setDifficulty'; difficulty: Difficulty }
  | { type: 'startDesign'; playerId: string }
  | { type: 'ready'; playerId: string; value: boolean }
  | { type: 'setDesign'; playerId: string; patch: Partial<Design> }
  | { type: 'toggleInstrument'; playerId: string; instrumentId: string }
  | { type: 'chat'; playerId: string; text: string }
  | { type: 'goReview'; playerId: string }
  | { type: 'backToDesign'; playerId: string }
  | { type: 'approve'; playerId: string; value: boolean }
  | { type: 'launch'; playerId: string }
  | { type: 'submitCalc'; playerId: string; twr: number | null; burn: number | null; autopilot: boolean }
  | { type: 'beginLaunch'; playerId: string }
  | { type: 'vote'; playerId: string; optionId: string }
  | { type: 'decide'; playerId: string; optionId: string }
  | { type: 'setSpeed'; speed: number }
  | { type: 'setPaused'; paused: boolean }
  | { type: 'redesign'; playerId: string }
  | { type: 'newMission'; playerId: string }

export function createGame(code: string, mode: 'solo' | 'team', now: number): GameState {
  return {
    code, mode, phase: 'lobby', scenarioId: null, relaxed: false, difficulty: 'cadet', players: {}, hostId: '',
    design: null, designStartedAt: 0, overtimeM: 0, opsAcc: 0, feed: [], feedSeq: 0, approvals: {}, ready: {}, calc: null, reviewAttempts: 0,
    launch: null, sim: null, pendingEvent: null, votes: {}, speed: 1, paused: false, report: null,
    seed: newSeed(), flight: 1, rev: 0, now,
  }
}

const playerName = (s: GameState, id: string) => s.players[id]?.name ?? 'Someone'
const isLead = (s: GameState, id: string) => s.mode === 'solo' || !!s.players[id]?.roles.includes('lead')
export const ownsRole = (s: GameState, id: string, role: Role) => s.mode === 'solo' || !!s.players[id]?.roles.includes(role)

function push(s: GameState, item: Omit<FeedItem, 'id' | 't'>) {
  s.feedSeq += 1
  s.feed.push({ ...item, id: s.feedSeq, t: s.sim?.day ?? -1 })
  if (s.feed.length > 120) s.feed.splice(0, s.feed.length - 120)
}

export const activePlayers = (s: GameState) => Object.values(s.players).filter((p) => p.connected)
export const uncoveredRoles = (s: GameState) => ROLES.filter((r) => !activePlayers(s).some((p) => p.roles.includes(r)))

/** Minutes over the design timer, priced as "standing army" cost. */
export function overtimeCost(s: GameState, now: number) {
  if (s.relaxed || !s.scenarioId || !s.designStartedAt) return 0
  const sc = scenarioOf(s)
  const over = (now - s.designStartedAt) / 60000 - sc.designMinutes
  return over > 0 ? Math.ceil(over) * RULES.overtimeCostPerMin : 0
}

function startDesign(s: GameState, now: number) {
  const sc = scenarioOf(s)
  if (!s.design) s.design = structuredClone(sc.starter)
  s.phase = 'design'
  s.designStartedAt = now
  s.approvals = {}
  push(s, { role: 'system', text: `Design phase open: ${sc.name}. ${s.relaxed ? 'No timer.' : `You have ${sc.designMinutes} minutes before every extra minute costs $${RULES.overtimeCostPerMin}M.`}`, tone: 'info' })
}

export function reduce(s: GameState, a: Action, now: number): GameState {
  s.now = now
  if (!s.ready) s.ready = {} // rooms saved before the briefing phase existed
  if (s.calc === undefined) s.calc = null
  if (!s.difficulty) s.difficulty = 'cadet'
  switch (a.type) {
    case 'join': {
      const existing = s.players[a.playerId]
      if (existing) { existing.connected = true; existing.name = a.name || existing.name }
      else {
        s.players[a.playerId] = { id: a.playerId, name: a.name || 'Player', roles: s.mode === 'solo' ? [...ROLES] : [], connected: true, edits: 0 }
        if (!s.hostId) s.hostId = a.playerId
        if (s.mode === 'team') push(s, { role: 'system', text: `${a.name} joined the team.`, tone: 'info' })
      }
      break
    }
    case 'disconnect': {
      const p = s.players[a.playerId]
      if (p) p.connected = false
      break
    }
    case 'claimRole': {
      if (s.mode === 'solo') break
      const p = s.players[a.playerId]
      if (!p) break
      if (p.roles.includes(a.role)) p.roles = p.roles.filter((r) => r !== a.role)
      else {
        for (const other of Object.values(s.players)) if (other.connected) other.roles = other.roles.filter((r) => r !== a.role)
        p.roles.push(a.role)
        if (s.phase !== 'lobby') push(s, { role: 'system', text: `${p.name} is now ${ROLE_NAMES[a.role]}.`, tone: 'info' })
      }
      break
    }
    case 'chooseScenario':
      if (s.phase !== 'lobby' && s.phase !== 'report') break
      s.scenarioId = a.scenarioId
      s.design = null
      break
    case 'setRelaxed':
      s.relaxed = a.relaxed
      break
    case 'setDifficulty':
      if (s.phase !== 'lobby' || !['cadet', 'engineer', 'director'].includes(a.difficulty)) break
      s.difficulty = a.difficulty
      break
    case 'startDesign':
      // Lobby -> story briefing. The design timer starts only when everyone is ready.
      if (s.phase !== 'lobby' || !s.scenarioId) break
      if (s.mode === 'team' && uncoveredRoles(s).length) break
      s.phase = 'briefing'
      s.ready = {}
      break
    case 'ready': {
      if (s.phase !== 'briefing') break
      s.ready[a.playerId] = a.value
      const everyone = activePlayers(s).every((p) => s.ready[p.id])
      if (s.mode === 'solo' || everyone) startDesign(s, now)
      break
    }
    case 'setDesign':
    case 'toggleInstrument': {
      if (s.phase !== 'design' || !s.design || !s.scenarioId) break
      const sc = scenarioOf(s)
      const before = computeMetrics(s.design, sc)
      const next: Design = { ...s.design, instruments: [...s.design.instruments] }
      let role: Role
      let what: string
      if (a.type === 'toggleInstrument') {
        role = 'science'
        if (!ownsRole(s, a.playerId, role)) break
        const inst = sc.instruments.find((i) => i.id === a.instrumentId)
        if (!inst) break
        const had = next.instruments.includes(inst.id)
        next.instruments = had ? next.instruments.filter((x) => x !== inst.id) : [...next.instruments, inst.id]
        what = `${had ? 'removed' : 'added'} the ${inst.name.toLowerCase()}`
      } else {
        const keys = Object.keys(a.patch) as Exclude<keyof Design, 'growth'>[]
        if (!keys.length || keys.some((k) => !(k in FIELD_OWNER))) break // e.g. growth can't be edited
        role = FIELD_OWNER[keys[0]]
        if (!keys.every((k) => ownsRole(s, a.playerId, FIELD_OWNER[k]))) break
        Object.assign(next, a.patch)
        // Rideshare forces its orbit.
        const rocket = byId(ROCKETS, next.rocketId)
        if (rocket.onlyOrbits && !rocket.onlyOrbits.includes(next.orbitId) && keys.includes('rocketId')) next.orbitId = rocket.onlyOrbits[0]
        next.satellites = Math.max(1, Math.min(sc.maxSatellites, next.satellites))
        what = describePatch(a.patch, sc.id)
      }
      s.design = next
      s.approvals = {}
      const after = computeMetrics(next, sc)
      const change = describeChange(before, after)
      const pl = s.players[a.playerId]
      if (pl) pl.edits += 1
      push(s, {
        role, who: s.mode === 'team' ? playerName(s, a.playerId) : undefined,
        text: `${ROLE_SHORT[role]} ${what}: ${change.text}`, tone: change.bad ? 'bad' : 'info',
      })
      break
    }
    case 'chat': {
      const text = a.text.trim().slice(0, 240)
      if (!text) break
      const p = s.players[a.playerId]
      push(s, { role: p?.roles[0], who: p?.name, text, tone: 'info' })
      break
    }
    case 'goReview': {
      if (s.phase !== 'design' || !s.design) break
      s.phase = 'review'
      s.reviewAttempts += 1
      s.approvals = {}
      push(s, { role: 'system', text: `${playerName(s, a.playerId)} called the design review.`, tone: 'info' })
      // Harder levels: at the first review the estimates firm up, and they always grow.
      const lv = scenarioOf(s).level
      if (lv && lv.growth[1] > 0 && !s.design.growth) {
        const roll = (k: string) => lv.growth[0] + hashRand(s.seed, 'growth', k, s.flight) * (lv.growth[1] - lv.growth[0])
        s.design = { ...s.design, growth: { mass: roll('mass'), power: roll('power'), cost: roll('cost') } }
        const g = s.design.growth!
        const pct = (x: number) => `+${Math.round(x * 100)}%`
        push(s, { role: 'system', text: `Preliminary design review: the estimates firmed up. Mass ${pct(g.mass)}, power ${pct(g.power)}, hardware cost ${pct(g.cost)}. Real projects always grow, which is why engineers keep margins.`, tone: 'bad' })
      }
      break
    }
    case 'backToDesign':
      if (s.phase !== 'review') break
      s.phase = 'design'
      s.approvals = {}
      push(s, { role: 'system', text: 'Back to the drawing board.', tone: 'info' })
      break
    case 'approve':
      if (s.phase !== 'review') break
      s.approvals[a.playerId] = a.value
      break
    case 'launch': {
      if (s.phase !== 'review' || !s.design || !s.scenarioId || !isLead(s, a.playerId)) break
      const sc = scenarioOf(s)
      if (!canLaunch(computeMetrics(s.design, sc))) break
      if (s.mode === 'team' && !activePlayers(s).every((p) => s.approvals[p.id])) break
      // Review passed: program the flight computer before liftoff.
      s.overtimeM = overtimeCost(s, now)
      s.calc = { challenge: buildChallenge(s.design, sc), result: null }
      s.phase = 'calc'
      push(s, { role: 'system', text: 'Design approved. Program the flight computer: liftoff check and burn time.', tone: 'info' })
      break
    }
    case 'submitCalc': {
      if (s.phase !== 'calc' || !s.calc || s.calc.result) break
      const by = s.players[a.playerId]?.name ?? 'The team'
      const lvl = scenarioOf(s).level
      if (a.autopilot && lvl && !lvl.autopilot) break
      s.calc.result = gradeCalc(s.calc.challenge, a.twr, a.burn, a.autopilot, by, lvl?.burnTolerance ?? 1)
      const r = s.calc.result
      push(s, { role: 'system', who: s.mode === 'team' ? by : undefined, text: r.grade === 'autopilot' ? 'Flight computer set to autopilot.' : `Burn programmed: ${Math.round(r.burnAnswer ?? 0)} s. ${r.verdict}`, tone: r.grade === 'bullseye' || r.grade === 'good' ? 'good' : r.grade === 'autopilot' ? 'info' : 'bad' })
      break
    }
    case 'beginLaunch': {
      if (s.phase !== 'calc' || !s.calc?.result || !s.design || !isLead(s, a.playerId)) break
      const rocket = byId(ROCKETS, s.design.rocketId)
      const success = hashRand(s.seed, 'launch', s.flight) < rocket.reliability
      s.launch = { success, at: now }
      s.phase = 'launch'
      push(s, { role: 'system', text: `Launch! ${rocket.name} lifting off.`, tone: 'info' })
      break
    }
    case 'vote':
    case 'decide': {
      const ev = s.pendingEvent
      if (s.phase !== 'ops' || !ev || !s.sim || !s.design || !s.scenarioId) break
      if (ev.disabled[a.optionId] || !ev.options.some((o) => o.id === a.optionId)) break
      s.votes[a.playerId] = a.optionId
      const voters = activePlayers(s)
      let choice: string | null = null
      if (s.mode === 'solo' || (a.type === 'decide' && isLead(s, a.playerId))) choice = a.optionId
      else if (voters.every((p) => s.votes[p.id])) {
        const tally: Record<string, number> = {}
        for (const p of voters) tally[s.votes[p.id]] = (tally[s.votes[p.id]] ?? 0) + 1
        const max = Math.max(...Object.values(tally))
        const top = Object.keys(tally).filter((k) => tally[k] === max)
        const leadVote = voters.find((p) => p.roles.includes('lead'))
        choice = top.length === 1 ? top[0] : (leadVote && top.includes(s.votes[leadVote.id]) ? s.votes[leadVote.id] : top[0])
      }
      if (choice) {
        const sc = scenarioOf(s)
        const label = ev.options.find((o) => o.id === choice)?.label ?? choice
        const res = resolveEvent(ev, choice, s.sim, s.design, sc, s.seed)
        push(s, { role: 'system', text: `Day ${s.sim.day} · ${ev.title}: team chose "${label}". ${res.text}`, tone: res.tone })
        s.pendingEvent = null
        s.votes = {}
        if (s.sim.ended) finish(s, sc)
      }
      break
    }
    case 'setSpeed':
      s.speed = Math.max(0.5, Math.min(30, a.speed))
      break
    case 'setPaused':
      s.paused = a.paused
      break
    case 'redesign':
      if (s.phase !== 'report' || !s.scenarioId) break
      s.flight += 1
      s.seed = newSeed()
      s.sim = null; s.report = null; s.launch = null; s.pendingEvent = null; s.votes = {}; s.calc = null
      s.reviewAttempts = 0; s.overtimeM = 0; s.speed = 1; s.paused = false
      push(s, { role: 'system', text: `Flight ${s.flight}: redesign the mission and fly again.`, tone: 'info' })
      startDesign(s, now)
      break
    case 'newMission':
      if (s.phase !== 'report') break
      s.phase = 'lobby'
      s.scenarioId = null; s.design = null; s.sim = null; s.report = null; s.launch = null
      s.pendingEvent = null; s.votes = {}; s.reviewAttempts = 0; s.overtimeM = 0; s.flight = 1; s.seed = newSeed(); s.calc = null
      s.feed = []
      break
  }
  s.rev += 1
  return s
}

function describePatch(patch: Partial<Design>, _sc: string): string {
  const k = Object.keys(patch)[0] as keyof Design
  const labels: Partial<Record<keyof Design, string>> = {
    orbitId: 'changed the orbit', rocketId: 'changed the rocket', satellites: `set the fleet to ${patch.satellites} satellite${patch.satellites === 1 ? '' : 's'}`,
    busId: 'changed the bus', solarId: 'changed the solar arrays', batteryId: 'changed the battery', adcsId: 'changed pointing control',
    propulsionId: 'changed propulsion', redundancy: patch.redundancy ? 'added a backup flight computer' : 'removed the backup computer',
    antennaId: 'changed the antenna', groundId: 'changed the ground network', storageId: 'changed the recorder',
  }
  return labels[k] ?? 'changed the design'
}

function finish(s: GameState, sc: Scenario) {
  s.report = buildReport(s, sc)
  s.phase = 'report'
  s.pendingEvent = null
}

/** Advance time-driven phases. Returns true if anything changed. */
export function tick(s: GameState, now: number, dtMs: number): boolean {
  s.now = now
  if (s.phase === 'launch' && s.launch && now - s.launch.at >= LAUNCH_ANIMATION_MS) {
    const sc = scenarioOf(s)
    if (!s.launch.success) {
      push(s, { role: 'system', text: 'Launch failure. The rocket did not reach orbit.', tone: 'bad' })
      finish(s, sc)
    } else {
      s.sim = initSim(s.design!, sc, s.seed)
      if (s.calc?.result) s.sim.log.push({ day: 0, text: applyCalc(s.sim, s.calc.result, s.design!, sc), tone: s.calc.result.grade === 'off' || s.calc.result.grade === 'wayoff' ? 'bad' : 'good' })
      s.phase = 'ops'
      s.opsAcc = 0
      push(s, { role: 'system', text: 'Orbit reached. Operations begin.', tone: 'good' })
    }
    s.rev += 1
    return true
  }
  if (s.phase === 'ops' && s.sim && !s.pendingEvent && !s.paused) {
    const sc = scenarioOf(s)
    const daysPerMs = s.sim.plannedDays / (OPS_SECONDS * 1000)
    s.opsAcc += daysPerMs * dtMs * s.speed
    let steps = Math.floor(s.opsAcc)
    s.opsAcc -= steps
    while (steps-- > 0 && !s.sim.ended) {
      const ev = stepDay(s.sim, s.design!, sc, s.seed)
      if (ev) { s.pendingEvent = ev; s.votes = {}; s.opsAcc = 0; break }
    }
    if (s.sim.ended) finish(s, sc)
    s.rev += 1
    return true
  }
  return false
}

/** Copy of state safe to send to clients (already plain JSON). */
export const snapshot = (s: GameState) => s
