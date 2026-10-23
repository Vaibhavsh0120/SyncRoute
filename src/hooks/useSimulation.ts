import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComparisonSnapshot, ScenarioId, SimulationSnapshot } from '../domain/types'
import { createComparison, createScenario, snapshotComparison, stepComparison } from '../simulation'
import { advanceClock } from '../lib/playback'

type Pair = ReturnType<typeof createComparison>
type Previous = { fixed: SimulationSnapshot; optimized: SimulationSnapshot } | null

export function useSimulation() {
  const [initial] = useState(() => createComparison(createScenario('rush', 42)))
  const pair = useRef<Pair>(initial)
  const [comparison, setComparison] = useState<ComparisonSnapshot>(() => snapshotComparison(initial))
  const current = useRef(comparison)
  const [previous, setPrevious] = useState<Previous>(null)
  const [interpolation, setInterpolation] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [speed, setPlaybackSpeed] = useState(10)
  const [scenarioId, setScenarioId] = useState<ScenarioId>('rush')
  const [seed, setSeedValue] = useState(42)
  const remainder = useRef(0)

  const rebuild = useCallback((id: ScenarioId, nextSeed: number) => {
    pair.current = createComparison(createScenario(id, nextSeed))
    current.current = snapshotComparison(pair.current)
    remainder.current = 0
    setComparison(current.current)
    setPrevious(null)
    setInterpolation(1)
    setPlaying(false)
  }, [])
  const reset = useCallback(() => rebuild(scenarioId, seed), [rebuild, scenarioId, seed])
  const setScenario = useCallback((id: ScenarioId) => {
    setScenarioId(id)
    rebuild(id, seed)
  }, [rebuild, seed])
  const setSeed = useCallback((value: number) => {
    if (!Number.isFinite(value)) return
    const normalized = Math.max(0, Math.min(2147483647, Math.trunc(value)))
    setSeedValue(normalized)
    rebuild(scenarioId, normalized)
  }, [rebuild, scenarioId])
  const setSpeed = useCallback((value: number) => {
    if ([1, 5, 10, 20, 50].includes(value)) setPlaybackSpeed(value)
  }, [])
  const startPause = useCallback(() => {
    if (current.current.fixed.finished && current.current.optimized.finished) rebuild(scenarioId, seed)
    setPlaying(value => !value)
    setInterpolation(1)
  }, [rebuild, scenarioId, seed])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last: number | null = null
    const visibility = () => { last = null }
    document.addEventListener('visibilitychange', visibility)
    const render = (now: number) => {
      if (last === null || document.hidden) {
        last = now
        frame = requestAnimationFrame(render)
        return
      }
      const clock = advanceClock(now - last, speed, remainder.current)
      last = now
      remainder.current = clock.remainder
      let prior: Previous = null
      for (let tick = 0; tick < clock.ticks; tick++) {
        prior = { fixed: current.current.fixed, optimized: current.current.optimized }
        stepComparison(pair.current!)
        current.current = snapshotComparison(pair.current!)
        if (current.current.fixed.finished && current.current.optimized.finished) break
      }
      if (prior) {
        setPrevious(prior)
        setComparison(current.current)
      }
      setInterpolation(remainder.current)
      if (current.current.fixed.finished && current.current.optimized.finished) {
        setInterpolation(1)
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [playing, speed])

  const download = useCallback(() => {
    const payload = {
      schemaVersion: 1,
      project: 'SyncRoute',
      location: 'Connaught Place, New Delhi',
      dataMode: 'simulation',
      assumptions: {
        tickSeconds: 1, vehicleSpacingMetres: 7.5, laneCountPerDirectedLink: 1,
        normalDischargeHeadwaySeconds: 2, h3Resolution: 10, forecastHorizonSeconds: 30,
        map: 'OpenStreetMap geometry, simplified illustrative traffic operations',
        comparison: 'Identical demand and events; only signal and routing policies differ',
      },
      ...current.current,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `syncroute-${scenarioId}-seed-${seed}-t${current.current.fixed.time}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [scenarioId, seed])

  return { comparison, previous, interpolation, playing, speed, scenarioId, seed, startPause, reset, setSpeed, setScenario, setSeed, download }
}
