import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ancestorAt, displayName, lineage, loadClade, loadSpecies, speciesUnder, type TreeIndex } from '../data/tree'
import type { CladeDetail, Edibility, Lang, Lookalike, SpeciesDetail, TreeNode } from '../data/types'
import { useApp } from '../store'
import { DistributionMap } from './DistributionMap'
import { PhotoGallery } from './PhotoGallery'

const EDIBILITY_COLOR: Record<Edibility, string> = {
  edible: '#6ee7a8',
  'edible-caution': '#fcd34d',
  medicinal: '#93c5fd',
  inedible: '#cbd5e1',
  toxic: '#fb923c',
  deadly: '#f43f5e',
}

export function InfoPanel({ tree }: { tree: TreeIndex }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const selectedId = useApp((s) => s.selectedId)
  const node = selectedId ? tree.byId.get(selectedId) : undefined
  if (!node) return null
  const name = displayName(node, lang)

  return (
    <aside
      key={node.id}
      className="glass pointer-events-auto absolute inset-x-3 bottom-3 max-h-[55vh] overflow-y-auto rounded-3xl p-6 animate-[panel-in_400ms_ease-out] sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-4 sm:max-h-none sm:w-[400px]"
    >
      <button
        onClick={() => useApp.getState().select(null)}
        aria-label={t('close')}
        className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>

      <p className="text-xs tracking-[0.2em] uppercase" style={{ color: node.color }}>
        {t(`rank.${node.rank}`)}
      </p>
      <h2 className="mt-1 pr-8 font-serif text-3xl leading-tight">{name}</h2>
      {name !== node.name && <p className="mt-1 font-serif text-lg text-white/60 italic">{node.name}</p>}

      <Lineage tree={tree} node={node} lang={lang} />

      {node.rank === 'species' ? <SpeciesBody tree={tree} node={node} lang={lang} /> : <CladeBody tree={tree} node={node} lang={lang} />}
    </aside>
  )
}

function Lineage({ tree, node, lang }: { tree: TreeIndex; node: TreeNode; lang: Lang }) {
  const { t } = useTranslation()
  const path = lineage(tree, node.id).slice(0, -1)
  if (path.length === 0) return null
  return (
    <nav aria-label={t('lineage')} className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-white/50">
      {path.map((n, i) => (
        <span key={n.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-white/25">›</span>}
          <button
            onClick={() => useApp.getState().select(n.id)}
            className="flex flex-col items-start rounded px-1 text-left hover:bg-white/10 hover:text-white"
          >
            <span className="text-[9px] tracking-[0.15em] text-white/30 uppercase">{t(`rank.${n.rank}`)}</span>
            <span>{displayName(n, lang)}</span>
          </button>
        </span>
      ))}
    </nav>
  )
}

function SpeciesBody({ tree, node, lang }: { tree: TreeIndex; node: TreeNode; lang: Lang }) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<SpeciesDetail | null>(null)
  useEffect(() => {
    let live = true
    setDetail(null)
    loadSpecies(node.id).then((d) => live && setDetail(d))
    return () => {
      live = false
    }
  }, [node.id])

  const siblings = tree.byId.get(node.parent!)!.children.filter((id) => id !== node.id).map((id) => tree.byId.get(id)!)
  const family = ancestorAt(tree, node.id, 'family')
  const cousins = family ? speciesUnder(tree, family.id).filter((n) => n.parent !== node.parent) : []

  return (
    <>
      {node.edibility && (
        <span
          className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{ color: EDIBILITY_COLOR[node.edibility], background: `${EDIBILITY_COLOR[node.edibility]}1a` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: EDIBILITY_COLOR[node.edibility] }} />
          {t(`edibility.${node.edibility}`)}
        </span>
      )}

      <PhotoGallery photos={detail?.photos ?? []} alt={node.name} color={node.color} />

      {detail && (
        <>
          <p className="mt-5 leading-relaxed text-white/85">{detail.description[lang]}</p>
          <h3 className="mt-5 text-xs tracking-[0.2em] text-white/40 uppercase">{t('habitat')}</h3>
          <p className="mt-1 text-sm text-white/75">{detail.habitat[lang]}</p>
          <DistributionMap distribution={detail.distribution} color={node.color} />
          <Lookalikes tree={tree} lookalikes={detail.lookalikes} lang={lang} />
        </>
      )}

      <Related title={t('relatives')} nodes={siblings} lang={lang} />
      <Related title={t('cousins')} nodes={cousins} lang={lang} />

      <p className="mt-6 rounded-xl bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-200/80">{t('disclaimer')}</p>
    </>
  )
}

