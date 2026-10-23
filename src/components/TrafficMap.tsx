import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl'
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { cellToBoundary, polygonToCells } from 'h3-js'
import type { FeatureCollection, Geometry } from 'geojson'
import type { CameraState, Coordinate, RoutePreview, Selection, SimulationSnapshot } from '../domain/types'
import { coordinateAt, NETWORK, networkGeometry } from '../data/network'
import { DISPLAY_ZONE_IDS, displayZoneStats } from '../lib/zones'
import 'maplibre-gl/dist/maplibre-gl.css'
import './TrafficMap.css'

// Vite prebundles the main module into /node_modules/.vite/deps. MapLibre's
// relative default worker URL would then point to a file that does not exist.
// An explicit Vite asset import emits a same-origin worker in dev AND builds.
maplibregl.setWorkerUrl(mapWorkerUrl)

export interface TrafficMapProps {
  snapshot: SimulationSnapshot
  previousSnapshot?: SimulationSnapshot
  interpolation: number
  viewMode: '2d' | '3d'
  showHexagons: boolean
  showRoutes?: boolean
  route: RoutePreview | null
  camera: CameraState
  onCameraChange: (camera: CameraState) => void
  onSelect: (selection: Selection) => void
  className?: string
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const EDGE_BY_ID = new Map(NETWORK.edges.map(edge => [edge.id, edge]))
const CAR_COLORS = ['#edf3f6', '#d65b57', '#efbd3f', '#3e8abb', '#38a8ad', '#435166']
const THREE_D_LAYERS = ['buildings-shadow', 'buildings-3d', 'building-facades', 'building-roofs', 'scenery-shadow', 'tree-trunks', 'tree-crowns', 'roof-details', 'road-markings']
const [SW, NE] = NETWORK.bounds
const CELLS = polygonToCells([[SW[1], SW[0]], [SW[1], NE[0]], [NE[1], NE[0]], [NE[1], SW[0]], [SW[1], SW[0]]], 10)
const GRID = CELLS.map(id => ({
  id,
  coordinates: cellToBoundary(id, true) as Coordinate[],
}))
const ZONE_GEOMETRY = DISPLAY_ZONE_IDS.flatMap(id => {
  const outer = cellToBoundary(id, true) as Coordinate[]
  const unique = outer.slice(0, -1)
  const center: Coordinate = [unique.reduce((sum, p) => sum + p[0], 0) / unique.length, unique.reduce((sum, p) => sum + p[1], 0) / unique.length]
  const inner = outer.map(p => [center[0] + (p[0] - center[0]) * .994, center[1] + (p[1] - center[1]) * .994] as Coordinate).reverse()
  return [
    { id, kind: 'floor', coordinates: [outer] },
    { id, kind: 'wall', coordinates: [outer, inner] },
    ...unique.map(p => ({ id, kind: 'corner', coordinates: [[[p[0] - .000016, p[1] - .000014], [p[0] + .000016, p[1] - .000014], [p[0] + .000016, p[1] + .000014], [p[0] - .000016, p[1] + .000014], [p[0] - .000016, p[1] - .000014]]] })),
  ]
})
const ZONE_COLOR: ExpressionSpecification = ['match', ['get', 'category'], 'red', '#ef6671', 'yellow', '#eab548', '#46b99a']
const roadWidth = (major: number, minor: number): ExpressionSpecification => ['interpolate', ['exponential', 2], ['zoom'], 14, ['match', ['get', 'highway'], ['primary', 'secondary', 'tertiary'], major / 4, minor / 4], 16, ['match', ['get', 'highway'], ['primary', 'secondary', 'tertiary'], major, minor], 18, ['match', ['get', 'highway'], ['primary', 'secondary', 'tertiary'], major * 4, minor * 4]]
const LABELS: { label: string; coordinate: Coordinate; park?: boolean }[] = [
  { label: 'CENTRAL PARK', coordinate: [77.21967, 28.6328], park: true },
  { label: 'Inner Circle', coordinate: [77.2198, 28.63192] },
  { label: 'Outer Circle', coordinate: [77.2211, 28.63542] },
  { label: 'Middle Circle', coordinate: [77.21754, 28.63306] },
  { label: 'Janpath', coordinate: [77.21943, 28.62805] },
  { label: 'Barakhamba Rd', coordinate: [77.22435, 28.63038] },
  { label: 'Baba Kharak Singh Marg', coordinate: [77.21376, 28.63005] },
  { label: 'State Entry Rd', coordinate: [77.22005, 28.63685] },
  { label: 'Palika Park', coordinate: [77.21866, 28.63071], park: true },
]

function hexData(snapshot: SimulationSnapshot): FeatureCollection {
  const stats = new Map(snapshot.hexStats.map(stat => [stat.id, stat]))
  return {
    type: 'FeatureCollection',
    features: GRID.map(cell => {
      const stat = stats.get(cell.id)
      return { type: 'Feature', properties: { id: cell.id, category: stat?.category ?? 'empty', count: stat?.count ?? 0 }, geometry: { type: 'Polygon', coordinates: [cell.coordinates] } }
    }),
  }
}

function zoneData(snapshot: SimulationSnapshot): FeatureCollection {
  const stats = new Map(displayZoneStats(snapshot).map(stat => [stat.id, stat]))
  return { type: 'FeatureCollection', features: ZONE_GEOMETRY.map(zone => ({ type: 'Feature', properties: { id: zone.id, kind: zone.kind, category: stats.get(zone.id)?.category ?? 'green' }, geometry: { type: 'Polygon', coordinates: zone.coordinates } })) }
}

function activeRoutes(snapshot: SimulationSnapshot): FeatureCollection {
  const ids = new Set(snapshot.vehicles.flatMap(vehicle => vehicle.route.slice(vehicle.routeIndex)))
  return { type: 'FeatureCollection', features: [...ids].flatMap(id => {
    const edge = EDGE_BY_ID.get(id)
    return edge ? [{ type: 'Feature' as const, properties: { id }, geometry: { type: 'LineString' as const, coordinates: edge.coordinates } }] : []
  }) }
}

function vehicleData(props: TrafficMapProps, reducedMotion: boolean): FeatureCollection {
  const previous = new Map(props.previousSnapshot?.vehicles.map(vehicle => [vehicle.id, vehicle]) ?? [])
  return {
    type: 'FeatureCollection',
    features: props.snapshot.vehicles.map(vehicle => {
      const old = previous.get(vehicle.id)
      const edge = EDGE_BY_ID.get(vehicle.edgeId)
      // Only interpolate along the same road polyline. New links snap to their
      // actual entrance, so no vehicle cuts diagonally through a city block.
      const position = !reducedMotion && old?.edgeId === vehicle.edgeId
        ? old.position + (vehicle.position - old.position) * Math.max(0, Math.min(1, props.interpolation))
        : vehicle.position
      const centerline = edge ? coordinateAt(edge, position) : vehicle.coordinate
      const ahead = edge ? coordinateAt(edge, Math.min(edge.length, position + 5)) : centerline
      const behind = edge ? coordinateAt(edge, Math.max(0, position - 5)) : centerline
      const bearing = Math.atan2((ahead[0] - behind[0]) * .878, ahead[1] - behind[1]) * 180 / Math.PI
      const radians = bearing * Math.PI / 180
      // A 1.8 m left-lane display offset separates paired directions. Engine
      // positions, routing and H3 occupancy retain the original coordinates.
      const coordinate = [centerline[0] - Math.cos(radians) * 1.8 / 97600, centerline[1] + Math.sin(radians) * 1.8 / 111320]
      const variant = [...vehicle.id].reduce((hash, char) => hash + char.charCodeAt(0), 0) % CAR_COLORS.length
      return { type: 'Feature', properties: { id: vehicle.id, kind: vehicle.kind, bearing, sprite: `car-${variant}` }, geometry: { type: 'Point', coordinates: coordinate } }
    }),
  }
}

function carSprite(ambulance: boolean, bodyColor = '#435166'): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = 36
  canvas.height = 60
  const c = canvas.getContext('2d')!
  c.fillStyle = '#152533'
  c.fillRect(3, 12, 4, 11)
  c.fillRect(29, 12, 4, 11)
  c.fillRect(3, 39, 4, 10)
  c.fillRect(29, 39, 4, 10)
  c.shadowColor = '#142b4b80'
  c.shadowBlur = 5
  c.shadowOffsetX = 2
  c.shadowOffsetY = 3
  c.fillStyle = ambulance ? '#fffdf7' : bodyColor
  c.strokeStyle = '#ffffffd9'
  c.lineWidth = 1.8
  c.beginPath()
  c.roundRect(6, 4, 24, 51, 7)
  c.fill()
  c.stroke()
  c.shadowBlur = 0
  c.shadowOffsetX = 0
  c.shadowOffsetY = 0
  const glass = c.createLinearGradient(9, 12, 26, 24)
  glass.addColorStop(0, '#77b6c8')
  glass.addColorStop(1, '#234458')
  c.fillStyle = glass
  c.fillRect(9, 14, 18, 10)
  c.fillRect(10, 39, 16, 7)
  c.fillStyle = '#ffffff80'
  c.fillRect(10, 7, 16, 2)
  c.fillStyle = '#fff4bc'
  c.fillRect(7, 5, 5, 4)
  c.fillRect(24, 5, 5, 4)
  c.fillStyle = '#c3393c'
  c.fillRect(7, 50, 5, 3)
  c.fillRect(24, 50, 5, 3)
  if (ambulance) {
    c.fillStyle = '#df4a59'
    c.fillRect(16, 26, 5, 12)
    c.fillRect(12, 30, 13, 5)
    c.fillStyle = '#00b8e5'
    c.fillRect(7, 10, 8, 3)
    c.fillStyle = '#ff5e63'
    c.fillRect(21, 10, 8, 3)
  }
  return c.getImageData(0, 0, 36, 60)
}

