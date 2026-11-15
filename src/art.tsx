// Illustration kit: one small drawing per part, in a shared flat style.
// Every icon uses a 64x64 viewBox with a transparent background, so the same
// drawing works as a card thumbnail and nested inside the big spacecraft stage.
import type { ReactNode } from 'react'
import type { InstrumentKind } from '../shared/types.ts'

export const C = {
  ink: '#0a0f1c',
  gold: '#d9ad52', goldD: '#a07a2c', goldL: '#f3d27f',
  cell: '#1f3f8f', cellL: '#4f7ad1',
  white: '#e9edf6', grey: '#93a0bd', dark: '#4a5676', darker: '#2a3450',
  orange: '#f5b544', red: '#ff6b5a', cyan: '#4fd1e8', violet: '#c08bff', green: '#3ccf9e', blue: '#7aa7ff',
  ocean: '#2f6fd6', land: '#46c48f', moon: '#a3abbd', moonD: '#7d8699',
}
const S = { stroke: C.ink, strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

export function Icon({ children, size, title }: { children: ReactNode; size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size ?? '100%'} height={size ?? '100%'} aria-hidden={!title} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  )
}

// ---------- building blocks ----------

/** Isometric box: front face at (x, y) with size w x h, depth d. */
export function Box({ x, y, w, h, d, front, top, side }: { x: number; y: number; w: number; h: number; d: number; front: string; top: string; side: string }) {
  return (
    <g {...S}>
      <path d={`M${x} ${y} l${d} ${-d * 0.6} h${w} l${-d} ${d * 0.6}z`} fill={top} />
      <path d={`M${x + w} ${y} l${d} ${-d * 0.6} v${h} l${-d} ${d * 0.6}z`} fill={side} />
      <rect x={x} y={y} width={w} height={h} fill={front} />
    </g>
  )
}

function GoldBox({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g>
      <Box x={x} y={y} w={s} h={s} d={s * 0.4} front={C.gold} top={C.goldL} side={C.goldD} />
      <path d={`M${x + s * 0.2} ${y + s * 0.3} l${s * 0.25} ${s * 0.1} l${s * 0.3} -${s * 0.12} M${x + s * 0.15} ${y + s * 0.7} l${s * 0.35} -${s * 0.08} l${s * 0.3} ${s * 0.12}`} stroke={C.goldD} strokeWidth="1" fill="none" />
    </g>
  )
}

function Panel({ x, y, w, h, cols = 2, rows = 3 }: { x: number; y: number; w: number; h: number; cols?: number; rows?: number }) {
  const lines = []
  for (let i = 1; i < cols; i++) lines.push(<line key={`c${i}`} x1={x + (w * i) / cols} y1={y} x2={x + (w * i) / cols} y2={y + h} />)
  for (let j = 1; j < rows; j++) lines.push(<line key={`r${j}`} x1={x} y1={y + (h * j) / rows} x2={x + w} y2={y + (h * j) / rows} />)
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.cell} {...S} />
      <g stroke={C.cellL} strokeWidth="0.8">{lines}</g>
      <rect x={x + 1.5} y={y + 1.5} width={w * 0.35} height={h * 0.18} fill="#ffffff22" />
    </g>
  )
}

export function MiniEarth({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 1.5} fill="none" stroke="#7aa7ff55" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r} fill={C.ocean} {...S} />
      <path d={`M${cx - r * 0.6} ${cy - r * 0.3} q${r * 0.3} -${r * 0.5} ${r * 0.7} -${r * 0.2} q${r * 0.1} ${r * 0.4} -${r * 0.3} ${r * 0.6} q-${r * 0.3} ${r * 0.1} -${r * 0.4} -${r * 0.4}z M${cx + r * 0.1} ${cy + r * 0.2} q${r * 0.4} -${r * 0.1} ${r * 0.5} ${r * 0.3} q-${r * 0.1} ${r * 0.3} -${r * 0.4} ${r * 0.3}z`} fill={C.land} />
      <path d={`M${cx - r * 0.75} ${cy - r * 0.5} a${r} ${r} 0 0 1 ${r * 0.6} -${r * 0.35}`} stroke="#ffffff88" strokeWidth="1.5" fill="none" />
    </g>
  )
}

