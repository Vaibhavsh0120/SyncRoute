import { describe, expect, it } from 'vitest'
import type { FeatureCollection, Point, Polygon } from 'geojson'
import type { VehicleKind } from '../domain/types'
import { vehicleGeometry } from './vehicleGeometry'
import type { VehicleProperties } from './vehicleGeometry'

const origin = [77.219, 28.632]
const make = (kind: VehicleKind, bearing = 0): FeatureCollection<Point, VehicleProperties> => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'fleet-1', kind, bearing, color: '#d65b57' }, geometry: { type: 'Point', coordinates: origin } }] })
const extent = (collection: FeatureCollection<Polygon>, axis: 0 | 1) => {
  const values = collection.features.filter(f => f.properties?.part !== 'shadow').flatMap(f => f.geometry.coordinates[0].map(p => p[axis]))
  return (Math.max(...values) - Math.min(...values)) * (axis === 0 ? 111320 * Math.cos(origin[1] * Math.PI / 180) : 111320)
}

describe('volumetric traffic fleet', () => {
  it('emits closed finite parts and nonnegative height ranges for every vehicle kind', () => {
    for (const kind of ['car', 'bike', 'bus', 'ambulance'] as const) {
      const output = vehicleGeometry(make(kind, 37))
      expect(output.features.length).toBeGreaterThan(7)
      expect(new Set(output.features.map(f => f.id)).size).toBe(output.features.length)
      for (const feature of output.features) {
        const ring = feature.geometry.coordinates[0]
        expect(ring[0]).toEqual(ring[ring.length - 1])
        expect(ring.flat().every(Number.isFinite)).toBe(true)
        expect(feature.properties?.id).toBe('fleet-1')
        expect(feature.properties?.base).toBeGreaterThanOrEqual(0)
        expect(feature.properties?.height).toBeGreaterThanOrEqual(feature.properties?.base)
      }
    }
  })

  it('rotates local forward geometry north, east and south without moving the footprint', () => {
    const north = vehicleGeometry(make('car'))
    const east = vehicleGeometry(make('car', 90))
    expect(extent(north, 1)).toBeCloseTo(4.4, 4)
    expect(extent(east, 0)).toBeCloseTo(4.4, 4)
    expect(extent(north, 0)).toBeCloseTo(extent(east, 1), 4)
    const lightLatitude = (bearing: number) => {
      const headlight = vehicleGeometry(make('car', bearing)).features.find(f => f.properties?.color === '#fff2bd')!
      return headlight.geometry.coordinates[0].reduce((sum, p) => sum + p[1], 0) / headlight.geometry.coordinates[0].length
    }
    expect(lightLatitude(0)).toBeGreaterThan(origin[1])
    expect(lightLatitude(180)).toBeLessThan(origin[1])
  })

  it('keeps the stylized bus within the shared queue slot and preserves fleet size hierarchy', () => {
    const bike = extent(vehicleGeometry(make('bike')), 1)
    const car = extent(vehicleGeometry(make('car')), 1)
    const ambulance = extent(vehicleGeometry(make('ambulance')), 1)
    const bus = extent(vehicleGeometry(make('bus')), 1)
    expect(bike).toBeLessThan(car)
    expect(car).toBeLessThan(ambulance)
    expect(ambulance).toBeLessThan(bus)
    expect(bus).toBeLessThan(7)
    expect(vehicleGeometry({ type: 'FeatureCollection', features: [] }).features).toEqual([])
  })
})
