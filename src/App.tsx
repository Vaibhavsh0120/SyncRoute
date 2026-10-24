import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Checkmark, Download, Fork, Information, Layers, Location, Maximize, Minimize, Pause, Play, Reset, Settings, Time, TrafficFlow } from '@carbon/icons-react'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table'
import TrafficMap from './components/TrafficMap'
import { WaitingChart } from './components/dashboard/WaitingChart'
import { NetworkInspector } from './components/dashboard/NetworkInspector'
import { clockTime, number } from './components/dashboard/format'
import { useSimulation } from './hooks/useSimulation'
import { NETWORK } from './data/network'
import { getAreaContext } from './data/context'
import { previewRoute } from './simulation'
import type { CameraState, Mode, ScenarioId, Selection } from './domain/types'
import './App.css'

const SCENARIOS: { id: ScenarioId; name: string; detail: string }[] = [
  { id: 'city', name: 'Connaught Place full traffic', detail: 'Mixed cars, motorbikes and buses across the circles, radials and side streets.' },
  { id: 'normal', name: 'Balanced traffic', detail: 'Everyday demand across boundary gateways and circles.' },
  { id: 'rush', name: 'Peak corridor rush', detail: 'Heavy radial demand tests queue spillbacks and signal optimization.' },
  { id: 'incident', name: 'Road incident', detail: 'A temporary restriction reduces road capacity.' },
  { id: 'ambulance', name: 'Emergency response', detail: 'An ambulance travels through regular traffic.' },
]

