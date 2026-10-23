import type { ComparisonSnapshot, Decision, Demand, EdgeSnapshot, HistoryPoint, Mode, RoadEdge, RoadNetwork, RoutePreview, Scenario, SignalDefinition, SignalSnapshot, SimulationSnapshot, VehicleSnapshot } from '../domain/types'
import { NETWORK } from '../data/network'
import { getAreaContext } from '../data/context'
import { classifyTraffic, projectOccupancy, type OccupancySample } from './category'
import { aggregateHexes, coordinateAt, createCellCapacities, vehicleCell } from './hex'
import { shortestPath } from './routing'

const GAP = 7.5
interface Vehicle extends VehicleSnapshot { departure: number; adoptsRouting: boolean; lastReroute: number }
interface SignalState {
  definition: SignalDefinition; phase: 0 | 1; nextPhase: 0 | 1; stage: SignalSnapshot['stage']; started: number
  pressure: [number,number]; priority: boolean; recovery: 0 | 1 | null; lastService: [number,number]; serviceViolations: number; blocked: boolean
  fixedDuration?: number
}
export interface SimulationWorld {
  scenario: Scenario; mode: Mode; network: RoadNetwork; time: number; vehicles: Vehicle[]; boundary: Demand[]; demandIndex: number
  edgeGroups:Map<string,Vehicle[]>; routes:Map<string,RoutePreview|null>
  signals: SignalState[]; edgeMap: Map<string,RoadEdge>; discharge: Map<string,number>; edgeHistory: Map<string,OccupancySample[]>
  cellCapacities: Map<string,number>; cellHistory: Map<string,OccupancySample[]>; edgeStats: EdgeSnapshot[]
  completed: number; completedTravelTime: number; completedWaitingTime: number; ambulanceTravelTime: number | null; totalWaitingTime: number; totalSystemTime: number
  peakQueue: number; reroutes: number; spillbackSeconds: number; speedHistory: number[]; history: HistoryPoint[]; decisions: Decision[]
  decisionTimes: Map<string,number>; decisionSerial: number; snapshot: SimulationSnapshot
}
export interface Comparison { scenario: Scenario; fixed: SimulationWorld; optimized: SimulationWorld }

const capacity = (edge: RoadEdge) => Math.max(1,Math.min(edge.capacity,Math.floor(edge.length/GAP)))
const weatherFactor = (world:SimulationWorld) => world.scenario.id==='city'?getAreaContext(world.time).weather.speedFactor:1
const headway = (world: SimulationWorld, edgeId: string) => 2 / world.scenario.events.filter(e=>e.edgeId===edgeId&&world.time>=e.start&&world.time<e.end).reduce((f,e)=>f*e.factor,1)
const edgeVehicles = (world: SimulationWorld, edgeId:string) => world.edgeGroups.get(edgeId)??[]
const canReceive = (world: SimulationWorld, edgeId:string) => {
  const edge=world.edgeMap.get(edgeId)!
  const vehicles=edgeVehicles(world,edgeId)
  return vehicles.length<capacity(edge)&&(!vehicles.length||vehicles[vehicles.length-1]!.position>=GAP-1e-9)
}

function decision(world: SimulationWorld, key:string, item:Omit<Decision,'id'|'time'>, cooldown=30) {
  if(world.time-(world.decisionTimes.get(key)??-Infinity)<cooldown)return
  world.decisionTimes.set(key,world.time)
  world.decisions.unshift({...item,id:`${world.mode}-${++world.decisionSerial}`,time:world.time})
  if(world.decisions.length>100)world.decisions.length=100
}

function edgeCost(stats:Map<string,EdgeSnapshot>, edge:RoadEdge):number {
  const s=stats.get(edge.id)
  if(!s)return edge.length/edge.freeFlowSpeed
  const preventive=s.category==='yellow'? 25*Math.max(.2,s.predictedOccupancy-.4):0
  return edge.length/edge.freeFlowSpeed + s.stopped*s.dischargeHeadway + preventive + (s.occupancy>=.95?60:0)
}

function signalCycle(id: string, seed: number): number {
  if (id === 's') return 30
  let h = seed
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return 20 + Math.abs(h) % 21 // 20 to 40 seconds
}

function signalOffset(id: string, seed: number, cycle: number): number {
  if (id === 's') return 0
  let h = (seed * 17) | 0
  for (let i = 0; i < id.length; i++) h = (h * 37 + id.charCodeAt(i)) | 0
  return -(Math.abs(h) % cycle)
}

