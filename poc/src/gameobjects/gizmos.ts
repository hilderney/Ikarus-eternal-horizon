import * as THREE from 'three'

const AXIS_COLORS: Record<'x' | 'y' | 'z', number> = {
  x: 0xff4455,
  y: 0x55ff77,
  z: 0x55aaff,
}

export interface Gizmos {
  update(): void
  destroy(): void
}

export function createGizmos(scene: THREE.Scene, camera: THREE.Camera): Gizmos {
  const worldAxes = createWorldAxes()
  const grid = createPlayfieldGrid()
  const cameraAxes = createCameraAxes()
  scene.add(worldAxes)
  scene.add(grid)
  scene.add(cameraAxes)

  return {
    update(): void {
      camera.updateWorldMatrix(true, false)
      cameraAxes.position.copy(camera.position)
      cameraAxes.quaternion.copy(camera.quaternion)
    },
    destroy(): void {
      scene.remove(worldAxes)
      scene.remove(grid)
      scene.remove(cameraAxes)
    },
  }
}

function createWorldAxes(): THREE.Group {
  const group = new THREE.Group()
  const size = 4
  addAxisLine(group, new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0), AXIS_COLORS.x)
  addAxisLine(group, new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0), AXIS_COLORS.y)
  addAxisLine(group, new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, size), AXIS_COLORS.z)
  addLabel(group, 'X', new THREE.Vector3(size + 0.4, 0, 0), '#ff4455')
  addLabel(group, 'Y', new THREE.Vector3(0, size + 0.4, 0), '#55ff77')
  addLabel(group, 'Z', new THREE.Vector3(0, 0, size + 0.4), '#55aaff')
  return group
}

function createPlayfieldGrid(): THREE.GridHelper {
  const grid = new THREE.GridHelper(44, 22, 0x2b6fd8, 0x2b6fd8)
  grid.position.y = 0
  const mat = grid.material as THREE.Material
  mat.transparent = true
  mat.opacity = 0.28
  mat.depthWrite = false
  return grid
}

function createCameraAxes(): THREE.Group {
  const group = new THREE.Group()
  const size = 2.2
  addAxisLine(group, new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0), AXIS_COLORS.x)
  addAxisLine(group, new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0), AXIS_COLORS.y)
  addAxisLine(group, new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, size), AXIS_COLORS.z)
  addLabel(group, 'cx', new THREE.Vector3(size + 0.25, 0, 0), '#ff6677', 0.6)
  addLabel(group, 'cy', new THREE.Vector3(0, size + 0.25, 0), '#77ff99', 0.6)
  addLabel(group, 'cz', new THREE.Vector3(0, 0, size + 0.25), '#77bbff', 0.6)
  return group
}

function addAxisLine(group: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, color: number): void {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b])
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
  })
  const line = new THREE.Line(geo, mat)
  line.frustumCulled = false
  group.add(line)
}

function addLabel(group: THREE.Group, text: string, position: THREE.Vector3, color: string, scale = 0.9): void {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, 128, 128)
  ctx.font = 'bold 64px Consolas, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text, 64, 64)

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.position.copy(position)
  sprite.scale.set(scale, scale, 1)
  sprite.frustumCulled = false
  group.add(sprite)
}