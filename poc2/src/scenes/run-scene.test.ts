// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Scene } from 'three'
import type { GameRendererPort } from '../render/renderer'
import type { UiAreasPort } from '../ui/areas'
import {
  RunScene,
  type CameraHandle,
  type Disposable,
  type InputMapPort,
  type RenderSyncable,
  type RunWorldFactory,
  type ScenePort,
  type Steppable,
} from './run-scene'

function makeAreas(): UiAreasPort {
  const stage = document.createElement('div')
  const inputs = document.createElement('div')
  const game = document.createElement('div')
  const dbg = document.createElement('div')
  document.body.append(stage, inputs, game, dbg)
  let mode: UiAreasPort['mode'] = 'menu'
  return {
    stage,
    inputs,
    game,
    debugger: dbg,
    get mode() {
      return mode
    },
    setMode(next) {
      mode = next
      stage.dataset.mode = next
    },
    dispose() {
      /* scaffold stays */
    },
  }
}

function makeHandle(log: string[], name: string, extra: Partial<CameraHandle> = {}): CameraHandle {
  return {
    view: extra.view ?? { name },
    update(dt: number) {
      void dt
      log.push(`${name}.update`)
    },
    syncRender() {
      log.push(`${name}.syncRender`)
    },
    dispose() {
      log.push(`${name}.dispose`)
    },
  }
}

function makeStep(log: string[], name: string): Steppable & Disposable & RenderSyncable {
  return {
    update(dt: number) {
      void dt
      log.push(`${name}.update`)
    },
    syncRender() {
      log.push(`${name}.syncRender`)
    },
    dispose() {
      log.push(`${name}.dispose`)
    },
  }
}

function makeWorld(
  log: string[],
  overrides: Partial<RunWorldFactory> = {},
): { world: RunWorldFactory; calls: Record<string, number> } {
  const calls: Record<string, number> = {}
  const bump = (key: string): void => {
    calls[key] = (calls[key] ?? 0) + 1
  }
  const world: RunWorldFactory = {
    camera: () => {
      bump('camera')
      return makeHandle(log, 'camera')
    },
    parallax: () => {
      bump('parallax')
      return makeStep(log, 'parallax')
    },
    limitBox: () => {
      bump('limitBox')
      return makeStep(log, 'limitBox')
    },
    gizmos: () => {
      bump('gizmos')
      return makeStep(log, 'gizmos')
    },
    spawnArea: () => {
      bump('spawnArea')
      return makeStep(log, 'spawnArea')
    },
    battleField: () => {
      bump('battleField')
      return makeStep(log, 'battleField')
    },
    ship: () => {
      bump('ship')
      return makeStep(log, 'ship')
    },
    playerController: () => {
      bump('playerController')
      return makeStep(log, 'playerController')
    },
    cameraController: () => {
      bump('cameraController')
      return makeStep(log, 'cameraController')
    },
    energy: () => {
      bump('energy')
      return makeStep(log, 'energy')
    },
    shotManager: () => {
      bump('shotManager')
      return makeStep(log, 'shotManager')
    },
    enemyManager: () => {
      bump('enemyManager')
      return makeStep(log, 'enemyManager')
    },
    meteorManager: () => {
      bump('meteorManager')
      return makeStep(log, 'meteorManager')
    },
    firingManager: () => {
      bump('firingManager')
      return makeStep(log, 'firingManager')
    },
    collisionManager: () => {
      bump('collisionManager')
      return makeStep(log, 'collisionManager')
    },
    dropManager: () => {
      bump('dropManager')
      return makeStep(log, 'dropManager')
    },
    difficultyManager: () => {
      bump('difficultyManager')
      return makeStep(log, 'difficultyManager')
    },
    damageResolver: () => {
      bump('damageResolver')
      return makeStep(log, 'damageResolver')
    },
    vfxManager: () => {
      bump('vfxManager')
      return makeStep(log, 'vfxManager')
    },
    hud: () => {
      bump('hud')
      return {
        update() {
          log.push('hud.update')
        },
        dispose() {
          log.push('hud.dispose')
        },
      }
    },
    runState: () => {
      bump('runState')
      return {
        phase: 'running' as const,
        update() {
          log.push('runState.update')
        },
      }
    },
    debugger: () => null,
    ...overrides,
  }
  return { world, calls }
}

