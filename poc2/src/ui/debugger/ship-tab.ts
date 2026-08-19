/**
 * SDD-G08 Ship tab — HTML form bound to C01 ShipDebugPort.
 */

import { BALANCE } from '../../core/balancer'
import type { DebuggerBinds, DebuggerTab } from './debugger'

type PoolName = 'agility' | 'deflection' | 'integrity' | 'shield' | 'precision' | 'energy'
type PoseKey = 'position' | 'rotation'
type ListKey =
  | 'weapons'
  | 'bombs'
  | 'wings'
  | 'shields'
  | 'armors'
  | 'energyCollectors'
  | 'energyConverters'
type EquippedKey =
  | 'equippedWeapon'
  | 'equippedBomb'
  | 'equippedWings'
  | 'equippedShield'
  | 'equippedArmor'
  | 'equippedEnergyCollector'
  | 'equippedEnergyConverter'

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

interface TextHandle {
  readonly kind: 'text'
  readonly el: HTMLInputElement | HTMLSelectElement
  read(): string
  write(value: string): void
}

type Handle = NumberHandle | BoolHandle | TextHandle

interface SheetClone {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  stats: Record<PoolName, { current: number; max: number }>
  status: { flickering: boolean; dashing: boolean }
  loadout: {
    equippedWeapon: string | null
    weapons: string[]
    equippedBomb: string | null
    bombs: string[]
    equippedWings: string | null
    wings: string[]
    equippedShield: string | null
    shields: string[]
    equippedArmor: string | null
    armors: string[]
    equippedEnergyCollector: string | null
    energyCollectors: string[]
    equippedEnergyConverter: string | null
    energyConverters: string[]
  }
}

const POOLS: readonly PoolName[] = [
  'agility',
  'deflection',
  'integrity',
  'shield',
  'precision',
  'energy',
]

