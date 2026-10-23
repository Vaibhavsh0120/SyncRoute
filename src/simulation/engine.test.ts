import { describe, expect, it } from 'vitest'
import type { Demand, RoadNetwork, Scenario } from '../domain/types'
import { createWorld, previewRoute, snapshotWorld, stepWorld } from './engine'
import { shortestPath } from './routing'
import { classifyTraffic, projectOccupancy } from './category'
import { createScenario } from './scenarios'
import { getAreaContext } from '../data/context'
import { NETWORK } from '../data/network'

const network: RoadNetwork = {
  nodes: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id, coordinate: [77.21 + i * .001, 28.63] })),
  edges: [
    { id: 'ab', name: 'ab', from: 'a', to: 'b', coordinates: [[77.21, 28.63], [77.211, 28.63]], length: 30, freeFlowSpeed: 10, capacity: 4 },
    { id: 'bc', name: 'bc', from: 'b', to: 'c', coordinates: [[77.211, 28.63], [77.212, 28.63]], length: 30, freeFlowSpeed: 10, capacity: 4 },
    { id: 'db', name: 'db', from: 'd', to: 'b', coordinates: [[77.213, 28.63], [77.211, 28.63]], length: 30, freeFlowSpeed: 10, capacity: 4 },
    { id: 'ad', name: 'ad', from: 'a', to: 'd', coordinates: [[77.21, 28.63], [77.213, 28.63]], length: 100, freeFlowSpeed: 10, capacity: 13 },
  ],
  signals: [{ id: 's', nodeId: 'b', name: 's', phases: [['ab'], ['db']] }],
  gateways: ['a', 'c', 'd'], incidentEdgeId: 'bc', center: [77.21, 28.63], bounds: [[77.21, 28.63], [77.213, 28.631]],
}
const demand = (n = 20): Demand[] => Array.from({ length: n }, (_, i) => ({ id: `v${i}`, departure: i, origin: 'a', destination: 'c', adoptsRouting: i % 2 === 0, kind: 'car' }))
const scenario = (items = demand()): Scenario => ({ id: 'normal', name: 'test', description: '', seed: 42, arrivalDuration: 60, duration: 180, demand: items, events: [] })
const run = (w: ReturnType<typeof createWorld>, ticks: number) => { for (let i = 0; i < ticks; i++) stepWorld(w); return snapshotWorld(w) }

describe('routing', () => {
  it('finds the hand-calculated shortest directed route and rejects unreachable trips', () => {
    expect(shortestPath(network, 'a', 'c')?.edgeIds).toEqual(['ab', 'bc'])
    expect(shortestPath(network, 'c', 'a')).toBeNull()
    expect(shortestPath(network, 'a', 'a')?.travelTime).toBe(0)
  })
})

describe('forecast and categories', () => {
  it('projects the past occupancy slope 30 seconds ahead, not a speed threshold', () => {
    expect(projectOccupancy([{ time: 0, occupancy: .2 }, { time: 10, occupancy: .4 }], 10, .4)).toBeCloseTo(1)
    expect(projectOccupancy([{ time: 0, occupancy: .4 }, { time: 10, occupancy: .4 }], 10, .4)).toBe(.4)
  })
  it('marks positive rising pressure yellow before a stopped red queue exists', () => {
    expect(classifyTraffic({ count: 4, stopped: 0, occupancy: .4, speedRatio: 1, predictedOccupancy: .9 })).toBe('yellow')
    expect(classifyTraffic({ count: 4, stopped: 3, occupancy: .5, speedRatio: .1, predictedOccupancy: .5 })).toBe('red')
    expect(classifyTraffic({ count: 2, stopped: 0, occupancy: .3, speedRatio: 1, predictedOccupancy: .3 })).toBe('green')
    expect(classifyTraffic({ count: 0, stopped: 0, occupancy: 0, speedRatio: 1, predictedOccupancy: .8 })).toBe('green')
  })
})