function signalPhase(id: string, seed: number): 0 | 1 {
  if (id === 's') return 0
  let h = (seed * 43) | 0
  for (let i = 0; i < id.length; i++) h = (h * 13 + id.charCodeAt(i)) | 0
  return (Math.abs(h) % 2) as 0 | 1
}

export function createWorld(scenario:Scenario,mode:Mode,network:RoadNetwork=NETWORK):SimulationWorld {
  const world: SimulationWorld={
    scenario,mode,network,time:0,vehicles:[],boundary:[],demandIndex:0,edgeGroups:new Map(network.edges.map(e=>[e.id,[]])),routes:new Map(),
    signals:network.signals.map(definition => {
      const fixedDuration = definition.id === 's' ? 30 : signalCycle(definition.id, scenario.seed)
      const phase = (mode === 'fixed' && definition.id !== 's') ? signalPhase(definition.id, scenario.seed) : 0
      const started = (mode === 'fixed' && definition.id !== 's') ? signalOffset(definition.id, scenario.seed, fixedDuration) : 0
      return {
        definition,
        phase,
        nextPhase: phase,
        stage: 'green' as const,
        started,
        fixedDuration,
        pressure: [0, 0] as [number, number],
        priority: false,
        recovery: null,
        lastService: [started, started] as [number, number],
        serviceViolations: 0,
        blocked: false,
      }
    }),
    edgeMap:new Map(network.edges.map(e=>[e.id,e])),discharge:new Map(),edgeHistory:new Map(),cellCapacities:createCellCapacities(network),cellHistory:new Map(),edgeStats:[],
    completed:0,completedTravelTime:0,completedWaitingTime:0,ambulanceTravelTime:null,totalWaitingTime:0,totalSystemTime:0,peakQueue:0,reroutes:0,spillbackSeconds:0,speedHistory:[],history:[],decisions:[],decisionTimes:new Map(),decisionSerial:0,snapshot:null as unknown as SimulationSnapshot,
  }
  refreshSnapshot(world)
  return world
}

function startSwitch(world:SimulationWorld,signal:SignalState,target:0|1,reason:string,type:Decision['type']='signal') {
  if(signal.stage!=='green'||target===signal.phase)return
  signal.nextPhase=target;signal.stage='amber';signal.started=world.time
  decision(world,`${signal.definition.id}-${type}-${target}`,{type,nodeId:signal.definition.nodeId,title:type==='priority'?'Ambulance clearance requested':type==='prevention'?'Preventive green adjustment':'Signal phase change',detail:`${signal.definition.name}: ${reason}. Two seconds amber and one second all-red precede phase ${target+1}.`},10)
}

function incomingDemand(world:SimulationWorld,edgeId:string,stats:Map<string,EdgeSnapshot>) {
  const edge=world.edgeMap.get(edgeId)!
  const vehicles=edgeVehicles(world,edgeId)
  const queue=vehicles.filter(v=>v.speed<.5).length
  const approaching=vehicles.filter(v=>v.speed>=.5&&(edge.length-v.position)/(edge.freeFlowSpeed*weatherFactor(world))<=30).length
  const forecast=stats.get(edgeId)
  const yellow=forecast?.category==='yellow'?Math.max(.5,(forecast.predictedOccupancy-forecast.occupancy)*capacity(edge)):0
  // A single lane cannot serve a follower's free turn past a blocked leading car.
  // Determine physical feasibility from the head separately from aggregate pressure.
  const head=vehicles[0],headReceiver=head?.route[head.routeIndex+1]
  const feasible=!!head&&(!headReceiver||canReceive(world,headReceiver))
  // Vehicles ending their trip do not require downstream road storage.
  const room=vehicles.length?vehicles.reduce((sum,v)=>{
    const next=v.route[v.routeIndex+1]
    if(!next)return sum+1
    const receiver=stats.get(next),receiverEdge=world.edgeMap.get(next)!
    const free=1-(receiver?.occupancy??0)
    return sum+(canReceive(world,next)?Math.max(.1,free):0)*Math.min(1,capacity(receiverEdge)/4)
  },0)/vehicles.length:1
  return {score:feasible?(queue+approaching*.6+yellow*1.5)*room:0,feasible,count:vehicles.length,yellow:yellow>0}
}

