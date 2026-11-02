/**
 * Downloads the world's country boundaries (Natural Earth 1:110m, public domain) and writes
 * content/geo/world.json. Run once, commit the result:
 *
 *   npm run fetch:world
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'content', 'geo', 'world.json')
const URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

type Ring = [number, number][]
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }
type Feature = {
  properties: { ISO_A2_EH: string; ADM0_A3: string; NAME_EN: string; NAME_TR: string }
  geometry: Geometry
}

const res = await fetch(URL)
if (!res.ok) throw new Error(`${URL}: ${res.status}`)
const geo = (await res.json()) as { features: Feature[] }

const countries = geo.features
  // Antarctica would take a third of the map and has no mushrooms worth mapping.
  .filter((f) => f.properties.ADM0_A3 !== 'ATA')
  .map((f) => {
    const p = f.properties
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    return {
      // GBIF reports records by ISO 3166 alpha-2; the few unrecognised states get their A3 code.
      iso: p.ISO_A2_EH === '-99' ? p.ADM0_A3 : p.ISO_A2_EH,
      name: { tr: p.NAME_TR, en: p.NAME_EN },
      rings: polygons.flat().map((r) => r.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100])),
    }
  })
  .sort((a, b) => a.iso.localeCompare(b.iso))

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ source: 'Natural Earth 1:110m Admin 0 – Countries', license: 'Public domain', countries }))
console.log(`✔ ${countries.length} countries → ${path.relative(ROOT, OUT)}`)
