/**
 * Reynolds steering primitives on the XZ plane.
 *
 * Every helper accumulates a force into a caller-owned `SteerAcc` using plain
 * scalars — no vector objects are created, so the whole AI hot path stays
 * allocation free (RUL-13).
 */

import { clamp } from '../core/math'

export interface SteerAcc {
  x: number
  z: number
}

const EPS = 1e-6

export function resetAcc(acc: SteerAcc): void {
  acc.x = 0
  acc.z = 0
}

/** Steer toward a point at full speed (desired − velocity). */
export function addSeek(
  acc: SteerAcc,
  px: number,
  pz: number,
  tx: number,
  tz: number,
  vx: number,
  vz: number,
  maxSpeed: number,
  weight = 1,
): void {
  const dx = tx - px
  const dz = tz - pz
  const len = Math.hypot(dx, dz)
  if (len <= EPS) {
    return
  }
  const scale = maxSpeed / len
  acc.x += (dx * scale - vx) * weight
  acc.z += (dz * scale - vz) * weight
}

/** Seek that ramps the desired speed down inside `slowRadius`. */
export function addArrive(
  acc: SteerAcc,
  px: number,
  pz: number,
  tx: number,
  tz: number,
  vx: number,
  vz: number,
  maxSpeed: number,
  slowRadius: number,
  weight = 1,
): void {
  const dx = tx - px
  const dz = tz - pz
  const len = Math.hypot(dx, dz)
  if (len <= EPS) {
    acc.x -= vx * weight
    acc.z -= vz * weight
    return
  }
  const ramp = slowRadius > EPS ? Math.min(1, len / slowRadius) : 1
  const scale = (maxSpeed * ramp) / len
  acc.x += (dx * scale - vx) * weight
  acc.z += (dz * scale - vz) * weight
}

/** Steer directly away from a point. */
export function addFlee(
  acc: SteerAcc,
  px: number,
  pz: number,
  tx: number,
  tz: number,
  vx: number,
  vz: number,
  maxSpeed: number,
  weight = 1,
): void {
  const dx = px - tx
  const dz = pz - tz
  const len = Math.hypot(dx, dz)
  if (len <= EPS) {
    return
  }
  const scale = maxSpeed / len
  acc.x += (dx * scale - vx) * weight
  acc.z += (dz * scale - vz) * weight
}

/** Short-range mutual repulsion; falls off linearly to zero at `radius`. */
export function addSeparation(
  acc: SteerAcc,
  px: number,
  pz: number,
  ox: number,
  oz: number,
  radius: number,
  weight = 1,
): void {
  if (radius <= EPS) {
    return
  }
  const dx = px - ox
  const dz = pz - oz
  const d = Math.hypot(dx, dz)
  if (d >= radius) {
    return
  }
  if (d <= EPS) {
    acc.x += weight
    return
  }
  const strength = ((radius - d) / radius) * weight
  acc.x += (dx / d) * strength
  acc.z += (dz / d) * strength
}

/**
 * Sidestep a rogue ship's corridor: pushes perpendicular to its heading when we
 * sit inside the tube it is about to sweep. Rogues never call this — they own
 * the right of way.
 */
export function addAvoidRogue(
  acc: SteerAcc,
  px: number,
  pz: number,
  rx: number,
  rz: number,
  rvx: number,
  rvz: number,
  radius: number,
  weight = 1,
): void {
  if (radius <= EPS) {
    return
  }
  const speed = Math.hypot(rvx, rvz)
  if (speed <= EPS) {
    addSeparation(acc, px, pz, rx, rz, radius, weight)
    return
  }
  const fx = rvx / speed
  const fz = rvz / speed
  const toX = px - rx
  const toZ = pz - rz
  const along = toX * fx + toZ * fz
  if (along < 0 || along > radius * 2) {
    return
  }
  const perpX = toX - along * fx
  const perpZ = toZ - along * fz
  const d = Math.hypot(perpX, perpZ)
  if (d >= radius) {
    return
  }
  const strength = ((radius - d) / radius) * weight
  if (d <= EPS) {
    acc.x += -fz * strength
    acc.z += fx * strength
    return
  }
  acc.x += (perpX / d) * strength
  acc.z += (perpZ / d) * strength
}

/**
 * Viewport containment on X: force grows exponentially once the craft enters
 * the `inset` band before a wall, so nothing drifts into the blind zone.
 */
export function addContainmentX(
  acc: SteerAcc,
  px: number,
  minX: number,
  maxX: number,
  inset: number,
  exponent: number,
  weight: number,
): void {
  if (inset <= EPS || weight <= 0) {
    return
  }
  const high = maxX - inset
  if (px > high) {
    const pen = clamp((px - high) / inset, 0, 2)
    acc.x -= weight * (Math.exp(exponent * pen) - 1)
    return
  }
  const low = minX + inset
  if (px < low) {
    const pen = clamp((low - px) / inset, 0, 2)
    acc.x += weight * (Math.exp(exponent * pen) - 1)
  }
}

/** Clamp the accumulated force magnitude (agility bound). */
export function truncate(acc: SteerAcc, max: number): void {
  const len = Math.hypot(acc.x, acc.z)
  if (len <= max || len <= EPS) {
    return
  }
  const s = max / len
  acc.x *= s
  acc.z *= s
}

/** Clamp a velocity in place to `maxSpeed`. */
export function clampSpeed(vel: SteerAcc, maxSpeed: number): void {
  truncate(vel, maxSpeed)
}
