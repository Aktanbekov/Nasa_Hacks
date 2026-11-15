// Real-time 3D scenes: hangar, orbit (also live during operations), rocket on
// the pad, and the launch sequence. Loaded lazily; see src/scene3d.tsx.
import { Environment, Lightformer, Line, OrbitControls, Stars } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { ANTENNAS, BUSES, NETWORKS, ORBITS, SOLAR, byId } from '../../shared/catalog.ts'
import type { Design, Scenario } from '../../shared/types.ts'
import type { Hotspot } from '../../shared/wildfires.ts'
import { useLiveFires } from '../live.ts'
import type { Live } from '../stages.tsx'
import { CraftModel, Earth, instrumentColor, Moon, RocketModel, rocketHeight } from './models.tsx'
import { groundTexture, latLonToVec3, softDotTexture } from './textures.ts'

// ---------- shell ----------

function Shell({ children, camera, bloom = 0.9, controls, className, transparent }: {
  children: ReactNode; camera: { position: [number, number, number]; fov?: number }; bloom?: number; transparent?: boolean
  controls?: { target?: [number, number, number]; autoRotate?: boolean; min?: number; max?: number; enabled?: boolean }; className?: string
}) {
  return (
    <div className={`stage3d ${className ?? ''}`}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: camera.position, fov: camera.fov ?? 40, near: 0.05, far: 2000 }} gl={{ antialias: true, powerPreference: 'high-performance', alpha: !!transparent }}>
        {!transparent && <color attach="background" args={['#02040b']} />}
        {children}
        {controls?.enabled !== false && (
          <OrbitControls makeDefault enablePan={false} enableDamping target={controls?.target ?? [0, 0, 0]} autoRotate={controls?.autoRotate} autoRotateSpeed={0.5} minDistance={controls?.min ?? 2} maxDistance={controls?.max ?? 40} />
        )}
        <EffectComposer multisampling={0}>
          <Bloom intensity={bloom} luminanceThreshold={0.75} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette offset={0.25} darkness={0.7} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

/** Studio-style reflections for metal and foil, built in place (no downloads). */
function Reflections() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer intensity={2.2} position={[6, 3, 4]} scale={[6, 4, 1]} color="#fff3dd" form="rect" />
      <Lightformer intensity={0.8} position={[-6, 2, -3]} scale={[8, 4, 1]} color="#9cc1ff" form="rect" />
      <Lightformer intensity={0.5} position={[0, -6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} color="#2f6fd6" />
      <Lightformer intensity={1.2} position={[0, 6, 0]} rotation-x={-Math.PI / 2} scale={[4, 4, 1]} color="#ffffff" form="ring" />
    </Environment>
  )
}

function Sun({ position, size = 30 }: { position: [number, number, number]; size?: number }) {
  const tex = softDotTexture()
  return (
    <group position={position}>
      <sprite scale={[size, size, 1]}><spriteMaterial map={tex} color="#ffd98a" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} opacity={0.9} /></sprite>
      <sprite scale={[size * 0.25, size * 0.25, 1]}><spriteMaterial map={tex} color="#ffffff" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></sprite>
    </group>
  )
}

function craftSpan(design: Design) {
  const bus = byId(BUSES, design.busId)
  const solar = byId(SOLAR, design.solarId)
  const bx = bus.id === 'bus-small' ? 0.9 : bus.id === 'bus-medium' ? 1.3 : 1.75
  const panels = { 'solar-small': 2, 'solar-large': 3, 'solar-xl': 4 }[solar.id] ?? 0
  const pw = solar.id === 'solar-xl' ? 1.15 : 0.95
  return bx + (panels ? 2 * (0.44 + panels * (pw + 0.05)) : 0)
}

function Bob({ children, amp = 0.08, turn = 0 }: { children: ReactNode; amp?: number; turn?: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }, dt) => {
    if (!ref.current) return
    ref.current.position.y = Math.sin(clock.elapsedTime * 0.8) * amp
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.5) * 0.03
    ref.current.rotation.y += dt * turn
  })
  return <group ref={ref}>{children}</group>
}

// ======================= Hangar =======================

