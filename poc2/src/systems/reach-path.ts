/**
 * Reach-path curve (A spawn → B gate) — shared by movement + debug polyline.
 * Temporary tuning surface: tweak live via Path debugger tab.
 * Axis modes are per spawn side (left / right / front).
 */

import { clamp, easeInOutCubic, lerp, lerpGeometric } from '../core/math'

export type PathEaseId = 'linear' | 'easeInOutCubic' | 'easeInCubic' | 'easeOutCubic'
export type AxisLerpMode = 'linear' | 'geometric' | 'power'
export type ReachPreviewSide = 'left' | 'right' | 'front'

/** Per-side A→B axis shaping (power / geometric / linear). */
export interface ReachAxisProfile {
  xMode: AxisLerpMode
  yMode: AxisLerpMode
  zMode: AxisLerpMode
  xPower: number
  yPower: number
  zPower: number
}

export interface ReachPathConfig {
  /** Time ease applied before per-axis lerp (shared). */
  ease: PathEaseId
  /** Active edit buffer — mirrors sides[previewSide]. */
  xMode: AxisLerpMode
  yMode: AxisLerpMode
  zMode: AxisLerpMode
  xPower: number
  yPower: number
  zPower: number
  /** Tuned defaults per spawn side. */
  sides: Record<ReachPreviewSide, ReachAxisProfile>
  samples: number
  visible: boolean
  extendToZero: boolean
  zero: { x: number; y: number; z: number }
  previewSide: ReachPreviewSide
  previewEntryIndex: number
  color: number
  zeroColor: number
  reachStrategy: 'synchronizedLerp' | 'seekChase'
}

export const DEFAULT_SIDE_LEFT: ReachAxisProfile = {
  xMode: 'power',
  xPower: 1,
  yMode: 'power',
  yPower: 1.5,
  zMode: 'power',
  zPower: 2,
}

export const DEFAULT_SIDE_FRONT: ReachAxisProfile = {
  xMode: 'power',
  xPower: 1,
  yMode: 'power',
  yPower: 0.2,
  zMode: 'power',
  zPower: 1,
}

/** Right mirrors left. */
export const DEFAULT_SIDE_RIGHT: ReachAxisProfile = { ...DEFAULT_SIDE_LEFT }

function cloneSides(
  left: ReachAxisProfile = DEFAULT_SIDE_LEFT,
  right: ReachAxisProfile = DEFAULT_SIDE_RIGHT,
  front: ReachAxisProfile = DEFAULT_SIDE_FRONT,
): Record<ReachPreviewSide, ReachAxisProfile> {
  return {
    left: { ...left },
    right: { ...right },
    front: { ...front },
  }
}

export const DEFAULT_REACH_PATH: ReachPathConfig = {
  ease: 'easeInOutCubic',
  ...DEFAULT_SIDE_LEFT,
  sides: cloneSides(),
  samples: 48,
  visible: true,
  extendToZero: true,
  zero: { x: 0, y: 0, z: 0 },
  previewSide: 'left',
  previewEntryIndex: 1,
  color: 0xff66aa,
  zeroColor: 0x66ffcc,
  reachStrategy: 'synchronizedLerp',
}

/** Live mutable config — debugger + movement read the same object. */
export const LIVE_REACH_PATH: ReachPathConfig = {
  ...DEFAULT_REACH_PATH,
  zero: { ...DEFAULT_REACH_PATH.zero },
  sides: cloneSides(),
}

function copyProfile(src: ReachAxisProfile, dst: ReachAxisProfile): void {
  dst.xMode = src.xMode
  dst.yMode = src.yMode
  dst.zMode = src.zMode
  dst.xPower = src.xPower
  dst.yPower = src.yPower
  dst.zPower = src.zPower
}

/** Push sides[previewSide] into the top-level edit buffer. */
export function syncEditBufferFromSide(
  config: ReachPathConfig = LIVE_REACH_PATH,
  side: ReachPreviewSide = config.previewSide,
): void {
  const profile = config.sides[side]
  config.xMode = profile.xMode
  config.yMode = profile.yMode
  config.zMode = profile.zMode
  config.xPower = profile.xPower
  config.yPower = profile.yPower
  config.zPower = profile.zPower
}

/** Write top-level edit buffer back into sides[previewSide]. */
export function commitEditBufferToSide(
  config: ReachPathConfig = LIVE_REACH_PATH,
  side: ReachPreviewSide = config.previewSide,
): void {
  const profile = config.sides[side]
  profile.xMode = config.xMode
  profile.yMode = config.yMode
  profile.zMode = config.zMode
  profile.xPower = config.xPower
  profile.yPower = config.yPower
  profile.zPower = config.zPower
}

