// Cinematic story illustrations (960x540) and character portraits.
// Pure SVG with CSS animation: flames flicker, smoke drifts, screens blink.
import type { CharacterId, SceneId } from './story.ts'

const W = 960
const H = 540

function rng(seed: number) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
}

function Stars({ n = 90, seed = 3, maxY = H * 0.6 }: { n?: number; seed?: number; maxY?: number }) {
  const r = rng(seed)
  return <g>{Array.from({ length: n }).map((_, i) => <circle key={i} className={i % 7 === 0 ? 'twinkle' : undefined} style={{ animationDelay: `${r() * 3}s` }} cx={r() * W} cy={r() * maxY} r={r() * 1.3 + 0.3} fill="#fff" opacity={0.3 + r() * 0.6} />)}</g>
}

/** Mountain ridge silhouette from seeded noise. */
function ridge(seed: number, base: number, amp: number, step = 40) {
  const r = rng(seed)
  let d = `M0 ${H} L0 ${base}`
  let y = base
  for (let x = 0; x <= W + step; x += step) {
    y = Math.max(base - amp, Math.min(base + amp * 0.3, y + (r() - 0.55) * amp * 0.6))
    d += ` L${x} ${y.toFixed(1)}`
  }
  return d + ` L${W} ${H} Z`
}

// California outline (lon/lat to 0..1 box), for the fire map.
const CA: [number, number][] = [[-124.2, 42], [-120, 42], [-120, 39], [-114.6, 35], [-114.7, 32.7], [-117.1, 32.5], [-118.5, 34], [-120.6, 34.5], [-121.9, 36.6], [-122.5, 37.8], [-123.8, 39.5], [-124.4, 40.4]]
const caPath = (x: number, y: number, w: number, h: number) => 'M' + CA.map(([lo, la]) => `${(x + ((lo + 124.5) / 10.5) * w).toFixed(1)} ${(y + ((42 - la) / 9.5) * h).toFixed(1)}`).join(' L') + ' Z'

function FireNight() {
  const r = rng(9)
  return (
    <g>
      <defs>
        <linearGradient id="fn-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#090a1f" /><stop offset=".55" stopColor="#2b1430" /><stop offset=".8" stopColor="#7a2a1c" /><stop offset="1" stopColor="#d4541f" /></linearGradient>
        <radialGradient id="fn-glow" cx="50%" cy="100%" r="60%"><stop offset="0" stopColor="#ff8a2a" stopOpacity=".8" /><stop offset="1" stopColor="#ff8a2a" stopOpacity="0" /></radialGradient>
        <filter id="fn-blur"><feGaussianBlur stdDeviation="14" /></filter>
        <filter id="fn-soft"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      <rect width={W} height={H} fill="url(#fn-sky)" />
      <Stars n={70} maxY={H * 0.45} />
      {/* a satellite gliding overhead, unseen by anyone below */}
      <g className="sat-pass"><circle r="2.2" fill="#fff" /><circle r="6" fill="#fff" opacity=".15" /></g>
      {/* smoke */}
      <g filter="url(#fn-blur)" opacity=".75">
        {Array.from({ length: 10 }).map((_, i) => <circle key={i} className="smoke" style={{ animationDelay: `${i * 0.9}s` }} cx={430 + i * 38} cy={300 - i * 18} r={60 + i * 9} fill="#3b2b2e" />)}
      </g>
      <ellipse cx="560" cy="420" rx="420" ry="160" fill="url(#fn-glow)" />
      <path d={ridge(5, 330, 60, 48)} fill="#1a1020" />
      {/* fire line along the middle ridge */}
      <g filter="url(#fn-soft)">
        {Array.from({ length: 34 }).map((_, i) => {
          const x = 300 + i * 16 + r() * 8
          const y = 392 - Math.sin(i / 5) * 14 - r() * 10
          const h = 22 + r() * 40
          return <path key={i} className="flame-lick" style={{ animationDelay: `${r()}s`, transformOrigin: `${x}px ${y}px` }} d={`M${x - 9} ${y} Q${x - 4} ${y - h * 0.6} ${x} ${y - h} Q${x + 5} ${y - h * 0.5} ${x + 9} ${y} Z`} fill={i % 3 ? '#ff7a2a' : '#ffc14d'} />
        })}
      </g>
      <path d={ridge(11, 400, 40, 36)} fill="#120a14" />
      {/* embers */}
      {Array.from({ length: 26 }).map((_, i) => <circle key={i} className="ember" style={{ animationDelay: `${r() * 4}s`, animationDuration: `${3 + r() * 3}s` }} cx={340 + r() * 480} cy={400} r={1.5 + r() * 1.5} fill="#ffcf6b" />)}
      {/* power line tower */}
      <g stroke="#06040a" strokeWidth="4" fill="none">
        <path d="M150 470 L180 300 L210 470 M160 410 h40 M168 360 h24 M140 320 h80" />
        <path d="M140 320 Q300 360 520 330 M220 320 Q420 370 700 340" strokeWidth="1.5" />
      </g>
      <path d={ridge(21, 470, 26, 30)} fill="#07050a" />
    </g>
  )
}

