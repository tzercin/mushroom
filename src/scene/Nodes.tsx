import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { TreeIndex } from '../data/tree'
import type { Form, Rank, TreeNode } from '../data/types'
import { useApp } from '../store'
import { buildForm } from './forms'
import { seeded } from './random'
import { useFocusTarget } from './useFocus'

const SIZE: Record<Rank, number> = {
  kingdom: 2,
  phylum: 1.5,
  class: 1.05,
  order: 0.95,
  family: 0.62,
  genus: 0.5,
  species: 1.3,
}

const UP = new Vector3(0, 1, 0)

/** Where a node sits and which way it faces (species sprout away from their parent). */
export function nodeFrame(tree: TreeIndex, n: TreeNode) {
  const position = new Vector3(...n.position)
  const out = n.parent ? position.clone().sub(new Vector3(...tree.byId.get(n.parent)!.position)).normalize() : UP.clone()
  // Mushrooms lean outward but mostly stay upright, like real fruiting bodies.
  const facing = out.lerp(UP, 0.55).normalize()
  return { position, facing, size: SIZE[n.rank] }
}

/**
 * Clades are glowing knots where hyphae meet; species are small luminous fruiting bodies at
 * the tips of the network, each drawn in its own growth form (one instanced mesh per form).
 * A last, invisible mesh gives generous hit areas.
 */
export function Nodes({ tree }: { tree: TreeIndex }) {
  const species = useMemo(() => tree.nodes.filter((n) => n.rank === 'species'), [tree])
  const clades = useMemo(() => tree.nodes.filter((n) => n.rank !== 'species'), [tree])
  const frames = useMemo(() => new Map(tree.nodes.map((n) => [n.id, nodeFrame(tree, n)])), [tree])

  const groups = useMemo(() => {
    const byForm = new Map<Form, TreeNode[]>()
    for (const n of species) {
      const form = n.form ?? 'cap'
      byForm.set(form, [...(byForm.get(form) ?? []), n])
    }
    const knotGeo = new SphereGeometry(1, 24, 16)
    knotGeo.setAttribute('aPart', new BufferAttribute(new Float32Array(knotGeo.attributes.position.count), 1))
    return [
      ...[...byForm].map(([form, list]) => ({ key: form, list, geometry: withInstanceData(buildForm(form), list) })),
      { key: 'knots', list: clades, geometry: withInstanceData(knotGeo, clades) },
    ]
  }, [species, clades])
  const hitGeo = useMemo(() => new SphereGeometry(1, 8, 6), [])
  const material = useMemo(() => new ShaderMaterial({ vertexShader, fragmentShader, side: DoubleSide }), [])
  const hitMaterial = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }), [])
  useEffect(
    () => () => [...groups.map((g) => g.geometry), hitGeo, material, hitMaterial].forEach((d) => d.dispose()),
    [groups, hitGeo, material, hitMaterial],
  )

  const meshes = useRef(new Map<string, InstancedMesh>())
  const hits = useRef<InstancedMesh>(null!)

  // Static per-instance data: colour, glow buffer, a little random variety per mushroom.
  const variety = useMemo(
    () =>
      new Map(
        species.map((n) => {
          const r = seeded(n.id)
          return [n.id, { scale: 0.8 + r() * 0.45, spin: r() * Math.PI * 2, tilt: (r() - 0.5) * 0.5 }]
        }),
      ),
    [species],
  )
  // Layout effect: instance colours must exist before the first frame compiles the shader.
  useLayoutEffect(() => {
    const color = new Color()
    for (const { key, list } of groups) {
      const mesh = meshes.current.get(key)!
      list.forEach((n, i) => mesh.setColorAt(i, color.set(n.color)))
      mesh.instanceColor!.needsUpdate = true
    }
    const m = new Matrix4()
    tree.nodes.forEach((n, i) => {
      const f = frames.get(n.id)!
      // Centre the hit sphere on the mushroom cap rather than its stem base.
      const c = f.position.clone()
      if (n.rank === 'species') c.addScaledVector(f.facing, f.size * 0.8)
      const r = Math.max(1.3, f.size * 1.3)
      hits.current.setMatrixAt(i, m.compose(c, new Quaternion(), new Vector3(r, r, r)))
    })
    hits.current.instanceMatrix.needsUpdate = true
    hits.current.computeBoundingSphere()
  }, [tree, groups, frames])

  const focus = useFocusTarget(tree)
  const glow = useMemo(() => new Float32Array(tree.nodes.length).fill(1), [tree])
  const selectedId = useRef<string | null>(null)
  useEffect(() => useApp.subscribe((s) => (selectedId.current = s.selectedId)), [])

  const m = useMemo(() => new Matrix4(), [])
  const q = useMemo(() => new Quaternion(), [])
  const q2 = useMemo(() => new Quaternion(), [])
  const s = useMemo(() => new Vector3(), [])
  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-dt * 5)
    const t = clock.elapsedTime
    const { nodes: level, hasSelection } = focus.current
    const update = (mesh: InstancedMesh, list: TreeNode[]) => {
      const glowAttr = mesh.geometry.getAttribute('aGlow') as InstancedBufferAttribute
      list.forEach((n, i) => {
        const ni = tree.nodeIndex.get(n.id)!
        const target = hasSelection ? 0.22 + 0.95 * level[ni] : 0.9 + 0.5 * level[ni]
        glow[ni] += (target - glow[ni]) * k
        glowAttr.setX(i, glow[ni])

        const f = frames.get(n.id)!
        const breathe = n.id === selectedId.current ? 1.12 + Math.sin(t * 3) * 0.05 : 1 + level[ni] * 0.1
        if (n.rank === 'species') {
          const v = variety.get(n.id)!
          q.setFromUnitVectors(UP, f.facing).multiply(q2.setFromAxisAngle(UP, v.spin))
          s.setScalar(f.size * v.scale * breathe)
        } else {
          q.identity()
          s.setScalar(f.size * breathe)
        }
        mesh.setMatrixAt(i, m.compose(f.position, q, s))
      })
      glowAttr.needsUpdate = true
      mesh.instanceMatrix.needsUpdate = true
    }
    for (const { key, list } of groups) update(meshes.current.get(key)!, list)
  })

  const idAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId === undefined ? null : tree.nodes[e.instanceId].id)
  const { hover, select } = useApp.getState()

  return (
    <group>
      {groups.map(({ key, list, geometry }) => (
        <instancedMesh
          key={key}
          ref={(m) => void (m ? meshes.current.set(key, m) : meshes.current.delete(key))}
          args={[geometry, material, list.length]}
          frustumCulled={false}
        />
      ))}
      <instancedMesh
        ref={hits}
        args={[hitGeo, hitMaterial, tree.nodes.length]}
        onPointerMove={(e) => {
          e.stopPropagation()
          const id = idAt(e)
          if (id !== useApp.getState().hoveredId) hover(id)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          hover(null)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          select(idAt(e))
        }}
      />
    </group>
  )
}

