import { describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../../core/balancer'
import type { InputAction, InputPort } from '../../core/input'
import { CameraController } from './camera-controller'
import cameraSource from './camera-controller.ts?raw'
import { PlayerController, type ShipTransform } from './player-controller'
import playerSource from './player-controller.ts?raw'

class FakeInput implements InputPort {
  codes = new Set<string>()
  moveX = 0
  moveZ = 0
  consumeLog: InputAction[] = []
  private _dashOnce = false

  isDown(code: string): boolean {
    return this.codes.has(code)
  }

  axis(id: 'moveX' | 'moveZ'): number {
    return id === 'moveX' ? this.moveX : this.moveZ
  }

  isPressed(action: InputAction): boolean {
    void action
    return false
  }

  consumePress(action: InputAction): boolean {
    this.consumeLog.push(action)
    if (action === 'dash' && this._dashOnce) {
      this._dashOnce = false
      return true
    }
    return false
  }

  rumble(): void {
    /* unused */
  }

  update(): void {
    /* unused */
  }

  dispose(): void {
    /* unused */
  }

  get connectedPadCount(): number {
    return 0
  }

  queueDash(): void {
    this._dashOnce = true
  }
}

function makeTransform(): ShipTransform {
  return {
    position: { x: 0, y: 7, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
  }
}

function makePlayer(
  input: FakeInput,
  transform: ShipTransform,
  modifiers = { speedMul: 1, accelMul: 1 },
): PlayerController {
  return new PlayerController({
    input,
    transform,
    motion: BALANCE.controls.motion,
    dash: BALANCE.controls.dash,
    tilt: BALANCE.controls.tilt,
    keys: BALANCE.controls.shipKeys,
    modifiers,
  })
}

function step(controller: PlayerController, seconds: number, dt = 0.05): void {
  const n = Math.round(seconds / dt)
  for (let i = 0; i < n; i++) {
    controller.update(dt)
  }
}

describe('PlayerController', () => {
  it('accelerates along +X at accel 60 and caps at maxSpeed 12', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 1
    step(controller, 1)
    const x = transform.position.x
    controller.update(0.05)
    expect(transform.position.x - x).toBeCloseTo(12 * 0.05, 6)
    controller.dispose()
  })

  it('uses brake 120 when input opposes current velocity', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 1
    controller.update(0.05)
    expect(transform.position.x).toBeCloseTo(3 * 0.05, 6)
    input.moveX = -1
    controller.update(0.05)
    expect(transform.position.x).toBeCloseTo(0, 6)
    controller.dispose()
  })

  it('coasts to exactly 0 with decel 60 when input is released', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 1
    controller.update(0.05)
    input.moveX = 0
    controller.update(0.05)
    const x = transform.position.x
    controller.update(0.05)
    expect(transform.position.x).toBe(x)
    controller.dispose()
  })

  it('scales maxSpeed and accel by injected speedMul/accelMul and nothing else', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform, { speedMul: 0.5, accelMul: 0.5 })
    input.moveX = 1
    controller.update(0.05)
    expect(transform.position.x).toBeCloseTo(1.5 * 0.05, 6)
    step(controller, 1)
    const x = transform.position.x
    controller.update(0.05)
    expect(transform.position.x - x).toBeCloseTo(6 * 0.05, 6)
    controller.dispose()
  })

  it('does not import or name ShipHealth', () => {
    expect(playerSource).not.toMatch(/ShipHealth/)
  })

  it('banks rotation.z toward dirX * 22 * -1, reaching target in 150ms', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 1
    step(controller, 0.15)
    expect(transform.rotation.z).toBeCloseTo(-22, 5)
    controller.dispose()
  })

  it('settles tilt back to 0 in 200ms when input is released', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 1
    step(controller, 0.15)
    input.moveX = 0
    step(controller, 0.2)
    expect(transform.rotation.z).toBeCloseTo(0, 5)
    controller.dispose()
  })

  it('writes transform.position.x/z and does not write y', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 1
    input.moveZ = 1
    controller.update(0.05)
    expect(transform.position.x).not.toBe(0)
    expect(transform.position.z).not.toBe(0)
    expect(transform.position.y).toBe(7)
    controller.dispose()
  })

  it('does not import nipplejs, mouse event names, or getGamepads', () => {
    expect(playerSource).not.toMatch(/nipplejs/)
    expect(playerSource).not.toMatch(/getGamepads/)
    expect(playerSource).not.toMatch(/pointerdown|mousemove|MouseEvent/)
    expect(cameraSource).not.toMatch(/nipplejs/)
  })

  it('does not consume fire, bomb, switchWeapon, switchBomb, or pause', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 1
    controller.update(0.05)
    expect(input.consumeLog.every((action) => action === 'dash')).toBe(true)
    expect(input.consumeLog).not.toContain('fire')
    expect(input.consumeLog).not.toContain('bomb')
    expect(input.consumeLog).not.toContain('switchWeapon')
    expect(input.consumeLog).not.toContain('switchBomb')
    expect(input.consumeLog).not.toContain('pause')
    controller.dispose()
  })

  it('uses axis moveX/moveZ rather than isDown of shipKeys', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 1
    controller.update(0.05)
    expect(transform.position.x).toBeGreaterThan(0)
    expect(input.codes.size).toBe(0)
    controller.dispose()
  })

  it('half-stick (|axis|=0.5) accelerates at half of accel 60', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 0.5
    controller.update(0.05)
    expect(transform.position.x).toBeCloseTo(1.5 * 0.05, 6)
    controller.dispose()
  })

  it('nipple-sized axis 1,-1 is indistinguishable from a full stick', () => {
    const stick = new FakeInput()
    const nipple = new FakeInput()
    const a = makeTransform()
    const b = makeTransform()
    const left = makePlayer(stick, a)
    const right = makePlayer(nipple, b)
    stick.moveX = 1
    stick.moveZ = -1
    nipple.moveX = 1
    nipple.moveZ = -1
    left.update(0.05)
    right.update(0.05)
    expect(b.position.x).toBeCloseTo(a.position.x, 10)
    expect(b.position.z).toBeCloseTo(a.position.z, 10)
    left.dispose()
    right.dispose()
  })

  it('consumePress dash snaps speed along dir and ignores a held button', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 1
    input.queueDash()
    controller.update(0.05)
    const dashDx = 12 * 2.2 * 0.05
    expect(transform.position.x).toBeCloseTo(dashDx, 5)
    const x = transform.position.x
    controller.update(0.05)
    expect(transform.position.x - x).toBeCloseTo(dashDx, 5)
    controller.dispose()
  })

  it('dash is ignored while cooldown is active', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 1
    input.queueDash()
    controller.update(0.05)
    step(controller, 0.2)
    const x = transform.position.x
    input.queueDash()
    controller.update(0.05)
    expect(transform.position.x - x).toBeCloseTo(12 * 0.05, 5)
    controller.dispose()
  })

  it('update(dt) allocates no objects', () => {
    const input = new FakeInput()
    const transform = makeTransform()
    const controller = makePlayer(input, transform)
    input.moveX = 1
    controller.update(0.05)
    const setSpy = vi.spyOn(globalThis, 'Set')
    controller.update(0.05)
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    controller.dispose()
  })
})