export function MiniMoon({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.moon} {...S} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.25} r={r * 0.22} fill={C.moonD} />
      <circle cx={cx + r * 0.35} cy={cy + r * 0.1} r={r * 0.15} fill={C.moonD} />
      <circle cx={cx - r * 0.05} cy={cy + r * 0.45} r={r * 0.12} fill={C.moonD} />
    </g>
  )
}

function Dish({ cx, cy, r, tilt = -20 }: { cx: number; cy: number; r: number; tilt?: number }) {
  return (
    <g transform={`rotate(${tilt} ${cx} ${cy})`}>
      <path d={`M${cx - r} ${cy} Q${cx} ${cy + r * 0.9} ${cx + r} ${cy} Z`} fill={C.white} {...S} />
      <line x1={cx} y1={cy + r * 0.45} x2={cx} y2={cy - r * 0.55} stroke={C.ink} strokeWidth="1.4" />
      <circle cx={cx} cy={cy - r * 0.6} r={r * 0.12} fill={C.grey} {...S} strokeWidth="1" />
    </g>
  )
}

function Lens({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.darker} {...S} />
      <circle cx={cx} cy={cy} r={r * 0.68} fill={color} stroke={C.ink} strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r * 0.35} fill={C.ink} opacity=".55" />
      <circle cx={cx - r * 0.25} cy={cy - r * 0.25} r={r * 0.16} fill="#ffffffcc" />
    </g>
  )
}

function SmallSat({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-9" y="-3" width="6" height="6" fill={C.cell} stroke={C.ink} strokeWidth="1" />
      <rect x="3" y="-3" width="6" height="6" fill={C.cell} stroke={C.ink} strokeWidth="1" />
      <rect x="-3" y="-3.5" width="6" height="7" fill={C.gold} stroke={C.ink} strokeWidth="1" />
    </g>
  )
}

// ---------- part icons ----------

export function OrbitIcon({ id }: { id: string }) {
  const sat = (x: number, y: number) => <SmallSat x={x} y={y} s={0.75} />
  const path = { fill: 'none', stroke: C.orange, strokeWidth: 1.6, strokeDasharray: '3 2.5' }
  switch (id) {
    case 'leo-400': return <Icon><MiniEarth cx={32} cy={32} r={15} /><ellipse cx={32} cy={32} rx={23} ry={8} transform="rotate(-20 32 32)" {...path} />{sat(52, 26)}</Icon>
    case 'sso-600': return <Icon><MiniEarth cx={32} cy={32} r={15} /><ellipse cx={32} cy={32} rx={8} ry={25} transform="rotate(12 32 32)" {...path} />{sat(36, 7)}</Icon>
    case 'geo': return <Icon><MiniEarth cx={32} cy={32} r={9} /><ellipse cx={32} cy={32} rx={28} ry={9} {...path} />{sat(32, 41)}<path d="M32 36 v-3" stroke={C.orange} strokeWidth="1" /></Icon>
    case 'moon-100': return <Icon><MiniMoon cx={32} cy={32} r={15} /><ellipse cx={32} cy={32} rx={8} ry={24} transform="rotate(8 32 32)" {...path} />{sat(30, 8)}</Icon>
    case 'moon-50': return <Icon><MiniMoon cx={32} cy={32} r={16} /><ellipse cx={32} cy={32} rx={6} ry={20} transform="rotate(8 32 32)" {...path} />{sat(34, 12)}</Icon>
    case 'moon-frozen': return <Icon><MiniMoon cx={32} cy={34} r={14} /><ellipse cx={32} cy={27} rx={10} ry={23} {...path} />{sat(32, 5)}</Icon>
  }
  return <Icon><MiniEarth cx={32} cy={32} r={15} /></Icon>
}

/** Rocket drawn in a 64x64 frame. */
export function RocketIcon({ id }: { id: string }) {
  return <Icon><RocketShape id={id} x={32} base={60} scale={1} /></Icon>
}

const ROCKET_DIMS: Record<string, { w: number; h: number; boosters?: boolean; window?: boolean }> = {
  rideshare: { w: 11, h: 52, window: true },
  small: { w: 8, h: 40 },
  medium: { w: 11, h: 52 },
  heavy: { w: 12, h: 54, boosters: true },
}

