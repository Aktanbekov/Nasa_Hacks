// Parts catalog shared by every scenario. Numbers are simplified but keep
// real-world proportions: bigger parts weigh more, cost more and draw more power.
import type {
  Adcs, Antenna, Battery, Bus, GroundNetwork, Orbit, Propulsion, Rocket, SolarArray, Storage,
} from './types.ts'

export const ORBITS: Orbit[] = [
  {
    id: 'leo-400',
    name: 'Low Earth orbit, 400 km',
    blurb: 'Same height as the Space Station. Sharp images and cheap to reach, but thin air drags you down fast.',
    dest: 'leo', comms: 'earth', altitudeKm: 400, periodMin: 92, eclipseMin: 36,
    revisitPerSat: 1,
    quality: { thermal: 1.15, optical: 1.15, spectral: 1.1, sounder: 1, hires: 1.2 },
    insertionDv: 0, stationKeepingDv: 45, naturalLifeYears: 1.2, solarDegradation: 0.025,
  },
  {
    id: 'sso-600',
    name: 'Sun-synchronous orbit, 600 km',
    blurb: 'Passes over every place at the same local time each day, twice (day and night). The classic Earth-watching orbit.',
    dest: 'sso', comms: 'earth', altitudeKm: 600, periodMin: 97, eclipseMin: 35,
    revisitPerSat: 2,
    quality: { thermal: 1, optical: 1, spectral: 1, sounder: 1, hires: 1 },
    insertionDv: 0, stationKeepingDv: 6, naturalLifeYears: 20, solarDegradation: 0.025,
  },
  {
    id: 'geo',
    name: 'Geostationary orbit, 35,786 km',
    blurb: 'Hovers over one spot on Earth and watches it nonstop, but it is 90 times farther away, so images are blurry.',
    dest: 'geo', comms: 'geo', altitudeKm: 35786, periodMin: 1436, eclipseMin: 72,
    revisitPerSat: 96,
    quality: { thermal: 0.45, optical: 0.4, spectral: 0.35, sounder: 0.9, hires: 0.15 },
    insertionDv: 0, stationKeepingDv: 50, naturalLifeYears: 0.5, solarDegradation: 0.02,
  },
  {
    id: 'moon-100',
    name: 'Lunar polar orbit, 100 km',
    blurb: 'Circles over both poles every 2 hours, so the whole Moon turns beneath you. A balanced choice.',
    dest: 'moon', comms: 'moon', altitudeKm: 100, periodMin: 118, eclipseMin: 48,
    revisitPerSat: 12,
    quality: { neutron: 0.8, spectral: 1, thermal: 1, laser: 1, uv: 1, radar: 1, optical: 1 },
    insertionDv: 850, stationKeepingDv: 60, naturalLifeYears: 0.8, solarDegradation: 0.03,
  },
  {
    id: 'moon-50',
    name: 'Low lunar orbit, 50 km',
    blurb: 'Skims the surface for the sharpest data. The Moon\'s lumpy gravity pulls you down, so it eats fuel.',
    dest: 'moon', comms: 'moon', altitudeKm: 50, periodMin: 113, eclipseMin: 47,
    revisitPerSat: 12,
    quality: { neutron: 1.35, spectral: 1.2, thermal: 1.2, laser: 1.25, uv: 1.15, radar: 1.15, optical: 1.25 },
    insertionDv: 900, stationKeepingDv: 160, naturalLifeYears: 0.2, solarDegradation: 0.03,
  },
  {
    id: 'moon-frozen',
    name: 'Frozen elliptical orbit, 30 x 200 km',
    blurb: 'A stretched orbit that dips low over the south pole and naturally stays put. Great for the pole, worse elsewhere.',
    dest: 'moon', comms: 'moon', altitudeKm: 115, periodMin: 125, eclipseMin: 45,
    revisitPerSat: 12,
    quality: { neutron: 1.1, spectral: 0.95, thermal: 1, laser: 0.9, uv: 1.05, radar: 1, optical: 0.9 },
    insertionDv: 950, stationKeepingDv: 10, naturalLifeYears: 6, solarDegradation: 0.03,
  },
]

