import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComparisonSnapshot, Scenario, ScenarioId } from '../domain/types'
import { createComparison, createScenario, snapshotComparison } from '../simulation'
import { advanceClock } from '../lib/playback'
import { CONTROL_LABELS } from '../lib/controlModes'
import { SimulationWorkerQueue, type PreviousSnapshots, type SimulationWorkerResponse } from '../simulation/workerProtocol'

export interface SimulationMotion { interpolation: number; playing: boolean; speed: number }

export function useSimulation() {
  // The first static view is available immediately. All running worlds belong to the worker.
  const [comparison, setComparison] = useState<ComparisonSnapshot>(() => snapshotComparison(createComparison(createScenario('city', 42))))
  const current = useRef(comparison)
  const [previous, setPrevious] = useState<PreviousSnapshots>(null)
  const [interpolation, setInterpolation] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [speed, setPlaybackSpeed] = useState(10)
  const [scenarioId, setScenarioId] = useState<ScenarioId>('city')
  const [seed, setSeedValue] = useState(42)
  const [error, setError] = useState<string | null>(null)
  const motion = useRef<SimulationMotion>({ interpolation: 1, playing: false, speed: 10 })
  const playingRef = useRef(false)
  const config = useRef({ scenarioId: 'city' as ScenarioId, seed: 42 })
  const workerRef = useRef<Worker | null>(null)
  const queue = useRef(new SimulationWorkerQueue())
  const remainder = useRef(0)
  const settled = useRef(true)

  const fail = useCallback((message: string) => {
    workerRef.current?.terminate()
    workerRef.current = null
    queue.current.cancel()
    playingRef.current = false
    motion.current.playing = false
    motion.current.interpolation = 1
    settled.current = true
    setPlaying(false)
    setInterpolation(1)
    setError(message)
  }, [])

  const dispatch = useCallback((now: number) => {
    if (!playingRef.current || document.hidden || !workerRef.current) return
    const request = queue.current.next(now)
    if (!request) return
    try { workerRef.current.postMessage(request) }
    catch (cause) { fail(cause instanceof Error ? cause.message : 'Traffic simulation could not advance') }
  }, [fail])

  const initialize = useCallback((scenario: Scenario) => {
    setError(null)
    remainder.current = 0
    settled.current = true
    motion.current.interpolation = 1
    setPrevious(null)
    setInterpolation(1)
    try {
      if (!workerRef.current) {
        const worker = new Worker(new URL('../simulation/simulation.worker.ts', import.meta.url), { type: 'module' })
        workerRef.current = worker
        worker.onmessage = (event: MessageEvent<SimulationWorkerResponse>) => {
          if (workerRef.current !== worker || !queue.current.accept(event.data)) return
          const response = event.data
          if (response.type === 'error') { fail(response.message); return }
          current.current = response.comparison
          setComparison(response.comparison)
          setPrevious(response.type === 'advanced' ? response.previous : null)
          if (response.type === 'advanced' && playingRef.current) settled.current = false
          if (response.comparison.fixed.finished && response.comparison.optimized.finished) {
            playingRef.current = false
            motion.current.playing = false
            setPlaying(false)
          }
          const amount = playingRef.current && !settled.current ? queue.current.pendingTicks ? 1 : remainder.current : 1
          motion.current.interpolation = amount
          setInterpolation(amount)
          dispatch(performance.now())
        }
        worker.onerror = event => {
          if (workerRef.current !== worker) return
          event.preventDefault()
          fail(event.message || 'Traffic simulation worker could not start. Reset the simulation to retry.')
        }
        worker.onmessageerror = () => {
          if (workerRef.current === worker) fail('Traffic simulation data could not be read. Reset the simulation to retry.')
        }
      }
      workerRef.current.postMessage(queue.current.initialize(scenario))
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : 'Traffic simulation worker could not start')
    }
  }, [dispatch, fail])

  useEffect(() => {
    const workQueue = queue.current
    initialize(createScenario(config.current.scenarioId, config.current.seed))
    return () => {
      // StrictMode mounts effects twice; terminate the first worker and reject all its replies.
      workerRef.current?.terminate()
      workerRef.current = null
      workQueue.cancel()
    }
  }, [initialize])

  const rebuild = useCallback((id: ScenarioId, nextSeed: number) => {
    const scenario = createScenario(id, nextSeed)
    config.current = { scenarioId: id, seed: nextSeed }
    playingRef.current = false
    motion.current.playing = false
    setPlaying(false)
    // Explicit resets immediately replace labels and metrics together; no running engine stays here.
    current.current = snapshotComparison(createComparison(scenario))
    setComparison(current.current)
    initialize(scenario)
  }, [initialize])
  const reset = useCallback(() => rebuild(config.current.scenarioId, config.current.seed), [rebuild])
  const setScenario = useCallback((id: ScenarioId) => {
    setScenarioId(id)
    rebuild(id, config.current.seed)
  }, [rebuild])
  const setSeed = useCallback((value: number) => {
    if (!Number.isFinite(value)) return
    const normalized = Math.max(0, Math.min(2147483647, Math.trunc(value)))
    setSeedValue(normalized)
    rebuild(config.current.scenarioId, normalized)
  }, [rebuild])
  const setSpeed = useCallback((value: number) => {
    if ([1, 5, 10, 20, 50].includes(value)) {
      motion.current.speed = value
      setPlaybackSpeed(value)
    }
  }, [])
  const startPause = useCallback(() => {
    if (!playingRef.current && (!workerRef.current || (current.current.fixed.finished && current.current.optimized.finished))) {
      rebuild(config.current.scenarioId, config.current.seed)
    }
    if (!workerRef.current) return
    const next = !playingRef.current
    playingRef.current = next
    motion.current.playing = next
    motion.current.interpolation = 1
    settled.current = true
    setPlaying(next)
    setInterpolation(1)
  }, [rebuild])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last: number | null = null
    const visibility = () => { last = null }
    document.addEventListener('visibilitychange', visibility)
    const render = (now: number) => {
      if (!playingRef.current) return
      if (last === null || document.hidden) {
        last = now
        frame = requestAnimationFrame(render)
        return
      }
      const clock = advanceClock(now - last, motion.current.speed, remainder.current)
      last = now
      remainder.current = clock.remainder
      queue.current.enqueue(clock.ticks)
      // Camera/vehicle frames read the stable ref without rerendering the dashboard every frame.
      motion.current.interpolation = settled.current || queue.current.pendingTicks || queue.current.advancing ? 1 : remainder.current
      dispatch(now)
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [playing, dispatch])

  const download = useCallback(() => {
    const payload = {
      schemaVersion: 1,
      project: 'SyncRoute',
      location: 'Connaught Place, New Delhi',
      dataMode: 'simulation',
      controlModeLabels: CONTROL_LABELS,
      assumptions: {
        tickSeconds: 1, vehicleSpacingMetres: 7.5, laneCountPerDirectedLink: 1,
        normalDischargeHeadwaySeconds: 2, h3Resolution: 10, forecastHorizonSeconds: 30,
        map: 'OpenStreetMap geometry, simplified illustrative traffic operations',
        comparison: 'Identical demand and events; only signal and routing policies differ',
        controller: 'Rule-based adaptive control; no trained reinforcement learning policy',
        fleet: 'Mixed visual classes use common 7.5m single-lane storage; no class-specific dynamics',
      },
      ...current.current,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `syncroute-${current.current.scenario.id}-seed-${current.current.scenario.seed}-t${current.current.fixed.time}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  return { comparison, previous, interpolation, motion, error, playing, speed, scenarioId, seed, startPause, reset, setSpeed, setScenario, setSeed, download }
}
