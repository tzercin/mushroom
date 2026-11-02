/**
 * Builds the static data the app loads at runtime:
 *   public/data/tree.json            – every clade + species with a precomputed 3D layout
 *   public/data/species/<id>.json    – per-species details, fetched when a species is opened
 *   public/data/clades/<id>.json     – per-clade descriptions, fetched when a clade is opened
 *
 * Sources: content/tree/clades.yml, content/clades/*.md and content/species/*.md
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import YAML from 'yaml'
import { z } from 'zod'
import { hierarchy, tree as d3tree, type HierarchyNode } from 'd3-hierarchy'
import { forceSimulation, forceLink, forceManyBody, forceCollide } from 'd3-force-3d'
import { EDIBILITY, FORMS, type CladeDetail, type Localized, type Lookalike, type Rank, type SpeciesDetail, type TreeData, type TreeNode, type TurkeyMap, type WorldMap } from '../src/data/types'

const ROOT = path.resolve(import.meta.dirname, '..')
const CONTENT = path.join(ROOT, 'content')
const OUT = path.join(ROOT, 'public', 'data')

// ---------- schemas ----------

const id = z.string().regex(/^[a-z0-9-]+$/, 'ids are lowercase-kebab-case')

type CladeInput = {
  id: string
  name: string
  rank: Exclude<Rank, 'species'>
  tr?: string
  en?: string
  children?: CladeInput[]
}
const Clade: z.ZodType<CladeInput> = z.lazy(() =>
  z.object({
    id,
    name: z.string(),
    rank: z.enum(['kingdom', 'phylum', 'class', 'order', 'family', 'genus']),
    tr: z.string().optional(),
    en: z.string().optional(),
    children: z.array(Clade).optional(),
  }),
)

const localized = z.object({ tr: z.string(), en: z.string() })
// Either a species in the network (by id) or one outside it (by name); both say how to tell them apart.
const LookalikeInput = z.union([
  z.strictObject({ id, note: localized }),
  z.strictObject({ latin: z.string(), tr: z.string().optional(), en: z.string().optional(), edibility: z.enum(EDIBILITY), note: localized }),
])
const Species = z.object({
  id,
  latin: z.string(),
  parent: id,
  tr: z.string().optional(),
  en: z.string().optional(),
  edibility: z.enum(EDIBILITY),
  look: z.object({
    form: z.enum(FORMS),
    color: z.string().regex(/^#[0-9a-f]{6}$/i, 'colours are #rrggbb').optional(),
    spots: z.boolean().optional(),
  }),
  habitat: localized,
  photos: z
    .array(z.object({ file: z.string(), author: z.string(), license: z.string(), source: z.url({ protocol: /^https?$/ }).optional() }))
    .default([]),
  lookalikes: z.array(LookalikeInput).default([]),
})

// ---------- load ----------

function fail(msg: string): never {
  console.error(`✖ ${msg}`)
  process.exit(1)
}

const cladeRoot = Clade.parse(YAML.parse(fs.readFileSync(path.join(CONTENT, 'tree', 'clades.yml'), 'utf8')))

type Raw = {
  id: string
  name: string
  rank: Rank
  tr?: string
  en?: string
  children: Raw[]
  edibility?: TreeNode['edibility']
  look?: { form: NonNullable<TreeNode['form']>; color?: string; spots?: boolean }
}
const byId = new Map<string, Raw>()
function addClade(c: CladeInput): Raw {
  if (byId.has(c.id)) fail(`duplicate id "${c.id}"`)
  const raw: Raw = { id: c.id, name: c.name, rank: c.rank, tr: c.tr, en: c.en, children: [] }
  byId.set(c.id, raw)
  raw.children = (c.children ?? []).map(addClade)
  return raw
}
const root = addClade(cladeRoot)

/** Splits a markdown body into its "## tr" and "## en" sections. */
function description(file: string, body: string): Localized {
  const sections: Record<string, string> = {}
  for (const part of body.split(/^##\s+/m).slice(1)) {
    const [head, ...rest] = part.split('\n')
    sections[head.trim().toLowerCase()] = rest.join('\n').trim()
  }
  if (!sections.tr || !sections.en) fail(`${file}: body needs both "## tr" and "## en" sections`)
  return { tr: sections.tr, en: sections.en }
}

const speciesDir = path.join(CONTENT, 'species')
const details: SpeciesDetail[] = []
for (const file of fs.readdirSync(speciesDir).filter((f) => f.endsWith('.md')).sort()) {
  const { data, content } = matter(fs.readFileSync(path.join(speciesDir, file), 'utf8'))
  const parsed = Species.safeParse(data)
  if (!parsed.success) fail(`${file}: ${z.prettifyError(parsed.error)}`)
  const s = parsed.data
  if (`${s.id}.md` !== file) fail(`${file}: id "${s.id}" must match the file name`)
  if (byId.has(s.id)) fail(`${file}: duplicate id "${s.id}"`)
  const parent = byId.get(s.parent)
  if (!parent) fail(`${file}: unknown parent "${s.parent}"`)

  const raw: Raw = { id: s.id, name: s.latin, rank: 'species', tr: s.tr, en: s.en, children: [], edibility: s.edibility, look: s.look }
  byId.set(s.id, raw)
  parent.children.push(raw)
  details.push({ id: s.id, habitat: s.habitat, description: description(file, content), photos: s.photos, lookalikes: s.lookalikes })
}

// Lookalikes within the network go both ways: if A lists B, B gets A with the same note
// (unless B already lists A with a note of its own).
const detailById = new Map(details.map((d) => [d.id, d]))
for (const d of details) {
  const seen = new Set<string>()
  for (const l of d.lookalikes) {
    const key = 'id' in l ? l.id : l.latin
    if (seen.has(key)) fail(`${d.id}.md: lookalike "${key}" is listed twice`)
    seen.add(key)
    if (!('id' in l)) {
      if (detailById.has(l.latin.toLowerCase().replace(/\s+/g, '-'))) fail(`${d.id}.md: lookalike "${l.latin}" is in the network, list it by id`)
      continue
    }
    if (l.id === d.id) fail(`${d.id}.md: a species can't be its own lookalike`)
    if (!detailById.has(l.id)) fail(`${d.id}.md: lookalike "${l.id}" is not a species`)
  }
}
for (const d of details)
  for (const l of d.lookalikes) {
    if (!('id' in l)) continue
    const other = detailById.get(l.id)!
    if (!other.lookalikes.some((o) => 'id' in o && o.id === d.id)) other.lookalikes.push({ id: d.id, note: l.note } satisfies Lookalike)
  }

// Clade descriptions: content/clades/<id>.md, a body with "## tr" and "## en" sections.
const cladeDir = path.join(CONTENT, 'clades')
const cladeDetails = new Map<string, CladeDetail>()
for (const file of fs.readdirSync(cladeDir).filter((f) => f.endsWith('.md')).sort()) {
  const cid = file.slice(0, -3)
  const node = byId.get(cid)
  if (!node || node.rank === 'species') fail(`clades/${file}: no clade with id "${cid}" in clades.yml`)
  const { content } = matter(fs.readFileSync(path.join(cladeDir, file), 'utf8'))
  cladeDetails.set(cid, { id: cid, description: description(`clades/${file}`, content) })
}

// ---------- distribution ----------
// content/geo/provinces.json (scripts/fetch-provinces.ts) becomes an SVG map; each
// content/distribution/<id>.json (scripts/fetch-occurrences.ts) becomes dots on it, plus
// the provinces those dots fall in. content/geo/world.json (scripts/fetch-world.ts) becomes
// the world map, tinted by each species' record count per country.

type LonLat = [number, number]
const geo: { source: string; license: string; provinces: { iso: string; name: string; rings: LonLat[][] }[] } = JSON.parse(
  fs.readFileSync(path.join(CONTENT, 'geo', 'provinces.json'), 'utf8'),
)
const allPoints = geo.provinces.flatMap((p) => p.rings.flat())
const [lonMin, lonMax] = [Math.min(...allPoints.map((p) => p[0])), Math.max(...allPoints.map((p) => p[0]))]
const [latMin, latMax] = [Math.min(...allPoints.map((p) => p[1])), Math.max(...allPoints.map((p) => p[1]))]
// Equirectangular, squeezed east–west by cos(mid-latitude): close enough over Türkiye's 6° of latitude.
const kx = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180)
const MAP_W = 1000
const mapScale = MAP_W / ((lonMax - lonMin) * kx)
const project = ([lon, lat]: LonLat): [number, number] => [
  Math.round((lon - lonMin) * kx * mapScale * 10) / 10,
  Math.round((latMax - lat) * mapScale * 10) / 10,
]
const turkeyMap: TurkeyMap = {
  width: MAP_W,
  height: Math.ceil((latMax - latMin) * mapScale),
  attribution: `${geo.source}, ${geo.license}`,
  provinces: geo.provinces.map((p) => ({
    iso: p.iso,
    name: p.name,
    d: p.rings.map((r) => 'M' + r.map((pt) => project(pt).join(',')).join('L') + 'Z').join(''),
  })),
}

