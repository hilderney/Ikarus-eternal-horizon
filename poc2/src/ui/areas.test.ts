// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { BALANCE } from '../core/balancer'
import { AREA_IDS, UiAreas } from './areas'

function mountScaffold(includeDebugger = true): HTMLElement {
  const stage = document.createElement('div')
  stage.id = AREA_IDS.stage
  const inputs = document.createElement('aside')
  inputs.id = AREA_IDS.inputs
  const game = document.createElement('main')
  game.id = AREA_IDS.game
  stage.append(inputs, game)
  if (includeDebugger) {
    const dbg = document.createElement('aside')
    dbg.id = AREA_IDS.debugger
    stage.append(dbg)
  }
  document.body.append(stage)
  return stage
}

describe('UiAreas', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('binds to #stage, #area-inputs, #game-area, #debugger-area', () => {
    mountScaffold()
    const areas = new UiAreas()
    expect(areas.stage.id).toBe('stage')
    expect(areas.inputs.id).toBe('area-inputs')
    expect(areas.game.id).toBe('game-area')
    expect(areas.debugger.id).toBe('debugger-area')
    areas.dispose()
  })

  it('throws when any scaffold id is missing', () => {
    mountScaffold(false)
    expect(() => new UiAreas()).toThrow(/debugger-area/)
  })

  it('does not create duplicate area nodes', () => {
    mountScaffold()
    const before = document.querySelectorAll('#stage, #area-inputs, #game-area, #debugger-area').length
    const areas = new UiAreas()
    const after = document.querySelectorAll('#stage, #area-inputs, #game-area, #debugger-area').length
    expect(after).toBe(before)
    expect(after).toBe(4)
    areas.dispose()
  })

  it('setMode("run") writes data-mode="run" on #stage', () => {
    mountScaffold()
    const areas = new UiAreas()
    areas.setMode('run')
    expect(areas.stage.dataset.mode).toBe('run')
    expect(areas.mode).toBe('run')
    areas.dispose()
  })

  it('setMode("menu") writes data-mode="menu" on #stage', () => {
    mountScaffold()
    const areas = new UiAreas()
    areas.setMode('run')
    areas.setMode('menu')
    expect(areas.stage.dataset.mode).toBe('menu')
    areas.dispose()
  })

  it('exposes collapse breakpoint 760 from BALANCE.layout.collapsePx', () => {
    expect(BALANCE.layout.collapsePx).toBe(760)
  })

  it('dispose leaves the scaffold ids in the document', () => {
    mountScaffold()
    const areas = new UiAreas()
    areas.setMode('run')
    areas.dispose()
    expect(document.getElementById('stage')).not.toBeNull()
    expect(document.getElementById('area-inputs')).not.toBeNull()
    expect(document.getElementById('game-area')).not.toBeNull()
    expect(document.getElementById('debugger-area')).not.toBeNull()
  })
})