/** Parametric rocket; reused at large scale on the stages and launch screen. */
export function RocketShape({ id, x, base, scale, flame, payloadColor }: { id: string; x: number; base: number; scale: number; flame?: boolean; payloadColor?: string }) {
  const d = ROCKET_DIMS[id] ?? ROCKET_DIMS.medium
  const w = d.w * scale
  const h = d.h * scale
  const nose = w * 1.5
  const body = (bx: number, bw: number, bh: number, key: string) => (
    <g key={key}>
      <path d={`M${bx - bw / 2} ${base} V${base - bh + bw * 1.5} Q${bx - bw / 2} ${base - bh} ${bx} ${base - bh} Q${bx + bw / 2} ${base - bh} ${bx + bw / 2} ${base - bh + bw * 1.5} V${base} Z`} fill={C.white} {...S} strokeWidth={1.6 * Math.max(1, scale / 3)} />
      <rect x={bx - bw / 2} y={base - bh * 0.42} width={bw} height={bh * 0.04} fill={C.dark} />
      <rect x={bx - bw / 2} y={base - bh * 0.12} width={bw} height={bh * 0.12} fill={C.darker} />
    </g>
  )
  return (
    <g>
      {flame && (
        <g className="flame">
          <path d={`M${x - w * 0.4} ${base} Q${x} ${base + h * 0.55} ${x + w * 0.4} ${base} Z`} fill="#ffb347" />
          <path d={`M${x - w * 0.22} ${base} Q${x} ${base + h * 0.32} ${x + w * 0.22} ${base} Z`} fill="#fff3c4" />
        </g>
      )}
      {d.boosters && [-1, 1].map((sd) => body(x + sd * (w * 0.5 + w * 0.32), w * 0.6, h * 0.65, `b${sd}`))}
      <path d={`M${x - w / 2} ${base - h * 0.1} l${-w * 0.45} ${h * 0.1} h${w * 0.45}z M${x + w / 2} ${base - h * 0.1} l${w * 0.45} ${h * 0.1} h${-w * 0.45}z`} fill={C.orange} {...S} strokeWidth={1.2 * Math.max(1, scale / 3)} />
      {body(x, w, h, 'core')}
      {(d.window || payloadColor) && (
        <g>
          <rect x={x - w * 0.32} y={base - h + nose * 0.75} width={w * 0.64} height={h * 0.2} rx={w * 0.08} fill={C.ink} />
          {d.window ? [0, 1, 2].map((k) => <rect key={k} x={x - w * 0.24} y={base - h + nose * 0.82 + k * h * 0.06} width={w * 0.48} height={h * 0.045} fill={[C.violet, payloadColor ?? C.gold, C.cyan][k]} />)
            : <rect x={x - w * 0.22} y={base - h + nose * 0.85} width={w * 0.44} height={h * 0.14} fill={payloadColor} />}
        </g>
      )}
    </g>
  )
}

export function BusIcon({ id }: { id: string }) {
  const s = id === 'bus-small' ? 20 : id === 'bus-medium' ? 27 : 34
  return <Icon><GoldBox x={32 - s * 0.7} y={36 - s * 0.45} s={s} /></Icon>
}

export function SolarIcon({ id }: { id: string }) {
  const n = id === 'solar-small' ? 1 : id === 'solar-large' ? 2 : id === 'solar-xl' ? 3 : 0
  const pw = n === 3 ? 6 : 8
  return (
    <Icon>
      {[-1, 1].map((sd) => Array.from({ length: n }).map((_, k) => (
        <Panel key={`${sd}${k}`} x={sd < 0 ? 24 - 3 - (k + 1) * (pw + 1) : 40 + 3 + k * (pw + 1)} y={22} w={pw} h={20} cols={1} rows={3} />
      )))}
      {n > 0 && <line x1={21} y1={32} x2={43} y2={32} stroke={C.grey} strokeWidth="1.6" />}
      <Box x={24} y={26} w={14} h={14} d={4} front={n === 0 ? C.cell : C.gold} top={C.goldL} side={C.goldD} />
      {n === 0 && <g stroke={C.cellL} strokeWidth=".8"><line x1="31" y1="26" x2="31" y2="40" /><line x1="24" y1="33" x2="38" y2="33" /></g>}
    </Icon>
  )
}

