/**
 * SDD-G08 Enemy tab — archetype sheet (Warrior) editable live. No ship pose.
 */

import { warriorMaxSpeed, type EditableWarriorSheet } from '../../gameobjects/enemy/warrior'
import { ENEMY_STATUS_CATALOG } from '../../systems/enemy-strategy'
import type { DebuggerBinds, DebuggerTab } from './debugger'

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

interface BoolHandle {
  readonly kind: 'bool'
  readonly el: HTMLInputElement
  read(): boolean
}

type Handle = NumberHandle | TextHandle | BoolHandle

type SheetNumberKey =
  | 'hp'
  | 'radius'
  | 'contactDamage'
  | 'agility'
  | 'intelligence'
  | 'reachSpeedMul'

type WeaponNumberKey =
  | 'rate'
  | 'damage'
  | 'speed'
  | 'lifetime'
  | 'range'
  | 'radius'
  | 'muzzleZ'
  | 'decayPerUnit'
  | 'fireConeDeg'

export class EnemyTab implements DebuggerTab {
  readonly id = 'enemy' as const
  private readonly _binds: DebuggerBinds
  private readonly _handles: Handle[] = []
  private _defaults: EditableWarriorSheet | null = null
  private _form: HTMLFormElement | null = null
  private _archetypeIndex = 0

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

    const enemy = this._binds.enemy
    this._defaults = cloneSheet(enemy.sheet())

    this._group(form, 'Archetype')
    this._selectArchetype(form)

    this._group(form, 'Identity')
    this._text(form, 'name', () => enemy.sheet().name, (value) => {
      enemy.sheet().name = value
      enemy.applyToActive()
    })
    this._color(form, 'color', () => enemy.sheet().color, (hex) => {
      enemy.sheet().color = hex
      enemy.applyToActive()
    })

    this._group(form, 'Combat sheet')
    this._sheetScalar(form, 'hp', 'hp', 1, 50, 1)
    this._sheetScalar(form, 'radius', 'radius', 0.1, 3, 0.05)
    this._sheetScalar(form, 'contactDamage', 'contactDamage', 0, 40, 1)
    this._sheetScalar(form, 'agility', 'agility', 0, 100, 1)
    this._readOnly(
      form,
      'maxSpeed',
      () => `agility/10 = ${formatNum(warriorMaxSpeed(enemy.sheet().agility))}`,
    )
    this._sheetScalar(form, 'intelligence', 'intelligence', 0, 100, 1)
    this._sheetScalar(form, 'reachSpeedMul', 'reachSpeedMul', 1, 8, 0.1)

    this._group(form, 'Fixed weapon')
    this._weaponScalar(form, 'rate', 'weapon.rate', 0.1, 8, 0.05)
    this._weaponScalar(form, 'damage', 'weapon.damage', 0, 40, 1)
    this._weaponScalar(form, 'speed', 'weapon.speed', 1, 40, 0.5)
    this._weaponScalar(form, 'lifetime', 'weapon.lifetime', 0.2, 6, 0.05)
    this._weaponScalar(form, 'range', 'weapon.range', 1, 80, 0.5)
    this._weaponScalar(form, 'radius', 'weapon.radius', 0.05, 1, 0.01)
    this._weaponScalar(form, 'muzzleZ', 'weapon.muzzleZ', 0, 2, 0.05)
    this._weaponScalar(form, 'decayPerUnit', 'weapon.decayPerUnit', 0, 1, 0.01)
    this._weaponScalar(form, 'fireConeDeg', 'weapon.fireConeDeg', 5, 90, 1)
    this._color(form, 'weapon.color', () => enemy.sheet().weapon.color, (hex) => {
      enemy.sheet().weapon.color = hex
      enemy.applyToActive()
    })

