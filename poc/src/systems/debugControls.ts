import type { CameraRig, CameraConfig } from '../gameobjects/cameraRig'
import type { Ship, ShipTransform } from '../gameobjects/ship'
import type { ParallaxLayerConfig } from '../gameobjects/parallax'
import type { WeaponId, WeaponConfig } from '../core/weaponsCatalog'
import { applyLaserLevel, LASER_LEVELS } from '../weapons/laserLevels'
import type { WeaponModifiers } from '../weapons/behaviour'
import type { EnergySystem } from './energy'
import type {
  ShipKeys,
  ShipMotionConfig,
  ShipTiltConfig,
  CameraControlConfig,
} from './controllers'

export interface DebugBinds {
  rig: CameraRig
  camera: CameraConfig
  ship: Ship
  shipTransform: ShipTransform
  parallax: ParallaxLayerConfig[]
  parallaxApply: () => void
  followBox: Vec3Like
  follow: {
    halfX: number
    halfZ: number
    bounce: { timeMs: number }
    recenter: { delayMs: number; stillMs: number; accel: number; maxSpeed: number }
  }
  recenterPoint: {
    position: Vec3Like
    width: number
    height: number
  }
  controls: {
    shipKeys: ShipKeys
    motion: ShipMotionConfig
    tilt: ShipTiltConfig
    camera: CameraControlConfig
  }
  weapons: {
    catalog: Record<WeaponId, WeaponConfig>
    loadout: WeaponId[]
    activeId(): WeaponId
    setActive(id: WeaponId): void
    mods: WeaponModifiers
    energy: EnergySystem
  }
}

interface Row {
  target: object
  key: string
  slider: HTMLInputElement
  spin: HTMLInputElement
  value: HTMLElement
  refresh: () => void
}

interface VecRow {
  target: Vec3Like
  key: 'x' | 'y' | 'z'
  input: HTMLInputElement
}

interface SelRow {
  target: object
  key: string
  select: HTMLSelectElement
}

interface Vec3Like {
  x: number
  y: number
  z: number
}

const read = (target: object, key: string): number =>
  (target as Record<string, number>)[key]
const write = (target: object, key: string, v: number): void => {
  ;(target as Record<string, number>)[key] = v
}
const readAny = (target: object, key: string): unknown =>
  (target as Record<string, unknown>)[key]
const writeAny = (target: object, key: string, v: string): void => {
  ;(target as Record<string, unknown>)[key] = v
}

export interface DebugControlsHandle {
  updateReadout(ship: Vec3Like, camera: Vec3Like): void
  sync(): void
  dispose(): void
}