function updateSignals(world:SimulationWorld) {
  const stats=new Map(world.edgeStats.map(e=>[e.id,e]))
  for(const signal of world.signals){
    const elapsed=world.time-signal.started
    if(signal.stage==='amber'&&elapsed>=2){signal.stage='all-red';signal.started=world.time}
    else if(signal.stage==='all-red'&&elapsed>=1){signal.stage='green';signal.phase=signal.nextPhase;signal.started=world.time}
    const demand=signal.definition.phases.map(edges=>edges.map(id=>incomingDemand(world,id,stats)))
    signal.pressure=[demand[0]!.reduce((s,x)=>s+x.score,0),demand[1]!.reduce((s,x)=>s+x.score,0)]
    const feasible=demand.map(phase=>phase.some(x=>x.count>0&&x.feasible))
    signal.blocked=demand.some(phase=>phase.some(x=>x.count>0))&&!feasible.some(Boolean)
    for(const phase of [0,1] as const){
      if(!feasible[phase]||signal.phase===phase&&signal.stage==='green')signal.lastService[phase]=world.time
      else if(world.time-signal.lastService[phase]>90)signal.serviceViolations++
    }
    if(world.mode==='fixed'){
      const cycle = signal.fixedDuration ?? 30
      if(signal.stage==='green'&&world.time-signal.started>=cycle)startSwitch(world,signal,signal.phase===0?1:0,`fixed ${cycle}-second green elapsed`)
      continue
    }
    const approachingAmbulance=world.vehicles.find(v=>v.kind==='ambulance'&&signal.definition.phases.some(phase=>phase.includes(v.edgeId))&&world.edgeMap.get(v.edgeId)!.length-v.position<=120)
    // Priority cannot clear a single-lane queue into a full receiver. Let feasible
    // cross traffic run, then request priority again when the head can discharge.
    const ambulance=approachingAmbulance&&incomingDemand(world,approachingAmbulance.edgeId,stats).feasible?approachingAmbulance:undefined
    if(ambulance){
      const phase:0|1=signal.definition.phases[0].includes(ambulance.edgeId)?0:1
      if(!signal.priority){signal.recovery=signal.phase;decision(world,`priority-${signal.definition.id}`,{type:'priority',title:'Ambulance approach detected',detail:`${signal.definition.name}: reserve the approach; all amber and all-red safety intervals remain active.`,nodeId:signal.definition.nodeId})}
      signal.priority=true
      if(signal.stage==='green'&&phase!==signal.phase&&world.time-signal.started>=10)startSwitch(world,signal,phase,'ambulance is within 120 metres; minimum green served','priority')
      continue
    }
    if(signal.priority){
      signal.priority=false
      decision(world,`recovery-${signal.definition.id}`,{type:'priority',title:approachingAmbulance?'Ambulance blocked; normal service resumes':'Ambulance passed; normal service resumes',detail:`${signal.definition.name}: restore the saved phase after a minimum 10-second green and normal clearance.${approachingAmbulance?' Priority can resume when downstream storage opens.':''}`,nodeId:signal.definition.nodeId})
    }
    if(signal.stage!=='green'||world.time-signal.started<10)continue
    if(signal.recovery!==null){
      const recovery=signal.recovery;signal.recovery=null
      if(recovery!==signal.phase){startSwitch(world,signal,recovery,'post-ambulance saved-phase recovery');continue}
    }
    if(world.time%5!==0)continue
    const other:0|1=signal.phase===0?1:0
    const overdue=feasible[other]&&world.time-signal.lastService[other]>=85
    const maxGreen=world.time-signal.started>=40&&feasible[other]
    const challenger=feasible[other]&&signal.pressure[other]>signal.pressure[signal.phase]*1.2+.001
    if(overdue||maxGreen||challenger){
      const preventive=demand[other]!.some(x=>x.yellow)
      startSwitch(world,signal,other,overdue?'feasible competing approach nearing 90-second service target':maxGreen?'maximum 40-second green with competing demand':`competing pressure ${signal.pressure[other].toFixed(1)} exceeds current ${signal.pressure[signal.phase].toFixed(1)} by 20%`,preventive?'prevention':'signal')
    }
  }
}

