import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Photo } from '../data/types'

const BASE = import.meta.env.VITE_IMAGE_BASE_URL ?? '/photos'
/** Horizontal travel (px) that counts as a swipe rather than a tap. */
const SWIPE = 40

export function PhotoGallery({ photos, alt, color }: { photos: Photo[]; alt: string; color: string }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)

  if (photos.length === 0) {
    return (
      <figure className="mt-5 overflow-hidden rounded-2xl bg-white/5">
        <PhotoPlaceholder color={color} label={t('photoSoon')} />
      </figure>
    )
  }

  const many = photos.length > 1
  const current = Math.min(index, photos.length - 1)
  const photo = photos[current]
  const go = (step: number) => setIndex((current + step + photos.length) % photos.length)

  return (
    <figure
      className="mt-5 overflow-hidden rounded-2xl bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      tabIndex={many ? 0 : undefined}
      aria-roledescription={many ? 'carousel' : undefined}
      onKeyDown={(e) => {
        if (!many) return
        if (e.key === 'ArrowLeft') go(-1)
        else if (e.key === 'ArrowRight') go(1)
        else return
        e.preventDefault()
      }}
    >
      <div
        className="group relative aspect-[4/3] overflow-hidden"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null || !many) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > SWIPE) go(dx < 0 ? 1 : -1)
        }}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {photos.map((p, i) => (
            <img
              key={p.file}
              src={`${BASE}/${p.file}`}
              alt={many ? `${alt} (${i + 1}/${photos.length})` : alt}
              aria-hidden={i !== current}
              className="h-full w-full shrink-0 object-cover"
              // The neighbours load up front so flipping to them is instant.
              loading={Math.abs(i - current) <= 1 ? 'eager' : 'lazy'}
              draggable={false}
            />
          ))}
        </div>

        {many && (
          <>
            <NavButton side="left" label={t('photo.prev')} onClick={() => go(-1)} />
            <NavButton side="right" label={t('photo.next')} onClick={() => go(1)} />
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {photos.map((p, i) => (
                <button
                  key={p.file}
                  onClick={() => setIndex(i)}
                  aria-label={t('photo.goto', { n: i + 1 })}
                  aria-current={i === current}
                  className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <figcaption className="flex gap-2 px-3 py-2 text-[11px] text-white/40">
        <span>
          © {photo.author} · {photo.license}
          {photo.source && (
            <>
              {' · '}
              <a href={photo.source} target="_blank" rel="noreferrer" className="underline hover:text-white">
                source
              </a>
            </>
          )}
        </span>
        {many && (
          <span className="ml-auto shrink-0 tabular-nums">
            {current + 1} / {photos.length}
          </span>
        )}
      </figcaption>
    </figure>
  )
}

function NavButton({ side, label, onClick }: { side: 'left' | 'right'; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 ${side === 'left' ? 'left-2' : 'right-2'} grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-lg text-white/80 backdrop-blur transition-opacity hover:bg-black/60 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100`}
    >
      {side === 'left' ? '‹' : '›'}
    </button>
  )
}

function PhotoPlaceholder({ color, label }: { color: string; label: string }) {
  return (
    <div className="relative grid aspect-[4/3] place-items-center">
      <svg viewBox="0 0 120 90" className="h-2/3 opacity-60" style={{ filter: `drop-shadow(0 0 12px ${color})` }}>
        <path d="M22 52c0-21 17-36 38-36s38 15 38 36z" fill={color} opacity="0.85" />
        <path d="M52 52h16l3 28H49z" fill="#e8eef5" opacity="0.8" />
        <path d="M10 82c18-4 30 3 50 0s34-4 50 0" stroke={color} strokeWidth="1" fill="none" opacity="0.6" />
      </svg>
      <span className="absolute bottom-3 text-xs text-white/40">{label}</span>
    </div>
  )
}
