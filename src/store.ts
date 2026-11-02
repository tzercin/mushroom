import { create } from 'zustand'
import type { TreeIndex } from './data/tree'

interface AppState {
  tree: TreeIndex | null
  selectedId: string | null
  hoveredId: string | null
  setTree: (t: TreeIndex) => void
  select: (id: string | null) => void
  hover: (id: string | null) => void
  /** Last camera request from the UI; `n` increments so repeating a command re-triggers it. */
  cameraCommand: CameraCommand | null
  camera: (request: CameraRequest) => void
}

/** `frame` re-frames the current selection (or the whole network); `zoom` scales the distance. */
export type CameraRequest = { type: 'frame' } | { type: 'zoom'; factor: number }
export type CameraCommand = CameraRequest & { n: number }

// The URL path mirrors the selection (/amanita-muscaria) so any view can be shared.
const idFromPath = () => {
  try {
    return decodeURIComponent(location.pathname.slice(1)) || null
  } catch {
    return null // malformed escape such as /%E0
  }
}

export const useApp = create<AppState>((set, get) => ({
  tree: null,
  selectedId: null,
  hoveredId: null,
  setTree: (tree) => {
    const id = idFromPath()
    set({ tree, selectedId: id && tree.byId.has(id) ? id : null })
  },
  select: (id) => {
    if (id === get().selectedId) return
    set({ selectedId: id })
    history.pushState(null, '', `/${id ?? ''}`)
  },
  hover: (hoveredId) => set({ hoveredId }),
  cameraCommand: null,
  camera: (request) => set({ cameraCommand: { ...request, n: (get().cameraCommand?.n ?? 0) + 1 } }),
}))

addEventListener('popstate', () => {
  const id = idFromPath()
  const { tree } = useApp.getState()
  useApp.setState({ selectedId: id && tree?.byId.has(id) ? id : null })
})
