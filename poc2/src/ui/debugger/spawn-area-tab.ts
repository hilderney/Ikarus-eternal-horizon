/**
 * SDD-G08 SpawnArea tab — left / right / front spawn volumes + EnemyGate.
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

interface TextHandle {
  readonly kind: 'text'
  readonly el: HTMLInputElement
  read(): string
}

interface ReadonlyHandle {
  readonly kind: 'readonly'
  readonly el: HTMLElement
  read(): string
}

type Handle = NumberHandle | BoolHandle | TextHandle | ReadonlyHandle

interface SpawnClone {
  offset: { x: number; y: number; z: number }
  size: { x: number; y: number; z: number }
  intervalSec: number
  lanesX: string
  maxActive: number
  visible: boolean
  color: number
  opacity: number
}

const GATE_SIDE_NAME = 'gate'

export class SpawnAreaTab implements DebuggerTab {
  readonly id = 'spawn-area' as const
  private readonly _binds: DebuggerBinds
  private readonly _handles: Handle[] = []
  private _defaults: SpawnClone[] | null = null
  private _form: HTMLFormElement | null = null
  private _cadenceHost: HTMLElement | null = null
  private _sideIndex = 0

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

    const spawn = this._binds.spawnArea
    this._defaults = spawn.sideNames().map((_, side) => cloneSpawn(spawn, side))

    this._group(form, 'Side (ship-relative)')
    this._selectSide(form)

    this._group(form, 'Visible')
    this._flag(form, 'spawn.visible', () => spawn.visible(this._sideIndex), (value) => {
      spawn.setVisible(this._sideIndex, value)
    })

    this._group(form, 'Offset (relative to ship)')
    this._axis(form, 'offset', -240, 240, 1, () => spawn.offset(this._sideIndex), (x, y, z) => {
      spawn.setOffset(this._sideIndex, x, y, z)
    })

    this._group(form, 'Size (full extents)')
    this._axis(form, 'size', 0.1, 80, 0.1, () => spawn.size(this._sideIndex), (x, y, z) => {
      spawn.setSize(this._sideIndex, x, y, z)
    })

    this._group(form, 'World centre (read-only)')
    this._readOnlyVec(form, 'world', () => spawn.worldCenter(this._sideIndex))

    const cadence = document.createElement('div')
    cadence.className = 'debug-cadence'
    this._group(cadence, 'Spawn cadence (E05)')
    this._scalar(cadence, 'intervalSec', 'intervalSec', 0.05, 10, 0.05, () => spawn.intervalSec(this._sideIndex), (value) => {
      spawn.setIntervalSec(this._sideIndex, value)
    })
    this._scalar(cadence, 'maxActive', 'maxActive', 1, 32, 1, () => spawn.maxActive(this._sideIndex), (value) => {
      spawn.setMaxActive(this._sideIndex, value)
    })
    this._lanes(cadence)
    form.append(cadence)
    this._cadenceHost = cadence

    this._group(form, 'Visual')
    this._scalar(form, 'opacity', 'opacity', 0, 1, 0.01, () => spawn.opacity(this._sideIndex), (value) => {
      spawn.setOpacity(this._sideIndex, value)
    })
    this._color(form)

    panel.append(form)
    this._form = form
    this._syncCadenceVisibility()
    this.sync()
  }

  sync(): void {
    this._syncCadenceVisibility()
    for (const handle of this._handles) {
      if (handle.kind !== 'readonly' && document.activeElement === handle.el) {
        continue
      }
      if (handle.kind === 'number') {
        const next = handle.read()
        handle.el.value = String(next)
        handle.valueEl.textContent = formatNum(next)
      } else if (handle.kind === 'bool') {
        handle.el.checked = handle.read()
      } else if (handle.kind === 'readonly') {
        handle.el.textContent = handle.read()
      } else {
        handle.el.value = handle.read()
      }
    }
  }

  reset(): void {
    const defaults = this._defaults
    const spawn = this._binds.spawnArea
    if (!defaults) {
      return
    }
    defaults.forEach((entry, side) => {
      spawn.setOffset(side, entry.offset.x, entry.offset.y, entry.offset.z)
      spawn.setSize(side, entry.size.x, entry.size.y, entry.size.z)
      spawn.setIntervalSec(side, entry.intervalSec)
      spawn.setLanesX(side, parseLanes(entry.lanesX))
      spawn.setMaxActive(side, entry.maxActive)
      spawn.setVisible(side, entry.visible)
      spawn.setColor(side, entry.color)
      spawn.setOpacity(side, entry.opacity)
    })
    this.sync()
  }

  dispose(): void {
    this._handles.length = 0
    this._form?.remove()
    this._form = null
    this._cadenceHost = null
    this._defaults = null
  }

  private _isGateSide(): boolean {
    return this._binds.spawnArea.sideNames()[this._sideIndex] === GATE_SIDE_NAME
  }

  private _syncCadenceVisibility(): void {
    if (this._cadenceHost) {
      this._cadenceHost.hidden = this._isGateSide()
    }
  }

  private _group(host: HTMLElement, label: string): void {
    const el = document.createElement('div')
    el.className = 'debug-group'
    el.textContent = label
    host.append(el)
  }

  private _selectSide(host: HTMLElement): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-textrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = 'side'
    const select = document.createElement('select')
    select.dataset.bind = 'spawn.side'
    this._binds.spawnArea.sideNames().forEach((sideName, index) => {
      const option = document.createElement('option')
      option.value = String(index)
      option.textContent = sideName
      select.append(option)
    })
    select.value = String(this._sideIndex)
    select.addEventListener('change', () => {
      this._sideIndex = Number(select.value) || 0
      this.sync()
    })
    row.append(name, select)
    host.append(row)
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

  private _readOnlyVec(host: HTMLElement, prefix: string, read: () => { x: number; y: number; z: number }): void {
    for (const axis of ['x', 'y', 'z'] as const) {
      const row = document.createElement('label')
      row.className = 'debug-row'
      const name = document.createElement('span')
      name.className = 'debug-label'
      name.textContent = `${prefix}.${axis}`
      const value = document.createElement('span')
      value.className = 'debug-value'
      value.dataset.bind = `${prefix}.${axis}`
      row.append(name, value)
      host.append(row)
      this._handles.push({
        kind: 'readonly',
        el: value,
        read: () => formatNum(read()[axis]),
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

  private _flag(host: HTMLElement, path: string, read: () => boolean, write: (value: boolean) => void): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-flag'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = 'visible'
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

  private _lanes(host: HTMLElement): void {
    const spawn = this._binds.spawnArea
    const row = document.createElement('label')
    row.className = 'debug-row debug-textrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = 'lanesX'
    const input = document.createElement('input')
    input.type = 'text'
    input.dataset.bind = 'lanesX'
    input.placeholder = '-4, -2, 0, 2, 4'
    input.addEventListener('input', () => {
      spawn.setLanesX(this._sideIndex, parseLanes(input.value))
    })
    row.append(name, input)
    host.append(row)
    this._handles.push({
      kind: 'text',
      el: input,
      read: () => spawn.lanesX(this._sideIndex).join(', '),
    })
  }

  private _color(host: HTMLElement): void {
    const spawn = this._binds.spawnArea
    const row = document.createElement('label')
    row.className = 'debug-row debug-textrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = 'color'
    const input = document.createElement('input')
    input.type = 'text'
    input.dataset.bind = 'color'
    input.placeholder = '0xff2222'
    input.addEventListener('change', () => {
      const parsed = Number(input.value)
      if (Number.isFinite(parsed)) {
        spawn.setColor(this._sideIndex, parsed >>> 0)
      }
    })
    row.append(name, input)
    host.append(row)
    this._handles.push({
      kind: 'text',
      el: input,
      read: () => `0x${spawn.color(this._sideIndex).toString(16).padStart(6, '0')}`,
    })
  }
}

function cloneSpawn(spawn: DebuggerBinds['spawnArea'], side: number): SpawnClone {
  return {
    offset: { ...spawn.offset(side) },
    size: { ...spawn.size(side) },
    intervalSec: spawn.intervalSec(side),
    lanesX: spawn.lanesX(side).join(', '),
    maxActive: spawn.maxActive(side),
    visible: spawn.visible(side),
    color: spawn.color(side),
    opacity: spawn.opacity(side),
  }
}

function parseLanes(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
}

function formatNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}
