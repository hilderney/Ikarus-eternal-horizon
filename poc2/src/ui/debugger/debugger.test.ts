// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyWeaponConfig, WEAPONS, type WeaponId } from '../../gameobjects/weapon/catalog'
import {
  applyWeaponLevel,
  patchWeaponStat,
  weaponLevelSnapshot,
} from '../../gameobjects/weapon/weapon-levels'
import type { DebuggerBinds, DebuggerShipBind } from './debugger'
import { Debugger } from './debugger'
import { CamTab } from './cam-tab'
import { EquipsTab } from './equips-tab'
import { EnemyTab } from './enemy-tab'
import { ShipTab } from './ship-tab'
import { SpawnAreaTab } from './spawn-area-tab'
import { ParallaxTab } from './parallax-tab'
import type { ParallaxLayerConfig } from '../../gameobjects/parallax/parallax-layer'
import { cloneWarriorSheet, warriorMaxSpeed, WARRIOR } from '../../gameobjects/enemy/warrior'
import shipTabSource from './ship-tab.ts?raw'
import equipsTabSource from './equips-tab.ts?raw'

interface LiveSheet {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  stats: {
    agility: { current: number; max: number }
    deflection: { current: number; max: number }
    integrity: { current: number; max: number }
    shield: { current: number; max: number }
    precision: { current: number; max: number }
    energy: { current: number; max: number }
  }
  status: { flickering: boolean; dashing: boolean; shooting: boolean; recovering: boolean }
  loadout: {
    equippedWeapon: string | null
    weapons: string[]
    equippedBomb: string | null
    bombs: string[]
    equippedWings: string | null
    wings: string[]
    equippedShield: string | null
    shields: string[]
    equippedArmor: string | null
    armors: string[]
    equippedEnergyCollector: string | null
    energyCollectors: string[]
    equippedEnergyConverter: string | null
    energyConverters: string[]
  }
}

function pool(): { current: number; max: number } {
  return { current: 100, max: 100 }
}

function makeSheet(): LiveSheet {
  return {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 12, z: -8 },
    stats: {
      agility: pool(),
      deflection: pool(),
      integrity: pool(),
      shield: pool(),
      precision: pool(),
      energy: pool(),
    },
    status: { flickering: false, dashing: false, shooting: false, recovering: true },
    loadout: {
      equippedWeapon: 'laser',
      weapons: ['laser', 'plasma'],
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
    },
  }
}

