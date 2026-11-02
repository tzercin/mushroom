import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  LatheGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Form } from '../data/types'
import { randomUnit, seeded } from './random'

/**
 * Procedural fruiting bodies, one per growth form. Every model stands on the origin, grows
 * along +Y and is roughly 1.25 units tall. Each vertex carries `aPart` so the shader can tint
 * the parts differently: 0 = stem / wood / base, 1 = cap or fertile body, 2 = gills / pores.
 */
export function buildForm(form: Form): BufferGeometry {
  return BUILDERS[form]()
}

const STEM = 0
const BODY = 1
const UNDER = 2

const BUILDERS: Record<Form, () => BufferGeometry> = {
  cap: () =>
    merge(
      part(lathe([[0.2, 0], [0.17, 0.3], [0.14, 0.6], [0.13, 0.86]], 12), STEM),
      part(lathe(dome(0.6, 0.84, 0.38)), BODY),
      part(lathe([[0.13, 0.82], [0.6, 0.84]]), UNDER),
    ),

  parasol: () =>
    merge(
      part(lathe([[0.12, 0], [0.08, 0.1], [0.06, 0.6], [0.05, 1.28]], 10), STEM),
      part(new TorusGeometry(0.08, 0.025, 6, 16).rotateX(Math.PI / 2).translate(0, 0.95, 0), STEM),
      part(lathe(curve(0.78, 1.26, (x) => 0.1 * (1 - x * x) + 0.09 * Math.exp(-((x / 0.2) ** 2)))), BODY),
      part(lathe([[0.05, 1.24], [0.78, 1.26]]), UNDER),
    ),

  shaggy: () =>
    merge(
      part(lathe([[0.12, 0], [0.1, 0.4]], 10), STEM),
      part(lathe([[0.3, 0.32], [0.33, 0.55], [0.34, 0.85], [0.31, 1.08], [0.24, 1.26], [0.12, 1.36], [0, 1.39]]), BODY),
      part(lathe([[0.1, 0.36], [0.3, 0.32]]), UNDER),
    ),

  bolete: () =>
    merge(
      part(lathe([[0, 0], [0.22, 0.02], [0.3, 0.22], [0.28, 0.45], [0.2, 0.72]], 14), STEM),
      part(lathe(dome(0.62, 0.7, 0.42, 0.7)), BODY),
      part(lathe([[0.2, 0.69], [0.62, 0.7]]), UNDER),
    ),

  funnel: () => {
    const rim = (g: BufferGeometry) => wobble(g, 7, 0.06, 0.3)
    return merge(
      part(lathe([[0.13, 0], [0.12, 0.3], [0.15, 0.5]], 12), STEM),
      // Outside of the trumpet (false gills run down it), then the sunken top.
      part(rim(lathe([[0.15, 0.5], [0.24, 0.72], [0.4, 0.9], [0.6, 1.02], [0.66, 1.06]], 32)), UNDER),
      part(rim(lathe([[0.66, 1.06], [0.5, 1.02], [0.3, 0.95], [0, 0.9]], 32)), BODY),
    )
  },

  teeth: () => {
    const rand = seeded('teeth')
    const spines: BufferGeometry[] = []
    for (let i = 0; i < 46; i++) {
      const r = 0.18 + Math.sqrt(rand()) * 0.34
      const a = rand() * Math.PI * 2
      const len = 0.06 + rand() * 0.06
      spines.push(new ConeGeometry(0.025, len, 5).rotateX(Math.PI).translate(r * Math.cos(a), 0.79 - len / 2, r * Math.sin(a)))
    }
    return merge(
      part(lathe([[0.2, 0], [0.16, 0.3], [0.15, 0.8]], 12), STEM),
      part(wobble(lathe(dome(0.62, 0.8, 0.3, 0.8), 32), 5, 0.05, 0.4), BODY),
      part(lathe([[0.15, 0.79], [0.62, 0.8]]), UNDER),
      ...spines.map((g) => part(g, UNDER)),
    )
  },

  spines: () => {
    const rand = seeded('spines')
    const icicles: BufferGeometry[] = []
    for (let i = 0; i < 90; i++) {
      // Hang from the lower half of the body, longer towards the bottom.
      const a = rand() * Math.PI * 2
      const u = rand()
      const r = 0.5 * Math.sqrt(1 - u * u * 0.8)
      const y = 0.75 - u * 0.3
      const len = 0.25 + u * 0.35 + rand() * 0.15
      icicles.push(new ConeGeometry(0.03, len, 5).rotateX(Math.PI).translate(r * Math.cos(a), y - len / 2, r * Math.sin(a)))
    }
    return merge(
      part(lathe([[0.18, 0], [0.12, 0.45]], 10), STEM),
      part(new SphereGeometry(0.5, 20, 12).scale(1, 0.55, 1).translate(0, 0.8, 0), BODY),
      ...icicles.map((g) => part(g, BODY)),
    )
  },

  bracket: () => merge(wood(), shelf(0.62, 0.62, 0.32, 0)),

  shelves: () =>
    merge(
      wood(),
      shelf(0.62, 0.3, 0.09, -0.15),
      shelf(0.5, 0.58, 0.08, 0.35),
      shelf(0.42, 0.84, 0.07, -0.5),
      shelf(0.34, 1.05, 0.06, 0.15),
    ),

  oyster: () =>
    merge(
      ...[
        { size: 0.6, y: 0.62, turn: 0, tilt: 0.15 },
        { size: 0.5, y: 0.45, turn: 2.2, tilt: 0.25 },
        { size: 0.46, y: 0.8, turn: 4.1, tilt: 0.1 },
      ].flatMap(({ size, y, turn, tilt }) => {
        // A short stem leaning outward into an off-centre, shell-shaped cap.
        const fan = wobble(lathe(curve(size, 0, (x) => 0.14 * Math.sin(Math.PI * x) - 0.04 * (1 - x)), 24), 5, 0.04, 0.5)
        const gills = lathe([[0, -0.02], [size, -0.005]], 24)
        const place = (g: BufferGeometry) =>
          g.scale(1, 1, 0.85).translate(size * 0.6, 0, 0).rotateZ(tilt).translate(0, y, 0).rotateY(turn)
        const stem = new CylinderGeometry(0.06, 0.08, Math.hypot(size * 0.3, y), 8, 1, true)
          .translate(0, Math.hypot(size * 0.3, y) / 2, 0)
          .rotateZ(-Math.atan2(size * 0.3, y))
          .rotateY(turn)
        return [part(stem, STEM), part(place(fan), BODY), part(place(gills), UNDER)]
      }),
    ),

  morel: () => {
    // A honeycombed cone: pits carved into the surface along a staggered grid.
    const cap = lathe(
      Array.from({ length: 25 }, (_, i) => {
        const t = i / 24
        return [0.32 * Math.pow(Math.sin(Math.PI * (0.5 + 0.5 * t)) + 0.02, 0.55), 0.42 + t * 0.95] as [number, number]
      }),
      40,
    )
    displace(cap, (p) => {
      const a = Math.atan2(p.z, p.x)
      const row = p.y * 11
      const cell = Math.abs(Math.sin(a * 5 + Math.floor(row) * 1.3)) * Math.abs(Math.sin(row * Math.PI))
      return 1 - 0.2 * Math.pow(cell, 0.7)
    })
    return merge(part(lathe([[0, 0], [0.2, 0.02], [0.16, 0.25], [0.18, 0.44]], 12), STEM), part(cap, BODY))
  },

  thimble: () => {
    // A bell attached only at the very top of the stem, its rim hanging free around it.
    const bell: Profile = [[0.3, 0.78], [0.32, 0.92], [0.31, 1.08], [0.25, 1.22], [0.13, 1.31], [0, 1.33]]
    const cap = lathe(bell, 36)
    displace(cap, (p) => 1 - 0.07 * Math.abs(Math.sin(Math.atan2(p.z, p.x) * 8 + Math.sin(p.y * 14) * 0.5)))
    return merge(
      part(lathe([[0.15, 0], [0.13, 0.4], [0.11, 0.9], [0.1, 1.3]], 12), STEM),
      part(cap, BODY),
      // Inside of the bell, paler, so the gap around the stem shows.
      part(lathe(bell.map(([r, y]) => [r * 0.92, y - 0.02]), 36), UNDER),
    )
  },

  brain: () => {
    const cap = new SphereGeometry(0.46, 40, 28).scale(1.15, 0.85, 1)
    displace(cap, (p) => 1 + 0.12 * Math.sin(9 * p.x + 2) * Math.sin(8 * p.y) * Math.sin(10 * p.z + 1) + 0.05 * Math.sin(17 * p.x + 13 * p.z))
    return merge(part(lathe([[0, 0], [0.24, 0.02], [0.2, 0.3], [0.22, 0.5]], 12), STEM), part(cap.translate(0, 0.78, 0), BODY))
  },

  puffball: () =>
    merge(
      part(lathe([[0, 0], [0.14, 0], [0.2, 0.12], [0.24, 0.3], [0.3, 0.42]], 16), STEM),
      part(lathe([[0.3, 0.42], [0.38, 0.6], [0.4, 0.75], [0.35, 0.92], [0.24, 1.02], [0, 1.06]], 24), BODY),
    ),

  truffle: () => {
    const rand = seeded('truffle')
    const lumps = Array.from({ length: 4 }, () => [randomUnit(rand), 0.1 + rand() * 0.1] as const)
    const body = new SphereGeometry(0.5, 36, 24)
    displace(body, (p) => {
      const n = p.clone().normalize()
      let r = 1
      for (const [dir, amt] of lumps) r += amt * Math.max(0, n.dot(dir)) ** 3
      // Fine pyramidal warts over the whole skin.
      return r + 0.03 * Math.abs(Math.sin(30 * n.x) * Math.sin(30 * n.y) * Math.sin(30 * n.z))
    })
    return merge(part(body.translate(0, 0.5, 0), BODY))
  },

  club: () =>
    merge(
      ...[
        { x: 0, z: 0, h: 1.15, lean: 0.05 },
        { x: 0.2, z: 0.08, h: 0.85, lean: -0.3 },
        { x: -0.16, z: 0.14, h: 0.7, lean: 0.35 },
        { x: 0.03, z: -0.2, h: 0.95, lean: 0.2 },
      ].flatMap(({ x, z, h, lean }) => {
        const k = h / 1.15
        const stem = lathe([[0.07, 0], [0.06, 0.5 * k]], 8)
        const head = lathe([[0.06, 0.5 * k], [0.12, 0.68 * k], [0.14, 0.92 * k], [0.1, 1.08 * k], [0, h]], 12)
        const place = (g: BufferGeometry) => g.rotateZ(lean).rotateY(x * 9).translate(x, 0, z)
        return [part(place(stem), STEM), part(place(head), BODY)]
      }),
    ),

  ear: () => {
    // A cupped shell cut from a sphere, flattened and frilled, sticking out of a twig.
    const ear = (r: number, y: number, turn: number) => {
      const g = new SphereGeometry(r, 28, 14, 0, Math.PI * 1.5, Math.PI * 0.5, Math.PI * 0.42).scale(1, 0.55, 0.8)
      wobble(g, 6, 0.05, 0)
      return part(g.rotateX(-1.1).translate(0, y, 0.12).rotateY(turn), BODY)
    }
    return merge(
      part(new CylinderGeometry(0.1, 0.12, 1.2, 10, 1, true).translate(0, 0.6, 0), STEM),
      ear(0.5, 0.75, 0.3),
      ear(0.36, 0.42, 2.8),
    )
  },
}

