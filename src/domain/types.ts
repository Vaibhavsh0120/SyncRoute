/** Coordinates are GeoJSON order: longitude, latitude. Speeds use m/s internally. */
export type Coordinate = [number, number]
export type Mode = 'fixed' | 'optimized'
export type ScenarioId = 'normal' | 'rush' | 'incident' | 'ambulance' | 'city'
export type Congestion = 'green' | 'yellow' | 'red'
export type VehicleKind = 'car' | 'bike' | 'bus' | 'ambulance'
/** Only location and speed are measured; ID/time identify each incoming observation. */
export interface VehicleTelemetry { id: string; location: Coordinate; speed: number; observedAt: string }
export interface RoadNode { id: string; name: string; coordinate: Coordinate; gateway?: boolean }
export interface RoadEdge { id: string; name: string; from: string; to: string; coordinates: Coordinate[]; length: number; freeFlowSpeed: number; capacity: number; signalPhase?: 0 | 1 }
export interface SignalDefinition { id: string; nodeId: string; name: string; phases: [string[], string[]] }
export interface RoadNetwork { nodes: RoadNode[]; edges: RoadEdge[]; signals: SignalDefinition[]; center: Coordinate; bounds: [Coordinate, Coordinate]; incidentEdgeId: string; gateways: string[] }
export interface Demand { id: string; departure: number; origin: string; destination: string; adoptsRouting: boolean; kind: VehicleKind }
export interface ScenarioEvent { id: string; type: 'capacity'; edgeId: string; start: number; end: number; factor: number }
export interface Scenario { id: ScenarioId; name: string; description: string; seed: number; arrivalDuration: number; duration: number; demand: readonly Demand[]; events: readonly ScenarioEvent[] }
export interface VehicleSnapshot { id: string; kind: VehicleKind; edgeId: string; position: number; coordinate: Coordinate; speed: number; freeFlowSpeed: number; waitingTime: number; route: string[]; routeIndex: number; origin: string; destination: string; reroutes: number }
export interface EdgeSnapshot { id: string; count: number; stopped: number; queueLength: number; occupancy: number; speedRatio: number; predictedOccupancy: number; category: Congestion; blocked: boolean; dischargeHeadway: number }
export interface HexStat { id: string; count: number; averageSpeed: number; stopped: number; speedRatio: number; occupancy: number; predictedOccupancy: number; category: Congestion; reason: string }
export interface SignalSnapshot { id: string; nodeId: string; phase: 0 | 1; stage: 'green' | 'amber' | 'all-red'; elapsed: number; remaining: number; pressure: [number, number]; priority: boolean; blocked: boolean; serviceViolations: number }
export interface Metrics { requested: number; scheduled: number; onRoad: number; boundaryWaiting: number; completed: number; unfinished: number; totalWaitingTime: number; totalSystemTime: number; longestQueue: number; peakQueue: number; averageSpeed: number; meanCompletedTravelTime: number | null; ambulanceTravelTime: number | null; ambulanceStatus: 'not-scheduled' | 'pending' | 'waiting' | 'travelling' | 'completed'; reroutes: number; spillbackSeconds: number; yellowCells: number; redCells: number }
export interface Decision { id: string; time: number; type: 'signal' | 'route' | 'priority' | 'spillback' | 'prevention'; title: string; detail: string; nodeId?: string; edgeId?: string }
export interface HistoryPoint { time: number; waiting: number; queue: number; completed: number }
export interface SimulationSnapshot { mode: Mode; time: number; vehicles: VehicleSnapshot[]; edges: EdgeSnapshot[]; hexStats: HexStat[]; signals: SignalSnapshot[]; metrics: Metrics; decisions: Decision[]; history: HistoryPoint[]; incidentActive: boolean; finished: boolean }
export interface RoutePreview { edgeIds: string[]; coordinates: Coordinate[]; distance: number; travelTime: number }
export interface ComparisonSnapshot { fixed: SimulationSnapshot; optimized: SimulationSnapshot; scenario: Scenario }
export interface CameraState { longitude: number; latitude: number; zoom: number; bearing: number; pitch: number }
export interface Selection { type: 'hex' | 'signal' | 'vehicle'; id: string; mode: Mode }
