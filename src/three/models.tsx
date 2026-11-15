// 3D models: the spacecraft assembled from the chosen parts, rockets, and planets.
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { ADCS, ANTENNAS, BUSES, PROPULSION, SOLAR, STORAGE, byId } from '../../shared/catalog.ts'
import type { Design, Instrument, Scenario } from '../../shared/types.ts'
import { INSTRUMENT_COLORS } from '../ui.tsx'
import { cellTexture, foilTexture, loadEarthTextures, loadMoonTextures, useAsync } from './textures.ts'

// ---------- shared materials ----------
function useMaterials() {
  return useMemo(() => {
    const foil = new THREE.MeshStandardMaterial({ map: foilTexture(), metalness: 0.8, roughness: 0.36, color: '#ffffff', envMapIntensity: 1.6 })
    const cells = new THREE.MeshStandardMaterial({ map: cellTexture(), metalness: 0.55, roughness: 0.28, color: '#ffffff' })
    const panelBack = new THREE.MeshStandardMaterial({ color: '#8a93a8', metalness: 0.6, roughness: 0.5 })
    const white = new THREE.MeshStandardMaterial({ color: '#eef1f7', metalness: 0.1, roughness: 0.45 })
    const dish = new THREE.MeshStandardMaterial({ color: '#f2f4f8', metalness: 0.15, roughness: 0.35, side: THREE.DoubleSide })
    const darkMetal = new THREE.MeshStandardMaterial({ color: '#2c3346', metalness: 0.85, roughness: 0.38 })
    const greyMetal = new THREE.MeshStandardMaterial({ color: '#9aa3b8', metalness: 0.9, roughness: 0.25 })
    const copper = new THREE.MeshStandardMaterial({ color: '#c77d3a', metalness: 1, roughness: 0.35 })
    const radiator = new THREE.MeshStandardMaterial({ color: '#f4f6fb', metalness: 0, roughness: 0.6 })
    const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe3ff', metalness: 0, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.7, clearcoat: 1 })
    return { foil, cells, panelBack, white, dish, darkMetal, greyMetal, copper, radiator, glass }
  }, [])
}
type Mats = ReturnType<typeof useMaterials>

/** Grows a part in with a small overshoot when it first appears. */
function Pop({ children, position, rotation, delay = 0 }: { children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number]; delay?: number }) {
  const ref = useRef<THREE.Group>(null)
  const t = useRef(-delay)
  useFrame((_, dt) => {
    if (!ref.current || t.current > 1) return
    t.current += dt * 2.4
    const x = Math.max(0, Math.min(1, t.current))
    // ease-out-back: overshoots a little, then settles at 1
    const c1 = 1.70158, c3 = c1 + 1
    const s = x === 0 ? 0.001 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
    ref.current.scale.setScalar(Math.max(0.001, x >= 1 ? 1 : s))
  })
  return <group ref={ref} position={position} rotation={rotation} scale={0.001}>{children}</group>
}

function parabolaGeometry(r: number, depth: number) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 16; i++) { const x = (i / 16) * r; pts.push(new THREE.Vector2(x, (x * x) / (r * r) * depth)) }
  return new THREE.LatheGeometry(pts, 40)
}
function bellGeometry(r0: number, r1: number, h: number) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(r0 + (r1 - r0) * Math.pow(t, 1.8), -t * h)) }
  return new THREE.LatheGeometry(pts, 32)
}

function Dish({ r, m }: { r: number; m: Mats }) {
  const geo = useMemo(() => parabolaGeometry(r, r * 0.35), [r])
  return (
    <group>
      <mesh geometry={geo} material={m.dish} castShadow />
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2
        return <mesh key={k} position={[Math.cos(a) * r * 0.45, r * 0.42, Math.sin(a) * r * 0.45]} rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]} material={m.greyMetal}><cylinderGeometry args={[0.008, 0.008, r * 0.9, 6]} /></mesh>
      })}
      <mesh position={[0, r * 0.8, 0]} material={m.darkMetal}><cylinderGeometry args={[r * 0.06, r * 0.09, r * 0.14, 16]} /></mesh>
    </group>
  )
}

