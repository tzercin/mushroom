// Shared between scripts/build-data.ts (producer) and the app (consumer).

export type Lang = 'tr' | 'en'
export type Localized = Record<Lang, string>

export type Rank = 'kingdom' | 'phylum' | 'class' | 'order' | 'family' | 'genus' | 'species'

export const EDIBILITY = ['edible', 'edible-caution', 'medicinal', 'inedible', 'toxic', 'deadly'] as const
export type Edibility = (typeof EDIBILITY)[number]

/** Body shape of a fruiting body; each one has its own procedural 3D model in the scene. */
export const FORMS = [
  'cap', // stem + domed cap with gills (Amanita, Agaricus, Russula)
  'parasol', // tall thin stem, wide flat cap, ring (Macrolepiota)
  'shaggy', // tall bell-shaped cap (Coprinus)
  'bolete', // fat stem, thick bun cap, pores (Boletus, Suillus)
  'funnel', // trumpet with a wavy rim (Cantharellus, Lactarius)
  'teeth', // cap with spines underneath (Hydnum)
  'spines', // cascade of hanging icicles (Hericium)
  'bracket', // one thick shelf on wood (Ganoderma, Fomes)
  'shelves', // stacked thin shelves on wood (Trametes, Laetiporus)
  'oyster', // cluster of side-stemmed fans (Pleurotus)
  'morel', // honeycombed cone cap (Morchella)
  'thimble', // wrinkled bell hanging free from the top of a tall stem (Verpa)
  'brain', // lobed, brain-like cap (Gyromitra)
  'puffball', // pear-shaped ball (Lycoperdon)
  'truffle', // lumpy tuber half in the ground (Tuber, Terfezia)
  'club', // slender clubs (Cordyceps)
  'ear', // cupped, ear-like jelly (Auricularia)
] as const
export type Form = (typeof FORMS)[number]

export interface TreeNode {
  id: string
  /** Scientific name. */
  name: string
  rank: Rank
  parent: string | null
  children: string[]
  depth: number
  /** Common names; missing languages fall back to the scientific name. */
  tr?: string
  en?: string
  /** Hex colour of the lineage this node belongs to. */
  color: string
  position: [number, number, number]
  /** Number of species below (1 for a species). */
  speciesCount: number
  edibility?: Edibility
  /** Species only: 3D body shape, optional cap colour (hex) and whether the cap is spotted/scaly. */
  form?: Form
  capColor?: string
  spots?: boolean
}

export interface TreeData {
  rootId: string
  nodes: TreeNode[]
}

export interface Photo {
  /** Path inside public/photos/, e.g. "amanita-muscaria/01.webp". */
  file: string
  author: string
  license: string
  source?: string
}

export interface SpeciesDetail {
  id: string
  habitat: Localized
  description: Localized
  photos: Photo[]
  /** Species this one is easily mistaken for, each with how to tell them apart. */
  lookalikes: Lookalike[]
  /** Records in Türkiye, from content/distribution/<id>.json; absent until fetched. */
  distribution?: Distribution
}

/**
 * A species in the network is referenced by id (names and edibility come from tree.json);
 * one outside it carries its own names and edibility.
 */
export type Lookalike =
  | { id: string; note: Localized }
  | { latin: string; tr?: string; en?: string; edibility: Edibility; note: Localized }

export interface Distribution {
  /** Geolocated GBIF records in Türkiye (before merging records at the same spot). */
  records: number
  years: [number, number] | null
  taxonKey: number
  /** Distinct places, already projected into TurkeyMap coordinates. */
  points: [number, number][]
  /** ISO codes (e.g. "TR-34") of the provinces with at least one record. */
  provinces: string[]
  /** Geolocated GBIF records worldwide, and how many of them each country has (ISO alpha-2). */
  worldRecords: number
  countries: Record<string, number>
}

/** public/data/turkey.json: the province map, as SVG paths in a width × height box. */
export interface TurkeyMap {
  width: number
  height: number
  attribution: string
  provinces: { iso: string; name: string; d: string }[]
}

/** public/data/world.json: the country map (Equal Earth projection), as SVG paths. */
export interface WorldMap {
  width: number
  height: number
  attribution: string
  countries: { iso: string; name: Localized; d: string }[]
}

export interface CladeDetail {
  id: string
  description: Localized
}
