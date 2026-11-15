// Mission briefs. Each scenario brings its own instruments, objectives,
// allowed orbits/rockets/networks, random events and real missions to compare with.
import type { Difficulty, LevelRules, Objective, Scenario } from './types.ts'

const wildfire: Scenario = {
  id: 'wildfire',
  name: 'Wildfire Watch',
  tagline: 'Spot California wildfires from orbit before they spread.',
  objective: 'Build an Earth-observing mission that detects active fires in California, checks on them often, and keeps working for 3 years.',
  difficulty: 'Beginner',
  budgetM: 150,
  lifetimeYears: 3,
  designMinutes: 10,
  opsCostPerYearM: 5,
  maxSatellites: 4,
  orbits: ['leo-400', 'sso-600', 'geo'],
  rockets: ['rideshare', 'small', 'medium', 'heavy'],
  networks: ['gs-uni', 'gs-commercial', 'gs-nsn'],
  events: ['solar-storm', 'instrument-glitch', 'budget-cut', 'station-outage', 'debris'],
  instruments: [
    {
      id: 'thermal-ir', name: 'Thermal infrared camera', kind: 'thermal',
      blurb: 'Sees heat. Active fires glow brightly in thermal infrared, even through thin smoke and at night.',
      massKg: 12, powerW: 35, costM: 28, dataGBPerDay: 4, science: 100, pointingDeg: 0.1,
      objectives: { 'detect-fires': 1, revisit: 1, 'fire-risk': 0.2 },
    },
    {
      id: 'compact-thermal', name: 'Compact thermal camera', kind: 'thermal',
      blurb: 'A small-satellite heat camera: lower resolution than a big one, but cheap and light enough to fly on many satellites.',
      massKg: 4, powerW: 10, costM: 8, dataGBPerDay: 1.2, science: 55, pointingDeg: 0.1,
      objectives: { 'detect-fires': 0.8, revisit: 1 },
    },
    {
      id: 'swir', name: 'Shortwave infrared spectrometer', kind: 'spectral',
      blurb: 'Measures how intensely a fire burns and sees through smoke better than a normal camera.',
      massKg: 18, powerW: 40, costM: 32, dataGBPerDay: 10, science: 90, pointingDeg: 0.1,
      objectives: { 'detect-fires': 0.8, revisit: 1, 'burn-scars': 0.6, 'fire-risk': 0.3 },
    },
    {
      id: 'visible-cam', name: 'Visible color camera', kind: 'optical',
      blurb: 'A color camera for smoke plumes and burned land. Cheap and useful, but cannot see fires through smoke.',
      massKg: 8, powerW: 15, costM: 12, dataGBPerDay: 6, science: 60, pointingDeg: 0.1,
      objectives: { 'burn-scars': 1, smoke: 0.4, revisit: 0.5 },
    },
    {
      id: 'sounder', name: 'Smoke and gas sounder', kind: 'sounder',
      blurb: 'Measures smoke particles and carbon monoxide in the air, which matters for public health.',
      massKg: 15, powerW: 25, costM: 20, dataGBPerDay: 1.5, science: 55, pointingDeg: 1,
      objectives: { smoke: 1 },
    },
    {
      id: 'hyperspectral', name: 'Hyperspectral imager', kind: 'spectral',
      blurb: 'Splits light into hundreds of colors to measure how dry the plants are, which predicts where fires will start.',
      massKg: 28, powerW: 55, costM: 42, dataGBPerDay: 25, science: 110, pointingDeg: 0.05,
      objectives: { 'fire-risk': 1, 'burn-scars': 0.5 },
    },
    {
      id: 'hires-cam', name: 'High-resolution camera', kind: 'hires',
      blurb: 'Super-sharp black-and-white photos. Impressive, but a tiny field of view and huge data for little fire science.',
      massKg: 30, powerW: 30, costM: 30, dataGBPerDay: 30, science: 40, pointingDeg: 0.01,
      objectives: { 'burn-scars': 0.7 },
    },
  ],
  objectives: [
    { id: 'detect-fires', kind: 'primary', name: 'Detect active fires', blurb: 'Deliver enough fire-detection data (thermal or shortwave infrared) to the ground.', threshold: 60 },
    { id: 'revisit', kind: 'primary', name: 'Check California at least twice a day', blurb: 'Fires grow in hours. Your orbit and number of satellites must give 2+ looks per day, with an imager on board.', threshold: 20, minRevisitPerDay: 2 },
    { id: 'survive', kind: 'primary', name: 'Operate for the full 3 years', blurb: 'Keep the spacecraft alive and in orbit until the planned end of mission.', threshold: 0, survive: true },
    { id: 'burn-scars', kind: 'bonus', name: 'Map burn scars', blurb: 'Map burned land after fires so recovery teams know where to go.', threshold: 45 },
    { id: 'smoke', kind: 'bonus', name: 'Track smoke and air quality', blurb: 'Measure smoke that drifts over cities.', threshold: 35 },
    { id: 'fire-risk', kind: 'bonus', name: 'Forecast fire risk', blurb: 'Measure plant dryness to predict where fires will start.', threshold: 55 },
  ],
  realMissions: [
    { name: 'Landsat 9', year: '2021', agency: 'NASA / USGS', url: 'https://landsat.gsfc.nasa.gov/satellites/landsat-9/', orbitIds: ['sso-600'], instruments: ['visible-cam', 'thermal-ir'], satellites: 1, note: 'A color imager plus a thermal camera in sun-synchronous orbit, used to map burn scars and land change.' },
    { name: 'Terra & Aqua (MODIS)', year: '1999 / 2002', agency: 'NASA', url: 'https://science.nasa.gov/mission/terra/', orbitIds: ['sso-600'], instruments: ['thermal-ir', 'visible-cam', 'swir', 'sounder'], satellites: 2, note: 'Two satellites carrying MODIS have produced daily global fire maps for over 20 years.' },
    { name: 'GOES-R series', year: '2016+', agency: 'NOAA / NASA', url: 'https://www.goes-r.gov/', orbitIds: ['geo'], instruments: ['thermal-ir', 'visible-cam'], satellites: 1, note: 'Geostationary weather satellites that spot new fires every few minutes, but only large ones.' },
    { name: 'ECOSTRESS', year: '2018', agency: 'NASA JPL', url: 'https://ecostress.jpl.nasa.gov/', orbitIds: ['leo-400'], instruments: ['thermal-ir'], satellites: 1, note: 'A thermal radiometer on the Space Station that measures plant stress and fire heat.' },
    { name: 'EMIT', year: '2022', agency: 'NASA JPL', url: 'https://earth.jpl.nasa.gov/emit/', orbitIds: ['leo-400'], instruments: ['hyperspectral'], satellites: 1, note: 'An imaging spectrometer on the Space Station, the same idea as a hyperspectral imager.' },
    { name: 'FireSat constellation', year: '2025+', agency: 'Earth Fire Alliance', orbitIds: ['sso-600', 'leo-400'], instruments: ['thermal-ir', 'swir'], satellites: 3, note: 'A planned fleet of small satellites with infrared cameras to catch fires as small as a classroom.' },
    { name: 'TEMPO', year: '2023', agency: 'NASA / SAO', url: 'https://tempo.si.edu/', orbitIds: ['geo'], instruments: ['sounder'], satellites: 1, note: 'Measures air pollution, including wildfire smoke, over North America every hour from geostationary orbit.' },
  ],
  starter: {
    orbitId: 'sso-600', rocketId: 'small', satellites: 1, instruments: [],
    busId: 'bus-small', solarId: 'solar-body', batteryId: 'batt-150', adcsId: 'adcs-mag',
    propulsionId: 'prop-none', redundancy: false,
    antennaId: 'ant-s', groundId: 'gs-uni', storageId: 'store-16',
  },
}

