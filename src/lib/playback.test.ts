import { describe, expect, it } from 'vitest'
import { advanceClock } from './playback'

describe('fixed simulation clock', () => {
  it('preserves sub-second time instead of varying simulation ticks with rendering', () => {
    const first = advanceClock(75, 10, 0)
    expect(first).toEqual({ ticks: 0, remainder: 0.75 })
    expect(advanceClock(75, 10, first.remainder)).toEqual({ ticks: 1, remainder: 0.5 })
  })
  it('produces the same number of ticks for different frame cadences', () => {
    let ticks = 0
    let remainder = 0
    for (let frame = 0; frame < 100; frame++) {
      const step = advanceClock(10, 20, remainder)
      ticks += step.ticks
      remainder = step.remainder
    }
    expect(ticks).toBe(20)
    expect(remainder).toBeCloseTo(0)
    expect(advanceClock(1000, 20, 0).ticks).toBe(ticks)
  })
})