function makeBinds(sheet: LiveSheet): DebuggerBinds {
  let shooting = false
  let weaponLevel = 1
  let dashLevel = 1
  let activeWeapon: WeaponId = (sheet.loadout.equippedWeapon as WeaponId) ?? 'laser'
  let weaponConfig = copyWeaponConfig(WEAPONS[activeWeapon])
  applyWeaponLevel(weaponConfig, weaponLevel)
  const enemySheet = cloneWarriorSheet(WARRIOR)
  let spawnLeft = {
    offset: { x: -140, y: 0, z: -140 },
    size: { x: 10, y: 2, z: 10 },
    intervalSec: 3,
    lanesX: [-4, -2, 0, 2, 4],
    maxActive: 1,
    visible: true,
    color: 0xff2222,
    opacity: 0.55,
  }
  let spawnRight = {
    offset: { x: 140, y: 0, z: -140 },
    size: { x: 10, y: 2, z: 10 },
    intervalSec: 3,
    lanesX: [-4, -2, 0, 2, 4],
    maxActive: 1,
    visible: true,
    color: 0xff2222,
    opacity: 0.55,
  }
  let spawnFront = {
    offset: { x: 0, y: 0, z: -140 },
    size: { x: 10, y: 2, z: 10 },
    intervalSec: 3,
    lanesX: [-4, -2, 0, 2, 4],
    maxActive: 1,
    visible: true,
    color: 0xff2222,
    opacity: 0.55,
  }
  let spawnGate = {
    offset: { x: 0, y: 0, z: -90 },
    size: { x: 60, y: 2, z: 8 },
    intervalSec: 0,
    lanesX: [] as number[],
    maxActive: 0,
    visible: true,
    color: 0xf59e0b,
    opacity: 0.55,
  }
  const sideAt = (side: number) => {
    if (side === 1) {
      return spawnRight
    }
    if (side === 2) {
      return spawnFront
    }
    if (side === 3) {
      return spawnGate
    }
    return spawnLeft
  }
  const setSide = (side: number, next: typeof spawnLeft): void => {
    if (side === 1) {
      spawnRight = next
    } else if (side === 2) {
      spawnFront = next
    } else if (side === 3) {
      spawnGate = next
    } else {
      spawnLeft = next
    }
  }
  const parallaxLayers: ParallaxLayerConfig[] = [
    {
      name: 'background_stars',
      count: 10,
      speed: 0.2,
      speedJitter: 0.5,
      parallaxGain: 0.01,
      size: 1,
      color: 0xa5e8ff,
      alpha: 0.5,
      position: { x: 0, y: -600, z: 100 },
      rotation: { x: 0, y: 0, z: 0 },
      gridSize: 1000,
      gridColor: 0x555555,
      gridOpacity: 0,
      zNearWrap: 0,
      zFar: -2000,
    },
    {
      name: 'debris',
      count: 8,
      speed: 1,
      speedJitter: 0.5,
      parallaxGain: 0.3,
      size: 1,
      color: 0x7c68ff,
      alpha: 0.5,
      position: { x: 0, y: -150, z: 100 },
      rotation: { x: 0, y: 0, z: 0 },
      gridSize: 1000,
      gridColor: 0x555555,
      gridOpacity: 0,
      zNearWrap: 0,
      zFar: -2000,
    },
  ]
  const parallaxVisible = [true, true]
  const cameraLive = {
    fov: 110,
    position: { x: 3, y: 14, z: 6 },
    rotation: { x: -55, y: 24, z: -14 },
    near: 5,
    far: 10000,
    moveSpeed: 12,
    rotSpeed: 45,
  }
  let cameraApplyCount = 0
  const recenterLive = {
    position: { x: 0, y: 0, z: -1 },
    width: 2,
    height: 4,
    visible: true,
  }
  const refreshRecovering = (): void => {
    sheet.status.recovering = !shooting && !sheet.status.dashing && !sheet.status.flickering
  }
  const ship: DebuggerShipBind = {
    snapshot: () => sheet,
    applyTransform: vi.fn(),
    setFlickering(value) {
      sheet.status.flickering = value
      refreshRecovering()
    },
    setDashing(value) {
      sheet.status.dashing = value
      refreshRecovering()
    },
    setShooting(value) {
      shooting = value
      sheet.status.shooting = value
      refreshRecovering()
    },
    equipWeapon(id) {
      sheet.loadout.equippedWeapon = id
      if (id) {
        activeWeapon = id as WeaponId
        weaponConfig = copyWeaponConfig(WEAPONS[activeWeapon])
        applyWeaponLevel(weaponConfig, weaponLevel)
      }
    },
    equipBomb(id) {
      sheet.loadout.equippedBomb = id
    },
    equipWings(id) {
      sheet.loadout.equippedWings = id
    },
    equipShield(id) {
      sheet.loadout.equippedShield = id
    },
    equipArmor(id) {
      sheet.loadout.equippedArmor = id
    },
    equipEnergyCollector(id) {
      sheet.loadout.equippedEnergyCollector = id
    },
    equipEnergyConverter(id) {
      sheet.loadout.equippedEnergyConverter = id
    },
  }
  return {
    ship,
    weapons: {
      level: () => weaponLevel,
      setLevel(level) {
        weaponLevel = level
        applyWeaponLevel(weaponConfig, level)
      },
      activeId: () => activeWeapon,
      stats: () => weaponLevelSnapshot(weaponConfig),
      patchStat(field, value) {
        patchWeaponStat(weaponConfig, field, value)
      },
    },
    dash: {
      level: () => dashLevel,
      setLevel(level) {
        dashLevel = level
      },
    },
    spawnArea: {
      sideNames: () => ['left', 'right', 'front', 'gate'],
      offset: (side) => ({ ...sideAt(side).offset }),
      size: (side) => ({ ...sideAt(side).size }),
      worldCenter: (side) => ({ ...sideAt(side).offset }),
      intervalSec: (side) => sideAt(side).intervalSec,
      lanesX: (side) => [...sideAt(side).lanesX],
      maxActive: (side) => sideAt(side).maxActive,
      visible: (side) => sideAt(side).visible,
      color: (side) => sideAt(side).color,
      opacity: (side) => sideAt(side).opacity,
      setOffset(side, x, y, z) {
        setSide(side, { ...sideAt(side), offset: { x, y, z } })
      },
      setSize(side, x, y, z) {
        setSide(side, { ...sideAt(side), size: { x, y, z } })
      },
      setIntervalSec(side, value) {
        setSide(side, { ...sideAt(side), intervalSec: value })
      },
      setLanesX(side, lanes) {
        setSide(side, { ...sideAt(side), lanesX: [...lanes] })
      },
      setMaxActive(side, value) {
        setSide(side, { ...sideAt(side), maxActive: value })
      },
      setVisible(side, visible) {
        setSide(side, { ...sideAt(side), visible })
      },
      setColor(side, hex) {
        setSide(side, { ...sideAt(side), color: hex })
      },
      setOpacity(side, value) {
        setSide(side, { ...sideAt(side), opacity: value })
      },
    },
    enemy: {
      archetypeNames: () => ['warrior'],
      setArchetype() {
        /* only warrior in G0 */
      },
      sheet: () => enemySheet,
      applyToActive() {
        /* stub — no live enemies in unit host */
      },
      resetSheet(defaults) {
        const src = defaults ?? cloneWarriorSheet(WARRIOR)
        enemySheet.name = src.name
        enemySheet.hp = src.hp
        enemySheet.radius = src.radius
        enemySheet.color = src.color
        enemySheet.contactDamage = src.contactDamage
        enemySheet.maxSpeed = warriorMaxSpeed(src.agility)
        enemySheet.agility = src.agility
        enemySheet.intelligence = src.intelligence
        enemySheet.reachSpeedMul = src.reachSpeedMul
        enemySheet.targets = [...src.targets]
        Object.assign(enemySheet.weapon, src.weapon)
        Object.assign(enemySheet.status, src.status)
        enemySheet.strategy.swapBaseMs = src.strategy.swapBaseMs
        enemySheet.strategy.turnRateDeg = src.strategy.turnRateDeg
        Object.assign(enemySheet.strategy.weights, src.strategy.weights)
        Object.assign(enemySheet.strategy.mods.hitted, src.strategy.mods.hitted)
        Object.assign(enemySheet.strategy.mods.hitting, src.strategy.mods.hitting)
        Object.assign(enemySheet.strategy.mods.in_range, src.strategy.mods.in_range)
        Object.assign(enemySheet.strategy.mods.passed_opponent, src.strategy.mods.passed_opponent)
        Object.assign(enemySheet.strategy.loopAround, src.strategy.loopAround)
      },
      liveStatus() {
        return null
      },
    },
    parallax: {
      layerCount: () => parallaxLayers.length,
      layerNames: () => parallaxLayers.map((layer) => layer.name),
      config(index) {
        const layer = parallaxLayers[index]
        return layer
          ? {
              ...layer,
              position: { ...layer.position },
              rotation: { ...layer.rotation },
            }
          : null
      },
      applyConfig(index, config) {
        if (index < 0 || index >= parallaxLayers.length) {
          return
        }
        parallaxLayers[index] = {
          ...config,
          position: { ...config.position },
          rotation: { ...config.rotation },
        }
      },
      visible(index) {
        return parallaxVisible[index] ?? false
      },
      setVisible(index, visible) {
        if (index >= 0 && index < parallaxVisible.length) {
          parallaxVisible[index] = visible
        }
      },
    },
    camera: {
      fov: () => cameraLive.fov,
      setFov: (value) => {
        cameraLive.fov = value
      },
      position: () => cameraLive.position,
      setPosition: (x, y, z) => {
        cameraLive.position.x = x
        cameraLive.position.y = y
        cameraLive.position.z = z
      },
      rotation: () => cameraLive.rotation,
      setRotation: (x, y, z) => {
        cameraLive.rotation.x = x
        cameraLive.rotation.y = y
        cameraLive.rotation.z = z
      },
      near: () => cameraLive.near,
      setNear: (value) => {
        cameraLive.near = value
      },
      far: () => cameraLive.far,
      setFar: (value) => {
        cameraLive.far = value
      },
      moveSpeed: () => cameraLive.moveSpeed,
      setMoveSpeed: (value) => {
        cameraLive.moveSpeed = value
      },
      rotSpeed: () => cameraLive.rotSpeed,
      setRotSpeed: (value) => {
        cameraLive.rotSpeed = value
      },
      apply() {
        cameraApplyCount += 1
      },
    },
    recenterPoint: {
      position: () => recenterLive.position,
      setPosition: (x, y, z) => {
        recenterLive.position.x = x
        recenterLive.position.y = y
        recenterLive.position.z = z
      },
      width: () => recenterLive.width,
      setWidth: (value) => {
        recenterLive.width = value
      },
      height: () => recenterLive.height,
      setHeight: (value) => {
        recenterLive.height = value
      },
      visible: () => recenterLive.visible,
      setVisible: (visible) => {
        recenterLive.visible = visible
      },
    },
  }
}

