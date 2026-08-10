import type { CameraRig, CameraConfig } from '../gameobjects/cameraRig'
import type { Ship, ShipTransform } from '../gameobjects/ship'
import type { ParallaxLayerConfig } from '../gameobjects/parallax'

export type ControlMode = 'camera' | 'ship'

export interface ModeController {
  get(): ControlMode
  set(mode: ControlMode): void
}

export interface DebugBinds {
  rig: CameraRig
  camera: CameraConfig
  ship: Ship
  shipTransform: ShipTransform
  parallax: ParallaxLayerConfig[]
  parallaxApply: () => void
  followBox: Vec3Like
  mode: ModeController
}

interface Row {
  target: object
  key: string
  slider: HTMLInputElement
  spin: HTMLInputElement
  value: HTMLElement
}

interface Vec3Like {
  x: number
  y: number
  z: number
}

const read = (target: object, key: string): number =>
  (target as Record<string, number>)[key]
const write = (target: object, key: string, v: number): void => {
  ;(target as Record<string, number>)[key] = v
}

export interface DebugControlsHandle {
  setMode(mode: ControlMode): void
  updateReadout(ship: Vec3Like, camera: Vec3Like): void
}

export function createDebugControls(binds: DebugBinds): DebugControlsHandle {
  const rows: Row[] = []

  const panel = document.createElement('div')
  panel.className = 'debug-panel'
  document.body.appendChild(panel)

  const defaults = {
    camera: JSON.parse(JSON.stringify(binds.camera)) as CameraConfig,
    ship: JSON.parse(JSON.stringify(binds.shipTransform)) as ShipTransform,
    parallax: JSON.parse(JSON.stringify(binds.parallax)) as ParallaxLayerConfig[],
    followBox: JSON.parse(JSON.stringify(binds.followBox)),
  }

  const applyCamera = (): void => binds.rig.applyConfig(binds.camera)
  const applyShip = (): void => binds.ship.applyTransform(binds.shipTransform)
  const applyParallax = (): void => binds.parallaxApply()

  group('Positions')
  const posShip = createPosReadout(panel, 'Ship')
  const posCamera = createPosReadout(panel, 'Camera')

  function scalar(label: string, target: object, key: string, min: number, max: number, step: number, onChange: () => void): void {
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = label
    const value = document.createElement('span')
    value.className = 'debug-value'
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = String(min)
    slider.max = String(max)
    slider.step = String(step)
    const spin = document.createElement('input')
    spin.type = 'number'
    spin.step = String(step)

    const refresh = (): void => {
      value.textContent = format(read(target, key))
      slider.value = String(read(target, key))
      spin.value = String(read(target, key))
    }
    const commit = (raw: string): void => {
      const v = parseFloat(raw)
      if (Number.isFinite(v)) {
        write(target, key, v)
        onChange()
        refresh()
      }
    }
    slider.addEventListener('input', () => commit(slider.value))
    spin.addEventListener('input', () => commit(spin.value))
    refresh()

    const row = document.createElement('label')
    row.className = 'debug-row'
    row.append(name, slider, spin, value)
    panel.appendChild(row)
    rows.push({ target, key, slider, spin, value })
  }

  function vec(label: string, target: Vec3Like, onChange: () => void): void {
    const group = document.createElement('div')
    group.className = 'debug-vec'
    const title = document.createElement('div')
    title.className = 'debug-veclabel'
    title.textContent = label
    group.appendChild(title)
    const row = document.createElement('div')
    row.className = 'debug-vecrow'
    for (const k of ['x', 'y', 'z'] as const) {
      const input = document.createElement('input')
      input.type = 'number'
      input.step = '0.1'
      input.value = String(target[k])
      input.addEventListener('input', () => {
        const v = parseFloat(input.value)
        if (Number.isFinite(v)) {
          target[k] = v
          onChange()
        }
      })
      const tag = document.createElement('span')
      tag.className = 'debug-axis'
      tag.textContent = k
      const wrap = document.createElement('div')
      wrap.className = 'debug-axisinput'
      wrap.append(tag, input)
      row.appendChild(wrap)
    }
    group.appendChild(row)
    panel.appendChild(group)
  }

  function group(label: string): void {
    const el = document.createElement('div')
    el.className = 'debug-group'
    el.textContent = label
    panel.appendChild(el)
  }

  function subgroup(label: string): void {
    const el = document.createElement('div')
    el.className = 'debug-subgroup'
    el.textContent = label
    panel.appendChild(el)
  }

  group('Camera')
  scalar('FOV', binds.camera, 'fov', 10, 170, 1, applyCamera)
  vec('Position', binds.camera.position, applyCamera)
  vec('Rotation (deg)', binds.camera.rotation, applyCamera)
  scalar('Near', binds.camera, 'near', 0.01, 50, 0.01, applyCamera)
  scalar('Far', binds.camera, 'far', 50, 2500, 10, applyCamera)

  group('Ship')
  vec('Position', binds.shipTransform.position, applyShip)
  vec('Rotation (deg)', binds.shipTransform.rotation, applyShip)
  scalar('Scale', binds.shipTransform, 'scale', 0.2, 6, 0.05, applyShip)

  group('Follow Box')
  vec('Position', binds.followBox, () => {})

  group('Mode')
  const modeRow = document.createElement('div')
  modeRow.className = 'debug-row'
  const modeLabel = document.createElement('span')
  modeLabel.className = 'debug-label'
  modeLabel.textContent = 'Control'
  const modeSelect = document.createElement('select')
  modeSelect.className = 'debug-select'
  modeSelect.innerHTML = '<option value="camera">Camera</option><option value="ship">Ship</option>'
  modeSelect.value = binds.mode.get()
  const modeValue = document.createElement('span')
  modeValue.className = 'debug-value'
  modeValue.textContent = binds.mode.get()
  modeSelect.addEventListener('change', () => {
    binds.mode.set(modeSelect.value as ControlMode)
    modeValue.textContent = modeSelect.value
  })
  modeRow.append(modeLabel, modeSelect, modeValue)
  panel.appendChild(modeRow)

  group('Parallax')
  const layerLabels = ['1 — stars', '2 — debris', '3 — mesh']
  for (let i = 0; i < binds.parallax.length; i++) {
    const layer = binds.parallax[i] as unknown as Record<string, number>
    subgroup(layerLabels[i] ?? `${i + 1}`)
    const apply = (): void => applyParallax()
    scalar('count', layer, 'count', 10, 2000, 10, apply)
    scalar('speed', layer, 'speed', -400, 400, 1, apply)
    scalar('speedJitter', layer, 'speedJitter', 0, 1, 0.01, apply)
    scalar('size', layer, 'size', 0.02, 3, 0.01, apply)
    scalar('alpha', layer, 'alpha', 0, 1, 0.01, apply)
    scalar('xSpan', layer, 'xSpan', 4, 400, 1, apply)
    scalar('layerY', layer, 'layerY', -200, 200, 0.5, apply)
    scalar('zNearWrap', layer, 'zNearWrap', -300, 300, 0.5, apply)
    scalar('zFar', layer, 'zFar', -2000, 0, 5, apply)
    scalar('gridSize', layer, 'gridSize', 4, 500, 1, apply)
    scalar('gridOpacity', layer, 'gridOpacity', 0, 1, 0.01, apply)
  }

  const bar = document.createElement('div')
  bar.className = 'debug-bar'
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.textContent = 'Reset'
  reset.addEventListener('click', () => {
    Object.assign(binds.camera, defaults.camera)
    Object.assign(binds.camera.position, defaults.camera.position)
    Object.assign(binds.camera.rotation, defaults.camera.rotation)
    Object.assign(binds.shipTransform, defaults.ship)
    Object.assign(binds.shipTransform.position, defaults.ship.position)
    Object.assign(binds.shipTransform.rotation, defaults.ship.rotation)
    for (let i = 0; i < binds.parallax.length; i++) {
      Object.assign(binds.parallax[i], defaults.parallax[i])
    }
    for (const r of rows) {
      const v = read(r.target, r.key)
      r.slider.value = String(v)
      r.spin.value = String(v)
      r.value.textContent = format(v)
    }
    Object.assign(binds.followBox, defaults.followBox)
    applyCamera()
    applyShip()
    applyParallax()
  })
  bar.appendChild(reset)
  panel.appendChild(bar)

  return {
    setMode(mode: ControlMode): void {
      modeSelect.value = mode
      modeValue.textContent = mode
    },
    updateReadout(ship: Vec3Like, camera: Vec3Like): void {
      posShip.textContent = `x ${ship.x.toFixed(2)}  y ${ship.y.toFixed(2)}  z ${ship.z.toFixed(2)}`
      posCamera.textContent = `x ${camera.x.toFixed(2)}  y ${camera.y.toFixed(2)}  z ${camera.z.toFixed(2)}`
    },
  }
}

function createPosReadout(panel: HTMLElement, label: string): HTMLElement {
  const row = document.createElement('div')
  row.className = 'debug-pos'
  const name = document.createElement('span')
  name.className = 'debug-poslabel'
  name.textContent = label
  const value = document.createElement('span')
  value.className = 'debug-posvalue'
  value.textContent = 'x 0.00  y 0.00  z 0.00'
  row.append(name, value)
  panel.appendChild(row)
  return value
}

function format(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}