// ---------- helpers ----------

type Profile = [radius: number, y: number][]

function lathe(points: Profile, segments = 28) {
  return new LatheGeometry(points.map(([x, y]) => new Vector2(x, y)), segments)
}

/** Profile of a cap from its rim up to the crown; `round` < 1 flattens the top. */
function dome(radius: number, y: number, height: number, round = 1): Profile {
  return Array.from({ length: 9 }, (_, i) => {
    const a = (i / 8) * (Math.PI / 2)
    return [radius * Math.cos(a), y + height * Math.pow(Math.sin(a), round)]
  })
}

/** Profile from the rim (x = radius) to the centre with height `y + f(x / radius)`. */
function curve(radius: number, y: number, f: (x: number) => number): Profile {
  return Array.from({ length: 11 }, (_, i) => {
    const x = 1 - i / 10
    return [radius * x, y + f(x)]
  })
}

/** Waves the outer edge up and down: `amp` at the rim, fading out below `from` of the max radius. */
function wobble(g: BufferGeometry, waves: number, amp: number, from: number) {
  const p = g.attributes.position as BufferAttribute
  let max = 0
  for (let i = 0; i < p.count; i++) max = Math.max(max, Math.hypot(p.getX(i), p.getZ(i)))
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i)) / max
    const w = Math.max(0, (r - from) / (1 - from)) ** 2
    p.setY(i, p.getY(i) + amp * w * Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * waves))
  }
  g.computeVertexNormals()
  return g
}