function bind(host: HTMLElement, path: string, kind: string = 'range'): HTMLInputElement {
  const el = host.querySelector<HTMLInputElement>(`input[type="${kind}"][data-bind="${path}"]`)
  if (!el) {
    throw new Error(`missing ${kind} for ${path}`)
  }
  return el
}

function selectBind(host: HTMLElement, path: string): HTMLSelectElement {
  const el = host.querySelector<HTMLSelectElement>(`select[data-bind="${path}"]`)
  if (!el) {
    throw new Error(`missing select for ${path}`)
  }
  return el
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('Debugger', () => {
  it('mounts the Ship tab first (id ship)', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const binds = makeBinds(makeSheet())
    const dbg = new Debugger({
      host,
      binds,
      tabs: [new ShipTab(binds)],
      enabled: true,
    })
    const panel = host.querySelector('.debug-tabpanel')
    expect(panel?.getAttribute('data-tab')).toBe('ship')
    expect(host.querySelector('.debug-tabs label')?.textContent).toBe('Ship')
    expect(host.querySelector('.debug-panel')).not.toBeNull()
    dbg.dispose()
  })

  it('mounts Equips as the second tab', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const binds = makeBinds(makeSheet())
    const dbg = new Debugger({
      host,
      binds,
      tabs: [new ShipTab(binds), new EquipsTab(binds)],
      enabled: true,
    })
    const labels = [...host.querySelectorAll('.debug-tabs label')].map((el) => el.textContent)
    expect(labels).toEqual(['Ship', 'Equips'])
    expect(host.querySelector('[data-tab="equips"]')).not.toBeNull()
    dbg.dispose()
  })

  it('enabled:false mounts nothing and no-ops sync/reset', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const binds = makeBinds(makeSheet())
    const dbg = new Debugger({
      host,
      binds,
      tabs: [new ShipTab(binds)],
      enabled: false,
    })
    expect(host.childElementCount).toBe(0)
    expect(() => {
      dbg.sync()
      dbg.reset()
    }).not.toThrow()
    dbg.dispose()
    expect(host.childElementCount).toBe(0)
  })

  it('dispose removes the panel from the host', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const binds = makeBinds(makeSheet())
    const dbg = new Debugger({
      host,
      binds,
      tabs: [new ShipTab(binds)],
      enabled: true,
    })
    expect(host.querySelector('.debug-panel')).not.toBeNull()
    dbg.dispose()
    expect(host.querySelector('.debug-panel')).toBeNull()
    expect(host.childElementCount).toBe(0)
  })
})