export function Hangar3D({ design, sc }: { design: Design; sc: Scenario }) {
  const moon = byId(ORBITS, design.orbitId).dest === 'moon'
  const scale = 4.6 / Math.max(2.4, craftSpan(design))
  return (
    <Shell camera={{ position: [2.9, 1.1, 4.3], fov: 42 }} controls={{ min: 2.5, max: 11 }}>
      <Reflections />
      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 4, 5]} intensity={3.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005}>
        <orthographicCamera attach="shadow-camera" args={[-4, 4, 4, -4, 0.1, 30]} />
      </directionalLight>
      <directionalLight position={[-5, 1, -4]} intensity={0.8} color="#7aa7ff" />
      <Stars radius={120} depth={60} count={4000} factor={4} fade speed={0.4} />
      <Sun position={[60, 22, 40]} size={40} />
      <pointLight position={[2.5, 1.5, 4]} intensity={6} distance={12} color="#fff1d6" />
      <group position={[6, -17, -48]} rotation={[0.35, 2.2, 0]}>
        {moon ? <Moon radius={22} spin={0.01} /> : <Earth radius={22} spin={0.01} atmo={0.9} cloudOpacity={0.6} />}
      </group>
      <Bob turn={0.3}>
        <group scale={scale}>
          <CraftModel design={design} sc={sc} beams />
        </group>
      </Bob>
      {design.satellites > 1 && Array.from({ length: design.satellites - 1 }).map((_, k) => (
        <group key={k} position={k === 0 ? [-4.5, 1.6, -7] : [5, 1.2, -8]} scale={scale * 0.6} rotation={[0, k ? -0.6 : 0.6, 0]}>
          <CraftModel design={design} sc={sc} />
        </group>
      ))}
    </Shell>
  )
}

// ======================= Orbit =======================

interface OrbitDef { r: number; inc: number; raan: number; period: number; ecc?: number; fixed?: boolean; cam: [number, number, number]; satScale: number }
const ORBIT3D: Record<string, OrbitDef> = {
  'leo-400': { r: 2.3, inc: 51.6, raan: 20, period: 9, cam: [0.5, 2.4, 7.4], satScale: 0.09 },
  'sso-600': { r: 2.42, inc: 97.8, raan: -30, period: 10, cam: [0.5, 2.4, 7.4], satScale: 0.09 },
  geo: { r: 6.6, inc: 0.5, raan: 0, period: 0, fixed: true, cam: [2, 6, 17], satScale: 0.22 },
  'moon-100': { r: 2.22, inc: 90, raan: 25, period: 9, cam: [0.5, 1.4, 6.8], satScale: 0.09 },
  'moon-50': { r: 2.12, inc: 90, raan: 25, period: 8.5, cam: [0.5, 1.4, 6.8], satScale: 0.09 },
  'moon-frozen': { r: 2.45, inc: 88, raan: 25, period: 10, ecc: 0.13, cam: [0.5, 1.4, 7.2], satScale: 0.09 },
}
const R = 2
const EARTH_SPIN = 0.12
const SUN_DIR = new THREE.Vector3(1, 0.25, 0.45).normalize()

const STATIONS: Record<string, [number, number][]> = {
  'gs-uni': [[40, -105]],
  'gs-commercial': [[40, -105], [78, 15], [-46, 168]],
  'gs-nsn': [[40, -105], [64, -147], [78, 15], [-33, 18], [28, -81], [-46, 168]],
}

/** Position on an inclined (optionally eccentric) orbit at angle th. */
function orbitPoint(o: OrbitDef, th: number, out: THREE.Vector3) {
  const rr = o.ecc ? (o.r * (1 - o.ecc * o.ecc)) / (1 + o.ecc * Math.cos(th + Math.PI / 2)) : o.r
  const x = rr * Math.cos(th)
  const z = rr * Math.sin(th)
  const inc = (o.inc * Math.PI) / 180
  const raan = (o.raan * Math.PI) / 180
  // tilt around X by inclination, then rotate around Y by RAAN
  const y1 = -z * Math.sin(inc)
  const z1 = z * Math.cos(inc)
  out.set(x * Math.cos(raan) + z1 * Math.sin(raan), y1, -x * Math.sin(raan) + z1 * Math.cos(raan))
  return out
}

function OrbitPath({ o }: { o: OrbitDef }) {
  const pts = useMemo(() => {
    const v: THREE.Vector3[] = []
    for (let i = 0; i <= 160; i++) v.push(orbitPoint(o, (i / 160) * Math.PI * 2, new THREE.Vector3()))
    return v
  }, [o])
  return <Line points={pts} color="#f5b544" lineWidth={1.4} dashed dashSize={0.12} gapSize={0.08} transparent opacity={0.65} />
}