export function BatteryIcon({ id }: { id: string }) {
  const n = id === 'batt-150' ? 1 : id === 'batt-400' ? 2 : id === 'batt-1000' ? 3 : 4
  return (
    <Icon>
      <rect x="26" y="9" width="12" height="5" rx="1.5" fill={C.grey} {...S} />
      <rect x="19" y="13" width="26" height="42" rx="4" fill={C.darker} {...S} />
      {Array.from({ length: n }).map((_, k) => <rect key={k} x="23" y={48 - k * 9.5} width="18" height="7" rx="1.5" fill={C.green} />)}
      <path d="M33 22 l-5 9 h4 l-2 8 l6 -10 h-4z" fill={C.orange} stroke={C.ink} strokeWidth="1" opacity={n < 4 ? 1 : 0} />
    </Icon>
  )
}

export function AdcsIcon({ id }: { id: string }) {
  if (id === 'adcs-mag') {
    return (
      <Icon>
        <g transform="rotate(-25 32 32)">
          <rect x="10" y="27" width="44" height="10" rx="3" fill="#c77d3a" {...S} />
          {Array.from({ length: 8 }).map((_, k) => <line key={k} x1={15 + k * 5} y1="27" x2={13 + k * 5} y2="37" stroke="#8a4f1d" strokeWidth="1.4" />)}
        </g>
        <text x="47" y="56" fontSize="10" fill={C.blue} fontWeight="700">N</text>
        <text x="10" y="18" fontSize="10" fill={C.red} fontWeight="700">S</text>
      </Icon>
    )
  }
  if (id === 'adcs-wheels') {
    return (
      <Icon>
        <circle cx="32" cy="34" r="18" fill={C.dark} {...S} />
        <circle cx="32" cy="34" r="12" fill={C.grey} {...S} />
        <circle cx="32" cy="34" r="3.5" fill={C.ink} />
        {[0, 60, 120].map((a) => <line key={a} x1="32" y1="34" x2={32 + 11 * Math.cos((a * Math.PI) / 180)} y2={34 + 11 * Math.sin((a * Math.PI) / 180)} stroke={C.ink} strokeWidth="1.4" />)}
        <path d="M14 20 A22 22 0 0 1 42 10" fill="none" stroke={C.cyan} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M42 10 l-6 -1 M42 10 l-3 5" stroke={C.cyan} strokeWidth="2.4" strokeLinecap="round" />
      </Icon>
    )
  }
  return (
    <Icon>
      <path d="M12 54 l14 -14 l10 10 l-14 14z" fill={C.dark} {...S} />
      <path d="M26 40 l12 -12 l14 14 l-12 12z" fill={C.darker} {...S} />
      <ellipse cx="45" cy="35" rx="9.5" ry="3" transform="rotate(-45 45 35)" fill={C.ink} />
      <path d="M48 6 l2.2 6 l6 2.2 l-6 2.2 l-2.2 6 l-2.2 -6 l-6 -2.2 l6 -2.2z" fill={C.orange} />
      <circle cx="26" cy="14" r="1.6" fill={C.white} /><circle cx="58" cy="30" r="1.2" fill={C.white} />
    </Icon>
  )
}

export function PropIcon({ id }: { id: string }) {
  const nozzle = (x: number, y: number, s: number) => <path d={`M${x - s * 0.35} ${y} h${s * 0.7} l${s * 0.35} ${s} h${-s * 1.4}z`} fill={C.dark} {...S} />
  if (id === 'prop-none') return <Icon><g opacity=".45">{nozzle(32, 22, 18)}</g><line x1="16" y1="50" x2="48" y2="14" stroke={C.red} strokeWidth="3" strokeLinecap="round" /></Icon>
  if (id === 'prop-cold') {
    return <Icon><rect x="20" y="10" width="24" height="30" rx="11" fill={C.grey} {...S} />{nozzle(32, 40, 8)}<circle cx="27" cy="55" r="3" fill={C.white} opacity=".7" /><circle cx="35" cy="58" r="2.4" fill={C.white} opacity=".5" /><circle cx="40" cy="54" r="1.8" fill={C.white} opacity=".4" /></Icon>
  }
  if (id === 'prop-mono') {
    return <Icon><circle cx="32" cy="24" r="15" fill={C.grey} {...S} /><path d="M22 18 a12 12 0 0 1 8 -6" stroke="#ffffffaa" strokeWidth="2" fill="none" />{nozzle(32, 39, 11)}<path d="M28 51 q4 9 8 0z" fill={C.orange} /></Icon>
  }
  return (
    <Icon>
      <circle cx="20" cy="18" r="11" fill={C.grey} {...S} /><circle cx="44" cy="18" r="11" fill="#b9c2d6" {...S} />
      <rect x="27" y="27" width="10" height="6" fill={C.dark} {...S} />
      <path d="M26 33 h12 l8 16 h-28z" fill={C.dark} {...S} />
      <path d="M22 50 q10 14 20 0z" fill={C.orange} /><path d="M27 50 q5 8 10 0z" fill="#fff3c4" />
    </Icon>
  )
}