describe('ShipTab', () => {
  function mountTab(sheet = makeSheet()): {
    host: HTMLElement
    sheet: LiveSheet
    binds: DebuggerBinds
    tab: ShipTab
  } {
    const host = document.createElement('div')
    document.body.append(host)
    const binds = makeBinds(sheet)
    const tab = new ShipTab(binds)
    tab.mount(host)
    return { host, sheet, binds, tab }
  }

  it('shows position and rotation from ShipDebugPort', () => {
    const { host, sheet } = mountTab()
    expect(bind(host, 'position.x', 'number').value).toBe(String(sheet.position.x))
    expect(bind(host, 'position.y', 'number').value).toBe(String(sheet.position.y))
    expect(bind(host, 'position.z', 'number').value).toBe(String(sheet.position.z))
    expect(bind(host, 'rotation.x', 'number').value).toBe(String(sheet.rotation.x))
    expect(bind(host, 'rotation.y', 'number').value).toBe(String(sheet.rotation.y))
    expect(bind(host, 'rotation.z', 'number').value).toBe(String(sheet.rotation.z))
  })

  it('shows agility/deflection/integrity/shield/precision/energy 0–255', () => {
    const { host } = mountTab()
    for (const name of ['agility', 'deflection', 'integrity', 'shield', 'precision', 'energy']) {
      const current = bind(host, `stats.${name}.current`)
      const max = bind(host, `stats.${name}.max`)
      expect(current.min).toBe('0')
      expect(current.max).toBe('255')
      expect(current.value).toBe('100')
      expect(max.value).toBe('100')
    }
  })

  it('shows flickering, dashing, shooting, recovering flags', () => {
    const { host, sheet } = mountTab()
    expect(bind(host, 'status.flickering', 'checkbox').checked).toBe(sheet.status.flickering)
    expect(bind(host, 'status.dashing', 'checkbox').checked).toBe(sheet.status.dashing)
    expect(bind(host, 'status.shooting', 'checkbox').checked).toBe(sheet.status.shooting)
    expect(bind(host, 'status.recovering', 'checkbox').checked).toBe(sheet.status.recovering)
  })

  it('does not host loadout controls (Equips tab owns them)', () => {
    const { host } = mountTab()
    expect(host.querySelector('[data-bind="loadout.equippedWeapon"]')).toBeNull()
    expect(host.querySelector('[data-bind="weapons.level"]')).toBeNull()
  })

  it('writes a slider change into the bound stats pool immediately', () => {
    const { host, sheet } = mountTab()
    const slider = bind(host, 'stats.integrity.current')
    slider.value = '40'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    expect(sheet.stats.integrity.current).toBe(40)
  })

  it('sync skips the focused slider', () => {
    const { host, sheet, tab } = mountTab()
    const slider = bind(host, 'stats.integrity.current')
    slider.focus()
    slider.value = '33'
    sheet.stats.integrity.current = 10
    tab.sync()
    expect(slider.value).toBe('33')
    slider.blur()
    tab.sync()
    expect(slider.value).toBe('10')
  })

  it('reset restores mount-time ship sheet defaults', () => {
    const { host, sheet, tab } = mountTab()
    sheet.stats.integrity.current = 12
    sheet.position.x = 9
    const slider = bind(host, 'stats.integrity.current')
    slider.value = '12'
    tab.reset()
    expect(sheet.stats.integrity.current).toBe(100)
    expect(sheet.position.x).toBe(1)
    expect(slider.value).toBe('100')
  })

  it('does not import CamTab or invent a second number table', () => {
    expect(shipTabSource).not.toMatch(/CamTab|cam-tab/)
    expect(shipTabSource).toMatch(/snapshot\(\)/)
  })
})

