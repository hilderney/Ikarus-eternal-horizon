/**
 * Fase 0 production world for SDD-G03.
 * Missing Stage D–F / G07 / G10 managers are no-op stand-ins until those cards land.
 */

import type { Scene } from 'three'
import { BALANCE } from '../core/balancer'
import type { InputPort } from '../core/input'
import type { GameCamera } from '../gameobjects/camera/game-camera'
import { CameraController } from '../gameobjects/controller/camera-controller'
import { PlayerController } from '../gameobjects/controller/player-controller'
import { Gizmos } from '../gameobjects/gizmos/gizmos'
import { LimitBox } from '../gameobjects/limit-box/limit-box'
import { ParallaxField } from '../gameobjects/parallax/parallax-field'
import { Ship, type BombId, type WeaponId } from '../gameobjects/ship/ship'
import { ShipHealth } from '../gameobjects/ship/ship-health'
import { WeaponShot } from '../gameobjects/shot/weapon-shot'
import { Weapon } from '../gameobjects/weapon/weapon'
import '../gameobjects/weapon/behaviours/laser'
import '../gameobjects/weapon/behaviours/plasma'
import { EnergyManager } from '../systems/energy-manager'
import { FiringManager } from '../systems/firing-manager'
import { ShotManager } from '../systems/shot-manager'
import type { MutableTouchSource, TouchControls } from '../ui/touch-controls/touch-controls'
import { Debugger, type DebuggerBinds } from '../ui/debugger/debugger'
import { EquipsTab } from '../ui/debugger/equips-tab'
import { ShipTab } from '../ui/debugger/ship-tab'
import type {
  CameraHandle,
  Disposable,
  HudPort,
  RenderSyncable,
  RunStatePort,
  RunWorldFactory,
  Steppable,
} from './run-scene'

export interface RunWorldOptions {
  readonly scene: Scene
  readonly input: InputPort
  readonly touch: MutableTouchSource
  readonly touchOverlay: TouchControls
  readonly host: HTMLElement
  readonly debuggerHost: HTMLElement
  readonly gameCamera: GameCamera
  readonly cameraConfig: {
    fov: number
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    near: number
    far: number
    aspect: number
  }
}

function noopStep(): Steppable & Disposable & RenderSyncable {
  return {
    update(dt: number) {
      void dt
    },
    syncRender() {
      /* pending card */
    },
    dispose() {
      /* pending card */
    },
  }
}

function wrap(
  update: (dt: number) => void,
  syncRender: () => void,
  dispose: () => void,
  view?: unknown,
): CameraHandle {
  return {
    view,
    update,
    syncRender,
    dispose,
  }
}