const lunarIce: Scenario = {
  id: 'lunar-ice',
  name: 'Lunar Ice Hunter',
  tagline: 'Find the water ice hiding in the Moon\'s darkest craters.',
  objective: 'Put a spacecraft in orbit around the Moon, find hydrogen and surface ice near the south pole, and keep it working for 2 years. Future astronauts will drink and make fuel from this water.',
  difficulty: 'Medium',
  budgetM: 250,
  lifetimeYears: 2,
  designMinutes: 12,
  opsCostPerYearM: 8,
  maxSatellites: 1,
  orbits: ['moon-100', 'moon-50', 'moon-frozen'],
  rockets: ['small', 'medium', 'heavy'],
  networks: ['gs-dsn', 'gs-nsn'],
  events: ['solar-storm', 'instrument-glitch', 'budget-cut', 'lunar-eclipse', 'dsn-conflict'],
  instruments: [
    {
      id: 'neutron', name: 'Neutron spectrometer', kind: 'neutron',
      blurb: 'Counts neutrons bouncing off the Moon. Fewer neutrons means hydrogen, likely water, down to about 1 m deep. Works best low.',
      massKg: 10, powerW: 8, costM: 15, dataGBPerDay: 0.05, science: 90, pointingDeg: 5,
      objectives: { hydrogen: 1, 'buried-ice': 0.3 },
    },
    {
      id: 'ir-spec', name: 'Infrared mapping spectrometer', kind: 'spectral',
      blurb: 'Reads the "color fingerprint" of water and ice on the very surface.',
      massKg: 20, powerW: 45, costM: 38, dataGBPerDay: 12, science: 110, pointingDeg: 0.05,
      objectives: { 'surface-ice': 1, 'crater-map': 0.2 },
    },
    {
      id: 'uv-spec', name: 'Ultraviolet spectrograph', kind: 'uv',
      blurb: 'Sees frost inside permanently dark craters using faint starlight.',
      massKg: 6, powerW: 12, costM: 18, dataGBPerDay: 1, science: 60, pointingDeg: 0.1,
      objectives: { 'surface-ice': 0.8 },
    },
    {
      id: 'radiometer', name: 'Thermal radiometer', kind: 'thermal',
      blurb: 'Measures surface temperature. Ice survives only in "cold traps" below about -160 C.',
      massKg: 8, powerW: 15, costM: 14, dataGBPerDay: 0.5, science: 70, pointingDeg: 0.1,
      objectives: { 'cold-traps': 1 },
    },
    {
      id: 'laser-alt', name: 'Laser altimeter', kind: 'laser',
      blurb: 'Fires laser pulses to measure the shape of craters, including ones that never see sunlight.',
      massKg: 15, powerW: 35, costM: 25, dataGBPerDay: 2, science: 80, pointingDeg: 0.05,
      objectives: { 'crater-map': 1, 'cold-traps': 0.5 },
    },
    {
      id: 'radar', name: 'Synthetic aperture radar', kind: 'radar',
      blurb: 'Radar that looks beneath the surface for buried ice. Power-hungry and makes enormous amounts of data.',
      massKg: 40, powerW: 120, costM: 45, dataGBPerDay: 40, science: 120, pointingDeg: 0.05,
      objectives: { 'buried-ice': 1, hydrogen: 0.3, 'crater-map': 0.3 },
    },
    {
      id: 'wide-cam', name: 'Wide-angle camera', kind: 'optical',
      blurb: 'Pictures of the polar landscape and lighting conditions for future landers.',
      massKg: 6, powerW: 10, costM: 9, dataGBPerDay: 8, science: 40, pointingDeg: 0.1,
      objectives: { 'crater-map': 0.6 },
    },
  ],
  objectives: [
    { id: 'hydrogen', kind: 'primary', name: 'Find hydrogen at the south pole', blurb: 'Map where hydrogen (likely water) is buried in the top meter of soil.', threshold: 50 },
    { id: 'surface-ice', kind: 'primary', name: 'Map surface ice', blurb: 'Detect ice exposed on the surface inside shadowed craters.', threshold: 50 },
    { id: 'survive', kind: 'primary', name: 'Operate for the full 2 years', blurb: 'Get into lunar orbit and keep working until the planned end of mission.', threshold: 0, survive: true },
    { id: 'cold-traps', kind: 'bonus', name: 'Find the coldest traps', blurb: 'Map the craters cold enough to hold ice for billions of years.', threshold: 40 },
    { id: 'buried-ice', kind: 'bonus', name: 'Detect buried ice', blurb: 'Look beneath the surface for thick ice deposits.', threshold: 55 },
    { id: 'crater-map', kind: 'bonus', name: '3D map of shadowed craters', blurb: 'Map crater shapes so future landers can plan routes.', threshold: 40 },
  ],
  realMissions: [
    { name: 'Lunar Reconnaissance Orbiter', year: '2009', agency: 'NASA', url: 'https://science.nasa.gov/mission/lro/', orbitIds: ['moon-50', 'moon-frozen'], instruments: ['neutron', 'radiometer', 'laser-alt', 'uv-spec', 'radar', 'wide-cam'], satellites: 1, note: 'A large orbiter with seven instruments that has mapped the Moon since 2009, moving to a frozen orbit to save fuel.' },
    { name: 'Lunar Prospector', year: '1998', agency: 'NASA', url: 'https://science.nasa.gov/mission/lunar-prospector/', orbitIds: ['moon-100', 'moon-50'], instruments: ['neutron'], satellites: 1, note: 'A small, low-cost spinner whose neutron spectrometer first found extra hydrogen at the lunar poles.' },
    { name: 'Lunar Trailblazer', year: '2025', agency: 'NASA / Caltech', url: 'https://science.nasa.gov/mission/lunar-trailblazer/', orbitIds: ['moon-100'], instruments: ['ir-spec', 'radiometer'], satellites: 1, note: 'A small satellite with an infrared spectrometer and thermal mapper, built to map surface water.' },
    { name: 'Chandrayaan-1', year: '2008', agency: 'ISRO (with NASA instruments)', orbitIds: ['moon-100'], instruments: ['ir-spec', 'radar', 'wide-cam'], satellites: 1, note: 'India\'s orbiter carried NASA\'s Moon Mineralogy Mapper and Mini-SAR radar, which together found signs of water.' },
    { name: 'LunaH-Map', year: '2022', agency: 'NASA / ASU', url: 'https://science.nasa.gov/mission/lunah-map/', orbitIds: ['moon-frozen'], instruments: ['neutron'], satellites: 1, note: 'A shoebox-sized CubeSat with a neutron spectrometer for south-pole hydrogen. Its thruster failed before reaching orbit, a reminder that propulsion is mission-critical.' },
  ],
  starter: {
    orbitId: 'moon-100', rocketId: 'medium', satellites: 1, instruments: [],
    busId: 'bus-medium', solarId: 'solar-small', batteryId: 'batt-400', adcsId: 'adcs-wheels',
    propulsionId: 'prop-none', redundancy: false,
    antennaId: 'ant-x', groundId: 'gs-dsn', storageId: 'store-64',
  },
}