export const ROCKETS: Rocket[] = [
  {
    id: 'rideshare', name: 'Rideshare slot',
    blurb: 'Share a big rocket with dozens of other satellites. Very cheap and reliable, but you go where they go: 600 km sun-synchronous only.',
    massKg: 0, costM: 3, reliability: 0.98,
    capacity: { leo: 0, sso: 180, geo: 0, moon: 0 }, onlyOrbits: ['sso-600'],
  },
  {
    id: 'small', name: 'Small launcher',
    blurb: 'A dedicated small rocket. Your own schedule and orbit, but a newer design with a shorter track record.',
    massKg: 0, costM: 8, reliability: 0.92,
    capacity: { leo: 320, sso: 220, geo: 0, moon: 35 },
  },
  {
    id: 'medium', name: 'Medium launcher',
    blurb: 'A proven workhorse rocket. Enough for most science missions, including small Moon missions.',
    massKg: 0, costM: 30, reliability: 0.97,
    capacity: { leo: 1600, sso: 1200, geo: 380, moon: 480 },
  },
  {
    id: 'heavy', name: 'Heavy launcher',
    blurb: 'Lifts almost anything, anywhere. Very reliable, very expensive.',
    massKg: 0, costM: 75, reliability: 0.985,
    capacity: { leo: 15000, sso: 12000, geo: 4500, moon: 5200 },
  },
]

export const BUSES: Bus[] = [
  {
    id: 'bus-small', name: 'Small satellite bus',
    blurb: 'Microwave-oven sized frame with the basic computer and wiring. Room for 2 instruments.',
    massKg: 35, costM: 9, basePowerW: 20, maxPayloadKg: 40, slots: 2,
  },
  {
    id: 'bus-medium', name: 'Medium bus',
    blurb: 'Fridge-sized. Room for 4 instruments and bigger subsystems.',
    massKg: 110, costM: 20, basePowerW: 45, maxPayloadKg: 120, slots: 4,
  },
  {
    id: 'bus-large', name: 'Large bus',
    blurb: 'Car-sized flagship frame. Room for 6 instruments, but heavy and power-hungry.',
    massKg: 320, costM: 42, basePowerW: 90, maxPayloadKg: 380, slots: 6,
  },
]

export const SOLAR: SolarArray[] = [
  { id: 'solar-body', name: 'Body-mounted cells', blurb: 'Solar cells glued to the sides. Light and simple, but little power.', massKg: 4, costM: 1.5, outputW: 110 },
  { id: 'solar-small', name: 'Small deployable wings', blurb: 'Two panels that unfold after launch.', massKg: 10, costM: 4, outputW: 280 },
  { id: 'solar-large', name: 'Large deployable wings', blurb: 'Big wings that track the Sun.', massKg: 24, costM: 9, outputW: 650 },
  { id: 'solar-xl', name: 'Extra-large wings', blurb: 'Flagship-class arrays for power-hungry payloads.', massKg: 48, costM: 16, outputW: 1400 },
]

export const BATTERIES: Battery[] = [
  { id: 'batt-150', name: '150 Wh battery', blurb: 'About two laptop batteries.', massKg: 1.5, costM: 0.8, capacityWh: 150 },
  { id: 'batt-400', name: '400 Wh battery', blurb: 'Small lithium-ion pack.', massKg: 4, costM: 1.5, capacityWh: 400 },
  { id: 'batt-1000', name: '1,000 Wh battery', blurb: 'Mid-size pack for bigger spacecraft.', massKg: 9, costM: 3, capacityWh: 1000 },
  { id: 'batt-2500', name: '2,500 Wh battery', blurb: 'Large pack for long eclipses and heavy loads.', massKg: 22, costM: 6, capacityWh: 2500 },
]

export const ADCS: Adcs[] = [
  {
    id: 'adcs-mag', name: 'Magnetic torquers',
    blurb: 'Pushes against Earth\'s magnetic field. Cheap, but only points to about 2 degrees, and useless far from Earth.',
    massKg: 2, costM: 0.8, powerW: 3, accuracyDeg: 2, worksAt: ['leo', 'sso'],
  },
  {
    id: 'adcs-wheels', name: 'Reaction wheels + sun sensors',
    blurb: 'Spinning wheels turn the spacecraft precisely, to about 0.1 degree.',
    massKg: 8, costM: 4.5, powerW: 14, accuracyDeg: 0.1, worksAt: ['leo', 'sso', 'geo', 'moon'],
  },
  {
    id: 'adcs-star', name: 'Star trackers + wheels',
    blurb: 'Cameras that read the star field for pinpoint aim, to about 0.01 degree.',
    massKg: 12, costM: 8, powerW: 22, accuracyDeg: 0.01, worksAt: ['leo', 'sso', 'geo', 'moon'],
  },
]

