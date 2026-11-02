import { Canvas } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { UnsignedByteType } from 'three'
import type { TreeIndex } from '../data/tree'
import { CameraRig } from './CameraRig'
import { Labels } from './Labels'
import { Mycelium } from './Mycelium'
import { Nodes } from './Nodes'

export function Scene({ tree }: { tree: TreeIndex }) {
  return (
    <Canvas
      camera={{ position: [0, 48, 108], fov: 50, near: 0.1, far: 1200 }}
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#04050a']} />
      <Mycelium tree={tree} />
      <Nodes tree={tree} />
      <Labels tree={tree} />
      {/* Drifting spores */}
      <Sparkles count={500} scale={[200, 120, 200]} size={2.2} speed={0.15} opacity={0.35} color="#9fd8ff" noise={1} />
      <Sparkles count={160} scale={[160, 90, 160]} size={3.5} speed={0.1} opacity={0.25} color="#ffc98a" noise={1} />
      <CameraRig tree={tree} />
      <Effects />
    </Canvas>
  )
}

// 8-bit buffers: HDR (half-float) targets render black on some GPUs/software renderers,
// and the glow look holds up fine without them.
function Effects() {
  return (
    <EffectComposer multisampling={0} frameBufferType={UnsignedByteType}>
      <Bloom mipmapBlur intensity={1.25} luminanceThreshold={0.12} luminanceSmoothing={0.35} radius={0.75} />
      <Noise opacity={0.04} />
      <Vignette offset={0.25} darkness={0.75} />
    </EffectComposer>
  )
}
