import { describe, expect, it } from 'vitest'
import {
  computeFormationSlots,
  createSlotBuffer,
  FORMATION_IDS,
  type FormationParams,
  type SlotOffset,
} from './formation-slots'

const PARAMS: FormationParams = {
  circleRadius: 6,
  vSpacing: 3,
  vAngleDeg: 35,
  diamondW: 7,
  diamondH: 5,
}

function slotAt(out: SlotOffset[], index: number): SlotOffset {
  const slot = out[index]
  if (!slot) {
    throw new Error(`missing slot ${index}`)
  }
  return slot
}

describe('formation-slots', () => {
  it('never places a slot on the group center', () => {
    const out = createSlotBuffer(8)
    for (const id of FORMATION_IDS) {
      for (let n = 1; n <= 8; n += 1) {
        const written = computeFormationSlots(id, n, PARAMS, out)
        expect(written).toBe(n)
        for (let i = 0; i < written; i += 1) {
          const slot = slotAt(out, i)
          expect(Math.hypot(slot.x, slot.z)).toBeGreaterThan(0.1)
        }
      }
    }
  })

  it('clamps the written count to the buffer length', () => {
    const out = createSlotBuffer(4)
    expect(computeFormationSlots('hollowCircle', 9, PARAMS, out)).toBe(4)
    expect(computeFormationSlots('hollowCircle', 0, PARAMS, out)).toBe(0)
  })

  it('spreads the hollow circle evenly on the radius', () => {
    const out = createSlotBuffer(8)
    computeFormationSlots('hollowCircle', 6, PARAMS, out)
    for (let i = 0; i < 6; i += 1) {
      const slot = slotAt(out, i)
      expect(Math.hypot(slot.x, slot.z)).toBeCloseTo(PARAMS.circleRadius, 6)
    }
    const a0 = Math.atan2(slotAt(out, 0).z, slotAt(out, 0).x)
    const a1 = Math.atan2(slotAt(out, 1).z, slotAt(out, 1).x)
    expect(a1 - a0).toBeCloseTo((Math.PI * 2) / 6, 6)
  })

  it('mirrors the V wing and keeps every rank behind the vertex', () => {
    const out = createSlotBuffer(8)
    computeFormationSlots('vWing', 6, PARAMS, out)
    for (let i = 0; i < 6; i += 2) {
      expect(slotAt(out, i).x).toBeCloseTo(-slotAt(out, i + 1).x, 6)
      expect(slotAt(out, i).z).toBeCloseTo(slotAt(out, i + 1).z, 6)
    }
    for (let i = 0; i < 6; i += 1) {
      expect(slotAt(out, i).z).toBeLessThan(0)
    }
    expect(Math.abs(slotAt(out, 2).x)).toBeGreaterThan(Math.abs(slotAt(out, 0).x))
  })

  it('keeps every diamond slot on the outline', () => {
    const out = createSlotBuffer(8)
    computeFormationSlots('hollowDiamond', 8, PARAMS, out)
    for (let i = 0; i < 8; i += 1) {
      const slot = slotAt(out, i)
      const onOutline =
        Math.abs(slot.x) / PARAMS.diamondW + Math.abs(slot.z) / PARAMS.diamondH
      expect(onOutline).toBeCloseTo(1, 6)
    }
  })

  it('reuses the buffer objects (no per-call allocation)', () => {
    const out = createSlotBuffer(8)
    const first = out[0]
    computeFormationSlots('vWing', 8, PARAMS, out)
    computeFormationSlots('hollowDiamond', 8, PARAMS, out)
    expect(out[0]).toBe(first)
  })
})
