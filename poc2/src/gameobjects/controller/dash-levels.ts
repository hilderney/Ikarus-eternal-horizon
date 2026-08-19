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
  { level: 1, energyCost: 2, speedMul: 2.05 },
  { level: 2, energyCost: 2.5, speedMul: 2.10 },
  { level: 3, energyCost: 3, speedMul: 2.15 },
  { level: 4, energyCost: 3.5, speedMul: 2.2 },
  { level: 5, energyCost: 4, speedMul: 2.3 },
  { level: 6, energyCost: 5, speedMul: 2.4 },
  { level: 7, energyCost: 6, speedMul: 2.5 },
  { level: 8, energyCost: 7, speedMul: 2.6 },
  { level: 9, energyCost: 9, speedMul: 2.8 },
  { level: 10, energyCost: 11, speedMul: 3 },
  { level: 11, energyCost: 13, speedMul: 3.2 },
  { level: 12, energyCost: 15, speedMul: 3.4 },
]

export function dashLevel(level: number): DashLevel | undefined {
  return DASH_LEVELS.find((row) => row.level === level)
}