    this._group(form, 'Status (CDs / range)')
    this._scalar(
      form,
      'hittedCdMs',
      'status.hittedCdMs',
      50,
      2000,
      10,
      () => enemy.sheet().status.hittedCdMs,
      (value) => {
        enemy.sheet().status.hittedCdMs = value
        enemy.applyToActive()
      },
    )
    this._scalar(
      form,
      'hittingCdMs',
      'status.hittingCdMs',
      50,
      2000,
      10,
      () => enemy.sheet().status.hittingCdMs,
      (value) => {
        enemy.sheet().status.hittingCdMs = value
        enemy.applyToActive()
      },
    )
    this._scalar(
      form,
      'inRangeRadius',
      'status.inRangeRadius',
      1,
      80,
      0.5,
      () => enemy.sheet().status.inRangeRadius,
      (value) => {
        enemy.sheet().status.inRangeRadius = value
        enemy.applyToActive()
      },
    )
    this._flag(form, 'status.rangeVisible', 'rangeVisible', () => enemy.sheet().status.rangeVisible, (value) => {
      enemy.sheet().status.rangeVisible = value
      enemy.applyToActive()
    })
    this._scalar(
      form,
      'rangeOpacity',
      'status.rangeOpacity',
      0,
      1,
      0.01,
      () => enemy.sheet().status.rangeOpacity,
      (value) => {
        enemy.sheet().status.rangeOpacity = value
        enemy.applyToActive()
      },
    )
    this._color(form, 'status.rangeColor', () => enemy.sheet().status.rangeColor, (hex) => {
      enemy.sheet().status.rangeColor = hex
      enemy.applyToActive()
    })

    this._group(form, 'Live statuses (first active)')
    this._readOnly(form, 'catalog', () => ENEMY_STATUS_CATALOG.join(' | '))
    this._readOnly(form, 'chaseStrategy', () => {
      const snap = enemy.liveStatus()
      return snap?.chaseStrategy ?? '—'
    })
    for (const id of ENEMY_STATUS_CATALOG) {
      this._readOnly(form, id, () => {
        const snap = enemy.liveStatus()
        if (!snap) {
          return '—'
        }
        const on =
          id === 'hitted'
            ? snap.hitted
            : id === 'hitting'
              ? snap.hitting
              : id === 'in_range'
                ? snap.in_range
                : id === 'passed_opponent'
                  ? snap.passed_opponent
                  : snap.fixed_movement_strategy
        return on ? 'ON' : 'off'
      })
    }

    this._group(form, 'Strategy weights %')
    this._weight(form, 'straight')
    this._weight(form, 'engage')
    this._weight(form, 'flee')
    this._weight(form, 'loop_around')
    this._scalar(
      form,
      'swapBaseMs',
      'strategy.swapBaseMs',
      500,
      10000,
      50,
      () => enemy.sheet().strategy.swapBaseMs,
      (value) => {
        enemy.sheet().strategy.swapBaseMs = value
        enemy.applyToActive()
      },
    )
    this._scalar(
      form,
      'turnRateDeg',
      'strategy.turnRateDeg',
      15,
      360,
      5,
      () => enemy.sheet().strategy.turnRateDeg,
      (value) => {
        enemy.sheet().strategy.turnRateDeg = value
        enemy.applyToActive()
      },
    )
    this._readOnly(form, 'holdMs', () => {
      const sheet = enemy.sheet()
      return String(Math.max(250, sheet.strategy.swapBaseMs - sheet.intelligence))
    })
    this._scalar(
      form,
      'loop.radius',
      'strategy.loopAround.radius',
      2,
      40,
      0.5,
      () => enemy.sheet().strategy.loopAround.radius,
      (value) => {
        enemy.sheet().strategy.loopAround.radius = value
        enemy.applyToActive()
      },
    )
    this._scalar(
      form,
      'loop.speedMul',
      'strategy.loopAround.speedMul',
      1,
      3,
      0.05,
      () => enemy.sheet().strategy.loopAround.speedMul,
      (value) => {
        enemy.sheet().strategy.loopAround.speedMul = value
        enemy.applyToActive()
      },
    )
    this._scalar(
      form,
      'loop.retreatZ',
      'strategy.loopAround.retreatZ',
      0,
      30,
      0.5,
      () => enemy.sheet().strategy.loopAround.retreatZ,
      (value) => {
        enemy.sheet().strategy.loopAround.retreatZ = value
        enemy.applyToActive()
      },
    )

    this._group(form, 'Status mods (additive %)')
    this._modGroup(form, 'hitted')
    this._modGroup(form, 'hitting')
    this._modGroup(form, 'in_range')
    this._modGroup(form, 'passed_opponent')

    this._group(form, 'Live')
    const row = document.createElement('div')
    row.className = 'debug-row'
    const hint = document.createElement('span')
    hint.className = 'debug-value'
    hint.textContent = 'Edits apply to active Warriors + new spawns. Ship pose untouched.'
    row.append(hint)
    form.append(row)

    panel.append(form)
    this._form = form
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
    if (!this._defaults) {
      return
    }
    this._binds.enemy.resetSheet(this._defaults)
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

