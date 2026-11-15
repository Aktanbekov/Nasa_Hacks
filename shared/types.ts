// Core data types for Launch Window. Everything the game knows about parts,
// scenarios and game state is described here; the catalog files are plain data.

export type Role = 'lead' | 'science' | 'engineer' | 'comms'
export const ROLES: Role[] = ['lead', 'science', 'engineer', 'comms']

/** Where the spacecraft operates. Drives rocket capacity, comms rates and contact time. */
export type DestClass = 'leo' | 'sso' | 'geo' | 'moon'
/** Rough distance class used by antennas and ground networks. */
export type CommsClass = 'earth' | 'geo' | 'moon'

export type InstrumentKind =
  | 'thermal' | 'optical' | 'spectral' | 'sounder' | 'hires'
  | 'neutron' | 'radar' | 'laser' | 'uv'

export interface Part {
  id: string
  name: string
  blurb: string
  massKg: number
  costM: number
  powerW?: number
}

export interface Orbit {
  id: string
  name: string
  blurb: string
  dest: DestClass
  comms: CommsClass
  altitudeKm: number
  periodMin: number
  /** Longest time in Earth's/Moon's shadow per orbit, minutes. */
  eclipseMin: number
  /** How many useful looks at the target per day, per spacecraft. */
  revisitPerSat: number
  /** Image quality / coverage multiplier per instrument kind (1 = nominal). */
  quality: Partial<Record<InstrumentKind, number>>
  /** Velocity change needed to get into this orbit after the rocket drops us off (m/s). */
  insertionDv: number
  /** Fuel needed each year to hold the orbit against drag or lumpy gravity (m/s per year). */
  stationKeepingDv: number
  /** How long the orbit lasts with no fuel left before reentry / impact / drift (years). */
  naturalLifeYears: number
  /** Solar array degradation per year from radiation (fraction). */
  solarDegradation: number
}

export interface Rocket extends Part {
  /** Max payload mass in kg per destination. 0 means it cannot go there. */
  capacity: Record<DestClass, number>
  reliability: number
  /** If set, only these orbits are possible (rideshare). */
  onlyOrbits?: string[]
}

export interface Bus extends Part {
  basePowerW: number
  maxPayloadKg: number
  slots: number
}
export interface SolarArray extends Part { outputW: number }
export interface Battery extends Part { capacityWh: number }
export interface Adcs extends Part {
  accuracyDeg: number
  /** Destinations where this works (magnetic torquers need Earth's field). */
  worksAt: DestClass[]
}
export interface Propulsion extends Part { deltaV: number }
export interface Antenna extends Part {
  /** Data rate in Mbps while in contact, per distance class. */
  rateMbps: Record<CommsClass, number>
}
export interface GroundNetwork {
  id: string
  name: string
  blurb: string
  costPerYearM: number
  /** Minutes of contact per day, per distance class. 0 = can't reach. */
  contactMin: Record<CommsClass, number>
}
export interface Storage extends Part { capacityGB: number }

export interface Instrument extends Part {
  kind: InstrumentKind
  powerW: number
  dataGBPerDay: number
  /** Science points if it runs the whole mission and all data reaches the ground. */
  science: number
  pointingDeg: number
  /** Which objectives this instrument feeds, with weight 0..1. */
  objectives: Record<string, number>
}

export interface Objective {
  id: string
  name: string
  blurb: string
  kind: 'primary' | 'bonus'
  /** Science points (weighted) needed from contributing instruments. 0 = no science needed. */
  threshold: number
  minRevisitPerDay?: number
  /** Special: met if the spacecraft survives the full planned lifetime. */
  survive?: boolean
}

export interface RealMission {
  name: string
  year: string
  agency: string
  url?: string
  orbitIds: string[]
  instruments: string[]
  satellites: number
  note: string
}

export interface Scenario {
  id: string
  name: string
  tagline: string
  objective: string
  difficulty: 'Beginner' | 'Medium' | 'Hard'
  budgetM: number
  lifetimeYears: number
  designMinutes: number
  /** Fixed operations team cost per year ($M). */
  opsCostPerYearM: number
  maxSatellites: number
  orbits: string[]
  rockets: string[]
  networks: string[]
  instruments: Instrument[]
  objectives: Objective[]
  events: string[]
  realMissions: RealMission[]
  starter: Design
}

