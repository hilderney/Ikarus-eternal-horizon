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
import { EquipsTab } from './equips-tab'
import { ShipTab } from './ship-tab'
import { SpawnAreaTab } from './spawn-area-tab'
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
  let spawnOffset = { x: 0, y: 0, z: -14 }
  let spawnSize = { x: 16, y: 2, z: 12 }
  let spawnInterval = 1.6
  let spawnLanes = [-4, -2, 0, 2, 4]
  let spawnMaxActive = 1
  let spawnVisible = true
  let spawnColor = 0xff2222
  let spawnOpacity = 0.22
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
      offset: () => ({ ...spawnOffset }),
      size: () => ({ ...spawnSize }),
      worldCenter: () => ({
        x: spawnOffset.x,
        y: spawnOffset.y,
        z: spawnOffset.z,
      }),
      intervalSec: () => spawnInterval,
      lanesX: () => [...spawnLanes],
      maxActive: () => spawnMaxActive,
      visible: () => spawnVisible,
      color: () => spawnColor,
      opacity: () => spawnOpacity,
      setOffset(x, y, z) {
        spawnOffset = { x, y, z }
      },
      setSize(x, y, z) {
        spawnSize = { x, y, z }
      },
      setIntervalSec(value) {
        spawnInterval = value
      },
      setLanesX(lanes) {
        spawnLanes = [...lanes]
      },
      setMaxActive(value) {
        spawnMaxActive = value
      },
      setVisible(visible) {
        spawnVisible = visible
      },
      setColor(hex) {
        spawnColor = hex
      },
      setOpacity(value) {
        spawnOpacity = value
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
  it('edits spawn offset and toggles visibility', () => {
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
    const z = bind(host, 'offset.z')
    z.value = '-20'
    z.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binds.spawnArea.offset().z).toBe(-20)
    const visible = host.querySelector<HTMLInputElement>('input[data-bind="spawn.visible"]')
    expect(visible).not.toBeNull()
    if (visible) {
      visible.checked = false
      visible.dispatchEvent(new Event('input', { bubbles: true }))
      expect(binds.spawnArea.visible()).toBe(false)
    }
    dbg.dispose()
  })
})