/** Per-instance buffers: animated glow, plus the static cap colour and spots flag of each species. */
function withInstanceData<G extends BufferGeometry>(g: G, list: TreeNode[]) {
  const cap = new Float32Array(list.length * 3)
  const c = new Color()
  list.forEach((n, i) => c.set(n.capColor ?? n.color).toArray(cap, i * 3))
  g.setAttribute('aGlow', new InstancedBufferAttribute(new Float32Array(list.length).fill(1), 1))
  g.setAttribute('aCap', new InstancedBufferAttribute(cap, 3))
  g.setAttribute('aSpots', new InstancedBufferAttribute(Float32Array.from(list, (n) => (n.spots ? 1 : 0)), 1))
  return g
}

const vertexShader = /* glsl */ `
  attribute float aGlow;
  attribute float aPart;
  attribute vec3 aCap;
  attribute float aSpots;
  varying vec3 vColor;
  varying vec3 vCap;
  varying float vGlow;
  varying float vRim;
  varying float vPart;
  varying float vSpots;
  varying vec3 vLocal;
  void main() {
    vColor = instanceColor;
    vCap = aCap;
    vGlow = aGlow;
    vPart = aPart;
    vSpots = aSpots;
    vLocal = position;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vCap;
  varying float vGlow;
  varying float vRim;
  varying float vPart;
  varying float vSpots;
  varying vec3 vLocal;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main() {
    // Parts: 0 = stem / wood (lineage colour), 1 = cap (species colour, glowing warmer),
    // 2 = gills / pores (dimmer). The rim glow keeps a trace of the lineage colour on the cap.
    float body = 1.0 - abs(vPart - 1.0);
    float under = step(1.5, vPart);
    vec3 albedo = mix(vColor, mix(vColor, vCap, 0.75), body) * (1.0 - 0.35 * under);
    // Spots / scales: jittered cells in model space, only on the cap.
    vec3 cell = floor(vLocal * 6.0);
    vec3 off = vec3(hash(cell), hash(cell + 17.0), hash(cell + 31.0)) - 0.5;
    float d = length(fract(vLocal * 6.0) - 0.5 - off * 0.3);
    float spot = vSpots * body * step(0.35, hash(cell + 5.0)) * (1.0 - smoothstep(0.2, 0.28, d));
    albedo = mix(albedo, vec3(1.0, 0.97, 0.9), spot);
    float rim = pow(vRim, 1.6);
    vec3 rimColor = mix(vColor, vCap, 0.7 * body) * (1.0 - 0.5 * spot);
    vec3 col = albedo * (0.25 + 0.35 * body) * vGlow + mix(rimColor, albedo, spot) * 1.5 * rim * vGlow;
    col += vec3(1.0) * (rim * rim * 0.25 + spot * 0.3) * vGlow;
    gl_FragColor = vec4(col, 1.0);
  }
`
