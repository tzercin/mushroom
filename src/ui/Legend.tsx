import { useTranslation } from 'react-i18next'
import { displayName, type TreeIndex } from '../data/tree'
import type { Lang } from '../data/types'
import { useApp } from '../store'

export function Legend({ tree }: { tree: TreeIndex }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const orders = tree.nodes.filter((n) => n.rank === 'order')
  return (
    <div className="glass pointer-events-auto hidden rounded-2xl p-4 text-xs sm:block">
      <h3 className="mb-2 tracking-[0.2em] text-white/40 uppercase">{t('legend')}</h3>
      <ul className="space-y-0.5">
        {orders.map((o) => (
          <li key={o.id}>
            <button
              onClick={() => useApp.getState().select(o.id)}
              onMouseEnter={() => useApp.getState().hover(o.id)}
              onMouseLeave={() => useApp.getState().hover(null)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-white/75 hover:bg-white/10 hover:text-white"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: o.color, boxShadow: `0 0 8px ${o.color}` }} />
              {displayName(o, lang)}
              <span className="ml-auto pl-4 text-white/30">{o.speciesCount}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
