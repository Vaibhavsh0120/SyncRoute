import { describe, expect, it } from 'vitest'
import { createComparison, snapshotComparison, stepComparison } from './engine'
import { createScenario } from './scenarios'
import { createSimulationWorkerRuntime } from './workerRuntime'
import { MAX_WORKER_TICKS, SimulationWorkerQueue } from './workerProtocol'

describe('simulation worker runtime', () => {
  it('preserves every deterministic tick across bounded batches and returns the preceding tick', () => {
    const scenario = createScenario('city', 42)
    const expected = createComparison(scenario)
    const runtime = createSimulationWorkerRuntime()
    const ready = runtime.handle({ type: 'initialize', generation: 1, requestId: 1, scenarioId: 'city', seed: 42 })
    expect(ready.type).toBe('ready')
    for (let batch = 0; batch < 3; batch++) {
      for (let i = 1; i < MAX_WORKER_TICKS; i++) stepComparison(expected)
      const prior = snapshotComparison(expected)
      stepComparison(expected)
      const response = runtime.handle({ type: 'advance', generation: 1, requestId: batch + 2, ticks: MAX_WORKER_TICKS })
      expect(response.type).toBe('advanced')
      if (response.type !== 'advanced') throw new Error('Expected worker advancement')
      expect(response.completedTicks).toBe(MAX_WORKER_TICKS)
      expect(response.previous).toEqual({ fixed: prior.fixed, optimized: prior.optimized })
      expect(response.comparison).toEqual(snapshotComparison(expected))
    }
  })

  it('rejects an obsolete generation without advancing the replacement scenario', () => {
    const runtime = createSimulationWorkerRuntime()
    runtime.handle({ type: 'initialize', generation: 1, requestId: 1, scenarioId: 'city', seed: 42 })
    runtime.handle({ type: 'initialize', generation: 2, requestId: 2, scenarioId: 'incident', seed: 7 })
    expect(runtime.handle({ type: 'advance', generation: 1, requestId: 3, ticks: 4 }).type).toBe('error')
    const response = runtime.handle({ type: 'advance', generation: 2, requestId: 4, ticks: 1 })
    expect(response.type).toBe('advanced')
    if (response.type !== 'advanced') throw new Error('Expected worker advancement')
    expect(response.comparison.scenario.seed).toBe(7)
    expect(response.comparison.fixed.time).toBe(1)
  })

  it('rejects invalid or oversized batches instead of silently dropping requested ticks', () => {
    const runtime = createSimulationWorkerRuntime()
    runtime.handle({ type: 'initialize', generation: 1, requestId: 1, scenarioId: 'normal', seed: 42 })
    for (const ticks of [0, -1, .5, MAX_WORKER_TICKS + 1, NaN]) {
      expect(runtime.handle({ type: 'advance', generation: 1, requestId: 2, ticks }).type).toBe('error')
    }
    const response = runtime.handle({ type: 'advance', generation: 1, requestId: 3, ticks: 1 })
    expect(response.type === 'advanced' && response.comparison.fixed.time).toBe(1)
  })
})

describe('worker backpressure and replacement protocol', () => {
  it('keeps one request in flight and eventually delivers the whole tick budget', () => {
    const scenario = createScenario('normal', 19)
    const runtime = createSimulationWorkerRuntime()
    const queue = new SimulationWorkerQueue()
    const initial = queue.initialize(scenario)
    queue.enqueue(13)
    expect(queue.next(0)).toBeNull()
    expect(queue.accept(runtime.handle(initial))).toBe(true)
    const sizes: number[] = []
    for (let now = 0; queue.pendingTicks; now += 50) {
      const request = queue.next(now)
      expect(request?.type).toBe('advance')
      if (!request) throw new Error('Expected queued ticks')
      sizes.push(request.ticks)
      expect(queue.next(now + 1000)).toBeNull()
      expect(queue.accept(runtime.handle(request))).toBe(true)
    }
    expect(sizes).toEqual([4, 4, 4, 1])
    const expected = createComparison(scenario)
    for (let tick = 0; tick < 14; tick++) stepComparison(expected)
    expect(runtime.handle({ type: 'advance', generation: initial.generation, requestId: 99, ticks: 1 })).toMatchObject({ comparison: snapshotComparison(expected) })
  })

  it('ignores stale and duplicate replies after resetting while work is in flight', () => {
    const runtime = createSimulationWorkerRuntime()
    const queue = new SimulationWorkerQueue()
    const first = queue.initialize(createScenario('normal', 42))
    queue.accept(runtime.handle(first))
    queue.enqueue(4)
    const oldAdvance = queue.next(0)!
    const oldResponse = runtime.handle(oldAdvance)
    const replacement = queue.initialize(createScenario('city', 73))
    expect(queue.accept(oldResponse)).toBe(false)
    expect(queue.next(100)).toBeNull()
    const ready = runtime.handle(replacement)
    expect(queue.accept(ready)).toBe(true)
    expect(queue.accept(ready)).toBe(false)
    queue.enqueue(1)
    const next = queue.next(100)!
    expect(next.generation).toBe(replacement.generation)
    expect(queue.accept({ ...oldResponse, generation: next.generation })).toBe(false)
    const response = runtime.handle(next)
    expect(queue.accept(response)).toBe(true)
    expect(response.type === 'advanced' && response.comparison.fixed.time).toBe(1)
  })

  it('bounds queued time to the scenario horizon and throttles snapshot delivery without losing ticks', () => {
    const scenario = { ...createScenario('normal', 42), duration: 8 }
    const queue = new SimulationWorkerQueue()
    const runtime = createSimulationWorkerRuntime()
    queue.accept(runtime.handle(queue.initialize(scenario)))
    queue.enqueue(1_000_000)
    expect(queue.pendingTicks).toBe(8)
    const first = queue.next(0)!
    queue.enqueue(1_000_000)
    expect(queue.pendingTicks).toBe(4)
    queue.accept(runtime.handle(first))
    expect(queue.next(49)).toBeNull()
    expect(queue.next(50)?.ticks).toBe(4)
  })
})