function InstrumentModel({ inst, color, m }: { inst: Instrument; color: string; m: Mats }) {
  const lens = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.15 }), [color])
  const ring = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.3 }), [color])
  const base = <mesh position={[0, -0.06, 0]} material={m.darkMetal} castShadow><boxGeometry args={[0.32, 0.12, 0.32]} /></mesh>
  const barrel = (r: number, l: number) => (
    <>
      <mesh position={[0, -0.12 - l / 2, 0]} material={m.greyMetal} castShadow><cylinderGeometry args={[r, r * 1.08, l, 24]} /></mesh>
      <mesh position={[0, -0.12 - l, 0]} rotation={[Math.PI / 2, 0, 0]} material={ring}><torusGeometry args={[r * 1.02, 0.018, 8, 24]} /></mesh>
      <mesh position={[0, -0.122 - l, 0]} rotation={[Math.PI / 2, 0, 0]} material={lens}><circleGeometry args={[r * 0.85, 24]} /></mesh>
    </>
  )
  switch (inst.kind) {
    case 'thermal': case 'optical': case 'uv':
      return <group>{base}{barrel(0.11, inst.kind === 'thermal' ? 0.2 : 0.16)}</group>
    case 'hires':
      return <group>{base}{barrel(0.14, 0.55)}</group>
    case 'laser':
      return <group>{base}{barrel(0.08, 0.14)}<mesh position={[0, -0.9, 0]} material={lens}><cylinderGeometry args={[0.006, 0.006, 1.4, 6]} /></mesh></group>
    case 'spectral':
      return (
        <group>
          <mesh position={[0, -0.14, 0]} material={m.darkMetal} castShadow><boxGeometry args={[0.34, 0.26, 0.3]} /></mesh>
          <mesh position={[0, -0.275, 0]} rotation={[-Math.PI / 2, 0, 0]} material={lens}><planeGeometry args={[0.26, 0.04]} /></mesh>
          <mesh position={[0, -0.27, 0.16]} material={ring}><boxGeometry args={[0.34, 0.02, 0.02]} /></mesh>
        </group>
      )
    case 'sounder':
      return <group>{base}<mesh position={[0, -0.12, 0]} rotation={[Math.PI, 0, 0]} material={m.glass}><sphereGeometry args={[0.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh><mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]} material={ring}><torusGeometry args={[0.15, 0.015, 8, 24]} /></mesh></group>
    case 'neutron':
      return <group>{base}<mesh position={[0, -0.28, 0]} castShadow><cylinderGeometry args={[0.12, 0.12, 0.34, 24]} /><meshStandardMaterial color="#8fd16a" metalness={0.3} roughness={0.4} /></mesh><mesh position={[0, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]} material={ring}><torusGeometry args={[0.12, 0.015, 8, 24]} /></mesh></group>
    case 'radar':
      return (
        <group>
          {base}
          <mesh position={[0, -0.16, 0]} material={m.white} castShadow><boxGeometry args={[0.95, 0.04, 0.42]} /></mesh>
          {[-0.36, -0.12, 0.12, 0.36].map((x) => <mesh key={x} position={[x, -0.185, 0]} rotation={[-Math.PI / 2, 0, 0]} material={ring}><planeGeometry args={[0.2, 0.36]} /></mesh>)}
        </group>
      )
  }
  return base
}

export function instrumentColor(sc: Scenario, id: string) {
  return INSTRUMENT_COLORS[sc.instruments.findIndex((i) => i.id === id) % INSTRUMENT_COLORS.length]
}

