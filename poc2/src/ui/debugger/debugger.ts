/**
 * SDD-G08 Debugger — host panel, tab strip, Reset, 15 Hz sync.
 */

import { BALANCE } from '../../core/balancer'

export type DebuggerTabId =
  | 'ship'
  | 'equips'
  | 'cam'
  | 'limit-box'
  | 'parallax'
  | 'weapons'
  | 'energy'
  | 'shots'
  | 'collision'

export interface DebuggerTab {
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

export interface DebuggerShipBind {
  snapshot(): {
    readonly position: { x: number; y: number; z: number }
    readonly rotation: { x: number; y: number; z: number }
    readonly stats: {
      agility: { current: number; max: number }
      deflection: { current: number; max: number }
      integrity: { current: number; max: number }
      shield: { current: number; max: number }
      precision: { current: number; max: number }
      energy: { current: number; max: number }
    }
    readonly status: {
      flickering: boolean
      dashing: boolean
      shooting: boolean
      recovering: boolean
    }
    readonly loadout: {
      equippedWeapon: string | null
      weapons: readonly string[]
      equippedBomb: string | null
      bombs: readonly string[]
      equippedWings: string | null
      wings: readonly string[]
      equippedShield: string | null
      shields: readonly string[]
      equippedArmor: string | null
      armors: readonly string[]
      equippedEnergyCollector: string | null
      energyCollectors: readonly string[]
      equippedEnergyConverter: string | null
      energyConverters: readonly string[]
    }
  }
  applyTransform(): void
  setFlickering(value: boolean): void
  setDashing(value: boolean): void
  setShooting(value: boolean): void
  equipWeapon(id: string | null): void
  equipBomb(id: string | null): void
}

export interface DebuggerWeaponsBind {
  level(): number
  setLevel(level: number): void
}

export interface DebuggerBinds {
  readonly ship: DebuggerShipBind
  readonly weapons: DebuggerWeaponsBind
}

export interface DebuggerOptions {
  readonly host: HTMLElement
  readonly binds: DebuggerBinds
  readonly tabs: readonly DebuggerTab[]
  readonly enabled?: boolean
}

export interface DebuggerPort {
  updateReadout(ship: { x: number; y: number; z: number }, camera: { x: number; y: number; z: number }): void
  update(dt: number): void
  sync(): void
  reset(): void
  dispose(): void
}

const TAB_LABELS: Record<DebuggerTabId, string> = {
  ship: 'Ship',
  equips: 'Equips',
  cam: 'Cam',
  'limit-box': 'LimitBox',
  parallax: 'Parallax',
  weapons: 'Weapons',
  energy: 'Energy',
  shots: 'Shots',
  collision: 'Collision',
}

export class Debugger implements DebuggerPort {
  private readonly _host: HTMLElement
  private readonly _binds: DebuggerBinds
  private readonly _tabs: readonly DebuggerTab[]
  private readonly _enabled: boolean
  private _root: HTMLElement | null = null
  private _shipReadout: HTMLElement | null = null
  private _camReadout: HTMLElement | null = null
  private _acc = 0
  private _disposed = false

  constructor(options: DebuggerOptions) {
    this._host = options.host
    this._binds = options.binds
    this._tabs = options.tabs
    this._enabled = options.enabled ?? import.meta.env.DEV
    if (this._enabled) {
      this._mount()
    }
  }

  updateReadout(
    ship: { x: number; y: number; z: number },
    camera: { x: number; y: number; z: number },
  ): void {
    if (!this._enabled || this._disposed) {
      return
    }
    if (this._shipReadout) {
      this._shipReadout.textContent = formatVec(ship)
    }
    if (this._camReadout) {
      this._camReadout.textContent = formatVec(camera)
    }
  }

  update(dt: number): void {
    if (!this._enabled || this._disposed) {
      return
    }
    this._acc += dt
    if (this._acc >= 1 / BALANCE.debug.syncHz) {
      this._acc = 0
      this.sync()
    }
  }

  sync(): void {
    if (!this._enabled || this._disposed) {
      return
    }
    const pose = this._binds.ship.snapshot().position
    this.updateReadout(pose, { x: 0, y: 0, z: 0 })
    for (const tab of this._tabs) {
      tab.sync()
    }
  }

  reset(): void {
    if (!this._enabled || this._disposed) {
      return
    }
    for (const tab of this._tabs) {
      tab.reset()
    }
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    for (const tab of this._tabs) {
      tab.dispose()
    }
    this._root?.remove()
    this._root = null
    this._shipReadout = null
    this._camReadout = null
  }

  private _mount(): void {
    const root = document.createElement('div')
    root.className = 'debug-panel'

    const tabsNav = document.createElement('nav')
    tabsNav.className = 'debug-tabs'
    const panels = document.createElement('div')
    panels.className = 'debug-tabpanels'

    this._tabs.forEach((tab, index) => {
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'debug-tab'
      radio.id = `dbg-${tab.id}`
      radio.className = 'debug-tab-input'
      radio.checked = index === 0
      root.append(radio)

      const label = document.createElement('label')
      label.htmlFor = radio.id
      label.textContent = TAB_LABELS[tab.id]
      if (index === 0) {
        label.classList.add('is-active')
      }
      tabsNav.append(label)

      const panel = document.createElement('section')
      panel.className = 'debug-tabpanel'
      panel.dataset.tab = tab.id
      if (index === 0) {
        panel.classList.add('is-active')
      }
      radio.addEventListener('change', () => {
        for (const child of panels.children) {
          child.classList.toggle('is-active', child === panel)
        }
        for (const item of tabsNav.children) {
          item.classList.toggle('is-active', item === label)
        }
      })
      tab.mount(panel)
      panels.append(panel)
    })

    const shipPos = document.createElement('div')
    shipPos.className = 'debug-pos'
    const shipLabel = document.createElement('span')
    shipLabel.className = 'debug-poslabel'
    shipLabel.textContent = 'Ship'
    const shipValue = document.createElement('span')
    shipValue.className = 'debug-posvalue'
    shipValue.id = 'pos-ship'
    shipPos.append(shipLabel, shipValue)

    const camPos = document.createElement('div')
    camPos.className = 'debug-pos'
    const camLabel = document.createElement('span')
    camLabel.className = 'debug-poslabel'
    camLabel.textContent = 'Camera'
    const camValue = document.createElement('span')
    camValue.className = 'debug-posvalue'
    camValue.id = 'pos-camera'
    camPos.append(camLabel, camValue)

    const bar = document.createElement('div')
    bar.className = 'debug-bar'
    const reset = document.createElement('button')
    reset.type = 'button'
    reset.id = 'debug-reset'
    reset.textContent = 'Reset'
    reset.addEventListener('click', () => {
      this.reset()
    })
    bar.append(reset)

    root.prepend(shipPos, camPos)
    root.append(tabsNav, panels, bar)
    this._host.append(root)
    this._root = root
    this._shipReadout = shipValue
    this._camReadout = camValue
    this.sync()
  }
}

function formatVec(v: { x: number; y: number; z: number }): string {
  return `x ${v.x.toFixed(2)}  y ${v.y.toFixed(2)}  z ${v.z.toFixed(2)}`
}
