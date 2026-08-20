/**
 * SDD-G08 Parallax tab — live layer params (camera-anchored star fields).
 */

import type { ParallaxLayerConfig } from '../../gameobjects/parallax/parallax-layer'
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

interface LayerClone {
  config: ParallaxLayerConfig
  visible: boolean
}

export class ParallaxTab implements DebuggerTab {
  readonly id = 'parallax' as const
  private readonly _binds: DebuggerBinds
  private readonly _handles: Handle[] = []
  private _defaults: LayerClone[] | null = null
  private _form: HTMLFormElement | null = null
  private _layerIndex = 0

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

    const parallax = this._binds.parallax
    this._defaults = Array.from({ length: parallax.layerCount() }, (_, index) => {
      const config = parallax.config(index)
      if (!config) {
        throw new Error(`missing parallax layer ${index}`)
      }
      return { config: cloneConfig(config), visible: parallax.visible(index) }
    })

    this._group(form, 'Layer (camera-anchored)')
    this._selectLayer(form)

    this._group(form, 'Visible')
    this._flag(form, 'parallax.visible', () => parallax.visible(this._layerIndex), (value) => {
      parallax.setVisible(this._layerIndex, value)
    })

    this._group(form, 'Motion')
    this._scalar(form, 'speed', 'speed', 0, 20, 0.01, () => this._cfg().speed, (value) => {
      this._patch({ speed: value })
    })
    this._scalar(form, 'speedJitter', 'speedJitter', 0, 2, 0.01, () => this._cfg().speedJitter, (value) => {
      this._patch({ speedJitter: value })
    })
    this._scalar(
      form,
      'parallaxGain',
      'parallaxGain',
      0,
      2,
      0.001,
      () => this._cfg().parallaxGain,
      (value) => {
        this._patch({ parallaxGain: value })
      },
    )

    this._group(form, 'Points')
    this._scalar(form, 'count', 'count', 1, 2000, 1, () => this._cfg().count, (value) => {
      this._patch({ count: Math.round(value) })
    })
    this._scalar(form, 'size', 'size', 0.1, 10, 0.1, () => this._cfg().size, (value) => {
      this._patch({ size: value })
    })
    this._scalar(form, 'alpha', 'alpha', 0, 1, 0.01, () => this._cfg().alpha, (value) => {
      this._patch({ alpha: value })
    })
    this._color(form, 'color', () => this._cfg().color, (hex) => {
      this._patch({ color: hex })
    })

    this._group(form, 'Offset from camera')
    this._axis(form, 'position', -2000, 2000, 1, () => this._cfg().position, (x, y, z) => {
      this._patch({ position: { x, y, z } })
    })

    this._group(form, 'Rotation (deg)')
    this._axis(form, 'rotation', -180, 180, 1, () => this._cfg().rotation, (x, y, z) => {
      this._patch({ rotation: { x, y, z } })
    })

    this._group(form, 'Grid / wrap')
    this._scalar(form, 'gridSize', 'gridSize', 10, 5000, 10, () => this._cfg().gridSize, (value) => {
      this._patch({ gridSize: value })
    })
    this._scalar(form, 'gridOpacity', 'gridOpacity', 0, 1, 0.01, () => this._cfg().gridOpacity, (value) => {
      this._patch({ gridOpacity: value })
    })
    this._color(form, 'gridColor', () => this._cfg().gridColor, (hex) => {
      this._patch({ gridColor: hex })
    })
    this._scalar(form, 'zNearWrap', 'zNearWrap', -500, 500, 1, () => this._cfg().zNearWrap, (value) => {
      this._patch({ zNearWrap: value })
    })
    this._scalar(form, 'zFar', 'zFar', -10000, 0, 10, () => this._cfg().zFar, (value) => {
      this._patch({ zFar: value })
    })

    this._group(form, 'Name (read-only)')
    this._readOnly(form, 'name', () => this._cfg().name)

    panel.append(form)
    this._form = form
    this.sync()
  }

  sync(): void {
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
    const parallax = this._binds.parallax
    if (!defaults) {
      return
    }
    defaults.forEach((entry, index) => {
      parallax.applyConfig(index, cloneConfig(entry.config))
      parallax.setVisible(index, entry.visible)
    })
    this.sync()
  }

  dispose(): void {
    this._handles.length = 0
    this._form?.remove()
    this._form = null
    this._defaults = null
  }

  private _cfg(): ParallaxLayerConfig {
    const config = this._binds.parallax.config(this._layerIndex)
    if (!config) {
      throw new Error(`missing parallax layer ${this._layerIndex}`)
    }
    return config
  }

  private _patch(partial: Partial<ParallaxLayerConfig>): void {
    const next = { ...this._cfg(), ...partial }
    if (partial.position) {
      next.position = { ...partial.position }
    }
    if (partial.rotation) {
      next.rotation = { ...partial.rotation }
    }
    this._binds.parallax.applyConfig(this._layerIndex, next)
  }

  private _group(host: HTMLElement, label: string): void {
    const el = document.createElement('div')
    el.className = 'debug-group'
    el.textContent = label
    host.append(el)
  }

  private _selectLayer(host: HTMLElement): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-textrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = 'layer'
    const select = document.createElement('select')
    select.dataset.bind = 'parallax.layer'
    const names = this._binds.parallax.layerNames()
    names.forEach((layerName, index) => {
      const option = document.createElement('option')
      option.value = String(index)
      option.textContent = `${index}: ${layerName}`
      select.append(option)
    })
    select.value = String(this._layerIndex)
    select.addEventListener('change', () => {
      this._layerIndex = Number(select.value) || 0
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

  private _readOnly(host: HTMLElement, path: string, read: () => string): void {
    const row = document.createElement('label')
    row.className = 'debug-row'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = path
    const value = document.createElement('span')
    value.className = 'debug-value'
    value.dataset.bind = path
    row.append(name, value)
    host.append(row)
    this._handles.push({ kind: 'readonly', el: value, read })
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

  private _color(
    host: HTMLElement,
    path: string,
    read: () => number,
    write: (hex: number) => void,
  ): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-textrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = path
    const input = document.createElement('input')
    input.type = 'text'
    input.dataset.bind = path
    input.placeholder = '0xa5e8ff'
    input.addEventListener('change', () => {
      const parsed = Number(input.value)
      if (Number.isFinite(parsed)) {
        write(parsed >>> 0)
      }
    })
    row.append(name, input)
    host.append(row)
    this._handles.push({
      kind: 'text',
      el: input,
      read: () => `0x${read().toString(16).padStart(6, '0')}`,
    })
  }
}

function cloneConfig(config: ParallaxLayerConfig): ParallaxLayerConfig {
  return {
    ...config,
    position: { ...config.position },
    rotation: { ...config.rotation },
  }
}

function formatNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3)
}
