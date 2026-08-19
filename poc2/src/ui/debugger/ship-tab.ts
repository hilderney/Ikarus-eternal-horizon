/**
 * SDD-G08 Ship tab — HTML form bound to C01 ShipDebugPort.
 */

import { BALANCE } from '../../core/balancer'
import type { DebuggerBinds, DebuggerTab } from './debugger'

type PoolName = 'agility' | 'deflection' | 'integrity' | 'shield' | 'precision' | 'energy'
type PoseKey = 'position' | 'rotation'

interface NumberHandle {
  readonly kind: 'number'
  readonly el: HTMLInputElement
  readonly valueEl: HTMLElement
  read(): number
  write(value: number): void
}

interface BoolHandle {
  readonly kind: 'bool'
  readonly el: HTMLInputElement
  read(): boolean
  write(value: boolean): void
}

type Handle = NumberHandle | BoolHandle

interface SheetClone {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  stats: Record<PoolName, { current: number; max: number }>
  status: { flickering: boolean; dashing: boolean; shooting: boolean }
}

const POOLS: readonly PoolName[] = [
  'agility',
  'deflection',
  'integrity',
  'shield',
  'precision',
  'energy',
]

export class ShipTab implements DebuggerTab {
  readonly id = 'ship' as const
  private readonly _binds: DebuggerBinds
  private readonly _handles: Handle[] = []
  private _defaults: SheetClone | null = null
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

    this._group(form, 'Pose')
    this._pose(form, 'position', -32, 32, 0.01)
    this._pose(form, 'rotation', -180, 180, 0.1)

    this._group(form, 'Byte pools (0–255)')
    for (const name of POOLS) {
      this._pool(form, name)
    }

    this._group(form, 'Status')
    this._flag(form, 'status_flickering', 'status.flickering', (value) => {
      this._binds.ship.setFlickering(value)
    })
    this._flag(form, 'status_dashing', 'status.dashing', (value) => {
      this._binds.ship.setDashing(value)
    })
    this._flag(form, 'status_shooting', 'status.shooting', (value) => {
      this._binds.ship.setShooting(value)
    })
    this._flag(form, 'status_recovering', 'status.recovering', (value) => {
      if (value) {
        this._binds.ship.setShooting(false)
        this._binds.ship.setDashing(false)
        this._binds.ship.setFlickering(false)
        return
      }
      this._binds.ship.setShooting(true)
    })

    panel.append(form)
    this._form = form
    this._defaults = cloneSheet(this._binds.ship.snapshot())
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
    const live = this._binds.ship.snapshot()
    copyVec(live.position, defaults.position)
    copyVec(live.rotation, defaults.rotation)
    for (const name of POOLS) {
      live.stats[name].current = defaults.stats[name].current
      live.stats[name].max = defaults.stats[name].max
    }
    this._binds.ship.applyTransform()
    this._binds.ship.setDashing(defaults.status.dashing)
    this._binds.ship.setFlickering(defaults.status.flickering)
    this._binds.ship.setShooting(defaults.status.shooting)
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

  private _pose(host: HTMLElement, key: PoseKey, min: number, max: number, step: number): void {
    for (const axis of ['x', 'y', 'z'] as const) {
      const path = `${key}.${axis}`
      this._scalar(
        host,
        `${key} ${axis}`,
        path,
        min,
        max,
        step,
        () => this._binds.ship.snapshot()[key][axis],
        (value) => {
          this._binds.ship.snapshot()[key][axis] = value
          this._binds.ship.applyTransform()
        },
      )
    }
  }

  private _pool(host: HTMLElement, name: PoolName): void {
    const cap = BALANCE.ship.stats.byteCap
    this._scalar(
      host,
      `${name} cur`,
      `stats.${name}.current`,
      0,
      cap,
      1,
      () => this._binds.ship.snapshot().stats[name].current,
      (value) => {
        this._binds.ship.snapshot().stats[name].current = clampByte(value, cap)
      },
    )
    this._scalar(
      host,
      `${name} max`,
      `stats.${name}.max`,
      0,
      cap,
      1,
      () => this._binds.ship.snapshot().stats[name].max,
      (value) => {
        this._binds.ship.snapshot().stats[name].max = clampByte(value, cap)
      },
    )
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
      { kind: 'number', el: slider, valueEl: value, read, write },
      { kind: 'number', el: spin, valueEl: value, read, write },
    )
  }

  private _flag(
    host: HTMLElement,
    label: string,
    path: string,
    write: (value: boolean) => void,
  ): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-checkrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = label
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.dataset.bind = path
    box.addEventListener('input', () => {
      write(box.checked)
    })
    row.append(name, box)
    host.append(row)
    this._handles.push({
      kind: 'bool',
      el: box,
      read: () => {
        const status = this._binds.ship.snapshot().status
        if (path === 'status.flickering') {
          return status.flickering
        }
        if (path === 'status.dashing') {
          return status.dashing
        }
        if (path === 'status.shooting') {
          return status.shooting
        }
        return status.recovering
      },
      write,
    })
  }
}

function cloneSheet(port: ReturnType<DebuggerBinds['ship']['snapshot']>): SheetClone {
  return {
    position: { ...port.position },
    rotation: { ...port.rotation },
    stats: {
      agility: { ...port.stats.agility },
      deflection: { ...port.stats.deflection },
      integrity: { ...port.stats.integrity },
      shield: { ...port.stats.shield },
      precision: { ...port.stats.precision },
      energy: { ...port.stats.energy },
    },
    status: {
      flickering: port.status.flickering,
      dashing: port.status.dashing,
      shooting: port.status.shooting,
    },
  }
}

function copyVec(
  target: { x: number; y: number; z: number },
  src: { x: number; y: number; z: number },
): void {
  target.x = src.x
  target.y = src.y
  target.z = src.z
}

function clampByte(value: number, cap: number): number {
  const rounded = Math.round(value)
  if (rounded < 0) {
    return 0
  }
  if (rounded > cap) {
    return cap
  }
  return rounded
}

function formatNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}