function FireCommand() {
  return (
    <g>
      <defs>
        <linearGradient id="fc-room" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1424" /><stop offset="1" stopColor="#05080f" /></linearGradient>
        <radialGradient id="fc-screen" cx="50%" cy="50%" r="70%"><stop offset="0" stopColor="#13304d" /><stop offset="1" stopColor="#0a1626" /></radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#fc-room)" />
      {/* big wall map */}
      <rect x="150" y="50" width="660" height="330" rx="10" fill="url(#fc-screen)" stroke="#2e4a6e" strokeWidth="3" />
      <g opacity=".35" stroke="#3d6d9c" strokeWidth="1">{Array.from({ length: 12 }).map((_, i) => <line key={i} x1={150 + i * 55} y1="50" x2={150 + i * 55} y2="380" />)}{Array.from({ length: 6 }).map((_, i) => <line key={i} x1="150" y1={50 + i * 55} x2="810" y2={50 + i * 55} />)}</g>
      <path d={caPath(330, 70, 300, 290)} fill="#1d3b2a" stroke="#62d39a" strokeWidth="2" />
      {[[420, 150, 18], [455, 175, 10], [520, 250, 8], [470, 210, 6], [560, 300, 12]].map(([x, y, s], i) => (
        <g key={i}><circle cx={x} cy={y} r={s} fill="#ff5a36" opacity=".85" /><circle className="ping" style={{ animationDelay: `${i * 0.4}s`, transformOrigin: `${x}px ${y}px` }} cx={x} cy={y} r={s} fill="none" stroke="#ff7a45" strokeWidth="2" /></g>
      ))}
      <text x="170" y="80" fill="#9cc1ff" fontFamily="IBM Plex Mono" fontSize="14">ACTIVE INCIDENTS · 5</text>
      <text x="170" y="100" fill="#ff9b7a" fontFamily="IBM Plex Mono" fontSize="12" className="blink-slow">LAST SATELLITE PASS: 11 h AGO</text>
      {/* side screens */}
      {[40, 830].map((x) => <g key={x}><rect x={x} y="110" width="90" height="140" rx="6" fill="#0e1b2e" stroke="#2e4a6e" strokeWidth="2" />{[0, 1, 2, 3].map((k) => <rect key={k} x={x + 10} y={125 + k * 28} width={60 - k * 8} height="10" fill="#3ccf9e" opacity=".55" />)}</g>)}
      {/* desks and people silhouettes */}
      <rect x="0" y="420" width={W} height="120" fill="#0a0f1a" />
      {[160, 390, 620].map((x, i) => (
        <g key={x}>
          <rect x={x} y="395" width="170" height="30" rx="4" fill="#141c2c" />
          <rect x={x + 20} y="360" width="60" height="40" rx="3" fill="#0f2238" stroke="#2e4a6e" /><rect x={x + 90} y="360" width="60" height="40" rx="3" fill="#0f2238" stroke="#2e4a6e" />
          <rect x={x + 26} y="366" width="48" height="4" fill="#ff7a45" opacity=".7" className={i === 1 ? 'blink-slow' : undefined} />
          <circle cx={x + 85} cy="440" r="20" fill="#04060b" /><path d={`M${x + 50} 540 Q${x + 50} 462 ${x + 85} 460 Q${x + 120} 462 ${x + 120} 540 Z`} fill="#04060b" />
        </g>
      ))}
    </g>
  )
}

