/**
 * SDD-G06 UI areas — binds the scaffold three-column shell.
 * Query-only; ids live in poc2/index.html.
 */

export type AreaMode = 'menu' | 'run'

export interface UiAreasPort {
  readonly stage: HTMLElement
  readonly inputs: HTMLElement
  readonly game: HTMLElement
  readonly debugger: HTMLElement
  readonly mode: AreaMode
  setMode(mode: AreaMode): void
  dispose(): void
}

export interface UiAreasOptions {
  readonly document?: Document
}

export const AREA_IDS = {
  stage: 'stage',
  inputs: 'area-inputs',
  game: 'game-area',
  debugger: 'debugger-area',
} as const

function requireId(doc: Document, id: string): HTMLElement {
  const el = doc.getElementById(id)
  if (el === null) {
    throw new Error(`Missing structural area #${id}`)
  }
  return el
}

export class UiAreas implements UiAreasPort {
  readonly stage: HTMLElement
  readonly inputs: HTMLElement
  readonly game: HTMLElement
  readonly debugger: HTMLElement
  private _mode: AreaMode = 'menu'

  constructor(options: UiAreasOptions = {}) {
    const doc = options.document ?? document
    this.stage = requireId(doc, AREA_IDS.stage)
    this.inputs = requireId(doc, AREA_IDS.inputs)
    this.game = requireId(doc, AREA_IDS.game)
    this.debugger = requireId(doc, AREA_IDS.debugger)
  }

  get mode(): AreaMode {
    return this._mode
  }

  setMode(mode: AreaMode): void {
    this._mode = mode
    this.stage.dataset.mode = mode
  }

  dispose(): void {
    this._mode = 'menu'
    delete this.stage.dataset.mode
  }
}
