import * as THREE from 'three'

export interface ShotSpawn {
  x: number
  y: number
  z: number
  vx: number
  vz: number
  damage: number
  lifetime: number
  color: number
  radius: number
  aoeRadius: number
  decayPerUnit: number
  range: number
  totalLifetime: number
}

export interface Shot {
  readonly group: THREE.Mesh
  active: boolean
  x: number
  y: number
  z: number
  vx: number
  vz: number
  damage: number
  lifetime: number
  color: number
  radius: number
  aoeRadius: number
  decayPerUnit: number
  range: number
  totalLifetime: number
  spawnX: number
  spawnZ: number
  activate(spawn: ShotSpawn): void
  update(dt: number): void
  deactivate(): void
  effectiveDamage(): number
}

export interface ShotPool {
  readonly size: number
  acquire(): Shot | null
  release(shot: Shot): void
  forEachActive(fn: (shot: Shot) => void): void
  clear(): void
  dispose(): void
}

const SHOT_BASE_WIDTH = 0.09

export function decayFactor(shot: Shot): number {
  if (shot.totalLifetime > 0) {
    const elapsed = Math.max(0, Math.min(1, 1 - shot.lifetime / shot.totalLifetime))
    if (elapsed <= 0.25) return 1
    if (elapsed <= 0.5) return 0.75
    if (elapsed <= 0.75) return 0.5
    return 0.25
  }
  const dist = Math.hypot(shot.x - shot.spawnX, shot.z - shot.spawnZ)
  if (shot.range > 0) {
    const f = dist / shot.range
    if (f <= 0.25) return 1
    if (f <= 0.5) return 0.75
    if (f <= 0.75) return 0.5
    return 0.25
  }
  return Math.max(0, 1 - shot.decayPerUnit * dist)
}

export function createShotPool(size: number, scene: THREE.Scene): ShotPool {
  const shots: Shot[] = []
  const active: Shot[] = []
  for (let i = 0; i < size; i++) {
    const geo = new THREE.BoxGeometry(SHOT_BASE_WIDTH, SHOT_BASE_WIDTH, 0.7)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.visible = false
    scene.add(mesh)

    const shot: Shot = {
      group: mesh,
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      damage: 0,
      lifetime: 0,
      color: 0xffffff,
      radius: 0,
      aoeRadius: 0,
      decayPerUnit: 0,
      range: 0,
      totalLifetime: 0,
      spawnX: 0,
      spawnZ: 0,
      activate(spawn: ShotSpawn): void {
        this.x = spawn.x
        this.y = spawn.y
        this.z = spawn.z
        this.vx = spawn.vx
        this.vz = spawn.vz
        this.damage = spawn.damage
        this.lifetime = spawn.lifetime
        this.color = spawn.color
        this.radius = spawn.radius
        this.aoeRadius = spawn.aoeRadius
        this.decayPerUnit = spawn.decayPerUnit
        this.range = spawn.range
        this.totalLifetime = spawn.totalLifetime
        this.spawnX = spawn.x
        this.spawnZ = spawn.z
        mat.color.setHex(spawn.color)
        mesh.position.set(spawn.x, spawn.y, spawn.z)
        mesh.scale.setScalar(1)
        mat.opacity = 1
        mesh.visible = true
        this.active = true
      },
      update(dt: number): void {
        this.x += this.vx * dt
        this.z += this.vz * dt
        this.lifetime -= dt
        mesh.position.set(this.x, this.y, this.z)
        const factor = decayFactor(this)
        mat.opacity = factor
        const visualScale = (this.radius * 2) / SHOT_BASE_WIDTH
        mesh.scale.set(visualScale, visualScale, 1)
      },
      deactivate(): void {
        this.active = false
        mesh.visible = false
      },
      effectiveDamage(): number {
        return this.damage * decayFactor(this)
      },
    }

    shots.push(shot)
    active.push(shot)
  }

  let head = 0

  return {
    size,
    acquire(): Shot | null {
      for (let i = 0; i < shots.length; i++) {
        const idx = (head + i) % shots.length
        const shot = shots[idx]
        if (!shot.active) {
          head = (idx + 1) % shots.length
          return shot
        }
      }
      return null
    },
    release(shot: Shot): void {
      shot.deactivate()
    },
    forEachActive(fn: (shot: Shot) => void): void {
      for (let i = 0; i < active.length; i++) {
        if (active[i].active) fn(active[i])
      }
    },
    clear(): void {
      for (const shot of shots) shot.deactivate()
    },
    dispose(): void {
      for (const shot of shots) {
        scene.remove(shot.group)
        shot.group.geometry.dispose()
        ;(shot.group.material as THREE.Material).dispose()
      }
      shots.length = 0
      active.length = 0
    },
  }
}
