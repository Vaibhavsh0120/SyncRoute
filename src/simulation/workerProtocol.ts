import type { ComparisonSnapshot, Scenario, ScenarioId, SimulationSnapshot } from '../domain/types'

export const MAX_WORKER_TICKS = 4
const MIN_REQUEST_INTERVAL_MS = 50

export type PreviousSnapshots = { fixed: SimulationSnapshot; optimized: SimulationSnapshot } | null
type Identity = { generation: number; requestId: number }
export type InitializeRequest = Identity & { type: 'initialize'; scenarioId: ScenarioId; seed: number }
export type AdvanceRequest = Identity & { type: 'advance'; ticks: number }
export type SimulationWorkerRequest = InitializeRequest | AdvanceRequest
export type SimulationWorkerResponse = Identity & (
  | { type: 'ready'; comparison: ComparisonSnapshot }
  | { type: 'advanced'; comparison: ComparisonSnapshot; previous: PreviousSnapshots; completedTicks: number }
  | { type: 'error'; message: string }
)

/** A scalar tick budget and one bounded request prevent an expanding worker message queue. */
export class SimulationWorkerQueue {
  private generation = 0
  private requestId = 0
  private inFlight: SimulationWorkerRequest | null = null
  private ready = false
  private completed = 0
  private horizon = 0
  private lastRequestTime = -Infinity
  private pending = 0

  get pendingTicks() { return this.pending }
  get advancing() { return this.inFlight?.type === 'advance' }

  initialize(scenario: Scenario): InitializeRequest {
    this.generation++
    this.pending = 0
    this.completed = 0
    this.horizon = scenario.duration
    this.ready = false
    this.lastRequestTime = -Infinity
    const request: InitializeRequest = { type: 'initialize', generation: this.generation, requestId: ++this.requestId, scenarioId: scenario.id, seed: scenario.seed }
    this.inFlight = request
    return request
  }

  enqueue(ticks: number) {
    if (!Number.isSafeInteger(ticks) || ticks < 0) throw new Error('Simulation tick budget must be a non-negative integer')
    const running = this.inFlight?.type === 'advance' ? this.inFlight.ticks : 0
    // Wall time after the scenario ends has no simulation work. Earlier whole ticks are retained.
    this.pending += Math.min(ticks, Math.max(0, this.horizon - this.completed - this.pending - running))
  }

  next(now: number): AdvanceRequest | null {
    if (!this.ready || this.inFlight || !this.pending || now - this.lastRequestTime < MIN_REQUEST_INTERVAL_MS) return null
    const ticks = Math.min(MAX_WORKER_TICKS, this.pending)
    this.pending -= ticks
    const request: AdvanceRequest = { type: 'advance', generation: this.generation, requestId: ++this.requestId, ticks }
    this.inFlight = request
    this.lastRequestTime = now
    return request
  }

  accept(response: SimulationWorkerResponse): boolean {
    if (!this.inFlight || response.generation !== this.generation || response.requestId !== this.inFlight.requestId) return false
    if (response.type !== 'error' && ((this.inFlight.type === 'initialize') !== (response.type === 'ready'))) return false
    this.inFlight = null
    if (response.type === 'error') { this.ready = false; this.pending = 0; return true }
    this.ready = true
    this.completed = response.comparison.fixed.time
    if (response.comparison.fixed.finished && response.comparison.optimized.finished) this.pending = 0
    return true
  }

  cancel() {
    this.generation++
    this.inFlight = null
    this.pending = 0
    this.ready = false
  }
}
