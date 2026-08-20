/**
 * SDD-G08 Equips tab — ship loadout + equipped weapon level, bound to the live sim.
 */

import { DASH_LEVELS } from '../../gameobjects/controller/dash-levels'
import { LASER_LEVELS } from '../../gameobjects/weapon/laser-levels'
import type { DebuggerBinds, DebuggerTab } from './debugger'

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
}

interface TextHandle {
  readonly kind: 'text'
  readonly el: HTMLInputElement | HTMLSelectElement
  read(): string
}

type Handle = NumberHandle | TextHandle

interface EquipsClone {
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
  weaponLevel: number
  dashLevel: number
}

const WEAPON_IDS = ['laser', 'plasma', 'beam', 'mjolnir'] as const
const BOMB_IDS = ['pulseNova', 'swarmTorpedo', 'starKiller'] as const
const WING_IDS = ['standard', 'agility', 'armored'] as const
const FIT_IDS = ['light', 'standard', 'heavy'] as const
const COLLECTOR_IDS = ['passive', 'wide'] as const
const CONVERTER_IDS = ['scrap', 'crystal'] as const

export class EquipsTab implements DebuggerTab {
  readonly id = 'equips' as const
  private readonly _binds: DebuggerBinds
  private readonly _handles: Handle[] = []
  private _defaults: EquipsClone | null = null
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

    this._group(form, 'Equipped weapon')
    this._equipped(form, 'equippedWeapon', 'loadout.equippedWeapon', [...WEAPON_IDS], (id) => {
      this._binds.ship.equipWeapon(id)
    })
    this._scalar(
      form,
      'weapon level',
      'weapons.level',
      1,
      LASER_LEVELS.length,
      1,
      () => this._binds.weapons.level(),
      (value) => {
        this._binds.weapons.setLevel(value)
      },
    )
    this._list(form, 'weapons', 'loadout.weapons')

    this._group(form, 'Dash')
    this._scalar(
      form,
      'dash level',
      'dash.level',
      1,
      DASH_LEVELS.length,
      1,
      () => this._binds.dash.level(),
      (value) => {
        this._binds.dash.setLevel(value)
      },
    )

    this._group(form, 'Bombs')
    this._equipped(form, 'equippedBomb', 'loadout.equippedBomb', [...BOMB_IDS], (id) => {
      this._binds.ship.equipBomb(id)
    })
    this._list(form, 'bombs', 'loadout.bombs')

    this._group(form, 'Modules')
    this._equipped(form, 'equippedWings', 'loadout.equippedWings', [...WING_IDS], (id) => {
      this._binds.ship.equipWings(id)
    })
    this._list(form, 'wings', 'loadout.wings')
    this._equipped(form, 'equippedShield', 'loadout.equippedShield', [...FIT_IDS], (id) => {
      this._binds.ship.equipShield(id)
    })
    this._list(form, 'shields', 'loadout.shields')
    this._equipped(form, 'equippedArmor', 'loadout.equippedArmor', [...FIT_IDS], (id) => {
      this._binds.ship.equipArmor(id)
    })
    this._list(form, 'armors', 'loadout.armors')
    this._equipped(form, 'equippedEnergyCollector', 'loadout.equippedEnergyCollector', [
      ...COLLECTOR_IDS,
    ], (id) => {
      this._binds.ship.equipEnergyCollector(id)
    })
    this._list(form, 'energyCollectors', 'loadout.energyCollectors')
    this._equipped(form, 'equippedEnergyConverter', 'loadout.equippedEnergyConverter', [
      ...CONVERTER_IDS,
    ], (id) => {
      this._binds.ship.equipEnergyConverter(id)
    })
    this._list(form, 'energyConverters', 'loadout.energyConverters')

    panel.append(form)
    this._form = form
    this._defaults = cloneEquips(this._binds)
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
        handle.el.value = handle.read()
      }
    }
  }

  reset(): void {
    const defaults = this._defaults
    if (!defaults) {
      return
    }
    const live = this._binds.ship.snapshot().loadout
    this._binds.ship.equipWeapon(defaults.equippedWeapon)
    this._binds.ship.equipBomb(defaults.equippedBomb)
    this._binds.ship.equipWings(defaults.equippedWings)
    this._binds.ship.equipShield(defaults.equippedShield)
    this._binds.ship.equipArmor(defaults.equippedArmor)
    this._binds.ship.equipEnergyCollector(defaults.equippedEnergyCollector)
    this._binds.ship.equipEnergyConverter(defaults.equippedEnergyConverter)
    this._binds.weapons.setLevel(defaults.weaponLevel)
    this._binds.dash.setLevel(defaults.dashLevel)
    replaceList(live, 'weapons', defaults.weapons)
    replaceList(live, 'bombs', defaults.bombs)
    replaceList(live, 'wings', defaults.wings)
    replaceList(live, 'shields', defaults.shields)
    replaceList(live, 'armors', defaults.armors)
    replaceList(live, 'energyCollectors', defaults.energyCollectors)
    replaceList(live, 'energyConverters', defaults.energyConverters)
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
    })
  }
}

function cloneEquips(binds: DebuggerBinds): EquipsClone {
  const port = binds.ship.snapshot()
  return {
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
    weaponLevel: binds.weapons.level(),
    dashLevel: binds.dash.level(),
  }
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