// Equal Earth (Šavrič, Patterson & Jenny 2018): equal-area, so big northern countries don't
// look bigger than they are, and it keeps the familiar rounded world shape.
const world: { source: string; license: string; countries: { iso: string; name: Localized; rings: LonLat[][] }[] } = JSON.parse(
  fs.readFileSync(path.join(CONTENT, 'geo', 'world.json'), 'utf8'),
)
const [A1, A2, A3, A4] = [1.340264, -0.081106, 0.000893, 0.003796]
const M = Math.sqrt(3) / 2
function equalEarth([lon, lat]: LonLat): [number, number] {
  const t = Math.asin(M * Math.sin((lat * Math.PI) / 180))
  const t2 = t * t
  const t6 = t2 * t2 * t2
  const x = ((lon * Math.PI) / 180) * Math.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
  const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
  return [x, y]
}
const worldPoints = world.countries.flatMap((c) => c.rings.flat().map(equalEarth))
const [wxMin, wxMax] = [Math.min(...worldPoints.map((p) => p[0])), Math.max(...worldPoints.map((p) => p[0]))]
const [wyMin, wyMax] = [Math.min(...worldPoints.map((p) => p[1])), Math.max(...worldPoints.map((p) => p[1]))]
const worldScale = MAP_W / (wxMax - wxMin)
const projectWorld = (pt: LonLat) => {
  const [x, y] = equalEarth(pt)
  return `${Math.round((x - wxMin) * worldScale * 10) / 10},${Math.round((wyMax - y) * worldScale * 10) / 10}`
}
const worldMap: WorldMap = {
  width: MAP_W,
  height: Math.ceil((wyMax - wyMin) * worldScale),
  attribution: `${world.source}, ${world.license}`,
  countries: world.countries.map((c) => ({
    iso: c.iso,
    name: c.name,
    d: c.rings.map((r) => 'M' + r.map(projectWorld).join('L') + 'Z').join(''),
  })),
}