describe('EquipsTab', () => {
  function mountTab(sheet = makeSheet()): {
    host: HTMLElement
    sheet: LiveSheet
    binds: DebuggerBinds
    tab: EquipsTab
  } {
    const host = document.createElement('div')
    document.body.append(host)
    const binds = makeBinds(sheet)
    const tab = new EquipsTab(binds)
    tab.mount(host)
    return { host, sheet, binds, tab }
  }

  it('shows equippedWeapon and the weapons list', () => {
    const { host, sheet } = mountTab()
    expect(selectBind(host, 'loadout.equippedWeapon').value).toBe('laser')
    expect(bind(host, 'loadout.weapons', 'text').value).toBe(sheet.loadout.weapons.join(', '))
  })

  it('shows bomb/wings/shield-fit/armor/collector/converter equipped+list', () => {
    const { host } = mountTab()
    expect(selectBind(host, 'loadout.equippedBomb').value).toBe('')
    expect(bind(host, 'loadout.bombs', 'text').value).toBe('')
    expect(selectBind(host, 'loadout.equippedWings').value).toBe('')
    expect(bind(host, 'loadout.wings', 'text').value).toBe('')
    expect(selectBind(host, 'loadout.equippedShield').value).toBe('')
    expect(bind(host, 'loadout.shields', 'text').value).toBe('')
    expect(selectBind(host, 'loadout.equippedArmor').value).toBe('')
    expect(bind(host, 'loadout.armors', 'text').value).toBe('')
    expect(selectBind(host, 'loadout.equippedEnergyCollector').value).toBe('')
    expect(bind(host, 'loadout.energyCollectors', 'text').value).toBe('')
    expect(selectBind(host, 'loadout.equippedEnergyConverter').value).toBe('')
    expect(bind(host, 'loadout.energyConverters', 'text').value).toBe('')
  })

  it('shows equipped weapon level 1–12 from the live firing bind', () => {
    const { host, binds } = mountTab()
    const slider = bind(host, 'weapons.level')
    expect(slider.min).toBe('1')
    expect(slider.max).toBe('12')
    expect(slider.value).toBe('1')
    slider.value = '12'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binds.weapons.level()).toBe(12)
  })

  it('shows dash level 1–12 from the live controller bind', () => {
    const { host, binds } = mountTab()
    const slider = bind(host, 'dash.level')
    expect(slider.min).toBe('1')
    expect(slider.max).toBe('12')
    expect(slider.value).toBe('1')
    slider.value = '12'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binds.dash.level()).toBe(12)
  })

  it('writes equippedWeapon into the ship bind', () => {
    const { host, sheet } = mountTab()
    const select = selectBind(host, 'loadout.equippedWeapon')
    select.value = 'plasma'
    select.dispatchEvent(new Event('input', { bubbles: true }))
    expect(sheet.loadout.equippedWeapon).toBe('plasma')
  })

  it('reset restores mount-time loadout and weapon level', () => {
    const { host, sheet, binds, tab } = mountTab()
    sheet.loadout.equippedWeapon = 'plasma'
    binds.weapons.setLevel(8)
    binds.dash.setLevel(8)
    tab.reset()
    expect(sheet.loadout.equippedWeapon).toBe('laser')
    expect(binds.weapons.level()).toBe(1)
    expect(binds.dash.level()).toBe(1)
    expect(selectBind(host, 'loadout.equippedWeapon').value).toBe('laser')
    expect(bind(host, 'weapons.level').value).toBe('1')
    expect(bind(host, 'dash.level').value).toBe('1')
  })

  it('does not import ShipTab form groups', () => {
    expect(equipsTabSource).not.toMatch(/status\.flickering|stats\.energy/)
    expect(equipsTabSource).toMatch(/snapshot\(\)/)
  })
})

