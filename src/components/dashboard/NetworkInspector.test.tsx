import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NetworkInspector } from './NetworkInspector'
import { createComparison, createScenario, snapshotComparison } from '../../simulation'
import type { VehicleSnapshot } from '../../domain/types'

const snapshot = snapshotComparison(createComparison(createScenario('city'))).optimized
const vehicle: VehicleSnapshot = {
  id: 'bus-001', kind: 'bus', edgeId: 'unknown-road', position: 40,
  coordinate: [77.22, 28.63], speed: 5, freeFlowSpeed: 10, waitingTime: 12,
  route: ['unknown-road'], routeIndex: 0, origin: 'janpath', destination: 'state-entry', reroutes: 2,
}

describe('network inspector', () => {
  it('shows a selected vehicle and converts its measured speed to km/h', () => {
    const html = renderToStaticMarkup(<NetworkInspector selection={{ type: 'vehicle', id: vehicle.id, mode: 'optimized' }} snapshot={{ ...snapshot, vehicles: [vehicle] }} onClear={() => {}} />)
    expect(html).toContain('Bus')
    expect(html).toContain('18.0 km/h')
    expect(html).toContain('12 sec')
    expect(html).toContain('Route changes')
    expect(html).toContain('bus-001')
  })
  it('explains a vehicle that has left the network instead of silently showing an empty inspector', () => {
    const html = renderToStaticMarkup(<NetworkInspector selection={{ type: 'vehicle', id: vehicle.id, mode: 'optimized' }} snapshot={snapshot} onClear={() => {}} />)
    expect(html).toContain('This vehicle has left the network.')
    expect(html).toContain('Clear selection')
  })
  it('explains an empty hexagon without calling it free-flow measured traffic', () => {
    const html = renderToStaticMarkup(<NetworkInspector selection={{ type: 'hex', id: 'empty-cell', mode: 'optimized' }} snapshot={snapshot} onClear={() => {}} />)
    expect(html).toContain('No vehicles in this cell')
    expect(html).toContain('empty-cell')
    expect(html).not.toContain('km/h')
  })
})