function MissionControl() {
  const track = (phase: number, amp: number) => {
    let d = ''
    for (let x = 0; x <= 600; x += 10) d += `${x === 0 ? 'M' : 'L'}${180 + x} ${170 + Math.sin((x / 600) * Math.PI * 4 + phase) * amp}`
    return d
  }
  return (
    <g>
      <defs>
        <linearGradient id="mc-room" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b1222" /><stop offset="1" stopColor="#04070e" /></linearGradient>
        <linearGradient id="mc-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7aa7ff" stopOpacity=".25" /><stop offset="1" stopColor="#7aa7ff" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#mc-room)" />
      <rect x="150" y="40" width="660" height="260" rx="8" fill="#0a1830" stroke="#2e4a6e" strokeWidth="3" />
      {/* world map blobs */}
      <g fill="#1d3b5a">
        <path d="M200 110 q60 -30 120 0 q20 40 -30 70 q-50 10 -70 40 q-30 -40 -20 -110z" /><path d="M300 210 q30 -10 40 30 q-10 50 -30 60 q-20 -40 -10 -90z" />
        <path d="M440 100 q80 -40 200 -10 q40 30 -20 60 q-60 0 -80 30 q-40 -20 -100 -80z" /><path d="M470 170 q40 0 50 50 q-20 50 -40 40 q-20 -40 -10 -90z" /><path d="M660 220 q40 -10 60 10 q-10 30 -50 20z" />
      </g>
      <path d={track(0, 70)} fill="none" stroke="#f5b544" strokeWidth="2" strokeDasharray="6 5" />
      <path d={track(1.6, 70)} fill="none" stroke="#f5b54466" strokeWidth="2" strokeDasharray="6 5" />
      <circle className="track-dot" r="6" fill="#f5b544"><animateMotion dur="9s" repeatCount="indefinite" path={track(0, 70)} /></circle>
      <text x="170" y="66" fill="#9cc1ff" fontFamily="IBM Plex Mono" fontSize="14">MISSION DESIGN · NEW START</text>
      <text x="790" y="66" textAnchor="end" fill="#3ccf9e" fontFamily="IBM Plex Mono" fontSize="14" className="blink-slow">● GO</text>
      <rect x="0" y="300" width={W} height="240" fill="url(#mc-glow)" />
      {/* console rows */}
      {[0, 1].map((row) => (
        <g key={row} transform={`translate(0 ${360 + row * 90})`}>
          <path d={`M${40 - row * 40} 40 L${920 + row * 40} 40 L${900 + row * 40} 0 L${60 - row * 40} 0 Z`} fill={row ? '#0d1424' : '#121b2e'} />
          {Array.from({ length: 7 + row }).map((_, i) => {
            const x = 80 - row * 30 + i * (115 + row * 6)
            return <g key={i}><rect x={x} y="-34" width="80" height="34" rx="3" fill="#0f2238" stroke="#2e4a6e" /><rect x={x + 8} y="-26" width={30 + ((i * 13) % 34)} height="5" fill={i % 3 ? '#7aa7ff' : '#3ccf9e'} opacity=".7" /><rect x={x + 8} y="-16" width={20 + ((i * 7) % 40)} height="5" fill="#f5b544" opacity=".5" /></g>
          })}
        </g>
      ))}
      {[260, 500, 700].map((x) => <g key={x}><circle cx={x} cy="420" r="18" fill="#03050a" /><path d={`M${x - 32} 470 Q${x - 30} 440 ${x} 438 Q${x + 30} 440 ${x + 32} 470 Z`} fill="#03050a" /></g>)}
    </g>
  )
}