describe('SpawnAreaTab', () => {
  it('edits left/right spawn offset and toggles visibility', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const binds = makeBinds(makeSheet())
    const dbg = new Debugger({
      host,
      binds,
      tabs: [new SpawnAreaTab(binds)],
      enabled: true,
    })
    expect(host.querySelector('[data-tab="spawn-area"]')).not.toBeNull()
    const z = bind(host, 'offset.z', 'number')
    z.value = '-20'
    z.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binds.spawnArea.offset(0).z).toBe(-20)
    const sideSelect = selectBind(host, 'spawn.side')
    sideSelect.value = '1'
    sideSelect.dispatchEvent(new Event('change', { bubbles: true }))
    const x = bind(host, 'offset.x', 'number')
    x.value = '120'
    x.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binds.spawnArea.offset(1).x).toBe(120)
    const visible = host.querySelector<HTMLInputElement>('input[data-bind="spawn.visible"]')
    expect(visible).not.toBeNull()
    if (visible) {
      visible.checked = false
      visible.dispatchEvent(new Event('input', { bubbles: true }))
      expect(binds.spawnArea.visible(1)).toBe(false)
    }
    dbg.dispose()
  })

  it('includes gate side and edits its opacity', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const binds = makeBinds(makeSheet())
    const dbg = new Debugger({
      host,
      binds,
      tabs: [new SpawnAreaTab(binds)],
      enabled: true,
    })
    expect(binds.spawnArea.sideNames()).toContain('gate')
    const sideSelect = selectBind(host, 'spawn.side')
    sideSelect.value = '3'
    sideSelect.dispatchEvent(new Event('change', { bubbles: true }))
    const cadence = host.querySelector<HTMLElement>('.debug-cadence')
    expect(cadence?.hidden).toBe(true)
    const opacity = bind(host, 'opacity', 'number')
    opacity.value = '0.4'
    opacity.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binds.spawnArea.opacity(3)).toBe(0.4)
    dbg.dispose()
  })
})