describe('world physics', () => {
  it('authors a deterministic city manifest with cars, bikes, buses, incident and emergency arrival', () => {
    const city=createScenario('city',42)
    expect(city).toEqual(createScenario('city',42))
    expect(city.demand.filter(d=>d.kind==='car')).toHaveLength(540)
    expect(city.demand.filter(d=>d.kind==='bike')).toHaveLength(270)
    expect(city.demand.filter(d=>d.kind==='bus')).toHaveLength(90)
    expect(new Set(city.demand.filter(d=>d.kind!=='ambulance').map(d=>d.origin)).size).toBe(NETWORK.nodes.length)
    expect(new Set(city.demand.filter(d=>d.departure<60).map(d=>d.origin)).size).toBe(NETWORK.nodes.length)
    expect(city.demand.find(d=>d.kind==='ambulance')!.departure).toBe(180)
    expect(city.events).toHaveLength(1)
    expect(city.events[0]).toMatchObject({type:'capacity',start:180,end:420,factor:.5})
    expect(Object.isFrozen(city.demand)).toBe(true)
  })
  it('applies the same rain movement factor to both city policies and normalizes free flow', () => {
    const edge={...network.edges[0]!,length:10000,capacity:1333}
    const n={...network,edges:[edge],signals:[]}
    const sc={...scenario([{...demand(1)[0]!,departure:119,destination:'b'}]),id:'city' as const,duration:400}
    for(const mode of ['fixed','optimized'] as const){
      const w=createWorld(sc,mode,n)
      expect(run(w,119).vehicles[0]!.speed).toBe(10)
      const rain=run(w,1)
      expect(rain.vehicles[0]!.position).toBe(8.5)
      expect(rain.vehicles[0]!.speed).toBe(8.5)
      expect(rain.vehicles[0]!.freeFlowSpeed).toBe(8.5)
      expect(rain.edges[0]!.speedRatio).toBe(1)
      expect(run(w,240).vehicles[0]!.speed).toBe(10)
    }
    const old=createWorld({...sc,id:'normal'},'fixed',n)
    expect(run(old,120).vehicles[0]!.speed).toBe(10)
  })
  it('aligns city capacity restrictions with authored context and conserves every vehicle', () => {
    const w=createWorld(createScenario('city'),'fixed')
    const visited=new Set<string>(),quadrants=new Set<string>()
    for(let t=1;t<=1200;t++){
      stepWorld(w)
      const s=w.snapshot
      if(t<=120)for(const v of s.vehicles){visited.add(v.edgeId);quadrants.add(`${v.coordinate[0]>=NETWORK.center[0]}:${v.coordinate[1]>=NETWORK.center[1]}`)}
      expect(s.incidentActive).toBe(getAreaContext(t).incident)
      expect(s.metrics.scheduled+s.metrics.onRoad+s.metrics.boundaryWaiting+s.metrics.completed).toBe(901)
      if(t===180)expect(s.incidentActive).toBe(true)
      if(t===420)expect(s.incidentActive).toBe(false)
    }
    expect(visited.size).toBeGreaterThanOrEqual(Math.min(360,Math.floor(NETWORK.edges.length*.2)))
    expect(quadrants.size).toBe(4)
    expect(snapshotWorld(w).metrics.completed+snapshotWorld(w).metrics.unfinished).toBe(901)
  },15000)
  it('replays identical seeds deterministically and keeps world state isolated', () => {
    const first = createWorld(scenario(), 'fixed', network)
    const second = createWorld(scenario(), 'fixed', network)
    expect(run(first, 100)).toEqual(run(second, 100))
    stepWorld(first)
    expect(snapshotWorld(second).time).toBe(100)
  })
  it('conserves every scheduled vehicle including arrivals held outside full links', () => {
    const w = createWorld(scenario(demand(100).map(d => ({ ...d, departure: 0 }))), 'fixed', network)
    for (let t = 0; t < 150; t++) {
      stepWorld(w)
      const s = snapshotWorld(w)
      expect(s.metrics.onRoad + s.metrics.completed + s.metrics.boundaryWaiting + s.metrics.scheduled).toBe(100)
      expect(s.metrics.requested).toBe(s.metrics.onRoad + s.metrics.completed + s.metrics.boundaryWaiting)
    }
    expect(snapshotWorld(w).metrics.totalWaitingTime).toBeGreaterThan(0)
  })
  it('enforces finite storage and 7.5 metre gaps on every tick', () => {
    const w = createWorld(scenario(demand(50).map(d => ({ ...d, departure: 0 }))), 'fixed', network)
    for (let t = 0; t < 150; t++) {
      stepWorld(w)
      const s = snapshotWorld(w)
      for (const e of network.edges) {
        const positions = s.vehicles.filter(v => v.edgeId === e.id).map(v => v.position).sort((a,b) => a-b)
        expect(positions.length).toBeLessThanOrEqual(e.capacity)
        for (let i = 1; i < positions.length; i++) expect(positions[i]! - positions[i-1]!).toBeGreaterThanOrEqual(7.5 - 1e-9)
      }
    }
  })
  it('blocks entries on red, amber and all-red and provides complete clearance', () => {
    const w = createWorld(scenario([{ id: 'r', departure: 29, origin: 'a', destination: 'c', adoptsRouting: false, kind: 'car' }]), 'fixed', network)
    const stages: Record<number, string> = {}
    for (let t = 0; t < 40; t++) { stepWorld(w); const s = snapshotWorld(w); stages[s.time] = s.signals[0]!.stage; if (s.time >= 30 && s.time <= 40) expect(s.vehicles.every(v => v.edgeId !== 'bc')).toBe(true) }
    expect(stages[30]).toBe('amber'); expect(stages[31]).toBe('amber'); expect(stages[32]).toBe('all-red'); expect(stages[33]).toBe('green')
    expect(run(w, 50).metrics.completed).toBe(1)
  })
  it('preserves actual distance travelled when reaching a red stop line', () => {
    const w=createWorld(scenario([{...demand(1)[0]!,departure:30}]),'fixed',network)
    const arriving=run(w,33).vehicles[0]!
    expect(arriving.position).toBe(30)
    expect(arriving.speed).toBe(10)
    expect(arriving.waitingTime).toBe(0)
    const stopped=run(w,1).vehicles[0]!
    expect(stopped.speed).toBe(0)
    expect(stopped.waitingTime).toBe(1)
  })
  it('preserves actual distance travelled when first reaching a full receiver', () => {
    const n={...network,edges:network.edges.filter(e=>e.id==='ab'||e.id==='bc').map(e=>e.id==='bc'?{...e,capacity:1,freeFlowSpeed:.1}:e),signals:[]}
    const w=createWorld(scenario(demand(2)),'fixed',n)
    const arriving=run(w,5).vehicles.find(v=>v.id==='v1')!
    expect(arriving.edgeId).toBe('ab')
    expect(arriving.position).toBe(30)
    expect(arriving.speed).toBe(10)
    expect(arriving.waitingTime).toBe(1)
    const stopped=run(w,1).vehicles.find(v=>v.id==='v1')!
    expect(stopped.speed).toBe(0)
    expect(stopped.waitingTime).toBe(2)
  })
  it('does not transfer into a full downstream link', () => {
    const n = { ...network, edges: network.edges.map(e => e.id === 'bc' ? { ...e, capacity: 1, freeFlowSpeed: .01 } : e) }
    const s = run(createWorld(scenario(demand(8)), 'fixed', n), 25)
    expect(s.edges.find(e => e.id === 'bc')!.count).toBe(1)
    expect(s.edges.find(e => e.id === 'ab')!.stopped).toBeGreaterThan(0)
    expect(s.metrics.spillbackSeconds).toBeGreaterThan(0)
  })
  it('treats a single-lane approach as infeasible when its head is blocked despite a free follower turn', () => {
    const n={...network,edges:[...network.edges.map(e=>e.id==='bc'?{...e,capacity:1,freeFlowSpeed:.1}:e),{...network.edges[0]!,id:'ba',from:'b',to:'a'}]}
    const items:Demand[]=[
      {id:'receiver-blocker',departure:0,origin:'b',destination:'c',adoptsRouting:false,kind:'car'},
      {id:'blocked-head',departure:0,origin:'d',destination:'c',adoptsRouting:false,kind:'car'},
      {id:'free-follower',departure:1,origin:'d',destination:'a',adoptsRouting:false,kind:'car'},
    ]
    const w=createWorld(scenario(items),'optimized',n)
    const s=run(w,10)
    expect(s.edges.find(e=>e.id==='bc')!.count).toBe(1)
    expect(s.vehicles.filter(v=>v.edgeId==='db')).toHaveLength(2)
    expect(s.edges.find(e=>e.id==='ba')!.count).toBe(0)
    expect(s.signals[0]!.blocked).toBe(true)
    expect(s.signals[0]!.stage).toBe('green')
    expect(s.signals[0]!.phase).toBe(0)
    const later=run(w,90)
    expect(later.signals[0]!.phase).toBe(0)
    expect(later.signals[0]!.serviceViolations).toBe(0)
  })
  it('uses identical manifests for both policies without mutating them', () => {
    const s = createScenario('rush', 41)
    expect(Object.isFrozen(s.demand)).toBe(true)
    expect(createScenario('rush', 41)).toEqual(s)
    expect(s.demand.filter(v => v.kind === 'car')).toHaveLength(300)
    expect(s.demand.filter(v => [v.origin,v.destination].sort().join() === 'janpath,state-entry')).toHaveLength(195)
    expect(createScenario('ambulance').demand.find(v => v.kind === 'ambulance')?.departure).toBe(180)
  })
  it('produces immutable snapshot values and exact one-cell H3 assignments', () => {
    const w = createWorld(scenario(), 'fixed', network)
    const s = run(w, 10)
    const serialized = JSON.stringify(s)
    run(w, 10)
    expect(JSON.stringify(s)).toBe(serialized)
    expect(s.hexStats.reduce((sum, h) => sum + h.count, 0)).toBe(s.vehicles.length)
  })
  it('counts a moving boundary entrant as free flow instead of a stopped queue', () => {
    const s = run(createWorld(scenario(demand(1)), 'fixed', network),1)
    expect(s.edges.find(e=>e.id==='ab')!.category).toBe('green')
    expect(s.metrics.totalWaitingTime).toBe(s.vehicles[0]!.waitingTime)
  })
  it('provides a two-second minimum discharge headway and doubles it during an incident', () => {
    const n = { ...network, signals: [] }
    const sc = { ...scenario(demand(15)), events: [{id:'i',type:'capacity' as const,edgeId:'ab',start:1,end:100,factor:.5}] }
    const w=createWorld(sc,'fixed',n)
    const crossing:number[]=[]
    const seen=new Set<string>()
    for(let t=0;t<60;t++){stepWorld(w);for(const v of snapshotWorld(w).vehicles)if(v.edgeId==='bc'&&!seen.has(v.id)){seen.add(v.id);crossing.push(w.time)}}
    expect(crossing.length).toBeGreaterThan(5)
    for(let i=1;i<crossing.length;i++)expect(crossing[i]!-crossing[i-1]!).toBeGreaterThanOrEqual(4)
    expect(snapshotWorld(w).edges.find(e=>e.id==='ab')!.dischargeHeadway).toBe(4)
  })
  it('raises yellow preventive pressure and safely switches a competing approach before fixed service', () => {
    const items:Demand[]=Array.from({length:8},(_,i)=>({id:`cross-${i}`,departure:i*2,origin:'d',destination:'c',adoptsRouting:false,kind:'car'}))
    const w=createWorld(scenario(items),'optimized',network)
    const s=run(w,20)
    expect(s.decisions.some(d=>d.type==='prevention')).toBe(true)
    expect(s.signals[0]!.phase).toBe(1)
    expect(s.metrics.completed).toBeGreaterThan(0)
  })
  it('applies a preventive yellow penalty to route estimates before red congestion', () => {
    const s=run(createWorld(scenario(demand(1)),'fixed',network),1)
    const plain=previewRoute(s,'a','c',network)!.travelTime
    s.edges=s.edges.map(e=>e.id==='bc'?{...e,category:'yellow',predictedOccupancy:.9,occupancy:.4}:e)
    expect(previewRoute({...s,mode:'optimized'},'a','c',network)!.travelTime).toBeGreaterThan(plain+10)
    expect(previewRoute(s,'a','c',network)!.edgeIds).toEqual(['ab','bc'])
  })
  it('safely preempts for an ambulance and records recovery without skipping clearance', () => {
    const items:Demand[]=[{id:'ambulance',departure:0,origin:'d',destination:'c',adoptsRouting:false,kind:'ambulance'}]
    const w=createWorld(scenario(items),'optimized',network)
    const stages:string[]=[]
    for(let t=0;t<30;t++){stepWorld(w);const s=snapshotWorld(w);stages.push(s.signals[0]!.stage);if(s.signals[0]!.stage!=='green')expect(s.vehicles.some(v=>v.edgeId==='bc')).toBe(false)}
    expect(stages).toContain('amber');expect(stages).toContain('all-red')
    const s=snapshotWorld(w)
    expect(s.metrics.ambulanceStatus).toBe('completed')
    expect(s.decisions.some(d=>d.title.includes('normal service'))).toBe(true)
  })
  it('propagates a yellow H3 warning to active road management even when link occupancy is low', () => {
    const edge={...network.edges[0]!,length:750,capacity:100,freeFlowSpeed:1,coordinates:[[77.21,28.63],[77.24,28.63]] as [number,number][]}
    const n={...network,edges:[edge],signals:[]}
    const w=createWorld(scenario([{...demand(1)[0]!,destination:'b'}]),'optimized',n)
    const s=run(w,10)
    expect(s.hexStats.some(h=>h.count>0&&h.category==='yellow')).toBe(true)
    expect(s.edges[0]!.occupancy).toBeLessThan(.1)
    expect(s.edges[0]!.category).toBe('yellow')
    expect(s.decisions.some(d=>d.type==='prevention')).toBe(true)
  })
  it('respects the minimum green before ambulance preemption', () => {
    const w=createWorld(scenario([{id:'ambulance',departure:0,origin:'d',destination:'c',adoptsRouting:false,kind:'ambulance'}]),'optimized',network)
    expect(run(w,9).signals[0]!.stage).toBe('green')
    expect(run(w,1).signals[0]!.stage).toBe('amber')
  })
  it('reroutes only an adopting driver at a junction when savings exceed both thresholds', () => {
    const n={...network,edges:[...network.edges,{...network.edges[0]!,id:'bd',from:'b',to:'d',length:50,capacity:6},{...network.edges[0]!,id:'dc',from:'d',to:'c',length:50,capacity:6}],signals:[...network.signals,{id:'c-signal',nodeId:'c',name:'c-signal',phases:[['dc'],['bc']] as [string[],string[]]}]}
    const queue=demand(4).map((d,i)=>({...d,id:`queue-${i}`,origin:'b',adoptsRouting:false}))
    const w=createWorld(scenario([...queue,{...demand(1)[0]!,id:'adopter',departure:3,adoptsRouting:true}]),'optimized',n)
    const s=run(w,9)
    expect(s.metrics.reroutes).toBe(1)
    expect(s.vehicles.find(v=>v.id==='adopter')!.route).toEqual(['ab','bd','dc'])
  })
  it('accounts system exposure consistently with completed trip times after draining', () => {
    const s=run(createWorld(scenario(demand(3)),'fixed',network),100)
    expect(s.metrics.totalSystemTime).toBe(s.metrics.meanCompletedTravelTime!*s.metrics.completed)
  })
  it('counts boundary delay from scheduled departure without double counting it on admission', () => {
    const n={...network,edges:network.edges.filter(e=>e.id==='ab'||e.id==='bc').map(e=>e.id==='ab'?{...e,capacity:1,freeFlowSpeed:.1}:e),signals:[]}
    const w=createWorld(scenario(demand(3).map(d=>({...d,departure:0}))),'fixed',n)
    const s=run(w,10)
    expect(s.metrics.boundaryWaiting).toBe(2)
    expect(s.metrics.totalWaitingTime).toBe(30)
  })
})
