/**
 * SDD-C02 dash L1–L12. Cost and travel grow in bands of 4 (step doubles each band).
 */

export interface DashLevel {
  readonly level: number
  readonly energyCost: number
  readonly speedMul: number
}

/** Same step pattern as laser energy (×10): +0.5 / +1 / +2 per level in bands of 4. */
export const DASH_LEVELS: readonly DashLevel[] = [
  { level: 1, energyCost: 2, speedMul: 1.55 },
  { level: 2, energyCost: 2.5, speedMul: 1.6 },
  { level: 3, energyCost: 3, speedMul: 1.65 },
  { level: 4, energyCost: 3.5, speedMul: 1.7 },
  { level: 5, energyCost: 4, speedMul: 1.8 },
  { level: 6, energyCost: 5, speedMul: 1.9 },
  { level: 7, energyCost: 6, speedMul: 2 },
  { level: 8, energyCost: 7, speedMul: 2.1 },
  { level: 9, energyCost: 9, speedMul: 2.25 },
  { level: 10, energyCost: 11, speedMul: 2.4 },
  { level: 11, energyCost: 13, speedMul: 2.55 },
  { level: 12, energyCost: 15, speedMul: 2.7 },
]

export function dashLevel(level: number): DashLevel | undefined {
  return DASH_LEVELS.find((row) => row.level === level)
}
