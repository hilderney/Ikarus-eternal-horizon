/**
 * SDD-G08 Squad tab — macro AI tuning (groups, formations, staggered ticks)
 * plus a live readout of every EnemyGroup.
 */

import type { EditableSquadConfig } from '../../systems/squad-config'
import type { DebuggerBinds, DebuggerTab } from './debugger'

interface NumberHandle {
  readonly kind: 'number'
  readonly el: HTMLInputElement
  readonly valueEl: HTMLElement
  read(): number
}

interface TextHandle {
  readonly kind: 'text'
  readonly el: HTMLInputElement
  read(): string
}

type Handle = NumberHandle | TextHandle

type ConfigKey = keyof EditableSquadConfig

interface ScalarSpec {
  readonly key: ConfigKey
  readonly min: number
  readonly max: number
  readonly step: number
}

const FORMATION_SPECS: readonly ScalarSpec[] = [
  { key: 'circleRadius', min: 1, max: 30, step: 0.5 },
  { key: 'vSpacing', min: 1, max: 20, step: 0.5 },
  { key: 'vAngleDeg', min: 5, max: 85, step: 1 },
  { key: 'diamondW', min: 1, max: 30, step: 0.5 },
  { key: 'diamondH', min: 1, max: 30, step: 0.5 },
  { key: 'slotLerpRate', min: 0.5, max: 20, step: 0.5 },
]

const GROUP_SPECS: readonly ScalarSpec[] = [
  { key: 'groupMaxSpeed', min: 0.5, max: 20, step: 0.1 },
  { key: 'groupMaxForce', min: 0.5, max: 40, step: 0.5 },
  { key: 'groupArriveRadius', min: 1, max: 40, step: 0.5 },
  { key: 'groupTurnLambda', min: 0.2, max: 10, step: 0.1 },
  { key: 'groupSeparationRadius', min: 1, max: 80, step: 1 },
  { key: 'groupSeparationWeight', min: 0, max: 40, step: 0.5 },
  { key: 'joinRadius', min: 5, max: 200, step: 1 },
]

const OBJECTIVE_SPECS: readonly ScalarSpec[] = [
  { key: 'targetHoldMinMs', min: 200, max: 15000, step: 100 },
  { key: 'targetHoldMaxMs', min: 200, max: 20000, step: 100 },
  { key: 'casualtyPct', min: 0, max: 1, step: 0.05 },
  { key: 'patrolZMin', min: -160, max: 0, step: 1 },
  { key: 'patrolZMax', min: -160, max: 30, step: 1 },
  { key: 'interceptStandoffZ', min: 0, max: 40, step: 0.5 },
]

const TRAFFIC_SPECS: readonly ScalarSpec[] = [
  { key: 'shipSeparationRadius', min: 0.5, max: 20, step: 0.1 },
  { key: 'shipSeparationWeight', min: 0, max: 40, step: 0.5 },
  { key: 'rogueAvoidRadius', min: 0.5, max: 30, step: 0.5 },
  { key: 'rogueAvoidWeight', min: 0, max: 40, step: 0.5 },
  { key: 'curvatureScale', min: 0, max: 3, step: 0.05 },
]

const ARENA_SPECS: readonly ScalarSpec[] = [
  { key: 'arenaHalfX', min: 5, max: 240, step: 1 },
  { key: 'containmentInsetX', min: 1, max: 60, step: 1 },
  { key: 'containmentExp', min: 0.5, max: 8, step: 0.1 },
  { key: 'containmentWeight', min: 0, max: 60, step: 1 },
]

const BUDGET_SPECS: readonly ScalarSpec[] = [
  { key: 'tickHz', min: 1, max: 30, step: 1 },
  { key: 'shipsPerTick', min: 1, max: 48, step: 1 },
]

export class SquadTab implements DebuggerTab {
  readonly id = 'squad' as const
  private readonly _binds: DebuggerBinds
  private readonly _handles: Handle[] = []
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

    const squad = this._binds.squad

    this._group(form, 'Live squads')
    this._readOnly(form, 'groups', () => `${squad.activeGroups()} / ${squad.groupCount()}`)
    this._readOnly(form, 'ships', () => `${squad.trackedShips()} (${squad.rogueShips()} rogue)`)
    for (let i = 0; i < squad.groupCount(); i += 1) {
      this._readOnly(form, `group ${i}`, () => {
        const snap = squad.groups()[i]
        if (!snap || !snap.active) {
          return 'idle'
        }
        return `${snap.members} · ${snap.objective} · ${snap.formation} · ${Math.round(snap.healthPct)}%`
      })
    }

    this._group(form, 'Limits')
    this._readOnly(form, 'maxGroups', () => String(squad.config().maxGroups))
    this._readOnly(form, 'maxPerGroup', () => String(squad.config().maxPerGroup))

    this._group(form, 'Performance budget')
    this._scalars(form, BUDGET_SPECS)

    this._group(form, 'Formation geometry')
    this._scalars(form, FORMATION_SPECS)

    this._group(form, 'Group motion')
    this._scalars(form, GROUP_SPECS)

    this._group(form, 'Objectives')
    this._scalars(form, OBJECTIVE_SPECS)

    this._group(form, 'Traffic control')
    this._scalars(form, TRAFFIC_SPECS)

    this._group(form, 'Arena containment')
    this._scalars(form, ARENA_SPECS)

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
      } else {
        handle.el.value = handle.read()
      }
    }
  }

  reset(): void {
    this._binds.squad.resetConfig()
    this.sync()
  }

  dispose(): void {
    this._handles.length = 0
    this._form?.remove()
    this._form = null
  }

  private _group(host: HTMLElement, label: string): void {
    const el = document.createElement('div')
    el.className = 'debug-group'
    el.textContent = label
    host.append(el)
  }

  private _scalars(host: HTMLElement, specs: readonly ScalarSpec[]): void {
    for (const spec of specs) {
      this._scalar(host, spec)
    }
  }

  private _scalar(host: HTMLElement, spec: ScalarSpec): void {
    const path = `squad.${String(spec.key)}`
    const read = (): number => this._binds.squad.config()[spec.key]
    const row = document.createElement('label')
    row.className = 'debug-row'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = String(spec.key)
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = String(spec.min)
    slider.max = String(spec.max)
    slider.step = String(spec.step)
    slider.dataset.bind = path
    const spin = document.createElement('input')
    spin.type = 'number'
    spin.min = String(spec.min)
    spin.max = String(spec.max)
    spin.step = String(spec.step)
    spin.dataset.bind = path
    const value = document.createElement('span')
    value.className = 'debug-value'
    const commit = (raw: string): void => {
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) {
        return
      }
      this._binds.squad.config()[spec.key] = parsed
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

  private _readOnly(host: HTMLElement, label: string, read: () => string): void {
    const row = document.createElement('label')
    row.className = 'debug-row debug-textrow'
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = label
    const input = document.createElement('input')
    input.type = 'text'
    input.readOnly = true
    input.dataset.bind = `squad.${label}`
    row.append(name, input)
    host.append(row)
    this._handles.push({ kind: 'text', el: input, read })
  }
}

function formatNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}