export function createDebugControls(
  binds: DebugBinds,
  container: HTMLElement,
): DebugControlsHandle {
  const rows: Row[] = []
  const vecRows: VecRow[] = []
  const selects: SelRow[] = []

  const camPanel = requirePanel(container, 'cam')
  const shipPanel = requirePanel(container, 'ship')
  const followPanel = requirePanel(container, 'follow')
  const paraPanel = requirePanel(container, 'para')
  const wpnPanel = requirePanel(container, 'wpn')

  const posShip = container.querySelector<HTMLElement>('#pos-ship')
  const posCamera = container.querySelector<HTMLElement>('#pos-camera')

  const defaults = {
    camera: JSON.parse(JSON.stringify(binds.camera)) as CameraConfig,
    ship: JSON.parse(JSON.stringify(binds.shipTransform)) as ShipTransform,
    parallax: JSON.parse(JSON.stringify(binds.parallax)) as ParallaxLayerConfig[],
    followBox: JSON.parse(JSON.stringify(binds.followBox)),
    follow: JSON.parse(JSON.stringify(binds.follow)),
    recenterPoint: JSON.parse(JSON.stringify(binds.recenterPoint)),
    controls: JSON.parse(JSON.stringify(binds.controls)),
    weaponMods: JSON.parse(JSON.stringify(binds.weapons.mods)) as WeaponModifiers,
    energyMax: binds.weapons.energy.max,
    energyRegen: binds.weapons.energy.regenPerSec,
  }

  const applyCamera = (): void => binds.rig.applyConfig(binds.camera)
  const applyShip = (): void => binds.ship.applyTransform(binds.shipTransform)
  const applyParallax = (): void => binds.parallaxApply()

  const weaponSelect = { id: binds.weapons.activeId() }

  function group(host: HTMLElement, label: string): void {
    const el = document.createElement('div')
    el.className = 'debug-group'
    el.textContent = label
    host.appendChild(el)
  }

  function subgroup(host: HTMLElement, label: string): void {
    const el = document.createElement('div')
    el.className = 'debug-subgroup'
    el.textContent = label
    host.appendChild(el)
  }

  function scalar(
    host: HTMLElement,
    label: string,
    target: object,
    key: string,
    min: number,
    max: number,
    step: number,
    onChange: () => void,
  ): void {
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = label
    const value = document.createElement('span')
    value.className = 'debug-value'
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = String(min)
    slider.max = String(max)
    slider.step = String(step)
    const spin = document.createElement('input')
    spin.type = 'number'
    spin.step = String(step)

    const refresh = (): void => {
      value.textContent = format(read(target, key))
      slider.value = String(read(target, key))
      spin.value = String(read(target, key))
    }
    const commit = (raw: string): void => {
      const v = parseFloat(raw)
      if (Number.isFinite(v)) {
        write(target, key, v)
        onChange()
        refresh()
      }
    }
    slider.addEventListener('input', () => commit(slider.value))
    spin.addEventListener('input', () => commit(spin.value))
    refresh()

    const row = document.createElement('label')
    row.className = 'debug-row'
    row.append(name, slider, spin, value)
    host.appendChild(row)
    rows.push({ target, key, slider, spin, value, refresh })
  }

  function selectRow(
    host: HTMLElement,
    label: string,
    target: object,
    key: string,
    options: Array<{ value: string; text: string }>,
    onChange: () => void,
  ): void {
    const name = document.createElement('span')
    name.className = 'debug-label'
    name.textContent = label
    const select = document.createElement('select')
    for (const opt of options) {
      const el = document.createElement('option')
      el.value = opt.value
      el.textContent = opt.text
      if (String(readAny(target, key)) === opt.value) el.selected = true
      select.appendChild(el)
    }
    select.addEventListener('change', () => {
      writeAny(target, key, select.value)
      onChange()
    })
    const row = document.createElement('label')
    row.className = 'debug-row'
    row.append(name, select)
    host.appendChild(row)
    selects.push({ target, key, select })
  }

  function vec(host: HTMLElement, label: string, target: Vec3Like, onChange: () => void): void {
    const block = document.createElement('div')
    block.className = 'debug-vec'
    const title = document.createElement('div')
    title.className = 'debug-veclabel'
    title.textContent = label
    block.appendChild(title)
    const row = document.createElement('div')
    row.className = 'debug-vecrow'
    for (const k of ['x', 'y', 'z'] as const) {
      const input = document.createElement('input')
      input.type = 'number'
      input.step = '0.1'
      input.value = String(target[k])
      input.addEventListener('input', () => {
        const v = parseFloat(input.value)
        if (Number.isFinite(v)) {
          target[k] = v
          onChange()
        }
      })
      const tag = document.createElement('span')
      tag.className = 'debug-axis'
      tag.textContent = k
      const wrap = document.createElement('div')
      wrap.className = 'debug-axisinput'
      wrap.append(tag, input)
      row.appendChild(wrap)
      vecRows.push({ target, key: k, input })
    }
    block.appendChild(row)
    host.appendChild(block)
  }

  group(camPanel, 'Camera')
  scalar(camPanel, 'FOV', binds.camera, 'fov', 10, 170, 1, applyCamera)
  vec(camPanel, 'Position', binds.camera.position, applyCamera)
  vec(camPanel, 'Rotation (deg)', binds.camera.rotation, applyCamera)
  scalar(camPanel, 'Near', binds.camera, 'near', 0.01, 50, 0.01, applyCamera)
  scalar(camPanel, 'Far', binds.camera, 'far', 50, 2500, 10, applyCamera)
  subgroup(camPanel, 'Control')
  scalar(camPanel, 'Move Speed', binds.controls.camera, 'moveSpeed', 0, 60, 0.5, () => {})
  scalar(camPanel, 'Rot Speed', binds.controls.camera, 'rotSpeed', 0, 180, 1, () => {})

  group(shipPanel, 'Ship')
  vec(shipPanel, 'Position', binds.shipTransform.position, applyShip)
  vec(shipPanel, 'Rotation (deg)', binds.shipTransform.rotation, applyShip)
  scalar(shipPanel, 'Scale', binds.shipTransform, 'scale', 0.2, 6, 0.05, applyShip)
  subgroup(shipPanel, 'Motion')
  scalar(shipPanel, 'Max Speed', binds.controls.motion, 'maxSpeed', 0, 60, 0.5, () => {})
  scalar(shipPanel, 'Accel (force)', binds.controls.motion, 'accel', 0, 120, 0.5, () => {})
  scalar(shipPanel, 'Decel (force)', binds.controls.motion, 'decel', 0, 120, 0.5, () => {})
  scalar(shipPanel, 'Brake (force)', binds.controls.motion, 'brake', 0, 180, 0.5, () => {})
  subgroup(shipPanel, 'Tilt')
  selectRow(shipPanel, 'Axis', binds.controls.tilt, 'axis', [
    { value: 'y', text: 'Y' },
    { value: 'z', text: 'Z' },
  ], () => {})
  selectRow(shipPanel, 'Sign', binds.controls.tilt, 'sign', [
    { value: '1', text: '+' },
    { value: '-1', text: '-' },
  ], () => {})
  scalar(shipPanel, 'Max Deg', binds.controls.tilt, 'maxDeg', 0, 90, 1, () => {})
  scalar(shipPanel, 'Rise (ms)', binds.controls.tilt, 'riseMs', 10, 2000, 10, () => {})
  scalar(shipPanel, 'Fall (ms)', binds.controls.tilt, 'fallMs', 10, 2000, 10, () => {})

  group(followPanel, 'Follow Box')
  vec(followPanel, 'Position', binds.followBox, () => {})
  scalar(followPanel, 'Half Width X', binds.follow, 'halfX', 0.5, 60, 0.5, () => {})
  scalar(followPanel, 'Half Depth Z', binds.follow, 'halfZ', 0.5, 60, 0.5, () => {})
  subgroup(followPanel, 'Bounce')
  scalar(followPanel, 'Bounce Time (ms)', binds.follow.bounce, 'timeMs', 0, 1500, 10, () => {})
  subgroup(followPanel, 'Recenter')
  scalar(followPanel, 'Delay (ms)', binds.follow.recenter, 'delayMs', 100, 10000, 50, () => {})
  scalar(followPanel, 'Still (ms)', binds.follow.recenter, 'stillMs', 100, 10000, 50, () => {})
  scalar(followPanel, 'Accel', binds.follow.recenter, 'accel', 0, 60, 0.5, () => {})
  scalar(followPanel, 'Max Speed', binds.follow.recenter, 'maxSpeed', 0, 100, 0.5, () => {})
  subgroup(followPanel, 'Recenter Point')
  vec(followPanel, 'Position', binds.recenterPoint.position, () => {})
  scalar(followPanel, 'Width', binds.recenterPoint, 'width', 0, 20, 0.1, () => {})
  scalar(followPanel, 'Height', binds.recenterPoint, 'height', 0, 30, 0.1, () => {})

  const layerLabels = ['1 — background', '2 — solar', '3 — debris']
  for (let i = 0; i < binds.parallax.length; i++) {
    const layer = binds.parallax[i]
    subgroup(paraPanel, layerLabels[i] ?? `${i + 1}`)
    const apply = (): void => applyParallax()
    scalar(paraPanel, 'count', layer, 'count', 10, 2000, 10, apply)
    scalar(paraPanel, 'speed', layer, 'speed', -400, 400, 1, apply)
    scalar(paraPanel, 'speedJitter', layer, 'speedJitter', 0, 1, 0.01, apply)
    scalar(paraPanel, 'Parallax Gain', layer, 'parallaxGain', 0, 1, 0.01, apply)
    scalar(paraPanel, 'size', layer, 'size', 0.02, 3, 0.01, apply)
    scalar(paraPanel, 'alpha', layer, 'alpha', 0, 1, 0.01, apply)
    scalar(paraPanel, 'Grid Size', layer, 'gridSize', 4, 500, 1, apply)
    scalar(paraPanel, 'Grid Opacity', layer, 'gridOpacity', 0, 1, 0.01, apply)
    scalar(paraPanel, 'Star Depth Near', layer, 'zNearWrap', -300, 300, 0.5, apply)
    scalar(paraPanel, 'Star Depth Far', layer, 'zFar', -6000, 0, 5, apply)
    vec(paraPanel, 'Position', layer.position, apply)
    vec(paraPanel, 'Rotation (deg)', layer.rotation, apply)
  }

  group(wpnPanel, 'Active Weapon')
  const weaponOptions = binds.weapons.loadout.map((id) => ({ value: id, text: id.toUpperCase() }))
  selectRow(wpnPanel, 'Weapon', weaponSelect, 'id', weaponOptions, () => {
    binds.weapons.setActive(weaponSelect.id as WeaponId)
    rebuildWeaponStats()
  })

  const wpnStats = document.createElement('div')
  wpnPanel.appendChild(wpnStats)

  function rebuildWeaponStats(): void {
    wpnStats.innerHTML = ''
    const id = binds.weapons.activeId()
    const cfg = binds.weapons.catalog[id]
    if (!cfg) return

    group(wpnStats, `${cfg.displayName} (${cfg.profile})`)
    scalar(wpnStats, 'Damage', cfg, 'damage', 0, 100, 0.1, () => {})
    scalar(wpnStats, 'Rate (shots/s)', cfg, 'rate', 0.1, 30, 0.1, () => {})
    scalar(wpnStats, 'Energy / shot', cfg, 'energyPerShot', 0, 100, 0.05, () => {})

    if (cfg.projectile) {
      subgroup(wpnStats, 'Projectile')
      scalar(wpnStats, 'Speed', cfg.projectile, 'speed', 1, 200, 0.5, () => {})
      scalar(wpnStats, 'Radius (0-1)', cfg.projectile, 'radius', 0, 1, 0.01, () => {})
      scalar(wpnStats, 'Lifetime (s)', cfg.projectile, 'lifetime', 0.1, 10, 0.05, () => {})
      if (!cfg.laser) {
        scalar(wpnStats, 'Dmg decay /u', cfg.projectile, 'damageDecayPerUnit', 0, 1, 0.001, () => {})
      }
    }
    if (cfg.laser) {
      subgroup(wpnStats, 'Laser')
      scalar(wpnStats, 'Forward shots', cfg.laser, 'forwardShots', 1, 4, 1, () => {})
      scalar(wpnStats, 'Diag each side', cfg.laser, 'diagonalShotsPerSide', 0, 4, 1, () => {})
      scalar(wpnStats, 'Total (fwd + 2xdiag)', cfg.laser, 'totalShots', 1, 10, 1, () => {})
      scalar(wpnStats, 'Diag angle (deg)', cfg.laser, 'diagonalAngleDeg', 1, 90, 1, () => {})
      scalar(wpnStats, 'Forward spread', cfg.laser, 'forwardSpread', 0.05, 4, 0.05, () => {})
      scalar(wpnStats, 'Diag spread (deg)', cfg.laser, 'diagonalSpreadDeg', 0, 45, 1, () => {})
    }
    if (cfg.orb) {
      subgroup(wpnStats, 'Orb')
      scalar(wpnStats, 'Speed', cfg.orb, 'speed', 1, 200, 0.5, () => {})
      scalar(wpnStats, 'Radius', cfg.orb, 'radius', 0.01, 2, 0.01, () => {})
      scalar(wpnStats, 'Lifetime (s)', cfg.orb, 'lifetime', 0.1, 10, 0.05, () => {})
      scalar(wpnStats, 'AoE radius', cfg.orb, 'aoeRadius', 0, 10, 0.1, () => {})
      scalar(wpnStats, 'Dmg decay /u', cfg.orb, 'damageDecayPerUnit', 0, 1, 0.001, () => {})
    }
    if (cfg.beam) {
      subgroup(wpnStats, 'Beam')
      scalar(wpnStats, 'Width', cfg.beam, 'width', 0.01, 5, 0.01, () => {})
      scalar(wpnStats, 'Length', cfg.beam, 'length', 1, 100, 0.5, () => {})
      scalar(wpnStats, 'DPS', cfg.beam, 'dps', 0, 200, 0.5, () => {})
      scalar(wpnStats, 'Energy /s', cfg.beam, 'energyPerSec', 0, 100, 0.1, () => {})
    }
    if (cfg.cone) {
      subgroup(wpnStats, 'Cone')
      scalar(wpnStats, 'Angle (deg)', cfg.cone, 'angleDeg', 1, 180, 1, () => {})
      scalar(wpnStats, 'Length', cfg.cone, 'length', 1, 100, 0.5, () => {})
      scalar(wpnStats, 'DPS', cfg.cone, 'dps', 0, 200, 0.5, () => {})
      scalar(wpnStats, 'Energy /s', cfg.cone, 'energyPerSec', 0, 100, 0.1, () => {})
    }
  }
  rebuildWeaponStats()

  group(wpnPanel, 'Modifiers')
  scalar(wpnPanel, 'Damage x', binds.weapons.mods, 'damageMul', 0, 5, 0.05, () => {})
  scalar(wpnPanel, 'Rate x', binds.weapons.mods, 'rateMul', 0.1, 5, 0.05, () => {})
  scalar(wpnPanel, 'Energy x', binds.weapons.mods, 'energyMul', 0.1, 5, 0.05, () => {})
  scalar(wpnPanel, 'Crit chance', binds.weapons.mods, 'critChance', 0, 1, 0.01, () => {})
  scalar(wpnPanel, 'Pulses (Laser)', binds.weapons.mods, 'pulses', 1, 21, 1, () => {})
  scalar(wpnPanel, 'AoE x (Plasma)', binds.weapons.mods, 'aoeMul', 0.1, 5, 0.05, () => {})
  scalar(wpnPanel, 'Beam Width x', binds.weapons.mods, 'beamWidthMul', 0.1, 5, 0.05, () => {})
  scalar(wpnPanel, 'Cone x (Mjolnir)', binds.weapons.mods, 'coneMul', 0.1, 5, 0.05, () => {})

  const laserCfg = binds.weapons.catalog.laser
  if (laserCfg) {
    group(wpnPanel, 'Laser Levels')
    const presetRow = document.createElement('div')
    presetRow.className = 'debug-row debug-presetrow'
    const applyPreset = (level: number): void => {
      applyLaserLevel(laserCfg, level)
      rebuildWeaponStats()
      for (const r of rows) r.refresh()
    }
    for (const lv of LASER_LEVELS) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'debug-preset'
      btn.textContent = `L${lv.level}`
      btn.title = `forward ${lv.forwardShots} / diag ${lv.diagonalShotsPerSide} each`
      btn.addEventListener('click', () => applyPreset(lv.level))
      presetRow.appendChild(btn)
    }
    wpnPanel.appendChild(presetRow)
    const presetNote = document.createElement('div')
    presetNote.className = 'debug-note'
    presetNote.textContent = 'Presets live in src/weapons/laserLevels.ts — edit there and hit the button again.'
    wpnPanel.appendChild(presetNote)
  }

  group(wpnPanel, 'Energy')
  scalar(wpnPanel, 'Max', binds.weapons.energy, 'max', 1, 500, 1, () => {})
  scalar(wpnPanel, 'Regen /s', binds.weapons.energy, 'regenPerSec', 0, 100, 0.5, () => {})

  const reset = container.querySelector<HTMLButtonElement>('#debug-reset')
  reset?.addEventListener('click', () => {
    const camPos = binds.camera.position
    const camRot = binds.camera.rotation
    const shipPos = binds.shipTransform.position
    const shipRot = binds.shipTransform.rotation
    Object.assign(binds.camera, defaults.camera)
    Object.assign(camPos, defaults.camera.position)
    Object.assign(camRot, defaults.camera.rotation)
    Object.assign(binds.shipTransform, defaults.ship)
    Object.assign(shipPos, defaults.ship.position)
    Object.assign(shipRot, defaults.ship.rotation)
    for (let i = 0; i < binds.parallax.length; i++) {
      const live = binds.parallax[i]
      const def = defaults.parallax[i]
      const layerPos = live.position
      const layerRot = live.rotation
      Object.assign(live, def)
      Object.assign(layerPos, def.position)
      Object.assign(layerRot, def.rotation)
    }
    for (const r of rows) r.refresh()
    for (const v of vecRows) v.input.value = String(v.target[v.key])
    Object.assign(binds.controls.motion, defaults.controls.motion)
    Object.assign(binds.controls.tilt, defaults.controls.tilt)
    Object.assign(binds.controls.camera, defaults.controls.camera)
    Object.assign(binds.controls.shipKeys, defaults.controls.shipKeys)
    for (const s of selects) {
      s.select.value = String(readAny(s.target, s.key))
    }
    Object.assign(binds.followBox, defaults.followBox)
    Object.assign(binds.follow, defaults.follow)
    Object.assign(binds.recenterPoint, defaults.recenterPoint)
    Object.assign(binds.recenterPoint.position, defaults.recenterPoint.position)
    Object.assign(binds.weapons.energy, { max: defaults.energyMax, regenPerSec: defaults.energyRegen })
    Object.assign(binds.weapons.mods, defaults.weaponMods)
    for (const r of rows) r.refresh()
    for (const v of vecRows) v.input.value = String(v.target[v.key])
    for (const s of selects) s.select.value = String(readAny(s.target, s.key))
    applyCamera()
    applyShip()
    applyParallax()
  })

  return {
    updateReadout(ship: Vec3Like, camera: Vec3Like): void {
      if (posShip) posShip.textContent = `x ${ship.x.toFixed(2)}  y ${ship.y.toFixed(2)}  z ${ship.z.toFixed(2)}`
      if (posCamera) posCamera.textContent = `x ${camera.x.toFixed(2)}  y ${camera.y.toFixed(2)}  z ${camera.z.toFixed(2)}`
    },
    sync(): void {
      for (const r of rows) {
        if (document.activeElement === r.slider || document.activeElement === r.spin) continue
        r.refresh()
      }
      for (const v of vecRows) {
        if (document.activeElement === v.input) continue
        v.input.value = String(v.target[v.key])
      }
    },
    dispose(): void {
      const panel = container.querySelector('.debug-panel')
      panel?.remove()
    },
  }
}

function requirePanel(container: HTMLElement, tab: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`.debug-tabpanel[data-tab="${tab}"]`)
  if (!el) throw new Error(`#panel missing .debug-tabpanel[data-tab=${tab}]`)
  return el
}

function format(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}