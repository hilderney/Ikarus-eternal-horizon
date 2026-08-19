/**
 * SDD-G11 Pause overlay — freeze the run and pick the exclusive control scheme.
 */

import type { ControlScheme, InputPort } from '../core/input'

export interface PauseLoopPort {
  setPaused(paused: boolean): void
}

export interface PauseSceneOptions {
  readonly host: HTMLElement
  readonly loop: PauseLoopPort
  readonly input: Pick<InputPort, 'scheme' | 'setScheme' | 'update' | 'consumePress'>
  readonly onSchemeChange?: (scheme: ControlScheme) => void
}

const SCHEMES: readonly { readonly id: ControlScheme; readonly label: string }[] = [
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'mix', label: 'Mix (keyboard + mouse)' },
  { id: 'gamepad', label: 'Gamepad' },
  { id: 'touch', label: 'Touch' },
]

export class PauseScene {
  readonly kind = 'pause' as const

  private readonly _host: HTMLElement
  private readonly _loop: PauseLoopPort
  private readonly _input: PauseSceneOptions['input']
  private readonly _onSchemeChange: ((scheme: ControlScheme) => void) | undefined
  private _root: HTMLElement | null = null
  private _open = false

  constructor(options: PauseSceneOptions) {
    this._host = options.host
    this._loop = options.loop
    this._input = options.input
    this._onSchemeChange = options.onSchemeChange
  }

  get open(): boolean {
    return this._open
  }

  mount(): void {
    if (this._open) {
      return
    }
    this._open = true
    this._loop.setPaused(true)
    const root = document.createElement('div')
    root.className = 'pause-overlay'
    root.tabIndex = -1

    const panel = document.createElement('div')
    panel.className = 'pause-panel'
    const title = document.createElement('h1')
    title.className = 'pause-title'
    title.textContent = 'PAUSED'
    panel.append(title)

    const fieldset = document.createElement('fieldset')
    fieldset.className = 'pause-schemes'
    const legend = document.createElement('legend')
    legend.textContent = 'Controls'
    fieldset.append(legend)
    const current = this._input.scheme
    for (const entry of SCHEMES) {
      const row = document.createElement('label')
      row.className = 'pause-scheme'
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'control-scheme'
      radio.value = entry.id
      radio.checked = entry.id === current
      radio.addEventListener('change', () => {
        if (!radio.checked) {
          return
        }
        this._input.setScheme(entry.id)
        this._onSchemeChange?.(entry.id)
      })
      row.append(radio, document.createTextNode(` ${entry.label}`))
      fieldset.append(row)
    }
    panel.append(fieldset)

    const resume = document.createElement('button')
    resume.type = 'button'
    resume.dataset.action = 'resume'
    resume.textContent = 'Resume'
    resume.addEventListener('click', () => {
      this.resume()
    })
    panel.append(resume)

    root.append(panel)
    this._host.append(root)
    this._root = root
    root.focus()
  }

  poll(): void {
    if (!this._open) {
      return
    }
    this._input.update(0)
    if (this._input.consumePress('pause')) {
      this.resume()
    }
  }

  resume(): void {
    if (!this._open) {
      return
    }
    this._open = false
    this._loop.setPaused(false)
    this._root?.remove()
    this._root = null
  }

  dispose(): void {
    this._open = false
    this._root?.remove()
    this._root = null
  }
}
