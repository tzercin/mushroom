import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DataTexture,
  FloatType,
  RedFormat,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { TreeIndex } from '../data/tree'
import { randomUnit, seeded } from './random'
import { useFocusTarget } from './useFocus'

/**
 * The tree's edges drawn as glowing hyphae: each parent→child link is a wandering tube with
 * thin side filaments, and light pulses travel outward from the root like nutrients.
 */
export function Mycelium({ tree }: { tree: TreeIndex }) {
  const geometry = useMemo(() => buildHyphae(tree), [tree])
  const edgeTex = useMemo(() => {
    const tex = new DataTexture(new Float32Array(tree.edgeCount), tree.edgeCount, 1, RedFormat, FloatType)
    tex.needsUpdate = true
    return tex
  }, [tree])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uFocus: { value: 0 },
          uEdgeTex: { value: edgeTex },
          uEdgeCount: { value: tree.edgeCount },
        },
      }),
    [edgeTex, tree.edgeCount],
  )
  useEffect(() => () => (geometry.dispose(), material.dispose(), edgeTex.dispose()), [geometry, material, edgeTex])

  // Ease the per-edge glow towards the target for the current selection/hover.
  const focus = useFocusTarget(tree)
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 4)
    const { edges, hasSelection } = focus.current
    const data = edgeTex.image.data as Float32Array
    for (let i = 0; i < data.length; i++) data[i] += (edges[i] - data[i]) * k
    edgeTex.needsUpdate = true
    material.uniforms.uTime.value += dt
    const f = material.uniforms.uFocus
    f.value += ((hasSelection ? 1 : 0) - f.value) * k
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}

const vertexShader = /* glsl */ `
  attribute float aEdge;
  attribute float aWeight;
  attribute float aDist;
  attribute vec3 aColor;
  uniform sampler2D uEdgeTex;
  uniform float uEdgeCount;
  varying vec3 vColor;
  varying float vWeight;
  varying float vDist;
  varying float vHi;
  varying float vRim;
  varying float vDepth;
  void main() {
    // aEdge < 0 marks decorative filaments that never light up with the selection.
    vHi = aEdge < 0.0 ? 0.0 : texture2D(uEdgeTex, vec2((aEdge + 0.5) / uEdgeCount, 0.5)).r;
    vColor = aColor;
    vWeight = aWeight;
    vDist = aDist;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uFocus;
  varying vec3 vColor;
  varying float vWeight;
  varying float vDist;
  varying float vHi;
  varying float vRim;
  varying float vDepth;
  void main() {
    // Nutrient pulses flowing outward; they run faster and brighter along highlighted paths.
    float wave = sin(vDist * 0.42 - uTime * (1.4 + vHi * 1.6));
    float pulse = pow(max(wave, 0.0), 10.0);
    float dim = mix(1.0, 0.12 + 0.88 * vHi, uFocus);
    vec3 body = vColor * (0.10 + 0.55 * vRim * vRim) * (0.35 + 0.65 * vWeight);
    vec3 col = body * dim
      + vColor * pulse * (0.5 + 1.8 * vHi) * vWeight * dim
      + vColor * vHi * 0.35 * vWeight;
    // Distance haze so far filaments melt into the dark.
    float haze = clamp(1.25 - vDepth / 260.0, 0.15, 1.0);
    gl_FragColor = vec4(col * haze, 1.0);
  }
`

