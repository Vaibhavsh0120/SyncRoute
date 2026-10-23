import { latLngToCell } from 'h3-js'
import type { Coordinate, HexStat, RoadEdge, RoadNetwork, VehicleSnapshot } from '../domain/types'
import { categoryReason, classifyTraffic, projectOccupancy, type OccupancySample } from './category'

export const H3_RESOLUTION = 10
export const vehicleCell = (coordinate: Coordinate): string => latLngToCell(coordinate[1], coordinate[0], H3_RESOLUTION)

/** Geometry interpolation uses segment distances, preserving bends in the road polyline. */
export function coordinateAt(edge: RoadEdge, position: number): Coordinate {
  const points = edge.coordinates
  if (points.length < 2) return [...points[0]!] as Coordinate
  const lengths = points.slice(1).map((p,i) => Math.hypot((p[0]-points[i]![0]) * Math.cos(p[1]*Math.PI/180), p[1]-points[i]![1]))
  let remaining = Math.max(0,Math.min(1,position/edge.length))*lengths.reduce((sum,x)=>sum+x,0)
  for (let i = 0; i < lengths.length; i++) { const length=lengths[i]!; if (remaining<=length || i===lengths.length-1) { const f=length ? remaining/length : 0; return [points[i]![0]+(points[i+1]![0]-points[i]![0])*f,points[i]![1]+(points[i+1]![1]-points[i]![1])*f] }; remaining-=length }
  return [...points[points.length-1]!] as Coordinate
}

/** Each link's finite storage is divided across H3 cells by sampled road length, not cell area. */
export function createCellCapacities(network: RoadNetwork): Map<string,number> {
  const capacities = new Map<string,number>()
  for (const edge of network.edges) {
    const samples = Math.max(1,Math.ceil(edge.length/5))
    for (let i=0;i<samples;i++) { const cell=vehicleCell(coordinateAt(edge,(i+.5)*edge.length/samples)); capacities.set(cell,(capacities.get(cell)??0)+Math.min(edge.capacity,Math.floor(edge.length/7.5))*1/samples) }
  }
  return capacities
}

export function aggregateHexes(vehicles: VehicleSnapshot[], capacities: Map<string,number>, histories: Map<string,OccupancySample[]>, time:number, record=true): HexStat[] {
  const groups = new Map<string,VehicleSnapshot[]>()
  for(const vehicle of vehicles){const cell=vehicleCell(vehicle.coordinate); const group=groups.get(cell)??[];group.push(vehicle);groups.set(cell,group)}
  const result: HexStat[]=[]
  for(const [id,capacity] of capacities){
    const group=groups.get(id)??[], count=group.length, stopped=group.filter(v=>v.speed<.5).length
    const occupancy=Math.min(1,count/Math.max(1,capacity)), averageSpeed=count?group.reduce((sum,v)=>sum+v.speed,0)/count:0
    const speedRatio=count?group.reduce((sum,v)=>sum+v.speed/v.freeFlowSpeed,0)/count:1
    const history=histories.get(id)??[]
    if(record){history.push({time,occupancy});while(history.length&&history[0]!.time<time-30)history.shift();histories.set(id,history)}
    const predictedOccupancy=projectOccupancy(history,time,occupancy)
    const condition={count,stopped,occupancy,speedRatio,predictedOccupancy}
    result.push({id,count,stopped,occupancy,averageSpeed,speedRatio,predictedOccupancy,category:classifyTraffic(condition),reason:categoryReason(condition)})
  }
  // A point on an exact cell boundary may occupy a tiny road sliver missed by midpoint sampling.
  for(const [id,group] of groups)if(!capacities.has(id)){
    capacities.set(id,1)
    const condition={count:group.length,stopped:group.filter(v=>v.speed<.5).length,speedRatio:group.reduce((sum,v)=>sum+v.speed/v.freeFlowSpeed,0)/group.length,occupancy:1,predictedOccupancy:1}
    result.push({id,...condition,averageSpeed:group.reduce((s,v)=>s+v.speed,0)/group.length,category:classifyTraffic(condition),reason:categoryReason(condition)})
  }
  return result
}
