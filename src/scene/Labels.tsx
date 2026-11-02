import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useTranslation } from 'react-i18next'
import { Vector3 } from 'three'
import { computeFocus, displayName, type TreeIndex } from '../data/tree'
import type { Lang, TreeNode } from '../data/types'
import { useApp } from '../store'
import { nodeFrame } from './Nodes'

/** Camera distance range over which unfocused labels fade in, per rank. */
const FADE: Partial<Record<TreeNode['rank'], [far: number, near: number]>> = {
  species: [70, 40],
  genus: [40, 22],
  family: [55, 30],
  class: [80, 55],
}

/**
 * HTML labels with a tiny screen-space layout pass each frame: labels fade with camera
 * distance, and when two overlap the more important one (focused, then higher rank) wins.
 */
export function Labels({ tree }: { tree: TreeIndex }) {
  const { i18n } = useTranslation()
  const lang = i18n.language as Lang
  const selectedId = useApp((s) => s.selectedId)
  const hoveredId = useApp((s) => s.hoveredId)
  const level = useMemo(() => computeFocus(tree, selectedId, hoveredId).nodes, [tree, selectedId, hoveredId])
  const anchors = useMemo(
    () =>
      tree.nodes.map((n) => {
        const f = nodeFrame(tree, n)
        return n.rank === 'species'
          ? f.position.addScaledVector(f.facing, f.size * 1.45)
          : f.position.setY(f.position.y + f.size + 0.9)
      }),
    [tree],
  )
  const anyFocus = selectedId !== null || hoveredId !== null

  // Placement priority: hovered/selected first, then focused, then shallow ranks.
  const order = useMemo(
    () =>
      tree.nodes
        .map((n, i) => ({ i, score: (n.id === hoveredId ? 100 : 0) + (n.id === selectedId ? 50 : 0) + level[i] * 20 - n.depth }))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.i),
    [tree, level, selectedId, hoveredId],
  )

  const els = useRef<(HTMLDivElement | null)[]>([])
  const sizes = useRef(new Map<number, [number, number]>())
  useMemo(() => sizes.current.clear(), [lang]) // re-measure when text changes

  const p = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    const placed: [number, number, number, number][] = []
    for (const i of order) {
      const el = els.current[i]
      if (!el) continue
      const n = tree.nodes[i]
      const focused = level[i] > 0
      let o = anyFocus && !focused ? 0.15 : n.rank === 'species' ? 0.8 : 0.95
      const fade = FADE[n.rank]
      if (fade && !focused) {
        const [far, near] = fade
        o *= Math.min(1, Math.max(0, (far - camera.position.distanceTo(anchors[i])) / (far - near)))
      }
      p.copy(anchors[i]).project(camera)
      if (p.z > 1) o = 0 // behind the camera
      if (o > 0.05) {
        let wh = sizes.current.get(i)
        if (!wh) sizes.current.set(i, (wh = [el.offsetWidth + 6, el.offsetHeight]))
        const x = ((p.x + 1) / 2) * size.width - wh[0] / 2
        const y = ((1 - p.y) / 2) * size.height - wh[1] / 2
        const hit = placed.some(([px, py, pw, ph]) => x < px + pw && x + wh[0] > px && y < py + ph && y + wh[1] > py)
        if (hit) o = 0
        else placed.push([x, y, wh[0], wh[1]])
      }
      el.style.opacity = String(o)
      el.style.pointerEvents = o > 0.1 ? 'auto' : 'none'
    }
  })

  return tree.nodes.map((n, i) => {
    const isClade = n.rank !== 'species'
    return (
      <Html key={n.id} position={anchors[i]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={(el) => {
            els.current[i] = el
          }}
          className="label"
          style={{ opacity: 0, color: isClade ? n.color : '#f2f5f8' }}
          onClick={() => useApp.getState().select(n.id)}
          onPointerEnter={() => useApp.getState().hover(n.id)}
          onPointerLeave={() => useApp.getState().hover(null)}
        >
          {isClade ? (
            <span className={`font-serif tracking-[0.12em] uppercase ${n.depth <= 1 ? 'text-[15px]' : 'text-[12px]'}`}>
              {displayName(n, lang)}
            </span>
          ) : (
            <span className="text-[12px] font-medium">{displayName(n, lang)}</span>
          )}
        </div>
      </Html>
    )
  })
}