function fleetSprite(kind: 'bike' | 'bus'): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = kind === 'bus' ? 42 : 24
  canvas.height = kind === 'bus' ? 100 : 50
  const c = canvas.getContext('2d')!
  c.shadowColor = '#132b4b80'
  c.shadowBlur = 4
  c.shadowOffsetX = 2
  c.shadowOffsetY = 2
  if (kind === 'bus') {
    c.fillStyle = '#214f41'
    c.fillRect(3, 16, 36, 12)
    c.fillRect(3, 70, 36, 12)
    c.fillStyle = '#58a674'
    c.strokeStyle = '#f2fae9'
    c.lineWidth = 2
    c.beginPath()
    c.roundRect(5, 3, 32, 93, 7)
    c.fill()
    c.stroke()
    c.shadowBlur = 0
    c.fillStyle = '#21485b'
    c.fillRect(8, 10, 26, 14)
    c.fillRect(8, 79, 26, 8)
    for (let y = 29; y < 77; y += 12) {
      c.fillRect(7, y, 4, 9)
      c.fillRect(31, y, 4, 9)
    }
    c.fillStyle = '#d4e2d5'
    c.fillRect(14, 36, 14, 12)
    c.fillRect(14, 59, 14, 12)
    c.fillStyle = '#fff6b5'
    c.fillRect(7, 4, 6, 3)
    c.fillRect(29, 4, 6, 3)
    c.fillStyle = '#ed6556'
    c.fillRect(7, 90, 6, 3)
    c.fillRect(29, 90, 6, 3)
  } else {
    c.fillStyle = '#152936'
    c.beginPath()
    c.roundRect(9, 2, 6, 15, 3)
    c.roundRect(9, 33, 6, 15, 3)
    c.fill()
    c.strokeStyle = '#d5e1e7'
    c.lineWidth = 3
    c.beginPath()
    c.moveTo(4, 15)
    c.lineTo(20, 15)
    c.stroke()
    c.fillStyle = '#f1af45'
    c.beginPath()
    c.ellipse(12, 27, 7, 12, 0, 0, Math.PI * 2)
    c.fill()
    c.shadowBlur = 0
    c.fillStyle = '#354c60'
    c.beginPath()
    c.ellipse(12, 29, 4, 7, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#eef4f5'
    c.beginPath()
    c.arc(12, 20, 5, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#fff7bf'
    c.fillRect(10, 7, 4, 3)
    c.fillStyle = '#ed6556'
    c.fillRect(10, 42, 4, 3)
  }
  return c.getImageData(0, 0, canvas.width, canvas.height)
}

/** Small local architectural tiles; no texture service or external images. */
function facadeSprite(facade: string): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const c = canvas.getContext('2d')!
  const colors: Record<string, string> = { heritage: '#f3ead7', stone: '#d0c3ae', glass: '#83afbd', residential: '#dcc1a5' }
  c.fillStyle = colors[facade]
  c.fillRect(0, 0, 64, 64)
  c.fillStyle = facade === 'glass' ? '#426d83' : '#55747a'
  for (let y = 7; y < 64; y += 22) {
    for (let x = 7; x < 64; x += 20) {
      c.fillRect(x, y, facade === 'heritage' ? 10 : 13, 13)
      c.fillStyle = '#b9d8da'
      c.fillRect(x + 1, y + 1, 3, 10)
      c.fillStyle = facade === 'glass' ? '#426d83' : '#55747a'
    }
  }
  c.fillStyle = '#ffffff60'
  if (facade === 'heritage') {
    for (let x = 1; x < 64; x += 20) c.fillRect(x, 0, 4, 64)
    for (let y = 0; y < 64; y += 22) c.fillRect(0, y, 64, 4)
  } else {
    for (let y = 0; y < 64; y += 22) c.fillRect(0, y, 64, 2)
    if (facade === 'glass') for (let x = 0; x < 64; x += 20) c.fillRect(x, 0, 2, 64)
  }
  return c.getImageData(0, 0, 64, 64)
}

