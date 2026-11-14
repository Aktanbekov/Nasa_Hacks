// Deterministic randomness: the same seed and keys always give the same number,
// so the server and every client replay a mission identically.
export function hashRand(seed: number, ...keys: (string | number)[]): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  for (const k of keys) {
    const s = String(k)
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 0x85ebca6b)
      h = (h ^ (h >>> 13)) >>> 0
    }
    h = Math.imul(h ^ 0x27d4eb2f, 0xc2b2ae35) >>> 0
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31)
