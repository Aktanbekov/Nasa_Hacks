// Story briefings shown before each mission: a few illustrated scenes told by
// characters, then the mission goal, then how to play. Characters are fictional.

export type SceneId = 'fire-night' | 'fire-command' | 'mission-control' | 'orbit-earth' | 'moon-pole' | 'moon-base' | 'dsn'
export type CharacterId = 'director' | 'chief' | 'planner'

export interface Character { id: CharacterId; name: string; title: string; color: string }

export const CHARACTERS: Record<CharacterId, Character> = {
  director: { id: 'director', name: 'Sam Okafor', title: 'Flight Director, Mission Control', color: '#f5b544' },
  chief: { id: 'chief', name: 'Chief Maya Ortiz', title: 'Incident Commander, state fire service', color: '#ff7a45' },
  planner: { id: 'planner', name: 'Dr. Lena Park', title: 'Lunar base planner', color: '#7aa7ff' },
}

export type Slide =
  | { kind: 'scene'; art: SceneId; chapter: string; speaker?: CharacterId; text: string }
  | { kind: 'goal' }
  | { kind: 'howto' }

export const STORIES: Record<string, Slide[]> = {
  wildfire: [
    {
      kind: 'scene', art: 'fire-night', chapter: 'Last summer · Sierra Nevada foothills',
      text: 'At 2:14 a.m., a power line sparked in a dry canyon. Nobody saw it. By sunrise the fire had crossed two ridgelines and was moving faster than the crews could follow.',
    },
    {
      kind: 'scene', art: 'fire-command', chapter: 'Fire command center', speaker: 'chief',
      text: 'Our lookout towers and spotter planes can\'t watch every canyon all night. By the time we see the smoke, we\'re already behind. I need eyes in orbit that catch a fire in its first hours, and look again before the wind shifts.',
    },
    {
      kind: 'scene', art: 'mission-control', chapter: 'Mission Control', speaker: 'director',
      text: 'The agency just approved a new Earth-watching mission: $150 million and three years in orbit. That\'s where you come in. Your team has ten minutes to design it. After that, every extra minute costs us money.',
    },
    {
      kind: 'scene', art: 'orbit-earth', chapter: 'One rule above all', speaker: 'director',
      text: 'Remember this: science only counts when it reaches the ground. The best camera in the world is worthless if we can\'t power it, can\'t send its pictures home, or the spacecraft dies early. Every choice you make pulls on the others.',
    },
    { kind: 'goal' },
    { kind: 'howto' },
  ],
  'lunar-ice': [
    {
      kind: 'scene', art: 'moon-pole', chapter: '2032 · The lunar south pole',
      text: 'Near the Moon\'s south pole, some craters are so deep that sunlight has never touched their floors. They stay colder than −200 °C, cold enough to trap ice for billions of years.',
    },
    {
      kind: 'scene', art: 'moon-base', chapter: 'Planning the first base', speaker: 'planner',
      text: 'Astronauts are coming to stay, and every liter of water we launch from Earth is enormously expensive. Ice on the Moon means drinking water, oxygen to breathe, and rocket fuel. Tell us where the ice is, and we\'ll know where to build.',
    },
    {
      kind: 'scene', art: 'mission-control', chapter: 'Mission Control', speaker: 'director',
      text: 'You have $250 million and two years in lunar orbit. Getting there is the hard part: the rocket only sends you toward the Moon. Your spacecraft needs its own engine to brake into orbit, or it sails right past.',
    },
    {
      kind: 'scene', art: 'dsn', chapter: 'Calling home from 384,000 km', speaker: 'director',
      text: 'Out there, only the Deep Space Network\'s giant dishes can hear you, and the signal is faint. Science only counts when it reaches the ground. Find the ice, send the data home, and keep the spacecraft alive for two full years.',
    },
    { kind: 'goal' },
    { kind: 'howto' },
  ],
}
