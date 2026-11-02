import { useEffect, useRef } from 'react'
import { computeFocus, type TreeIndex } from '../data/tree'
import { useApp } from '../store'

type Focus = ReturnType<typeof computeFocus> & { hasSelection: boolean }

/**
 * Target glow levels for the current selection/hover, kept in a ref so render loops can
 * read them every frame without re-rendering React.
 */
export function useFocusTarget(tree: TreeIndex) {
  const focus = useRef<Focus>(null!)
  const update = (s = useApp.getState()) => {
    focus.current = { ...computeFocus(tree, s.selectedId, s.hoveredId), hasSelection: s.selectedId !== null }
  }
  if (!focus.current) update()
  useEffect(() => {
    update()
    return useApp.subscribe((s, prev) => {
      if (s.selectedId !== prev.selectedId || s.hoveredId !== prev.hoveredId) update(s)
    })
  }, [tree])
  return focus
}