/** Even–odd ray casting, so islands and enclaves work without knowing which ring is which. */
function provinceOf([x, y]: LonLat): string | undefined {
  return geo.provinces.find((p) => {
    let inside = false
    for (const ring of p.rings)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
      }
    return inside
  })?.iso
}

const Occurrences = z.object({
  taxonKey: z.number(),
  records: z.number(),
  years: z.tuple([z.number(), z.number()]).nullable(),
  points: z.array(z.tuple([z.number(), z.number()])),
  worldRecords: z.number(),
  countries: z.record(z.string(), z.number()),
})
const distDir = path.join(CONTENT, 'distribution')
let withDistribution = 0
for (const d of details) {
  const file = path.join(distDir, `${d.id}.json`)
  if (!fs.existsSync(file)) {
    console.warn(`⚠ species "${d.id}" has no content/distribution/${d.id}.json (run npm run fetch:occurrences)`)
    continue
  }
  const parsed = Occurrences.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')))
  if (!parsed.success) fail(`distribution/${d.id}.json: ${z.prettifyError(parsed.error)}`)
  const o = parsed.data
  const provinces = new Set(o.points.flatMap((p) => provinceOf(p) ?? []))
  d.distribution = {
    records: o.records,
    years: o.years,
    taxonKey: o.taxonKey,
    points: o.points.map(project),
    provinces: [...provinces].sort(),
    worldRecords: o.worldRecords,
    countries: o.countries,
  }
  withDistribution++
}

// Drop clades that ended up with no species (keeps the network tidy while content grows).
function prune(n: Raw): boolean {
  if (n.rank === 'species') return true
  n.children = n.children.filter(prune)
  if (n.children.length === 0) console.warn(`⚠ clade "${n.id}" has no species — hidden`)
  return n.children.length > 0
}
prune(root)

// ---------- colours ----------
// One hue per order: club fungi glow in cool cyan→violet, sac fungi in warm amber.
const h = hierarchy(root)
const orders = h.descendants().filter((n) => n.data.rank === 'order')
const colorOf = new Map<string, string>()
const groups = { basidiomycota: [175, 300], ascomycota: [18, 48] } as Record<string, [number, number]>
for (const [phylum, [from, to]] of Object.entries(groups)) {
  const inPhylum = orders.filter((o) => o.ancestors().some((a) => a.data.id === phylum))
  inPhylum.forEach((o, i) => {
    const hue = inPhylum.length === 1 ? from : from + ((to - from) * i) / (inPhylum.length - 1)
    o.each((d) => colorOf.set(d.data.id, hsl(hue, 0.85, 0.62)))
  })
  // Phylum and the class nodes above the orders get a paler version of the phylum's hue.
  const p = h.descendants().find((d) => d.data.id === phylum)
  p?.each((d) => colorOf.has(d.data.id) || colorOf.set(d.data.id, hsl((from + to) / 2, 0.45, 0.78)))
}
function hsl(hue: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + hue / 30) % 12
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

