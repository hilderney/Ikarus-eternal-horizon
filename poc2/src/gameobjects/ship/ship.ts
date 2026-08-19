/**
 * SDD-C01 Ship — player craft as a THREE.Group (POC-1 silhouette port).
 */

import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three'
import type { Material } from 'three'
import { BALANCE } from '../../core/balancer'
import { DEG2RAD } from '../../core/math'

export type ResourceId = 'metalScrap' | 'prismaticCrystal' | 'denseCore' | 'darkMatter'

export type WeaponId = 'laser' | 'plasma' | 'beam' | 'mjolnir'

export type BombId = 'pulseNova' | 'swarmTorpedo' | 'starKiller'

export interface ShipVisual {
  readonly size: { readonly w: number; readonly h: number; readonly d: number }
  readonly wireframeColor: number
  readonly accentColor: number
  readonly thrusterColor: number
}

export interface ThrusterVisual {
  readonly position: { readonly y: number }
  readonly length: number
  readonly width: number
}

export interface ShipTransform {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: number
}

export interface WeaponSlot {
  readonly index: number
  readonly equipped: WeaponId | null
}

export interface BombSlot {
  readonly index: number
  readonly equipped: BombId | null
  readonly charges: number
}

export interface Equipment {
  readonly id: string
}

/** Integer 0..BALANCE.ship.stats.byteCap (255). */
export interface BytePool {
  current: number
  max: number
}

export interface ShipStats {
  agility: BytePool
  deflection: BytePool
  integrity: BytePool
  shield: BytePool
  precision: BytePool
  energy: BytePool
}

export interface ShipStatus {
  flickering: boolean
  dashing: boolean
  shooting: boolean
  recovering: boolean
}

export type WingId = 'standard' | 'agility' | 'armored'
export type ShieldFitId = 'light' | 'standard' | 'heavy'
export type ArmorId = 'light' | 'standard' | 'heavy'
export type EnergyCollectorId = 'passive' | 'wide'
export type EnergyConverterId = 'scrap' | 'crystal'

export interface ShipLoadout {
  equippedWeapon: WeaponId | null
  weapons: readonly WeaponId[]
  equippedBomb: BombId | null
  bombs: readonly BombId[]
  equippedWings: WingId | null
  wings: readonly WingId[]
  equippedShield: ShieldFitId | null
  shields: readonly ShieldFitId[]
  equippedArmor: ArmorId | null
  armors: readonly ArmorId[]
  equippedEnergyCollector: EnergyCollectorId | null
  energyCollectors: readonly EnergyCollectorId[]
  equippedEnergyConverter: EnergyConverterId | null
  energyConverters: readonly EnergyConverterId[]
}

/** G08 Ship tab binds this. Pose is live transform; stats are the byte sheet. */
export interface ShipDebugPort {
  readonly position: { x: number; y: number; z: number }
  readonly rotation: { x: number; y: number; z: number }
  readonly stats: ShipStats
  readonly status: ShipStatus
  readonly loadout: ShipLoadout
}

export interface Inventory {
  count(id: ResourceId): number
  cap(id: ResourceId): number
  /** Returns the amount actually stored. Surplus above cap is rejected (RES-05). */
  tryAdd(id: ResourceId, amount: number): number
}

export interface ShipOptions {
  readonly visual: ShipVisual
  readonly thruster: ThrusterVisual
  readonly inventoryCaps: Readonly<Record<ResourceId, number>>
}

function clonePool(src: { readonly current: number; readonly max: number }): BytePool {
  return { current: src.current, max: src.max }
}

class ShipStatusState implements ShipStatus {
  flickering = false
  dashing = false
  shooting = false

  get recovering(): boolean {
    return !this.shooting && !this.dashing && !this.flickering
  }
}

const RESOURCE_IDS: readonly ResourceId[] = [
  'metalScrap',
  'prismaticCrystal',
  'denseCore',
  'darkMatter',
]

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose()
    }
    return
  }
  material.dispose()
}

class WeaponMount implements WeaponSlot {
  readonly index: number
  private _equipped: WeaponId | null = null

  constructor(index: number) {
    this.index = index
  }

  get equipped(): WeaponId | null {
    return this._equipped
  }

  setEquipped(id: WeaponId | null): void {
    this._equipped = id
  }
}

class BombMount implements BombSlot {
  readonly index: number
  private _equipped: BombId | null = null
  private _charges = 0

  constructor(index: number) {
    this.index = index
  }

  get equipped(): BombId | null {
    return this._equipped
  }

  get charges(): number {
    return this._charges
  }

  setOrdnance(id: BombId | null, charges: number): void {
    this._equipped = id
    this._charges = id === null ? 0 : charges
  }
}

