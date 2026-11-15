// Small shared UI pieces: context, tooltips, meters, role badges, option cards, spacecraft drawing.
import { createContext, useContext, type ReactNode } from 'react'
import { ANTENNAS, BUSES, PROPULSION, SOLAR, byId } from '../shared/catalog.ts'
import { ROLE_NAMES, ROLE_SHORT } from '../shared/game.ts'
import type { Design, GameState, Phase, Role } from '../shared/types.ts'
import { GLOSSARY } from './glossary.ts'
import type { Dispatch } from './transport.ts'

export interface Ctx { state: GameState; dispatch: Dispatch; me: string; now: () => number }
export const GameCtx = createContext<Ctx>(null!)
export const useCtx = () => useContext(GameCtx)

export const ROLE_COLOR: Record<Role, string> = { lead: 'var(--lead)', science: 'var(--science)', engineer: 'var(--engineer)', comms: 'var(--comms)' }
const ROLE_INITIAL: Record<Role, string> = { lead: 'ML', science: 'SL', engineer: 'SE', comms: 'CO' }

export function Term({ id, children }: { id: keyof typeof GLOSSARY | string; children: ReactNode }) {
  const g = GLOSSARY[id]
  if (!g) return <>{children}</>
  return (
    <span className="term" tabIndex={0}>
      {children}
      <span className="pop" role="tooltip"><b>{g.term}</b>{g.text}</span>
    </span>
  )
}

export function Avatar({ role }: { role: Role }) {
  return <span className="avatar" style={{ background: ROLE_COLOR[role] }} title={ROLE_NAMES[role]}>{ROLE_INITIAL[role]}</span>
}

export function RoleChip({ role, label }: { role: Role; label?: string }) {
  return <span className="chip"><span className="dot" style={{ background: ROLE_COLOR[role] }} />{label ?? ROLE_SHORT[role]}</span>
}

export type Tone = 'good' | 'bad' | 'warn' | 'info'
const toneColor = (t: Tone) => (t === 'good' ? 'var(--good)' : t === 'bad' ? 'var(--bad)' : t === 'warn' ? 'var(--warn)' : 'var(--info)')

export function Meter({ label, value, max, text, tone, sub, mark }: {
  label: ReactNode; value: number; max: number; text: string; tone: Tone; sub?: ReactNode; mark?: number
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0
  return (
    <div className="meter">
      <div className="meter-top"><span>{label}</span><span className="v" style={{ color: toneColor(tone) }}>{text}</span></div>
      <div className="bar">
        <i style={{ width: `${pct}%`, background: toneColor(tone) }} />
        {mark !== undefined && <span className="tickmark" style={{ left: `${Math.min(100, mark * 100)}%` }} />}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export function Stat({ k, v }: { k: string; v: ReactNode }) {
  return <span className="stat">{k} <b>{v}</b></span>
}

export function OptionCard({ selected, locked, onClick, name, blurb, stats, note, multi, disabled, children, art }: {
  selected: boolean; locked: boolean; onClick: () => void; name: string; blurb: string
  stats?: ReactNode; note?: ReactNode; multi?: boolean; disabled?: boolean; children?: ReactNode; art?: ReactNode
}) {
  return (
    <button
      className={`opt ${selected ? 'sel' : ''} ${locked ? 'locked' : ''} ${art ? 'has-art' : ''}`}
      onClick={onClick}
      disabled={locked || disabled}
      aria-pressed={selected}
    >
      <span className="check">{selected ? '✓' : multi ? '+' : ''}</span>
      {art && <span className="art">{art}</span>}
      <span className="opt-body">
        <span className="name">{name}</span>
        <span className="blurb">{blurb}</span>
        {stats && <span className="stats">{stats}</span>}
        {children}
        {note && <span className="note">{note}</span>}
      </span>
    </button>
  )
}

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'lobby', label: 'Mission' }, { phase: 'briefing', label: 'Briefing' }, { phase: 'design', label: 'Design' }, { phase: 'review', label: 'Review' },
  { phase: 'launch', label: 'Launch' }, { phase: 'ops', label: 'Operations' }, { phase: 'report', label: 'Report' },
]
export function Steps({ phase }: { phase: Phase }) {
  const idx = STEPS.findIndex((s) => s.phase === phase)
  return (
    <div className="steps" aria-label="Mission phase">
      {STEPS.map((s, i) => <span key={s.phase} className={i === idx ? 'on' : i < idx ? 'done' : ''}>{s.label}</span>)}
    </div>
  )
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#18233d" />
      <path d="M16 4c4 3 6 8 6 13l-2.5 4h-7L10 17c0-5 2-10 6-13z" fill="#e9edf6" />
      <circle cx="16" cy="13" r="2.4" fill="#18233d" />
      <path d="M12.5 21h7l-1 4h-5z" fill="#f5b544" />
    </svg>
  )
}

