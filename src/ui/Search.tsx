import { useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import { useTranslation } from 'react-i18next'
import { displayName, type TreeIndex } from '../data/tree'
import type { Lang } from '../data/types'
import { useApp } from '../store'

export function Search({ tree }: { tree: TreeIndex }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const fuse = useMemo(
    () => new Fuse(tree.nodes, { keys: ['name', 'tr', 'en', 'id'], threshold: 0.35, ignoreDiacritics: true }),
    [tree],
  )
  const results = useMemo(() => (query.trim() ? fuse.search(query, { limit: 8 }).map((r) => r.item) : []), [fuse, query])

  const choose = (id: string) => {
    useApp.getState().select(id)
    setQuery('')
  }

  return (
    <div className="relative w-full sm:w-80">
      <input
        value={query}
        onChange={(e) => (setQuery(e.target.value), setActive(0))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
          else if (e.key === 'Enter' && results[active]) choose(results[active].id)
          else if (e.key === 'Escape') setQuery('')
          else return
          e.preventDefault()
          e.stopPropagation()
        }}
        placeholder={t('search')}
        className="glass w-full rounded-full px-5 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/25"
      />
      {query.trim() && (
        <ul className="glass absolute mt-2 w-full overflow-hidden rounded-2xl py-1 text-sm">
          {results.length === 0 && <li className="px-5 py-2 text-white/40">{t('noResults')}</li>}
          {results.map((n, i) => (
            <li key={n.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(n.id)}
                className={`flex w-full items-center gap-3 px-5 py-2 text-left ${i === active ? 'bg-white/10' : ''}`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: n.color, boxShadow: `0 0 8px ${n.color}` }} />
                <span className="truncate">{displayName(n, lang)}</span>
                <span className="ml-auto shrink-0 text-xs text-white/40">
                  {n.rank === 'species' ? <i>{n.name}</i> : t(`rank.${n.rank}`)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
