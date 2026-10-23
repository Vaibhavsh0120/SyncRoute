import { latLngToCell, cellToBoundary } from 'h3-js'
import type { Coordinate, HexStat, SimulationSnapshot } from '../domain/types'
import { NETWORK } from '../data/network'

/**
 * 3–4 large H3 resolution-7 hexagonal zone boundaries displayed on the 3D map.
 * These are coarser "district" cells that aggregate the finer res-10 traffic data.
 */
const ZONE_RESOLUTION = 7

/** Seed the zone set from the network center and its surroundings. */
function computeDisplayZones(): string[] {
  const center = NETWORK.center
  // Sample a few points across the CP area to get distinct res-7 cells
  const samplePoints: Coordinate[] = [
    center,
    [center[0] + 0.004, center[1] + 0.003],   // NE
    [center[0] - 0.004, center[1] + 0.003],   // NW
    [center[0], center[1] - 0.004],            // S
  ]
  const ids = new Set<string>()
  for (const point of samplePoints) {
    ids.add(latLngToCell(point[1], point[0], ZONE_RESOLUTION))
  }
  return [...ids]
}

export const DISPLAY_ZONE_IDS: string[] = computeDisplayZones()

export interface ZoneStat {
  id: string
  category: 'green' | 'yellow' | 'red'
  count: number
  stopped: number
  averageSpeed: number
}

/**
 * Aggregate res-10 hex stats into the coarser display zones.
 * Each res-10 cell maps to exactly one res-7 parent; we look up the parent
 * for every occupied res-10 cell and merge stats by zone.
 */
export function displayZoneStats(snapshot: SimulationSnapshot): ZoneStat[] {
  const zoneSet = new Set(DISPLAY_ZONE_IDS)
  // Group hex stats by their parent res-7 cell
  const groups = new Map<string, HexStat[]>()
  for (const hex of snapshot.hexStats) {
    if (hex.count === 0) continue
    // Get the center of this res-10 cell and find its res-7 parent
    const boundary = cellToBoundary(hex.id, true) as Coordinate[]
    const center: Coordinate = [
      boundary.reduce((s, p) => s + p[0], 0) / boundary.length,
      boundary.reduce((s, p) => s + p[1], 0) / boundary.length,
    ]
    const parent = latLngToCell(center[1], center[0], ZONE_RESOLUTION)
    if (!zoneSet.has(parent)) continue
    const group = groups.get(parent) ?? []
    group.push(hex)
    groups.set(parent, group)
  }

  return DISPLAY_ZONE_IDS.map(id => {
    const group = groups.get(id) ?? []
    const count = group.reduce((s, h) => s + h.count, 0)
    const stopped = group.reduce((s, h) => s + h.stopped, 0)
    const averageSpeed = count > 0
      ? group.reduce((s, h) => s + h.averageSpeed * h.count, 0) / count
      : 0
    // Zone category: red if any constituent cell is red, yellow if any is yellow
    let category: 'green' | 'yellow' | 'red' = 'green'
    if (group.some(h => h.category === 'red')) category = 'red'
    else if (group.some(h => h.category === 'yellow')) category = 'yellow'
    return { id, category, count, stopped, averageSpeed }
  })
}