class ShipInventory implements Inventory {
  private readonly _counts: Record<ResourceId, number>
  private readonly _caps: Readonly<Record<ResourceId, number>>

  constructor(caps: Readonly<Record<ResourceId, number>>) {
    this._caps = caps
    this._counts = {
      metalScrap: 0,
      prismaticCrystal: 0,
      denseCore: 0,
      darkMatter: 0,
    }
  }

  count(id: ResourceId): number {
    return this._counts[id]
  }

  cap(id: ResourceId): number {
    return this._caps[id]
  }

  tryAdd(id: ResourceId, amount: number): number {
    if (!(RESOURCE_IDS as readonly string[]).includes(id) || amount <= 0) {
      return 0
    }
    const room = this._caps[id] - this._counts[id]
    if (room <= 0) {
      return 0
    }
    const accepted = Math.min(room, amount)
    this._counts[id] += accepted
    return accepted
  }
}

export class Ship extends Group {
  readonly transform: ShipTransform
  readonly inventory: Inventory
  readonly weaponTip: Mesh
  readonly stats: ShipStats
  private readonly _status: ShipStatusState
  private readonly _loadout: ShipLoadout
  private readonly _debugPort: ShipDebugPort
  private readonly _hardpoints: readonly WeaponMount[]
  private readonly _ordnance: readonly BombMount[]
  private _equipment: readonly Equipment[]
  private readonly _thruster: Mesh
  private readonly _hull: Mesh
  private readonly _accent: Mesh
  private _flickerTime = 0
  private _flickerRemainMs = 0
  private _dashRemainMs = 0
  private _shootRemainMs = 0
  private _disposed = false