export const SCENARIOS: Scenario[] = [wildfire, lunarIce]

/** Briefs shown on the card picker but not playable yet. */
export const COMING_SOON = [
  { name: 'Connect the Unconnected', tagline: 'A communications satellite for remote regions.', difficulty: 'Medium' },
  { name: 'Europa Explorer', tagline: 'Jupiter\'s ocean moon: radiation, distance and a weak signal.', difficulty: 'Hard' },
]

export const LEVELS: Record<Difficulty, LevelRules> = {
  cadet: {
    id: 'cadet', label: 'Cadet', blurb: 'Full budget, advisors tell you exactly what to fix, no surprises in your numbers. Learn the ropes.',
    budgetFactor: 1, growth: [0, 0], events: 4, eventHarm: 1, autopilot: true, burnTolerance: 1, advisors: 'full', scoreMultiplier: 1,
  },
  engineer: {
    id: 'engineer', label: 'Engineer', blurb: '85% budget. Advisors only warn that something is wrong. Estimates grow 5–15% at review, so you need margins. Tougher goals.',
    budgetFactor: 0.85, growth: [0.05, 0.15], events: 5, eventHarm: 1.3, autopilot: true, burnTolerance: 1, advisors: 'vague', scoreMultiplier: 1.25,
  },
  director: {
    id: 'director', label: 'Flight Director', blurb: '75% budget, no advisors, estimates grow 10–25%, six harsh events, no autopilot, the toughest goals.',
    budgetFactor: 0.75, growth: [0.1, 0.25], events: 6, eventHarm: 1.6, autopilot: false, burnTolerance: 0.6, advisors: 'none', scoreMultiplier: 1.5,
  },
}

