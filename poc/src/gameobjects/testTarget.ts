import * as THREE from 'three'
import type { TargetHit } from '../weapons/behaviour'

export interface TestTarget {
  hit: TargetHit
  update(dt: number): void
  dispose(): void
}

export function createTestTarget(
  x: number,
  z: number,
  y: number,
  radius: number,
  hp: number,
  scene: THREE.Scene,
): TestTarget {
  const geo = new THREE.BoxGeometry(radius * 2, 0.4, radius * 2)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff3b3b,
    wireframe: true,
    transparent: true,
    opacity: 0.9,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  scene.add(mesh)

  const hit: TargetHit = {
    team: 'enemy',
    active: true,
    x,
    z,
    radius,
    takeDamage(amount: number): void {
      hp -= amount
      if (hp <= 0) {
        this.active = false
        mesh.visible = false
      }
    },
  }

  return {
    hit,
    update(): void {
      mesh.position.set(hit.x, y, hit.z)
    },
    dispose(): void {
      scene.remove(mesh)
      geo.dispose()
      mat.dispose()
    },
  }
}