function Lookalikes({ tree, lookalikes, lang }: { tree: TreeIndex; lookalikes: Lookalike[]; lang: Lang }) {
  const { t } = useTranslation()
  if (lookalikes.length === 0) return null
  return (
    <>
      <h3 className="mt-6 text-xs tracking-[0.2em] text-white/40 uppercase">{t('lookalikes')}</h3>
      <ul className="mt-2 space-y-1">
        {lookalikes.map((l) => {
          const { node: n, name, latin, edibility } = lookalikeInfo(tree, l, lang)
          const head = (
            <>
              <span className="flex items-center gap-2">
                {edibility && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: EDIBILITY_COLOR[edibility] }}
                    title={t(`edibility.${edibility}`)}
                  />
                )}
                <span>{name}</span>
                {edibility && (
                  <span className="ml-auto shrink-0 text-xs" style={{ color: EDIBILITY_COLOR[edibility] }}>
                    {t(`edibility.${edibility}`)}
                  </span>
                )}
              </span>
              {name !== latin && <span className="block pl-4 font-serif text-sm text-white/50 italic">{latin}</span>}
              <span className="mt-1 block pl-4 text-sm leading-relaxed text-white/65">{l.note[lang]}</span>
            </>
          )
          return (
            <li key={latin}>
              {n ? (
                <button
                  onClick={() => useApp.getState().select(n.id)}
                  onMouseEnter={() => useApp.getState().hover(n.id)}
                  onMouseLeave={() => useApp.getState().hover(null)}
                  className="block w-full rounded-xl px-3 py-2 text-left hover:bg-white/10"
                >
                  {head}
                </button>
              ) : (
                <div className="px-3 py-2">{head}</div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** In the network: the species' node (so it can be opened). Outside it: just its names. */
function lookalikeInfo(tree: TreeIndex, l: Lookalike, lang: Lang) {
  if ('id' in l) {
    const node = tree.byId.get(l.id)!
    return { node, name: displayName(node, lang), latin: node.name, edibility: node.edibility }
  }
  return { node: undefined, name: l[lang] ?? l.latin, latin: l.latin, edibility: l.edibility }
}

function CladeBody({ tree, node, lang }: { tree: TreeIndex; node: TreeNode; lang: Lang }) {
  const { t } = useTranslation()
  const children = node.children.map((id) => tree.byId.get(id)!)
  const childRank = children.every((c) => c.rank === children[0]?.rank) ? children[0]?.rank : undefined
  const [detail, setDetail] = useState<CladeDetail | null>(null)
  useEffect(() => {
    let live = true
    setDetail(null)
    // Not every clade has a text yet; the panel simply goes without one.
    loadClade(node.id).then((d) => live && setDetail(d), () => {})
    return () => {
      live = false
    }
  }, [node.id])
  return (
    <>
      {detail && <p className="mt-5 leading-relaxed text-white/85">{detail.description[lang]}</p>}
      <p className="mt-4 text-sm text-white/60">{t('species', { count: node.speciesCount })}</p>
      {children[0]?.rank !== 'species' && (
        <>
          <h3 className="mt-5 text-xs tracking-[0.2em] text-white/40 uppercase">{childRank ? t(`ranks.${childRank}`) : t('branches')}</h3>
          <ul className="mt-2 space-y-1">
            {children.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => useApp.getState().select(c.id)}
                  onMouseEnter={() => useApp.getState().hover(c.id)}
                  onMouseLeave={() => useApp.getState().hover(null)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/10"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                  <span>{displayName(c, lang)}</span>
                  <span className="ml-auto text-xs text-white/40">{t('species', { count: c.speciesCount })}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <Related title={t('ranks.species')} nodes={speciesUnder(tree, node.id)} lang={lang} />
    </>
  )
}

function Related({ title, nodes, lang }: { title: string; nodes: TreeNode[]; lang: Lang }) {
  if (nodes.length === 0) return null
  return (
    <>
      <h3 className="mt-6 text-xs tracking-[0.2em] text-white/40 uppercase">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {nodes.map((n) => (
          <button
            key={n.id}
            onClick={() => useApp.getState().select(n.id)}
            onMouseEnter={() => useApp.getState().hover(n.id)}
            onMouseLeave={() => useApp.getState().hover(null)}
            className="rounded-full border border-white/10 px-3 py-1 text-sm hover:border-white/30 hover:bg-white/10"
            title={n.name}
          >
            {displayName(n, lang)}
          </button>
        ))}
      </div>
    </>
  )
}