function Marker({ color, pulse = true, size = 0.06 }: { color: string; pulse?: boolean; size?: number }) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ring.current || !pulse) return
    const p = (clock.elapsedTime * 0.8) % 1
    ring.current.scale.setScalar(1 + p * 2.5)
    ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - p)
  })
  return (
    <group>
      <mesh><sphereGeometry args={[size, 16, 16]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh ref={ring}><ringGeometry args={[size * 1.4, size * 1.9, 32]} /><meshBasicMaterial color={color} transparent side={THREE.DoubleSide} toneMapped={false} depthWrite={false} /></mesh>
    </group>
  )
}

/** Orients a child so it lies flat on the sphere surface at `pos`. */
function SurfacePin({ lat, lon, radius, children }: { lat: number; lon: number; radius: number; children: ReactNode }) {
  const { pos, quat } = useMemo(() => {
    const p = latLonToVec3(lat, lon, radius * 1.004)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize())
    return { pos: p, quat: q }
  }, [lat, lon, radius])
  return <group position={pos} quaternion={quat}>{children}</group>
}

function Satellites({ design, sc, o, live, targetRef, stationRefs, relayPos, dsn }: {
  design: Design; sc: Scenario; o: OrbitDef; live?: Live
  targetRef: React.RefObject<THREE.Object3D | null>; stationRefs: React.RefObject<(THREE.Object3D | null)[]>
  relayPos: THREE.Vector3 | null; dsn: { pos: THREE.Vector3; active: () => boolean } | null
}) {
  const n = design.satellites
  const orbit = byId(ORBITS, design.orbitId)
  const ant = byId(ANTENNAS, design.antennaId)
  const ground = byId(NETWORKS, design.groundId)
  const canHear = ant.rateMbps[orbit.comms] > 0 && ground.contactMin[orbit.comms] > 0
  const satRefs = useRef<(THREE.Group | null)[]>([])
  const haloRefs = useRef<(THREE.Sprite | null)[]>([])
  const beams = useRef<THREE.LineSegments>(null)
  const packets = useRef<THREE.InstancedMesh>(null)
  const scans = useRef<(THREE.Mesh | null)[]>([])
  const maxBeams = n * 8
  const beamGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxBeams * 6), 3))
    return g
  }, [maxBeams])
  const insts = design.instruments
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), up: new THREE.Vector3(0, -1, 0), y: new THREE.Vector3(0, 1, 0) }), [])
  const spin = useRef(0)

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    spin.current += dt * EARTH_SPIN
    let bi = 0
    const pos = beamGeo.attributes.position as THREE.BufferAttribute
    let pi = 0
    for (let k = 0; k < n; k++) {
      const g = satRefs.current[k]
      if (!g) continue
      const th = o.fixed ? spin.current + Math.PI * 0.62 + (k - (n - 1) / 2) * 0.35 : (t / o.period + k / n) * Math.PI * 2
      orbitPoint(o, th, g.position)
      if (o.fixed) {
        // geostationary: rotate with the planet so it hovers over one spot
        g.position.set(o.r * Math.cos(-th), 0, o.r * Math.sin(-th))
      }
      g.visible = !live?.ended
      // point instruments at the planet
      tmp.a.copy(g.position).multiplyScalar(-1).normalize()
      g.quaternion.setFromUnitVectors(tmp.up, tmp.a)
      const halo = haloRefs.current[k]
      if (halo) {
        halo.position.copy(g.position)
        ;(halo.material as THREE.SpriteMaterial).color.set(live?.safeMode ? '#f5b544' : (live?.health ?? 100) < 50 ? '#ff6b5a' : '#9cc1ff')
        halo.visible = !live?.ended
      }
      if (live?.ended) continue
      const satPos = g.position
      const addBeam = (to: THREE.Vector3) => {
        if (bi >= maxBeams) return
        pos.setXYZ(bi * 2, satPos.x, satPos.y, satPos.z)
        pos.setXYZ(bi * 2 + 1, to.x, to.y, to.z)
        if (packets.current && pi < maxBeams) {
          const f = (t * 1.3 + bi * 0.37) % 1
          tmp.c.copy(satPos).lerp(to, f)
          tmp.m.makeTranslation(tmp.c.x, tmp.c.y, tmp.c.z)
          packets.current.setMatrixAt(pi++, tmp.m)
        }
        bi++
      }
      if (canHear && !live?.outage) {
        // ground stations (Earth missions)
        for (const st of stationRefs.current ?? []) {
          if (!st) continue
          st.getWorldPosition(tmp.b)
          tmp.c.copy(satPos).sub(tmp.b).normalize()
          if (tmp.c.dot(tmp.b.clone().normalize()) > 0.15) addBeam(tmp.b.clone())
        }
        if (relayPos) {
          // line of sight not blocked by the planet
          tmp.c.copy(relayPos).sub(satPos)
          const tca = -satPos.dot(tmp.c.clone().normalize())
          const d2 = satPos.lengthSq() - tca * tca
          if (tca < 0 || d2 > R * R) addBeam(relayPos)
        }
        if (dsn && dsn.active()) {
          tmp.c.copy(dsn.pos).sub(satPos)
          const dir = tmp.c.clone().normalize()
          const tca = -satPos.dot(dir)
          const d2 = satPos.lengthSq() - tca * tca
          if (tca < 0 || d2 > R * R) addBeam(dsn.pos)
        }
      }
      // instrument scan toward the target when it is in view
      const scan = scans.current[k]
      if (scan) {
        scan.visible = false
        if (targetRef.current && insts.length && !live?.safeMode) {
          targetRef.current.getWorldPosition(tmp.b)
          const facing = tmp.b.clone().normalize().dot(satPos.clone().normalize())
          if (facing > (o.fixed ? 0.5 : 0.93)) {
            tmp.c.copy(satPos).sub(tmp.b)
            const dist = tmp.c.length()
            scan.position.copy(tmp.b).addScaledVector(tmp.c, 0.5)
            scan.quaternion.setFromUnitVectors(tmp.y, tmp.c.normalize())
            scan.scale.set(o.fixed ? 2.5 : 1, dist, o.fixed ? 2.5 : 1)
            ;(scan.material as THREE.MeshBasicMaterial).color.set(instrumentColor(sc, insts[Math.floor(t * 1.5 + k) % insts.length]))
            scan.visible = true
          }
        }
      }
    }
    for (let j = bi; j < maxBeams; j++) { pos.setXYZ(j * 2, 0, 0, 0); pos.setXYZ(j * 2 + 1, 0, 0, 0) }
    pos.needsUpdate = true
    beamGeo.setDrawRange(0, bi * 2)
    if (packets.current) { packets.current.count = pi; packets.current.instanceMatrix.needsUpdate = true }
  })

  const dot = softDotTexture()
  return (
    <group>
      {Array.from({ length: n }).map((_, k) => (
        <group key={k}>
          <group ref={(el) => { satRefs.current[k] = el }}>
            <group scale={o.satScale}><CraftModel design={design} sc={sc} /></group>
          </group>
          <sprite ref={(el) => { haloRefs.current[k] = el }} scale={[o.satScale * 4, o.satScale * 4, 1]}>
            <spriteMaterial map={dot} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
          <mesh ref={(el) => { scans.current[k] = el }} visible={false}>
            <coneGeometry args={[0.16, 1, 24, 1, true]} />
            <meshBasicMaterial transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <lineSegments ref={beams} geometry={beamGeo}>
        <lineBasicMaterial color="#3ccf9e" transparent opacity={0.55} toneMapped={false} />
      </lineSegments>
      <instancedMesh ref={packets} args={[undefined, undefined, maxBeams]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial color="#9dffd9" toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

function StormParticles({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null)
  const N = 500
  const { geo, vel } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(N * 3)
    const v = new Float32Array(N)
    for (let i = 0; i < N; i++) { p[i * 3] = 14 - Math.random() * 28; p[i * 3 + 1] = (Math.random() - 0.5) * 8; p[i * 3 + 2] = (Math.random() - 0.5) * 8; v[i] = 4 + Math.random() * 6 }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return { geo: g, vel: v }
  }, [])
  useFrame((_, dt) => {
    if (!ref.current || !active) return
    const p = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < N; i++) {
      let x = p.getX(i) - vel[i] * dt * SUN_DIR.x * 2
      if (x < -14) x = 14
      p.setX(i, x)
    }
    p.needsUpdate = true
  })
  return (
    <points ref={ref} geometry={geo} visible={active}>
      <pointsMaterial color="#ffb347" size={0.06} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </points>
  )
}

function Debris({ active, o }: { active: boolean; o: OrbitDef }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.visible = active
    if (!active) return
    const t = clock.elapsedTime
    const p = orbitPoint(o, (t / o.period) * Math.PI * 2 + 0.25, new THREE.Vector3())
    ref.current.position.copy(p).add(new THREE.Vector3(Math.sin(t * 2) * 0.3, 0.2, 0))
    ref.current.rotation.set(t * 3, t * 2, 0)
  })
  return <mesh ref={ref}><dodecahedronGeometry args={[0.05, 0]} /><meshStandardMaterial color="#8a93a8" roughness={0.8} metalness={0.5} /></mesh>
}