export function AntennaIcon({ id }: { id: string }) {
  if (id === 'ant-uhf') return <Icon><rect x="20" y="46" width="24" height="10" rx="2" fill={C.dark} {...S} /><line x1="32" y1="46" x2="44" y2="8" stroke={C.white} strokeWidth="2.2" /><circle cx="44" cy="8" r="2.5" fill={C.orange} /><path d="M48 16 q5 4 2 10 M52 12 q8 7 3 16" stroke={C.blue} strokeWidth="1.6" fill="none" /></Icon>
  if (id === 'ant-s') return <Icon><path d="M12 42 l18 -12 l22 10 l-18 13z" fill={C.white} {...S} /><path d="M24 40 l7 -5 l9 4 l-7 5z" fill={C.orange} stroke={C.ink} strokeWidth="1" /><path d="M42 22 q6 3 6 10 M46 16 q10 6 9 18" stroke={C.blue} strokeWidth="1.6" fill="none" /></Icon>
  if (id === 'ant-x') return <Icon><rect x="28" y="40" width="8" height="16" fill={C.dark} {...S} /><Dish cx={32} cy={34} r={14} /></Icon>
  return <Icon><rect x="29" y="46" width="6" height="12" fill={C.dark} {...S} /><Dish cx={32} cy={36} r={24} /><path d="M50 10 q6 4 6 12" stroke={C.blue} strokeWidth="1.6" fill="none" /></Icon>
}

