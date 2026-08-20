/**
 * SDD-G08 Cam tab — live camera pose/lens + recenter-point gizmo (LimitBox rest line).
 */

import type { DebuggerBinds, DebuggerTab } from './debugger'

interface NumberHandle {
  readonly kind: 'number'
  readonly el: HTMLInputElement
  readonly valueEl: HTMLElement
  read(): number
}

interface BoolHandle {
  readonly kind: 'bool'
  readonly el: HTMLInputElement
  read(): boolean
}

type Handle = NumberHandle | BoolHandle

interface CamClone {
  fov: number
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  near: number
  far: number
  moveSpeed: number
  rotSpeed: number
  recenter: {
    position: { x: number; y: number; z: number }
    width: number
    height: number
    visible: boolean
  }
}

export class CamTab implements DebuggerTab {
  readonly id = 'cam' as const
  private readonly _binds: DebuggerBinds
  private readonly _handles: Handle[] = []
  private _defaults: CamClone | null = null
  private _form: HTMLFormElement | null = null

  constructor(binds: DebuggerBinds) {
    this._binds = binds
  }

  mount(panel: HTMLElement): void {
    const form = document.createElement('form')
    form.className = 'debug-form'
    form.autocomplete = 'off'
    form.addEventListener('submit', (event) => {
      event.preventDefault()
    })

    const cam = this._binds.camera
    const recenter = this._binds.recenterPoint

    this._group(form, 'Camera')
    this._scalar(form, 'FOV', 'camera.fov', 10, 170, 1, () => cam.fov(), (value) => {
      cam.setFov(value)
      cam.apply()
    })
    this._axis(form, 'camera.position', -200, 200, 0.1, () => cam.position(), (x, y, z) => {
      cam.setPosition(x, y, z)
      cam.apply()
    })
    this._axis(form, 'camera.rotation', -180, 180, 0.1, () => cam.rotation(), (x, y, z) => {
      cam.setRotation(x, y, z)
      cam.apply()
    })
    this._scalar(form, 'Near', 'camera.near', 0.01, 50, 0.01, () => cam.near(), (value) => {
      cam.setNear(value)
      cam.apply()
    })
    this._scalar(form, 'Far', 'camera.far', 50, 20000, 10, () => cam.far(), (value) => {
      cam.setFar(value)
      cam.apply()
    })

    this._group(form, 'Control')
    this._scalar(form, 'Move Speed', 'camera.moveSpeed', 0, 60, 0.5, () => cam.moveSpeed(), (value) => {
      cam.setMoveSpeed(value)
    })
    this._scalar(form, 'Rot Speed', 'camera.rotSpeed', 0, 180, 1, () => cam.rotSpeed(), (value) => {
      cam.setRotSpeed(value)
    })

    this._group(form, 'Recenter Point (gizmo)')
    this._flag(form, 'recenter.visible', 'visible', () => recenter.visible(), (value) => {
      recenter.setVisible(value)
    })
    this._axis(form, 'recenter.position', -60, 60, 0.1, () => recenter.position(), (x, y, z) => {
      recenter.setPosition(x, y, z)
    })
    this._scalar(form, 'Width', 'recenter.width', 0, 20, 0.1, () => recenter.width(), (value) => {
      recenter.setWidth(value)
    })
    this._scalar(form, 'Height', 'recenter.height', 0, 30, 0.1, () => recenter.height(), (value) => {
      recenter.setHeight(value)
    })

    panel.append(form)
    this._form = form
    this._defaults = cloneCam(this._binds)
    this.sync()
  }

  sync(): void {
    for (const handle of this._handles) {
      if (document.activeElement === handle.el) {
        continue
      }
      if (handle.kind === 'number') {
        const next = handle.read()
        handle.el.value = String(next)
        handle.valueEl.textContent = formatNum(next)
      } else {
        handle.el.checked = handle.read()
      }
    }
  }

