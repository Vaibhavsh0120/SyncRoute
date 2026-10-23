import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import type { VehicleKind } from '../domain/types'

interface VehicleProperties { id: string; kind: VehicleKind; bearing: number; color: string }
interface VehiclePart { x: number; y: number; width: number; length: number; base: number; height: number; color: string; chamfer?: number; shadow?: boolean }
interface PreparedPart { ring: number[][]; base: number; height: number; color: string; shadow?: boolean }

// Metres, in each vehicle's local frame: x is right and y is forward.
// Compact buses fit the simulation's shared 7.5 m queue slot. Width/height
// preserve a readable bus silhouette; this is a stylized fleet, not a CAD model.
// Telemetry, road occupancy and simulation positions are never modified.
const GLASS = '#284f62'
const TYRE = '#25313a'
const wheel = (x: number, y: number, length = .68): VehiclePart => ({ x, y, width: .25, length, base: .1, height: .6, color: TYRE })
const part = (x: number, y: number, width: number, length: number, base: number, height: number, color: string, chamfer = 0): VehiclePart => ({ x, y, width, length, base, height, color, chamfer })

function vehicleParts(kind: VehicleKind, body: string): VehiclePart[] {
  if (kind === 'bike') return [
    part(0, .86, .2, .64, .1, .65, TYRE, .08),
    part(0, -.86, .2, .64, .1, .65, TYRE, .08),
    part(0, 0, .42, 1.4, .34, .72, '#efaa3c', .16),
    part(0, -.25, .37, .7, .7, .9, TYRE, .08),
    part(0, .58, .9, .12, .85, 1, '#a6b2b9'),
    part(0, -.12, .62, .62, .88, 1.45, '#4e6c85', .18),
    part(0, .2, .4, .42, 1.42, 1.78, '#f4f2e9', .15),
    part(0, .89, .2, .12, .5, .7, '#ffefb7'),
    part(0, -.92, .22, .1, .5, .63, '#e45a52'),
  ]
  if (kind === 'bus') return [
    wheel(-1.2, 3.55, .95), wheel(1.2, 3.55, .95), wheel(-1.2, -3.5, .95), wheel(1.2, -3.5, .95),
    part(0, 0, 2.45, 10.3, .38, 1.45, '#4e9568', .25),
    part(0, 0, 2.48, 10.1, 1.45, 1.62, '#efefd8', .2),
    part(0, 0, 2.36, 9.95, 1.62, 2.64, GLASS, .2),
    part(0, -.15, 2.42, 9.9, 2.64, 2.94, '#cfe0c8', .3),
    ...[-3.3, -1.7, -.1, 1.5, 3.1].map(y => part(0, y, 2.41, .12, 1.62, 2.67, '#3e7b58')),
    part(0, .95, 1.05, 1.5, 2.94, 3.18, '#8eaaa8', .12),
    part(0, -2.35, 1.05, 1.5, 2.94, 3.18, '#8eaaa8', .12),
    part(0, 4.99, 1.1, .12, 2.64, 2.88, '#e9be50'),
    part(-.8, 5.08, .42, .12, .8, 1.1, '#fff3b5'),
    part(.8, 5.08, .42, .12, .8, 1.1, '#fff3b5'),
    part(0, -5.08, 2.1, .12, .65, .88, '#da6255'),
  ]
  if (kind === 'ambulance') return [
    wheel(-.98, 1.7), wheel(.98, 1.7), wheel(-.98, -1.65), wheel(.98, -1.65),
    part(0, 0, 1.96, 5.3, .34, 1.15, '#f8f6eb', .2),
    part(0, -.5, 1.98, 3.9, 1.15, 1.4, '#e35058', .1),
    part(0, -.5, 1.98, 3.9, 1.4, 2.25, '#f8f6eb', .1),
    part(0, 1.48, 1.75, 1.7, 1.15, 1.9, GLASS, .2),
    part(0, 1.1, 1.75, .8, 1.9, 2.05, '#ecefdf', .15),
    part(0, -.55, .3, 1.25, 2.25, 2.3, '#d84d55'),
    part(0, -.55, 1.1, .3, 2.25, 2.3, '#d84d55'),
    part(-.45, .55, .7, .26, 2.25, 2.44, '#399acb'),
    part(.45, .55, .7, .26, 2.25, 2.44, '#ed6268'),
    part(0, 2.54, 1.65, .1, .65, .88, '#fff1b5'),
    part(0, -2.57, 1.65, .1, .65, .88, '#d94e55'),
  ]
  return [
    wheel(-.87, 1.42), wheel(.87, 1.42), wheel(-.87, -1.38), wheel(.87, -1.38),
    part(0, 0, 1.8, 4.4, .28, .97, body, .22),
    part(0, -.15, 1.62, 2.55, .97, 1.45, GLASS, .28),
    part(0, -.25, 1.48, 1.42, 1.45, 1.52, body, .16),
    part(0, -.22, 1.65, .13, 1.02, 1.46, body),
    part(0, 1.68, 1.35, .6, .97, 1.01, body, .08),
    part(-.57, 2.1, .38, .12, .62, .9, '#fff2bd'),
    part(.57, 2.1, .38, .12, .62, .9, '#fff2bd'),
    part(-.57, -2.1, .4, .12, .62, .87, '#d84f51'),
    part(.57, -2.1, .4, .12, .62, .87, '#d84f51'),
  ]
}