export function resetLiveReachPath(defaults: ReachPathConfig = DEFAULT_REACH_PATH): void {
  LIVE_REACH_PATH.ease = defaults.ease
  LIVE_REACH_PATH.samples = defaults.samples
  LIVE_REACH_PATH.visible = defaults.visible
  LIVE_REACH_PATH.extendToZero = defaults.extendToZero
  LIVE_REACH_PATH.zero.x = defaults.zero.x
  LIVE_REACH_PATH.zero.y = defaults.zero.y
  LIVE_REACH_PATH.zero.z = defaults.zero.z
  LIVE_REACH_PATH.previewSide = defaults.previewSide
  LIVE_REACH_PATH.previewEntryIndex = defaults.previewEntryIndex
  LIVE_REACH_PATH.color = defaults.color
  LIVE_REACH_PATH.zeroColor = defaults.zeroColor
  LIVE_REACH_PATH.reachStrategy = defaults.reachStrategy
  copyProfile(defaults.sides.left, LIVE_REACH_PATH.sides.left)
  copyProfile(defaults.sides.right, LIVE_REACH_PATH.sides.right)
  copyProfile(defaults.sides.front, LIVE_REACH_PATH.sides.front)
  syncEditBufferFromSide(LIVE_REACH_PATH, LIVE_REACH_PATH.previewSide)
}

export function applyPathEase(t: number, ease: PathEaseId): number {
  const x = clamp(t, 0, 1)
  if (ease === 'linear') {
    return x
  }
  if (ease === 'easeInCubic') {
    return x * x * x
  }
  if (ease === 'easeOutCubic') {
    return 1 - Math.pow(1 - x, 3)
  }
  return easeInOutCubic(x)
}

export function axisPathLerp(
  a: number,
  b: number,
  t: number,
  mode: AxisLerpMode,
  power: number,
): number {
  const u = clamp(t, 0, 1)
  if (mode === 'geometric') {
    return lerpGeometric(a, b, u)
  }
  if (mode === 'power') {
    return lerp(a, b, Math.pow(u, Math.max(0.01, power)))
  }
  return lerp(a, b, u)
}

export interface PathVec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

function profileFor(
  config: ReachPathConfig,
  side: ReachPreviewSide | null,
): ReachAxisProfile {
  if (side) {
    return config.sides[side]
  }
  return {
    xMode: config.xMode,
    yMode: config.yMode,
    zMode: config.zMode,
    xPower: config.xPower,
    yPower: config.yPower,
    zPower: config.zPower,
  }
}

/** Sample one point on A→B for normalised t ∈ [0,1]. */
export function sampleReachPoint(
  from: PathVec3,
  to: PathVec3,
  t: number,
  out: { x: number; y: number; z: number },
  config: ReachPathConfig = LIVE_REACH_PATH,
  side: ReachPreviewSide | null = null,
): void {
  const u = applyPathEase(t, config.ease)
  const axis = profileFor(config, side)
  out.x = axisPathLerp(from.x, to.x, u, axis.xMode, axis.xPower)
  out.y = axisPathLerp(from.y, to.y, u, axis.yMode, axis.yPower)
  out.z = axisPathLerp(from.z, to.z, u, axis.zMode, axis.zPower)
}

/**
 * Write polyline positions into a flat Float32Array [x,y,z, ...].
 * Uses config.previewSide axis profile. Returns vertex count written.
 */
export function writeReachPolyline(
  from: PathVec3,
  to: PathVec3,
  out: Float32Array,
  config: ReachPathConfig = LIVE_REACH_PATH,
): number {
  const samples = Math.max(2, Math.floor(config.samples))
  const side = config.previewSide
  const scratch = { x: 0, y: 0, z: 0 }
  let write = 0
  const maxVerts = Math.floor(out.length / 3)

  const push = (x: number, y: number, z: number): boolean => {
    if (write >= maxVerts) {
      return false
    }
    const i = write * 3
    out[i] = x
    out[i + 1] = y
    out[i + 2] = z
    write += 1
    return true
  }

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    sampleReachPoint(from, to, t, scratch, config, side)
    if (!push(scratch.x, scratch.y, scratch.z)) {
      return write
    }
  }

  if (!config.extendToZero) {
    return write
  }

  const zero = config.zero
  for (let i = 1; i < samples; i++) {
    const t = i / (samples - 1)
    sampleReachPoint(to, zero, t, scratch, config, side)
    if (!push(scratch.x, scratch.y, scratch.z)) {
      return write
    }
  }
  return write
}