  reset(): void {
    const defaults = this._defaults
    if (!defaults) {
      return
    }
    const cam = this._binds.camera
    const recenter = this._binds.recenterPoint
    cam.setFov(defaults.fov)
    cam.setPosition(defaults.position.x, defaults.position.y, defaults.position.z)
    cam.setRotation(defaults.rotation.x, defaults.rotation.y, defaults.rotation.z)
    cam.setNear(defaults.near)
    cam.setFar(defaults.far)
    cam.setMoveSpeed(defaults.moveSpeed)
    cam.setRotSpeed(defaults.rotSpeed)
    cam.apply()
    recenter.setPosition(
      defaults.recenter.position.x,
      defaults.recenter.position.y,
      defaults.recenter.position.z,
    )
    recenter.setWidth(defaults.recenter.width)
    recenter.setHeight(defaults.recenter.height)
    recenter.setVisible(defaults.recenter.visible)
    this.sync()
  }

  dispose(): void {
    this._handles.length = 0
    this._form?.remove()
    this._form = null
    this._defaults = null
  }

  private _group(host: HTMLElement, label: string): void {
    const el = document.createElement('div')
    el.className = 'debug-group'
    el.textContent = label
    host.append(el)
  }

  private _axis(
    host: HTMLElement,
    prefix: string,
    min: number,
    max: number,
    step: number,
    read: () => { x: number; y: number; z: number },
    write: (x: number, y: number, z: number) => void,
  ): void {
    for (const axis of ['x', 'y', 'z'] as const) {
      this._scalar(host, `${prefix}.${axis}`, `${prefix}.${axis}`, min, max, step, () => read()[axis], (value) => {
        const next = { ...read(), [axis]: value }
        write(next.x, next.y, next.z)
      })
    }
  }

  private _scalar(
    host: HTMLElement,
    label: string,
    path: string,
    min: number,
    max: number,
    step: number,
    read: () => number,
    write: (value: number) => void,
  ): void {
    const row = document.createElement('label')
    row.className = 'debug-row'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = label
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = String(min)
    slider.max = String(max)
    slider.step = String(step)
    slider.dataset.bind = path
    const spin = document.createElement('input')
    spin.type = 'number'
    spin.min = String(min)
    spin.max = String(max)
    spin.step = String(step)
    spin.dataset.bind = path
    const value = document.createElement('span')
    value.className = 'debug-value'
    const commit = (raw: string): void => {
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) {
        return
      }
      write(parsed)
      const next = read()
      slider.value = String(next)
      spin.value = String(next)
      value.textContent = formatNum(next)
    }
    slider.addEventListener('input', () => {
      commit(slider.value)
    })
    spin.addEventListener('input', () => {
      commit(spin.value)
    })
    row.append(name, slider, spin, value)
    host.append(row)
    this._handles.push(
      { kind: 'number', el: slider, valueEl: value, read },
      { kind: 'number', el: spin, valueEl: value, read },
    )
  }

  private _flag(
    host: HTMLElement,
    path: string,
    label: string,
    read: () => boolean,
    write: (value: boolean) => void,
  ): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-flag'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = label
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.dataset.bind = path
    input.addEventListener('input', () => {
      write(input.checked)
    })
    row.append(name, input)
    host.append(row)
    this._handles.push({ kind: 'bool', el: input, read })
  }
}

function cloneCam(binds: DebuggerBinds): CamClone {
  const pos = binds.camera.position()
  const rot = binds.camera.rotation()
  const rPos = binds.recenterPoint.position()
  return {
    fov: binds.camera.fov(),
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: rot.x, y: rot.y, z: rot.z },
    near: binds.camera.near(),
    far: binds.camera.far(),
    moveSpeed: binds.camera.moveSpeed(),
    rotSpeed: binds.camera.rotSpeed(),
    recenter: {
      position: { x: rPos.x, y: rPos.y, z: rPos.z },
      width: binds.recenterPoint.width(),
      height: binds.recenterPoint.height(),
      visible: binds.recenterPoint.visible(),
    },
  }
}

function formatNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3)
}
