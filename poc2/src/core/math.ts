/**
 * SDD-A03 Math — stateless helpers and scratch Vector3s (RUL-13).
 * Pure functions; no BALANCE reads; no class.
 */

import { Vector3 } from 'three'

/** Degrees → radians. */
export const DEG2RAD = Math.PI / 180

/** Inclusive clamp. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Linear interpolate. t is not clamped. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Exponential damp toward target.
 * `current + (target - current) * (1 - Math.exp(-lambda * dt))`.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

/** Planar distance on XZ. */
export function distXZ(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz)
}

/** Euclidean distance in XYZ. */
export function distXYZ(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  return Math.hypot(ax - bx, ay - by, az - bz)
}

/** Smoothstep-style cubic ease. t should be in [0, 1]. */
export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

export interface LerpVec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Component-wise lerp. Writes into `out` (no allocation). */
export function lerpVec3(
  a: LerpVec3,
  b: LerpVec3,
  t: number,
  out: { x: number; y: number; z: number },
): void {
  out.x = lerp(a.x, b.x, t)
  out.y = lerp(a.y, b.y, t)
  out.z = lerp(a.z, b.z, t)
}

/**
 * Geometric progression between a and b for t ∈ [0,1].
 * z(t) = a · (b/a)^t when a,b same sign and non-zero; else linear fallback.
 * Used on the Z axis of reachGate so the path curves while X/Y stay eased-linear.
 */
export function lerpGeometric(a: number, b: number, t: number): number {
  const u = clamp(t, 0, 1)
  if (u <= 0) {
    return a
  }
  if (u >= 1) {
    return b
  }
  if (a === 0 || b === 0 || a * b <= 0) {
    return lerp(a, b, u)
  }
  return a * Math.pow(b / a, u)
}

/**
 * Laser (and shot) damage/opacity factor from normalised elapsed time in [0, 1].
 * Boundaries 0.25 / 0.5 / 0.75 sit on the higher rung.
 */
export function decayFactor(elapsed: number): number {
  if (elapsed <= 0.25) {
    return 1
  }
  if (elapsed <= 0.5) {
    return 0.75
  }
  if (elapsed <= 0.75) {
    return 0.5
  }
  return 0.25
}

/** Module-level scratch Vector3s. Created once. Do not retain across frames. */
export const scratchV3A = new Vector3()
export const scratchV3B = new Vector3()
export const scratchV3C = new Vector3()