export function createRunWorld(options: RunWorldOptions): RunWorldFactory {
  const { scene, input, touchOverlay, debuggerHost, gameCamera, cameraConfig } = options
  let bag: ReturnType<typeof build> | null = null

  function current(): ReturnType<typeof build> {
    if (!bag) {
      bag = build()
    }
    return bag
  }

  function build() {
    const parallax = new ParallaxField(BALANCE.parallax.layers)
    for (const layer of parallax.layers) {
      scene.add(layer.group)
    }

    const ship = new Ship({
      visual: BALANCE.ship.visual,
      thruster: BALANCE.thruster,
      inventoryCaps: BALANCE.ship.inventory.caps,
    })
    scene.add(ship)

    const health = new ShipHealth({ config: BALANCE.ship.health })
    const energy = new EnergyManager({
      config: BALANCE.gameplay.energy,
      pool: ship.stats.energy,
      canRegen: () => ship.status.recovering,
    })
    const weaponCapacity = Math.max(
      ...BALANCE.weapons.loadout.map((id) => BALANCE.weapons.catalog[id].poolSize),
    )
    const shots = new ShotManager({
      scene,
      weaponFactory: () => new WeaponShot({ color: BALANCE.weapons.catalog.laser.color }),
      weaponCapacity,
      despawn: BALANCE.shot.despawn,
    })
    const limitBox = new LimitBox({
      follow: BALANCE.ship.follow,
      visual: BALANCE.ship.followBox,
      cameraConfig,
    })
    scene.add(limitBox.group)

    const gizmos = new Gizmos({
      camera: gameCamera.camera,
      gridSize: BALANCE.gizmos.gridSize,
      gridDivisions: BALANCE.gizmos.gridDivisions,
      gridColor: BALANCE.gizmos.gridColor,
      gridY: BALANCE.gizmos.gridY,
      gridOpacity: BALANCE.gizmos.gridOpacity,
      worldAxisSize: BALANCE.gizmos.worldAxisSize,
      cameraAxisSize: BALANCE.gizmos.cameraAxisSize,
    })
    scene.add(gizmos.group)

    const player = new PlayerController({
      input,
      transform: ship.transform,
      motion: BALANCE.controls.motion,
      dash: BALANCE.controls.dash,
      tilt: BALANCE.controls.tilt,
      keys: BALANCE.controls.shipKeys,
      modifiers: health.modifiers,
      onDash: () => {
        ship.setDashing(true)
      },
      isDashing: () => ship.status.dashing,
      energy,
    })
    const camCtl = new CameraController({
      input,
      pose: { position: cameraConfig.position, rotation: cameraConfig.rotation },
      config: BALANCE.controls.camera,
    })
    const firing = new FiringManager({
      input,
      ship: { position: ship.transform.position },
      energy,
      health,
      loadout: BALANCE.weapons.loadout,
      shooting: ship,
      registry: {
        create(id) {
          return new Weapon({ id, shots: shots.asAcquirePort() })
        },
      },
    })

    const idleHud: HudPort = {
      update() {
        /* G07 */
      },
      dispose() {
        /* G07 */
      },
    }
    const idleRun: RunStatePort = {
      phase: 'running',
      update(dt: number) {
        void dt
      },
    }

    return { parallax, ship, health, energy, shots, firing, limitBox, gizmos, player, camCtl, idleHud, idleRun }
  }

  return {
    camera(): CameraHandle {
      bag = build()
      return wrap(
        (dt) => {
          gameCamera.update(dt)
        },
        () => {
          gameCamera.syncRender()
        },
        () => {
          gameCamera.dispose()
          bag = null
        },
        gameCamera.camera,
      )
    },
    parallax() {
      const world = current()
      return wrap(
        (dt) => {
          world.parallax.update(dt, gameCamera.camera)
        },
        () => {
          world.parallax.syncRender()
        },
        () => {
          for (const layer of world.parallax.layers) {
            scene.remove(layer.group)
          }
          world.parallax.dispose()
        },
      )
    },
    limitBox() {
      const world = current()
      return wrap(
        (dt) => {
          world.limitBox.update(world.ship.transform.position, dt)
        },
        () => {
          world.limitBox.syncRender()
        },
        () => {
          scene.remove(world.limitBox.group)
          world.limitBox.dispose()
        },
      )
    },
    gizmos() {
      const world = current()
      return wrap(
        (dt) => {
          world.gizmos.update(dt)
        },
        () => {
          world.gizmos.syncRender()
        },
        () => {
          scene.remove(world.gizmos.group)
          world.gizmos.dispose()
        },
      )
    },
    ship() {
      const world = current()
      return wrap(
        (dt) => {
          world.health.update(dt)
          world.ship.update(dt)
        },
        () => {
          world.ship.syncRender()
        },
        () => {
          world.player.dispose()
          world.camCtl.dispose()
          scene.remove(world.ship)
          world.ship.dispose()
          world.health.dispose()
        },
      )
    },
    playerController() {
      const world = current()
      return {
        update(dt: number) {
          world.player.update(dt)
        },
      }
    },
    cameraController() {
      const world = current()
      return {
        update(dt: number) {
          world.camCtl.update(dt)
        },
      }
    },
    energy() {
      const world = current()
      return {
        update(dt: number) {
          world.energy.update(dt)
        },
        syncRender() {
          /* no visual */
        },
        dispose() {
          world.energy.dispose()
        },
      }
    },
    shotManager() {
      const world = current()
      return {
        update(dt: number) {
          world.shots.update(dt)
        },
        syncRender() {
          world.shots.syncRender()
        },
        dispose() {
          world.shots.dispose()
        },
      }
    },
    enemyManager: noopStep,
    meteorManager: noopStep,
    firingManager() {
      const world = current()
      return {
        update(dt: number) {
          world.firing.update(dt)
        },
        syncRender() {
          /* bolts sync via shotManager */
        },
        dispose() {
          world.firing.dispose()
        },
      }
    },
    collisionManager: noopStep,
    dropManager: noopStep,
    difficultyManager: noopStep,
    damageResolver: noopStep,
    vfxManager: noopStep,
    hud() {
      return current().idleHud
    },
    runState() {
      return current().idleRun
    },
    debugger() {
      if (!import.meta.env.DEV) {
        return null
      }
      const world = current()
      const { ship } = world
      const binds: DebuggerBinds = {
        ship: {
          snapshot: () => {
            const port = ship.debugSnapshot()
            port.loadout.equippedWeapon = world.firing.activeId()
            return port
          },
          applyTransform: () => {
            ship.applyTransform(ship.transform)
          },
          setFlickering: (value) => {
            ship.setFlickering(value)
          },
          setDashing: (value) => {
            ship.setDashing(value)
          },
          setShooting: (value) => {
            ship.setShooting(value)
          },
          equipWeapon: (id) => {
            if (id === null) {
              ship.unequipWeapon(0)
              return
            }
            const weaponId = id as WeaponId
            ship.equipWeapon(0, weaponId)
            world.firing.setActive(weaponId)
          },
          equipBomb: (id) => {
            if (id === null) {
              ship.unequipBomb(0)
              return
            }
            ship.equipBomb(0, id as BombId, 1)
          },
        },
        weapons: {
          level: () => world.firing.weaponLevel(),
          setLevel: (level) => {
            world.firing.setWeaponLevel(level)
          },
        },
        dash: {
          level: () => world.player.dashLevel(),
          setLevel: (level) => {
            world.player.setDashLevel(level)
          },
        },
      }
      const panel = new Debugger({
        host: debuggerHost,
        binds,
        tabs: [new ShipTab(binds), new EquipsTab(binds)],
        enabled: true,
      })
      return {
        update(dt: number) {
          panel.update(dt)
        },
        dispose() {
          panel.dispose()
        },
      }
    },
    touchControls() {
      return {
        dispose() {
          touchOverlay.dispose()
        },
      }
    },
  }
}

export function createInputMap(): {
  mount(host: HTMLElement): void
  dispose(): void
} {
  const root = document.createElement('div')
  root.className = 'input-map'
  root.textContent = [
    'WASD  move',
    'IJKL  camera  U/O up/down',
    'Shift+IJKL camera rot',
    'Space fire / RT   F / LB switch',
    'F wpn   Q bomb×',
    'Esc pause / scheme',
    'Pad: stick · RT fire · A bomb',
    'LT dash · LB/RB switch · Start',
  ].join('\n')
  return {
    mount(host: HTMLElement) {
      host.replaceChildren(root)
    },
    dispose() {
      root.remove()
    },
  }
}
