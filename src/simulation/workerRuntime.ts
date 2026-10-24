import { createComparison, snapshotComparison, stepComparison } from './engine'
import { createScenario } from './scenarios'
import { MAX_WORKER_TICKS, type PreviousSnapshots, type SimulationWorkerRequest, type SimulationWorkerResponse } from './workerProtocol'

/** Mutable engine state lives exclusively in the worker during playback. */
export function createSimulationWorkerRuntime() {
  let generation = -1
  let pair: ReturnType<typeof createComparison> | null = null
  let comparison: ReturnType<typeof snapshotComparison> | null = null

  const handle = (request: SimulationWorkerRequest): SimulationWorkerResponse => {
    const identity = { generation: request.generation, requestId: request.requestId }
    try {
      if (request.type === 'initialize') {
        if (request.generation <= generation) throw new Error('Obsolete simulation initialization')
        pair = createComparison(createScenario(request.scenarioId, request.seed))
        comparison = snapshotComparison(pair)
        generation = request.generation
        return { ...identity, type: 'ready', comparison }
      }
      if (!pair || !comparison || request.generation !== generation) throw new Error('Obsolete simulation generation')
      if (!Number.isInteger(request.ticks) || request.ticks < 1 || request.ticks > MAX_WORKER_TICKS) throw new Error(`Simulation batches require 1 to ${MAX_WORKER_TICKS} whole ticks`)
      let previous: PreviousSnapshots = null
      let completedTicks = 0
      for (let tick = 0; tick < request.ticks; tick++) {
        if (pair.fixed.time >= pair.scenario.duration && pair.optimized.time >= pair.scenario.duration) break
        // Intermediate steps still run in full. Only the last interpolation pair needs deep copies.
        const finalTick = tick === request.ticks - 1 || pair.fixed.time + 1 >= pair.scenario.duration
        if (finalTick) {
          if (tick) comparison = snapshotComparison(pair)
          previous = { fixed: comparison.fixed, optimized: comparison.optimized }
        }
        stepComparison(pair)
        completedTicks++
      }
      comparison = snapshotComparison(pair)
      return { ...identity, type: 'advanced', comparison, previous, completedTicks }
    } catch (error) {
      return { ...identity, type: 'error', message: error instanceof Error ? error.message : 'Traffic simulation failed' }
    }
  }
  return { handle }
}
