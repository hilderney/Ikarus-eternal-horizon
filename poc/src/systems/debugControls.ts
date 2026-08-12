import type { CameraRig, CameraConfig } from '../gameobjects/cameraRig'
import type { Ship, ShipTransform } from '../gameobjects/ship'
import type { ParallaxLayerConfig } from '../gameobjects/parallax'
import type {
  ShipKeys,
  ShipMotionConfig,
  ShipTiltConfig,
  CameraControlConfig,
} from './controllers'

export interface DebugBinds {
  rig: CameraRig
  camera: CameraConfig
  ship: Ship
  shipTransform: ShipTransform
  parallax: ParallaxLayerConfig[]
  parallaxApply: () => void
  followBox: Vec3Like
  follow: {
    halfX: number
    halfZ: number
    bounce: { timeMs: number }
    recenter: { delayMs: number; stillMs: number; accel: number; maxSpeed: number }
  }
  recenterPoint: {
    position: Vec3Like
    width: number
    height: number
  }
  controls: {
    shipKeys: ShipKeys
    motion: ShipMotionConfig
    tilt: ShipTiltConfig
    camera: CameraControlConfig
  }
}

interface Row {
  target: object
  key: string
  slider: HTMLInputElement
  spin: HTMLInputElement
  value: HTMLElement
  refresh: () => void
}

interface VecRow {
  target: Vec3Like
  key: 'x' | 'y' | 'z'
  input: HTMLInputElement
}

interface SelRow {
  target: object
  key: string
  select: HTMLSelectElement
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
const readAny = (target: object, key: string): unknown =>
  (target as Record<string, unknown>)[key]
const writeAny = (target: object, key: string, v: string): void => {
  ;(target as Record<string, unknown>)[key] = v
}

export interface DebugControlsHandle {
  updateReadout(ship: Vec3Like, camera: Vec3Like): void
  sync(): void
  dispose(): void
}

export function createDebugControls(
  binds: DebugBinds,
  container: HTMLElement,
): DebugControlsHandle {
  const rows: Row[] = []
  const vecRows: VecRow[] = []
  const selects: SelRow[] = []

  const camPanel = requirePanel(container, 'cam')
  const shipPanel = requirePanel(container, 'ship')
  const followPanel = requirePanel(container, 'follow')
  const paraPanel = requirePanel(container, 'para')

  const posShip = container.querySelector<HTMLElement>('#pos-ship')
  const posCamera = container.querySelector<HTMLElement>('#pos-camera')

  const defaults = {
    camera: JSON.parse(JSON.stringify(binds.camera)) as CameraConfig,
    ship: JSON.parse(JSON.stringify(binds.shipTransform)) as ShipTransform,
    parallax: JSON.parse(JSON.stringify(binds.parallax)) as ParallaxLayerConfig[],
    followBox: JSON.parse(JSON.stringify(binds.followBox)),
    follow: JSON.parse(JSON.stringify(binds.follow)),
    recenterPoint: JSON.parse(JSON.stringify(binds.recenterPoint)),
    controls: JSON.parse(JSON.stringify(binds.controls)),
  }

  const applyCamera = (): void => binds.rig.applyConfig(binds.camera)
  const applyShip = (): void => binds.ship.applyTransform(binds.shipTransform)
  const applyParallax = (): void => binds.parallaxApply()

  function group(host: HTMLElement, label: string): void {
    const el = document.createElement('div')
    el.className = 'debug-group'
    el.textContent = label
    host.appendChild(el)
  }

  function subgroup(host: HTMLElement, label: string): void {
    const el = document.createElement('div')
    el.className = 'debug-subgroup'
    el.textContent = label
    host.appendChild(el)
  }

  function scalar(
    host: HTMLElement,
    label: string,
    target: object,
    key: string,
    min: number,
    max: number,
    step: number,
    onChange: () => void,
  ): void {
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
    host.appendChild(row)
    rows.push({ target, key, slider, spin, value, refresh })
  }

  function selectRow(
    host: HTMLElement,
    label: string,
    target: object,
    key: string,
    options: Array<{ value: string; text: string }>,
    onChange: () => void,
  ): void {
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = label
    const select = document.createElement('select')
    for (const opt of options) {
      const el = document.createElement('option')
      el.value = opt.value
      el.textContent = opt.text
      if (String(readAny(target, key)) === opt.value) el.selected = true
      select.appendChild(el)
    }
    select.addEventListener('change', () => {
      writeAny(target, key, select.value)
      onChange()
    })
    const row = document.createElement('label')
    row.className = 'debug-row'
    row.append(name, select)
    host.appendChild(row)
    selects.push({ target, key, select })
  }

  function vec(host: HTMLElement, label: string, target: Vec3Like, onChange: () => void): void {
    const block = document.createElement('div')
    block.className = 'debug-vec'
    const title = document.createElement('div')
    title.className = 'debug-veclabel'
    title.textContent = label
    block.appendChild(title)
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
      vecRows.push({ target, key: k, input })
    }
    block.appendChild(row)
    host.appendChild(block)
  }