const WEAPON_IDS = ['laser', 'plasma', 'beam', 'mjolnir'] as const
const BOMB_IDS = ['pulseNova', 'swarmTorpedo', 'starKiller'] as const
const WING_IDS = ['standard', 'agility', 'armored'] as const
const FIT_IDS = ['light', 'standard', 'heavy'] as const
const COLLECTOR_IDS = ['passive', 'wide'] as const
const CONVERTER_IDS = ['scrap', 'crystal'] as const

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
    this._flag(form, 'dashing', 'status.dashing', (value) => {
      this._binds.ship.setDashing(value)
    })
    this._flag(form, 'status_recovering', 'status.recovering', (value) => {
      if (value) {
        this._binds.ship.setShooting(false)
        this._binds.ship.setFlickering(false)
        return
      }
      this._binds.ship.setShooting(true)
    })

    this._group(form, 'Loadout')
    this._equipped(form, 'equippedWeapon', 'loadout.equippedWeapon', [...WEAPON_IDS], (id) => {
      this._binds.ship.equipWeapon(id)
    })
    this._list(form, 'weapons', 'loadout.weapons')
    this._equipped(form, 'equippedBomb', 'loadout.equippedBomb', [...BOMB_IDS], (id) => {
      this._binds.ship.equipBomb(id)
    })
    this._list(form, 'bombs', 'loadout.bombs')
    this._equipped(form, 'equippedWings', 'loadout.equippedWings', [...WING_IDS])
    this._list(form, 'wings', 'loadout.wings')
    this._equipped(form, 'equippedShield', 'loadout.equippedShield', [...FIT_IDS])
    this._list(form, 'shields', 'loadout.shields')
    this._equipped(form, 'equippedArmor', 'loadout.equippedArmor', [...FIT_IDS])
    this._list(form, 'armors', 'loadout.armors')
    this._equipped(form, 'equippedEnergyCollector', 'loadout.equippedEnergyCollector', [
      ...COLLECTOR_IDS,
    ])
    this._list(form, 'energyCollectors', 'loadout.energyCollectors')
    this._equipped(form, 'equippedEnergyConverter', 'loadout.equippedEnergyConverter', [
      ...CONVERTER_IDS,
    ])
    this._list(form, 'energyConverters', 'loadout.energyConverters')

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
      } else if (handle.kind === 'bool') {
        handle.el.checked = handle.read()
      } else {
        handle.el.value = handle.read()
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
    this._binds.ship.setShooting(false)
    this._binds.ship.equipWeapon(defaults.loadout.equippedWeapon)
    this._binds.ship.equipBomb(defaults.loadout.equippedBomb)
    writeLoadoutField(live.loadout, 'equippedWings', defaults.loadout.equippedWings)
    writeLoadoutField(live.loadout, 'equippedShield', defaults.loadout.equippedShield)
    writeLoadoutField(live.loadout, 'equippedArmor', defaults.loadout.equippedArmor)
    writeLoadoutField(live.loadout, 'equippedEnergyCollector', defaults.loadout.equippedEnergyCollector)
    writeLoadoutField(live.loadout, 'equippedEnergyConverter', defaults.loadout.equippedEnergyConverter)
    replaceList(live.loadout, 'weapons', defaults.loadout.weapons)
    replaceList(live.loadout, 'bombs', defaults.loadout.bombs)
    replaceList(live.loadout, 'wings', defaults.loadout.wings)
    replaceList(live.loadout, 'shields', defaults.loadout.shields)
    replaceList(live.loadout, 'armors', defaults.loadout.armors)
    replaceList(live.loadout, 'energyCollectors', defaults.loadout.energyCollectors)
    replaceList(live.loadout, 'energyConverters', defaults.loadout.energyConverters)
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
        return status.recovering
      },
      write,
    })
  }

  private _equipped(
    host: HTMLElement,
    label: string,
    path: string,
    options: readonly string[],
    onEquip?: (id: string | null) => void,
  ): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-selectrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = label
    const select = document.createElement('select')
    select.dataset.bind = path
    const empty = document.createElement('option')
    empty.value = ''
    empty.textContent = '(none)'
    select.append(empty)
    for (const id of options) {
      const opt = document.createElement('option')
      opt.value = id
      opt.textContent = id
      select.append(opt)
    }
    const key = path.replace('loadout.', '') as EquippedKey
    select.addEventListener('input', () => {
      const id = select.value === '' ? null : select.value
      if (onEquip) {
        onEquip(id)
        return
      }
      writeLoadoutField(this._binds.ship.snapshot().loadout, key, id)
    })
    row.append(name, select)
    host.append(row)
    this._handles.push({
      kind: 'text',
      el: select,
      read: () => this._binds.ship.snapshot().loadout[key] ?? '',
      write: (value) => {
        const id = value === '' ? null : value
        if (onEquip) {
          onEquip(id)
          return
        }
        writeLoadoutField(this._binds.ship.snapshot().loadout, key, id)
      },
    })
  }

  private _list(host: HTMLElement, label: string, path: string): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-textrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = label
    const input = document.createElement('input')
    input.type = 'text'
    input.dataset.bind = path
    input.placeholder = 'id, id'
    const key = path.replace('loadout.', '') as ListKey
    input.addEventListener('input', () => {
      replaceList(this._binds.ship.snapshot().loadout, key, parseList(input.value))
    })
    row.append(name, input)
    host.append(row)
    this._handles.push({
      kind: 'text',
      el: input,
      read: () => this._binds.ship.snapshot().loadout[key].join(', '),
      write: (value) => {
        replaceList(this._binds.ship.snapshot().loadout, key, parseList(value))
      },
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
    status: { flickering: port.status.flickering, dashing: port.status.dashing },
    loadout: {
      equippedWeapon: port.loadout.equippedWeapon,
      weapons: [...port.loadout.weapons],
      equippedBomb: port.loadout.equippedBomb,
      bombs: [...port.loadout.bombs],
      equippedWings: port.loadout.equippedWings,
      wings: [...port.loadout.wings],
      equippedShield: port.loadout.equippedShield,
      shields: [...port.loadout.shields],
      equippedArmor: port.loadout.equippedArmor,
      armors: [...port.loadout.armors],
      equippedEnergyCollector: port.loadout.equippedEnergyCollector,
      energyCollectors: [...port.loadout.energyCollectors],
      equippedEnergyConverter: port.loadout.equippedEnergyConverter,
      energyConverters: [...port.loadout.energyConverters],
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

function parseList(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function replaceList(
  loadout: { [key: string]: unknown },
  key: ListKey,
  values: readonly string[],
): void {
  const current = loadout[key]
  if (Array.isArray(current) && !Object.isFrozen(current)) {
    current.length = 0
    current.push(...values)
    return
  }
  loadout[key] = [...values]
}

function writeLoadoutField(
  loadout: { [key: string]: unknown },
  key: EquippedKey,
  value: string | null,
): void {
  loadout[key] = value
}