function OrbitEarth() {
  return (
    <g>
      <defs>
        <radialGradient id="oe-earth" cx="50%" cy="0%" r="100%"><stop offset="0" stopColor="#3f86e8" /><stop offset=".5" stopColor="#164a9e" /><stop offset="1" stopColor="#081a3d" /></radialGradient>
        <radialGradient id="oe-atmo" cx="50%" cy="100%" r="70%"><stop offset=".78" stopColor="#7ab8ff" stopOpacity="0" /><stop offset=".86" stopColor="#7ab8ff" stopOpacity=".7" /><stop offset="1" stopColor="#7ab8ff" stopOpacity="0" /></radialGradient>
        <radialGradient id="oe-sun" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#fff" /><stop offset=".2" stopColor="#ffe9b0" stopOpacity=".9" /><stop offset="1" stopColor="#ffb347" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={W} height={H} fill="#02040a" />
      <Stars n={140} seed={8} maxY={H * 0.7} />
      <g transform="translate(0 -90)">
      <ellipse cx="480" cy="1240" rx="1100" ry="900" fill="url(#oe-atmo)" />
      <ellipse cx="480" cy="1250" rx="1050" ry="860" fill="url(#oe-earth)" />
      <g opacity=".85" fill="#3e8f4f"><path d="M120 470 q120 -60 260 -40 q60 20 40 80 h-320z" /><path d="M560 430 q120 -30 260 10 q40 40 20 100 h-300z" /></g>
      <g fill="#fff" opacity=".55"><path d="M60 450 q80 -12 160 -4" stroke="#fff" strokeWidth="9" strokeLinecap="round" /><path d="M430 420 q90 -14 200 0" stroke="#fff" strokeWidth="7" strokeLinecap="round" /><path d="M700 470 q70 -10 160 0" stroke="#fff" strokeWidth="10" strokeLinecap="round" /></g>
      <circle className="sun-flare" cx="140" cy="372" r="90" fill="url(#oe-sun)" />
      </g>
      {/* satellite silhouette in the foreground */}
      <g className="float-sat" transform="translate(640 170) rotate(-12)">
        <rect x="-150" y="-26" width="110" height="52" fill="#1a2f6b" stroke="#0a0f1c" strokeWidth="3" />
        <rect x="40" y="-26" width="110" height="52" fill="#1a2f6b" stroke="#0a0f1c" strokeWidth="3" />
        {[-125, -95, -65, 65, 95, 125].map((x) => <line key={x} x1={x} y1="-26" x2={x} y2="26" stroke="#4f7ad1" strokeWidth="1.5" />)}
        <line x1="-40" y1="0" x2="40" y2="0" stroke="#93a0bd" strokeWidth="4" />
        <rect x="-34" y="-38" width="68" height="76" rx="4" fill="#d6a744" stroke="#0a0f1c" strokeWidth="3" />
        <path d="M-30 -10 l20 6 l26 -8 M-28 18 l24 -6 l22 8" stroke="#a07a2c" strokeWidth="2" fill="none" />
        <circle cx="0" cy="48" r="12" fill="#2a3450" stroke="#0a0f1c" strokeWidth="3" /><circle cx="0" cy="48" r="6" fill="#ff7a45" />
        <path d="M0 -38 v-18 M-16 -62 q16 14 32 0" stroke="#e9edf6" strokeWidth="4" fill="none" />
      </g>
    </g>
  )
}

function MoonPole() {
  return (
    <g>
      <defs>
        <linearGradient id="mp-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9bfcc" /><stop offset="1" stopColor="#5d6577" /></linearGradient>
        <radialGradient id="mp-crater" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#05070d" /><stop offset=".8" stopColor="#0d111b" /><stop offset="1" stopColor="#3a4150" /></radialGradient>
      </defs>
      <rect width={W} height={H} fill="#010208" />
      <Stars n={160} seed={12} maxY={H * 0.55} />
      {/* Earth low on the horizon */}
      <g transform="translate(780 150)"><circle r="44" fill="#1e5fb8" /><path d="M-30 -10 q20 -24 46 -10 q6 22 -16 30 q-24 0 -30 -20z" fill="#3e8f4f" /><path d="M-44 0 a44 44 0 0 0 88 0 a40 44 0 0 1 -88 0z" fill="#000" opacity=".55" /></g>
      {/* lit rims and long shadows: sun skims the horizon from the left */}
      <g transform="translate(0 -120)">
      <path d="M0 330 L120 300 L240 318 L360 286 L520 312 L640 296 L800 320 L960 300 L960 700 L0 700 Z" fill="url(#mp-ground)" />
      <ellipse cx="470" cy="420" rx="330" ry="90" fill="url(#mp-crater)" />
      <path d="M140 420 Q470 300 800 420" stroke="#e7ebf3" strokeWidth="5" fill="none" opacity=".9" />
      <path d="M140 420 Q470 520 800 420" stroke="#2a3040" strokeWidth="3" fill="none" />
      {/* ice glints in the permanent dark */}
      {[[380, 430], [430, 445], [520, 438], [470, 425], [570, 450], [340, 450], [610, 432]].map(([x, y], i) => (
        <g key={i} className="glint" style={{ animationDelay: `${i * 0.5}s`, transformOrigin: `${x}px ${y}px` }}><path d={`M${x} ${y - 7} l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z`} fill="#bfe8ff" /></g>
      ))}
      <ellipse cx="160" cy="500" rx="80" ry="16" fill="#4b5263" /><ellipse cx="820" cy="510" rx="110" ry="20" fill="#4b5263" />
      <text x="470" y="400" textAnchor="middle" fill="#9cc1ff" fontFamily="IBM Plex Mono" fontSize="13" opacity=".8">permanently shadowed · −200 °C</text>
      </g>
    </g>
  )
}