  group(camPanel, 'Camera')
  scalar(camPanel, 'FOV', binds.camera, 'fov', 10, 170, 1, applyCamera)
  vec(camPanel, 'Position', binds.camera.position, applyCamera)
  vec(camPanel, 'Rotation (deg)', binds.camera.rotation, applyCamera)
  scalar(camPanel, 'Near', binds.camera, 'near', 0.01, 50, 0.01, applyCamera)
  scalar(camPanel, 'Far', binds.camera, 'far', 50, 2500, 10, applyCamera)
  subgroup(camPanel, 'Control')
  scalar(camPanel, 'Move Speed', binds.controls.camera, 'moveSpeed', 0, 60, 0.5, () => {})
  scalar(camPanel, 'Rot Speed', binds.controls.camera, 'rotSpeed', 0, 180, 1, () => {})

  group(shipPanel, 'Ship')
  vec(shipPanel, 'Position', binds.shipTransform.position, applyShip)
  vec(shipPanel, 'Rotation (deg)', binds.shipTransform.rotation, applyShip)
  scalar(shipPanel, 'Scale', binds.shipTransform, 'scale', 0.2, 6, 0.05, applyShip)
  subgroup(shipPanel, 'Motion')
  scalar(shipPanel, 'Max Speed', binds.controls.motion, 'maxSpeed', 0, 60, 0.5, () => {})
  scalar(shipPanel, 'Accel (force)', binds.controls.motion, 'accel', 0, 120, 0.5, () => {})
  scalar(shipPanel, 'Decel (force)', binds.controls.motion, 'decel', 0, 120, 0.5, () => {})
  scalar(shipPanel, 'Brake (force)', binds.controls.motion, 'brake', 0, 180, 0.5, () => {})
  subgroup(shipPanel, 'Tilt')
  selectRow(shipPanel, 'Axis', binds.controls.tilt, 'axis', [
    { value: 'y', text: 'Y' },
    { value: 'z', text: 'Z' },
  ], () => {})
  selectRow(shipPanel, 'Sign', binds.controls.tilt, 'sign', [
    { value: '1', text: '+' },
    { value: '-1', text: '-' },
  ], () => {})
  scalar(shipPanel, 'Max Deg', binds.controls.tilt, 'maxDeg', 0, 90, 1, () => {})
  scalar(shipPanel, 'Rise (ms)', binds.controls.tilt, 'riseMs', 10, 2000, 10, () => {})
  scalar(shipPanel, 'Fall (ms)', binds.controls.tilt, 'fallMs', 10, 2000, 10, () => {})

  group(followPanel, 'Follow Box')
  vec(followPanel, 'Position', binds.followBox, () => {})
  scalar(followPanel, 'Half Width X', binds.follow, 'halfX', 0.5, 60, 0.5, () => {})
  scalar(followPanel, 'Half Depth Z', binds.follow, 'halfZ', 0.5, 60, 0.5, () => {})
  subgroup(followPanel, 'Bounce')
  scalar(followPanel, 'Bounce Time (ms)', binds.follow.bounce, 'timeMs', 0, 1500, 10, () => {})
  subgroup(followPanel, 'Recenter')
  scalar(followPanel, 'Delay (ms)', binds.follow.recenter, 'delayMs', 100, 10000, 50, () => {})
  scalar(followPanel, 'Still (ms)', binds.follow.recenter, 'stillMs', 100, 10000, 50, () => {})
  scalar(followPanel, 'Accel', binds.follow.recenter, 'accel', 0, 60, 0.5, () => {})
  scalar(followPanel, 'Max Speed', binds.follow.recenter, 'maxSpeed', 0, 100, 0.5, () => {})
  subgroup(followPanel, 'Recenter Point')
  vec(followPanel, 'Position', binds.recenterPoint.position, () => {})
  scalar(followPanel, 'Width', binds.recenterPoint, 'width', 0, 20, 0.1, () => {})
  scalar(followPanel, 'Height', binds.recenterPoint, 'height', 0, 30, 0.1, () => {})

