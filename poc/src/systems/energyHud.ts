import * as THREE from 'three'

export interface EnergyHud {
  update(ship: { x: number; y: number; z: number }, energy: { current: number; max: number }): void
  dispose(): void
}

const BAR_OFFSET_Y = 24
const MARGIN = 10

export function createEnergyHud(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
): EnergyHud {
  const el = document.createElement('div')
  el.className = 'hud-energy'
  el.style.display = 'none'

  const label = document.createElement('span')
  label.className = 'hud-energy-label'
  const fill = document.createElement('span')
  fill.className = 'hud-energy-fill'
  fill.style.width = '100%'

  el.append(label, fill)
  document.body.appendChild(el)

  const projected = new THREE.Vector3()

  return {
    update(ship, energy): void {
      projected.set(ship.x, ship.y, ship.z).project(camera)

      if (projected.z > 1) {
        el.style.display = 'none'
        return
      }

      const rect = canvas.getBoundingClientRect()
      let left = (projected.x * 0.5 + 0.5) * rect.width + rect.left
      let top = (-projected.y * 0.5 + 0.5) * rect.height + rect.top - BAR_OFFSET_Y

      left = Math.min(Math.max(left, rect.left + MARGIN), rect.right - MARGIN)
      top = Math.min(Math.max(top, rect.top + MARGIN), rect.bottom - MARGIN)

      const pct = energy.max <= 0 ? 0 : Math.max(0, Math.min(1, energy.current / energy.max))
      fill.style.width = `${(pct * 100).toFixed(1)}%`
      label.textContent = `ENERGY ${Math.floor(energy.current)}/${energy.max}`

      el.style.transform = `translate(-50%, -100%) translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`
      el.style.display = 'block'
    },
    dispose(): void {
      document.body.removeChild(el)
    },
  }
}