/** Live NASA FIRMS detections as tiny glowing points on the globe. */
function HotspotLayer({ hotspots, radius }: { hotspots: Hotspot[]; radius: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const n = Math.min(hotspots.length, 400)
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    hotspots.slice(0, n).forEach((h, i) => {
      const p = latLonToVec3(h.lat, h.lon, radius * 1.004)
      const s = 0.6 + Math.min(1.6, h.frp / 120)
      m.makeScale(s, s, s).setPosition(p)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [hotspots, n, radius])
  if (!n) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]}>
      <sphereGeometry args={[0.009, 6, 6]} />
      <meshBasicMaterial color="#ffb347" toneMapped={false} />
    </instancedMesh>
  )
}

export function Orbit3D({ design, sc, live }: { design: Design; sc: Scenario; live?: Live }) {
  const orbit = byId(ORBITS, design.orbitId)
  const o = ORBIT3D[orbit.id] ?? ORBIT3D['sso-600']
  const moon = orbit.dest === 'moon'
  const ground = byId(NETWORKS, design.groundId)
  const targetRef = useRef<THREE.Object3D>(null)
  const stationRefs = useRef<(THREE.Object3D | null)[]>([])
  const relayPos = useMemo(() => (ground.id === 'gs-nsn' && !moon ? new THREE.Vector3(-5.5, 2.8, -4) : null), [ground.id, moon])
  const earthFar = useMemo(() => new THREE.Vector3(-16, 3.5, -24), [])
  const dsnClock = useRef(0)
  const dsn = useMemo(() => (moon && ground.id === 'gs-dsn' ? { pos: earthFar, active: () => (dsnClock.current % 9) < 3.4 } : null), [moon, ground.id, earthFar])
  const sunScale = live?.event === 'lunar-eclipse' ? 0.12 : 1
  const stations = moon ? [] : STATIONS[ground.id] ?? []
  const target = moon ? { lat: -88, lon: 0, color: '#bfe8ff' } : { lat: 37, lon: -120, color: '#ff7a45' }
  const liveFires = useLiveFires(sc.id === 'wildfire')

  return (
    <Shell camera={{ position: o.cam, fov: 42 }} controls={{ min: 3.2, max: 30 }} bloom={1.1}>
      <ClockTap tap={dsnClock} />
      <ambientLight intensity={0.06} />
      <directionalLight position={SUN_DIR.clone().multiplyScalar(20).toArray() as [number, number, number]} intensity={3.4 * sunScale} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-8, 8, 8, -8, 1, 60]} />
      </directionalLight>
      <hemisphereLight args={['#9cc1ff', '#000000', 0.12]} />
      <Stars radius={150} depth={60} count={5000} factor={4} fade speed={0.3} />
      <Sun position={SUN_DIR.clone().multiplyScalar(140).toArray() as [number, number, number]} size={46} />
      {moon ? (
        <>
          <Moon radius={R} spin={0.03}>
            <SurfacePin lat={target.lat} lon={target.lon} radius={R}><group ref={targetRef}><Marker color={target.color} /></group></SurfacePin>
          </Moon>
          <group position={earthFar}><Earth radius={1.7} spin={0.05} />{dsn && <DsnLight dsn={dsn} outage={!!live?.outage} />}</group>
        </>
      ) : (
        <Earth radius={R} spin={EARTH_SPIN}>
          <SurfacePin lat={target.lat} lon={target.lon} radius={R}><group ref={targetRef}><Marker color={target.color} /></group></SurfacePin>
          {liveFires && <HotspotLayer hotspots={liveFires.hotspots} radius={R} />}
          {(live?.fires ?? []).map((f) => (
            <SurfacePin key={f.name} lat={f.lat} lon={f.lon} radius={R}><Marker color="#ff3b1f" pulse={f.recent} size={f.recent ? 0.05 : 0.028} /></SurfacePin>
          ))}
          {stations.map(([la, lo], i) => (
            <SurfacePin key={`${la}${lo}`} lat={la} lon={lo} radius={R}>
              <group ref={(el) => { stationRefs.current[i] = el }}><Marker color={live?.outage ? '#ff6b5a' : '#e9edf6'} pulse={false} size={0.035} /></group>
            </SurfacePin>
          ))}
        </Earth>
      )}
      {relayPos && <group position={relayPos} scale={0.1}><CraftModel design={{ ...design, instruments: [], antennaId: 'ant-ka', solarId: 'solar-large' }} sc={sc} /></group>}
      <OrbitPath o={o} />
      <Satellites design={design} sc={sc} o={o} live={live} targetRef={targetRef} stationRefs={stationRefs} relayPos={relayPos} dsn={dsn} />
      <StormParticles active={live?.event === 'solar-storm'} />
      <Debris active={live?.event === 'debris'} o={o} />
    </Shell>
  )
}