  const layerLabels = ['1 — background', '2 — solar', '3 — debris']
  for (let i = 0; i < binds.parallax.length; i++) {
    const layer = binds.parallax[i]
    subgroup(paraPanel, layerLabels[i] ?? `${i + 1}`)
    const apply = (): void => applyParallax()
    scalar(paraPanel, 'count', layer, 'count', 10, 2000, 10, apply)
    scalar(paraPanel, 'speed', layer, 'speed', -400, 400, 1, apply)
    scalar(paraPanel, 'speedJitter', layer, 'speedJitter', 0, 1, 0.01, apply)
    scalar(paraPanel, 'Parallax Gain', layer, 'parallaxGain', 0, 1, 0.01, apply)
    scalar(paraPanel, 'size', layer, 'size', 0.02, 3, 0.01, apply)
    scalar(paraPanel, 'alpha', layer, 'alpha', 0, 1, 0.01, apply)
    scalar(paraPanel, 'Grid Size', layer, 'gridSize', 4, 500, 1, apply)
    scalar(paraPanel, 'Grid Opacity', layer, 'gridOpacity', 0, 1, 0.01, apply)
    scalar(paraPanel, 'Star Depth Near', layer, 'zNearWrap', -300, 300, 0.5, apply)
    scalar(paraPanel, 'Star Depth Far', layer, 'zFar', -6000, 0, 5, apply)
    vec(paraPanel, 'Position', layer.position, apply)
    vec(paraPanel, 'Rotation (deg)', layer.rotation, apply)
  }

  const reset = container.querySelector<HTMLButtonElement>('#debug-reset')
  reset?.addEventListener('click', () => {
    const camPos = binds.camera.position
    const camRot = binds.camera.rotation
    const shipPos = binds.shipTransform.position
    const shipRot = binds.shipTransform.rotation
    Object.assign(binds.camera, defaults.camera)
    Object.assign(camPos, defaults.camera.position)
    Object.assign(camRot, defaults.camera.rotation)
    Object.assign(binds.shipTransform, defaults.ship)
    Object.assign(shipPos, defaults.ship.position)
    Object.assign(shipRot, defaults.ship.rotation)
    for (let i = 0; i < binds.parallax.length; i++) {
      const live = binds.parallax[i]
      const def = defaults.parallax[i]
      const layerPos = live.position
      const layerRot = live.rotation
      Object.assign(live, def)
      Object.assign(layerPos, def.position)
      Object.assign(layerRot, def.rotation)
    }
    for (const r of rows) r.refresh()
    for (const v of vecRows) v.input.value = String(v.target[v.key])
    Object.assign(binds.controls.motion, defaults.controls.motion)
    Object.assign(binds.controls.tilt, defaults.controls.tilt)
    Object.assign(binds.controls.camera, defaults.controls.camera)
    Object.assign(binds.controls.shipKeys, defaults.controls.shipKeys)
    for (const s of selects) {
      s.select.value = String(readAny(s.target, s.key))
    }
    Object.assign(binds.followBox, defaults.followBox)
    Object.assign(binds.follow, defaults.follow)
    Object.assign(binds.recenterPoint, defaults.recenterPoint)
    Object.assign(binds.recenterPoint.position, defaults.recenterPoint.position)
    for (const r of rows) r.refresh()
    for (const v of vecRows) v.input.value = String(v.target[v.key])
    applyCamera()
    applyShip()
    applyParallax()
  })

  return {
    updateReadout(ship: Vec3Like, camera: Vec3Like): void {
      if (posShip) posShip.textContent = `x ${ship.x.toFixed(2)}  y ${ship.y.toFixed(2)}  z ${ship.z.toFixed(2)}`
      if (posCamera) posCamera.textContent = `x ${camera.x.toFixed(2)}  y ${camera.y.toFixed(2)}  z ${camera.z.toFixed(2)}`
    },
    sync(): void {
      for (const r of rows) {
        if (document.activeElement === r.slider || document.activeElement === r.spin) continue
        r.refresh()
      }
      for (const v of vecRows) {
        if (document.activeElement === v.input) continue
        v.input.value = String(v.target[v.key])
      }
    },
    dispose(): void {
      const panel = container.querySelector('.debug-panel')
      panel?.remove()
    },
  }
}

function requirePanel(container: HTMLElement, tab: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`.debug-tabpanel[data-tab="${tab}"]`)
  if (!el) throw new Error(`#panel missing .debug-tabpanel[data-tab=${tab}]`)
  return el
}

function format(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}