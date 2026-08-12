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
  follow: { halfX: number; halfZ: number }
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
}

export function createDebugControls(binds: DebugBinds, container: HTMLElement): DebugControlsHandle {
  const rows: Row[] = []
  const selects: SelRow[] = []

  const panel = document.createElement('div')
  panel.className = 'debug-panel'
  container.appendChild(panel)

  const defaults = {
    camera: JSON.parse(JSON.stringify(binds.camera)) as CameraConfig,
    ship: JSON.parse(JSON.stringify(binds.shipTransform)) as ShipTransform,
    parallax: JSON.parse(JSON.stringify(binds.parallax)) as ParallaxLayerConfig[],
    followBox: JSON.parse(JSON.stringify(binds.followBox)),
    follow: JSON.parse(JSON.stringify(binds.follow)),
    controls: JSON.parse(JSON.stringify(binds.controls)),
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

  function selectRow(
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
    panel.appendChild(row)
    selects.push({ target, key, select })
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
  subgroup('Control')
  scalar('Move Speed', binds.controls.camera, 'moveSpeed', 0, 60, 0.5, () => {})
  scalar('Rot Speed', binds.controls.camera, 'rotSpeed', 0, 180, 1, () => {})

  group('Ship')
  vec('Position', binds.shipTransform.position, applyShip)
  vec('Rotation (deg)', binds.shipTransform.rotation, applyShip)
  scalar('Scale', binds.shipTransform, 'scale', 0.2, 6, 0.05, applyShip)
  subgroup('Motion')
  scalar('Max Speed', binds.controls.motion, 'maxSpeed', 0, 60, 0.5, () => {})
  scalar('Accel (force)', binds.controls.motion, 'accel', 0, 120, 0.5, () => {})
  scalar('Decel (force)', binds.controls.motion, 'decel', 0, 120, 0.5, () => {})
  scalar('Brake (force)', binds.controls.motion, 'brake', 0, 180, 0.5, () => {})
  subgroup('Tilt')
  selectRow('Axis', binds.controls.tilt, 'axis', [
    { value: 'y', text: 'Y' },
    { value: 'z', text: 'Z' },
  ], () => {})
  selectRow('Sign', binds.controls.tilt, 'sign', [
    { value: '1', text: '+' },
    { value: '-1', text: '-' },
  ], () => {})
  scalar('Max Deg', binds.controls.tilt, 'maxDeg', 0, 90, 1, () => {})
  scalar('Rise (ms)', binds.controls.tilt, 'riseMs', 10, 2000, 10, () => {})
  scalar('Fall (ms)', binds.controls.tilt, 'fallMs', 10, 2000, 10, () => {})

  group('Follow Box')
  vec('Position', binds.followBox, () => {})
  scalar('Half Width X', binds.follow, 'halfX', 0.5, 60, 0.5, () => {})
  scalar('Half Depth Z', binds.follow, 'halfZ', 0.5, 60, 0.5, () => {})

  group('Parallax')
  const layerLabels = ['1 — background', '2 — solar', '3 — debris']
  for (let i = 0; i < binds.parallax.length; i++) {
    const layer = binds.parallax[i]
    subgroup(layerLabels[i] ?? `${i + 1}`)
    const apply = (): void => applyParallax()
    scalar('count', layer, 'count', 10, 2000, 10, apply)
    scalar('speed', layer, 'speed', -400, 400, 1, apply)
    scalar('speedJitter', layer, 'speedJitter', 0, 1, 0.01, apply)
    scalar('Parallax Gain', layer, 'parallaxGain', 0, 1, 0.01, apply)
    scalar('size', layer, 'size', 0.02, 3, 0.01, apply)
    scalar('alpha', layer, 'alpha', 0, 1, 0.01, apply)
    scalar('Grid Size', layer, 'gridSize', 4, 500, 1, apply)
    scalar('Grid Opacity', layer, 'gridOpacity', 0, 1, 0.01, apply)
    scalar('Star Depth Near', layer, 'zNearWrap', -300, 300, 0.5, apply)
    scalar('Star Depth Far', layer, 'zFar', -6000, 0, 5, apply)
    vec('Position', layer.position, apply)
    vec('Rotation (deg)', layer.rotation, apply)
  }

  const bar = document.createElement('div')
  bar.className = 'debug-bar'
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.textContent = 'Reset'
  reset.addEventListener('click', () => {
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
    for (const r of rows) {
      const v = read(r.target, r.key)
      r.slider.value = String(v)
      r.spin.value = String(v)
      r.value.textContent = format(v)
    }
    Object.assign(binds.controls.motion, defaults.controls.motion)
    Object.assign(binds.controls.tilt, defaults.controls.tilt)
    Object.assign(binds.controls.camera, defaults.controls.camera)
    Object.assign(binds.controls.shipKeys, defaults.controls.shipKeys)
    for (const s of selects) {
      s.select.value = String(readAny(s.target, s.key))
    }
    Object.assign(binds.followBox, defaults.followBox)
    Object.assign(binds.follow, defaults.follow)
    applyCamera()
    applyShip()
    applyParallax()
  })
  bar.appendChild(reset)
  panel.appendChild(bar)

  return {
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