function prepareParts(kind: VehicleKind, body: string): PreparedPart[] {
  const shadowLength = kind === 'bus' ? 10.6 : kind === 'ambulance' ? 5.6 : kind === 'bike' ? 2.5 : 4.7
  const shadowWidth = kind === 'bus' ? 2.7 : kind === 'bike' ? .9 : 2.1
  const parts: VehiclePart[] = [{ x: .45, y: -.45, width: shadowWidth, length: shadowLength, base: 0, height: 0, color: '#233941', chamfer: .2, shadow: true }, ...vehicleParts(kind, body)]
  return parts.map(p => {
    const x0 = p.x - p.width / 2, x1 = p.x + p.width / 2
    const y0 = p.y - p.length / 2, y1 = p.y + p.length / 2
    const c = Math.min(p.chamfer ?? 0, p.width / 3, p.length / 3)
    const ring = c ? [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]] : [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    if (kind === 'bus') for (const corner of ring) corner[1] *= .63
    return { ring, color: p.color, base: p.base, height: p.height, shadow: p.shadow }
  })
}

const PARTS = new Map<string, PreparedPart[]>()

/** Build one batched source, rather than a DOM marker or WebGL object per car. */
export function vehicleGeometry(points: FeatureCollection<Point, VehicleProperties>): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = []
  for (const vehicle of points.features) {
    const { id, kind, bearing, color } = vehicle.properties
    const key = `${kind}:${color}`
    let parts = PARTS.get(key)
    if (!parts) {
      parts = prepareParts(kind, color)
      PARTS.set(key, parts)
    }
    const radians = bearing * Math.PI / 180
    const sin = Math.sin(radians)
    const cos = Math.cos(radians)
    const [longitude, latitude] = vehicle.geometry.coordinates
    const metresLongitude = 111320 * Math.cos(latitude * Math.PI / 180)
    parts.forEach((p, index) => {
      const ring = p.ring.map(([x, y]) => [longitude + (x * cos + y * sin) / metresLongitude, latitude + (-x * sin + y * cos) / 111320])
      ring.push(ring[0])
      features.push({ type: 'Feature', id: `${id}-${index}`, properties: { id, kind, part: p.shadow ? 'shadow' : 'body', color: p.color, base: p.base, height: p.height }, geometry: { type: 'Polygon', coordinates: [ring] } })
    })
  }
  return { type: 'FeatureCollection', features }
}

export type { VehicleProperties }