/** The spacecraft, assembled from the design. Nadir (instruments) points down (-Y). */
export function CraftModel({ design, sc, beams = false }: { design: Design; sc: Scenario; beams?: boolean }) {
  const m = useMaterials()
  const bus = byId(BUSES, design.busId)
  const solar = byId(SOLAR, design.solarId)
  const ant = byId(ANTENNAS, design.antennaId)
  const prop = byId(PROPULSION, design.propulsionId)
  const adcs = byId(ADCS, design.adcsId)
  const storage = byId(STORAGE, design.storageId)
  const insts = design.instruments.map((id) => sc.instruments.find((i) => i.id === id)).filter(Boolean) as Instrument[]

  const [bx, by, bz] = bus.id === 'bus-small' ? [0.9, 0.85, 0.9] : bus.id === 'bus-medium' ? [1.3, 1.15, 1.2] : [1.75, 1.5, 1.6]
  const panels = solar.id === 'solar-small' ? 2 : solar.id === 'solar-large' ? 3 : solar.id === 'solar-xl' ? 4 : 0
  const pw = solar.id === 'solar-xl' ? 1.15 : 0.95
  const ph = solar.id === 'solar-small' ? 1.05 : solar.id === 'solar-large' ? 1.35 : 1.65
  const slots = Math.max(bus.slots, insts.length)
  const cols = slots <= 2 ? slots : slots <= 4 ? 2 : 3
  const rows = Math.ceil(slots / cols)
  const slotPos = (k: number): [number, number, number] => {
    const c = k % cols, r = Math.floor(k / cols)
    return [((c + 0.5) / cols - 0.5) * bx * 0.8, -by / 2, ((r + 0.5) / rows - 0.5) * bz * 0.75]
  }
  const beamMats = useMemo(() => insts.map((i) => new THREE.MeshBasicMaterial({ color: instrumentColor(sc, i.id), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), [design.instruments.join(), sc]) // eslint-disable-line react-hooks/exhaustive-deps
  const beamRef = useRef(0)
  useFrame((_, dt) => {
    beamRef.current += dt
    beamMats.forEach((bm, k) => { bm.opacity = 0.035 + 0.03 * Math.sin(beamRef.current * 2 + k) })
  })

  return (
    <group>
      {/* Bus */}
      <Pop key={bus.id}>
        <mesh material={solar.id === 'solar-body' ? m.foil : m.foil} castShadow receiveShadow><boxGeometry args={[bx, by, bz]} /></mesh>
        {/* frame edges */}
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`${sx}${sz}`} position={[(sx * bx) / 2, 0, (sz * bz) / 2]} material={m.darkMetal}><boxGeometry args={[0.04, by + 0.02, 0.04]} /></mesh>)}
        {solar.id === 'solar-body' ? (
          [[0, 0, bz / 2 + 0.005, 0], [0, 0, -bz / 2 - 0.005, Math.PI], [bx / 2 + 0.005, 0, 0, Math.PI / 2], [-bx / 2 - 0.005, 0, 0, -Math.PI / 2]].map(([x, y, z, ry], k) => (
            <mesh key={k} position={[x, y, z]} rotation={[0, ry, 0]} material={m.cells}><planeGeometry args={[(k < 2 ? bx : bz) * 0.88, by * 0.86]} /></mesh>
          ))
        ) : (
          <mesh position={[-bx * 0.15, 0.04, bz / 2 + 0.006]} material={m.radiator}><planeGeometry args={[bx * 0.45, by * 0.6]} /></mesh>
        )}
      </Pop>

      {/* Solar wings */}
      {panels > 0 && (
        <Pop key={solar.id} delay={0.1}>
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <mesh position={[sd * (bx / 2 + 0.22), 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.greyMetal}><cylinderGeometry args={[0.025, 0.025, 0.44, 8]} /></mesh>
              {Array.from({ length: panels }).map((_, k) => (
                <group key={k} position={[sd * (bx / 2 + 0.44 + pw / 2 + k * (pw + 0.05)), 0, 0]}>
                  <mesh material={m.cells} castShadow receiveShadow position={[0, 0, 0.012]}><boxGeometry args={[pw, ph, 0.002]} /></mesh>
                  <mesh material={m.panelBack} position={[0, 0, -0.006]}><boxGeometry args={[pw, ph, 0.02]} /></mesh>
                </group>
              ))}
            </group>
          ))}
        </Pop>
      )}

      {/* Antenna */}
      <Pop key={ant.id} delay={0.15}>
        {ant.id === 'ant-uhf' && <mesh position={[bx * 0.3, by / 2 + 0.45, 0]} rotation={[0, 0, -0.35]} material={m.greyMetal}><cylinderGeometry args={[0.01, 0.01, 1, 6]} /></mesh>}
        {ant.id === 'ant-s' && <group position={[0, by / 2 + 0.02, 0]}><mesh material={m.white}><boxGeometry args={[0.36, 0.03, 0.36]} /></mesh><mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.18, 0.18]} /><meshStandardMaterial color="#f5b544" metalness={0.8} roughness={0.3} /></mesh></group>}
        {ant.id === 'ant-x' && <group position={[0, by / 2, 0]}><mesh position={[0, 0.15, 0]} material={m.greyMetal}><cylinderGeometry args={[0.03, 0.03, 0.3, 8]} /></mesh><group position={[0, 0.3, 0]} rotation={[0.35, 0, 0]}><Dish r={0.32} m={m} /></group></group>}
        {ant.id === 'ant-ka' && <group position={[0, by / 2, -bz * 0.1]}><mesh position={[0, 0.25, 0]} material={m.greyMetal}><cylinderGeometry args={[0.04, 0.05, 0.5, 8]} /></mesh><group position={[0, 0.5, 0]} rotation={[0.45, 0, 0]}><Dish r={0.72} m={m} /></group></group>}
      </Pop>

      {/* Pointing system */}
      <Pop key={adcs.id} delay={0.2}>
        {adcs.id === 'adcs-star' && [-1, 1].map((sd) => (
          <group key={sd} position={[sd * bx * 0.32, by / 2 + 0.1, bz * 0.3]} rotation={[0.5, 0, sd * 0.5]}>
            <mesh material={m.darkMetal} castShadow><cylinderGeometry args={[0.07, 0.07, 0.16, 16]} /></mesh>
            <mesh position={[0, 0.16, 0]} material={m.darkMetal}><cylinderGeometry args={[0.14, 0.07, 0.18, 16, 1, true]} /></mesh>
          </group>
        ))}
        {adcs.id === 'adcs-wheels' && <mesh position={[bx * 0.25, by / 2 + 0.06, bz * 0.25]} material={m.darkMetal}><cylinderGeometry args={[0.13, 0.13, 0.1, 24]} /></mesh>}
        {adcs.id === 'adcs-mag' && [0, 1, 2].map((k) => <mesh key={k} position={[0, by / 2 + 0.04, (k - 1) * bz * 0.3]} rotation={[0, 0, Math.PI / 2]} material={m.copper}><cylinderGeometry args={[0.03, 0.03, bx * 0.8, 10]} /></mesh>)}
      </Pop>

      {/* Propulsion on the back (-Z) */}
      {prop.id !== 'prop-none' && (
        <Pop key={prop.id} delay={0.25}>
          {prop.id === 'prop-biprop' ? (
            <group position={[0, 0, -bz / 2]}>
              <BellNozzle r0={0.1} r1={0.34} h={0.6} m={m} />
              {[-1, 1].map((sd) => <mesh key={sd} position={[sd * bx * 0.36, -by * 0.18, -0.2]} material={m.greyMetal} castShadow><sphereGeometry args={[0.24, 24, 16]} /></mesh>)}
            </group>
          ) : (
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => (
              <group key={`${sx}${sy}`} position={[(sx * bx) / 2.4, (sy * by) / 2.4, -bz / 2]}>
                <BellNozzle r0={prop.id === 'prop-cold' ? 0.02 : 0.035} r1={prop.id === 'prop-cold' ? 0.045 : 0.08} h={prop.id === 'prop-cold' ? 0.08 : 0.14} m={m} />
              </group>
            ))
          )}
        </Pop>
      )}

      {/* Recorder + backup computer on the front face */}
      <Pop key={storage.id} delay={0.3} position={[bx * 0.28, -by * 0.25, bz / 2 + 0.03]}>
        <mesh material={m.darkMetal}><boxGeometry args={[0.28, 0.16, 0.05]} /></mesh>
        {Array.from({ length: { 'store-16': 1, 'store-64': 2, 'store-256': 3, 'store-1000': 4 }[storage.id] ?? 1 }).map((_, k) => (
          <mesh key={k} position={[-0.09 + k * 0.06, 0, 0.03]}><boxGeometry args={[0.035, 0.08, 0.01]} /><meshStandardMaterial color="#4fd1e8" emissive="#4fd1e8" emissiveIntensity={2} /></mesh>
        ))}
      </Pop>
      {design.redundancy && (
        <Pop key="red" delay={0.3} position={[bx * 0.28, by * 0.25, bz / 2 + 0.03]}>
          <mesh material={m.darkMetal}><boxGeometry args={[0.28, 0.16, 0.05]} /></mesh>
          <Blink color="#3ccf9e" position={[-0.06, 0, 0.03]} />
          <Blink color="#4fd1e8" position={[0.06, 0, 0.03]} offset={0.5} />
        </Pop>
      )}

      {/* Instruments + empty slots on the bottom */}
      {Array.from({ length: slots }).map((_, k) => {
        const pos = slotPos(k)
        const inst = insts[k]
        if (!inst) {
          return (
            <mesh key={`slot${k}`} position={[pos[0], pos[1] - 0.01, pos[2]]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.13, 0.15, 32]} />
              <meshBasicMaterial color="#93a0bd" transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>
          )
        }
        const color = instrumentColor(sc, inst.id)
        return (
          <group key={inst.id} position={pos}>
            <Pop><InstrumentModel inst={inst} color={k >= bus.slots ? '#ff6b5a' : color} m={m} /></Pop>
            {beams && (
              <mesh position={[0, -1.6, 0]} material={beamMats[k]}>
                <coneGeometry args={[0.55, 2.8, 32, 1, true]} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

function BellNozzle({ r0, r1, h, m }: { r0: number; r1: number; h: number; m: Mats }) {
  const geo = useMemo(() => bellGeometry(r0, r1, h), [r0, r1, h])
  return <mesh geometry={geo} material={m.darkMetal} rotation={[Math.PI / 2, 0, 0]} castShadow />
}

function Blink({ color, position, offset = 0 }: { color: string; position: [number, number, number]; offset?: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 3 }), [color])
  useFrame(({ clock }) => { mat.emissiveIntensity = Math.sin((clock.elapsedTime + offset) * 4) > 0 ? 3 : 0.3 })
  return <mesh position={position} material={mat}><sphereGeometry args={[0.022, 8, 8]} /></mesh>
}

// ---------- planets ----------

const atmoVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`
const atmoFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uPower;
uniform float uStrength;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float f = pow(1.0 - abs(dot(vNormal, vView)), uPower);
  gl_FragColor = vec4(uColor, 1.0) * f * uStrength;
}`

export function Atmosphere({ radius, color = '#5aa2ff', strength = 1.4 }: { radius: number; color?: string; strength?: number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: atmoVertex, fragmentShader: atmoFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: 2.2 }, uStrength: { value: strength } },
  }), [color, strength])
  const rim = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: atmoVertex, fragmentShader: atmoFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: 3.5 }, uStrength: { value: strength * 0.8 } },
  }), [color, strength])
  return (
    <>
      <mesh material={mat} scale={1.09}><sphereGeometry args={[radius, 64, 32]} /></mesh>
      <mesh material={rim} scale={1.005}><sphereGeometry args={[radius, 64, 32]} /></mesh>
    </>
  )
}

