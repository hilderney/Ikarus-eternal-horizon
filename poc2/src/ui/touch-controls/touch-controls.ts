/**
 * SDD-G12 TouchControls — on-screen combat overlay (static nipple + HTML buttons).
 * Writes a TouchSource that A02 merges. G03 constructs / disposes. HTML overlay only (R9).
 */

import { create as createNipple } from 'nipplejs'
import { BALANCE } from '../../core/balancer'
import type { InputAction } from '../../core/input'

export type TouchAction = InputAction

/** Written by this class; read by SDD-A02 each update(dt). */
export interface TouchSource {
  readonly axisX: number
  readonly axisZ: number
  isPressed(action: TouchAction): boolean
}

export interface MutableTouchSource extends TouchSource {
  setAxis(x: number, z: number): void
  setPressed(action: TouchAction, down: boolean): void
}

export interface NippleMove {
  readonly vector: { readonly x: number; readonly y: number }
  readonly force: number
}

export interface NippleHandle {
  on(event: 'move', fn: (evt: unknown, data: NippleMove) => void): void
  on(event: 'end', fn: () => void): void
  destroy(): void
}

export interface NippleFactory {
  (zone: HTMLElement): NippleHandle
}

export interface TouchControlsOptions {
  readonly host: HTMLElement
  readonly source: MutableTouchSource
  /** Defaults to nipplejs.create({ mode: 'static', ...BALANCE.controls.touch }). */
  readonly nipple?: NippleFactory
  readonly enabled: 'auto' | boolean
  readonly stickSize: number
  readonly stickColor: string
}

const ACTIONS: readonly { readonly action: TouchAction; readonly label: string }[] = [
  { action: 'fire', label: 'Fire' },
  { action: 'bomb', label: 'Bomb' },
  { action: 'switchWeapon', label: 'Wpn' },
  { action: 'switchBomb', label: 'Bomb×' },
  { action: 'dash', label: 'Dash' },
  { action: 'pause', label: 'Pause' },
]

const FIRE_BIT = 1
const BOMB_BIT = 2
const SWITCH_WEAPON_BIT = 4
const SWITCH_BOMB_BIT = 8
const DASH_BIT = 16
const PAUSE_BIT = 32

const BUTTON_MIN_PX = 44
const OVERLAY_OPACITY = 0.55
const INDIGO = '#818cf8'

function actionBit(action: TouchAction): number {
  switch (action) {
    case 'fire':
      return FIRE_BIT
    case 'bomb':
      return BOMB_BIT
    case 'switchWeapon':
      return SWITCH_WEAPON_BIT
    case 'switchBomb':
      return SWITCH_BOMB_BIT
    case 'dash':
      return DASH_BIT
    case 'pause':
      return PAUSE_BIT
  }
}

function prefersTouchOverlay(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  const coarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  return coarse || 'ontouchstart' in window
}

function defaultNippleFactory(size: number, color: string): NippleFactory {
  return (zone) => {
    const collection = createNipple({
      zone,
      mode: 'static',
      restJoystick: true,
      position: { left: '50%', top: '50%' },
      size,
      color,
    })
    return {
      on(event, fn) {
        if (event === 'move') {
          collection.on('move', (evt) => {
            const moveFn = fn as (evt: unknown, data: NippleMove) => void
            moveFn(evt, { vector: evt.data.vector, force: evt.data.force })
          })
        } else {
          collection.on('end', () => {
            ;(fn as () => void)()
          })
        }
      },
      destroy() {
        collection.destroy()
      },
    }
  }
}

/** Mutable pad for A02. Function helper — not a second public class. */
export function createTouchPad(): MutableTouchSource {
  let axisX = 0
  let axisZ = 0
  let bits = 0
  return {
    get axisX() {
      return axisX
    },
    get axisZ() {
      return axisZ
    },
    isPressed(action: TouchAction): boolean {
      return (bits & actionBit(action)) !== 0
    },
    setAxis(x: number, z: number): void {
      axisX = x
      axisZ = z
    },
    setPressed(action: TouchAction, down: boolean): void {
      const bit = actionBit(action)
      if (down) {
        bits |= bit
      } else {
        bits &= ~bit
      }
    },
  }
}