  private _selectArchetype(host: HTMLElement): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-textrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = 'type'
    const select = document.createElement('select')
    select.dataset.bind = 'enemy.type'
    this._binds.enemy.archetypeNames().forEach((label, index) => {
      const option = document.createElement('option')
      option.value = String(index)
      option.textContent = label
      select.append(option)
    })
    select.value = String(this._archetypeIndex)
    select.addEventListener('change', () => {
      this._archetypeIndex = Number(select.value) || 0
      this._binds.enemy.setArchetype(this._archetypeIndex)
      this.sync()
    })
    row.append(name, select)
    host.append(row)
  }

  private _sheetScalar(
    host: HTMLElement,
    key: SheetNumberKey,
    path: string,
    min: number,
    max: number,
    step: number,
  ): void {
    this._scalar(
      host,
      key,
      path,
      min,
      max,
      step,
      () => this._binds.enemy.sheet()[key],
      (value) => {
        this._binds.enemy.sheet()[key] = value
        if (key === 'agility') {
          this._binds.enemy.sheet().maxSpeed = warriorMaxSpeed(value)
        }
        this._binds.enemy.applyToActive()
      },
    )
  }

  private _readOnly(host: HTMLElement, path: string, read: () => string): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-textrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = path
    const input = document.createElement('input')
    input.type = 'text'
    input.readOnly = true
    input.dataset.bind = path
    row.append(name, input)
    host.append(row)
    this._handles.push({ kind: 'text', el: input, read })
  }

  private _weaponScalar(
    host: HTMLElement,
    key: WeaponNumberKey,
    path: string,
    min: number,
    max: number,
    step: number,
  ): void {
    this._scalar(
      host,
      key,
      path,
      min,
      max,
      step,
      () => this._binds.enemy.sheet().weapon[key],
      (value) => {
        this._binds.enemy.sheet().weapon[key] = value
        this._binds.enemy.applyToActive()
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
      { kind: 'number', el: slider, valueEl: value, read },
      { kind: 'number', el: spin, valueEl: value, read },
    )
  }

  private _text(
    host: HTMLElement,
    path: string,
    read: () => string,
    write: (value: string) => void,
  ): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-textrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = path
    const input = document.createElement('input')
    input.type = 'text'
    input.dataset.bind = path
    input.addEventListener('change', () => {
      write(input.value)
    })
    row.append(name, input)
    host.append(row)
    this._handles.push({ kind: 'text', el: input, read })
  }

  private _weight(host: HTMLElement, key: 'straight' | 'engage' | 'flee' | 'loop_around'): void {
    this._scalar(
      host,
      key,
      `strategy.weights.${key}`,
      0,
      100,
      1,
      () => this._binds.enemy.sheet().strategy.weights[key],
      (value) => {
        this._binds.enemy.sheet().strategy.weights[key] = value
        this._binds.enemy.applyToActive()
      },
    )
  }

  private _modGroup(
    host: HTMLElement,
    status: 'hitted' | 'hitting' | 'in_range' | 'passed_opponent',
  ): void {
    const keys = ['straight', 'engage', 'flee', 'loop_around'] as const
    for (const key of keys) {
      this._scalar(
        host,
        `${status}.${key}`,
        `strategy.mods.${status}.${key}`,
        -100,
        100,
        1,
        () => this._binds.enemy.sheet().strategy.mods[status][key] ?? 0,
        (value) => {
          this._binds.enemy.sheet().strategy.mods[status][key] = value
          this._binds.enemy.applyToActive()
        },
      )
    }
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
    input.placeholder = '0xf43f5e'
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

function cloneSheet(src: EditableWarriorSheet): EditableWarriorSheet {
  return {
    ...src,
    targets: [...src.targets],
    maxSpeed: warriorMaxSpeed(src.agility),
    weapon: { ...src.weapon },
    status: { ...src.status },
    strategy: {
      swapBaseMs: src.strategy.swapBaseMs,
      turnRateDeg: src.strategy.turnRateDeg,
      weights: { ...src.strategy.weights },
      mods: {
        hitted: { ...src.strategy.mods.hitted },
        hitting: { ...src.strategy.mods.hitting },
        in_range: { ...src.strategy.mods.in_range },
        passed_opponent: { ...src.strategy.mods.passed_opponent },
      },
      loopAround: { ...src.strategy.loopAround },
    },
  }
}

function formatNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}
