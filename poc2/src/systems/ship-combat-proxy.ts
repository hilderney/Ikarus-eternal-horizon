/**
 * Ship as F01 ColliderPort + F04 DamageSink (C03 ShipHealth underneath).
 */

import type { Ship } from '../gameobjects/ship/ship'
import type { ShipHealth, DamageOutcome } from '../gameobjects/ship/ship-health'
import { Layer } from './layers'

export class ShipCombatProxy {
  readonly layer = Layer.Player

  constructor(
    private readonly _ship: Ship,
    private readonly _health: ShipHealth,
    private readonly _radius: number,
  ) {}

  get active(): boolean {
    return this._health.integrity > 0
  }

  get x(): number {
    return this._ship.transform.position.x
  }

  get z(): number {
    return this._ship.transform.position.z
  }

  get radius(): number {
    return this._radius
  }

  applyDamage(amount: number, source: Layer): DamageOutcome {
    return this._health.applyDamage(amount, source)
  }
}
