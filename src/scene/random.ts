import { Vector3 } from 'three'

/** Small seeded PRNG so the mycelium looks the same on every visit. */
export function seeded(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomUnit(rand: () => number, out = new Vector3()) {
  const u = rand() * 2 - 1
  const a = rand() * Math.PI * 2
  const r = Math.sqrt(1 - u * u)
  return out.set(r * Math.cos(a), u, r * Math.sin(a))
}