function cameraOf(map: LibreMap): CameraState {
  const center = map.getCenter()
  return { longitude: center.lng, latitude: center.lat, zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }
}

function camerasDiffer(a: CameraState, b: CameraState): boolean {
  return Math.abs(a.longitude - b.longitude) > .000001 || Math.abs(a.latitude - b.latitude) > .000001 || Math.abs(a.zoom - b.zoom) > .001 || Math.abs(a.bearing - b.bearing) > .05 || Math.abs(a.pitch - b.pitch) > .05
}

function setSource(map: LibreMap, id: string, data: FeatureCollection) {
  const source = map.getSource(id) as GeoJSONSource | undefined
  if (source) void source.setData(data)
}

const LAST_MAP_STATE = new WeakMap<LibreMap, TrafficMapProps>()

function updateMap(map: LibreMap, props: TrafficMapProps, reducedMotion: boolean) {
  const previous = LAST_MAP_STATE.get(map)
  if (previous?.snapshot !== props.snapshot) {
    setSource(map, props.viewMode === '3d' ? 'zones' : 'hexagons', props.viewMode === '3d' ? zoneData(props.snapshot) : hexData(props.snapshot))
    setSource(map, 'congestion', {
    type: 'FeatureCollection',
    features: props.snapshot.edges.map(stat => ({ type: 'Feature', properties: { category: stat.category, blocked: stat.blocked }, geometry: { type: 'LineString', coordinates: EDGE_BY_ID.get(stat.id)?.coordinates ?? [] } })),
    })
  }
  if (previous?.snapshot !== props.snapshot || previous?.previousSnapshot !== props.previousSnapshot || (!reducedMotion && previous?.interpolation !== props.interpolation)) setSource(map, 'vehicles', vehicleData(props, reducedMotion))
  if (!previous || previous.snapshot !== props.snapshot || previous.showRoutes !== props.showRoutes) setSource(map, 'route', props.showRoutes ? activeRoutes(props.snapshot) : EMPTY)
  if (previous?.showHexagons !== props.showHexagons || previous.viewMode !== props.viewMode) {
    for (const id of ['hex-fill', 'hex-outline']) map.setLayoutProperty(id, 'visibility', props.showHexagons && props.viewMode === '2d' ? 'visible' : 'none')
    for (const id of ['zone-floor', 'zone-walls', 'zone-top']) map.setLayoutProperty(id, 'visibility', props.showHexagons && props.viewMode === '3d' ? 'visible' : 'none')
  }
  if (previous?.viewMode !== props.viewMode) {
    for (const id of THREE_D_LAYERS) map.setLayoutProperty(id, 'visibility', props.viewMode === '3d' ? 'visible' : 'none')
    map.setLayoutProperty('tree-canopy-2d', 'visibility', props.viewMode === '2d' ? 'visible' : 'none')
    map.setPaintProperty('background', 'background-color', props.viewMode === '3d' ? '#e9e9de' : '#f0f3f7')
    map.setPaintProperty('parks', 'fill-color', props.viewMode === '3d' ? '#b7d09e' : '#d5e8d8')
    map.setPaintProperty('roads', 'line-color', props.viewMode === '3d' ? '#798588' : '#fff')
    map.setPaintProperty('roads-casing', 'line-color', props.viewMode === '3d' ? '#c7c9bd' : '#d3dbe5')
    map.setPaintProperty('congestion-line', 'line-opacity', props.viewMode === '3d' ? .32 : .7)
  }
  if (previous?.snapshot.mode !== props.snapshot.mode) map.setPaintProperty('route-line', 'line-color', props.snapshot.mode === 'fixed' ? '#08a9d1' : '#7652dc')
  LAST_MAP_STATE.set(map, props)
}