function buildHyphae(tree: TreeIndex): BufferGeometry {
  const parts: BufferGeometry[] = []
  const pos = (id: string) => new Vector3(...tree.byId.get(id)!.position)

  // Distance from the root along the network, so pulses propagate continuously.
  const rootDist = new Map<string, number>([[tree.rootId, 0]])
  const distOf = (id: string): number => {
    const known = rootDist.get(id)
    if (known !== undefined) return known
    const n = tree.byId.get(id)!
    const d = distOf(n.parent!) + pos(n.parent!).distanceTo(pos(id))
    rootDist.set(id, d)
    return d
  }

  const tmp = new Vector3()
  for (const node of tree.nodes) {
    if (!node.parent) continue
    const rand = seeded(node.id)
    const edge = tree.edgeIndex.get(node.id)!
    const a = pos(node.parent)
    const b = pos(node.id)
    const len = a.distanceTo(b)
    const ca = new Color(tree.byId.get(node.parent)!.color)
    const cb = new Color(node.color)

    // Main hypha: wander off the straight line, most in the middle, pinned at both ends.
    const dir = b.clone().sub(a).normalize()
    const p1 = new Vector3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize()
    const p2 = new Vector3().crossVectors(dir, p1)
    const pts = [a]
    for (let k = 1; k < 5; k++) {
      const t = k / 5
      const amp = len * 0.13 * Math.sin(Math.PI * t)
      pts.push(
        a.clone().lerp(b, t)
          .addScaledVector(p1, (rand() * 2 - 1) * amp)
          .addScaledVector(p2, (rand() * 2 - 1) * amp),
      )
    }
    pts.push(b)
    const curve = new CatmullRomCurve3(pts)
    const radius = Math.max(0.05, 0.5 * Math.pow(0.74, node.depth))
    const d0 = distOf(node.parent)
    parts.push(tube(curve, Math.max(16, Math.round(len * 3)), radius, 7, edge, 1, d0, len, ca, cb))

    // Side filaments: short, thin, branching off the main hypha (and sometimes off each other);
    // denser around species tips.
    const wisps = 4 + Math.floor(rand() * 5) + (node.rank === 'species' ? 7 : 0)
    for (let w = 0; w < wisps; w++) {
      const nearTip = node.rank === 'species' && w >= wisps - 7
      const t0 = nearTip ? 0.9 + rand() * 0.1 : 0.1 + rand() * 0.8
      const start = curve.getPointAt(t0)
      const wdir = curve.getTangentAt(t0).multiplyScalar(nearTip ? 0.2 : 0.7).add(randomUnit(rand, tmp)).normalize()
      const wlen = (nearTip ? 0.8 : 1) * (0.8 + rand() * 2.8)
      const col = ca.clone().lerp(cb, t0)
      const wc = filament(rand, start, wdir, wlen)
      const wr = Math.max(0.018, radius * 0.28)
      parts.push(tube(wc, 8, wr, 4, edge, 0.45, d0 + len * t0, wlen, col, col))
      if (rand() < 0.5) {
        const t1 = 0.4 + rand() * 0.5
        const sdir = wc.getTangentAt(t1).add(randomUnit(rand, tmp)).normalize()
        const slen = wlen * (0.3 + rand() * 0.4)
        parts.push(tube(filament(rand, wc.getPointAt(t1), sdir, slen), 6, wr * 0.7, 3, edge, 0.3, d0 + len * t0 + wlen * t1, slen, col, col))
      }
    }
  }

  // Anastomoses: real mycelium fuses where hyphae meet. Faint bridges between nearby nodes of
  // different lineages make the tree read as a network (purely decorative — not relationships).
  const rand = seeded('anastomosis')
  const mids = tree.nodes.filter((n) => n.depth >= 4)
  for (let i = 0; i < mids.length; i++) {
    for (let j = i + 1; j < mids.length; j++) {
      const a = mids[i]
      const b = mids[j]
      if (a.parent === b.parent || a.parent === b.id || b.parent === a.id) continue
      const pa = pos(a.id)
      const pb = pos(b.id)
      const d = pa.distanceTo(pb)
      if (d > 11 || rand() > 0.55) continue
      const c = new CatmullRomCurve3([pa, pa.clone().lerp(pb, 0.5).add(randomUnit(rand, tmp).multiplyScalar(d * 0.25)), pb])
      parts.push(tube(c, 16, 0.025, 3, -1, 0.3, rand() * 50, d, new Color(a.color), new Color(b.color)))
    }
  }

  // Ambient hyphae drifting through the dark around the network.
  const ambient = new Color('#3a5a7a')
  for (let i = 0; i < 120; i++) {
    const start = randomUnit(rand, new Vector3()).multiplyScalar(15 + rand() * 60)
    const len = 5 + rand() * 12
    const c = filament(rand, start, randomUnit(rand, new Vector3()), len, 5)
    parts.push(tube(c, 20, 0.03, 3, -1, 0.22, rand() * 80, len, ambient, ambient))
  }

  const merged = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return merged
}

/** A gently wandering curve starting at `start`, heading roughly along `dir`. */
function filament(rand: () => number, start: Vector3, dir: Vector3, len: number, points = 3) {
  const pts = [start.clone()]
  const heading = dir.clone()
  const step = len / (points - 1)
  for (let i = 1; i < points; i++) {
    heading.add(randomUnit(rand).multiplyScalar(0.45)).normalize()
    pts.push(pts[i - 1].clone().addScaledVector(heading, step))
  }
  return new CatmullRomCurve3(pts)
}

function tube(
  curve: CatmullRomCurve3,
  segments: number,
  radius: number,
  radial: number,
  edge: number,
  weight: number,
  dist0: number,
  len: number,
  c0: Color,
  c1: Color,
) {
  const g = new TubeGeometry(curve, segments, radius, radial, false)
  const count = g.attributes.position.count
  const uv = g.attributes.uv.array as Float32Array
  const aEdge = new Float32Array(count).fill(edge)
  const aWeight = new Float32Array(count).fill(weight)
  const aDist = new Float32Array(count)
  const aColor = new Float32Array(count * 3)
  const c = new Color()
  for (let i = 0; i < count; i++) {
    const t = uv[i * 2]
    aDist[i] = dist0 + t * len
    c.copy(c0).lerp(c1, t * t * (3 - 2 * t)).toArray(aColor, i * 3)
  }
  g.setAttribute('aEdge', new BufferAttribute(aEdge, 1))
  g.setAttribute('aWeight', new BufferAttribute(aWeight, 1))
  g.setAttribute('aDist', new BufferAttribute(aDist, 1))
  g.setAttribute('aColor', new BufferAttribute(aColor, 3))
  return g
}