function MoonBase() {
  return (
    <g>
      <defs>
        <linearGradient id="mb-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a9b0bf" /><stop offset="1" stopColor="#4f5668" /></linearGradient>
        <linearGradient id="mb-hab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2f4f8" /><stop offset="1" stopColor="#9aa3b8" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill="#010208" />
      <Stars n={130} seed={15} maxY={H * 0.5} />
      <g transform="translate(160 120)"><circle r="56" fill="#1e5fb8" /><path d="M-40 -14 q26 -30 60 -12 q8 28 -22 40 q-30 0 -38 -28z" fill="#3e8f4f" /><path d="M-56 0 a56 56 0 0 0 112 0 a50 56 0 0 1 -112 0z" fill="#000" opacity=".5" /></g>
      <path d="M0 360 Q240 330 480 352 T960 340 L960 540 L0 540 Z" fill="url(#mb-ground)" />
      {/* habitat modules */}
      <g stroke="#0a0f1c" strokeWidth="3">
        <rect x="360" y="300" width="200" height="70" rx="35" fill="url(#mb-hab)" />
        <path d="M560 370 v-60 a60 60 0 0 1 120 0 v60z" fill="url(#mb-hab)" />
        <rect x="300" y="330" width="60" height="30" rx="8" fill="#c9d2e6" />
        {[400, 440, 480, 520].map((x) => <circle key={x} cx={x} cy="335" r="7" fill="#ffd36e" className="blink-slow" style={{ animationDelay: `${x / 200}s` }} />)}
        <rect x="610" y="340" width="20" height="30" fill="#ffd36e" />
      </g>
      {/* solar tower + lander */}
      <g stroke="#0a0f1c" strokeWidth="3"><line x1="760" y1="372" x2="760" y2="220" stroke="#93a0bd" /><rect x="720" y="200" width="80" height="40" fill="#1a2f6b" /><line x1="760" y1="200" x2="760" y2="240" stroke="#4f7ad1" strokeWidth="2" /></g>
      <g stroke="#0a0f1c" strokeWidth="3" transform="translate(180 330)"><path d="M0 40 l20 -30 h50 l20 30" fill="none" stroke="#93a0bd" /><rect x="15" y="-30" width="60" height="42" rx="6" fill="#d6a744" /><path d="M30 -30 l15 -26 l15 26z" fill="#e9edf6" /></g>
      {/* astronaut */}
      <g transform="translate(520 400)" stroke="#0a0f1c" strokeWidth="2.5">
        <rect x="-16" y="-34" width="32" height="40" rx="10" fill="#eef1f7" /><rect x="-22" y="-30" width="10" height="26" rx="4" fill="#c9d2e6" />
        <circle cx="0" cy="-48" r="15" fill="#eef1f7" /><path d="M-10 -52 h20 v10 h-20z" fill="#f5b544" stroke="none" />
        <rect x="-14" y="6" width="11" height="26" rx="4" fill="#eef1f7" /><rect x="3" y="6" width="11" height="26" rx="4" fill="#eef1f7" />
        <path d="M16 -24 l18 10" /><rect x="30" y="-18" width="16" height="12" rx="2" fill="#7aa7ff" />
      </g>
      {/* water drop icon over the crater */}
      <g transform="translate(860 300)" className="bob"><path d="M0 -26 q20 26 0 40 q-20 -14 0 -40z" fill="#7ad0ff" stroke="#0a0f1c" strokeWidth="2.5" /><text y="40" textAnchor="middle" fill="#bfe8ff" fontFamily="IBM Plex Mono" fontSize="12">H₂O?</text></g>
    </g>
  )
}

