/**
 * Center-free formation templates (local XZ offsets around a group centroid).
 *
 * Every template keeps (0,0) empty: ships only ever sit on vertices or on the
 * perimeter. Pure geometry — no state, no allocation: callers pass a slot array
 * sized once (maxPerGroup) and get back how many entries were written.
 */

export type FormationId = 'hollowCircle' | 'vWing' | 'hollowDiamond'

export const FORMATION_IDS: readonly FormationId[] = [
  'hollowCircle',
  'vWing',
  'hollowDiamond',
] as const

/** Local offset from the group centroid (y is locked to the group plane). */
export interface SlotOffset {
  x: number
  z: number
}

export interface FormationParams {
  /** Hollow circle / regular polygon radius. */
  readonly circleRadius: number
  /** V-shape spacing between consecutive wing ranks. */
  readonly vSpacing: number
  /** V-shape half aperture (degrees from the -Z axis). */
  readonly vAngleDeg: number
  /** Hollow diamond half width (X vertices). */
  readonly diamondW: number
  /** Hollow diamond half height (Z vertices). */
  readonly diamondH: number
}

const DIAMOND_VX = [0, 1, 0, -1] as const
const DIAMOND_VZ = [1, 0, -1, 0] as const

/** Preallocate a slot buffer once, reuse forever. */
export function createSlotBuffer(capacity: number): SlotOffset[] {
  const out: SlotOffset[] = []
  for (let i = 0; i < capacity; i += 1) {
    out.push({ x: 0, z: 0 })
  }
  return out
}

/**
 * Write `count` slot offsets for `id` into `out`.
 * Returns the number written (clamped to the buffer length).
 */
export function computeFormationSlots(
  id: FormationId,
  count: number,
  params: FormationParams,
  out: SlotOffset[],
): number {
  const n = Math.max(0, Math.min(Math.floor(count), out.length))
  if (n === 0) {
    return 0
  }
  if (id === 'vWing') {
    return writeVWing(n, params, out)
  }
  if (id === 'hollowDiamond') {
    return writeHollowDiamond(n, params, out)
  }
  return writeHollowCircle(n, params, out)
}

/** Slot_i = (R·cos(2πi/N), R·sin(2πi/N)). */
function writeHollowCircle(n: number, params: FormationParams, out: SlotOffset[]): number {
  const r = Math.max(0.001, params.circleRadius)
  const step = (Math.PI * 2) / n
  for (let i = 0; i < n; i += 1) {
    const a = step * i
    const slot = out[i]
    if (!slot) {
      return i
    }
    slot.x = r * Math.cos(a)
    slot.z = r * Math.sin(a)
  }
  return n
}

/**
 * Slot_i = (±k·S·sin θ, −k·S·cos θ) with k = floor(i/2) + 1,
 * so rank 0 is already off the vertex and the center stays empty.
 */
function writeVWing(n: number, params: FormationParams, out: SlotOffset[]): number {
  const s = Math.max(0.001, params.vSpacing)
  const theta = (Math.max(1, params.vAngleDeg) * Math.PI) / 180
  const sin = Math.sin(theta)
  const cos = Math.cos(theta)
  for (let i = 0; i < n; i += 1) {
    const slot = out[i]
    if (!slot) {
      return i
    }
    const rank = Math.floor(i / 2) + 1
    const side = i % 2 === 0 ? 1 : -1
    slot.x = side * rank * s * sin
    slot.z = -rank * s * cos
  }
  return n
}

/**
 * Ships spread along the closed outline (0,H) → (W,0) → (0,−H) → (−W,0),
 * parameterised by perimeter fraction so no slot lands on the center.
 */
function writeHollowDiamond(n: number, params: FormationParams, out: SlotOffset[]): number {
  const w = Math.max(0.001, params.diamondW)
  const h = Math.max(0.001, params.diamondH)
  for (let i = 0; i < n; i += 1) {
    const slot = out[i]
    if (!slot) {
      return i
    }
    const t = (i / n) * 4
    const seg = Math.min(3, Math.floor(t))
    const u = t - seg
    const next = (seg + 1) % 4
    const ax = (DIAMOND_VX[seg] ?? 0) * w
    const az = (DIAMOND_VZ[seg] ?? 0) * h
    const bx = (DIAMOND_VX[next] ?? 0) * w
    const bz = (DIAMOND_VZ[next] ?? 0) * h
    slot.x = ax + (bx - ax) * u
    slot.z = az + (bz - az) * u
  }
  return n
}
