import { mkdirSync, writeFileSync } from 'node:fs'
import { createComparison, createScenario, snapshotComparison, stepComparison } from '../src/simulation/index'
import type { ScenarioId } from '../src/domain/types'

const ids: ScenarioId[] = ['normal', 'rush', 'incident', 'ambulance']
const runs = []
for (const id of ids) {
  const comparison = createComparison(createScenario(id, 42))
  const observed = { fixed: new Set<string>(), optimized: new Set<string>() }
  const prevention = new Set<string>()
  const seenCategories = new Set<string>()
  for (let tick = 0; tick < comparison.scenario.duration; tick++) {
    stepComparison(comparison)
    const snapshot = snapshotComparison(comparison)
    for (const mode of ['fixed', 'optimized'] as const) {
      const world = snapshot[mode]
      const m = world.metrics
      if (m.requested !== m.boundaryWaiting + m.onRoad + m.completed) {
        throw new Error(`${id}/${mode}/t${world.time}: vehicle conservation failed`)
      }
      for (const edge of world.edges) {
        if (edge.occupancy > 1 + 1e-9) throw new Error(`${id}/${mode}: road storage exceeded`)
      }
      for (const cell of world.hexStats) seenCategories.add(cell.category)
      for (const event of world.decisions) {
        observed[mode].add(event.id)
        if (mode === 'optimized' && event.type === 'prevention') prevention.add(event.id)
      }
    }
  }
  const result = snapshotComparison(comparison)
  const baseline = result.fixed.metrics.totalWaitingTime
  const reduction = baseline === 0 ? null : (baseline - result.optimized.metrics.totalWaitingTime) / baseline * 100
  runs.push({
    scenario: id, seed: 42, horizonSeconds: result.fixed.time,
    waitingReductionPercent: reduction,
    preventiveDecisions: prevention.size, observedCategories: [...seenCategories].sort(),
    fixed: result.fixed.metrics, optimized: result.optimized.metrics,
    manifestIdentical: comparison.fixed.scenario.demand === comparison.optimized.scenario.demand,
    eventsIdentical: comparison.fixed.scenario.events === comparison.optimized.scenario.events,
  })
  console.log(`${id}: fixed wait ${(baseline / 60).toFixed(1)} min, optimized ${(result.optimized.metrics.totalWaitingTime / 60).toFixed(1)} min, change ${reduction?.toFixed(1) ?? 'N/A'}%, prevention decisions ${prevention.size}`)
}
mkdirSync('artifacts', { recursive: true })
writeFileSync('artifacts/benchmark.json', JSON.stringify({ generatedAt: new Date().toISOString(), simulation: true, runs }, null, 2))
console.log('Saved artifacts/benchmark.json; all per-tick conservation and storage checks passed.')
