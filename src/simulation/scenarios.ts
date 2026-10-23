import type { Demand, Scenario, ScenarioId } from '../domain/types'
import { NETWORK } from '../data/network'

function randomGenerator(seed: number) {
  let state = seed >>> 0
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
const descriptions: Record<ScenarioId, [string,string]> = {
  city: ['Connaught Place traffic', 'Mixed city traffic with automatic light rain, a temporary road restriction and one emergency arrival.'],
  normal: ['Normal traffic', '20 arrivals per minute across four boundary gateways.'],
  rush: ['Rush hour', '30 arrivals per minute; 65% use the Janpath–State Entry corridor.'],
  incident: ['Temporary incident', 'Rush demand; the affected link has half its discharge capacity from minute 3 through minute 7.'],
  ambulance: ['Ambulance priority', 'Rush demand plus one ambulance at minute 3; optimized signals safely clear its approach.'],
}
/** Demand is generated once and frozen. Both controllers receive precisely the same trips. */
export function createScenario(id: ScenarioId, seed = 42): Scenario {
  const random = randomGenerator(seed)
  const arrivals = id === 'city' ? 900 : id === 'normal' ? 200 : 300
  const corridor = id === 'normal' || id === 'city' ? 0 : Math.round(arrivals * .65)
  const gateway = NETWORK.gateways
  const demand: Demand[] = []
  for (let i = 0; i < arrivals; i++) {
    let origin: string, destination: string
    if (id === 'city') {
      origin = NETWORK.nodes[i % NETWORK.nodes.length]!.id
      const outgoing = NETWORK.edges.filter(e=>e.from===origin)
      const adjacent = (i + Math.floor(i/NETWORK.nodes.length)) % 10 < 6
      const choices = NETWORK.nodes.filter(n=>n.id!==origin)
      destination = adjacent && outgoing.length ? outgoing[Math.floor(random()*outgoing.length)]!.to : choices[Math.floor(random()*choices.length)]!.id
    }
    else if (i < corridor) { const reverse = random() < .25; origin = reverse ? 'state-entry' : 'janpath'; destination = reverse ? 'janpath' : 'state-entry' }
    else { origin = gateway[Math.floor(random() * gateway.length)]!; const choices = gateway.filter(g => g !== origin && (id === 'normal' || [origin,g].sort().join() !== 'janpath,state-entry')); destination = choices[Math.floor(random() * choices.length)]! }
    const kind = id==='city' ? i%10<6?'car':i%10<9?'bike':'bus' : 'car'
    const cityCoverageCount=Math.min(arrivals,NETWORK.nodes.length)
    const departure=id==='city' ? i<cityCoverageCount?Math.floor(i*60/cityCoverageCount):60+Math.floor((i-cityCoverageCount)*540/Math.max(1,arrivals-cityCoverageCount)) : Math.min(599, Math.floor(i * 600 / arrivals + random() * (600 / arrivals)))
    demand.push(Object.freeze({ id: `${kind}-${i.toString().padStart(4,'0')}`, departure, origin, destination, adoptsRouting: i % 2 === 0, kind }))
  }
  // Shuffle departure assignments independently from origins so the corridor lasts the whole arrival period.
  const departureSlots = demand.map(d => d.departure)
  if(id!=='city')for (let i = departureSlots.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [departureSlots[i],departureSlots[j]] = [departureSlots[j]!,departureSlots[i]!] }
  const manifest = demand.map((d,i) => Object.freeze({ ...d, departure: departureSlots[i]! }))
  if (id === 'ambulance' || id === 'city') manifest.push(Object.freeze({ id: 'ambulance-1', departure: 180, origin: 'janpath', destination: 'state-entry', adoptsRouting: false, kind: 'ambulance' }))
  manifest.sort((a,b) => a.departure-b.departure || a.id.localeCompare(b.id))
  return Object.freeze({ id, seed, name: descriptions[id][0], description: descriptions[id][1], arrivalDuration: 600, duration: 1200, demand: Object.freeze(manifest), events: Object.freeze(id === 'incident' || id === 'city' ? [Object.freeze({ id: 'incident-1', type: 'capacity' as const, edgeId: NETWORK.incidentEdgeId, start: 180, end: 420, factor: .5 })] : []) })
}