export function Earth({ radius, spin = 0.02, children, atmo = 1.4, cloudOpacity = 0.65 }: { radius: number; spin?: number; children?: ReactNode; atmo?: number; cloudOpacity?: number }) {
  const tex = useAsync(loadEarthTextures)
  const ref = useRef<THREE.Group>(null)
  const clouds = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * spin
    if (clouds.current) clouds.current.rotation.y += dt * spin * 0.35
  })
  return (
    <group>
      <group ref={ref}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[radius, 128, 64]} />
          {tex
            ? <meshStandardMaterial key="tex" map={tex.map} roughnessMap={tex.roughness} metalness={0} roughness={1} />
            : <meshStandardMaterial key="plain" color="#1f5fb0" roughness={0.7} />}
        </mesh>
        {children}
      </group>
      {tex && (
        <mesh ref={clouds} scale={1.012}>
          <sphereGeometry args={[radius, 96, 48]} />
          <meshStandardMaterial map={tex.clouds} transparent depthWrite={false} opacity={cloudOpacity} roughness={1} />
        </mesh>
      )}
      <Atmosphere radius={radius} strength={atmo} />
    </group>
  )
}

export function Moon({ radius, spin = 0.01, children }: { radius: number; spin?: number; children?: ReactNode }) {
  const tex = useAsync(loadMoonTextures)
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * spin })
  return (
    <group ref={ref}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[radius, 128, 64]} />
        {tex
          ? <meshStandardMaterial key="tex" map={tex.map} bumpMap={tex.map} bumpScale={2.5} roughness={0.95} metalness={0} />
          : <meshStandardMaterial key="plain" color="#9aa1b0" roughness={0.95} />}
      </mesh>
      {children}
    </group>
  )
}