  constructor(options: ShipOptions) {
    super()

    const { visual, thruster } = options
    const src = BALANCE.ship.transform
    this.transform = {
      position: { x: src.position.x, y: src.position.y, z: src.position.z },
      rotation: { x: src.rotation.x, y: src.rotation.y, z: src.rotation.z },
      scale: src.scale,
    }

    const pools = BALANCE.ship.stats
    this.stats = {
      agility: clonePool(pools.agility),
      deflection: clonePool(pools.deflection),
      integrity: clonePool(pools.integrity),
      shield: clonePool(pools.shield),
      precision: clonePool(pools.precision),
      energy: clonePool(pools.energy),
    }
    this._status = new ShipStatusState()
    this._loadout = {
      equippedWeapon: null,
      weapons: [...BALANCE.weapons.loadout],
      equippedBomb: null,
      bombs: [],
      equippedWings: null,
      wings: [],
      equippedShield: null,
      shields: [],
      equippedArmor: null,
      armors: [],
      equippedEnergyCollector: null,
      energyCollectors: [],
      equippedEnergyConverter: null,
      energyConverters: [],
    }
    this._debugPort = {
      position: this.transform.position,
      rotation: this.transform.rotation,
      stats: this.stats,
      status: this._status,
      loadout: this._loadout,
    }

    this._hardpoints = Object.freeze([new WeaponMount(0)])
    this._ordnance = Object.freeze([new BombMount(0)])
    this._equipment = Object.freeze([])
    this.inventory = new ShipInventory(options.inventoryCaps)
    this.setFlickering(true)

    const hullGeo = new BoxGeometry(visual.size.w, visual.size.h, visual.size.d)
    const hullMat = new MeshBasicMaterial({
      color: visual.wireframeColor,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    })
    this._hull = new Mesh(hullGeo, hullMat)

    const accentGeo = new BoxGeometry(
      visual.size.w * 0.82,
      visual.size.h * 0.82,
      visual.size.d * 0.82,
    )
    const accentMat = new MeshBasicMaterial({
      color: visual.accentColor,
      transparent: true,
      opacity: 0.45,
    })
    this._accent = new Mesh(accentGeo, accentMat)

    const thrusterGeo = new ConeGeometry(thruster.width, thruster.length, 8)
    thrusterGeo.rotateX(Math.PI / 2)
    const thrusterMat = new MeshBasicMaterial({
      color: visual.thrusterColor,
      transparent: true,
      opacity: 0.85,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this._thruster = new Mesh(thrusterGeo, thrusterMat)
    this._thruster.position.set(0, thruster.position.y, visual.size.d / 2)

    const tipGeo = new SphereGeometry(1, 16, 12)
    const tipMat = new MeshBasicMaterial({
      color: visual.wireframeColor,
      transparent: true,
      opacity: 0.95,
    })
    this.weaponTip = new Mesh(tipGeo, tipMat)
    this.weaponTip.position.set(0, 0, -(visual.size.d / 2 + 0.25))
    this.weaponTip.scale.setScalar(0.12)

    this.add(this._hull, this._accent, this._thruster, this.weaponTip)
  }

  get hardpoints(): readonly WeaponSlot[] {
    return this._hardpoints
  }

  get ordnance(): readonly BombSlot[] {
    return this._ordnance
  }

  get equipment(): readonly Equipment[] {
    return this._equipment
  }

  get status(): ShipStatus {
    return this._status
  }

  get loadout(): ShipLoadout {
    this._refreshLoadout()
    return this._loadout
  }

  applyTransform(transform: ShipTransform): void {
    this.transform.position.x = transform.position.x
    this.transform.position.y = transform.position.y
    this.transform.position.z = transform.position.z
    this.transform.rotation.x = transform.rotation.x
    this.transform.rotation.y = transform.rotation.y
    this.transform.rotation.z = transform.rotation.z
    this.transform.scale = transform.scale
  }

  setEquippedWeapon(color: number, radius: number): void {
    const mat = this.weaponTip.material
    if (!Array.isArray(mat) && mat instanceof MeshBasicMaterial) {
      mat.color.setHex(color)
    }
    this.weaponTip.scale.setScalar(Math.max(0.03, radius))
  }

  equipWeapon(slotIndex: number, id: WeaponId): void {
    this._hardpoints[slotIndex]?.setEquipped(id)
  }

  unequipWeapon(slotIndex: number): void {
    this._hardpoints[slotIndex]?.setEquipped(null)
  }

  equipBomb(slotIndex: number, id: BombId, charges: number): void {
    this._ordnance[slotIndex]?.setOrdnance(id, charges)
  }

  unequipBomb(slotIndex: number): void {
    this._ordnance[slotIndex]?.setOrdnance(null, 0)
  }

  attachEquipment(item: Equipment): void {
    this._equipment = Object.freeze(this._equipment.concat(item))
  }

  detachEquipment(id: string): void {
    this._equipment = Object.freeze(this._equipment.filter((item) => item.id !== id))
  }

  setDashing(value: boolean): void {
    this._pulse('dashing', value, BALANCE.ship.cooldowns.dashingMs)
  }

  setShooting(value: boolean): void {
    this._pulse('shooting', value, BALANCE.ship.cooldowns.shootingMs)
  }

  setFlickering(value: boolean): void {
    this._pulse('flickering', value, BALANCE.ship.cooldowns.flickeringMs)
  }

  debugSnapshot(): ShipDebugPort {
    this._refreshLoadout()
    return this._debugPort
  }

  update(dt: number): void {
    this._flickerTime += dt
    const dtMs = dt * 1000
    this._flickerRemainMs = this._tickFlag('flickering', this._flickerRemainMs, dtMs)
    this._dashRemainMs = this._tickFlag('dashing', this._dashRemainMs, dtMs)
    this._shootRemainMs = this._tickFlag('shooting', this._shootRemainMs, dtMs)
  }

  syncRender(): void {
    const pose = this.transform
    this.position.set(pose.position.x, pose.position.y, pose.position.z)
    this.rotation.set(
      pose.rotation.x * DEG2RAD,
      pose.rotation.y * DEG2RAD,
      pose.rotation.z * DEG2RAD,
    )
    this.scale.setScalar(pose.scale)
    const t = this._flickerTime
    const flicker = 0.72 + 0.28 * Math.sin(t * 42) * Math.sin(t * 13 + 1.3)
    this._thruster.scale.set(1, flicker, 1)
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this._disposeMesh(this._hull)
    this._disposeMesh(this._accent)
    this._disposeMesh(this._thruster)
    this._disposeMesh(this.weaponTip)
    this.clear()
  }

  private _disposeMesh(mesh: Mesh): void {
    mesh.geometry.dispose()
    disposeMaterial(mesh.material)
  }

  private _refreshLoadout(): void {
    this._loadout.equippedWeapon = this._hardpoints[0]?.equipped ?? null
    this._loadout.equippedBomb = this._ordnance[0]?.equipped ?? null
  }

  private _pulse(flag: 'flickering' | 'dashing' | 'shooting', on: boolean, durationMs: number): void {
    if (!on) {
      this._status[flag] = false
      if (flag === 'flickering') {
        this._flickerRemainMs = 0
      } else if (flag === 'dashing') {
        this._dashRemainMs = 0
      } else {
        this._shootRemainMs = 0
      }
      return
    }
    this._status[flag] = true
    if (flag === 'flickering') {
      this._flickerRemainMs = durationMs
    } else if (flag === 'dashing') {
      this._dashRemainMs = durationMs
    } else {
      this._shootRemainMs = durationMs
    }
  }

  private _tickFlag(
    flag: 'flickering' | 'dashing' | 'shooting',
    remainMs: number,
    dtMs: number,
  ): number {
    if (remainMs <= 0) {
      return 0
    }
    const next = remainMs - dtMs
    if (next <= 0) {
      this._status[flag] = false
      return 0
    }
    return next
  }
}
