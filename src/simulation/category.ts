import type { Congestion } from '../domain/types'

export interface OccupancySample { time: number; occupancy: number }
export interface TrafficCondition { count: number; stopped: number; occupancy: number; speedRatio: number; predictedOccupancy: number }

/** A least-squares slope from the previous 30 seconds, extrapolated by 30 seconds. */
export function projectOccupancy(history: readonly OccupancySample[], time: number, current: number): number {
  const samples = history.filter(s => s.time >= time - 30 && s.time <= time)
  if (samples.length < 2 || samples[samples.length - 1]!.time - samples[0]!.time < 5) return current
  const meanT = samples.reduce((sum, s) => sum + s.time, 0) / samples.length
  const meanO = samples.reduce((sum, s) => sum + s.occupancy, 0) / samples.length
  let covariance = 0, variance = 0
  for (const sample of samples) { covariance += (sample.time - meanT) * (sample.occupancy - meanO); variance += (sample.time - meanT) ** 2 }
  return Math.max(0, Math.min(1, current + (variance ? covariance / variance : 0) * 30))
}

export function classifyTraffic(s: TrafficCondition): Congestion {
  if (!s.count) return 'green'
  if ((s.stopped >= 3 && s.speedRatio < .25) || (s.occupancy >= .85 && s.stopped > 0)) return 'red'
  if ((s.predictedOccupancy >= .7 && s.predictedOccupancy > s.occupancy + .01) || (s.count >= 3 && s.speedRatio < .7) || s.stopped > 0) return 'yellow'
  return 'green'
}

export function categoryReason(s: TrafficCondition): string {
  if (classifyTraffic(s) === 'red') return 'Established congestion: stopped traffic with low speed or at least 85% occupied storage.'
  if (s.predictedOccupancy >= .7 && s.predictedOccupancy > s.occupancy + .01) return `Emerging congestion: past 30s occupancy trend projects ${Math.round(s.predictedOccupancy * 100)}% storage in 30s.`
  if (s.stopped > 0) return 'Emerging congestion: stopped traffic is forming; preventive management is active.'
  if (s.count >= 3 && s.speedRatio < .7) return 'Emerging congestion: at least three vehicles are slowing below 70% of free-flow speed.'
  return 'Free flow: no stopped queue, sustained slowing, or rising 30-second storage warning.'
}