function ClockTap({ tap }: { tap: React.RefObject<number> }) {
  useFrame((_, dt) => { tap.current += dt })
  return null
}

function DsnLight({ dsn, outage }: { dsn: { active: () => boolean }; outage: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => { if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).color.set(outage ? '#ff6b5a' : dsn.active() ? '#3ccf9e' : '#4a5676') })
  return <mesh ref={ref} position={[0.6, 1.2, 1.4]}><sphereGeometry args={[0.12, 12, 12]} /><meshBasicMaterial color="#3ccf9e" toneMapped={false} /></mesh>
}

// ======================= Launch pad =======================

function SkyDome({ altitude = 0 }: { altitude?: number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uAlt: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uAlt; varying vec3 vP;
      void main(){
        float h = clamp(vP.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 horizon = mix(vec3(0.98,0.55,0.32), vec3(0.05,0.08,0.18), uAlt);
        vec3 zenith = mix(vec3(0.10,0.17,0.38), vec3(0.0,0.0,0.02), uAlt);
        vec3 c = mix(horizon, zenith, pow(smoothstep(0.45, 1.0, h), 0.6));
        if (h < 0.5) c = mix(vec3(0.05,0.05,0.06), horizon, smoothstep(0.3, 0.5, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }), [])
  mat.uniforms.uAlt.value = altitude
  return <mesh material={mat} scale={400}><sphereGeometry args={[1, 32, 16]} /></mesh>
}

function LaunchSite() {
  const tex = groundTexture()
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[220, 64]} /><meshStandardMaterial map={tex} roughness={1} /></mesh>
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow><boxGeometry args={[7, 0.5, 7]} /><meshStandardMaterial color="#6b7182" roughness={0.9} /></mesh>
      <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.2, 1.5, 40]} /><meshStandardMaterial color="#2a2f3c" /></mesh>
      {/* service tower */}
      <group position={[2.6, 0.5, 0]}>
        {[[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 6, z]} castShadow><boxGeometry args={[0.1, 12, 0.1]} /><meshStandardMaterial color="#c0392b" metalness={0.6} roughness={0.5} /></mesh>
        ))}
        {Array.from({ length: 12 }).map((_, k) => (
          <group key={k} position={[0, k + 0.5, 0]}>
            <mesh rotation={[0, 0, 0.78]} position={[0, 0, 0.45]}><boxGeometry args={[1.25, 0.06, 0.06]} /><meshStandardMaterial color="#9c2c22" /></mesh>
            <mesh rotation={[0, 0, -0.78]} position={[0, 0, -0.45]}><boxGeometry args={[1.25, 0.06, 0.06]} /><meshStandardMaterial color="#9c2c22" /></mesh>
          </group>
        ))}
        <mesh position={[0, 12.2, 0]}><sphereGeometry args={[0.12, 12, 12]} /><meshBasicMaterial color="#ff3b30" toneMapped={false} /></mesh>
      </group>
      {/* distant hills */}
      {[[-60, -90, 30], [40, -110, 40], [100, -70, 26], [-120, -40, 34]].map(([x, z, s]) => (
        <mesh key={x} position={[x, 0, z]} scale={[s, s * 0.35, s]}><sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#1f2a2a" roughness={1} /></mesh>
      ))}
    </group>
  )
}

