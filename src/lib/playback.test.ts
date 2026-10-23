import { describe, expect, it } from 'vitest'
import { advanceClock, interpolationFrameDue } from './playback'

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

describe('vehicle interpolation frames', () => {
  it('flushes a settled paused frame even before the next throttled frame is due', () => {
    expect(interpolationFrameDue(1, .75, 16)).toBe(true)
    expect(interpolationFrameDue(1, .75, 0)).toBe(true)
    expect(interpolationFrameDue(1, 1, 16)).toBe(false)
  })

  it('still limits intermediate vehicle frames to the normal cadence', () => {
    expect(interpolationFrameDue(.8, .75, 16)).toBe(false)
    expect(interpolationFrameDue(.8, .75, 32)).toBe(true)
    expect(interpolationFrameDue(.8, .8, 100)).toBe(false)
  })
})
