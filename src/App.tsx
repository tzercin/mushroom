import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { displayName, loadTree } from './data/tree'
import type { Lang } from './data/types'
import { Scene } from './scene/Scene'
import { useApp } from './store'
import { InfoPanel } from './ui/InfoPanel'
import { Legend } from './ui/Legend'
import { Search } from './ui/Search'
import { Toolbar } from './ui/Toolbar'

export default function App() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const tree = useApp((s) => s.tree)
  const selectedId = useApp((s) => s.selectedId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTree().then(useApp.getState().setTree, (e) => setError(String(e)))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useApp.getState().select(null)
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const node = selectedId ? tree?.byId.get(selectedId) : null
    document.title = node ? `${displayName(node, lang)} · ${t('title')}` : `${t('title')} · ${t('subtitle')}`
  }, [tree, selectedId, lang, t])

  if (error) return <div className="grid h-full place-items-center text-white/60">{error}</div>
  if (!tree) return <div className="grid h-full place-items-center text-sm tracking-[0.3em] text-white/40 uppercase">…</div>

  return (
    <div className="relative h-full animate-[fade-in_1.5s_ease-out]">
      <Scene tree={tree} />

      <div className="pointer-events-none absolute inset-0 z-30">
        <header className="pointer-events-auto absolute top-4 left-4 flex max-w-[calc(100%-2rem)] flex-col gap-3 sm:top-6 sm:left-6">
          <div className="flex items-start gap-4">
            <button onClick={() => useApp.getState().select(null)} className="text-left">
              <h1 className="font-serif text-3xl tracking-wide sm:text-4xl">{t('title')}</h1>
              <p className="text-sm text-white/50">{t('subtitle')}</p>
            </button>
            <div className="glass mt-1 flex rounded-full p-0.5 text-xs">
              {(['tr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => i18n.changeLanguage(l)}
                  className={`rounded-full px-2.5 py-1 uppercase ${lang === l ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <Search tree={tree} />
        </header>

        <div className="absolute bottom-6 left-6">
          <Legend tree={tree} />
        </div>

        {/* Phones: a vertical strip on the right, clear of the bottom sheet. Desktop: bottom centre. */}
        <div className="absolute top-36 right-3 flex flex-col items-center gap-3 sm:top-auto sm:right-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2">
          {selectedId === null && <p className="hidden text-xs tracking-wide text-white/35 sm:block">{t('hint')}</p>}
          <Toolbar />
        </div>

        <InfoPanel tree={tree} />
      </div>
    </div>
  )
}