export class TouchControls {
  private readonly _source: MutableTouchSource
  private readonly _enabled: 'auto' | boolean
  private readonly _root: HTMLElement
  private readonly _zone: HTMLElement
  private readonly _nipple: NippleHandle
  private _visible = false
  private _disposed = false

  constructor(options: TouchControlsOptions) {
    this._source = options.source
    this._enabled = options.enabled

    this._root = document.createElement('div')
    this._root.dataset.touchControls = 'overlay'
    this._root.style.cssText = [
      'position:absolute',
      'inset:0',
      'pointer-events:none',
      'z-index:4',
    ].join(';')

    const inset = 'max(12px, env(safe-area-inset-left, 0px))'
    const bottomInset = 'max(12px, env(safe-area-inset-bottom, 0px))'
    const zoneSize = Math.max(options.stickSize, BUTTON_MIN_PX)

    this._zone = document.createElement('div')
    this._zone.dataset.zone = 'stick'
    this._zone.style.cssText = [
      'position:absolute',
      'left:0',
      `bottom:0`,
      `width:${zoneSize}px`,
      `height:${zoneSize}px`,
      `margin:0 0 ${bottomInset} ${inset}`,
      'pointer-events:auto',
      'touch-action:none',
    ].join(';')

    const cluster = document.createElement('div')
    cluster.style.cssText = [
      'position:absolute',
      'right:0',
      'bottom:0',
      'display:grid',
      'grid-template-columns:repeat(2, minmax(44px, auto))',
      'gap:8px',
      `margin:0 max(12px, env(safe-area-inset-right, 0px)) ${bottomInset} 0`,
      'pointer-events:none',
    ].join(';')

    for (const entry of ACTIONS) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.dataset.action = entry.action
      btn.textContent = entry.label
      const color = entry.action === 'fire' ? options.stickColor : INDIGO
      btn.style.cssText = [
        `min-width:${BUTTON_MIN_PX}px`,
        `min-height:${BUTTON_MIN_PX}px`,
        'pointer-events:auto',
        'touch-action:none',
        'border:0',
        'border-radius:10px',
        `background:${color}`,
        `opacity:${OVERLAY_OPACITY}`,
        'color:#0b1220',
        'font:600 12px/1 system-ui,sans-serif',
        'user-select:none',
      ].join(';')
      const down = (event: Event): void => {
        event.preventDefault()
        if (!this._visible) {
          return
        }
        this._source.setPressed(entry.action, true)
      }
      const up = (event: Event): void => {
        event.preventDefault()
        this._source.setPressed(entry.action, false)
      }
      btn.addEventListener('pointerdown', down)
      btn.addEventListener('pointerup', up)
      btn.addEventListener('pointercancel', up)
      cluster.append(btn)
    }

    this._root.append(this._zone, cluster)
    options.host.append(this._root)

    const factory = options.nipple ?? defaultNippleFactory(options.stickSize, options.stickColor)
    this._nipple = factory(this._zone)
    this._nipple.on('move', (evt, data) => {
      void evt
      this._onNippleMove(data)
    })
    this._nipple.on('end', () => {
      if (this._visible) {
        this._source.setAxis(0, 0)
      }
    })

    this.syncVisibility()
  }

  get visible(): boolean {
    return this._visible
  }

  setVisible(visible: boolean): void {
    this._visible = visible
    this._root.style.display = visible ? 'block' : 'none'
    if (!visible) {
      this._releaseAll()
    }
  }

  syncVisibility(): void {
    if (this._enabled === true) {
      this.setVisible(true)
      return
    }
    if (this._enabled === false) {
      this.setVisible(false)
      return
    }
    this.setVisible(prefersTouchOverlay())
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this._releaseAll()
    this._nipple.destroy()
    this._root.remove()
  }

  private _onNippleMove(data: NippleMove): void {
    if (!this._visible) {
      return
    }
    const x = data.vector.x
    const y = data.vector.y
    if (Math.hypot(x, y) < BALANCE.controls.touch.deadzone) {
      this._source.setAxis(0, 0)
      return
    }
    this._source.setAxis(x, -y)
  }

  private _releaseAll(): void {
    this._source.setAxis(0, 0)
    for (const entry of ACTIONS) {
      this._source.setPressed(entry.action, false)
    }
  }
}