function App() {
  const sim = useSimulation()
  const { comparison, previous, interpolation, playing, speed, scenarioId, seed } = sim
  const { fixed, optimized, scenario } = comparison
  const [mapExpanded, setMapExpanded] = useState(false)
  const mapPanel = useRef<HTMLElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  const [showHexagons, setShowHexagons] = useState(true)
  const [activeMode, setActiveMode] = useState<Mode>('optimized')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [camera, setCamera] = useState<CameraState>({ longitude: NETWORK.center[0], latitude: NETWORK.center[1], zoom: 15.8, bearing: -25, pitch: 55 })
  const [miniCamera, setMiniCamera] = useState<CameraState>({ longitude: NETWORK.center[0], latitude: NETWORK.center[1], zoom: 14.7, bearing: 0, pitch: 0 })
  const [origin, setOrigin] = useState('janpath')
  const [destination, setDestination] = useState('state-entry')
  const [routeVisible, setRouteVisible] = useState(true)
  const [draftSeed, setDraftSeed] = useState(String(seed))
  const [seedError, setSeedError] = useState('')
  const fixedRoute = useMemo(() => routeVisible && origin !== destination ? previewRoute(fixed, origin, destination) : null, [fixed, origin, destination, routeVisible])
  const optimizedRoute = useMemo(() => routeVisible && origin !== destination ? previewRoute(optimized, origin, destination) : null, [optimized, origin, destination, routeVisible])
  const selectedWorld = selection?.mode === 'fixed' ? fixed : optimized
  const waitingDelta = fixed.metrics.totalWaitingTime > 0 ? (fixed.metrics.totalWaitingTime - optimized.metrics.totalWaitingTime) / fixed.metrics.totalWaitingTime * 100 : null
  const finished = fixed.finished && optimized.finished
  const progress = Math.min(100, fixed.time / scenario.duration * 100)
  const decisions = optimized.decisions.slice(0, 5)
  const activeSnapshot = activeMode === 'fixed' ? fixed : optimized
  const activeRoute = activeMode === 'fixed' ? fixedRoute : optimizedRoute
  const weather = scenarioId === 'city' ? getAreaContext(activeSnapshot.time).weather.condition : 'Clear'
  const status = finished ? 'Analysis complete' : playing ? 'Traffic active' : fixed.time > 0 ? 'Traffic paused' : 'Ready'
  const changeScenario = (id: ScenarioId) => { sim.setScenario(id); setSelection(null) }
  const reset = () => { sim.reset(); setSelection(null) }

  useEffect(() => {
    if (!mapExpanded) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    expandButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMapExpanded(false); return }
      if (event.key !== 'Tab' || !mapPanel.current) return
      const controls = [...mapPanel.current.querySelectorAll<HTMLElement>('button, a[href], input, select, [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.getClientRects().length && !element.hasAttribute('disabled'))
      const first = controls[0], last = controls[controls.length - 1]
      if (!first || !last) return
      const outside = !mapPanel.current.contains(document.activeElement)
      if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      previousFocus?.focus()
    }
  }, [mapExpanded])

  return (
    <TooltipProvider><div className="command-center">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="SyncRoute traffic management"><span className="brand-mark"><TrafficFlow size={23} /></span><span>SyncRoute<span className="brand-period">.</span></span></a>
        <span className="product-divider" />
        <span className="product-label">TRAFFIC COMMAND CENTER</span>
        <div className="local-status"><span className="status-dot" />Local simulation<span className="local-detail"> · Connaught Place</span></div>
      </header>
      <main id="main" className="workspace">
        <section className="page-heading" aria-labelledby="page-title">
          <div><div className="eyebrow"><Location size={13} /> NEW DELHI, INDIA <span className="eyebrow-divider">/</span> PREVENTIVE TRAFFIC MANAGEMENT</div><h1 id="page-title">Connaught Place Traffic Control</h1><p>Compare fixed signals with adaptive traffic control on the same simulated demand.</p></div>
          <Button variant="outline" className="export-button" aria-label="Export simulation report" onClick={sim.download}><Download size={16} />Export report</Button>
        </section>
        <section className="playback-bar" aria-label="Traffic control">
          <div className="playback-actions"><Button className="start-button" onClick={sim.startPause}>{playing ? <Pause size={17} /> : <Play size={17} />}{playing ? 'Pause traffic' : finished ? 'Restart traffic' : fixed.time > 0 ? 'Resume traffic' : 'Start traffic'}</Button><Button variant="ghost" className="reset-button" aria-label="Reset simulation" onClick={reset}><Reset size={16} /><span>Reset</span></Button></div>
          <div className="timeline"><div className="timeline-label"><span className={playing ? 'playback-state running' : 'playback-state'}><span className="status-dot" />{status}</span><span className="time-value">{clockTime(fixed.time)} <span>/ {clockTime(scenario.duration)}</span></span></div><progress aria-label="Traffic progress" max={100} value={progress} /></div>
          <label className="speed-select"><span>Playback</span><select aria-label="Playback speed" value={speed} onChange={(event) => sim.setSpeed(Number(event.target.value))}>{[1, 5, 10, 20, 50].map((value) => <option value={value} key={value}>{value}× speed</option>)}</select></label>
        </section>
        {sim.error && <p className="simulation-error" role="alert">Traffic paused: {sim.error} Use Reset to retry.</p>}
        <section className="metric-strip" aria-label="Live comparison metrics">
          <div className="metric metric-lead"><div className="metric-label">TOTAL WAITING TIME <span>vehicle-minutes</span><Tooltip><TooltipTrigger className="metric-help" aria-label="About total waiting time"><Information size={11} /></TooltipTrigger><TooltipContent>Sum of time spent stopped, including vehicles waiting to enter. Lower is better.</TooltipContent></Tooltip></div><div className="metric-pair"><span className="fixed-value">{number(fixed.metrics.totalWaitingTime / 60, 1)}<small>Normal</small></span><ArrowRight size={18} /><span className="optimized-value">{number(optimized.metrics.totalWaitingTime / 60, 1)}<small>Optimized</small></span><span className={`metric-delta ${waitingDelta !== null && waitingDelta < 0 ? 'negative' : ''}`}>{waitingDelta === null ? 'Awaiting data' : `${number(Math.abs(waitingDelta), 1)}% ${waitingDelta >= 0 ? 'less' : 'more'} waiting`}</span></div></div>
          <div className="metric"><div className="metric-label">TRIPS COMPLETED</div><div className="metric-compact"><span><i className="series-dot fixed" />{fixed.metrics.completed}<small> / {fixed.metrics.requested}</small></span><span><i className="series-dot optimized" />{optimized.metrics.completed}<small> / {optimized.metrics.requested}</small></span></div><div className="metric-footnote">{fixed.metrics.unfinished} fixed / {optimized.metrics.unfinished} adaptive unfinished</div></div>
          <div className="metric"><div className="metric-label">MEAN COMPLETED TRIP <span>minutes</span></div><div className="metric-compact"><span><i className="series-dot fixed" />{fixed.metrics.meanCompletedTravelTime === null ? '—' : number(fixed.metrics.meanCompletedTravelTime / 60, 1)}</span><span><i className="series-dot optimized" />{optimized.metrics.meanCompletedTravelTime === null ? '—' : number(optimized.metrics.meanCompletedTravelTime / 60, 1)}</span></div><div className="metric-footnote">{fixed.metrics.completed} fixed / {optimized.metrics.completed} optimized trips</div></div>
          <div className="metric"><div className="metric-label">LONGEST CURRENT QUEUE <span>vehicles</span></div><div className="metric-compact"><span><i className="series-dot fixed" />{number(fixed.metrics.longestQueue / 7.5)}</span><span><i className="series-dot optimized" />{number(optimized.metrics.longestQueue / 7.5)}</span></div><div className="metric-footnote">Fixed / Optimized · 7.5 m per vehicle</div></div>
        </section>
        <div className="operations-layout">
          <section ref={mapPanel} className={`map-workspace panel ${mapExpanded ? 'map-expanded' : ''}`} role={mapExpanded ? 'dialog' : undefined} aria-modal={mapExpanded || undefined} aria-labelledby="map-section-title">
            <header className="panel-header map-toolbar"><div className="panel-heading"><h2 id="map-section-title">Connaught Place · 3D city</h2><span className="subtle-label">{clockTime(activeSnapshot.time)}</span></div><div className="map-controls">{mapExpanded && <Button className="expanded-playback" onClick={sim.startPause}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? 'Pause' : finished ? 'Restart' : 'Start'} traffic</Button>}<button className={`hex-toggle ${showHexagons ? 'selected' : ''}`} aria-pressed={showHexagons} onClick={() => setShowHexagons((current) => !current)}><Layers size={15} />Hex grid</button><Button ref={expandButton} variant="outline" className="expand-map-button" aria-expanded={mapExpanded} onClick={() => setMapExpanded((current) => !current)}>{mapExpanded ? <Minimize size={14} /> : <Maximize size={14} />}{mapExpanded ? 'Collapse' : 'Fullscreen'}</Button></div></header>
            <div className={`city-view city-view-${activeMode}`}>
              <TrafficMap snapshot={activeSnapshot} previousSnapshot={previous?.[activeMode]} interpolation={interpolation} motion={sim.motion} viewMode="3d" showHexagons={showHexagons} showRoutes={routeVisible} route={activeRoute} camera={camera} onCameraChange={setCamera} onSelect={setSelection} className="main-city-map" />
              <div className="world-label"><span className={`map-mode-indicator ${activeMode}`} /><div><strong>{activeMode === 'optimized' ? 'Adaptive Control' : 'Standard Control'}</strong><span>{activeMode === 'optimized' ? 'Adaptive signals · smart rerouting' : 'Fixed signals · static routes'}</span></div><Badge variant="outline" className="world-badge">{activeMode === 'optimized' ? 'ADAPTIVE' : 'STANDARD'}</Badge></div>
              <div className="world-switch"><span>CONTROL MODE</span><Button variant="secondary" onClick={() => { setActiveMode((current) => current === 'optimized' ? 'fixed' : 'optimized'); setSelection(null) }}><TrafficFlow size={16} />{activeMode === 'optimized' ? 'Switch to standard' : 'Switch to adaptive'}</Button><small>Both strategies share the same clock</small></div>
              <section className="map-inset" aria-label="2D overview of selected strategy"><div className="inset-heading"><span>2D OVERVIEW</span><span>N ↑</span></div><div className="inset-canvas"><TrafficMap snapshot={activeSnapshot} previousSnapshot={previous?.[activeMode]} interpolation={interpolation} motion={sim.motion} viewMode="2d" showHexagons={showHexagons} showRoutes={routeVisible} route={activeRoute} camera={miniCamera} onCameraChange={setMiniCamera} onSelect={setSelection} className="overview-city-map" /></div></section>
              <div className="network-count"><strong>{activeSnapshot.metrics.onRoad}</strong> vehicles on road<span>·</span>{activeSnapshot.metrics.boundaryWaiting} waiting to enter</div>
            </div>
            <div className="control-explanation"><div><TrafficFlow size={17} /><strong>{activeMode === 'optimized' ? 'Preventive control active' : 'Standard fixed timing'}</strong><span>{activeMode === 'optimized' ? 'Early warnings trigger signal adjustments and route guidance.' : 'Signals follow fixed cycles; vehicles use shortest-distance routes.'}</span></div><span className="intervention-count">{activeMode === 'optimized' ? `${optimized.metrics.reroutes} reroutes · ${optimized.metrics.yellowCells} zones at risk` : 'Same traffic volume and conditions'}</span></div>
            <footer className="map-legend"><div><span className="legend-title">TRAFFIC STATE</span><span><i className="legend-hex free" />Free flow</span><span><i className="legend-hex risk" />Congestion risk · act early</span><span><i className="legend-hex congested" />Congested</span></div><span className="legend-hint"><Information size={13} /> Select vehicles, cells or signals to inspect</span></footer>
          </section>
          <aside className="control-rail panel" aria-label="Simulation setup and inspector">
            <section className="rail-section scenario-section"><div className="rail-heading"><h2>Traffic Pattern</h2><Badge variant="outline" className="seed-badge">ID {seed}</Badge></div><label className="field-label" htmlFor="scenario">Current conditions</label><select id="scenario" value={scenarioId} onChange={(event) => changeScenario(event.target.value as ScenarioId)}>{SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="scenario-description">{SCENARIOS.find((item) => item.id === scenarioId)?.detail}</p><dl className="scenario-facts"><div><dt>Vehicles</dt><dd>{scenario.demand.length} tracked</dd></div><div><dt>Duration</dt><dd>{number(scenario.duration / 60, 0)} minutes</dd></div><div><dt>Route guidance</dt><dd>{scenario.demand.length ? Math.round(scenario.demand.filter((demand) => demand.adoptsRouting).length / scenario.demand.length * 100) : 0}% use guidance</dd></div><div><dt>Weather</dt><dd>{weather} · simulated</dd></div><div><dt>Road restriction</dt><dd>{activeSnapshot.incidentActive ? 'Active' : 'Inactive'}</dd></div>{(scenarioId === 'city' || scenarioId === 'ambulance') && <div><dt>Ambulance</dt><dd>{activeSnapshot.metrics.ambulanceStatus}</dd></div>}</dl><details className="advanced-settings"><summary><Settings size={13} />Advanced</summary><form onSubmit={(event) => { event.preventDefault(); const value = Number(draftSeed); if (!Number.isSafeInteger(value) || value < 0 || value > 2147483647 || !draftSeed.trim()) { setSeedError('Enter a whole number from 0 to 2147483647.'); return }; setSeedError(''); sim.setSeed(value); setSelection(null) }}><label htmlFor="seed">Traffic pattern ID</label><div className="seed-form"><input id="seed" inputMode="numeric" value={draftSeed} onChange={(event) => setDraftSeed(event.target.value)} aria-invalid={!!seedError} aria-describedby={seedError ? 'seed-error' : undefined} /><Button type="submit" variant="outline">Apply</Button></div>{seedError && <p id="seed-error" role="alert" className="field-error">{seedError}</p>}<p>Changing the ID reloads both control modes.</p></form></details></section>
            <section className="rail-section route-section"><div className="rail-heading"><h2>Route explorer</h2><Fork size={16} /></div><label className="field-label" htmlFor="origin">From</label><select id="origin" value={origin} onChange={(event) => setOrigin(event.target.value)}>{NETWORK.nodes.filter((node) => NETWORK.gateways.includes(node.id)).map((node) => <option value={node.id} key={node.id}>{node.name}</option>)}</select><label className="field-label destination-label" htmlFor="destination">To</label><select id="destination" value={destination} onChange={(event) => setDestination(event.target.value)}>{NETWORK.nodes.filter((node) => NETWORK.gateways.includes(node.id)).map((node) => <option value={node.id} key={node.id}>{node.name}</option>)}</select><Button variant="outline" className="route-button" disabled={origin === destination} onClick={() => setRouteVisible((current) => !current)}>{routeVisible ? <Checkmark size={15} /> : <ArrowRight size={15} />}{routeVisible ? 'Hide route comparison' : 'Compare routes'}</Button>{origin === destination && <p className="field-error">Choose two different locations.</p>}{routeVisible && fixedRoute && optimizedRoute && <div className="route-results"><div><span><i className="series-dot fixed" />Fixed</span><strong>{number(fixedRoute.travelTime / 60, 1)} min</strong></div><div><span><i className="series-dot optimized" />Optimized</span><strong>{number(optimizedRoute.travelTime / 60, 1)} min</strong></div><p>Current route estimate · not a completed trip.</p></div>}</section>
            <NetworkInspector selection={selection} snapshot={selectedWorld} onClear={() => setSelection(null)} />
          </aside>
        </div>
        <div className="analysis-grid">
          <WaitingChart fixed={fixed} optimized={optimized} duration={scenario.duration} />
          <section className="panel decision-panel" aria-labelledby="decisions-title"><header className="panel-header"><div className="panel-heading"><h2 id="decisions-title">Decision log</h2><Badge variant="outline" className="decision-count">{optimized.decisions.length} retained</Badge></div><span className="subtle-label">Adaptive network</span></header>{decisions.length ? <div className="decision-list"><Table className="decision-table"><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Intervention & reason</TableHead><TableHead className="decision-type-heading">Type</TableHead></TableRow></TableHeader><TableBody>{decisions.map((decision) => <TableRow key={decision.id}><TableCell className="decision-time"><time>{clockTime(decision.time)}</time></TableCell><TableCell><div className="decision-event"><span className={`decision-marker ${decision.type}`}><TrafficFlow size={14} /></span><div><h3>{decision.title}</h3><p>{decision.detail}</p></div></div></TableCell><TableCell className="decision-kind">{decision.type === 'prevention' ? 'PREVENTIVE' : decision.type.toUpperCase()}</TableCell></TableRow>)}</TableBody></Table></div> : <div className="decision-empty"><div className="empty-event-icon"><Time size={22} /></div><div><h3>Every intervention has a reason.</h3><p>Start the traffic to follow signal changes, preventive reroutes, and emergency responses.</p></div></div>}<footer className="decision-footer"><span><span className="status-dot" />Simulation decision log</span><span>Latest {decisions.length} shown</span></footer></section>
        </div>
        <details className="model-notes panel"><summary><Information size={16} />How the controller works</summary><div className="model-notes-content"><p><strong>Now:</strong> rules coordinate signals, routes and ambulance priority using shared demand.</p><p><strong>Next:</strong> cooperative multi-agent reinforcement learning needs training and validation.</p><p>H3 groups locations. Weather and vehicles are simplified; no real signals are connected.</p></div></details>
        <footer className="workspace-footer"><span>SyncRoute<span className="footer-separator">/</span>Connaught Place, New Delhi</span><span>H3 traffic regions <span className="footer-dot">·</span> Local simulated telemetry</span></footer>
      </main>
    </div></TooltipProvider>
  )
}

export default App

