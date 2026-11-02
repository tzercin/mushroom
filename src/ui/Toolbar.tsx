import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../store'

/** View controls: reset to the whole network, re-center the selection, zoom. */
export function Toolbar() {
  const { t } = useTranslation()
  const hasSelection = useApp((s) => s.selectedId !== null)
  const { camera, select } = useApp.getState()

  return (
    <div className="glass pointer-events-auto flex flex-col items-stretch gap-0.5 rounded-2xl p-1 text-xs sm:flex-row sm:rounded-full">
      <Button
        title={t('view.defaultHint')}
        onClick={() => {
          select(null)
          camera({ type: 'frame' })
        }}
        icon={
          // four corners: "fit everything"
          <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
        }
      >
        {t('view.default')}
      </Button>
      <Button
        title={t('view.centerHint')}
        disabled={!hasSelection}
        onClick={() => camera({ type: 'frame' })}
        icon={
          <>
            <circle cx="10" cy="10" r="3" />
            <path d="M10 2v3M10 15v3M2 10h3M15 10h3" />
          </>
        }
      >
        {t('view.center')}
      </Button>
      <span className="mx-1 hidden w-px self-stretch bg-white/10 sm:block" />
      <Button title={t('view.zoomOut')} onClick={() => camera({ type: 'zoom', factor: 1.6 })} icon={<path d="M5 10h10" />} />
      <Button title={t('view.zoomIn')} onClick={() => camera({ type: 'zoom', factor: 1 / 1.6 })} icon={<path d="M5 10h10M10 5v10" />} />
    </div>
  )
}

function Button({
  title,
  onClick,
  disabled,
  icon,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  icon: ReactNode
  children?: ReactNode
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-full px-3 py-2 text-white/75 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      {children && <span className="hidden sm:inline">{children}</span>}
    </button>
  )
}