function Dsn() {
  return (
    <g>
      <defs>
        <linearGradient id="ds-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#060a1d" /><stop offset=".7" stopColor="#2a2550" /><stop offset="1" stopColor="#b8653c" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#ds-sky)" />
      <Stars n={110} seed={20} maxY={H * 0.55} />
      <g transform="translate(830 90)"><circle r="20" fill="#c9cfdc" /><circle cx="-6" cy="-4" r="4" fill="#9aa3b5" /><circle cx="6" cy="6" r="3" fill="#9aa3b5" /></g>
      {/* beam to the Moon */}
      <path className="beam-pulse" d="M470 260 L830 90" stroke="#3ccf9e" strokeWidth="3" strokeDasharray="8 10" />
      <path d={ridge(31, 430, 40, 40)} fill="#24182a" />
      {/* giant dish */}
      <g stroke="#0a0f1c" strokeWidth="4">
        <path d="M420 470 L470 360 L520 470" fill="none" stroke="#c9d2e6" strokeWidth="10" />
        <rect x="440" y="340" width="60" height="40" fill="#9aa3b8" />
        <g transform="translate(470 290) rotate(-28)">
          <path d="M-150 0 Q0 110 150 0 Z" fill="#eef1f7" />
          {[-100, -50, 0, 50, 100].map((x) => <line key={x} x1={x} y1={Math.abs(x) < 60 ? 70 : 40} x2={x * 0.98} y2="2" stroke="#b9c2d6" strokeWidth="2" />)}
          <path d="M-60 6 L0 -90 L60 6" fill="none" stroke="#c9d2e6" strokeWidth="5" /><rect x="-12" y="-104" width="24" height="22" fill="#9aa3b8" />
        </g>
      </g>
      <path d={ridge(37, 490, 18, 30)} fill="#0e0a12" />
    </g>
  )
}

export function StoryScene({ id }: { id: SceneId }) {
  return (
    <svg className="story-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-hidden>
      {id === 'fire-night' && <FireNight />}
      {id === 'fire-command' && <FireCommand />}
      {id === 'mission-control' && <MissionControl />}
      {id === 'orbit-earth' && <OrbitEarth />}
      {id === 'moon-pole' && <MoonPole />}
      {id === 'moon-base' && <MoonBase />}
      {id === 'dsn' && <Dsn />}
    </svg>
  )
}

/** Character portrait in a round frame. */
export function Portrait({ id, size = 84 }: { id: CharacterId; size?: number }) {
  const skin = id === 'director' ? '#8d5a3b' : id === 'chief' ? '#c58c5f' : '#f0c9a0'
  const hair = id === 'director' ? '#1b130e' : id === 'chief' ? '#3a2416' : '#141414'
  const outfit = id === 'director' ? '#2d4a7a' : id === 'chief' ? '#9c2c22' : '#1f3f8f'
  const bg = id === 'director' ? '#3a2f12' : id === 'chief' ? '#3a1c14' : '#132542'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="portrait" aria-hidden>
      <circle cx="50" cy="50" r="49" fill={bg} />
      <clipPath id={`pc-${id}`}><circle cx="50" cy="50" r="48" /></clipPath>
      <g clipPath={`url(#pc-${id})`}>
        <path d="M14 104 Q16 74 50 70 Q84 74 86 104 Z" fill={outfit} />
        {id === 'chief' && <path d="M38 72 L50 84 L62 72" stroke="#f5d24a" strokeWidth="4" fill="none" />}
        {id === 'planner' && <path d="M50 72 v30" stroke="#7aa7ff" strokeWidth="3" />}
        <rect x="42" y="58" width="16" height="14" fill={skin} />
        {id === 'planner' && <circle cx="50" cy="20" r="11" fill={hair} />}
        <ellipse cx="50" cy="44" rx="18" ry="21" fill={skin} />
        {id === 'director' && <path d="M32 40 Q32 20 50 20 Q68 20 68 40 Q62 30 50 30 Q38 30 32 40Z" fill={hair} />}
        {id === 'planner' && <path d="M31 46 Q30 22 50 22 Q70 22 69 46 Q66 32 50 31 Q36 32 31 46Z" fill={hair} />}
        {id === 'chief' && <path d="M27 38 Q28 16 50 15 Q72 16 73 38 L80 40 L20 40 Z" fill="#f5d24a" stroke="#0a0f1c" strokeWidth="1.5" />}
        {id === 'chief' && <path d="M32 40 q0 14 4 22 M68 40 q0 14 -4 22" stroke={hair} strokeWidth="5" fill="none" />}
        <circle cx="43" cy="45" r="2.2" fill="#1a1a1a" /><circle cx="57" cy="45" r="2.2" fill="#1a1a1a" />
        <path d="M44 54 q6 4 12 0" stroke="#5a3424" strokeWidth="2" fill="none" strokeLinecap="round" />
        {id === 'director' && <><path d="M30 44 Q30 22 50 22 Q70 22 70 44" stroke="#0a0f1c" strokeWidth="3" fill="none" /><rect x="26" y="40" width="8" height="12" rx="3" fill="#0a0f1c" /><path d="M30 52 q2 10 14 9" stroke="#0a0f1c" strokeWidth="2" fill="none" /><circle cx="45" cy="61" r="2" fill="#0a0f1c" /></>}
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#ffffff22" strokeWidth="2" />
    </svg>
  )
}
