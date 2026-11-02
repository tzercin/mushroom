import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadTurkey, loadWorld } from '../data/tree'
import type { Distribution, Lang, TurkeyMap, WorldMap } from '../data/types'

type View = 'turkey' | 'world'
// Remembered across species, so comparing several on the world map doesn't mean re-clicking.
let lastView: View = 'turkey'

/**
 * Where a species has been recorded: in Türkiye as dots with their provinces tinted, or
 * worldwide as countries tinted by their number of GBIF records.
 */
export function DistributionMap({ distribution, color }: { distribution?: Distribution; color: string }) {
  const { t } = useTranslation()
  const [view, setView] = useState<View>(lastView)
  const choose = (v: View) => {
    lastView = v
    setView(v)
  }
  return (
    <>
      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-xs tracking-[0.2em] text-white/40 uppercase">{t(`distribution.title.${view}`)}</h3>
        <div role="tablist" className="flex rounded-full bg-white/5 p-0.5 text-[11px]">
          {(['turkey', 'world'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => choose(v)}
              className={`rounded-full px-2.5 py-0.5 ${view === v ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}
            >
              {t(`distribution.view.${v}`)}
            </button>
          ))}
        </div>
      </div>
      {view === 'turkey' ? <TurkeyView distribution={distribution} color={color} /> : <WorldView distribution={distribution} color={color} />}
    </>
  )
}

function useMap<T>(load: () => Promise<T>) {
  const [map, setMap] = useState<T | null>(null)
  useEffect(() => {
    let live = true
    load().then((m) => live && setMap(m), () => {})
    return () => {
      live = false
    }
  }, [load])
  return map
}

function TurkeyView({ distribution, color }: { distribution?: Distribution; color: string }) {
  const { t } = useTranslation()
  const map = useMap(loadTurkey)
  const [hovered, setHovered] = useState<TurkeyMap['provinces'][number] | null>(null)
  if (!map) return <MapPlaceholder />

  const recorded = new Set(distribution?.provinces)
  const points = distribution?.points ?? []
  // Dots and strokes are sized in map units; the map is 1000 wide and drawn ~350px wide.
  return (
    <>
      <figure className="relative mt-2 overflow-hidden rounded-2xl bg-white/5 px-2 pt-3 pb-2">
        <svg viewBox={`0 0 ${map.width} ${map.height}`} className="w-full" role="img" aria-label={t('distribution.title.turkey')}>
          <g strokeLinejoin="round">
            {map.provinces.map((p) => {
              const on = recorded.has(p.iso)
              return (
                <path
                  key={p.iso}
                  d={p.d}
                  fill={on ? color : '#ffffff'}
                  fillOpacity={hovered?.iso === p.iso ? 0.35 : on ? 0.2 : 0.04}
                  stroke={on ? color : '#ffffff'}
                  strokeOpacity={on ? 0.55 : 0.14}
                  strokeWidth={1.5}
                  fillRule="evenodd"
                  onMouseEnter={() => setHovered(p)}
                  onMouseLeave={() => setHovered((h) => (h === p ? null : h))}
                />
              )
            })}
          </g>
          <g fill={color} pointerEvents="none">
            {points.map(([x, y]) => (
              <circle key={`halo${x},${y}`} cx={x} cy={y} r={14} opacity={0.18} />
            ))}
            {points.map(([x, y]) => (
              <circle key={`dot${x},${y}`} cx={x} cy={y} r={5} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            ))}
          </g>
        </svg>
        <span className="pointer-events-none absolute top-2 left-3 text-xs text-white/70">
          {hovered && (
            <>
              {hovered.name}
              {recorded.has(hovered.iso) && <span style={{ color }}> · {t('distribution.recordedHere')}</span>}
            </>
          )}
        </span>
        {points.length === 0 && (
          <figcaption className="absolute inset-0 grid place-items-center text-xs text-white/50">{t('distribution.none')}</figcaption>
        )}
      </figure>

      {distribution && distribution.records > 0 && (
        <p className="mt-2 text-xs text-white/60">
          {t('distribution.records', { count: distribution.records })} · {t('distribution.provinces', { count: recorded.size })}
          {distribution.years && ` · ${distribution.years[0]}–${distribution.years[1]}`}
          {' · '}
          <GbifLink query={`country=TR&taxon_key=${distribution.taxonKey}`} />
        </p>
      )}
      <p className="mt-1 text-[11px] leading-relaxed text-white/35">
        {t('distribution.note')} {t('distribution.boundaries')}: © OpenStreetMap, geoBoundaries (CC BY-SA).
      </p>
    </>
  )
}

function WorldView({ distribution, color }: { distribution?: Distribution; color: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const map = useMap(loadWorld)
  const [hovered, setHovered] = useState<WorldMap['countries'][number] | null>(null)
  if (!map) return <MapPlaceholder />

  const counts = distribution?.countries ?? {}
  // Log scale: a handful of countries hold most of the records, and one record still counts.
  const top = Math.log10(Math.max(10, ...Object.values(counts)) + 1)
  const shade = (n: number) => 0.15 + 0.7 * (Math.log10(n + 1) / top)
  const countryCount = Object.keys(counts).length
  return (
    <>
      <figure className="relative mt-2 overflow-hidden rounded-2xl bg-white/5 px-1 pt-5 pb-1">
        <svg viewBox={`0 0 ${map.width} ${map.height}`} className="w-full" role="img" aria-label={t('distribution.title.world')}>
          <g strokeLinejoin="round" strokeWidth={0.6}>
            {map.countries.map((c) => {
              const n = counts[c.iso] ?? 0
              return (
                <path
                  key={c.iso}
                  d={c.d}
                  fill={n ? color : '#ffffff'}
                  fillOpacity={n ? shade(n) : 0.05}
                  stroke={hovered?.iso === c.iso ? '#ffffff' : n ? color : '#ffffff'}
                  strokeOpacity={hovered?.iso === c.iso ? 0.9 : n ? 0.6 : 0.12}
                  fillRule="evenodd"
                  onMouseEnter={() => setHovered(c)}
                  onMouseLeave={() => setHovered((h) => (h === c ? null : h))}
                />
              )
            })}
          </g>
          {/* Home: Türkiye always outlined, so it's easy to find. */}
          {map.countries
            .filter((c) => c.iso === 'TR')
            .map((c) => (
              <path key="home" d={c.d} fill="none" stroke="#ffffff" strokeOpacity={0.8} strokeWidth={1.2} pointerEvents="none" />
            ))}
        </svg>
        <span className="pointer-events-none absolute top-1.5 left-3 text-xs text-white/70">
          {hovered && (
            <>
              {hovered.name[lang]}
              <span style={{ color: counts[hovered.iso] ? color : undefined }}>
                {' · '}
                {counts[hovered.iso] ? t('distribution.records', { count: counts[hovered.iso] }) : t('distribution.noRecords')}
              </span>
            </>
          )}
        </span>
        {countryCount === 0 && (
          <figcaption className="absolute inset-0 grid place-items-center text-xs text-white/50">{t('distribution.none')}</figcaption>
        )}
      </figure>

      {distribution && countryCount > 0 && (
        <p className="mt-2 text-xs text-white/60">
          {t('distribution.records', { count: distribution.worldRecords })} · {t('distribution.countries', { count: countryCount })}
          {' · '}
          <GbifLink query={`taxon_key=${distribution.taxonKey}`} />
        </p>
      )}
      <p className="mt-1 text-[11px] leading-relaxed text-white/35">
        {t('distribution.worldNote')} {t('distribution.boundaries')}: Natural Earth.
      </p>
    </>
  )
}

function GbifLink({ query }: { query: string }) {
  return (
    <a href={`https://www.gbif.org/occurrence/search?${query}`} target="_blank" rel="noreferrer" className="underline hover:text-white">
      GBIF
    </a>
  )
}

/** Keeps the panel from jumping while a map loads. */
function MapPlaceholder() {
  return <div className="mt-2 aspect-[2/1] rounded-2xl bg-white/5" />
}
