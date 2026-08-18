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
