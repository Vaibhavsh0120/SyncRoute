import { Location } from '@carbon/icons-react'
import { NETWORK } from '../../data/network'
import type { Selection, SimulationSnapshot } from '../../domain/types'
import { number } from './format'
import { CONTROL_LABELS } from '../../lib/controlModes'

export function NetworkInspector({ selection, snapshot, onClear }: {
  selection: Selection | null
  snapshot: SimulationSnapshot
  onClear: () => void
}) {
  const hex = selection?.type === 'hex' ? snapshot.hexStats.find(item => item.id === selection.id) : null
  const signal = selection?.type === 'signal' ? snapshot.signals.find(item => item.id === selection.id) : null
  const vehicle = selection?.type === 'vehicle' ? snapshot.vehicles.find(item => item.id === selection.id) : null
  const signalName = signal && NETWORK.signals.find(item => item.id === signal.id)?.name
  const roadName = vehicle && NETWORK.edges.find(item => item.id === vehicle.edgeId)?.name
  const nodeName = (id: string) => NETWORK.nodes.find(item => item.id === id)?.name ?? id
  const vehicleNames = { car: 'Car', bike: 'Motorbike', bus: 'Bus', ambulance: 'Ambulance' }

  return <section className="rail-section inspector" aria-label="Network inspector">
    <div className="rail-heading"><h2>{selection ? 'Network inspector' : 'Look closer'}</h2><Location size={16} /></div>
    {selection && <p className="inspector-strategy">{CONTROL_LABELS[selection.mode]} control</p>}
    {hex ? <>
      <div className={`inspector-category ${hex.category}`}><i className={`legend-hex ${hex.category === 'green' ? 'free' : hex.category === 'yellow' ? 'risk' : 'congested'}`} />{hex.category === 'green' ? 'Free flow' : hex.category === 'yellow' ? 'Congestion risk' : 'Congested'}</div>
      <p className="inspector-reason">{hex.reason}</p>
      <dl className="scenario-facts">
        <div><dt>Vehicles / stopped</dt><dd>{hex.count} / {hex.stopped}</dd></div>
        <div><dt>Mean speed</dt><dd>{number(hex.averageSpeed * 3.6, 1)} km/h</dd></div>
        <div><dt>Occupancy now</dt><dd>{number(hex.occupancy * 100, 0)}%</dd></div>
        <div><dt>30 sec projection</dt><dd>{number(hex.predictedOccupancy * 100, 0)}%</dd></div>
      </dl><p className="inspector-model">Projection uses recent occupancy trends.</p>
    </> : signal ? <>
      <h3 className="selected-signal-name">{signalName ?? signal.id}</h3>
      <dl className="scenario-facts">
        <div><dt>Stage</dt><dd>{signal.stage}</dd></div>
        <div><dt>{snapshot.mode === 'optimized' && signal.stage === 'green' ? 'Green elapsed' : 'Phase remaining'}</dt><dd>{number(snapshot.mode === 'optimized' && signal.stage === 'green' ? signal.elapsed : signal.remaining, 0)} sec</dd></div>
        <div><dt>Approach pressure</dt><dd>{number(signal.pressure[0], 1)} / {number(signal.pressure[1], 1)}</dd></div>
        <div><dt>Emergency priority</dt><dd>{signal.priority ? 'Active' : 'Inactive'}</dd></div>
        <div><dt>Downstream blocked</dt><dd>{signal.blocked ? 'Yes' : 'No'}</dd></div>
      </dl>
    </> : vehicle ? <>
      <h3 className="selected-signal-name">{vehicleNames[vehicle.kind]} <span className="inspector-object-id">{vehicle.id}</span></h3>
      <dl className="scenario-facts">
        <div><dt>Speed</dt><dd>{number(vehicle.speed * 3.6, 1)} km/h</dd></div>
        <div><dt>Time stopped</dt><dd>{number(vehicle.waitingTime, 0)} sec</dd></div>
        <div><dt>Road</dt><dd>{roadName ?? vehicle.edgeId}</dd></div>
        <div><dt>From</dt><dd>{nodeName(vehicle.origin)}</dd></div>
        <div><dt>To</dt><dd>{nodeName(vehicle.destination)}</dd></div>
        <div><dt>Route changes</dt><dd>{vehicle.reroutes}</dd></div>
      </dl>
    </> : selection?.type === 'hex' ? <>
      <h3 className="selected-signal-name">No vehicles in this cell</h3>
      <p>No current traffic observations. Speed and congestion estimates are unavailable.</p>
    </> : selection?.type === 'vehicle' ? <p>This vehicle has left the network. Select another vehicle to inspect its trip.</p>
      : selection ? <p>This signal is no longer available. Select another signal.</p>
      : <><p>Select a vehicle, hexagon or signal on either map to inspect traffic.</p><div className="preventive-note"><span className="risk-line" />Yellow means act early.<span>Emerging congestion triggers route and signal changes.</span></div></>}
    {selection?.type === 'hex' && <p className="inspector-object-id">{selection.id}</p>}
    {selection && <button className="clear-selection" onClick={onClear}>Clear selection <span aria-hidden="true">×</span></button>}
  </section>
}
