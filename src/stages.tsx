// Big illustrated scenes: the spacecraft in the hangar, the payload on the
// rocket, and the live orbit view (also used during operations).
import { useEffect, useId, useState, type ReactNode } from 'react'
import { ADCS, ANTENNAS, BUSES, NETWORKS, ORBITS, PROPULSION, ROCKETS, SOLAR, STORAGE, byId } from '../shared/catalog.ts'
import { fmtM, r1 } from '../shared/calc.ts'
import type { Design, Metrics, Scenario, SimState } from '../shared/types.ts'
import { AdcsIcon, AntennaIcon, Box, C, InstrumentIcon, MiniEarth, PropIcon, RocketShape, StorageIcon } from './art.tsx'
import { INSTRUMENT_COLORS } from './ui.tsx'

const W = 640
const H = 400
const cleanId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '')

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Seconds since mount, updated ~30 times a second (0 when motion is reduced). */
export function useAnimTime(active = true) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!active || reducedMotion()) return
    let raf = 0
    let last = 0
    const start = performance.now()
    const loop = (now: number) => {
      if (now - last > 33) { last = now; setT((now - start) / 1000) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])
  return t
}

function Stars({ seed = 1, n = 70 }: { seed?: number; n?: number }) {
  const pts = []
  let s = seed * 9301 + 49297
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  for (let i = 0; i < n; i++) pts.push(<circle key={i} cx={rnd() * W} cy={rnd() * H} r={rnd() * 1.2 + 0.3} fill="#fff" opacity={0.25 + rnd() * 0.55} />)
  return <g>{pts}</g>
}

export const instrumentColor = (sc: Scenario, id: string) => INSTRUMENT_COLORS[sc.instruments.findIndex((i) => i.id === id) % INSTRUMENT_COLORS.length]