export interface Design {
  orbitId: string
  rocketId: string
  satellites: number
  instruments: string[]
  busId: string
  solarId: string
  batteryId: string
  adcsId: string
  propulsionId: string
  redundancy: boolean
  antennaId: string
  groundId: string
  storageId: string
}

export type CheckStatus = 'pass' | 'warn' | 'fail'
export interface Check {
  id: string
  label: string
  status: CheckStatus
  detail: string
  /** Hard checks block launch. Warnings never block. */
  blocking: boolean
  fix?: string
}

export interface Metrics {
  massPerSatKg: number
  launchMassKg: number
  rocketCapacityKg: number
  payloadKg: number
  costM: number
  costBreakdown: { label: string; costM: number }[]
  budgetM: number
  loadW: number
  instrumentLoadW: number
  solarAvgW: number
  powerMarginW: number
  powerMarginEolW: number
  eclipseNeedWh: number
  batteryUsableWh: number
  eclipseShortW: number
  depthOfDischarge: number
  dataGBPerDay: number
  downlinkGBPerDay: number
  downlinkMargin: number
  storageDays: number
  lifetimeYears: number
  lifetimeLimit: string
  revisitPerDay: number
  slotsUsed: number
  slots: number
  pointingIssues: string[]
  checks: Check[]
}

export interface FeedItem {
  id: number
  t: number
  role?: Role | 'system' | 'advisor'
  who?: string
  text: string
  tone?: 'good' | 'bad' | 'info'
}

export interface Player {
  id: string
  name: string
  roles: Role[]
  connected: boolean
  edits: number
}

export interface EventOption {
  id: string
  label: string
  detail: string
}
export interface PendingEvent {
  id: string
  templateId: string
  day: number
  title: string
  body: string
  options: EventOption[]
  /** Option ids that are disabled, with reason. */
  disabled: Record<string, string>
  instrumentId?: string
}

export interface SimPoint {
  day: number
  generated: number
  downlinked: number
  lost: number
  battery: number
  health: number
  powerOk: number
}

export interface SimState {
  day: number
  plannedDays: number
  ended: boolean
  endReason: string
  generatedGB: number
  downlinkedGB: number
  lostGB: number
  lostStorageGB: number
  lostDownlinkGB: number
  bufferGB: number
  batteryHealth: number
  solarHealth: number
  health: number
  fuelDv: number
  extraCostM: number
  instrumentState: Record<string, { on: boolean; quality: number; activeDays: number; generatedGB: number }>
  powerShortDays: number
  eclipseShortDays: number
  outageDaysLeft: number
  outageFactor: number
  contactFactor: number
  safeModeDaysLeft: number
  endDayCap: number
  history: SimPoint[]
  log: { day: number; text: string; tone: 'good' | 'bad' | 'info' }[]
  eventSchedule: { day: number; templateId: string; instrumentId?: string }[]
  decisions: { templateId: string; optionId: string; quality: number }[]
}

export type Tier = 'Failure' | 'Partial' | 'Success' | 'Exceeded'

export interface Report {
  tier: Tier
  score: number
  breakdown: { label: string; points: number; detail: string }[]
  objectives: { id: string; name: string; kind: 'primary' | 'bonus'; met: boolean; detail: string }[]
  why: { text: string; tone: 'good' | 'bad' | 'info' }[]
  matches: (RealMission & { similarity: number })[]
  stats: { label: string; value: string }[]
  launchFailed: boolean
}

export type Phase = 'lobby' | 'briefing' | 'design' | 'review' | 'launch' | 'ops' | 'report'

export interface GameState {
  code: string
  mode: 'solo' | 'team'
  phase: Phase
  scenarioId: string | null
  relaxed: boolean
  players: Record<string, Player>
  hostId: string
  design: Design | null
  designStartedAt: number
  /** Schedule overrun cost frozen at launch ($M). */
  overtimeM: number
  opsAcc: number
  feed: FeedItem[]
  feedSeq: number
  approvals: Record<string, boolean>
  /** Players who finished the story briefing and are ready to design. */
  ready: Record<string, boolean>
  reviewAttempts: number
  launch: { success: boolean; at: number } | null
  sim: SimState | null
  pendingEvent: PendingEvent | null
  votes: Record<string, string>
  speed: number
  paused: boolean
  report: Report | null
  seed: number
  flight: number
  rev: number
  now: number
}