function rerouteAtJunction(world:SimulationWorld,v:Vehicle) {
  if(world.mode!=='optimized'||!v.adoptsRouting||world.time-v.lastReroute<30)return
  v.lastReroute=world.time
  const edge=world.edgeMap.get(v.edgeId)!
  if(edge.to===v.destination)return
  const stats=new Map(world.edgeStats.map(e=>[e.id,e]))
  const cost=(e:RoadEdge)=>edgeCost(stats,e)
  const proposed=shortestPath(world.network,edge.to,v.destination,cost,edge.from)
  const remaining=v.route.slice(v.routeIndex+1)
  if(!proposed||proposed.edgeIds.join()===remaining.join())return
  const original=remaining.reduce((sum,id)=>sum+cost(world.edgeMap.get(id)!),0)
  const saving=original-proposed.travelTime
  if(saving<10||saving<original*.2)return
  v.route=v.route.slice(0,v.routeIndex+1).concat(proposed.edgeIds);v.reroutes++;world.reroutes++
  decision(world,`route-${v.id}`,{type:'route',title:'Driver diverted at junction',detail:`${v.id}: predicted ${Math.round(saving)}s saving (${Math.round(saving/original*100)}%); road connectivity and receiving pressure checked.`,nodeId:edge.to,edgeId:proposed.edgeIds[0]},30)
}

/** One synchronous second: move within links, stage crossings, then admit boundary arrivals. */
export function stepWorld(world:SimulationWorld):void {
  if(world.time>=world.scenario.duration)return
  world.time++
  while(world.demandIndex<world.scenario.demand.length&&world.scenario.demand[world.demandIndex]!.departure<=world.time){world.boundary.push(world.scenario.demand[world.demandIndex]!);world.demandIndex++}
  // A head already at the junction can accept advice while its approach is red.
  // Signal feasibility must see that route; crossing still requires green below.
  for(const edge of world.network.edges){
    const head=edgeVehicles(world,edge.id)[0]
    if(head&&head.position>=edge.length-1e-9)rerouteAtJunction(world,head)
  }
  updateSignals(world)
  for(const edge of world.network.edges){
    let front=edge.length+GAP
    for(const v of edgeVehicles(world,edge.id)){
      const old=v.position
      v.position=Math.min(edge.length,old+edge.freeFlowSpeed*weatherFactor(world),front-GAP)
      v.speed=Math.max(0,v.position-old);front=v.position
    }
  }
  // Candidates are frozen before transfers: a vehicle cannot cross two links in one tick.
  const candidates=world.network.edges.map(edge=>edgeVehicles(world,edge.id)[0]).filter((v):v is Vehicle=>!!v&&v.position>=world.edgeMap.get(v.edgeId)!.length-1e-9)
    .sort((a,b)=>(a.kind==='ambulance'?-1:0)-(b.kind==='ambulance'?-1:0)||b.waitingTime-a.waitingTime||a.id.localeCompare(b.id))
  const completed=new Set<string>()
  for(const v of candidates){
    const edge=world.edgeMap.get(v.edgeId)!
    const signal=world.signals.find(s=>s.definition.nodeId===edge.to&&s.definition.phases.some(phase=>phase.includes(edge.id)))
    const allowed=!signal||(signal.stage==='green'&&signal.definition.phases[signal.phase].includes(edge.id))
    if(!allowed||world.time-(world.discharge.get(edge.id)??-Infinity)<headway(world,edge.id))continue
    rerouteAtJunction(world,v)
    const next=v.route[v.routeIndex+1]
    if(next&&!canReceive(world,next)){
      world.spillbackSeconds++
      decision(world,`blocked-${edge.id}`,{type:'spillback',title:'Downstream storage blocks discharge',detail:`${edge.name}: no entry until the receiving link has a 7.5m gap and storage.`,edgeId:edge.id},60)
      continue
    }
    world.discharge.set(edge.id,world.time)
    world.edgeGroups.get(edge.id)!.shift()
    if(signal)signal.lastService[signal.phase]=world.time
    if(!next){
      completed.add(v.id);world.completed++;const trip=world.time-v.departure;world.completedTravelTime+=trip;world.completedWaitingTime+=v.waitingTime
      if(v.kind==='ambulance')world.ambulanceTravelTime=trip
    }else{v.routeIndex++;v.edgeId=next;v.position=0;v.speed=Math.min(v.speed,world.edgeMap.get(next)!.freeFlowSpeed*weatherFactor(world));world.edgeGroups.get(next)!.push(v)}
  }
  world.vehicles=world.vehicles.filter(v=>!completed.has(v.id))
  for(const v of world.vehicles)if(v.speed<.5)v.waitingTime++
  const waiting:Demand[]=[]
  for(const d of world.boundary){
    const key=`${d.origin}>${d.destination}`
    if(!world.routes.has(key))world.routes.set(key,shortestPath(world.network,d.origin,d.destination))
    const route=world.routes.get(key)
    if(!route||!route.edgeIds.length||!canReceive(world,route.edgeIds[0]!)){waiting.push(d);continue}
    const edge=world.edgeMap.get(route.edgeIds[0]!)!
    const effectiveSpeed=edge.freeFlowSpeed*weatherFactor(world)
    const vehicle:Vehicle={id:d.id,kind:d.kind,edgeId:edge.id,position:0,coordinate:coordinateAt(edge,0),speed:effectiveSpeed,freeFlowSpeed:effectiveSpeed,waitingTime:world.time-d.departure,route:route.edgeIds,routeIndex:0,origin:d.origin,destination:d.destination,reroutes:0,departure:d.departure,adoptsRouting:d.adoptsRouting,lastReroute:-Infinity}
    world.vehicles.push(vehicle);world.edgeGroups.get(edge.id)!.push(vehicle)
  }
  world.boundary=waiting
  refreshSnapshot(world)
}

