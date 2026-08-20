/**
 * SDD-C01 modular ship parts — catalog apply + airplane rig. Body (hull) stays the hitbox.
 */

import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { BALANCE } from '../../core/balancer'
import type { ModuleMount } from '../../core/balancer'
import type { ShipLoadout } from './ship'

export interface ModuleStatMods {
  agility: number
  deflection: number
  integrity: number
  shield: number
  energy: number
  energyGain: number
  labFusion: number
}

export interface ShipModuleParts {
  readonly group: Group
  readonly wings: readonly Mesh[]
  readonly shield: Mesh
  readonly bombs: readonly Mesh[]
  readonly collector: Mesh
  readonly converter: Mesh
}

function mountMesh(mount: ModuleMount, color: number, opacity: number, wireframe: boolean, slot: string): Mesh {
  const geo = new BoxGeometry(mount.size.w, mount.size.h, mount.size.d)
  const mat = new MeshBasicMaterial({
    color,
    wireframe,
    transparent: true,
    opacity,
  })
  const mesh = new Mesh(geo, mat)
  mesh.position.set(mount.position.x, mount.position.y, mount.position.z)
  mesh.userData.slot = slot
  return mesh
}

export function emptyModuleMods(): ModuleStatMods {
  return {
    agility: 0,
    deflection: 0,
    integrity: 0,
    shield: 0,
    energy: 0,
    energyGain: 0,
    labFusion: 0,
  }
}

export function moduleModsFor(loadout: ShipLoadout): ModuleStatMods {
  const mods = emptyModuleMods()
  const catalog = BALANCE.ship.modules
  const body = loadout.equippedArmor === null ? undefined : catalog.body[loadout.equippedArmor]
  if (body) {
    mods.integrity += body.integrity
    mods.energy += body.energy
  }
  const wings = loadout.equippedWings === null ? undefined : catalog.wings[loadout.equippedWings]
  if (wings) {
    mods.agility += wings.agility
    mods.deflection += wings.deflection
  }
  const shield = loadout.equippedShield === null ? undefined : catalog.shield[loadout.equippedShield]
  if (shield) {
    mods.shield += shield.shield
    mods.deflection += shield.deflection
  }
  const collector =
    loadout.equippedEnergyCollector === null ? undefined : catalog.collector[loadout.equippedEnergyCollector]
  if (collector) {
    mods.energyGain += collector.energyGain
  }
  const converter =
    loadout.equippedEnergyConverter === null ? undefined : catalog.converter[loadout.equippedEnergyConverter]
  if (converter) {
    mods.labFusion += converter.labFusion
  }
  return mods
}

export function createShipModules(colors: { readonly wire: number; readonly accent: number }): ShipModuleParts {
  const layout = BALANCE.ship.modules.layout
  const group = new Group()
  group.name = 'modules'
  const wings = layout.wings.map((mount) => mountMesh(mount, colors.wire, 0.85, true, 'wing'))
  const shield = mountMesh(layout.shield, colors.accent, 0.55, false, 'shield')
  const bombs = layout.bombs.map((mount) => mountMesh(mount, 0xf97316, 0.9, false, 'bomb'))
  const collector = mountMesh(layout.collector, 0x2dd4bf, 0.85, true, 'collector')
  const converter = mountMesh(layout.converter, 0x67e8f9, 0.7, false, 'converter')
  group.add(...wings, shield, ...bombs, collector, converter)
  return { group, wings, shield, bombs, collector, converter }
}

export function syncModuleVisibility(parts: ShipModuleParts, loadout: ShipLoadout): void {
  const wingsOn = loadout.equippedWings !== null
  for (const wing of parts.wings) {
    wing.visible = wingsOn
  }
  parts.shield.visible = loadout.equippedShield !== null
  const bombsOn = loadout.equippedBomb !== null
  for (const bomb of parts.bombs) {
    bomb.visible = bombsOn
  }
  parts.collector.visible = loadout.equippedEnergyCollector !== null
  parts.converter.visible = loadout.equippedEnergyConverter !== null
}