function PayloadStack({ n, fill, over }: { n: number; fill: number; over: boolean }) {
  const h = 0.32 + Math.min(1, fill) * 0.55
  return (
    <group>
      {Array.from({ length: n }).map((_, k) => (
        <mesh key={k} position={[0, (k - (n - 1) / 2) * (h / n + 0.05), 0]}>
          <boxGeometry args={[0.55, h / n, 0.55]} />
          <meshStandardMaterial color={over ? '#ff6b5a' : '#d6a744'} metalness={1} roughness={0.3} emissive={over ? '#ff6b5a' : '#000000'} emissiveIntensity={over ? 0.6 : 0} />
        </mesh>
      ))}
    </group>
  )
}

export function Pad3D({ rocketId, satellites, fill, over }: { rocketId: string; satellites: number; fill: number; over: boolean }) {
  const h = rocketHeight(rocketId)
  return (
    <Shell camera={{ position: [11, 4.5, 17], fov: 38 }} controls={{ target: [0, h * 0.45, 0], autoRotate: true, min: 6, max: 34 }} bloom={0.6}>
      <SkyDome />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#ffd0a8', '#2a2f3c', 0.5]} />
      <directionalLight position={[-20, 12, 10]} intensity={2.6} color="#ffd2a1" castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-12, 12, 16, -4, 1, 80]} />
      </directionalLight>
      <LaunchSite />
      <group position={[0, 0.5 + 0.42, 0]}>
        <RocketModel id={rocketId} payload={<PayloadStack n={satellites} fill={fill} over={over} />} overweight={over} />
      </group>
    </Shell>
  )
}