export function GroundIcon({ id }: { id: string }) {
  if (id === 'gs-uni') return <Icon><rect x="10" y="36" width="30" height="20" fill={C.dark} {...S} /><path d="M10 36 l15 -9 l15 9z" fill={C.darker} {...S} />{[16, 24, 32].map((x) => <rect key={x} x={x} y="42" width="4" height="5" fill={C.orange} />)}<rect x="44" y="40" width="5" height="16" fill={C.grey} {...S} /><Dish cx={47} cy={34} r={11} /></Icon>
  if (id === 'gs-commercial') return <Icon><MiniEarth cx={32} cy={36} r={20} />{[[18, 24], [42, 22], [34, 50]].map(([x, y]) => <g key={x}><circle cx={x} cy={y} r="4.5" fill={C.white} {...S} strokeWidth="1" /><circle cx={x} cy={y} r="1.6" fill={C.orange} /></g>)}</Icon>
  if (id === 'gs-nsn') return <Icon><MiniEarth cx={28} cy={40} r={18} /><SmallSat x={50} y={12} s={1.1} /><line x1="34" y1="26" x2="48" y2="16" stroke={C.cyan} strokeWidth="1.6" strokeDasharray="3 2" />{[[18, 32], [36, 48]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.5" fill={C.white} {...S} strokeWidth="1" />)}</Icon>
  return <Icon><path d="M22 58 l10 -18 l10 18" fill="none" stroke={C.grey} strokeWidth="3" /><Dish cx={32} cy={30} r={27} tilt={-12} /><circle cx="54" cy="8" r="2" fill={C.white} /></Icon>
}

export function StorageIcon({ id }: { id: string }) {
  const n = id === 'store-16' ? 1 : id === 'store-64' ? 2 : id === 'store-256' ? 3 : 4
  return (
    <Icon>
      {Array.from({ length: 6 }).map((_, k) => <g key={k}><line x1={18 + k * 5.6} y1="10" x2={18 + k * 5.6} y2="16" stroke={C.grey} strokeWidth="2" /><line x1={18 + k * 5.6} y1="48" x2={18 + k * 5.6} y2="54" stroke={C.grey} strokeWidth="2" /></g>)}
      <rect x="12" y="15" width="40" height="34" rx="3" fill={C.darker} {...S} />
      {Array.from({ length: 4 }).map((_, k) => <rect key={k} x="18" y={40 - k * 7} width="28" height="4.5" rx="1" fill={k < n ? C.cyan : C.dark} />)}
    </Icon>
  )
}

export function InstrumentIcon({ kind }: { kind: InstrumentKind }) {
  switch (kind) {
    case 'thermal':
      return <Icon><Box x={14} y={22} w={30} h={26} d={8} front={C.dark} top="#5c6a8f" side={C.darker} /><Lens cx={29} cy={35} r={11} color="#ff7a45" /><path d="M46 14 q3 -4 0 -8 M52 16 q3 -4 0 -8" stroke={C.red} strokeWidth="2" fill="none" strokeLinecap="round" /></Icon>
    case 'optical':
      return <Icon><Box x={14} y={22} w={30} h={26} d={8} front={C.dark} top="#5c6a8f" side={C.darker} /><Lens cx={29} cy={35} r={11} color="#4f9cff" /></Icon>
    case 'spectral':
      return <Icon><Box x={10} y={24} w={30} h={24} d={8} front={C.dark} top="#5c6a8f" side={C.darker} /><path d="M18 42 l7 -13 l7 13z" fill="#cfe3ff" {...S} strokeWidth="1.2" />{[C.red, C.orange, '#ffe066', C.green, C.blue, C.violet].map((c, k) => <line key={c} x1="30" y1="36" x2="58" y2={22 + k * 4} stroke={c} strokeWidth="2" />)}</Icon>
    case 'sounder':
      return <Icon><rect x="14" y="38" width="36" height="14" fill={C.dark} {...S} /><path d="M18 38 a14 14 0 0 1 28 0z" fill="#cfe3ff" {...S} /><circle cx="22" cy="18" r="5" fill={C.grey} /><circle cx="29" cy="15" r="6.5" fill={C.grey} /><circle cx="37" cy="18" r="5" fill={C.grey} /><rect x="17" y="18" width="25" height="5" fill={C.grey} /></Icon>
    case 'hires':
      return <Icon><g transform="rotate(-30 32 32)"><rect x="12" y="24" width="38" height="16" rx="2" fill={C.white} {...S} /><rect x="46" y="22" width="8" height="20" rx="1.5" fill={C.dark} {...S} /><circle cx="54" cy="32" r="5" fill="#4f9cff" stroke={C.ink} strokeWidth="1" /></g></Icon>
    case 'neutron':
      return <Icon><rect x="20" y="16" width="24" height="36" fill="#9fd36a" {...S} /><ellipse cx="32" cy="16" rx="12" ry="4" fill="#c2ec92" {...S} /><ellipse cx="32" cy="52" rx="12" ry="4" fill="#7fb34f" {...S} />{[[27, 28], [36, 32], [29, 40], [37, 44]].map(([x, y]) => <circle key={x + y} cx={x} cy={y} r="2" fill={C.ink} />)}</Icon>
    case 'radar':
      return <Icon><path d="M6 44 l22 -14 l30 8 l-22 14z" fill={C.white} {...S} /><g stroke={C.grey} strokeWidth=".9"><path d="M13 39.5 l30 8 M20 35 l30 8 M17 42 l22 -14 M27 45 l22 -14" /></g><path d="M40 20 q6 -6 14 -4 M38 14 q9 -10 22 -6" stroke={C.cyan} strokeWidth="1.8" fill="none" /></Icon>
    case 'laser':
      return <Icon><Box x={12} y={26} w={24} h={22} d={7} front={C.dark} top="#5c6a8f" side={C.darker} /><circle cx="24" cy="37" r="7" fill={C.darker} {...S} /><circle cx="24" cy="37" r="3" fill={C.red} /><line x1="31" y1="35" x2="60" y2="20" stroke={C.red} strokeWidth="2" strokeDasharray="4 3" /></Icon>
    case 'uv':
      return <Icon><Box x={14} y={22} w={30} h={26} d={8} front={C.dark} top="#5c6a8f" side={C.darker} /><Lens cx={29} cy={35} r={11} color="#9b6bff" /><path d="M52 8 l1.6 4.4 l4.4 1.6 l-4.4 1.6 l-1.6 4.4 l-1.6 -4.4 l-4.4 -1.6 l4.4 -1.6z" fill={C.violet} /></Icon>
  }
}

// ---------- HUD icons (16x16-ish, drawn in 64 box) ----------
export function HudIcon({ name }: { name: 'budget' | 'mass' | 'power' | 'battery' | 'data' | 'life' | 'eye' }) {
  const st = { fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'budget': return <Icon><circle cx="32" cy="32" r="24" {...st} /><path d="M40 22 h-10 a6 6 0 0 0 0 12 h4 a6 6 0 0 1 0 12 h-10 M32 16 v6 M32 46 v6" {...st} /></Icon>
    case 'mass': return <Icon><path d="M18 54 l6 -32 h16 l6 32z" {...st} /><circle cx="32" cy="15" r="6" {...st} /></Icon>
    case 'power': return <Icon><path d="M36 6 l-18 30 h14 l-4 22 l18 -30 h-14z" {...st} /></Icon>
    case 'battery': return <Icon><rect x="10" y="18" width="40" height="28" rx="4" {...st} /><path d="M54 27 v10 M20 32 h12" {...st} /></Icon>
    case 'data': return <Icon><path d="M12 46 a28 28 0 0 1 40 0 M20 38 a17 17 0 0 1 24 0" {...st} /><circle cx="32" cy="48" r="4" fill="currentColor" /></Icon>
    case 'life': return <Icon><path d="M18 8 h28 M18 56 h28 M22 8 c0 16 20 16 20 24 s-20 8 -20 24 M42 8 c0 16 -20 16 -20 24 s20 8 20 24" {...st} /></Icon>
    case 'eye': return <Icon><path d="M6 32 q26 -26 52 0 q-26 26 -52 0z" {...st} /><circle cx="32" cy="32" r="7" {...st} /></Icon>
  }
}

/** Picks the right icon for any catalog id. */
export function PartArt({ id, kind }: { id: string; kind?: InstrumentKind }) {
  if (kind) return <InstrumentIcon kind={kind} />
  if (id.startsWith('leo') || id.startsWith('sso') || id === 'geo' || id.startsWith('moon')) return <OrbitIcon id={id} />
  if (id.startsWith('bus-')) return <BusIcon id={id} />
  if (id.startsWith('solar-')) return <SolarIcon id={id} />
  if (id.startsWith('batt-')) return <BatteryIcon id={id} />
  if (id.startsWith('adcs-')) return <AdcsIcon id={id} />
  if (id.startsWith('prop-')) return <PropIcon id={id} />
  if (id.startsWith('ant-')) return <AntennaIcon id={id} />
  if (id.startsWith('gs-')) return <GroundIcon id={id} />
  if (id.startsWith('store-')) return <StorageIcon id={id} />
  return <RocketIcon id={id} />
}

/** Mission-tier medal for the report. */
export function Medal({ tier }: { tier: 'Failure' | 'Partial' | 'Success' | 'Exceeded' }) {
  const color = tier === 'Exceeded' ? C.orange : tier === 'Success' ? C.green : tier === 'Partial' ? '#c9d2e6' : C.red
  const stars = tier === 'Exceeded' ? 3 : tier === 'Success' ? 2 : tier === 'Partial' ? 1 : 0
  return (
    <svg viewBox="0 0 120 140" width="110" height="128" aria-label={`${tier} medal`} role="img">
      <path d="M38 4 h18 l10 40 h-18z" fill={C.blue} stroke={C.ink} strokeWidth="2" />
      <path d="M82 4 h-18 l-10 40 h18z" fill={C.red} stroke={C.ink} strokeWidth="2" />
      <circle cx="60" cy="84" r="44" fill={color} stroke={C.ink} strokeWidth="3" />
      <circle cx="60" cy="84" r="34" fill="none" stroke="#0a0f1c55" strokeWidth="3" strokeDasharray="4 4" />
      {tier === 'Failure'
        ? <path d="M60 50 l-8 22 l12 6 l-10 26" stroke={C.ink} strokeWidth="4" fill="none" strokeLinecap="round" />
        : Array.from({ length: stars }).map((_, k) => {
            const x = 60 + (k - (stars - 1) / 2) * 24
            return <path key={k} transform={`translate(${x} 86) scale(.9)`} d="M0 -14 l4.1 8.4 l9.2 1.3 l-6.7 6.5 l1.6 9.2 l-8.2 -4.3 l-8.2 4.3 l1.6 -9.2 l-6.7 -6.5 l9.2 -1.3z" fill={C.ink} />
          })}
    </svg>
  )
}