/** A simple side-view drawing that changes with the chosen parts. */
export function Spacecraft({ design, instrumentColors }: { design: Design; instrumentColors?: string[] }) {
  const bus = byId(BUSES, design.busId)
  const solar = byId(SOLAR, design.solarId)
  const ant = byId(ANTENNAS, design.antennaId)
  const prop = byId(PROPULSION, design.propulsionId)
  const bw = bus.id === 'bus-small' ? 54 : bus.id === 'bus-medium' ? 78 : 104
  const bh = bus.id === 'bus-small' ? 54 : bus.id === 'bus-medium' ? 72 : 92
  const cx = 180
  const cy = 92
  const wing = solar.id === 'solar-body' ? 0 : solar.id === 'solar-small' ? 52 : solar.id === 'solar-large' ? 86 : 124
  const panels = Math.max(1, Math.round(wing / 20))
  const x0 = cx - bw / 2
  const y0 = cy - bh / 2
  const inst = design.instruments
  return (
    <svg className="craft" viewBox="0 0 360 190" role="img" aria-label="Spacecraft preview">
      {/* solar wings */}
      {wing > 0 && [-1, 1].map((side) => {
        const xStart = side < 0 ? x0 - 8 - wing : x0 + bw + 8
        return (
          <g key={side}>
            <line x1={side < 0 ? x0 - 8 : x0 + bw} y1={cy} x2={side < 0 ? x0 : x0 + bw + 8} y2={cy} stroke="#93a0bd" strokeWidth="3" />
            {Array.from({ length: panels }).map((_, k) => (
              <rect key={k} x={xStart + (k * wing) / panels + 1} y={cy - 24} width={wing / panels - 2} height={48} fill="#1f3c7a" stroke="#4f7ad1" strokeWidth="1" />
            ))}
          </g>
        )
      })}
      {/* body */}
      <rect x={x0} y={y0} width={bw} height={bh} rx="4" fill="#c9a85a" stroke="#f5d48a" strokeWidth="1.2" />
      <path d={`M${x0 + 6} ${y0 + 6} h${bw - 12} M${x0 + 6} ${y0 + bh - 6} h${bw - 12}`} stroke="#a7863e" strokeWidth="1" />
      {solar.id === 'solar-body' && <rect x={x0 + 8} y={y0 + 10} width={bw - 16} height={bh - 20} fill="#1f3c7a" stroke="#4f7ad1" />}
      {design.redundancy && <rect x={x0 + bw - 16} y={y0 + 4} width="10" height="10" rx="2" fill="#4fd1e8" />}
      {/* instruments on the bottom (nadir) face */}
      {inst.map((id, k) => {
        const w = Math.min(22, (bw - 8) / Math.max(1, inst.length) - 4)
        const x = x0 + 4 + k * (w + 4) + ((bw - 8) - inst.length * (w + 4)) / 2 + 2
        return <rect key={id} x={x} y={y0 + bh} width={w} height={14} rx="2" fill={instrumentColors?.[k] ?? '#c08bff'} stroke="#0a0f1c" />
      })}
      {/* antenna on top */}
      {ant.id === 'ant-ka' ? (
        <g>
          <line x1={cx} y1={y0} x2={cx} y2={y0 - 14} stroke="#93a0bd" strokeWidth="2" />
          <path d={`M${cx - 26} ${y0 - 30} Q${cx} ${y0 - 6} ${cx + 26} ${y0 - 30}`} fill="#e9edf6" stroke="#93a0bd" />
        </g>
      ) : ant.id === 'ant-x' ? (
        <g><line x1={cx} y1={y0} x2={cx} y2={y0 - 10} stroke="#93a0bd" strokeWidth="2" /><path d={`M${cx - 12} ${y0 - 18} Q${cx} ${y0 - 6} ${cx + 12} ${y0 - 18}`} fill="#e9edf6" /></g>
      ) : ant.id === 'ant-s' ? (
        <rect x={cx - 9} y={y0 - 5} width="18" height="5" fill="#e9edf6" />
      ) : (
        <line x1={cx - 10} y1={y0} x2={cx - 24} y2={y0 - 28} stroke="#e9edf6" strokeWidth="1.5" />
      )}
      {/* propulsion */}
      {prop.id !== 'prop-none' && (
        <path d={`M${x0 + bw - 2} ${cy - 8} l${prop.id === 'prop-biprop' ? 18 : 10} -6 v${prop.id === 'prop-biprop' ? 28 : 28} l-${prop.id === 'prop-biprop' ? 18 : 10} -6z`} fill="#66739a" />
      )}
      {design.satellites > 1 && (
        <text x="350" y="182" textAnchor="end" fill="#93a0bd" fontSize="12" fontFamily="IBM Plex Mono">× {design.satellites} satellites</text>
      )}
    </svg>
  )
}

export const INSTRUMENT_COLORS = ['#c08bff', '#ff8fb1', '#ffd36e', '#7ee07a', '#4fd1e8', '#ff9a5c', '#a0b4ff']
