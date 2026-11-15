// Background worker that paints the planet textures, so the page never freezes.
// Receives { kind: 'earth' | 'moon', w, h } and posts back raw RGBA layers.

function hash(x: number, y: number, z: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const fade = (t: number) => t * t * (3 - 2 * t)
function noise3(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi)
  const c000 = hash(xi, yi, zi, seed), c100 = hash(xi + 1, yi, zi, seed), c010 = hash(xi, yi + 1, zi, seed), c110 = hash(xi + 1, yi + 1, zi, seed)
  const c001 = hash(xi, yi, zi + 1, seed), c101 = hash(xi + 1, yi, zi + 1, seed), c011 = hash(xi, yi + 1, zi + 1, seed), c111 = hash(xi + 1, yi + 1, zi + 1, seed)
  const x00 = c000 + (c100 - c000) * xf, x10 = c010 + (c110 - c010) * xf, x01 = c001 + (c101 - c001) * xf, x11 = c011 + (c111 - c011) * xf
  const y0 = x00 + (x10 - x00) * yf, y1 = x01 + (x11 - x01) * yf
  return y0 + (y1 - y0) * zf
}
function fbm(x: number, y: number, z: number, oct: number, seed: number) {
  let a = 0.5, f = 1, s = 0, n = 0
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03 }
  return s / n
}
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const toVec = (lat: number, lon: number) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]
}

// Rough continent centers (lat, lon, radius in degrees) so the planet reads as Earth.
const CONTINENTS: [number, number, number][] = [
  [48, -102, 30], [62, -110, 22], [34, -112, 14], [18, -95, 9], [72, -42, 12],
  [-12, -58, 20], [-34, -64, 12],
  [8, 20, 24], [-18, 26, 16], [26, 10, 18],
  [52, 40, 24], [56, 90, 30], [35, 100, 22], [24, 78, 12], [62, 130, 22],
  [-25, 134, 14], [-78, 0, 20], [-80, 120, 18], [-80, -120, 18],
]
const CONT = CONTINENTS.map(([la, lo, r]) => ({ v: toVec(la, lo), cos: Math.cos((r * Math.PI) / 180) }))

function earth(W: number, H: number) {
  const day = new Uint8ClampedArray(W * H * 4)
  const rough = new Uint8ClampedArray(W * H * 4)
  const clouds = new Uint8ClampedArray(W * H * 4)
  const deep = hex('#071d4a'), shallow = hex('#1c6bb5'), lowland = hex('#3b7a34'), forest = hex('#2c5f2b'), desert = hex('#c8a565'), mountain = hex('#7d6f5e'), ice = hex('#eef4fa')
  for (let y = 0; y < H; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * 360 - 180
      const [px, py, pz] = toVec(lat, lon)
      let cont = 0
      for (const c of CONT) {
        const d = px * c.v[0] + py * c.v[1] + pz * c.v[2]
        if (d > c.cos) cont = Math.max(cont, (d - c.cos) / (1 - c.cos))
      }
      const n = fbm(px * 2.2 + 5, py * 2.2, pz * 2.2, 6, 3)
      const h = cont * 0.62 + (n - 0.5) * 0.9
      const i = (y * W + x) * 4
      let col: number[]
      let r = 230
      const polar = Math.abs(lat) + (fbm(px * 4, py * 4, pz * 4, 3, 9) - 0.5) * 14
      if (h > 0.18) {
        const e = smooth(0.18, 0.75, h)
        const moist = fbm(px * 3 + 9, py * 3, pz * 3, 4, 21)
        const dry = smooth(0.52, 0.66, moist) * (1 - smooth(45, 60, Math.abs(lat)))
        col = mix(mix(lowland, forest, smooth(0.3, 0.7, moist)), desert, dry)
        const ridge = fbm(px * 9, py * 9, pz * 9, 3, 33)
        col = mix(col, mountain, smooth(0.62, 0.9, e) * smooth(0.45, 0.65, ridge))
        if (e > 0.9 && ridge > 0.6) col = mix(col, ice, smooth(0.9, 1.0, e) * 0.8)
      } else {
        col = mix(deep, shallow, smooth(-0.15, 0.18, h))
        r = 150
      }
      if (polar > 72) { col = mix(col, ice, smooth(72, 76, polar)); r = 200 }
      day[i] = col[0]; day[i + 1] = col[1]; day[i + 2] = col[2]; day[i + 3] = 255
      rough[i] = r; rough[i + 1] = r; rough[i + 2] = r; rough[i + 3] = 255
      // streaky clouds: stretched along longitude and warped
      const warp = fbm(px * 2, py * 2, pz * 2, 3, 61) * 2.5
      const cn = fbm(px * 4 + warp, py * 11, pz * 4 + warp, 5, 40)
      const band = 0.08 * Math.cos((lat * Math.PI) / 30)
      const a = smooth(0.56, 0.74, cn + band) * (0.55 + 0.45 * smooth(0.4, 0.7, cn))
      clouds[i] = 255; clouds[i + 1] = 255; clouds[i + 2] = 255; clouds[i + 3] = Math.round(a * 220)
    }
  }
  return { day, rough, clouds }
}

