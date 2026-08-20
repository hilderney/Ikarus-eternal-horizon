/**
 * SDD-F01 / D13 — frozen six-layer set and who-hits-whom matrix (data, not if-branches).
 */

export enum Layer {
  Player = 0,
  PlayerShot = 1,
  Enemy = 2,
  EnemyShot = 3,
  Meteor = 4,
  Drop = 5,
}

/** Who-hits-whom DATA. Empty array = hits nothing. */
export const HIT_MATRIX: Readonly<Record<Layer, readonly Layer[]>> = {
  [Layer.Player]: [Layer.Enemy, Layer.Meteor, Layer.Drop],
  [Layer.PlayerShot]: [Layer.Enemy, Layer.Meteor],
  [Layer.Enemy]: [Layer.Player],
  [Layer.EnemyShot]: [Layer.Player],
  [Layer.Meteor]: [Layer.Player, Layer.PlayerShot],
  [Layer.Drop]: [],
}

export function layersHit(
  from: Layer,
  to: Layer,
  matrix: Readonly<Record<Layer, readonly Layer[]>> = HIT_MATRIX,
): boolean {
  const row = matrix[from]
  for (let i = 0; i < row.length; i++) {
    if (row[i] === to) {
      return true
    }
  }
  return false
}
