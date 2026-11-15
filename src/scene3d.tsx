// Chooses between the 3D scenes (lazy-loaded three.js) and the 2D SVG stages.
// 2D is used when WebGL is missing, when a scene crashes, or when the player
// switches graphics to 2D (saved per browser).
import { Component, lazy, Suspense, useSyncExternalStore, type ReactNode } from 'react'
import { ROCKETS, byId } from '../shared/catalog.ts'
import { fmtM, r1 } from '../shared/calc.ts'
import type { Design, Metrics, Scenario } from '../shared/types.ts'
import { CraftStage, OrbitStage, RocketStage, type Live } from './stages.tsx'

const Hangar3D = lazy(() => import('./three/scenes.tsx').then((m) => ({ default: m.Hangar3D })))
const Orbit3D = lazy(() => import('./three/scenes.tsx').then((m) => ({ default: m.Orbit3D })))
const Pad3D = lazy(() => import('./three/scenes.tsx').then((m) => ({ default: m.Pad3D })))
const Launch3D = lazy(() => import('./three/scenes.tsx').then((m) => ({ default: m.Launch3D })))

const webgl = (() => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
})()

// ---- graphics preference (3D / 2D), shared by every view ----
let pref: '3d' | '2d' = (() => { try { return (localStorage.getItem('lw-gfx') as '3d' | '2d') ?? '3d' } catch { return '3d' } })()
const listeners = new Set<() => void>()
export function setGraphics(v: '3d' | '2d') {
  pref = v
  try { localStorage.setItem('lw-gfx', v) } catch { /* storage unavailable */ }
  listeners.forEach((l) => l())
}
export function useGraphics() {
  const p = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => pref)
  return webgl && p === '3d'
}

export function GraphicsToggle() {
  const on = useGraphics()
  if (!webgl) return null
  return (
    <button className="gfx-toggle" onClick={() => setGraphics(on ? '2d' : '3d')} title="Switch between 3D and lightweight 2D graphics">
      {on ? '3D' : '2D'}
    </button>
  )
}

class Fallback extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.warn('3D scene failed, using 2D graphics', err) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function Pick({ three, flat }: { three: ReactNode; flat: ReactNode }) {
  const on = useGraphics()
  if (!on) return <>{flat}</>
  return <Fallback fallback={flat}><Suspense fallback={flat}>{three}</Suspense></Fallback>
}

export function CraftView({ design, sc, m }: { design: Design; sc: Scenario; m: Metrics }) {
  return (
    <Pick
      three={<div className="view3d"><Hangar3D design={design} sc={sc} /><div className="view-hud">{r1(m.massPerSatKg)} kg{design.satellites > 1 ? ` × ${design.satellites}` : ''} · {m.slotsUsed}/{m.slots} slots · drag to rotate</div></div>}
      flat={<CraftStage design={design} sc={sc} m={m} />}
    />
  )
}

export function OrbitView({ design, sc, live }: { design: Design; sc: Scenario; live?: Live }) {
  return <Pick three={<div className="view3d"><Orbit3D design={design} sc={sc} live={live} /></div>} flat={<OrbitStage design={design} sc={sc} live={live} />} />
}

export function RocketView({ design, sc, m }: { design: Design; sc: Scenario; m: Metrics }) {
  const rocket = byId(ROCKETS, design.rocketId)
  const cap = m.rocketCapacityKg
  const fill = cap > 0 ? m.launchMassKg / cap : 1.2
  const over = cap === 0 || m.launchMassKg > cap
  return (
    <Pick
      three={
        <div className="view3d">
          <Pad3D rocketId={rocket.id} satellites={design.satellites} fill={fill} over={over} />
          <div className="pad-hud">
            <b>{rocket.name}</b>
            <span>{fmtM(rocket.costM)} · <span className={rocket.reliability < 0.95 ? 'warn' : 'good'}>{Math.round(rocket.reliability * 1000) / 10}% success</span></span>
            <div className="pad-gauge"><i className={over ? 'bad' : fill > 0.9 ? 'warn' : 'good'} style={{ width: `${Math.min(1, fill) * 100}%` }} /></div>
            <span className={over ? 'bad' : ''}>{cap === 0 ? "Can't reach this orbit" : `${r1(m.launchMassKg)} / ${cap} kg${over ? ` · ${Math.ceil(m.launchMassKg - cap)} kg too heavy` : ''}`}</span>
          </div>
        </div>
      }
      flat={<RocketStage design={design} sc={sc} m={m} />}
    />
  )
}

/** Full-screen 3D launch, or null when 2D graphics are in use (the CSS launch takes over). */
export function LaunchView({ rocketId, success, elapsed }: { rocketId: string; success: boolean; elapsed: () => number }) {
  const on = useGraphics()
  if (!on) return null
  return <Fallback fallback={null}><Suspense fallback={null}><Launch3D rocketId={rocketId} success={success} elapsed={elapsed} /></Suspense></Fallback>
}