function moon(W: number, H: number) {
  const day = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * 360 - 180
      const [px, py, pz] = toVec(lat, lon)
      const maria = smooth(0.55, 0.62, fbm(px * 1.6, py * 1.6, pz * 1.6, 4, 77))
      const g = fbm(px * 8, py * 8, pz * 8, 5, 5)
      let v = 150 + (g - 0.5) * 70 - maria * 55
      if (lat < -78) v -= smooth(-78, -88, lat) * 70
      const i = (y * W + x) * 4
      day[i] = v; day[i + 1] = v; day[i + 2] = v + 6; day[i + 3] = 255
    }
  }
  // craters, drawn with a 2D context when the worker has OffscreenCanvas
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(W, H)
    const ctx = c.getContext('2d')!
    ctx.putImageData(new ImageData(day, W, H), 0, 0)
    let s = 7
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    for (let k = 0; k < 420; k++) {
      const cx = rnd() * W, cy = H * 0.06 + rnd() * H * 0.88
      const r = (Math.pow(rnd(), 3) * 26 + 2) * (W / 1024)
      const sx = r / Math.max(0.25, Math.cos(((cy / H) * 180 - 90) * Math.PI / 180))
      const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.2, cx, cy, r)
      grad.addColorStop(0, 'rgba(40,42,48,0.35)')
      grad.addColorStop(0.75, 'rgba(60,62,70,0.15)')
      grad.addColorStop(0.92, 'rgba(235,238,245,0.35)')
      grad.addColorStop(1, 'rgba(235,238,245,0)')
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sx / r, 1); ctx.translate(-cx, -cy)
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    }
    return { day: ctx.getImageData(0, 0, W, H).data }
  }
  return { day }
}

/** Decode an image URL into RGBA pixels (needs OffscreenCanvas). */
async function pixels(url: string) {
  const blob = await (await fetch(url)).blob()
  const bmp = await createImageBitmap(blob)
  const c = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = c.getContext('2d')!
  ctx.drawImage(bmp, 0, 0)
  return { w: bmp.width, h: bmp.height, data: ctx.getImageData(0, 0, bmp.width, bmp.height).data }
}

/**
 * NASA Blue Marble (SVS 3615): the clear-sky map is the surface; subtracting it
 * from the cloudy map gives a real cloud layer. Oceans (blue-dominant pixels)
 * get low roughness so sunlight glints off them.
 */
async function earthNasa(dayUrl: string, cloudUrl: string) {
  const day = await pixels(dayUrl)
  const cl = await pixels(cloudUrl)
  const n = day.w * day.h
  const rough = new Uint8ClampedArray(n * 4)
  const clouds = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const r = day.data[o], g = day.data[o + 1], b = day.data[o + 2]
    const ocean = b > r + 18 && b > g + 4
    const rv = ocean ? 120 : 235
    rough[o] = rv; rough[o + 1] = rv; rough[o + 2] = rv; rough[o + 3] = 255
    const lumD = 0.3 * r + 0.59 * g + 0.11 * b
    const lumC = 0.3 * cl.data[o] + 0.59 * cl.data[o + 1] + 0.11 * cl.data[o + 2]
    const a = Math.max(0, Math.min(255, (lumC - lumD - 6) * 2.6))
    clouds[o] = 255; clouds[o + 1] = 255; clouds[o + 2] = 255; clouds[o + 3] = a
  }
  return { w: day.w, h: day.h, layers: { day: day.data, rough, clouds } }
}

self.onmessage = async (e: MessageEvent<{ kind: 'earth' | 'moon' | 'earth-nasa'; w: number; h: number; urls?: string[] }>) => {
  const { kind, w, h, urls } = e.data
  if (kind === 'earth-nasa') {
    try {
      const r = await earthNasa(urls![0], urls![1])
      const buffers = Object.values(r.layers).map((a) => a.buffer as ArrayBuffer)
      ;(self as unknown as Worker).postMessage({ ...r, kind, w, ok: true }, buffers)
    } catch (err) {
      ;(self as unknown as Worker).postMessage({ kind, w, h, ok: false, error: String(err) })
    }
    return
  }
  const layers = kind === 'earth' ? earth(w, h) : moon(w, h)
  const buffers = Object.values(layers).map((a) => a.buffer as ArrayBuffer)
  ;(self as unknown as Worker).postMessage({ kind, w, h, layers, ok: true }, buffers)
}