function Part({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <g key={id} className="part pop"><title>{label}</title>{children}</g>
}

/** Nest a 64x64 icon at (x, y) with size s. */
const nest = (x: number, y: number, s: number, node: ReactNode) => <svg x={x} y={y} width={s} height={s} viewBox="0 0 64 64" overflow="visible">{node}</svg>

// ======================= Spacecraft stage =======================

function Craft({ design, sc, uid, ghost }: { design: Design; sc: Scenario; uid: string; ghost?: boolean }) {
  const bus = byId(BUSES, design.busId)
  const solar = byId(SOLAR, design.solarId)
  const ant = byId(ANTENNAS, design.antennaId)
  const prop = byId(PROPULSION, design.propulsionId)
  const adcs = byId(ADCS, design.adcsId)
  const storage = byId(STORAGE, design.storageId)
  const insts = design.instruments.map((id) => sc.instruments.find((i) => i.id === id)!).filter(Boolean)

  const bw = bus.id === 'bus-small' ? 104 : bus.id === 'bus-medium' ? 140 : 176
  const bh = bus.id === 'bus-small' ? 92 : bus.id === 'bus-medium' ? 118 : 146
  const depth = bw * 0.28
  const cx = 300
  const x0 = cx - bw / 2
  const y0 = 196 - bh / 2
  const panels = solar.id === 'solar-small' ? 2 : solar.id === 'solar-large' ? 3 : solar.id === 'solar-xl' ? 4 : 0
  const pw = solar.id === 'solar-xl' ? 50 : 46
  const ph = solar.id === 'solar-small' ? 64 : solar.id === 'solar-large' ? 78 : 92
  const slots = Math.max(bus.slots, insts.length)
  const slotW = Math.min(52, (bw - 8) / slots - 4)

  return (
    <g>
      {/* Solar wings */}
      {panels > 0 && (
        <Part id={solar.id} label={`${solar.name}: ${solar.outputW} W in sunlight`}>
          {[-1, 1].map((sd) => {
            const attachX = sd < 0 ? x0 : x0 + bw + depth * 0.5
            const startX = sd < 0 ? attachX - 22 : attachX + 22
            return (
              <g key={sd}>
                <line x1={attachX} y1={y0 + bh / 2} x2={startX} y2={y0 + bh / 2} stroke={C.grey} strokeWidth="4" />
                {Array.from({ length: panels }).map((_, k) => {
                  const px = sd < 0 ? startX - (k + 1) * (pw + 4) : startX + k * (pw + 4)
                  return (
                    <g key={k}>
                      <rect x={px} y={y0 + bh / 2 - ph / 2} width={pw} height={ph} fill={`url(#cells-${uid})`} stroke={C.ink} strokeWidth="2" />
                      <rect x={px + 3} y={y0 + bh / 2 - ph / 2 + 3} width={pw * 0.4} height={ph * 0.14} fill="#ffffff26" />
                    </g>
                  )
                })}
              </g>
            )
          })}
        </Part>
      )}

      {/* Propulsion (behind the body) */}
      {prop.id !== 'prop-none' && (
        <Part id={prop.id} label={`${prop.name}: ${prop.deltaV} m/s`}>
          {nest(x0 + bw + depth * 0.2 - 6, y0 + bh - (prop.id === 'prop-biprop' ? 36 : 22), prop.id === 'prop-biprop' ? 74 : 48, <PropIcon id={prop.id} />)}
        </Part>
      )}

      {/* Bus body */}
      <Part id={bus.id} label={`${bus.name}: ${bus.massKg} kg, ${bus.slots} instrument slots`}>
        <Box x={x0} y={y0} w={bw} h={bh} d={depth} front={solar.id === 'solar-body' ? C.cell : `url(#foil-${uid})`} top={C.goldL} side={C.goldD} />
        {solar.id === 'solar-body'
          ? <rect x={x0} y={y0} width={bw} height={bh} fill={`url(#cells-${uid})`} stroke={C.ink} strokeWidth="2" />
          : <rect x={x0 + bw * 0.1} y={y0 + bh * 0.12} width={bw * 0.32} height={bh * 0.5} fill="#eef2fa" stroke={C.ink} strokeWidth="1.5" opacity=".9" />}
      </Part>

      {/* Storage + redundancy on the front face */}
      <Part id={storage.id} label={`${storage.name}`}>
        {nest(x0 + bw - 38, y0 + bh - 40, 32, <StorageIcon id={storage.id} />)}
      </Part>
      {design.redundancy && (
        <Part id="redundancy" label="Backup flight computer">
          <rect x={x0 + bw - 40} y={y0 + 10} width="30" height="20" rx="3" fill={C.darker} stroke={C.ink} strokeWidth="1.5" />
          <circle cx={x0 + bw - 32} cy={y0 + 20} r="3" fill={C.cyan} className="blink" />
          <circle cx={x0 + bw - 20} cy={y0 + 20} r="3" fill={C.green} />
        </Part>
      )}

      {/* Pointing system */}
      <Part id={adcs.id} label={`${adcs.name}: ${adcs.accuracyDeg}° pointing`}>
        {adcs.id === 'adcs-star'
          ? <>{nest(x0 - 10, y0 - 40, 40, <AdcsIcon id={adcs.id} />)}{nest(x0 + bw - 16, y0 - 46, 40, <AdcsIcon id={adcs.id} />)}</>
          : adcs.id === 'adcs-wheels'
            ? nest(x0 + bw * 0.12, y0 + bh * 0.66, Math.min(38, bh * 0.3), <AdcsIcon id={adcs.id} />)
            : <><rect x={x0 + 6} y={y0 - 7} width={bw * 0.4} height="7" rx="3" fill="#c77d3a" stroke={C.ink} strokeWidth="1.2" /><rect x={x0 + bw * 0.55} y={y0 - 7} width={bw * 0.35} height="7" rx="3" fill="#c77d3a" stroke={C.ink} strokeWidth="1.2" /></>}
      </Part>

      {/* Antenna on top */}
      <Part id={ant.id} label={`${ant.name}`}>
        {ant.id === 'ant-ka' ? nest(cx - 50, y0 - 112, 100, <AntennaIcon id={ant.id} />)
          : ant.id === 'ant-x' ? nest(cx - 32, y0 - 66, 64, <AntennaIcon id={ant.id} />)
          : ant.id === 'ant-s' ? nest(cx - 26, y0 - 46, 52, <AntennaIcon id={ant.id} />)
          : nest(cx - 10, y0 - 60, 56, <AntennaIcon id={ant.id} />)}
      </Part>

      {/* Instrument deck: empty slots + mounted instruments */}
      {Array.from({ length: slots }).map((_, k) => {
        const sx = x0 + 4 + k * (slotW + 4) + ((bw - 8) - slots * (slotW + 4)) / 2 + 2
        const inst = insts[k]
        const over = k >= bus.slots
        if (!inst) return <rect key={`slot${k}`} x={sx} y={y0 + bh + 4} width={slotW} height={slotW * 0.8} rx="4" fill="none" stroke={C.grey} strokeWidth="1.5" strokeDasharray="4 3" opacity=".6"><title>Empty instrument slot</title></rect>
        const color = instrumentColor(sc, inst.id)
        return (
          <g key={inst.id}>
            {!ghost && (
              <path className="beam-cone" d={`M${sx + slotW / 2 - 6} ${y0 + bh + slotW * 0.8} L${sx + slotW / 2 - 26} ${H} H${sx + slotW / 2 + 26} L${sx + slotW / 2 + 6} ${y0 + bh + slotW * 0.8} Z`} fill={color} opacity=".14" />
            )}
            <Part id={inst.id} label={`${inst.name}: ${inst.massKg} kg, ${inst.powerW} W, ${inst.dataGBPerDay} GB/day`}>
              <rect x={sx - 2} y={y0 + bh + 2} width={slotW + 4} height={slotW * 0.85} rx="5" fill={over ? '#ff6b5a33' : '#0a0f1c66'} stroke={over ? C.red : color} strokeWidth="2" />
              {nest(sx, y0 + bh + 2, slotW, <InstrumentIcon kind={inst.kind} />)}
            </Part>
          </g>
        )
      })}
    </g>
  )
}

function CraftDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <pattern id={`cells-${uid}`} width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill={C.cell} />
        <path d="M0 0 H12 M0 0 V12" stroke={C.cellL} strokeWidth="1" />
      </pattern>
      <pattern id={`foil-${uid}`} width="34" height="26" patternUnits="userSpaceOnUse">
        <rect width="34" height="26" fill={C.gold} />
        <path d="M2 6 l10 3 l12 -4 l9 5 M0 18 l9 -3 l11 5 l13 -4" stroke={C.goldD} strokeWidth="1" fill="none" />
        <path d="M6 13 l8 -2 l6 3" stroke={C.goldL} strokeWidth="1" fill="none" />
      </pattern>
      <radialGradient id={`glow-${uid}`} cx="50%" cy="0%" r="80%">
        <stop offset="0%" stopColor="#7aa7ff" stopOpacity=".55" />
        <stop offset="100%" stopColor="#7aa7ff" stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

function Horizon({ moon, uid }: { moon: boolean; uid: string }) {
  return moon ? (
    <g>
      <circle cx={320} cy={1040} r={700} fill={C.moon} stroke="#c9cfdc" strokeWidth="2" />
      {[[120, 372, 22], [260, 356, 12], [430, 360, 18], [560, 380, 26], [350, 385, 9]].map(([x, y, r]) => <ellipse key={x} cx={x} cy={y} rx={r} ry={r * 0.35} fill={C.moonD} />)}
    </g>
  ) : (
    <g>
      <ellipse cx={320} cy={1000} rx={760} ry={660} fill={`url(#glow-${uid})`} />
      <circle cx={320} cy={1060} r={720} fill={C.ocean} stroke="#9cc1ff" strokeWidth="3" />
      <path d="M40 392 q60 -38 140 -30 q50 6 70 30z M380 372 q60 -22 150 -8 q40 8 50 36 h-210z" fill={C.land} opacity=".9" />
      <path d="M90 380 q40 -10 90 -4 M420 368 q50 -8 90 2" stroke="#ffffff99" strokeWidth="6" strokeLinecap="round" fill="none" />
    </g>
  )
}

export function CraftStage({ design, sc, m }: { design: Design; sc: Scenario; m: Metrics }) {
  const uid = cleanId(useId())
  const moon = byId(ORBITS, design.orbitId).dest === 'moon'
  const bus = byId(BUSES, design.busId)
  const panels = { 'solar-small': 2, 'solar-large': 3, 'solar-xl': 4 }[design.solarId] ?? 0
  const span = (bus.id === 'bus-small' ? 104 : bus.id === 'bus-medium' ? 140 : 176) + 2 * (panels * 54 + 26)
  const scale = Math.min(1, 600 / span)
  return (
    <svg className="stage" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your spacecraft">
      <CraftDefs uid={uid} />
      <Stars seed={3} />
      <Horizon moon={moon} uid={uid} />
      {design.satellites > 1 && Array.from({ length: design.satellites - 1 }).map((_, k) => (
        <g key={k} opacity=".5" transform={`translate(${k === 0 ? 40 : 470} ${k === 0 ? 22 : 34}) scale(.24)`}>
          <Craft design={design} sc={sc} uid={uid} ghost />
        </g>
      ))}
      <g className="float">
        <g transform={`translate(${300 - 300 * scale + 20} ${(1 - scale) * 160}) scale(${scale})`}>
          <Craft design={design} sc={sc} uid={uid} />
        </g>
      </g>
      <g fontFamily="IBM Plex Mono" fontSize="12" fill={C.grey}>
        <text x="16" y="24">{r1(m.massPerSatKg)} kg{design.satellites > 1 ? ` × ${design.satellites}` : ''}</text>
        <text x="16" y="42">{design.instruments.length}/{bus.slots} slots</text>
      </g>
    </svg>
  )
}

// ======================= Rocket stage =======================

export function RocketStage({ design, sc, m }: { design: Design; sc: Scenario; m: Metrics }) {
  const rocket = byId(ROCKETS, design.rocketId)
  const orbit = byId(ORBITS, design.orbitId)
  const cap = m.rocketCapacityKg
  const fill = cap > 0 ? Math.min(1.15, m.launchMassKg / cap) : 0
  const over = cap === 0 || m.launchMassKg > cap
  const scale = rocket.id === 'small' ? 5.4 : 5.4
  const gaugeTop = 60
  const gaugeH = 280
  return (
    <svg className="stage" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rocket and payload">
      <defs>
        <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#060a16" /><stop offset="1" stopColor="#1d2c52" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#dusk)" />
      <Stars seed={7} n={50} />
      <rect y={360} width={W} height={40} fill="#0b1222" />
      {/* launch tower */}
      <g stroke={C.dark} strokeWidth="3">
        <line x1="380" y1="360" x2="380" y2="40" /><line x1="410" y1="360" x2="410" y2="40" />
        {Array.from({ length: 11 }).map((_, k) => <line key={k} x1="380" y1={360 - k * 30} x2="410" y2={330 - k * 30} />)}
      </g>
      <RocketShape id={rocket.id} x={300} base={360} scale={scale} payloadColor={over ? C.red : C.gold} />
      {/* capacity gauge */}
      <g>
        <rect x="490" y={gaugeTop} width="34" height={gaugeH} rx="8" fill="#0a0f1c" stroke={C.dark} strokeWidth="2" />
        {cap > 0 && <rect x="494" y={gaugeTop + gaugeH - 4 - Math.min(1, fill) * (gaugeH - 8)} width="26" height={Math.min(1, fill) * (gaugeH - 8)} rx="5" fill={over ? C.red : fill > 0.9 ? C.orange : C.green} />}
        <line x1="482" x2="532" y1={gaugeTop + 4} y2={gaugeTop + 4} stroke={C.white} strokeWidth="2" />
        <text x="540" y={gaugeTop + 8} fontSize="12" fill={C.white} fontFamily="IBM Plex Mono">{cap > 0 ? `${cap} kg max` : 'can\'t reach'}</text>
        <text x="540" y={gaugeTop + gaugeH - 4 - Math.min(1, fill) * (gaugeH - 8) + 4} fontSize="12" fill={over ? C.red : C.green} fontFamily="IBM Plex Mono">{r1(m.launchMassKg)} kg</text>
      </g>
      <g fontFamily="IBM Plex Sans">
        <text x="24" y="40" fontSize="20" fill={C.white} fontWeight="600">{rocket.name}</text>
        <text x="24" y="62" fontSize="13" fill={C.grey}>to {orbit.name}</text>
        <text x="24" y="92" fontSize="13" fill={C.grey}>Cost <tspan fill={C.white} fontFamily="IBM Plex Mono">{fmtM(rocket.costM)}</tspan></text>
        <text x="24" y="112" fontSize="13" fill={C.grey}>Success rate <tspan fill={rocket.reliability < 0.95 ? C.orange : C.green} fontFamily="IBM Plex Mono">{Math.round(rocket.reliability * 1000) / 10}%</tspan></text>
        {over && <text x="24" y="150" fontSize="15" fill={C.red} fontWeight="600">{cap === 0 ? 'This rocket can\'t reach that orbit' : `Too heavy by ${Math.ceil(m.launchMassKg - cap)} kg`}</text>}
        {rocket.onlyOrbits && <text x="24" y="150" fontSize="13" fill={C.orange}>Rideshare: you share the ride</text>}
      </g>
    </svg>
  )
}

// ======================= Orbit stage =======================

interface Geo { R: number; rx: number; ry: number; tilt: number; ox: number; oy: number; period: number; fixed?: boolean; ecc?: number }
const GEO: Record<string, Geo> = {
  'leo-400': { R: 84, rx: 118, ry: 34, tilt: -16, ox: 0, oy: 0, period: 7 },
  'sso-600': { R: 84, rx: 30, ry: 128, tilt: 14, ox: 0, oy: 0, period: 8 },
  geo: { R: 48, rx: 210, ry: 42, tilt: -4, ox: 0, oy: 0, period: 0, fixed: true },
  'moon-100': { R: 92, rx: 30, ry: 128, tilt: 10, ox: 0, oy: 0, period: 8 },
  'moon-50': { R: 96, rx: 26, ry: 114, tilt: 10, ox: 0, oy: 0, period: 7.5 },
  'moon-frozen': { R: 90, rx: 36, ry: 140, tilt: 6, ox: 0, oy: -44, period: 9, ecc: 0.55 },
}

export interface Live {
  outage: boolean
  safeMode: boolean
  event: string | null
  health: number
  ended: boolean
  powerShort: boolean
}

export function liveFrom(sim: SimState, pendingEvent: string | null): Live {
  return {
    outage: sim.outageDaysLeft > 0 && sim.outageFactor < 0.5,
    safeMode: sim.safeModeDaysLeft > 0,
    event: pendingEvent,
    health: sim.health,
    ended: sim.ended,
    powerShort: (sim.history.at(-1)?.powerOk ?? 1) < 0.99,
  }
}

export function OrbitStage({ design, sc, live, compact }: { design: Design; sc: Scenario; live?: Live; compact?: boolean }) {
  const t = useAnimTime(!live?.ended)
  const orbit = byId(ORBITS, design.orbitId)
  const ground = byId(NETWORKS, design.groundId)
  const ant = byId(ANTENNAS, design.antennaId)
  const g = GEO[orbit.id] ?? GEO['sso-600']
  const moon = orbit.dest === 'moon'
  const cx = 330 + g.ox
  const cy = 200
  const pcx = 330
  const pcy = 200
  const n = design.satellites
  const insts = design.instruments.map((id) => sc.instruments.find((i) => i.id === id)!).filter(Boolean)
  const canHear = ant.rateMbps[orbit.comms] > 0 && ground.contactMin[orbit.comms] > 0
  const rad = (g.tilt * Math.PI) / 180
  const point = (th: number) => {
    const px = g.rx * Math.cos(th)
    const py = g.ry * Math.sin(th)
    return { x: cx + px * Math.cos(rad) - py * Math.sin(rad), y: cy + g.oy + px * Math.sin(rad) + py * Math.cos(rad) }
  }
  const isBack = (th: number) => (g.rx >= g.ry ? Math.sin(th) < 0 : Math.cos(th) < 0)
  // Orbit path split into back (behind planet) and front halves.
  const back: string[] = []
  const front: string[] = []
  for (let i = 0; i <= 120; i++) {
    const th = (i / 120) * Math.PI * 2
    const p = point(th)
    ;(isBack(th) ? back : front).push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  }
  const sats = Array.from({ length: n }).map((_, k) => {
    let th: number
    if (g.fixed) th = Math.PI / 2 + (k - (n - 1) / 2) * 0.5
    else {
      const M = ((t / g.period) + k / n) * Math.PI * 2
      th = g.ecc ? M + g.ecc * Math.sin(M) : M
      th = -th
    }
    const p = point(th)
    const shadow = p.x > pcx && Math.abs(p.y - pcy) < g.R * 0.92
    return { ...p, back: isBack(th), shadow, k }
  })

  // Ground stations (Earth scenarios) as points on the visible disk.
  const stationSpots: [number, number][] = moon ? [] : ground.id === 'gs-uni' ? [[-0.2, -0.62]]
    : ground.id === 'gs-commercial' ? [[-0.2, -0.62], [0.35, -0.55], [0.15, 0.65]]
    : [[-0.2, -0.62], [0.35, -0.55], [0.15, 0.65], [-0.7, 0.3], [0.7, 0.2]]
  const stations = stationSpots.map(([a, b]) => ({ x: pcx + a * g.R, y: pcy + b * g.R }))
  const target = moon ? { x: pcx, y: pcy + g.R * 0.9 } : { x: pcx - g.R * 0.5, y: pcy - g.R * 0.32 }
  const earthCorner = { x: 66, y: 70 }
  const dsnWindow = moon && ground.id === 'gs-dsn' ? (t % 9) < 3.2 : false
  const relay = ground.id === 'gs-nsn' && !moon ? { x: 590, y: 60 } : null
  const outage = !!live?.outage
  const safe = !!live?.safeMode
  const stormy = live?.event === 'solar-storm'
  const dark = live?.event === 'lunar-eclipse'
  const debris = live?.event === 'debris'

  const beams: ReactNode[] = []
  const looks: ReactNode[] = []
  for (const s of sats) {
    if (live?.ended) break
    const visible = !s.back || Math.hypot(s.x - pcx, s.y - pcy) > g.R
    if (!visible) continue
    // Data downlink
    if (canHear && !outage) {
      if (moon) {
        if (dsnWindow) beams.push(<line key={`b${s.k}`} className="beam" x1={s.x} y1={s.y} x2={earthCorner.x} y2={earthCorner.y} />)
      } else {
        for (const [i, st] of stations.entries()) {
          if (g.fixed || Math.hypot(s.x - st.x, s.y - st.y) < g.R * 0.95) beams.push(<line key={`b${s.k}-${i}`} className="beam" x1={s.x} y1={s.y} x2={st.x} y2={st.y} />)
        }
        if (relay && !s.back) beams.push(<line key={`r${s.k}`} className="beam relay" x1={s.x} y1={s.y} x2={relay.x} y2={relay.y} />)
      }
    }
    // Instruments looking at the target
    if (insts.length && !safe && !s.back && (g.fixed || Math.hypot(s.x - target.x, s.y - target.y) < g.R * 0.75)) {
      const col = instrumentColor(sc, insts[Math.floor(t * 2 + s.k) % insts.length].id)
      looks.push(<path key={`l${s.k}`} d={`M${s.x} ${s.y} L${target.x - 12} ${target.y} L${target.x + 12} ${target.y} Z`} fill={col} opacity=".28" />)
    }
  }

  const sat = (s: (typeof sats)[number]) => (
    <g key={`s${s.k}`} transform={`translate(${s.x} ${s.y}) scale(1.35)`} opacity={s.shadow ? 0.5 : 1}>
      {safe && <circle r="14" fill="none" stroke={C.orange} strokeWidth="2" className="blink" />}
      {(live?.health ?? 100) < 50 && <circle r="11" fill={C.red} opacity=".25" />}
      <rect x="-15" y="-4" width="10" height="8" fill={C.cell} stroke={C.ink} strokeWidth="1.2" />
      <rect x="5" y="-4" width="10" height="8" fill={C.cell} stroke={C.ink} strokeWidth="1.2" />
      <rect x="-5" y="-5.5" width="10" height="11" fill={C.gold} stroke={C.ink} strokeWidth="1.2" />
    </g>
  )

  return (
    <svg className={`stage ${compact ? 'compact' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Orbit view: ${orbit.name}`}>
      <defs>
        <linearGradient id="shadowband" x1="0" x2="1"><stop offset="0" stopColor="#000" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></linearGradient>
        <radialGradient id="planetE" cx="35%" cy="35%" r="75%"><stop offset="0" stopColor="#5b95f0" /><stop offset="1" stopColor="#173d8a" /></radialGradient>
        <radialGradient id="planetM" cx="35%" cy="35%" r="75%"><stop offset="0" stopColor="#c9cfdc" /><stop offset="1" stopColor="#5d6577" /></radialGradient>
      </defs>
      <Stars seed={moon ? 11 : 5} />
      {/* Sun on the left */}
      <g>
        <circle cx="-30" cy="200" r="70" fill="#ffd36e" opacity=".18" />
        <circle cx="-30" cy="200" r="44" fill="#ffd36e" opacity=".35" />
        <text x="12" y="390" fontSize="11" fill={C.orange} fontFamily="IBM Plex Mono">☀ sunlight →</text>
      </g>
      {stormy && Array.from({ length: 14 }).map((_, k) => {
        const y = 20 + ((k * 53) % 360)
        const x = ((t * 260 + k * 97) % (W + 120)) - 60
        return <line key={`st${k}`} x1={x} y1={y} x2={x + 40} y2={y + 4} stroke={C.orange} strokeWidth="2" opacity=".7" strokeLinecap="round" />
      })}
      {/* Earth in the corner for Moon missions */}
      {moon && (
        <g>
          <MiniEarth cx={earthCorner.x} cy={earthCorner.y} r={26} />
          <text x={earthCorner.x - 26} y={earthCorner.y + 44} fontSize="11" fill={C.grey} fontFamily="IBM Plex Mono">Earth</text>
          {ground.id === 'gs-dsn' && <circle cx={earthCorner.x + 16} cy={earthCorner.y - 14} r="4" fill={dsnWindow && !outage ? C.green : C.grey} stroke={C.ink} />}
        </g>
      )}
      {relay && <g transform={`translate(${relay.x} ${relay.y})`}><rect x="-12" y="-3" width="8" height="6" fill={C.cell} stroke={C.ink} /><rect x="4" y="-3" width="8" height="6" fill={C.cell} stroke={C.ink} /><rect x="-4" y="-4" width="8" height="8" fill={C.white} stroke={C.ink} /><text x="-20" y="20" fontSize="10" fill={C.grey} fontFamily="IBM Plex Mono">relay</text></g>}
      {/* Orbit behind the planet */}
      <polyline points={back.join(' ')} fill="none" stroke={C.orange} strokeWidth="1.5" strokeDasharray="5 5" opacity=".35" />
      {sats.filter((s) => s.back).map(sat)}
      {/* Planet */}
      <circle cx={pcx} cy={pcy} r={g.R + 5} fill="none" stroke={moon ? '#ffffff22' : '#7aa7ff55'} strokeWidth="6" />
      <circle cx={pcx} cy={pcy} r={g.R} fill={moon ? 'url(#planetM)' : 'url(#planetE)'} stroke={C.ink} strokeWidth="2" />
      {moon ? (
        <g fill={C.moonD} opacity=".8">
          <circle cx={pcx - g.R * 0.35} cy={pcy - g.R * 0.3} r={g.R * 0.16} /><circle cx={pcx + g.R * 0.4} cy={pcy - g.R * 0.05} r={g.R * 0.11} /><circle cx={pcx - g.R * 0.05} cy={pcy + g.R * 0.35} r={g.R * 0.09} />
          <ellipse cx={pcx} cy={pcy + g.R * 0.86} rx={g.R * 0.36} ry={g.R * 0.1} fill="#2a3450" />
        </g>
      ) : (
        <g>
          <path d={`M${pcx - g.R * 0.75} ${pcy - g.R * 0.45} q${g.R * 0.25} -${g.R * 0.35} ${g.R * 0.55} -${g.R * 0.2} q${g.R * 0.15} ${g.R * 0.35} -${g.R * 0.1} ${g.R * 0.7} q-${g.R * 0.35} ${g.R * 0.1} -${g.R * 0.45} -${g.R * 0.5}z M${pcx + g.R * 0.15} ${pcy + g.R * 0.05} q${g.R * 0.45} -${g.R * 0.2} ${g.R * 0.6} ${g.R * 0.25} q-${g.R * 0.1} ${g.R * 0.4} -${g.R * 0.45} ${g.R * 0.45}z`} fill={C.land} opacity=".9" />
          <g stroke="#ffffffaa" strokeWidth={g.R * 0.05} strokeLinecap="round" fill="none">
            <path d={`M${pcx - g.R * 0.15} ${pcy - g.R * 0.75} l${g.R * 0.45} ${g.R * 0.12}`} />
            <path d={`M${pcx - g.R * 0.7} ${pcy + g.R * 0.45} l${g.R * 0.35} ${g.R * 0.1}`} />
            <path d={`M${pcx - g.R * 0.1} ${pcy + g.R * 0.75} l${g.R * 0.3} -${g.R * 0.05}`} />
          </g>
        </g>
      )}
      {/* Night side */}
      <path d={`M${pcx} ${pcy - g.R} A${g.R} ${g.R} 0 0 1 ${pcx} ${pcy + g.R} A${g.R * 0.45} ${g.R} 0 0 0 ${pcx} ${pcy - g.R}`} fill="#000" opacity=".45" />
      <rect x={pcx} y={pcy - g.R} width={W - pcx} height={g.R * 2} fill="url(#shadowband)" opacity=".7" />
      {/* Target */}
      <g transform={`translate(${target.x} ${target.y})`}>
        {moon
          ? <><path d="M-6 0 l6 -9 l6 9z" fill="#bfe8ff" stroke={C.ink} strokeWidth="1" /><circle r="10" fill="none" stroke="#bfe8ff" strokeWidth="1.5" className="blink" /></>
          : <><path d="M0 -10 q7 6 3 12 q-2 3 -3 3 q-6 -1 -5 -8 q1 3 3 3 q-2 -6 2 -10z" fill={C.orange} stroke={C.ink} strokeWidth="1" /><circle r="12" fill="none" stroke={C.orange} strokeWidth="1.5" className="blink" /></>}
      </g>
      {stations.map((s, i) => <g key={i}><circle cx={s.x} cy={s.y} r="4.5" fill={outage ? C.red : C.white} stroke={C.ink} strokeWidth="1.2" />{outage && <path d={`M${s.x - 4} ${s.y - 4} l8 8 M${s.x + 4} ${s.y - 4} l-8 8`} stroke={C.red} strokeWidth="2" />}</g>)}
      {looks}
      {beams}
      {/* Orbit in front of the planet */}
      <polyline points={front.join(' ')} fill="none" stroke={C.orange} strokeWidth="1.8" strokeDasharray="5 5" opacity=".85" />
      {!live?.ended && sats.filter((s) => !s.back).map(sat)}
      {debris && sats[0] && (() => {
        const p = (t * 0.6) % 1
        const dx = sats[0].x + 160 - p * 320
        const dy = sats[0].y - 120 + p * 240
        return <g><circle cx={sats[0].x} cy={sats[0].y} r="22" fill="none" stroke={C.red} strokeWidth="2" className="blink" /><path d={`M${dx} ${dy} l6 -3 l3 5 l-7 2z`} fill={C.grey} stroke={C.ink} /></g>
      })()}
      {dark && <rect width={W} height={H} fill="#000" opacity=".45" />}
      {!compact && (
        <g fontFamily="IBM Plex Mono" fontSize="12" fill={C.grey}>
          <text x={W - 16} y={H - 52} textAnchor="end" fill={C.white}>{orbit.name}</text>
          <text x={W - 16} y={H - 34} textAnchor="end">{orbit.periodMin >= 1400 ? 'one lap per day' : `one lap every ${orbit.periodMin} min`} · {orbit.eclipseMin} min in shadow</text>
          {!moon && <text x={W - 16} y={H - 16} textAnchor="end">{g.fixed ? 'hovers over the target' : `${r1(orbit.revisitPerSat * n)} looks at the target per day`}</text>}
          {!canHear && <text x="16" y={moon ? 140 : 24} fill={C.red}>✕ ground can't hear the spacecraft</text>}
          {outage && <text x="16" y={moon ? 158 : 42} fill={C.red}>⚠ ground station outage</text>}
          {safe && <text x="16" y={moon ? 176 : 60} fill={C.orange}>● safe mode</text>}
        </g>
      )}
      {live?.ended && <text x={W / 2} y={40} textAnchor="middle" fill={C.white} fontSize="16" fontFamily="IBM Plex Sans">Mission over</text>}
    </svg>
  )
}

/** Banner art for the scenario cards. */
export function ScenarioArt({ id }: { id: string }) {
  const moon = id === 'lunar-ice'
  return (
    <svg viewBox="0 0 400 120" className="scenario-art" aria-hidden>
      <rect width="400" height="120" fill="#070b16" />
      <Stars seed={moon ? 4 : 9} n={30} />
      {moon ? (
        <g>
          <circle cx="200" cy="330" r="270" fill={C.moon} stroke="#c9cfdc" strokeWidth="2" />
          <ellipse cx="200" cy="80" rx="60" ry="10" fill="#2a3450" />
          {[[180, 78], [205, 82], [222, 77]].map(([x, y]) => <path key={x} d={`M${x} ${y} l3 -5 l3 5z`} fill="#bfe8ff" />)}
          <ellipse cx="90" cy="92" rx="22" ry="5" fill={C.moonD} /><ellipse cx="320" cy="100" rx="30" ry="6" fill={C.moonD} />
          <MiniEarth cx={340} cy={28} r={14} />
          <g transform="translate(120 34)"><rect x="-12" y="-3" width="8" height="6" fill={C.cell} stroke={C.ink} /><rect x="4" y="-3" width="8" height="6" fill={C.cell} stroke={C.ink} /><rect x="-4" y="-4" width="8" height="8" fill={C.gold} stroke={C.ink} /></g>
        </g>
      ) : (
        <g>
          <circle cx="200" cy="560" r="500" fill={C.ocean} stroke="#9cc1ff" strokeWidth="3" />
          <path d="M60 120 q40 -50 120 -56 q70 -4 90 56z" fill={C.land} />
          {[[130, 82], [150, 92], [175, 78]].map(([x, y]) => <g key={x} transform={`translate(${x} ${y})`}><path d="M0 -8 q6 5 2 10 q-6 0 -6 -5 q1 2 2 2 q-1 -4 2 -7z" fill={C.orange} /><circle r="2" fill={C.red} /></g>)}
          <path d="M150 70 q30 -20 60 -10" stroke="#9aa3b5" strokeWidth="6" strokeLinecap="round" opacity=".5" fill="none" />
          <g transform="translate(270 30)"><rect x="-14" y="-4" width="10" height="8" fill={C.cell} stroke={C.ink} /><rect x="4" y="-4" width="10" height="8" fill={C.cell} stroke={C.ink} /><rect x="-4" y="-5" width="8" height="10" fill={C.gold} stroke={C.ink} /></g>
          <path d="M270 36 L150 82 L178 82 Z" fill={C.red} opacity=".22" />
        </g>
      )}
    </svg>
  )
}
