import type { CladeDetail, Lang, SpeciesDetail, TreeData, TreeNode, TurkeyMap, WorldMap } from './types'

export interface TreeIndex {
  rootId: string
  nodes: TreeNode[]
  byId: Map<string, TreeNode>
  /** Position of each node in `nodes` (used for per-instance GPU buffers). */
  nodeIndex: Map<string, number>
  /** Every non-root node owns the edge to its parent; this maps node id → edge slot. */
  edgeIndex: Map<string, number>
  edgeCount: number
}

export function indexTree(data: TreeData): TreeIndex {
  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  const nodeIndex = new Map(data.nodes.map((n, i) => [n.id, i]))
  const edgeIndex = new Map<string, number>()
  for (const n of data.nodes) if (n.parent) edgeIndex.set(n.id, edgeIndex.size)
  return { rootId: data.rootId, nodes: data.nodes, byId, nodeIndex, edgeIndex, edgeCount: edgeIndex.size }
}

export async function loadTree(): Promise<TreeIndex> {
  const res = await fetch('/data/tree.json')
  if (!res.ok) throw new Error(`tree.json: ${res.status}`)
  return indexTree(await res.json())
}

const detailCache = new Map<string, Promise<unknown>>()
function loadDetail<T>(url: string): Promise<T> {
  let p = detailCache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`)
      return r.json()
    })
    detailCache.set(url, p)
  }
  return p as Promise<T>
}
export const loadSpecies = (id: string) => loadDetail<SpeciesDetail>(`/data/species/${id}.json`)
export const loadClade = (id: string) => loadDetail<CladeDetail>(`/data/clades/${id}.json`)
export const loadTurkey = () => loadDetail<TurkeyMap>('/data/turkey.json')
export const loadWorld = () => loadDetail<WorldMap>('/data/world.json')

/** Root → node, inclusive. */
export function lineage(t: TreeIndex, id: string): TreeNode[] {
  const out: TreeNode[] = []
  for (let n = t.byId.get(id); n; n = n.parent ? t.byId.get(n.parent) : undefined) out.unshift(n)
  return out
}

export function descendants(t: TreeIndex, id: string): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (nid: string) => {
    const n = t.byId.get(nid)!
    out.push(n)
    n.children.forEach(walk)
  }
  walk(id)
  return out
}

export const speciesUnder = (t: TreeIndex, id: string) => descendants(t, id).filter((n) => n.rank === 'species')

/** Nearest ancestor at the given rank. */
export function ancestorAt(t: TreeIndex, id: string, rank: TreeNode['rank']) {
  return lineage(t, id).find((n) => n.rank === rank)
}

export const displayName = (n: TreeNode, lang: Lang) => n[lang] ?? n.name

/**
 * How strongly each node / edge should glow for the current selection and hover, 0..1.
 * Selection lights the lineage back to the root and everything below; a selected species
 * also lights its siblings so its closest relatives stand out.
 */
export function computeFocus(t: TreeIndex, selectedId: string | null, hoveredId: string | null) {
  const nodes = new Float32Array(t.nodes.length)
  const edges = new Float32Array(t.edgeCount)
  const light = (id: string, v: number) => {
    const ni = t.nodeIndex.get(id)
    if (ni !== undefined) nodes[ni] = Math.max(nodes[ni], v)
    const ei = t.edgeIndex.get(id)
    if (ei !== undefined) edges[ei] = Math.max(edges[ei], v)
  }
  if (selectedId && t.byId.has(selectedId)) {
    lineage(t, selectedId).forEach((n) => light(n.id, 1))
    descendants(t, selectedId).forEach((n) => light(n.id, 1))
    const sel = t.byId.get(selectedId)!
    if (sel.rank === 'species' && sel.parent) {
      for (const sib of t.byId.get(sel.parent)!.children) light(sib, 0.6)
    }
  }
  if (hoveredId && t.byId.has(hoveredId)) {
    lineage(t, hoveredId).forEach((n) => light(n.id, 0.75))
    light(hoveredId, 1)
  }
  return { nodes, edges }
}
