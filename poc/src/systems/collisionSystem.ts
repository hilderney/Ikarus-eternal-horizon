import type { Shot, ShotPool } from '../gameobjects/shot'
import type { TargetHit } from '../weapons/behaviour'

export interface CollisionSystem {
  targets: TargetHit[]
  registerTarget(t: TargetHit): void
  unregisterTarget(t: TargetHit): void
  update(dt: number, pools: readonly ShotPool[]): void
  clear(): void
}

export function createCollisionSystem(): CollisionSystem {
  const targets: TargetHit[] = []

  return {
    targets,
    registerTarget(t: TargetHit): void {
      if (!targets.includes(t)) targets.push(t)
    },
    unregisterTarget(t: TargetHit): void {
      const idx = targets.indexOf(t)
      if (idx >= 0) targets.splice(idx, 1)
    },
    update(dt: number, pools: readonly ShotPool[]): void {
      for (const pool of pools) {
        pool.forEachActive((shot) => {
          shot.update(dt)
          if (shot.lifetime <= 0) {
            if (shot.aoeRadius > 0) applyAoE(shot, targets)
            pool.release(shot)
            return
          }
          if (shot.aoeRadius > 0) {
            if (collidesWithTarget(shot, targets)) {
              applyAoE(shot, targets)
              pool.release(shot)
            }
            return
          }
          const hit = hitTargetAt(shot, targets)
          if (hit) {
            hit.takeDamage(shot.effectiveDamage())
            pool.release(shot)
          }
        })
      }
    },
    clear(): void {
      targets.length = 0
    },
  }
}

function collidesWithTarget(shot: Shot, targets: readonly TargetHit[]): boolean {
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    if (!t.active || t.team === 'player') continue
    const d = Math.hypot(shot.x - t.x, shot.z - t.z)
    if (d <= shot.radius + t.radius) return true
  }
  return false
}

function hitTargetAt(shot: Shot, targets: readonly TargetHit[]): TargetHit | null {
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    if (!t.active || t.team === 'player') continue
    const d = Math.hypot(shot.x - t.x, shot.z - t.z)
    if (d <= shot.radius + t.radius) return t
  }
  return null
}

function applyAoE(shot: Shot, targets: readonly TargetHit[]): void {
  const r = shot.aoeRadius
  const dmg = shot.effectiveDamage()
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    if (!t.active || t.team === 'player') continue
    const d = Math.hypot(shot.x - t.x, shot.z - t.z)
    if (d <= r + t.radius) t.takeDamage(dmg)
  }
}