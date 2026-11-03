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
            <a
              href="https://github.com/tzercin/mushroom"
              target="_blank"
              rel="noopener noreferrer"
              title={t('source')}
              aria-label={t('source')}
              className="glass mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/50 transition hover:text-white"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
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
