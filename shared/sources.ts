// Where the game's numbers come from. Every part, orbit and rocket links to a
// short, honest note: what real system it is modelled on, and what is simplified.

export interface Source { id: string; title: string; org: string; url: string; usedFor: string }

export const SOURCES: Source[] = [
  { id: 'landsat9', title: 'Landsat 9 mission facts', org: 'NASA / USGS', url: 'https://science.nasa.gov/mission/landsat-9', usedFor: '705 km sun-synchronous orbit, 30 m color and 100 m thermal resolution, 16-day revisit, 5-year design life.' },
  { id: 'firms-faq', title: 'FIRMS frequently asked questions', org: 'NASA Earthdata', url: 'https://www.earthdata.nasa.gov/data/tools/firms/faq', usedFor: 'MODIS fire pixels ~1 km and routine detection of ~1,000 m² fires; VIIRS 375 m pixels; MODIS sees most places at least 4 times a day.' },
  { id: 'goes', title: 'GOES-R Fire/Hot Spot Characterization', org: 'NOAA / NASA', url: 'https://www.goes-r.gov/products/baseline-fire-hot-spot.html', usedFor: 'Geostationary fire detection on a 2 km grid, every 5 minutes over the continental US.' },
  { id: 'ecostress', title: 'ECOSTRESS', org: 'NASA JPL', url: 'https://ecostress.jpl.nasa.gov/', usedFor: 'Thermal infrared instrument flying at Space Station altitude (~400 km).' },
  { id: 'emit', title: 'EMIT imaging spectrometer', org: 'NASA JPL', url: 'https://earth.jpl.nasa.gov/emit/', usedFor: 'Hyperspectral imager on the Space Station.' },
  { id: 'tempo', title: 'TEMPO air quality mission', org: 'NASA / Smithsonian', url: 'https://tempo.si.edu/', usedFor: 'Hourly pollution and smoke measurements over North America from geostationary orbit.' },
  { id: 'lro', title: 'Lunar Reconnaissance Orbiter', org: 'NASA', url: 'https://science.nasa.gov/mission/lro/', usedFor: '~50 km polar orbit, later a fuel-saving elliptical orbit; LEND, Diviner, LAMP, LOLA, LROC, Mini-RF instruments; Ka-band science downlink (~100 Mbps).' },
  { id: 'lunar-prospector', title: 'Lunar Prospector', org: 'NASA', url: 'https://science.nasa.gov/mission/lunar-prospector/', usedFor: 'Neutron spectrometer that first mapped extra hydrogen at the lunar poles.' },
  { id: 'trailblazer', title: 'Lunar Trailblazer', org: 'NASA / Caltech', url: 'https://science.nasa.gov/mission/lunar-trailblazer/', usedFor: 'Small satellite with an infrared spectrometer and thermal mapper for lunar water.' },
  { id: 'soa-comms', title: 'State-of-the-Art of Small Spacecraft Technology: Communications', org: 'NASA Small Spacecraft Systems Virtual Institute', url: 'https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/', usedFor: 'Radio data rates: UHF ~9.6–38 kbps, S-band up to ~15 Mbps demonstrated, X-band and Ka-band hundreds of Mbps and above.' },
  { id: 'soa-gnc', title: 'State-of-the-Art of Small Spacecraft Technology: Guidance, Navigation & Control', org: 'NASA Small Spacecraft Systems Virtual Institute', url: 'https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control', usedFor: 'Pointing accuracy of reaction wheels and star trackers on small spacecraft.' },
  { id: 'cubesat101', title: 'CubeSat 101: Basic Concepts and Processes', org: 'NASA CubeSat Launch Initiative', url: 'https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf', usedFor: 'Mission phases, design reviews, and the systems a small satellite needs.' },
  { id: 'dsn', title: 'Deep Space Network', org: 'NASA', url: 'https://www.nasa.gov/communicating-with-missions/dsn/', usedFor: 'Goldstone, Madrid and Canberra complexes with 70 m and 34 m dishes, spaced so one can always see a distant spacecraft.' },
  { id: 'design-guide', title: 'Design and Develop Science Missions', org: 'NASA', url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf', usedFor: 'The launch, space, ground and user segments the game is built around.' },
  { id: 'rideshare', title: 'SpaceX Rideshare program', org: 'SpaceX (prices as reported in 2025–26 press)', url: 'https://rideshare.spacex.com/', usedFor: 'Rideshare to sun-synchronous orbit, reported at about $350k for 50 kg plus ~$7k per extra kg.' },
  { id: 'electron', title: 'Electron launch vehicle', org: 'Rocket Lab (price as reported in press)', url: 'https://rocketlabcorp.com/launch/electron/', usedFor: 'Small launcher for up to ~300 kg to low Earth orbit; reported price around $7.5M.' },
  { id: 'svs-earth', title: 'Equirectangular Projected Earth (Blue Marble Next Generation)', org: 'NASA Goddard Scientific Visualization Studio', url: 'https://svs.gsfc.nasa.gov/3615', usedFor: 'The 3D Earth surface and real cloud layer. Blue Marble data courtesy of Reto Stöckli (NASA/GSFC) and NASA\'s Earth Observatory.' },
  { id: 'svs-moon', title: 'CGI Moon Kit (LRO LROC color + LOLA)', org: 'NASA Goddard Scientific Visualization Studio', url: 'https://svs.gsfc.nasa.gov/4720', usedFor: 'The 3D Moon, made from Lunar Reconnaissance Orbiter camera and laser altimeter data.' },
  { id: 'wfigs', title: 'WFIGS Incident Locations (Wildland Fire Interagency Geospatial Services)', org: 'National Interagency Fire Center', url: 'https://data-nifc.opendata.arcgis.com/', usedFor: 'Real California wildfires in the fire replay: discovery time, origin point, size and cause.' },
  { id: 'firms', title: 'Fire Information for Resource Management System (FIRMS)', org: 'NASA LANCE / Earthdata', url: 'https://firms.modaps.eosdis.nasa.gov/', usedFor: 'Live active-fire detections from MODIS and VIIRS shown in the game.' },
]

/** NASA resources from the challenge page, for players who want to go deeper. */
export const RESOURCES = [
  { title: 'General Mission Analysis Tool (GMAT)', url: 'https://software.nasa.gov/software/GSC-19468-1', why: 'NASA\'s open-source orbit design tool. Check the game\'s orbit periods and eclipse times with it.' },
  { title: 'NASA Mission Viz', url: 'https://nasa.github.io/mission-viz/', why: 'Explore real mission trajectories in 3D.' },
  { title: 'Concept Maturity Levels (JPL)', url: 'https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299', why: 'How JPL grows a mission idea into a design. The game covers roughly the first levels.' },
  { title: 'Mission Design Lab (Goddard)', url: 'https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/', why: 'Where NASA engineers run concurrent design sessions like this game\'s design phase.' },
  { title: 'Design and Develop Science Missions', url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf', why: 'The systems-engineering process behind science missions.' },
  { title: 'CubeSat 101', url: 'https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf', why: 'A practical guide for first-time small-satellite teams.' },
  { title: 'Build a telescope (Webb game)', url: 'https://science.nasa.gov/mission/webb/game-build-it-yourself/', why: 'NASA\'s own design-a-mission learning game.' },
]

export interface Basis { note: string; sources: string[] }

/** Real-world basis for each catalog item. */
export const BASIS: Record<string, Basis> = {
  // orbits
  'leo-400': { note: 'Space Station altitude, where ECOSTRESS and EMIT fly. Drag pulls orbits this low down without regular boosts.', sources: ['ecostress', 'emit'] },
  'sso-600': { note: 'The classic Earth-observing orbit. Landsat 9 and Terra/Aqua fly sun-synchronous at 705 km. Period and eclipse length come from circular-orbit math.', sources: ['landsat9', 'firms-faq'] },
  geo: { note: 'GOES-R watches the US from geostationary orbit, mapping fires on a 2 km grid every 5 minutes, but only larger fires show up at that resolution.', sources: ['goes'] },
  'moon-100': { note: 'Lunar Prospector and LRO both used low polar orbits so the whole Moon turns beneath them.', sources: ['lunar-prospector', 'lro'] },
  'moon-50': { note: 'LRO\'s main mapping orbit was about 50 km. Uneven lunar gravity means it needs frequent fuel burns.', sources: ['lro'] },
  'moon-frozen': { note: 'LRO later moved to an elliptical "frozen" orbit that stays stable with very little fuel.', sources: ['lro'] },
  // rockets
  rideshare: { note: 'Like SpaceX\'s Transporter rideshares: cheap per kilogram, but you go to the orbit they choose. Priced from reported 2026 rates.', sources: ['rideshare'] },
  small: { note: 'Like Rocket Lab\'s Electron: about 300 kg to low orbit, roughly $7.5M (reported). Reliability is a game value.', sources: ['electron'] },
  medium: { note: 'A simplified mid-size launcher. Capacity, price and reliability are illustrative game values.', sources: [] },
  heavy: { note: 'A simplified large launcher, far bigger than these missions need. Values are illustrative.', sources: [] },
  // spacecraft
  'adcs-mag': { note: 'Magnetic torquers push against Earth\'s magnetic field: cheap but coarse, and useless far from Earth.', sources: ['soa-gnc'] },
  'adcs-wheels': { note: 'Reaction wheels with sun sensors. The game uses 0.1°, a conservative small-satellite value.', sources: ['soa-gnc'] },
  'adcs-star': { note: 'Integrated star-tracker units on small satellites reach a few thousandths of a degree (NASA report). The game uses 0.01°.', sources: ['soa-gnc'] },
  'ant-uhf': { note: 'Small-satellite UHF radios run at about 9.6–38 kbps.', sources: ['soa-comms'] },
  'ant-s': { note: 'S-band: NASA\'s Near Space Network demonstrated 15 Mbps from a small satellite. The game uses a conservative 4 Mbps.', sources: ['soa-comms'] },
  'ant-x': { note: 'X-band transmitters for small satellites advertise hundreds of Mbps and more. The game uses 150 Mbps near Earth.', sources: ['soa-comms'] },
  'ant-ka': { note: 'Ka-band: LRO sends its science data home at about 100 Mbps; a 3U CubeSat demo topped 100 Mbps.', sources: ['lro', 'soa-comms'] },
  'gs-dsn': { note: 'The Deep Space Network\'s 70 m and 34 m dishes in California, Spain and Australia keep in touch as Earth turns.', sources: ['dsn'] },
  'gs-uni': { note: 'One station sees a low-orbit satellite only on a few short passes a day. 30 min/day is a game estimate.', sources: [] },
  'gs-commercial': { note: 'Commercial networks sell pay-per-pass time on stations worldwide. Contact time is a game estimate.', sources: ['soa-comms'] },
  'gs-nsn': { note: 'NASA\'s Near Space Network combines ground stations and relay satellites. Contact time is a game estimate.', sources: ['soa-comms'] },
  // wildfire instruments
  'thermal-ir': { note: 'Modelled on thermal cameras like Landsat 9\'s TIRS-2 (100 m pixels) and ECOSTRESS.', sources: ['landsat9', 'ecostress'] },
  swir: { note: 'Fire detection uses short- and mid-wave infrared. From 705 km, MODIS routinely spots fires of about 1,000 m².', sources: ['firms-faq'] },
  'visible-cam': { note: 'Like Landsat 9\'s OLI-2 color imager (30 m pixels), used for burn-scar maps.', sources: ['landsat9'] },
  sounder: { note: 'Like TEMPO, which measures smoke and pollution over North America every hour.', sources: ['tempo'] },
  hyperspectral: { note: 'Like EMIT on the Space Station, which splits light into hundreds of colors.', sources: ['emit'] },
  'hires-cam': { note: 'A generic high-resolution camera. Values are illustrative.', sources: [] },
  // lunar instruments
  neutron: { note: 'Like Lunar Prospector\'s neutron spectrometer and LRO\'s LEND, which map hydrogen near the poles.', sources: ['lunar-prospector', 'lro'] },
  'ir-spec': { note: 'Like Lunar Trailblazer\'s infrared spectrometer, built to map surface water.', sources: ['trailblazer'] },
  'uv-spec': { note: 'Like LRO\'s LAMP, which searches dark polar craters for frost in ultraviolet.', sources: ['lro'] },
  radiometer: { note: 'Like LRO\'s Diviner, which measures surface temperature to find cold traps.', sources: ['lro'] },
  'laser-alt': { note: 'Like LRO\'s LOLA laser altimeter, which mapped the Moon\'s shape, including shadowed craters.', sources: ['lro'] },
  radar: { note: 'Like LRO\'s Mini-RF radar, built to look for ice beneath the surface.', sources: ['lro'] },
  'wide-cam': { note: 'Like LRO\'s camera system (LROC).', sources: ['lro'] },
}

/** Simplifications we make on purpose, stated plainly. */
export const ASSUMPTIONS = [
  'Orbit periods and eclipse lengths use simple circular-orbit math. You can check them in NASA GMAT.',
  'Downlink per day = data rate × contact minutes × 80% link efficiency. Real days average 90% of plan (missed passes, weather).',
  'Solar cells lose 2–3% of their output per year, a conservative figure. Using more than 40% of the battery each orbit wears it out faster.',
  'Instrument mass, power and cost are rounded so the trade-offs stay visible. They match real instruments in proportion, not exactly.',
  'Extra satellites cost 70% of the first (a production learning curve). That is a game assumption.',
  'Launch reliability, event odds and science points are game values, chosen to make the trade-offs matter.',
  'Flight-math burns ignore fuel use during the burn (the rocket equation) to keep the math to one division.',
  'The fire replay uses real fires (time, place, size), but whether your design would have seen them is a simplified model: looks per day, pixel size, and instrument type.',
]

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id)
