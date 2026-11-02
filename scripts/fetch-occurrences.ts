/**
 * Downloads each species' geolocated records in Türkiye from GBIF, plus its record count per
 * country worldwide, and writes content/distribution/<id>.json. Run now and then, review the diff, commit:
 *
 *   npm run fetch:occurrences              # every species
 *   npm run fetch:occurrences -- boletus-edulis amanita-muscaria
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const ROOT = path.resolve(import.meta.dirname, '..')
const SPECIES = path.join(ROOT, 'content', 'species')
const OUT = path.join(ROOT, 'content', 'distribution')
const API = 'https://api.gbif.org/v1'
// Records vaguer than this (e.g. "somewhere in the province") would put a misleading dot on the map.
const MAX_UNCERTAINTY_M = 25_000

async function get<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res.json() as Promise<T>
    // GBIF rate-limits bursts (429): back off and try again.
    if ((res.status !== 429 && res.status < 500) || attempt === 5) throw new Error(`${url}: ${res.status}`)
    const wait = Number(res.headers.get('retry-after')) || 5 * attempt
    console.warn(`  … ${res.status}, retrying in ${wait}s`)
    await new Promise((r) => setTimeout(r, wait * 1000))
  }
}

type Match = { usageKey?: number; matchType: string; status?: string; acceptedUsageKey?: number; scientificName?: string }
type Occurrence = { decimalLongitude: number; decimalLatitude: number; coordinateUncertaintyInMeters?: number; year?: number }
type Page = { count: number; endOfRecords: boolean; results: Occurrence[] }

const only = new Set(process.argv.slice(2))
const files = fs.readdirSync(SPECIES).filter((f) => f.endsWith('.md') && (only.size === 0 || only.has(f.slice(0, -3))))
fs.mkdirSync(OUT, { recursive: true })

for (const file of files.sort()) {
  const { id, latin } = matter(fs.readFileSync(path.join(SPECIES, file), 'utf8')).data as { id: string; latin: string }
  const match = await get<Match>(`${API}/species/match?kingdom=Fungi&name=${encodeURIComponent(latin)}`)
  const taxonKey = match.acceptedUsageKey ?? match.usageKey
  if (!taxonKey || match.matchType !== 'EXACT') {
    console.warn(`⚠ ${id}: no exact GBIF match for "${latin}" (${match.matchType}), skipped`)
    continue
  }

  const query = `country=TR&taxonKey=${taxonKey}&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT`
  const seen = new Set<string>()
  const points: [number, number][] = []
  const years: number[] = []
  let count = 0
  for (let offset = 0; ; offset += 300) {
    const page = await get<Page>(`${API}/occurrence/search?${query}&limit=300&offset=${offset}`)
    count = page.count
    for (const o of page.results) {
      if ((o.coordinateUncertaintyInMeters ?? 0) > MAX_UNCERTAINTY_M) continue
      // Whole-degree coordinates (e.g. 28, 42 — out in the Black Sea) are placeholders, not places.
      if (Number.isInteger(o.decimalLongitude) && Number.isInteger(o.decimalLatitude)) continue
      if (o.year) years.push(o.year)
      // ~1 km grid: repeated visits to the same spot become one dot.
      const p: [number, number] = [Math.round(o.decimalLongitude * 100) / 100, Math.round(o.decimalLatitude * 100) / 100]
      const key = p.join()
      if (seen.has(key)) continue
      seen.add(key)
      points.push(p)
    }
    if (page.endOfRecords || offset + 300 >= 3000) break
  }
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1])

  // Worldwide, only the number of records per country: far too many to keep every point.
  const world = await get<Page & { facets: { counts: { name: string; count: number }[] }[] }>(
    `${API}/occurrence/search?taxonKey=${taxonKey}&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&limit=0&facet=country&facetLimit=300`,
  )
  const countries = Object.fromEntries((world.facets[0]?.counts ?? []).map((c) => [c.name, c.count]))

  const out = {
    source: 'GBIF',
    taxonKey,
    gbifName: match.scientificName,
    records: count,
    years: years.length ? [Math.min(...years), Math.max(...years)] : null,
    points,
    worldRecords: world.count,
    countries,
  }
  fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(out, null, 1).replace(/\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]/g, '[$1, $2]') + '\n')
  console.log(`✔ ${id}: ${count} records, ${points.length} places; ${world.count} worldwide in ${Object.keys(countries).length} countries`)
}