export const PROPULSION: Propulsion[] = [
  { id: 'prop-none', name: 'No propulsion', blurb: 'Lightest and cheapest. You stay wherever the rocket leaves you until drag or gravity wins.', massKg: 0, costM: 0, deltaV: 0 },
  { id: 'prop-cold', name: 'Cold-gas thrusters', blurb: 'Puffs of compressed gas. Enough for small corrections.', massKg: 6, costM: 1.5, deltaV: 40 },
  { id: 'prop-mono', name: 'Hydrazine thrusters', blurb: 'Standard thruster system for holding an orbit for years.', massKg: 28, costM: 5, deltaV: 260 },
  { id: 'prop-biprop', name: 'Bipropellant engine', blurb: 'Big engine and tanks. Needed to brake into orbit around the Moon.', massKg: 120, costM: 13, deltaV: 1300 },
]

export const ANTENNAS: Antenna[] = [
  { id: 'ant-uhf', name: 'UHF radio', blurb: 'Like a walkie-talkie. Tiny data rate.', massKg: 1, costM: 0.4, powerW: 6, rateMbps: { earth: 0.1, geo: 0.01, moon: 0 } },
  { id: 'ant-s', name: 'S-band patch', blurb: 'Reliable, low-rate link. Fine for small data loads.', massKg: 2, costM: 1.5, powerW: 15, rateMbps: { earth: 4, geo: 1, moon: 0.1 } },
  { id: 'ant-x', name: 'X-band antenna', blurb: 'The standard science downlink. Fast near Earth.', massKg: 5, costM: 4, powerW: 30, rateMbps: { earth: 150, geo: 25, moon: 2 } },
  { id: 'ant-ka', name: 'Ka-band high-gain dish', blurb: 'A pointed dish with a very fast link. Needed for lots of data from far away.', massKg: 16, costM: 11, powerW: 55, rateMbps: { earth: 500, geo: 150, moon: 40 } },
]

export const NETWORKS: GroundNetwork[] = [
  { id: 'gs-uni', name: 'University ground station', blurb: 'One dish on campus. You hear the spacecraft only when it flies overhead.', costPerYearM: 0.5, contactMin: { earth: 30, geo: 1440, moon: 0 } },
  { id: 'gs-commercial', name: 'Commercial station network', blurb: 'Rent time on dishes around the world. Many more passes per day.', costPerYearM: 2, contactMin: { earth: 110, geo: 1440, moon: 0 } },
  { id: 'gs-nsn', name: 'NASA Near Space Network', blurb: 'NASA\'s global stations plus relay satellites. Lots of contact near Earth.', costPerYearM: 4, contactMin: { earth: 220, geo: 1440, moon: 0 } },
  { id: 'gs-dsn', name: 'Deep Space Network', blurb: 'Giant 34 m and 70 m dishes in California, Spain and Australia. The only way to hear faint signals from deep space.', costPerYearM: 6, contactMin: { earth: 0, geo: 0, moon: 480 } },
]

export const STORAGE: Storage[] = [
  { id: 'store-16', name: '16 GB recorder', blurb: 'About a phone\'s worth.', massKg: 0.5, costM: 0.3, capacityGB: 16 },
  { id: 'store-64', name: '64 GB recorder', blurb: 'Holds a few days of moderate data.', massKg: 1, costM: 0.8, capacityGB: 64 },
  { id: 'store-256', name: '256 GB recorder', blurb: 'Room to ride out outages.', massKg: 2, costM: 1.8, capacityGB: 256 },
  { id: 'store-1000', name: '1 TB recorder', blurb: 'Flagship-class storage.', massKg: 3.5, costM: 4, capacityGB: 1000 },
]

export const REDUNDANCY = { massKg: 6, costM: 4, powerW: 6 }

export const byId = <T extends { id: string }>(list: T[], id: string): T => {
  const found = list.find((x) => x.id === id)
  if (!found) throw new Error(`Unknown part: ${id}`)
  return found
}

/** Simulation constants, gathered so they are easy to tune. */
export const RULES = {
  /** Usable fraction of battery capacity before it is damaged. */
  maxDepthOfDischarge: 0.6,
  /** Fraction of solar output reaching loads after charging losses. */
  chargeEfficiency: 0.9,
  /** Fraction of contact time that actually moves science data. */
  linkEfficiency: 0.8,
  /** Average fraction of planned downlink that works on a real day (missed passes, weather). */
  realWorldDownlink: 0.9,
  /** Duplicate satellites cost this fraction of the first one (production learning curve). */
  repeatUnitCost: 0.7,
  /** Science bonus per extra satellite (more looks at the target). */
  constellationBonus: 0.35,
  /** Cost of running over the design timer: $M per minute ("standing army" cost). */
  overtimeCostPerMin: 2,
  /** Science quality when the pointing system is too coarse for an instrument. */
  badPointingQuality: 0.45,
}