/** Two independent map instances share only camera values, never GL state. */
export function TrafficMap(props: TrafficMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<LibreMap | null>(null)
  const latest = useRef(props)
  const applyingCamera = useRef(false)
  const reducedMotion = useRef(false)
  const signalMarkers = useRef<{ marker: maplibregl.Marker; button: HTMLButtonElement; id: string; phase: number }[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  useLayoutEffect(() => { latest.current = props }, [props])

  useEffect(() => {
    if (!container.current) return
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let map: LibreMap
    let cameraFrame = 0
    const labels: maplibregl.Marker[] = []
    const loadTimeout = window.setTimeout(() => {
      setError('The interactive map could not finish loading. The local street network remains visible. You can retry below.')
    }, 20000)
    try {
      map = new maplibregl.Map({
        container: container.current,
        center: [latest.current.camera.longitude, latest.current.camera.latitude],
        zoom: latest.current.camera.zoom,
        bearing: latest.current.camera.bearing,
        pitch: latest.current.viewMode === '3d' ? 50 : 0,
        minZoom: 12.3,
        maxZoom: 18.5,
        maxBounds: [[77.201, 28.617], [77.236, 28.648]],
        attributionControl: false,
        renderWorldCopies: false,
        canvasContextAttributes: { antialias: true },
        style: {
          version: 8,
          light: { anchor: 'map', color: '#fff5df', intensity: .48, position: [1.5, 225, 35] },
          sources: {
            roads: { type: 'geojson', data: `${import.meta.env.BASE_URL}map/roads.geojson` },
            buildings: { type: 'geojson', data: `${import.meta.env.BASE_URL}map/buildings.geojson` },
            parks: { type: 'geojson', data: `${import.meta.env.BASE_URL}map/parks.geojson` },
            scenery: { type: 'geojson', data: `${import.meta.env.BASE_URL}map/scenery.geojson` },
            network: { type: 'geojson', data: networkGeometry },
            hexagons: { type: 'geojson', data: EMPTY },
            zones: { type: 'geojson', data: EMPTY },
            vehicles: { type: 'geojson', data: EMPTY },
            route: { type: 'geojson', data: EMPTY },
            congestion: { type: 'geojson', data: EMPTY },
          },
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#f0f3f7' } },
            { id: 'parks', type: 'fill', source: 'parks', paint: { 'fill-color': '#d5e8d8', 'fill-outline-color': '#c4dccb' } },
            { id: 'buildings-shadow', type: 'fill', source: 'buildings', layout: { visibility: 'none' }, paint: { 'fill-color': '#465446', 'fill-opacity': .15, 'fill-translate': [7, 9], 'fill-translate-anchor': 'map' } },
            { id: 'building-footprints', type: 'fill', source: 'buildings', paint: { 'fill-color': ['coalesce', ['get', 'roofColor'], '#d6d9d3'], 'fill-outline-color': '#bfc7c5' } },
            { id: 'roads-casing', type: 'line', source: 'roads', paint: { 'line-color': '#d3dbe5', 'line-width': roadWidth(17, 12) } },
            { id: 'roads', type: 'line', source: 'roads', paint: { 'line-color': '#fff', 'line-width': roadWidth(14, 10) } },
            { id: 'road-markings', type: 'line', source: 'network', layout: { visibility: 'none' }, paint: { 'line-color': '#fff7dd', 'line-width': 1, 'line-dasharray': [2, 5], 'line-opacity': .65 } },
            { id: 'scenery-shadow', type: 'fill', source: 'scenery', filter: ['==', ['get', 'kind'], 'tree-crown'], layout: { visibility: 'none' }, paint: { 'fill-color': '#2d4938', 'fill-opacity': .11, 'fill-translate': [4, 5], 'fill-translate-anchor': 'map' } },
            { id: 'tree-canopy-2d', type: 'fill', source: 'scenery', filter: ['==', ['get', 'kind'], 'tree-crown'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': .52 } },
            { id: 'hex-fill', type: 'fill', source: 'hexagons', paint: { 'fill-color': ['match', ['get', 'category'], 'red', '#eb5961', 'yellow', '#f2bc46', 'green', '#37bb8c', '#94b5d4'], 'fill-opacity': ['match', ['get', 'category'], 'empty', .025, 'green', .10, .32] } },
            { id: 'hex-outline', type: 'line', source: 'hexagons', paint: { 'line-color': '#708eaf', 'line-width': .7, 'line-opacity': .25 } },
            { id: 'zone-floor', type: 'fill', source: 'zones', filter: ['==', ['get', 'kind'], 'floor'], layout: { visibility: 'none' }, paint: { 'fill-color': ZONE_COLOR, 'fill-opacity': .045 } },
            { id: 'network-line', type: 'line', source: 'network', paint: { 'line-color': '#91a5bd', 'line-width': 2, 'line-opacity': .5 } },
            { id: 'congestion-line', type: 'line', source: 'congestion', paint: { 'line-color': ['match', ['get', 'category'], 'red', '#e35a62', 'yellow', '#e3ab31', '#40aa87'], 'line-width': ['case', ['get', 'blocked'], 6, 3], 'line-opacity': .7 } },
            { id: 'route-halo', type: 'line', source: 'route', paint: { 'line-color': '#fff', 'line-width': 9, 'line-opacity': .9 } },
            { id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#7652dc', 'line-width': 5, 'line-opacity': .95 } },
            { id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': ['coalesce', ['get', 'facadeColor'], '#e5d8bf'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } },
            { id: 'building-roofs', type: 'fill-extrusion', source: 'buildings', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': ['coalesce', ['get', 'roofColor'], '#b8bab4'], 'fill-extrusion-height': ['+', ['get', 'height'], .4], 'fill-extrusion-base': ['get', 'height'], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': false } },
            { id: 'roof-details', type: 'fill-extrusion', source: 'scenery', filter: ['==', ['get', 'kind'], 'roof-detail'], layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-opacity': 1 } },
            { id: 'tree-trunks', type: 'fill-extrusion', source: 'scenery', filter: ['==', ['get', 'kind'], 'tree-trunk'], layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-opacity': 1 } },
            { id: 'tree-crowns', type: 'fill-extrusion', source: 'scenery', filter: ['==', ['get', 'kind'], 'tree-crown'], layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } },
            { id: 'zone-walls', type: 'fill-extrusion', source: 'zones', filter: ['in', ['get', 'kind'], ['literal', ['wall', 'corner']]], layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': ZONE_COLOR, 'fill-extrusion-height': 40, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': .18, 'fill-extrusion-vertical-gradient': false } },
            { id: 'zone-top', type: 'fill-extrusion', source: 'zones', filter: ['==', ['get', 'kind'], 'wall'], layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': ZONE_COLOR, 'fill-extrusion-height': 41, 'fill-extrusion-base': 40, 'fill-extrusion-opacity': .6, 'fill-extrusion-vertical-gradient': false } },
          ],
        },
      })
      instance.current = map
      map.scrollZoom.enable()
      map.scrollZoom.setWheelZoomRate(.002)
      map.scrollZoom.setZoomRate(1 / 110)
      map.addControl(new maplibregl.NavigationControl({ showCompass: latest.current.viewMode === '3d', visualizePitch: true }), 'bottom-right')
      map.on('load', () => {
        window.clearTimeout(loadTimeout)
        CAR_COLORS.forEach((color, i) => map.addImage(`car-${i}`, carSprite(false, color), { pixelRatio: 2 }))
        map.addImage('ambulance', carSprite(true), { pixelRatio: 2 })
        map.addImage('bike', fleetSprite('bike'), { pixelRatio: 2 })
        map.addImage('bus', fleetSprite('bus'), { pixelRatio: 2 })
        for (const facade of ['heritage', 'stone', 'glass', 'residential']) map.addImage(`facade-${facade}`, facadeSprite(facade), { pixelRatio: 2 })
        map.addLayer({ id: 'building-facades', type: 'fill-extrusion', source: 'buildings', layout: { visibility: 'none' }, paint: { 'fill-extrusion-pattern': ['concat', 'facade-', ['coalesce', ['get', 'facade'], 'heritage']], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': .8, 'fill-extrusion-vertical-gradient': true } }, 'building-roofs')
        map.addLayer({ id: 'ambulance-halo', type: 'circle', source: 'vehicles', filter: ['==', ['get', 'kind'], 'ambulance'], paint: { 'circle-radius': 12, 'circle-color': '#e64659', 'circle-opacity': .23, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#e64659' } })
        map.addLayer({ id: 'vehicles', type: 'symbol', source: 'vehicles', layout: { 'icon-image': ['match', ['get', 'kind'], 'ambulance', 'ambulance', 'bike', 'bike', 'bus', 'bus', ['get', 'sprite']], 'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 14, .28, 16, .55, 18, 1.8], 'icon-rotate': ['get', 'bearing'], 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true } })
        for (const label of LABELS) {
          const el = document.createElement('span')
          el.className = `traffic-map-label${label.park ? ' traffic-map-label--park' : ''}`
          el.textContent = label.label
          el.setAttribute('aria-hidden', 'true')
          labels.push(new maplibregl.Marker({ element: el }).setLngLat(label.coordinate).addTo(map))
        }
        signalMarkers.current = NETWORK.signals.map(signal => {
          const phase = 0
          const coordinate = NETWORK.nodes.find(node => node.id === signal.nodeId)!.coordinate
          const button = document.createElement('button')
          button.type = 'button'
          button.className = 'traffic-map-signal'
          button.innerHTML = '<svg viewBox="0 0 31 62" aria-hidden="true"><path class="signal-pole-shadow" d="M13 59h13"/><path class="signal-pole" d="M14 60V26h9"/><rect class="signal-housing" x="15" y="2" width="12" height="31" rx="3"/><circle class="signal-red" cx="21" cy="9" r="3.3"/><circle class="signal-amber" cx="21" cy="17.5" r="3.3"/><circle class="signal-green" cx="21" cy="26" r="3.3"/><circle class="signal-other" cx="27" cy="37" r="2.6"/></svg>'
          button.dataset.approach = signal.name
          button.addEventListener('click', event => {
            event.stopPropagation()
            latest.current.onSelect({ type: 'signal', id: signal.id, mode: latest.current.snapshot.mode })
          })
          return { id: signal.id, phase, button, marker: new maplibregl.Marker({ element: button, anchor: 'bottom' }).setLngLat(coordinate).addTo(map) }
        })
        updateMap(map, latest.current, reducedMotion.current)
        setError(null)
        setReady(true)
      })
      map.on('click', event => {
        if (map.getLayer('vehicles')) {
          const { x, y } = event.point
          const vehicle = map.queryRenderedFeatures([[x - 6, y - 6], [x + 6, y + 6]], { layers: ['vehicles'] })[0]
          if (vehicle?.properties?.id) {
            latest.current.onSelect({ type: 'vehicle', id: String(vehicle.properties.id), mode: latest.current.snapshot.mode })
            return
          }
        }
        if (!latest.current.showHexagons) return
        const layers = latest.current.viewMode === '3d' ? ['zone-floor', 'zone-walls', 'zone-top'] : ['hex-fill']
        const feature = map.queryRenderedFeatures(event.point, { layers })[0]
        if (feature?.properties?.id) latest.current.onSelect({ type: 'hex', id: String(feature.properties.id), mode: latest.current.snapshot.mode })
      })
      map.on('move', () => {
        if (applyingCamera.current || cameraFrame) return
        cameraFrame = requestAnimationFrame(() => {
          cameraFrame = 0
          const camera = cameraOf(map)
          if (camerasDiffer(camera, latest.current.camera)) latest.current.onCameraChange(camera)
        })
      })
      map.on('moveend', () => {
        if (applyingCamera.current) return
        cancelAnimationFrame(cameraFrame)
        cameraFrame = 0
        const camera = cameraOf(map)
        if (camerasDiffer(camera, latest.current.camera)) latest.current.onCameraChange(camera)
      })
      map.on('error', event => {
        if (/webgl|context lost/i.test(event.error.message)) {
          setError('Your browser could not start the 3D map. The local street network is shown below. Enable WebGL or retry below.')
        } else if (/worker|fetch|load|network/i.test(event.error.message)) {
          setError('The interactive map is unavailable. The local street network remains visible. You can retry below.')
        }
      })
    } catch {
      window.clearTimeout(loadTimeout)
      cancelAnimationFrame(cameraFrame)
      queueMicrotask(() => setError('Your browser could not start the 3D map. The local street network is shown below. Enable WebGL to explore the full map.'))
      return
    }
    const resize = new ResizeObserver(() => map.resize())
    resize.observe(container.current)
    return () => {
      window.clearTimeout(loadTimeout)
      cancelAnimationFrame(cameraFrame)
      resize.disconnect()
      labels.forEach(label => label.remove())
      signalMarkers.current.forEach(signal => signal.marker.remove())
      signalMarkers.current = []
      map.remove()
      instance.current = null
    }
  }, [retryKey])

  useEffect(() => {
    const map = instance.current
    if (!map || !ready) return
    updateMap(map, props, reducedMotion.current)
  }, [props, ready])

  useEffect(() => {
    if (!ready) return
    signalMarkers.current.forEach(({ id, button, phase }) => {
      const signal = props.snapshot.signals.find(signal => signal.id === id)
      const definition = NETWORK.signals.find(signal => signal.id === id)!
      if (!signal) return
      button.dataset.stage = signal.stage
      button.dataset.phase = String(signal.phase)
      button.dataset.priority = String(signal.priority)
      const light = phase !== signal.phase || signal.stage === 'all-red' ? 'red' : signal.stage === 'amber' ? 'amber' : 'green'
      button.dataset.light = light
      const otherLight = signal.phase !== 1 || signal.stage === 'all-red' ? 'red' : signal.stage === 'amber' ? 'amber' : 'green'
      button.dataset.otherLight = otherLight
      button.title = `${definition.name}: phase 1 ${light}, phase 2 ${otherLight}${signal.priority ? ' · ambulance priority' : ''}`
      button.setAttribute('aria-label', `${button.title}. Inspect signal.`)
    })
  }, [props.snapshot, ready])

  useEffect(() => {
    const map = instance.current
    if (!map || !ready || map.isMoving()) return
    const target = { ...props.camera, pitch: props.viewMode === '2d' ? 0 : props.camera.pitch }
    if (camerasDiffer(cameraOf(map), target)) {
      applyingCamera.current = true
      map.jumpTo({ center: [target.longitude, target.latitude], zoom: target.zoom, bearing: target.bearing, pitch: target.pitch })
      applyingCamera.current = false
    }
  }, [props.camera, props.viewMode, ready])

  return <div className={`traffic-map traffic-map--${props.viewMode} ${props.className ?? ''}`}>
    <div ref={container} className="traffic-map-canvas" inert={!!error} aria-label={`${props.snapshot.mode === 'fixed' ? 'Fixed signal' : 'Optimized'} Connaught Place traffic map`} />
    {!ready && !error && <div className="traffic-map-loading" role="status">Loading local Connaught Place map…</div>}
    {error && <div className="traffic-map-fallback"><div className="traffic-map-recovery"><p role="status">{error}</p><button type="button" onClick={() => { setReady(false); setError(null); setRetryKey(key => key + 1) }}>Retry interactive map</button></div><FallbackNetwork {...props} /></div>}
    <div className="traffic-map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></div>
  </div>
}

function FallbackNetwork(props: TrafficMapProps) {
  const project = (p: Coordinate) => [(p[0] - SW[0]) / (NE[0] - SW[0]) * 800, 600 - (p[1] - SW[1]) / (NE[1] - SW[1]) * 600]
  const path = (points: Coordinate[]) => points.map((p, i) => `${i ? 'L' : 'M'}${project(p).join(',')}`).join(' ')
  const route: FeatureCollection<Geometry> = props.route ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: props.route.coordinates } }] } : EMPTY
  return <svg viewBox="0 0 800 600" role="img" aria-label="Local Connaught Place road network fallback">
    <rect width="800" height="600" fill="#f0f3f7" />
    {props.showHexagons && hexData(props.snapshot).features.map(feature => <path key={feature.properties?.id} d={path((feature.geometry as GeoJSON.Polygon).coordinates[0] as Coordinate[])} fill={feature.properties?.category === 'red' ? '#f6bcc1' : feature.properties?.category === 'yellow' ? '#f8dc9c' : '#d5e8e0'} fillOpacity=".4" stroke="#c6d3df" strokeWidth=".5" />)}
    {NETWORK.edges.map(edge => <path key={edge.id} d={path(edge.coordinates)} fill="none" stroke="#9cb0c4" strokeWidth="5" />)}
    {route.features.map((f, i) => <path key={i} d={path((f.geometry as GeoJSON.LineString).coordinates as Coordinate[])} fill="none" stroke={props.snapshot.mode === 'fixed' ? '#08a9d1' : '#7652dc'} strokeWidth="7" />)}
    {props.snapshot.vehicles.map(vehicle => <circle key={vehicle.id} cx={project(vehicle.coordinate)[0]} cy={project(vehicle.coordinate)[1]} r={vehicle.kind === 'ambulance' ? 5 : 2.3} fill={vehicle.kind === 'ambulance' ? '#e64659' : '#284563'} />)}
    {LABELS.map(label => <text key={label.label} x={project(label.coordinate)[0]} y={project(label.coordinate)[1]} textAnchor="middle" fontSize="12" fill="#40566c">{label.label}</text>)}
  </svg>
}

export default TrafficMap