function makeRenderer(): GameRendererPort {
  const canvas = document.createElement('canvas')
  const attach = vi.fn((host: HTMLElement) => {
    host.append(canvas)
  })
  const detach = vi.fn(() => {
    canvas.remove()
  })
  const render = vi.fn()
  const renderer: GameRendererPort = {
    canvas,
    scene: new Scene(),
    attach,
    detach,
    resize: vi.fn(),
    render,
    dispose: vi.fn(),
  }
  return renderer
}

function makeInputMap(): InputMapPort {
  return {
    mount: vi.fn(),
    dispose: vi.fn(),
  }
}

describe('RunScene', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('reports id "run"', () => {
    const log: string[] = []
    const scene = new RunScene({
      areas: makeAreas(),
      renderer: makeRenderer(),
      router: { next: vi.fn() },
      world: makeWorld(log).world,
      input: { update: vi.fn() },
      inputMap: makeInputMap(),
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    expect(scene.id).toBe('run')
  })

  it('mount constructs camera, parallax, limit-box, gizmos and spawn-area via factory', () => {
    const log: string[] = []
    const { world, calls } = makeWorld(log)
    const scene = new RunScene({
      areas: makeAreas(),
      renderer: makeRenderer(),
      router: { next: vi.fn() },
      world,
      input: { update: vi.fn() },
      inputMap: makeInputMap(),
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    scene.mount()
    expect(calls.camera).toBe(1)
    expect(calls.parallax).toBe(1)
    expect(calls.limitBox).toBe(1)
    expect(calls.gizmos).toBe(1)
    expect(calls.spawnArea).toBe(1)
    expect(calls.battleField).toBe(1)
    scene.dispose()
  })

  it('mount constructs ship and every manager via factory', () => {
    const log: string[] = []
    const { world, calls } = makeWorld(log)
    const scene = new RunScene({
      areas: makeAreas(),
      renderer: makeRenderer(),
      router: { next: vi.fn() },
      world,
      input: { update: vi.fn() },
      inputMap: makeInputMap(),
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    scene.mount()
    expect(calls.ship).toBe(1)
    expect(calls.playerController).toBe(1)
    expect(calls.energy).toBe(1)
    expect(calls.shotManager).toBe(1)
    expect(calls.enemyManager).toBe(1)
    expect(calls.meteorManager).toBe(1)
    expect(calls.firingManager).toBe(1)
    expect(calls.collisionManager).toBe(1)
    expect(calls.dropManager).toBe(1)
    expect(calls.difficultyManager).toBe(1)
    expect(calls.damageResolver).toBe(1)
    expect(calls.vfxManager).toBe(1)
    expect(calls.hud).toBe(1)
    expect(calls.runState).toBe(1)
    scene.dispose()
  })

  it('mount sets areas mode to run and attaches the canvas to game-area', () => {
    const areas = makeAreas()
    const renderer = makeRenderer()
    const scene = new RunScene({
      areas,
      renderer,
      router: { next: vi.fn() },
      world: makeWorld([]).world,
      input: { update: vi.fn() },
      inputMap: makeInputMap(),
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    scene.mount()
    expect(areas.mode).toBe('run')
    expect(renderer.attach).toHaveBeenCalledWith(areas.game)
    expect(areas.game.contains(renderer.canvas)).toBe(true)
    scene.dispose()
  })

  it('mount writes the input map into area-inputs', () => {
    const areas = makeAreas()
    const inputMap = makeInputMap()
    const scene = new RunScene({
      areas,
      renderer: makeRenderer(),
      router: { next: vi.fn() },
      world: makeWorld([]).world,
      input: { update: vi.fn() },
      inputMap,
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    scene.mount()
    expect(inputMap.mount).toHaveBeenCalledWith(areas.inputs)
    scene.dispose()
  })

  it('update calls input.update(dt) before controllers', () => {
    const log: string[] = []
    const input = {
      update(dt: number) {
        void dt
        log.push('input.update')
      },
    }
    const scene = new RunScene({
      areas: makeAreas(),
      renderer: makeRenderer(),
      router: { next: vi.fn() },
      world: makeWorld(log).world,
      input,
      inputMap: makeInputMap(),
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    scene.mount()
    log.length = 0
    scene.update(0.016)
    expect(log[0]).toBe('input.update')
    expect(log.indexOf('playerController.update')).toBeGreaterThan(0)
    expect(log.indexOf('playerController.update')).toBeLessThan(log.indexOf('ship.update'))
    scene.dispose()
  })

  it('update then syncRender then renderer.render on a step', () => {
    const log: string[] = []
    const renderer = makeRenderer()
    const scene = new RunScene({
      areas: makeAreas(),
      renderer,
      router: { next: vi.fn() },
      world: makeWorld(log).world,
      input: { update: vi.fn() },
      inputMap: makeInputMap(),
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    scene.mount()
    log.length = 0
    scene.update(0.016)
    expect(renderer.render).not.toHaveBeenCalled()
    scene.syncRender()
    expect(log).toContain('camera.syncRender')
    expect(log).toContain('ship.syncRender')
    expect(renderer.render).toHaveBeenCalledTimes(1)
    scene.dispose()
  })

  it('update does not call renderer.render', () => {
    const renderer = makeRenderer()
    const scene = new RunScene({
      areas: makeAreas(),
      renderer,
      router: { next: vi.fn() },
      world: makeWorld([]).world,
      input: { update: vi.fn() },
      inputMap: makeInputMap(),
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    scene.mount()
    scene.update(0.016)
    expect(renderer.render).not.toHaveBeenCalled()
    scene.dispose()
  })

  it('when runState.phase becomes over, next(result) fires once', () => {
    const result: ScenePort = { id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }
    const next = vi.fn()
    let phase: 'running' | 'over' = 'running'
    const { world } = makeWorld([], {
      runState: () => ({
        get phase() {
          return phase
        },
        update() {
          phase = 'over'
        },
      }),
    })
    const scene = new RunScene({
      areas: makeAreas(),
      renderer: makeRenderer(),
      router: { next },
      world,
      input: { update: vi.fn() },
      inputMap: makeInputMap(),
      createResult: () => result,
    })
    scene.mount()
    scene.update(0.016)
    scene.update(0.016)
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(result)
    scene.dispose()
  })

  it('dispose disposes camera, parallax, limit-box, gizmos, spawn-area, battle-field, ship, managers, hud', () => {
    const log: string[] = []
    const scene = new RunScene({
      areas: makeAreas(),
      renderer: makeRenderer(),
      router: { next: vi.fn() },
      world: makeWorld(log).world,
      input: { update: vi.fn() },
      inputMap: makeInputMap(),
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    scene.mount()
    scene.dispose()
    expect(log).toContain('camera.dispose')
    expect(log).toContain('parallax.dispose')
    expect(log).toContain('limitBox.dispose')
    expect(log).toContain('gizmos.dispose')
    expect(log).toContain('spawnArea.dispose')
    expect(log).toContain('battleField.dispose')
    expect(log).toContain('ship.dispose')
    expect(log).toContain('energy.dispose')
    expect(log).toContain('hud.dispose')
  })

  it('dispose detaches the canvas and clears area-inputs', () => {
    const renderer = makeRenderer()
    const inputMap = makeInputMap()
    const scene = new RunScene({
      areas: makeAreas(),
      renderer,
      router: { next: vi.fn() },
      world: makeWorld([]).world,
      input: { update: vi.fn() },
      inputMap,
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    scene.mount()
    scene.dispose()
    expect(renderer.detach).toHaveBeenCalledTimes(1)
    expect(inputMap.dispose).toHaveBeenCalledTimes(1)
  })

  it('skips debugger construction when the factory returns null', () => {
    const debuggerFactory = vi.fn(() => null)
    const { world } = makeWorld([], { debugger: debuggerFactory })
    const scene = new RunScene({
      areas: makeAreas(),
      renderer: makeRenderer(),
      router: { next: vi.fn() },
      world,
      input: { update: vi.fn() },
      inputMap: makeInputMap(),
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    scene.mount()
    expect(debuggerFactory).toHaveBeenCalledTimes(1)
    scene.dispose()
  })

  it('a second mount after dispose constructs a fresh world', () => {
    const log: string[] = []
    const { world, calls } = makeWorld(log)
    const scene = new RunScene({
      areas: makeAreas(),
      renderer: makeRenderer(),
      router: { next: vi.fn() },
      world,
      input: { update: vi.fn() },
      inputMap: makeInputMap(),
      createResult: () => ({ id: 'result', mount() {}, update() {}, syncRender() {}, dispose() {} }),
    })
    scene.mount()
    scene.dispose()
    scene.mount()
    expect(calls.camera).toBe(2)
    expect(calls.ship).toBe(2)
    scene.dispose()
  })
})
