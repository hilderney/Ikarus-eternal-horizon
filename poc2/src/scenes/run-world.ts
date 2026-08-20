/**
 * Fase 0 production world for SDD-G03.
 * Missing Stage D–F / G07 / G10 managers are no-op stand-ins until those cards land.
 */

import type { Scene } from 'three'
import { BALANCE } from '../core/balancer'
import type { InputPort } from '../core/input'
import type { InputBindings } from '../core/input-bindings'
import type { GameCamera } from '../gameobjects/camera/game-camera'
import { CameraController } from '../gameobjects/controller/camera-controller'
import { PlayerController } from '../gameobjects/controller/player-controller'
import { Gizmos } from '../gameobjects/gizmos/gizmos'
import { LimitBox } from '../gameobjects/limit-box/limit-box'
import { BattleField } from '../gameobjects/battle-field/battle-field'
import { EnemyGate } from '../gameobjects/enemy-gate/enemy-gate'
import { SpawnArea } from '../gameobjects/spawn-area/spawn-area'
import { ParallaxField } from '../gameobjects/parallax/parallax-field'
import {
  Ship,
  type ArmorId,
  type BombId,
  type EnergyCollectorId,
  type EnergyConverterId,
  type ShieldFitId,
  type WeaponId,
  type WingId,
} from '../gameobjects/ship/ship'
import { ShipHealth } from '../gameobjects/ship/ship-health'
import { WeaponShot } from '../gameobjects/shot/weapon-shot'
import { EnemyShot } from '../gameobjects/shot/enemy-shot'
import {
  patchWeaponStat,
  weaponLevelSnapshot,
  type WeaponLevelSnapshotField,
} from '../gameobjects/weapon/weapon-levels'
import { Weapon } from '../gameobjects/weapon/weapon'
import '../gameobjects/weapon/behaviours/laser'
import '../gameobjects/weapon/behaviours/plasma'
import '../gameobjects/weapon/behaviours/beam'
import '../gameobjects/weapon/behaviours/mjolnir'
import { EnergyManager } from '../systems/energy-manager'
import { EnemyManager } from '../systems/enemy-manager'
import { FiringManager } from '../systems/firing-manager'
import { ShotManager } from '../systems/shot-manager'
import type { MutableTouchSource, TouchControls } from '../ui/touch-controls/touch-controls'
import { Debugger, type DebuggerBinds } from '../ui/debugger/debugger'
import { EquipsTab } from '../ui/debugger/equips-tab'
import { ShipTab } from '../ui/debugger/ship-tab'
import { SpawnAreaTab } from '../ui/debugger/spawn-area-tab'
import { ParallaxTab } from '../ui/debugger/parallax-tab'
import { InputMap } from '../ui/input-map/input-map'
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
      regenBonus: () => ship.energyGain,
    })
    const weaponCapacity = Math.max(
      ...BALANCE.weapons.loadout.map((id) => BALANCE.weapons.catalog[id].poolSize),
    )
    const shots = new ShotManager({
      scene,
      weaponFactory: () => new WeaponShot({ color: BALANCE.weapons.catalog.laser.color }),
      weaponCapacity,
      enemyFactory: () => new EnemyShot({ color: BALANCE.enemy.warrior.weapon.color }),
      enemyCapacity: BALANCE.enemy.shotPoolSize,
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

    const spawnLeft = new SpawnArea({
      config: BALANCE.enemy.spawnLeft,
      name: 'spawnAreaLeft',
    })
    scene.add(spawnLeft.group)
    const spawnRight = new SpawnArea({
      config: BALANCE.enemy.spawnRight,
      name: 'spawnAreaRight',
    })
    scene.add(spawnRight.group)
    const spawnFront = new SpawnArea({
      config: BALANCE.enemy.spawnFront,
      name: 'spawnAreaFront',
    })
    scene.add(spawnFront.group)

    const enemyGate = new EnemyGate({ config: BALANCE.enemy.gate })
    scene.add(enemyGate.group)
    const gateAim = { x: 0, z: 0 }

    const battleField = new BattleField({ config: BALANCE.battlefield })
    scene.add(battleField.group)

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
          return new Weapon({ id, shots: shots.asAcquirePort(), deps: { scene } })
        },
      },
    })
    const enemies = new EnemyManager({
      scene,
      seekTarget: ship.transform.position,
      gateTarget: gateAim,
      spawnLeft,
      spawnRight,
      spawnFront,
      enemyGate,
      battleField,
      shots: shots.asEnemyAcquirePort(),
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

    return {
      parallax,
      ship,
      health,
      energy,
      shots,
      firing,
      enemies,
      limitBox,
      gizmos,
      spawnLeft,
      spawnRight,
      spawnFront,
      enemyGate,
      battleField,
      player,
      camCtl,
      idleHud,
      idleRun,
    }
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
    spawnArea() {
      const world = current()
      return wrap(
        (dt: number) => {
          void dt
          const ship = world.ship.transform.position
          world.spawnLeft.update(ship)
          world.spawnRight.update(ship)
          world.spawnFront.update(ship)
          world.enemyGate.update(ship)
        },
        () => {
          world.spawnLeft.syncRender()
          world.spawnRight.syncRender()
          world.spawnFront.syncRender()
          world.enemyGate.syncRender()
        },
        () => {
          scene.remove(world.spawnLeft.group)
          world.spawnLeft.dispose()
          scene.remove(world.spawnRight.group)
          world.spawnRight.dispose()
          scene.remove(world.spawnFront.group)
          world.spawnFront.dispose()
          scene.remove(world.enemyGate.group)
          world.enemyGate.dispose()
        },
      )
    },
    battleField() {
      const world = current()
      return wrap(
        (dt: number) => {
          void dt
          world.battleField.update(world.ship.transform.position)
        },
        () => {
          world.battleField.syncRender()
        },
        () => {
          scene.remove(world.battleField.group)
          world.battleField.dispose()
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
    enemyManager() {
      const world = current()
      return {
        update(dt: number) {
          world.enemies.update(dt)
        },
        syncRender() {
          world.enemies.syncRender()
        },
        dispose() {
          world.enemies.dispose()
        },
      }
    },
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
      const areaAt = (side: number) => {
        if (side === 1) {
          return world.spawnRight
        }
        if (side === 2) {
          return world.spawnFront
        }
        return world.spawnLeft
      }
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
          equipWings: (id) => {
            ship.equipWings(id as WingId | null)
          },
          equipShield: (id) => {
            ship.equipShield(id as ShieldFitId | null)
          },
          equipArmor: (id) => {
            ship.equipBody(id as ArmorId | null)
          },
          equipEnergyCollector: (id) => {
            ship.equipEnergyCollector(id as EnergyCollectorId | null)
          },
          equipEnergyConverter: (id) => {
            ship.equipEnergyConverter(id as EnergyConverterId | null)
          },
        },
        weapons: {
          level: () => world.firing.weaponLevel(),
          setLevel: (level) => {
            world.firing.setWeaponLevel(level)
            world.ship.setWeaponLevel(level)
          },
          activeId: () => world.firing.activeId(),
          stats: () => weaponLevelSnapshot(world.firing.weapon().config),
          patchStat: (field: WeaponLevelSnapshotField, value: number) => {
            patchWeaponStat(world.firing.weapon().config, field, value)
          },
        },
        dash: {
          level: () => world.player.dashLevel(),
          setLevel: (level) => {
            world.player.setDashLevel(level)
          },
        },
        spawnArea: {
          sideNames: () => ['left', 'right', 'front'],
          offset: (side) => areaAt(side).offset(),
          size: (side) => areaAt(side).size(),
          worldCenter: (side) => areaAt(side).worldCenter(),
          intervalSec: (side) => areaAt(side).intervalSec(),
          lanesX: (side) => areaAt(side).lanesX(),
          maxActive: (side) => areaAt(side).maxActive(),
          visible: (side) => areaAt(side).visible(),
          color: (side) => areaAt(side).color(),
          opacity: (side) => areaAt(side).opacity(),
          setOffset: (side, x, y, z) => {
            areaAt(side).setOffset(x, y, z)
          },
          setSize: (side, x, y, z) => {
            areaAt(side).setSize(x, y, z)
          },
          setIntervalSec: (side, value) => {
            areaAt(side).setIntervalSec(value)
          },
          setLanesX: (side, lanes) => {
            areaAt(side).setLanesX(lanes)
          },
          setMaxActive: (side, value) => {
            areaAt(side).setMaxActive(value)
          },
          setVisible: (side, visible) => {
            areaAt(side).setVisible(visible)
          },
          setColor: (side, hex) => {
            areaAt(side).setColor(hex)
          },
          setOpacity: (side, value) => {
            areaAt(side).setOpacity(value)
          },
        },
        parallax: {
          layerCount: () => world.parallax.layerCount(),
          layerNames: () => world.parallax.layerNames(),
          config: (index) => world.parallax.config(index),
          applyConfig: (index, config) => {
            world.parallax.applyConfig(index, config)
          },
          visible: (index) => world.parallax.visible(index),
          setVisible: (index, visible) => {
            world.parallax.setVisible(index, visible)
          },
        },
      }
      const panel = new Debugger({
        host: debuggerHost,
        binds,
        tabs: [
          new ShipTab(binds),
          new EquipsTab(binds),
          new SpawnAreaTab(binds),
          new ParallaxTab(binds),
        ],
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

export function createInputMap(
  bindings?: InputBindings,
  onChange?: () => void,
): InputMap {
  return new InputMap({ bindings, onChange })
}