/** Extra must-have goals on harder levels. */
const EXTRA_GOALS: Record<string, Partial<Record<Difficulty, Objective[]>>> = {
  wildfire: {
    engineer: [{ id: 'fast-alerts', kind: 'primary', name: 'Alert crews within 3 hours (2 of 8 real fires)', blurb: 'In the real-fire replay, get the alert to the ground within 3 hours of ignition for at least 2 fires.', threshold: 0, minFastAlerts: 2 }],
    director: [{ id: 'fast-alerts', kind: 'primary', name: 'Alert crews within 3 hours (3 of 8 real fires)', blurb: 'In the real-fire replay, get the alert to the ground within 3 hours of ignition for at least 3 fires.', threshold: 0, minFastAlerts: 3 }],
  },
  'lunar-ice': {
    engineer: [{ id: 'data-home', kind: 'primary', name: 'Send home 95% of your data', blurb: 'At least 95% of everything your instruments collect must reach Earth.', threshold: 0, minDelivered: 0.95 }],
    director: [{ id: 'data-home', kind: 'primary', name: 'Send home 95% of your data', blurb: 'At least 95% of everything your instruments collect must reach Earth.', threshold: 0, minDelivered: 0.95 }],
  },
}

const cache = new Map<string, Scenario>()

/** The scenario adjusted for a difficulty level: budget, goals and rules. */
export const getScenario = (id: string, difficulty: Difficulty = 'cadet'): Scenario => {
  const key = `${id}:${difficulty}`
  const hit = cache.get(key)
  if (hit) return hit
  const base = SCENARIOS.find((x) => x.id === id)
  if (!base) throw new Error(`Unknown scenario ${id}`)
  const level = LEVELS[difficulty] ?? LEVELS.cadet
  let objectives = [...base.objectives, ...(EXTRA_GOALS[id]?.[difficulty] ?? [])]
  // Flight Director on the Moon: finding the cold traps becomes a must-have too.
  if (difficulty === 'director' && id === 'lunar-ice') {
    objectives = objectives.map((o) => (o.id === 'cold-traps' ? { ...o, kind: 'primary' as const } : o))
  }
  const sc: Scenario = { ...base, level, budgetM: Math.round(base.budgetM * level.budgetFactor), objectives }
  cache.set(key, sc)
  return sc
}

/** Scenario for a game state (its mission and difficulty). */
export const scenarioOf = (s: { scenarioId: string | null; difficulty?: Difficulty }) => getScenario(s.scenarioId!, s.difficulty ?? 'cadet')
