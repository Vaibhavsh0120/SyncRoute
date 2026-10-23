import type { RoadEdge, RoadNetwork, RoutePreview } from '../domain/types'

export type EdgeCost = (edge: RoadEdge) => number
const adjacencyCache=new WeakMap<RoadNetwork,Map<string,RoadEdge[]>>()
function adjacency(network:RoadNetwork){
  let graph=adjacencyCache.get(network)
  if(!graph){graph=new Map();for(const edge of network.edges){const list=graph.get(edge.from)??[];list.push(edge);graph.set(edge.from,list)}for(const list of graph.values())list.sort((a,b)=>a.id.localeCompare(b.id));adjacencyCache.set(network,graph)}
  return graph
}
type Entry={id:string;distance:number}
const earlier=(a:Entry,b:Entry)=>a.distance<b.distance||a.distance===b.distance&&a.id<b.id
function push(heap:Entry[],item:Entry){heap.push(item);let i=heap.length-1;while(i){const parent=(i-1)>>1;if(!earlier(item,heap[parent]!))break;heap[i]=heap[parent]!;i=parent}heap[i]=item}
function pop(heap:Entry[]):Entry|undefined{
  const first=heap[0],last=heap.pop();if(!heap.length||!last)return first
  let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&earlier(heap[child+1]!,heap[child]!))child++;if(!earlier(heap[child]!,last))break;heap[i]=heap[child]!;i=child}heap[i]=last;return first
}
export function shortestPath(network: RoadNetwork, origin: string, destination: string, cost: EdgeCost = e => e.length / e.freeFlowSpeed, previousNode?: string): RoutePreview | null {
  if (!network.nodes.some(n => n.id === origin) || !network.nodes.some(n => n.id === destination)) return null
  if (origin === destination) return { edgeIds: [], coordinates: [], distance: 0, travelTime: 0 }
  const distances = new Map<string, number>([[origin, 0]])
  const previous = new Map<string, RoadEdge>()
  const visited = new Set<string>()
  const graph=adjacency(network),heap:Entry[]=[];push(heap,{id:origin,distance:0})
  while (heap.length) {
    const {id,distance}=pop(heap)!
    if(visited.has(id)||distance>(distances.get(id)??Infinity))continue
    if (id === destination) break
    visited.add(id)
    for (const edge of graph.get(id)??[]) {
      if (visited.has(edge.to) || (id === origin && edge.to === previousNode)) continue
      const candidate = distance + Math.max(.001, cost(edge))
      if (candidate < (distances.get(edge.to) ?? Infinity) - 1e-9) { distances.set(edge.to, candidate); previous.set(edge.to, edge);push(heap,{id:edge.to,distance:candidate}) }
    }
  }
  if (!distances.has(destination)) return null
  const edges: RoadEdge[] = []
  let node = destination
  while (node !== origin) { const edge = previous.get(node); if (!edge) return null; edges.unshift(edge); node = edge.from }
  return { edgeIds: edges.map(e => e.id), coordinates: edges.flatMap((e,i) => e.coordinates.slice(i ? 1 : 0).map(c => [...c] as [number,number])), distance: edges.reduce((sum,e) => sum+e.length,0), travelTime: distances.get(destination)! }
}
