// Procedural textures drawn on canvases at runtime, so the game needs no
// image downloads. Results are cached per page load.
import { useEffect, useState } from 'react'
import * as THREE from 'three'

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return { c, ctx: c.getContext('2d')! }
}

function toTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

const cache = new Map<string, unknown>()
function cached<T>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key) as T
}

// ---------- planets ----------
// Earth and Moon use real NASA maps from /public/textures (see the Sources page).
// The procedural painter in the worker is the fallback if those can't load.
type Layers = Record<string, Uint8ClampedArray>
type Painted = { w: number; h: number; layers: Layers; ok: boolean }
let worker: Worker | null = null
const jobs = new Map<string, Promise<Painted>>()
const waiting = new Map<string, (v: Painted) => void>()

function paint(kind: 'earth' | 'moon' | 'earth-nasa', w: number, h: number, urls?: string[]) {
  const key = `${kind}-${w}`
  if (!jobs.has(key)) {
    jobs.set(key, new Promise((resolve) => {
      if (!worker) {
        worker = new Worker(new URL('./texture.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = (e: MessageEvent<Painted & { kind: string }>) => {
          const k = `${e.data.kind}-${e.data.w}`
          waiting.get(k)?.(e.data)
          waiting.delete(k)
        }
      }
      waiting.set(key, resolve)
      worker.postMessage({ kind, w, h, urls })
    }))
  }
  return jobs.get(key)!
}

function layerTexture(data: Uint8ClampedArray, w: number, h: number, srgb = true) {
  const { c, ctx } = canvas(w, h)
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0)
  return toTexture(c, srgb)
}

export interface EarthTex { map: THREE.Texture; roughness: THREE.Texture; clouds: THREE.Texture; nasa: boolean }
export interface MoonTex { map: THREE.Texture; nasa: boolean }

const asset = (p: string) => new URL(p, location.href).href

export function loadEarthTextures(): Promise<EarthTex> {
  return cached('earth', async () => {
    const real = await paint('earth-nasa', 2048, 1024, [asset('/textures/earth_day_2048.jpg'), asset('/textures/earth_clouds_src_2048.jpg')])
    const { w, h, layers } = real.ok ? real : await paint('earth', 1024, 512)
    return { map: layerTexture(layers.day, w, h), roughness: layerTexture(layers.rough, w, h, false), clouds: layerTexture(layers.clouds, w, h), nasa: real.ok }
  })
}

export function loadMoonTextures(): Promise<MoonTex> {
  return cached('moon', () => new Promise<MoonTex>((resolve) => {
    new THREE.TextureLoader().load(asset('/textures/moon_lroc_2048.jpg'), (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      resolve({ map: t, nasa: true })
    }, undefined, () => {
      paint('moon', 1024, 512).then(({ w, h, layers }) => resolve({ map: layerTexture(layers.day, w, h), nasa: false }))
    })
  }))
}

/** Returns the textures once the worker has painted them (null until then). */
export function useAsync<T>(load: () => Promise<T>): T | null {
  const [v, setV] = useState<T | null>(null)
  useEffect(() => { let live = true; load().then((r) => { if (live) setV(r) }); return () => { live = false } }, [load])
  return v
}

export function foilTexture() {
  return cached('foil', () => {
    const { c, ctx } = canvas(512, 512)
    ctx.fillStyle = '#d6a744'
    ctx.fillRect(0, 0, 512, 512)
    let s = 3
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    for (let k = 0; k < 900; k++) {
      const x = rnd() * 512, y = rnd() * 512, r = 10 + rnd() * 40
      ctx.beginPath()
      const n = 5 + Math.floor(rnd() * 4)
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + rnd() * 0.4
        const rr = r * (0.6 + rnd() * 0.6)
        if (j === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      }
      ctx.closePath()
      const l = rnd()
      ctx.fillStyle = l > 0.6 ? `rgba(255,226,140,${0.15 + rnd() * 0.25})` : `rgba(120,80,20,${0.1 + rnd() * 0.25})`
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(255,240,200,0.25)'
    for (let k = 0; k < 120; k++) { ctx.beginPath(); ctx.moveTo(rnd() * 512, rnd() * 512); ctx.lineTo(rnd() * 512, rnd() * 512); ctx.stroke() }
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  })
}

export function cellTexture() {
  return cached('cells', () => {
    const { c, ctx } = canvas(256, 256)
    ctx.fillStyle = '#0c1d4d'
    ctx.fillRect(0, 0, 256, 256)
    const n = 6
    const sz = 256 / n
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const g = ctx.createLinearGradient(i * sz, j * sz, (i + 1) * sz, (j + 1) * sz)
      g.addColorStop(0, '#1d3f95'); g.addColorStop(1, '#10275e')
      ctx.fillStyle = g
      ctx.fillRect(i * sz + 3, j * sz + 3, sz - 6, sz - 6)
      ctx.strokeStyle = 'rgba(160,190,255,0.35)'
      ctx.lineWidth = 1
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(i * sz + 3, j * sz + (k * sz) / 4); ctx.lineTo((i + 1) * sz - 3, j * sz + (k * sz) / 4); ctx.stroke() }
    }
    ctx.strokeStyle = '#c9d2e6'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, 253, 253)
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  })
}

export function softDotTexture() {
  return cached('dot', () => {
    const { c, ctx } = canvas(64, 64)
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64)
    return toTexture(c)
  })
}

export function groundTexture() {
  return cached('ground', () => {
    const { c, ctx } = canvas(256, 256)
    ctx.fillStyle = '#3d4438'; ctx.fillRect(0, 0, 256, 256)
    let s = 11
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    for (let k = 0; k < 500; k++) {
      const x = rnd() * 256, y = rnd() * 256, r = 4 + rnd() * 26
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const light = rnd() > 0.5
      g.addColorStop(0, light ? 'rgba(110,118,92,0.35)' : 'rgba(30,34,28,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(16, 16)
    return t
  })
}

/** Lat/lon (degrees) to a point on a sphere of radius r, matching the texture mapping of THREE.SphereGeometry. */
export function latLonToVec3(lat: number, lon: number, r: number) {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lon + 180) * Math.PI) / 180
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}
