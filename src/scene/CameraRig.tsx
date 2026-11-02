import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { Vector3, type PerspectiveCamera } from 'three'
import { descendants, type TreeIndex } from '../data/tree'
import type { Rank } from '../data/types'
import { useApp } from '../store'
import { nodeFrame } from './Nodes'

const PANEL_PX = 420
// Seconds to settle: slow and cinematic when flying to a selection, snappy for direct input.
const FLY_SMOOTH = 0.9
const INPUT_SMOOTH = 0.12
const MIN_DISTANCE: Record<Rank, number> = {
  kingdom: 0, // the root shows the overview
  phylum: 50,
  class: 40,
  order: 30,
  family: 24,
  genus: 20,
  species: 17,
}

/**
 * Flies the camera to the selected node (or to the UI's frame/zoom requests), handles wheel
 * zoom, and slowly orbits the network when left alone.
 */
export function CameraRig({ tree }: { tree: TreeIndex }) {
  const controls = useRef<CameraControls>(null!)
  const selectedId = useApp((s) => s.selectedId)
  const command = useApp((s) => s.cameraCommand)
  const lastInput = useRef(0)
  const { clock, camera, size, gl } = useThree()
  // Frame the whole network, however big the content grows.
  const extent = useMemo(() => Math.max(...tree.nodes.map((n) => Math.hypot(...n.position))), [tree])

  const frame = useCallback(
    (id: string | null) => {
      const c = controls.current
      c.smoothTime = FLY_SMOOTH
      const node = id ? tree.byId.get(id) : null
      if (!node || node.id === tree.rootId) {
        c.setFocalOffset(0, 0, 0, true)
        c.setLookAt(0, extent * 0.62, extent * 1.4, 0, 0, 0, true)
        return
      }
      // Frame the node together with everything below it.
      const members = descendants(tree, node.id).map((n) => new Vector3(...n.position))
      const target = members.reduce((acc, v) => acc.add(v), new Vector3()).divideScalar(members.length)
      const radius = Math.max(...members.map((v) => v.distanceTo(target)))
      // Portrait screens have a narrow horizontal field of view; back off accordingly.
      const distance = Math.max(MIN_DISTANCE[node.rank], radius * 2.6) * Math.max(1, 0.75 / (size.width / size.height))

      // Look from outside the network, roughly level with the node, so mushrooms are seen in
      // profile and the parent hypha leads into view.
      const out = new Vector3(target.x, 0, target.z)
      if (out.lengthSq() < 1e-6) out.set(0, 0, 1)
      out.normalize()
      if (node.rank === 'species') {
        // Look across the mushroom's stem, never down it, so the cap reads in profile.
        const { facing } = nodeFrame(tree, node)
        out.addScaledVector(facing, -out.dot(facing))
        if (out.lengthSq() < 1e-6) out.set(1, 0, 0)
        out.normalize()
      }
      out.setY(out.y + 0.3).normalize()
      const eye = target.clone().addScaledVector(out, distance)
      c.setLookAt(...eye.toArray(), ...target.toArray(), true)

      // Keep the node clear of the info panel: it covers the right side on wide screens and
      // the bottom half on phones.
      const halfHeight = distance * Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360)
      const halfWidth = (halfHeight * size.width) / size.height
      if (size.width >= 640) c.setFocalOffset((PANEL_PX / size.width) * halfWidth, 0, 0, true)
      else c.setFocalOffset(0, 0.4 * halfHeight, 0, true)
    },
    [tree, camera, size, extent],
  )

  useEffect(() => frame(selectedId), [frame, selectedId])

  useEffect(() => {
    if (!command) return
    if (command.type === 'frame') frame(useApp.getState().selectedId)
    else {
      const c = controls.current
      c.smoothTime = 0.35
      c.dollyTo(c.distance * command.factor, true)
    }
    // Only react to new commands, not to selection/size changes.
  }, [command])

  // Wheel / trackpad zoom. camera-controls' own wheel handling scales deltas very differently
  // per platform (a Mac mouse notch barely moves), so normalise here: every wheel notch zooms
  // ~20%, trackpads zoom in proportion to the gesture, and pinch is a little more sensitive.
  useEffect(() => {
    const el = gl.domElement
    controls.current.mouseButtons.wheel = 0 // ACTION.NONE: we handle the wheel ourselves
    let lastWheel = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const c = controls.current
      let px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY
      // An isolated small event is a mouse notch, not part of a smooth trackpad stream.
      const now = performance.now()
      if (!e.ctrlKey && now - lastWheel > 80 && Math.abs(px) < 80) px = Math.sign(px) * 80
      lastWheel = now
      px = Math.max(-150, Math.min(150, px))
      const k = e.ctrlKey ? 0.012 : 0.0035 // ctrlKey = trackpad pinch; a 100px notch ≈ 1.4× closer
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      c.smoothTime = INPUT_SMOOTH
      lastInput.current = clock.elapsedTime
      // _dollyInternal is camera-controls' own wheel step (protected); it scales distance by
      // 0.95^(-delta·dollySpeed) and handles dolly-to-cursor. Convert "distance *= e^(px·k)" into it.
      const delta = (px * k) / Math.log(1 / 0.95) / c.dollySpeed
      ;(c as unknown as { _dollyInternal(d: number, x: number, y: number): void })._dollyInternal(delta, x, y)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [gl, clock])

  useFrame((_, dt) => {
    if (!useApp.getState().selectedId && clock.elapsedTime - lastInput.current > 5) controls.current.rotate(dt * 0.035, 0, false)
  })

  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={FLY_SMOOTH}
      draggingSmoothTime={0.08}
      minDistance={3}
      maxDistance={extent * 3.5}
      dollySpeed={1.4}
      dollyToCursor
      onStart={() => {
        // The user took over: respond immediately instead of easing like a fly-to.
        controls.current.smoothTime = INPUT_SMOOTH
        lastInput.current = Infinity
      }}
      onEnd={() => (lastInput.current = clock.elapsedTime)}
    />
  )
}