function refreshSnapshot(world:SimulationWorld) {
  const vehicles:VehicleSnapshot[]=world.vehicles.map(v=>{
    const edge=world.edgeMap.get(v.edgeId)!
    v.coordinate=coordinateAt(edge,v.position);v.freeFlowSpeed=edge.freeFlowSpeed*weatherFactor(world)
    return {id:v.id,kind:v.kind,edgeId:v.edgeId,position:v.position,coordinate:[...v.coordinate],speed:v.speed,freeFlowSpeed:v.freeFlowSpeed,waitingTime:v.waitingTime,route:[...v.route],routeIndex:v.routeIndex,origin:v.origin,destination:v.destination,reroutes:v.reroutes}
  })
  const previousCategories=new Map(world.edgeStats.map(e=>[e.id,e.category]))
  world.edgeStats=world.network.edges.map(edge=>{
    const group=edgeVehicles(world,edge.id),count=group.length,stopped=group.filter(v=>v.speed<.5).length
    const occupancy=count/capacity(edge),speedRatio=count?group.reduce((sum,v)=>sum+v.speed/v.freeFlowSpeed,0)/count:1
    const history=world.edgeHistory.get(edge.id)??[];history.push({time:world.time,occupancy});while(history.length&&history[0]!.time<world.time-30)history.shift();world.edgeHistory.set(edge.id,history)
    const predictedOccupancy=projectOccupancy(history,world.time,occupancy),category=classifyTraffic({count,stopped,occupancy,speedRatio,predictedOccupancy})
    const first=edgeVehicles(world,edge.id)[0],next=first?.route[first.routeIndex+1]
    const blocked=!!first&&first.position>=edge.length-1e-9&&!!next&&!canReceive(world,next)
    return {id:edge.id,count,stopped,queueLength:stopped*GAP,occupancy,speedRatio,predictedOccupancy,category,blocked,dischargeHeadway:headway(world,edge.id)}
  })
  const hexStats=aggregateHexes(vehicles,world.cellCapacities,world.cellHistory,world.time)
  // A yellow cell is actionable even when its longer constituent link is still dilute.
  // Propagate only to roads with vehicles in the warned cell; never change a vehicle's cell.
  const warningCells=new Map(hexStats.filter(h=>h.category==='yellow'&&h.count>0).map(h=>[h.id,h]))
  for(const edge of world.edgeStats){
    const warnings=edgeVehicles(world,edge.id).map(v=>warningCells.get(vehicleCell(v.coordinate))).filter(h=>!!h)
    if(warnings.length&&edge.category==='green'){edge.category='yellow';edge.predictedOccupancy=Math.max(edge.predictedOccupancy,...warnings.map(h=>h.predictedOccupancy))}
    if(world.mode==='optimized'&&edge.category==='yellow'&&previousCategories.get(edge.id)!=='yellow')decision(world,`yellow-${edge.id}`,{type:'prevention',title:'Yellow warning: preventive management active',detail:`${world.edgeMap.get(edge.id)!.name}: road or occupied H3 cell warning; 30s projection ${Math.round(edge.predictedOccupancy*100)}%. Approach pressure and route cost include this warning.`,edgeId:edge.id},30)
  }
  world.totalSystemTime=world.completedTravelTime+world.vehicles.reduce((sum,v)=>sum+world.time-v.departure,0)+world.boundary.reduce((sum,d)=>sum+world.time-d.departure,0)
  world.totalWaitingTime=world.completedWaitingTime+world.vehicles.reduce((sum,v)=>sum+v.waitingTime,0)+world.boundary.reduce((sum,d)=>sum+world.time-d.departure,0)
  const longestQueue=Math.max(0,...world.edgeStats.map(e=>e.queueLength));world.peakQueue=Math.max(world.peakQueue,longestQueue)
  const tickSpeed=vehicles.length?vehicles.reduce((sum,v)=>sum+v.speed,0)/vehicles.length:0
  world.speedHistory.push(tickSpeed);if(world.speedHistory.length>30)world.speedHistory.shift()
  if(world.time%5===0){world.history.push({time:world.time,waiting:world.totalWaitingTime,queue:longestQueue,completed:world.completed});if(world.history.length>241)world.history.shift()}
  const ambulanceDemand=world.scenario.demand.find(d=>d.kind==='ambulance')
  const ambulanceStatus=!ambulanceDemand?'not-scheduled':world.ambulanceTravelTime!==null?'completed':world.vehicles.some(v=>v.kind==='ambulance')?'travelling':world.boundary.some(v=>v.kind==='ambulance')?'waiting':'pending'
  world.snapshot={mode:world.mode,time:world.time,vehicles,edges:world.edgeStats.map(e=>({...e})),hexStats,signals:world.signals.map(s=>{
    const elapsed=world.time-s.started
    const cycle = world.mode==='fixed' ? (s.fixedDuration ?? 30) : 40
    return {id:s.definition.id,nodeId:s.definition.nodeId,phase:s.phase,stage:s.stage,elapsed,remaining:Math.max(0,(s.stage==='amber'?2:s.stage==='all-red'?1:cycle)-elapsed),pressure:[...s.pressure],priority:s.priority,blocked:s.blocked,serviceViolations:s.serviceViolations}
  }),metrics:{requested:world.demandIndex,scheduled:world.scenario.demand.length-world.demandIndex,onRoad:vehicles.length,boundaryWaiting:world.boundary.length,completed:world.completed,unfinished:vehicles.length+world.boundary.length,totalWaitingTime:world.totalWaitingTime,totalSystemTime:world.totalSystemTime,longestQueue,peakQueue:world.peakQueue,averageSpeed:world.speedHistory.reduce((sum,x)=>sum+x,0)/world.speedHistory.length,meanCompletedTravelTime:world.completed?world.completedTravelTime/world.completed:null,ambulanceTravelTime:world.ambulanceTravelTime,ambulanceStatus,reroutes:world.reroutes,spillbackSeconds:world.spillbackSeconds,yellowCells:hexStats.filter(h=>h.count&&h.category==='yellow').length,redCells:hexStats.filter(h=>h.count&&h.category==='red').length},decisions:world.decisions.map(d=>({...d})),history:world.history.map(h=>({...h})),incidentActive:world.scenario.events.some(e=>world.time>=e.start&&world.time<e.end),finished:world.time>=world.scenario.duration}
}

/** Deep copies isolate UI consumers, exports and replay captures from mutable engine state. */
export function snapshotWorld(world:SimulationWorld):SimulationSnapshot { return structuredClone(world.snapshot) }
export function previewRoute(snapshot:SimulationSnapshot,origin:string,destination:string,network:RoadNetwork=NETWORK):RoutePreview|null {
  const stats=new Map(snapshot.edges.map(e=>[e.id,e]))
  if(snapshot.mode==='optimized')return shortestPath(network,origin,destination,edge=>edgeCost(stats,edge))
  const route=shortestPath(network,origin,destination)
  return route?{...route,travelTime:route.edgeIds.reduce((sum,id)=>sum+edgeCost(stats,network.edges.find(e=>e.id===id)!),0)}:null
}
export function createComparison(scenario:Scenario):Comparison { return {scenario,fixed:createWorld(scenario,'fixed'),optimized:createWorld(scenario,'optimized')} }
export function stepComparison(comparison:Comparison):void {stepWorld(comparison.fixed);stepWorld(comparison.optimized)}
export function snapshotComparison(comparison:Comparison):ComparisonSnapshot {return {scenario:comparison.scenario,fixed:snapshotWorld(comparison.fixed),optimized:snapshotWorld(comparison.optimized)}}