// ======================= Launch sequence =======================

const smokeVertex = `attribute float aSize; attribute float aAlpha; varying float vAlpha;
void main(){ vAlpha = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`
const smokeFragment = `uniform sampler2D uTex; uniform vec3 uColor; varying float vAlpha;
void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uColor, t.a * vAlpha); }`

function Smoke({ emitter, rate, color = '#d9dde6', additive = false, spread = 1 }: { emitter: () => THREE.Vector3 | null; rate: () => number; color?: string; additive?: boolean; spread?: number }) {
  const N = 900
  const state = useMemo(() => ({
    pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), age: new Float32Array(N).fill(99), life: new Float32Array(N), size: new Float32Array(N), alpha: new Float32Array(N), next: 0, acc: 0,
  }), [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(state.pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(state.size, 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(state.alpha, 1))
    return g
  }, [state])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: smokeVertex, fragmentShader: smokeFragment, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uTex: { value: softDotTexture() }, uColor: { value: new THREE.Color(color) } },
  }), [additive, color])
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const e = emitter()
    state.acc += rate() * dt
    while (e && state.acc >= 1) {
      state.acc -= 1
      const i = state.next
      state.next = (state.next + 1) % N
      state.pos[i * 3] = e.x + (Math.random() - 0.5) * 0.4 * spread
      state.pos[i * 3 + 1] = e.y
      state.pos[i * 3 + 2] = e.z + (Math.random() - 0.5) * 0.4 * spread
      const a = Math.random() * Math.PI * 2
      const out = (e.y < 3 ? 3.5 : 0.6) * spread * (0.4 + Math.random())
      state.vel[i * 3] = Math.cos(a) * out
      state.vel[i * 3 + 1] = e.y < 3 ? Math.random() * 0.8 : -1 - Math.random() * 2
      state.vel[i * 3 + 2] = Math.sin(a) * out
      state.age[i] = 0
      state.life[i] = 2.5 + Math.random() * 2.5
    }
    if (!e) state.acc = 0
    for (let i = 0; i < N; i++) {
      if (state.age[i] > state.life[i]) { state.alpha[i] = 0; continue }
      state.age[i] += dt
      const k = state.age[i] / state.life[i]
      state.pos[i * 3] += state.vel[i * 3] * dt
      state.pos[i * 3 + 1] += state.vel[i * 3 + 1] * dt
      state.pos[i * 3 + 2] += state.vel[i * 3 + 2] * dt
      state.vel[i * 3] *= 0.985; state.vel[i * 3 + 2] *= 0.985
      state.vel[i * 3 + 1] += 0.35 * dt
      state.size[i] = (1.5 + k * 9) * spread
      state.alpha[i] = (additive ? 0.9 : 0.55) * (1 - k) * Math.min(1, state.age[i] * 6)
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.aSize.needsUpdate = true
    geo.attributes.aAlpha.needsUpdate = true
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

function LaunchDirector({ rocketId, success, elapsed }: { rocketId: string; success: boolean; elapsed: () => number }) {
  const { camera } = useThree()
  const rocket = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const boom = useRef<THREE.Mesh>(null)
  const sky = useRef(0)
  const throttle = useRef(0)
  const nozzle = useRef(new THREE.Vector3())
  const exploded = useRef(false)
  const h = rocketHeight(rocketId)

  useFrame(({ clock }) => {
    const t = elapsed()
    const r = rocket.current
    if (!r) return
    const failAt = 3.9
    throttle.current = t < 1.5 ? 0 : t < 2.1 ? (t - 1.5) / 0.6 : 1
    const lift = Math.max(0, t - 2.1)
    let y = 0.92 + 0.5 * 5.5 * lift * lift
    if (!success && t > failAt) {
      r.rotation.z = Math.min(1.4, (t - failAt) * 0.9)
      y += (t - failAt) * 2
      if (t > failAt + 0.7) exploded.current = true
    }
    r.position.y = y
    r.visible = !exploded.current
    nozzle.current.set(0, y - 0.4, 0)
    // camera follows the rocket up, shaking while the engines roar near the ground
    const shake = throttle.current > 0 && y < 20 ? 0.05 * throttle.current : 0
    const dist = 22 + Math.min(18, y * 0.2)
    camera.position.set(dist * 0.55 + Math.sin(clock.elapsedTime * 40) * shake, Math.max(3, y * 0.85 + 1.5) + Math.cos(clock.elapsedTime * 37) * shake, dist * 0.84)
    camera.lookAt(0, y + h * 0.35, 0)
    sky.current = Math.min(1, y / 70)
    if (light.current) { light.current.position.set(0, y - 1, 0); light.current.intensity = exploded.current ? 0 : throttle.current * 60 }
    if (boom.current) {
      const bt = t - (failAt + 0.7)
      boom.current.visible = !success && bt > 0 && bt < 2.2
      if (bt > 0) {
        boom.current.position.set(2, y + 2, 0)
        boom.current.scale.setScalar(1 + bt * 9)
        ;(boom.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - bt / 2.2)
      }
    }
  })

  return (
    <>
      <SkyUpdater sky={sky} />
      <group ref={rocket}><RocketModel id={rocketId} throttle={throttle} /></group>
      <pointLight ref={light} color="#ffb347" distance={60} decay={1.6} />
      <mesh ref={boom} visible={false}><sphereGeometry args={[1, 32, 16]} /><meshBasicMaterial color="#ffb347" transparent toneMapped={false} /></mesh>
      <Smoke emitter={() => (throttle.current > 0.05 && !exploded.current ? nozzle.current : null)} rate={() => 260 * throttle.current} spread={h / 8} />
      <Smoke emitter={() => (exploded.current && elapsed() < 6.5 ? nozzle.current : null)} rate={() => 500} color="#ff9a3c" additive spread={2} />
    </>
  )
}

function SkyUpdater({ sky }: { sky: React.RefObject<number> }) {
  const { scene } = useThree()
  useFrame(() => {
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined
      if (m && m.uniforms && 'uAlt' in m.uniforms) m.uniforms.uAlt.value = sky.current
    })
  })
  return null
}

export function Launch3D({ rocketId, success, elapsed }: { rocketId: string; success: boolean; elapsed: () => number }) {
  return (
    <Shell camera={{ position: [12, 3, 18.5], fov: 40 }} controls={{ enabled: false }} bloom={1.3} className="full" transparent>
      <SkyDome />
      <ambientLight intensity={0.3} />
      <hemisphereLight args={['#ffd0a8', '#2a2f3c', 0.5]} />
      <directionalLight position={[-20, 12, 10]} intensity={2.4} color="#ffd2a1" castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-12, 12, 16, -4, 1, 80]} />
      </directionalLight>
      <Stars radius={300} depth={60} count={3000} factor={6} fade speed={0} />
      <LaunchSite />
      <LaunchDirector rocketId={rocketId} success={success} elapsed={elapsed} />
    </Shell>
  )
}