// ---------- layout ----------
// Start from a radial tree (so related species begin near each other), lift it into 3D with
// a deterministic jitter, then relax it with a 3D force simulation so it sprawls like mycelium.

let seed = 1337
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

const RING = 7 // distance between depth levels
const radial = d3tree<Raw>()
  .size([2 * Math.PI, 1])
  .separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth))(h.copy())

type SimNode = { id: string; depth: number; x: number; y: number; z: number; fx?: number; fy?: number; fz?: number }
const simNodes = new Map<string, SimNode>()
radial.each((n) => {
  const r = n.depth * RING
  const tilt = (rand() - 0.5) * 1.2 // elevation in radians
  simNodes.set(n.data.id, {
    id: n.data.id,
    depth: n.depth,
    x: r * Math.cos(n.x) * Math.cos(tilt),
    y: r * Math.sin(tilt) * 0.8,
    z: r * Math.sin(n.x) * Math.cos(tilt),
  })
})
const rootSim = simNodes.get(root.id)!
Object.assign(rootSim, { fx: 0, fy: 0, fz: 0 })

// Long trunks near the root, short twigs at the tips: keeps the deep lineages apart.
const LINK = [0, 16, 11, 14, 8, 6, 5]
const links = h.links().map((l) => ({ source: l.source.data.id, target: l.target.data.id, depth: l.target.depth }))
const sim = forceSimulation([...simNodes.values()], 3)
  .force('link', forceLink(links).id((n: SimNode) => n.id).distance((l: { depth: number }) => LINK[l.depth] ?? 3.5).strength(0.9))
  .force('charge', forceManyBody().strength((n: SimNode) => (n.depth >= 6 ? -3 : n.depth <= 3 ? -10 : -6)))
  .force('collide', forceCollide((n: SimNode) => (n.depth >= 6 ? 2.6 : 1.6)))
  .stop()
for (let i = 0; i < 500; i++) sim.tick()

// World scale: tuned so neighbouring species (~5 sim units apart) don't overlap their mushrooms.
const SCALE = 0.6

// ---------- write ----------

const countSpecies = (n: HierarchyNode<Raw>) => n.leaves().filter((l) => l.data.rank === 'species').length
const nodes: TreeNode[] = h.descendants().map((n) => {
  const p = simNodes.get(n.data.id)!
  return {
    id: n.data.id,
    name: n.data.name,
    rank: n.data.rank,
    parent: n.parent?.data.id ?? null,
    children: n.children?.map((c) => c.data.id) ?? [],
    depth: n.depth,
    ...(n.data.tr && { tr: n.data.tr }),
    ...(n.data.en && { en: n.data.en }),
    color: colorOf.get(n.data.id) ?? '#b8ad9c',
    position: [p.x, p.y, p.z].map((v) => Math.round(v * SCALE * 100) / 100) as [number, number, number],
    speciesCount: countSpecies(n),
    ...(n.data.edibility && { edibility: n.data.edibility }),
    ...(n.data.look && { form: n.data.look.form }),
    ...(n.data.look?.color && { capColor: n.data.look.color }),
    ...(n.data.look?.spots && { spots: true }),
  }
})

// Overwrite in place (and prune stale files) rather than wiping the folder, so a running
// dev server keeps serving it.
function writeDir(name: string, items: { id: string }[]) {
  const dir = path.join(OUT, name)
  fs.mkdirSync(dir, { recursive: true })
  const current = new Set(items.map((d) => `${d.id}.json`))
  for (const f of fs.readdirSync(dir)) if (!current.has(f)) fs.rmSync(path.join(dir, f))
  for (const d of items) fs.writeFileSync(path.join(dir, `${d.id}.json`), JSON.stringify(d))
}
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'tree.json'), JSON.stringify({ rootId: root.id, nodes } satisfies TreeData))
writeDir('species', details)
fs.writeFileSync(path.join(OUT, 'turkey.json'), JSON.stringify(turkeyMap))
fs.writeFileSync(path.join(OUT, 'world.json'), JSON.stringify(worldMap))
// Only clades still visible after pruning; every one of them should be described.
const visibleClades = nodes.filter((n) => n.rank !== 'species')
for (const n of visibleClades) if (!cladeDetails.has(n.id)) console.warn(`⚠ clade "${n.id}" has no content/clades/${n.id}.md`)
writeDir('clades', visibleClades.flatMap((n) => cladeDetails.get(n.id) ?? []))

console.log(
  `✔ ${nodes.length} nodes (${details.length} species, ${cladeDetails.size} clade texts, ${withDistribution} distributions) → public/data`,
)
