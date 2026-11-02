/**
 * Downloads Türkiye's 81 province boundaries (geoBoundaries ADM1, from OpenStreetMap),
 * simplifies them and writes content/geo/provinces.json. Run once, commit the result:
 *
 *   npm run fetch:provinces
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'content', 'geo', 'provinces.json')
const API = 'https://www.geoboundaries.org/api/current/gbOpen/TUR/ADM1/'
// ~1 km: invisible at the size the map is drawn, and shrinks the file ~15×.
const TOLERANCE = 0.01

type Ring = [number, number][]
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }
type Feature = { properties: { shapeName: string; shapeISO: string }; geometry: Geometry }

/** Douglas–Peucker on lon/lat degrees. */
function simplify(ring: Ring): Ring {
  const keep = new Uint8Array(ring.length)
  keep[0] = keep[ring.length - 1] = 1
  const stack: [number, number][] = [[0, ring.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = ring[a]
    const [bx, by] = ring[b]
    const len = Math.hypot(bx - ax, by - ay)
    let max = 0
    let at = -1
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i]
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len
      if (d > max) [max, at] = [d, i]
    }
    if (max > TOLERANCE) {
      keep[at] = 1
      stack.push([a, at], [at, b])
    }
  }
  return ring.filter((_, i) => keep[i]).map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])
}

type Meta = { boundaryID: string; boundarySource: string; boundaryLicense: string; simplifiedGeometryGeoJSON: string }
const meta = (await (await fetch(API)).json()) as Meta
const res = await fetch(meta.simplifiedGeometryGeoJSON)
if (!res.ok) throw new Error(`${meta.simplifiedGeometryGeoJSON}: ${res.status}`)
const geo = (await res.json()) as { features: Feature[] }

const provinces = geo.features
  .map((f) => {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    const rings = polygons.flat().map(simplify).filter((r) => r.length >= 4)
    return { iso: f.properties.shapeISO, name: f.properties.shapeName, rings }
  })
  .sort((a, b) => a.iso.localeCompare(b.iso))

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(
  OUT,
  JSON.stringify({
    source: `geoBoundaries ${meta.boundaryID} (${meta.boundarySource})`,
    license: meta.boundaryLicense,
    provinces,
  }),
)
const points = provinces.reduce((n, p) => n + p.rings.reduce((m, r) => m + r.length, 0), 0)
console.log(`✔ ${provinces.length} provinces, ${points} points → ${path.relative(ROOT, OUT)}`)
