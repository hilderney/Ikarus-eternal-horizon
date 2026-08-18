import { PerspectiveCamera } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../../core/balancer'
import { DEG2RAD } from '../../core/math'
import { GameCamera, type CameraConfig } from './game-camera'

function defaultConfig(): CameraConfig {
  return {
    fov: BALANCE.camera.fov,
    position: { ...BALANCE.camera.position },
    rotation: { ...BALANCE.camera.rotation },
    near: BALANCE.camera.near,
    far: BALANCE.camera.far,
    aspect: BALANCE.layout.playfield.width / BALANCE.layout.playfield.height,
  }
}

describe('GameCamera', () => {
  it('mounts a PerspectiveCamera with rotation.order YXZ', () => {
    const rig = new GameCamera(defaultConfig())
    expect(rig.camera).toBeInstanceOf(PerspectiveCamera)
    expect(rig.camera.rotation.order).toBe('YXZ')
    rig.dispose()
  })

  it('applyConfig writes fov, near, far, aspect and updates projection', () => {
    const rig = new GameCamera(defaultConfig())
    const spy = vi.spyOn(rig.camera, 'updateProjectionMatrix')
    rig.applyConfig({
      fov: 60,
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: 0 },
      near: 1,
      far: 100,
      aspect: 0.5,
    })
    expect(rig.camera.fov).toBe(60)
    expect(rig.camera.near).toBe(1)
    expect(rig.camera.far).toBe(100)
    expect(rig.camera.aspect).toBe(0.5)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
    rig.dispose()
  })

  it('applyConfig writes world position from config.position', () => {
    const rig = new GameCamera(defaultConfig())
    rig.applyConfig({
      ...defaultConfig(),
      position: { x: 9, y: 8, z: 7 },
    })
    expect(rig.camera.position.x).toBe(9)
    expect(rig.camera.position.y).toBe(8)
    expect(rig.camera.position.z).toBe(7)
    rig.dispose()
  })

  it('applyConfig converts rotation degrees through DEG2RAD', () => {
    const rig = new GameCamera(defaultConfig())
    rig.applyConfig({
      ...defaultConfig(),
      rotation: { x: -55, y: 24, z: -14 },
    })
    expect(rig.camera.rotation.x).toBeCloseTo(-55 * DEG2RAD, 10)
    expect(rig.camera.rotation.y).toBeCloseTo(24 * DEG2RAD, 10)
    expect(rig.camera.rotation.z).toBeCloseTo(-14 * DEG2RAD, 10)
    rig.dispose()
  })

  it('defaults to fov 85 at {3,14,6} / {-55,24,-14} deg, near 5 far 10000', () => {
    const rig = new GameCamera(defaultConfig())
    expect(rig.camera.fov).toBe(85)
    expect(rig.camera.position.x).toBe(3)
    expect(rig.camera.position.y).toBe(14)
    expect(rig.camera.position.z).toBe(6)
    expect(rig.camera.rotation.x).toBeCloseTo(-55 * DEG2RAD, 10)
    expect(rig.camera.rotation.y).toBeCloseTo(24 * DEG2RAD, 10)
    expect(rig.camera.rotation.z).toBeCloseTo(-14 * DEG2RAD, 10)
    expect(rig.camera.near).toBe(5)
    expect(rig.camera.far).toBe(10000)
    rig.dispose()
  })

  it('uses playfield aspect 540/960', () => {
    const rig = new GameCamera(defaultConfig())
    expect(rig.camera.aspect).toBe(540 / 960)
    rig.dispose()
  })

  it('applyConfig / syncRender allocate nothing per call', () => {
    const rig = new GameCamera(defaultConfig())
    const setSpy = vi.spyOn(globalThis, 'Set')
    rig.applyConfig(defaultConfig())
    rig.syncRender()
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    rig.dispose()
  })

  it('dispose is safe and does not throw', () => {
    const rig = new GameCamera(defaultConfig())
    expect(() => {
      rig.dispose()
      rig.dispose()
    }).not.toThrow()
  })
})
