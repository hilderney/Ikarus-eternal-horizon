import * as THREE from 'three'

export interface ShipCoordsLabel {
  update(position: { x: number; y: number; z: number }): void
  dispose(): void
}

const LABEL_OFFSET_Y = 28
const MARGIN = 12

export function createShipPositionLabel(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
): ShipCoordsLabel {
  const el = document.createElement('div')
  el.className = 'ship-coords'
  el.style.display = 'none'
  document.body.appendChild(el)

  const projected = new THREE.Vector3()

  return {
    update(position: { x: number; y: number; z: number }): void {
      projected.set(position.x, position.y, position.z).project(camera)

      if (projected.z > 1) {
        el.style.display = 'none'
        return
      }

      const rect = canvas.getBoundingClientRect()
      let left = (projected.x * 0.5 + 0.5) * rect.width + rect.left
      let top = (-projected.y * 0.5 + 0.5) * rect.height + rect.top - LABEL_OFFSET_Y

      left = Math.min(Math.max(left, rect.left + MARGIN), rect.right - MARGIN)
      top = Math.min(Math.max(top, rect.top + MARGIN), rect.bottom - MARGIN)

      el.textContent = `X ${position.x.toFixed(2)}  Y ${position.y.toFixed(2)}  Z ${position.z.toFixed(2)}`
      el.style.transform = `translate(-50%, -100%) translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`
      el.style.display = 'block'
    },
    dispose(): void {
      document.body.removeChild(el)
    },
  }
}