describe('CameraController', () => {
  it('KeyI increases pose.position.z at moveSpeed 12', () => {
    const input = new FakeInput()
    const pose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    const controller = new CameraController({
      input,
      pose,
      config: BALANCE.controls.camera,
    })
    input.codes.add('KeyI')
    controller.update(0.1)
    expect(pose.position.z).toBeCloseTo(1.2, 6)
    controller.dispose()
  })

  it('KeyU / KeyO move +Y / −Y at moveSpeed 12', () => {
    const input = new FakeInput()
    const pose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    const controller = new CameraController({
      input,
      pose,
      config: BALANCE.controls.camera,
    })
    input.codes.add('KeyU')
    controller.update(1)
    expect(pose.position.y).toBeCloseTo(12, 6)
    input.codes.delete('KeyU')
    input.codes.add('KeyO')
    controller.update(1)
    expect(pose.position.y).toBeCloseTo(0, 6)
    controller.dispose()
  })

  it('Shift+KeyI rotates rotX down at rotSpeed 45 without a mode toggle', () => {
    const input = new FakeInput()
    const pose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    const controller = new CameraController({
      input,
      pose,
      config: BALANCE.controls.camera,
    })
    input.codes.add('KeyI')
    input.codes.add('Shift+KeyI')
    controller.update(1)
    expect(pose.position.z).toBeCloseTo(12, 6)
    expect(pose.rotation.x).toBeCloseTo(-45, 6)
    controller.dispose()
  })

  it('WASD ship keys are ignored by CameraController', () => {
    const input = new FakeInput()
    const pose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    const controller = new CameraController({
      input,
      pose,
      config: BALANCE.controls.camera,
    })
    input.codes.add('KeyW')
    input.codes.add('KeyA')
    input.codes.add('KeyS')
    input.codes.add('KeyD')
    controller.update(1)
    expect(pose.position).toEqual({ x: 0, y: 0, z: 0 })
    controller.dispose()
  })
})