// ---------- rockets ----------

const ROCKET: Record<string, { r: number; h: number; boosters?: boolean }> = {
  small: { r: 0.32, h: 5.6 },
  rideshare: { r: 0.55, h: 9 },
  medium: { r: 0.55, h: 9 },
  heavy: { r: 0.6, h: 9.6, boosters: true },
}
export const rocketHeight = (id: string) => (ROCKET[id] ?? ROCKET.medium).h

function ogive(r: number, h: number) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(r * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - t * 0.02), t * h)) }
  return new THREE.LatheGeometry(pts, 40)
}

function Stage({ r, h, y, m, band = true }: { r: number; h: number; y: number; m: Mats; band?: boolean }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, h / 2, 0]} material={m.white} castShadow receiveShadow><cylinderGeometry args={[r, r, h, 40]} /></mesh>
      {band && <mesh position={[0, h * 0.92, 0]} material={m.darkMetal}><cylinderGeometry args={[r * 1.005, r * 1.005, h * 0.06, 40]} /></mesh>}
      <mesh position={[0, h * 0.06, 0]} material={m.darkMetal}><cylinderGeometry args={[r * 1.005, r * 1.005, h * 0.1, 40]} /></mesh>
    </group>
  )
}

export type Throttle = number | { current: number }
const throttleOf = (t: Throttle) => (typeof t === 'number' ? t : t.current)

