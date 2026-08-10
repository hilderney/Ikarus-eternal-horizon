import type { InputState } from '../core/input'
import type { ShipTransform } from '../gameobjects/ship'

export interface ShipControlConfig {
  speed: number
  keys: {
    moveXMinus: string
    moveXPlus: string
    moveZMinus: string
    moveZPlus: string
  }
}

const has = (input: InputState, ...codes: string[]): boolean =>
  codes.some((c) => input.keys.has(c))

export function updateShipFromInput(
  input: InputState,
  transform: ShipTransform,
  config: ShipControlConfig,
  dt: number,
): void {
  const { keys } = config
  const dx = (has(input, keys.moveXPlus) ? 1 : 0) - (has(input, keys.moveXMinus) ? 1 : 0)
  const dz = (has(input, keys.moveZPlus) ? 1 : 0) - (has(input, keys.moveZMinus) ? 1 : 0)

  transform.position.x += dx * config.speed * dt
  transform.position.z += dz * config.speed * dt
}