/** Scales each vertex's distance from the Y axis (or the centre) by `f(position)`. */
function displace(g: BufferGeometry, f: (p: Vector3) => number) {
  const p = g.attributes.position as BufferAttribute
  const v = new Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const k = f(v)
    p.setXYZ(i, v.x * k, v.y * (g.type === 'LatheGeometry' ? 1 : k), v.z * k)
  }
  g.computeVertexNormals()
}

/** A stub of wood for brackets to grow on. */
function wood() {
  return part(new CylinderGeometry(0.2, 0.24, 1.25, 10, 1, false).translate(0, 0.62, 0), STEM)
}

/** A half-round shelf sticking out of the wood at height `y`, top and porous underside. */
function shelf(radius: number, y: number, thickness: number, turn: number) {
  const top = new LatheGeometry(
    curve(radius, 0, (x) => thickness * Math.pow(1 - x, 0.4)).map(([x, h]) => new Vector2(x, h)),
    20,
    0,
    Math.PI,
  )
  const under = new LatheGeometry([new Vector2(0, -thickness * 0.15), new Vector2(radius, 0)], 20, 0, Math.PI)
  const place = (g: BufferGeometry) => g.translate(0, y, 0).rotateY(turn)
  return merge(part(place(wobble(top, 5, 0.03, 0.6)), BODY), part(place(under), UNDER))
}

/** Tags every vertex with a part id and drops attributes the shader doesn't use. */
function part(g: BufferGeometry, id: number) {
  g.deleteAttribute('uv')
  g.setAttribute('aPart', new BufferAttribute(new Float32Array(g.attributes.position.count).fill(id), 1))
  return g
}

function merge(...parts: BufferGeometry[]) {
  // Everything must be indexed (or not) alike for mergeGeometries.
  const merged = mergeGeometries(parts.map((g) => (g.index ? g : indexed(g))))
  if (!merged) throw new Error('could not merge mushroom parts')
  parts.forEach((g) => g.dispose())
  return merged
}

function indexed(g: BufferGeometry) {
  g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i))
  return g
}
