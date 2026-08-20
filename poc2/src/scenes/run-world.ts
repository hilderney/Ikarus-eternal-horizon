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
import { warriorMaxSpeed } from '../gameobjects/enemy/warrior'
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
import { CollisionManager, type ColliderPort, type HitPair } from '../systems/collision-manager'
import { DamageResolver } from '../systems/damage-resolver'
import { DropManager, Drop } from '../systems/drop-manager'
import { DifficultyManager } from '../systems/difficulty-manager'
import { ShipCombatProxy } from '../systems/ship-combat-proxy'
import { Layer } from '../systems/layers'
import { ObjectPool } from '../pools/object-pool'
import type { MutableTouchSource, TouchControls } from '../ui/touch-controls/touch-controls'
import { Debugger, type DebuggerBinds } from '../ui/debugger/debugger'
import { CamTab } from '../ui/debugger/cam-tab'
import { EquipsTab } from '../ui/debugger/equips-tab'
import { ShipTab } from '../ui/debugger/ship-tab'
import { SpawnAreaTab } from '../ui/debugger/spawn-area-tab'
import { EnemyTab } from '../ui/debugger/enemy-tab'
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
    const followBoxVisual = {
      ...BALANCE.ship.followBox,
      position: { ...BALANCE.ship.followBox.position },
      centerLine: { ...BALANCE.ship.followBox.centerLine },
      restLine: {
        ...BALANCE.ship.followBox.restLine,
        position: { ...BALANCE.ship.followBox.restLine.position },
      },
    }
    const limitBox = new LimitBox({
      follow: BALANCE.ship.follow,
      visual: followBoxVisual,
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
    const gateAim = { x: 0, y: 0, z: 0 }

    const battleField = new BattleField({ config: BALANCE.battlefield })
    scene.add(battleField.group)
    shots.setPlayfield(battleField)

    const collision = new CollisionManager()
    const damage = new DamageResolver()
    const shipCombat = new ShipCombatProxy(ship, health, BALANCE.ship.visual.hitRadius)
    collision.registerTarget(shipCombat)

    const killCounter = { kills: 0 }
    const difficulty = new DifficultyManager({ kills: killCounter })

    const dropPool = new ObjectPool<Drop>({
      capacity: BALANCE.drops.poolSize,
      factory: () => {
        const drop = new Drop()
        scene.add(drop)
        return drop
      },
      reset: (drop) => {
        drop.deactivate()
      },
      disposeItem: (drop) => {
        scene.remove(drop)
        drop.dispose()
      },
    })
    const drops = new DropManager({
      pool: dropPool,
      inventory: ship.inventory,
      magnet: ship.transform.position,
      colliders: collision,
      shipRadius: BALANCE.ship.visual.hitRadius,
    })

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
    const cameraControls = {
      moveSpeed: BALANCE.controls.camera.moveSpeed,
      rotSpeed: BALANCE.controls.camera.rotSpeed,
      keys: BALANCE.controls.camera.keys,
    }
    const camCtl = new CameraController({
      input,
      pose: { position: cameraConfig.position, rotation: cameraConfig.rotation },
      config: cameraControls,
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
      colliders: collision,
    })

    const hitPairs: { current: readonly HitPair[] } = { current: [] }

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
      collision,
      damage,
      shipCombat,
      drops,
      dropPool,
      difficulty,
      killCounter,
      hitPairs,
      limitBox,
      followBoxVisual,
      cameraControls,
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
    collisionManager() {
      const world = current()
      return {
        update(dt: number) {
          world.hitPairs.current = world.collision.update(
            dt,
            world.shots.pools() as unknown as {
              forEachActive(fn: (s: ColliderPort) => void): void
            }[],
          )
        },
        syncRender() {
          /* detect-only */
        },
        dispose() {
          world.collision.clear()
          world.collision.unregisterTarget(world.shipCombat)
        },
      }
    },
    dropManager() {
      const world = current()
      return {
        update(dt: number) {
          world.drops.update(dt)
          for (const pair of world.hitPairs.current) {
            if (pair.aLayer === Layer.Drop || pair.bLayer === Layer.Drop) {
              const drop = (pair.aLayer === Layer.Drop ? pair.a : pair.b) as Drop
              if (drop.active) {
                world.drops.collect(drop)
              }
            }
          }
        },
        syncRender() {
          world.drops.syncRender()
        },
        dispose() {
          world.drops.dispose()
        },
      }
    },
    difficultyManager() {
      const world = current()
      return {
        update(dt: number) {
          world.difficulty.update(dt)
        },
        syncRender() {
          /* no visual */
        },
        dispose() {
          world.difficulty.reset()
        },
      }
    },
    damageResolver() {
      const world = current()
      return {
        update(_dt: number) {
          void _dt
          const events = world.damage.resolve(world.hitPairs.current)
          for (const pair of world.hitPairs.current) {
            // Enemy body contact with player ⇒ hitting status on the Warrior.
            const enemyBody =
              pair.aLayer === Layer.Enemy
                ? pair.a
                : pair.bLayer === Layer.Enemy
                  ? pair.b
                  : null
            const hitsPlayer =
              pair.aLayer === Layer.Player || pair.bLayer === Layer.Player
            if (enemyBody && hitsPlayer) {
              const notify = (enemyBody as unknown as { notifyHitting?: () => void }).notifyHitting
              if (typeof notify === 'function') {
                notify.call(enemyBody)
              }
            }
            if (!pair.consumeProjectile) {
              continue
            }
            const shot =
              pair.aLayer === Layer.PlayerShot || pair.aLayer === Layer.EnemyShot
                ? pair.a
                : pair.bLayer === Layer.PlayerShot || pair.bLayer === Layer.EnemyShot
                  ? pair.b
                  : null
            if (!shot || !('active' in shot) || !(shot as { active: boolean }).active) {
              continue
            }
            const origin =
              (shot as ColliderPort).layer === Layer.EnemyShot ? 'enemy' : 'weapon'
            world.shots.release(origin, shot as never)
          }
          for (const ev of events) {
            if (ev.kind !== 'killed') {
              continue
            }
            world.killCounter.kills += 1
            const sink = ev.sink as { x?: number; z?: number }
            world.drops.onSourceKilled('enemy', sink.x ?? 0, sink.z ?? 0)
          }
        },
        syncRender() {
          /* events only */
        },
        dispose() {
          world.damage.resetFrame()
        },
      }
    },
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
      const isGateSide = (side: number) => side === 3
      const volumeAt = (side: number) => (isGateSide(side) ? world.enemyGate : areaAt(side))
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
          sideNames: () => ['left', 'right', 'front', 'gate'],
          offset: (side) => volumeAt(side).offset(),
          size: (side) => volumeAt(side).size(),
          worldCenter: (side) => volumeAt(side).worldCenter(),
          intervalSec: (side) => (isGateSide(side) ? 0 : areaAt(side).intervalSec()),
          lanesX: (side) => (isGateSide(side) ? [] : areaAt(side).lanesX()),
          maxActive: (side) => (isGateSide(side) ? 0 : areaAt(side).maxActive()),
          visible: (side) => volumeAt(side).visible(),
          color: (side) => volumeAt(side).color(),
          opacity: (side) => volumeAt(side).opacity(),
          setOffset: (side, x, y, z) => {
            volumeAt(side).setOffset(x, y, z)
          },
          setSize: (side, x, y, z) => {
            volumeAt(side).setSize(x, y, z)
          },
          setIntervalSec: (side, value) => {
            if (!isGateSide(side)) {
              areaAt(side).setIntervalSec(value)
            }
          },
          setLanesX: (side, lanes) => {
            if (!isGateSide(side)) {
              areaAt(side).setLanesX(lanes)
            }
          },
          setMaxActive: (side, value) => {
            if (!isGateSide(side)) {
              areaAt(side).setMaxActive(value)
            }
          },
          setVisible: (side, visible) => {
            volumeAt(side).setVisible(visible)
          },
          setColor: (side, hex) => {
            volumeAt(side).setColor(hex)
          },
          setOpacity: (side, value) => {
            volumeAt(side).setOpacity(value)
          },
        },
        enemy: {
          archetypeNames: () => ['warrior'],
          setArchetype: (_index) => {
            void _index
          },
          sheet: () => world.enemies.liveSheet(),
          applyToActive: () => {
            world.enemies.applyLiveSheetToActive()
          },
          resetSheet: (defaults) => {
            if (defaults) {
              const live = world.enemies.liveSheet()
              live.name = defaults.name
              live.hp = defaults.hp
              live.radius = defaults.radius
              live.color = defaults.color
              live.contactDamage = defaults.contactDamage
              live.maxSpeed = warriorMaxSpeed(defaults.agility)
              live.agility = defaults.agility
              live.intelligence = defaults.intelligence
              live.reachSpeedMul = defaults.reachSpeedMul
              live.targets = [...defaults.targets]
              Object.assign(live.weapon, defaults.weapon)
              Object.assign(live.status, defaults.status)
              live.strategy.swapBaseMs = defaults.strategy.swapBaseMs
              live.strategy.turnRateDeg = defaults.strategy.turnRateDeg
              Object.assign(live.strategy.weights, defaults.strategy.weights)
              Object.assign(live.strategy.mods.hitted, defaults.strategy.mods.hitted)
              Object.assign(live.strategy.mods.hitting, defaults.strategy.mods.hitting)
              Object.assign(live.strategy.mods.in_range, defaults.strategy.mods.in_range)
              Object.assign(live.strategy.mods.passed_opponent, defaults.strategy.mods.passed_opponent)
              Object.assign(live.strategy.loopAround, defaults.strategy.loopAround)
              world.enemies.applyLiveSheetToActive()
              return
            }
            world.enemies.resetLiveSheet()
          },
          liveStatus: () => world.enemies.firstActiveStatus(),
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
        camera: {
          fov: () => cameraConfig.fov,
          setFov: (value) => {
            cameraConfig.fov = value
          },
          position: () => cameraConfig.position,
          setPosition: (x, y, z) => {
            cameraConfig.position.x = x
            cameraConfig.position.y = y
            cameraConfig.position.z = z
          },
          rotation: () => cameraConfig.rotation,
          setRotation: (x, y, z) => {
            cameraConfig.rotation.x = x
            cameraConfig.rotation.y = y
            cameraConfig.rotation.z = z
          },
          near: () => cameraConfig.near,
          setNear: (value) => {
            cameraConfig.near = value
          },
          far: () => cameraConfig.far,
          setFar: (value) => {
            cameraConfig.far = value
          },
          moveSpeed: () => world.cameraControls.moveSpeed,
          setMoveSpeed: (value) => {
            world.cameraControls.moveSpeed = value
          },
          rotSpeed: () => world.cameraControls.rotSpeed,
          setRotSpeed: (value) => {
            world.cameraControls.rotSpeed = value
          },
          apply: () => {
            gameCamera.applyConfig(cameraConfig)
          },
        },
        recenterPoint: {
          position: () => world.followBoxVisual.restLine.position,
          setPosition: (x, y, z) => {
            world.followBoxVisual.restLine.position.x = x
            world.followBoxVisual.restLine.position.y = y
            world.followBoxVisual.restLine.position.z = z
          },
          width: () => world.followBoxVisual.restLine.width,
          setWidth: (value) => {
            world.followBoxVisual.restLine.width = value
          },
          height: () => world.followBoxVisual.restLine.height,
          setHeight: (value) => {
            world.followBoxVisual.restLine.height = value
          },
          visible: () => world.limitBox.restLineVisible(),
          setVisible: (visible) => {
            world.limitBox.setRestLineVisible(visible)
          },
        },
      }
      const panel = new Debugger({
        host: debuggerHost,
        binds,
        tabs: [
          new ShipTab(binds),
          new EquipsTab(binds),
          new EnemyTab(binds),
          new CamTab(binds),
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
