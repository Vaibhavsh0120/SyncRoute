import { describe, expect, it } from 'vitest'
import { vehicleDetail, vehicleFrameDue, nextMapView } from './mapRendering'

describe('map rendering budget', () => {
  it('keeps expensive vehicle detail for settled close views', () => {
    expect(vehicleDetail(15.8, false)).toBe('compact')
    expect(vehicleDetail(17, true)).toBe('compact')
    expect(vehicleDetail(17, false)).toBe('full')
  })
  it('limits even fresh traffic snapshots while dragging and flushes on pause', () => {
    expect(vehicleFrameDue({ changed: true, elapsed: 20, moving: true, playing: true })).toBe(false)
    expect(vehicleFrameDue({ changed: true, elapsed: 100, moving: true, playing: true })).toBe(true)
    expect(vehicleFrameDue({ changed: true, elapsed: 20, moving: false, playing: true })).toBe(false)
    expect(vehicleFrameDue({ changed: true, elapsed: 50, moving: false, playing: true })).toBe(true)
    expect(vehicleFrameDue({ changed: true, elapsed: 0, moving: true, playing: false })).toBe(true)
    expect(vehicleFrameDue({ changed: false, elapsed: 100, moving: false, playing: false })).toBe(false)
  })
})

describe('reversible map view control', () => {
  it('flattens then restores the saved 3D orientation without touching zoom or center', () => {
    expect(nextMapView(true, { pitch: 55, bearing: -25 })).toEqual({ pitch: 0, bearing: 0 })
    expect(nextMapView(false, { pitch: 55, bearing: -25 })).toEqual({ pitch: 55, bearing: -25 })
    expect(nextMapView(false, { pitch: 0, bearing: 0 })).toEqual({ pitch: 55, bearing: 0 })
  })
})
