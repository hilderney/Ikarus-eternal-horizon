/**
 * SDD-G03 RunScene — playable run. D14 owner of camera / parallax / limit-box /
 * gizmos + ship, controllers and managers. GameLoop.step = update + syncRender.
 */

import type { GameRendererPort } from '../render/renderer'
import type { UiAreasPort } from '../ui/areas'

export type SceneId = 'title' | 'run' | 'result' | 'rankings'

export interface ScenePort {
  readonly id: SceneId
  mount(): void
  update(dt: number): void
  syncRender(): void
  dispose(): void
}

export interface SceneRouter {
  next(scene: ScenePort): void
}

export interface Disposable {
  dispose(): void
}

export interface Steppable {
  update(dt: number): void
}

export interface RenderSyncable {
  syncRender(): void
}

export interface CameraHandle extends Disposable, Steppable, RenderSyncable {
  readonly view: unknown
}

export interface HudPort {
  update(): void
  dispose(): void
}

export interface RunStatePort {
  readonly phase: 'running' | 'paused' | 'over'
  update(dt: number): void
}

export interface InputUpdatePort {
  update(dt: number): void
}

export interface RunWorldFactory {
  camera(): CameraHandle
  parallax(): Disposable & Steppable & RenderSyncable
  limitBox(): Disposable & Steppable & RenderSyncable
  gizmos(): Disposable & Steppable & RenderSyncable
  ship(): Disposable & Steppable & RenderSyncable
  playerController(): Steppable
  cameraController(): Steppable
  energy(): Steppable & Disposable
  shotManager(): Steppable & Disposable
  enemyManager(): Steppable & Disposable
  meteorManager(): Steppable & Disposable
  firingManager(): Steppable & Disposable
  collisionManager(): Steppable & Disposable
  dropManager(): Steppable & Disposable
  difficultyManager(): Steppable & Disposable
  damageResolver(): Steppable & Disposable
  vfxManager(): Steppable & Disposable
  hud(): HudPort
  runState(): RunStatePort
  debugger?(): (Steppable & Disposable) | null
  touchControls?(): Disposable | null
}

export interface InputMapPort {
  mount(host: HTMLElement): void
  update?(dt: number): void
  dispose(): void
}

export interface RunSceneOptions {
  readonly areas: UiAreasPort
  readonly renderer: GameRendererPort
  readonly router: SceneRouter
  readonly world: RunWorldFactory
  readonly input: InputUpdatePort
  readonly inputMap: InputMapPort
  readonly createResult: () => ScenePort
}

const MANAGER_KEYS = [
  'energy',
  'shotManager',
  'enemyManager',
  'meteorManager',
  'firingManager',
  'collisionManager',
  'dropManager',
  'difficultyManager',
  'damageResolver',
  'vfxManager',
] as const

export class RunScene implements ScenePort {
  readonly id: SceneId = 'run'

  private readonly _areas: UiAreasPort
  private readonly _renderer: GameRendererPort
  private readonly _router: SceneRouter
  private readonly _world: RunWorldFactory
  private readonly _input: InputUpdatePort
  private readonly _inputMap: InputMapPort
  private readonly _createResult: () => ScenePort

  private _camera: CameraHandle | null = null
  private _parallax: (Disposable & Steppable & RenderSyncable) | null = null
  private _limitBox: (Disposable & Steppable & RenderSyncable) | null = null
  private _gizmos: (Disposable & Steppable & RenderSyncable) | null = null
  private _ship: (Disposable & Steppable & RenderSyncable) | null = null
  private _player: Steppable | null = null
  private _camCtl: Steppable | null = null
  private readonly _managers: (Steppable & Disposable & Partial<RenderSyncable>)[] = []
  private _hud: HudPort | null = null
  private _runState: RunStatePort | null = null
  private _debugger: (Steppable & Disposable) | null = null
  private _touch: Disposable | null = null
  private _ended = false
  private _mounted = false

  constructor(options: RunSceneOptions) {
    this._areas = options.areas
    this._renderer = options.renderer
    this._router = options.router
    this._world = options.world
    this._input = options.input
    this._inputMap = options.inputMap
    this._createResult = options.createResult
  }

  mount(): void {
    if (this._mounted) {
      return
    }
    this._ended = false
    this._camera = this._world.camera()
    this._parallax = this._world.parallax()
    this._limitBox = this._world.limitBox()
    this._gizmos = this._world.gizmos()
    this._ship = this._world.ship()
    this._player = this._world.playerController()
    this._camCtl = this._world.cameraController()
    this._managers.length = 0
    for (const key of MANAGER_KEYS) {
      this._managers.push(this._world[key]())
    }
    this._hud = this._world.hud()
    this._runState = this._world.runState()
    this._debugger = this._world.debugger?.() ?? null

    this._areas.setMode('run')
    this._renderer.attach(this._areas.game)
    this._inputMap.mount(this._areas.inputs)
    this._touch = this._world.touchControls?.() ?? null
    this._mounted = true
  }

  update(dt: number): void {
    if (!this._mounted) {
      return
    }
    this._input.update(dt)
    this._inputMap.update?.(dt)
    this._player?.update(dt)
    this._camCtl?.update(dt)
    this._ship?.update(dt)
    this._limitBox?.update(dt)
    this._camera?.update(dt)
    this._parallax?.update(dt)
    this._gizmos?.update(dt)
    for (const manager of this._managers) {
      manager.update(dt)
    }
    this._debugger?.update(dt)
    this._runState?.update(dt)
    this._hud?.update()

    if (this._runState?.phase === 'over' && !this._ended) {
      this._ended = true
      this._router.next(this._createResult())
    }
  }

  syncRender(): void {
    if (!this._mounted) {
      return
    }
    this._camera?.syncRender()
    this._parallax?.syncRender()
    this._limitBox?.syncRender()
    this._gizmos?.syncRender()
    this._ship?.syncRender()
    for (const manager of this._managers) {
      manager.syncRender?.()
    }
    this._renderer.render(this._camera?.view)
  }

  dispose(): void {
    if (!this._mounted) {
      return
    }
    this._mounted = false
    this._touch?.dispose()
    this._touch = null
    this._inputMap.dispose()
    this._debugger?.dispose()
    this._debugger = null
    this._hud?.dispose()
    this._hud = null
    for (let i = this._managers.length - 1; i >= 0; i--) {
      this._managers[i]?.dispose()
    }
    this._managers.length = 0
    this._ship?.dispose()
    this._ship = null
    this._gizmos?.dispose()
    this._gizmos = null
    this._limitBox?.dispose()
    this._limitBox = null
    this._parallax?.dispose()
    this._parallax = null
    this._camera?.dispose()
    this._camera = null
    this._player = null
    this._camCtl = null
    this._runState = null
    this._renderer.detach()
    this._ended = false
  }
}