export function Flame({ r, length, throttle = 1 }: { r: number; length: number; throttle?: Throttle }) {
  const group = useRef<THREE.Group>(null)
  const outer = useRef<THREE.Mesh>(null)
  const inner = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const th = throttleOf(throttle)
    const f = 0.9 + Math.sin(clock.elapsedTime * 60) * 0.06 + Math.sin(clock.elapsedTime * 23) * 0.05
    if (group.current) group.current.visible = th > 0.01
    if (outer.current) outer.current.scale.set(1, Math.max(0.001, f * th), 1)
    if (inner.current) inner.current.scale.set(1, Math.max(0.001, (2 - f) * th * 0.9), 1)
  })
  return (
    <group ref={group}>
      <mesh ref={outer} position={[0, 0, 0]}>
        <coneGeometry args={[r, length, 24, 1, true]} />
        <meshBasicMaterial color="#ff9a3c" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={inner} position={[0, length * 0.15, 0]}>
        <coneGeometry args={[r * 0.55, length * 0.55, 24, 1, true]} />
        <meshBasicMaterial color="#fff3c4" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** Rocket standing on y=0. Set showPayload to see the spacecraft through a clear fairing. */
export function RocketModel({ id, payload, throttle = 0, overweight = false }: { id: string; payload?: ReactNode; throttle?: Throttle; overweight?: boolean }) {
  const m = useMaterials()
  const d = ROCKET[id] ?? ROCKET.medium
  const s1 = d.h * 0.58
  const s2 = d.h * 0.2
  const fairH = d.h * 0.22
  const fr = d.r * 1.12
  const nose = useMemo(() => ogive(fr, fairH * 0.55), [fr, fairH])
  const fairingMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: overweight ? '#ffb3a8' : '#ffffff', transparent: true, opacity: payload ? 0.22 : 1, roughness: 0.2, metalness: 0, side: THREE.DoubleSide, depthWrite: !payload }), [payload, overweight])
  const bell = useMemo(() => bellGeometry(d.r * 0.25, d.r * 0.45, d.r * 0.7), [d.r])
  const engines = id === 'small' ? [[0, 0]] : [[0, 0], [d.r * 0.5, 0], [-d.r * 0.5, 0], [0, d.r * 0.5], [0, -d.r * 0.5]]
  return (
    <group>
      {/* engines + flame */}
      {engines.map(([x, z], k) => <mesh key={k} geometry={bell} material={m.darkMetal} position={[x, 0.02, z]} />)}
      <group position={[0, -d.r * 0.7 - d.h * 0.16, 0]} rotation={[Math.PI, 0, 0]}>
        <Flame r={d.r * 1.1} length={d.h * 0.32} throttle={throttle} />
      </group>
      <Stage r={d.r} h={s1} y={0} m={m} />
      <Stage r={d.r * 0.96} h={s2} y={s1} m={m} band={false} />
      {/* fairing */}
      <group position={[0, s1 + s2, 0]}>
        <mesh position={[0, (fairH * 0.45) / 2, 0]} material={fairingMat}><cylinderGeometry args={[fr, d.r, fairH * 0.45, 40, 1, !!payload]} /></mesh>
        <mesh position={[0, fairH * 0.45, 0]} geometry={nose} material={fairingMat} />
        {payload && <group position={[0, fairH * 0.35, 0]}>{payload}</group>}
      </group>
      {d.boosters && [-1, 1].map((sd) => (
        <group key={sd} position={[sd * (d.r + d.r * 0.85), 0, 0]}>
          <mesh geometry={bell} material={m.darkMetal} position={[0, 0.02, 0]} />
          <Stage r={d.r * 0.82} h={d.h * 0.62} y={0} m={m} />
          <mesh position={[0, d.h * 0.62, 0]} material={m.white}><coneGeometry args={[d.r * 0.82, d.r * 1.6, 32]} /></mesh>
          <group position={[0, -d.r * 0.7 - d.h * 0.12, 0]} rotation={[Math.PI, 0, 0]}><Flame r={d.r * 0.9} length={d.h * 0.25} throttle={throttle} /></group>
        </group>
      ))}
    </group>
  )
}