describe('CamTab', () => {
  it('edits camera fov/position and recenter gizmo live', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const binds = makeBinds(makeSheet())
    const dbg = new Debugger({
      host,
      binds,
      tabs: [new CamTab(binds)],
      enabled: true,
    })
    expect(host.querySelector('[data-tab="cam"]')).not.toBeNull()
    const fov = bind(host, 'camera.fov', 'number')
    fov.value = '90'
    fov.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binds.camera.fov()).toBe(90)
    const px = bind(host, 'camera.position.x', 'number')
    px.value = '8'
    px.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binds.camera.position().x).toBe(8)
    const width = bind(host, 'recenter.width', 'number')
    width.value = '5'
    width.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binds.recenterPoint.width()).toBe(5)
    const visible = host.querySelector<HTMLInputElement>('input[data-bind="recenter.visible"]')
    expect(visible).not.toBeNull()
    if (visible) {
      visible.checked = false
      visible.dispatchEvent(new Event('input', { bubbles: true }))
      expect(binds.recenterPoint.visible()).toBe(false)
    }
    dbg.dispose()
  })

  it('reset restores camera and recenter defaults', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const binds = makeBinds(makeSheet())
    const tab = new CamTab(binds)
    tab.mount(host)
    binds.camera.setFov(42)
    binds.camera.setPosition(1, 2, 3)
    binds.recenterPoint.setWidth(9)
    binds.recenterPoint.setVisible(false)
    tab.reset()
    expect(binds.camera.fov()).toBe(110)
    expect(binds.camera.position()).toEqual({ x: 3, y: 14, z: 6 })
    expect(binds.recenterPoint.width()).toBe(2)
    expect(binds.recenterPoint.visible()).toBe(true)
    tab.dispose()
  })
})

describe('EnemyTab', () => {
  it('edits Warrior sheet hp live without touching ship pose', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const sheet = makeSheet()
    const poseX = sheet.position.x
    const binds = makeBinds(sheet)
    const dbg = new Debugger({
      host,
      binds,
      tabs: [new EnemyTab(binds)],
      enabled: true,
    })
    expect(host.querySelector('[data-tab="enemy"]')).not.toBeNull()
    const hp = bind(host, 'hp', 'number')
    hp.value = '9'
    hp.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binds.enemy.sheet().hp).toBe(9)
    expect(sheet.position.x).toBe(poseX)
    dbg.dispose()
  })
})

describe('ParallaxTab', () => {
  it('edits layer speed and toggles visibility live', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const binds = makeBinds(makeSheet())
    const dbg = new Debugger({
      host,
      binds,
      tabs: [new ParallaxTab(binds)],
      enabled: true,
    })
    expect(host.querySelector('[data-tab="parallax"]')).not.toBeNull()
    const speed = bind(host, 'speed', 'number')
    speed.value = '4.5'
    speed.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binds.parallax.config(0)?.speed).toBe(4.5)
    const visible = host.querySelector<HTMLInputElement>('input[data-bind="parallax.visible"]')
    expect(visible).not.toBeNull()
    if (visible) {
      visible.checked = false
      visible.dispatchEvent(new Event('input', { bubbles: true }))
      expect(binds.parallax.visible(0)).toBe(false)
    }
    const layerSelect = selectBind(host, 'parallax.layer')
    layerSelect.value = '1'
    layerSelect.dispatchEvent(new Event('change', { bubbles: true }))
    expect(binds.parallax.config(1)?.name).toBe('debris')
    dbg.dispose()
  })
})
