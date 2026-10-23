# From the SyncRoute simulation to an evaluated corridor pilot

This is a proposed engineering and research plan, checked against the repository on 24 October 2026. It does not describe a deployed traffic controller or a completed training run.

## What exists today

The application is a local React/TypeScript simulation using OpenStreetMap geometry, H3 aggregation and a 3D/2D map. The supplied operational graph contains 419 nodes, 888 directed links and 28 illustrative signal controllers. Both worlds share one immutable seeded demand manifest, incidents and weather timeline.

The adaptive policy uses queue/approach pressure, downstream storage, yellow congestion warnings and thresholded junction rerouting. It preserves minimum green, amber and all-red transitions and demonstrates local ambulance priority. The forecast extrapolates recent occupancy; it is not trained. The default city scenario includes cars, bikes and buses, but each occupies one identical 7.5 m logical lane slot. There is no calibrated mixed-traffic behaviour, pedestrian model, live telemetry pipeline, signal hardware integration or learned policy in the current prototype. Visual realism does not establish operational accuracy.

## Proposed system boundaries

1. **Observation layer:** ingest consented probe and bus-fleet observations plus approved camera/radar/loop aggregates. Record observation time, receipt time, source and quality; reject stale, duplicate, impossible or off-road observations. A slow GPS probe alone does not establish a queue or a city-wide vehicle count.
2. **State estimation:** map-match observations to directed road links, estimate queues and uncertainty, then aggregate summaries into H3 cells for analysis. Fuse infrastructure counts to estimate non-connected traffic. Treat missing coverage as unknown, not an empty road.
3. **Local junction agents:** choose only from traffic-engineer-approved phase actions. Use downstream receiving capacity, pedestrian calls and recent neighbouring junction summaries. The local signal controller always owns the conflict matrix, intergreen and minimum-service constraints.
4. **Corridor coordination:** exchange queue and arrival estimates along actual road connectivity; share H3 summaries for area analysis. A city supervisor sets corridor objectives, event plans and diversion budgets. Adjacent H3 cells alone cannot identify legal routes or grade-separated connections.
5. **Operator and traveller services:** provide explanations, incident acknowledgement, authenticated emergency requests, auditable overrides and cautious route advice. The operator can revert to an approved fixed/actuated plan independently of the model.

[H3 is a spatial index](https://h3geo.org/docs/), not a communications standard. Prefer existing approved fibre/cellular backhaul in the first pilot. V2X can be an additional compatible channel where infrastructure and vehicles support it. Select exact communications/security interfaces with the road authority and controller vendor; no device-to-signal write access follows from knowing an H3 ID.

## Cooperative multi-agent learning design

**Unit of control:** one agent per signalised junction or an engineer-approved small junction group. H3 tiles provide observations and regional summaries rather than imposing a signal agent on every tile. One junction may cross several cells and several junctions may share a cell.

**Training and execution:** use centralised training with decentralised execution. During offline training, a critic can see a wider network state; each deployed actor uses local observations and permitted neighbour summaries. Prototype MAPPO as one candidate and retain a simpler pressure controller as the fallback and comparator. The [original multi-agent actor-critic paper](https://arxiv.org/abs/1706.02275) and [MAPPO study](https://arxiv.org/abs/2103.01955) motivate these patterns; neither establishes that a policy will improve Delhi traffic.

| Part | Proposed contract |
| --- | --- |
| Observation | Per-movement queue and arrival estimates; downstream storage; current phase and elapsed time; pedestrian calls; verified bus/emergency requests; neighbour arrivals; freshness, confidence and missing-data masks |
| Action | Hold the current approved green for a bounded interval, or request a legal next phase at a decision boundary |
| Safety filter | Mask conflicting or prohibited actions; enforce calibrated minimum green, amber/all-red, pedestrian clearance, maximum red/service limits and blocked-exit restrictions |
| Reward | Reduce network person-delay and spillback; penalise excess stops, tail delay, side-road starvation, unsafe requests and unnecessary switching; account for emergency service and bus punctuality |
| Cooperation | Combine local delay with connected-neighbour impact; share bounded summaries so one agent cannot claim success by exporting its queue |
| Routing | Separate slower route-advice loop with adoption limits, minimum savings, cooldowns and neighbourhood diversion budgets |
| Runtime failure | On missing/stale inputs, model error or lost coordination, revert to an approved local plan and report degraded operation |

Hard safety rules must remain outside the reward. An agent must never buy a forbidden movement with an apparently better score. Test emergency request expiration and recovery explicitly: an ambulance blocked downstream must not hold a green forever while feasible side roads starve. Bus priority should be conditional and bounded, with overall person-delay and maximum waiting constraints. No online exploration is permitted on public roads in this plan.

Training data must include varied demand, route adoption and mixed vehicle proportions; signal layouts; rain; incidents; festival surges; sensor dropouts, latency and biased coverage. Split training, validation and test scenarios by demand patterns, seeds and network areas; select a policy on validation results, then evaluate once on held-out scenarios.

## Evaluation before any field control

Build a calibrated SUMO environment with observed lane geometry, turning restrictions, actual signal plans, crossings and vehicle classes. SUMO supports custom traffic-control research and coupling to external control code, but generated signal plans still need verification against the field. [SUMO traffic-light documentation](https://sumo.dlr.de/docs/Simulation/Traffic_Lights.html).

Compare against all of: the approved fixed timetable, a sensibly tuned actuated controller, the present pressure-based policy, and the proposed learned policy. Keep the same arrival demand, event seeds, sensing coverage, initial state and evaluation horizon for each policy. Include warm-up and drainage; retain unfinished trips rather than reporting only easy completed journeys.

Measure total system/person delay, completed/requested trips, unfinished demand, median and 95th-percentile trip times, maximum approach and pedestrian waits, queue spillback, bus punctuality, emergency travel time, route distance and neighbourhood diversion. Use a stated occupancy model when calculating person-delay. Fuel/emission claims require an appropriate emissions model and calibration; the current vehicle colours and speeds cannot prove them.

Run multiple independent demand and training seeds, report distributions and uncertainty, and retain scenarios where the adaptive policy loses. Perform ablations for neighbour exchange, route advice, prediction and priority to identify what causes any improvement. Test an unseen corridor, large demand shifts, false emergency requests, unreliable clocks and communications outages. Acceptance thresholds must be agreed with the operator from baseline measurements before trial results are inspected.

## Delivery gates

| Stage | Deliverable | Gate to advance |
| --- | --- | --- |
| 1. Survey and baseline | Junction inventory, authority/vendor interface, counts, turns, queues, crossings and approved plans | Road authority confirms data access and model assumptions |
| 2. Calibrated simulation | Mixed-traffic simulator, reproducible inputs and baseline comparisons | Traffic engineer validates queue and travel-time fit on held-out days |
| 3. Offline learning | Versioned training configuration, model artefact, evaluation report and safety-filter tests | Agreed performance/fairness targets and all safety checks pass |
| 4. Shadow mode | Real observations drive recommendations while existing controllers retain control | Operator reviews freshness, decision quality, failure recovery and false priorities |
| 5. Hardware trial | Controller integration on a test rig or closed facility | Independent conflict, clearance, outage and manual-override validation |
| 6. Supervised corridor trial | Limited approved operating window, responsible operators and immediate rollback | Authority approval and monitored comparison against agreed baseline |
| 7. Expansion | Repeat evidence across corridors and representative seasons/events | Revalidation, operating ownership and funded maintenance |

The first useful external partner is a traffic authority or corridor operator with observed counts, signal plans and controller access. A bus operator and emergency dispatcher can validate priority requirements. These are dependencies of a real trial; a browser demonstration cannot substitute for them.

## Privacy, security and operating cost

Collect the minimum information needed. Prefer aggregated roadside counts and short-lived pseudonymous observations; keep raw trip traces only for a documented purpose and retention period. Do not assume pseudonyms make location history anonymous. Separate signal control from traveller identity, restrict access by role, encrypt transport, authenticate devices and emergency requests, log changes and rotate credentials. Confirm consent, retention, data-sharing and applicable obligations with the actual pilot partners before collecting live data.

Publish data-health indicators and audit policy versions, source confidence, requested action, safety-filter outcome and actual controller acknowledgement. Expire delayed commands; never replay stale phase changes after reconnection. Log fallback activation and rehearse operator takeover.

Estimate site-specific installation and recurring costs for sensors, controller interfaces, power/backhaul, edge compute, calibration, operations and model maintenance. Start with a small connected corridor using existing equipment where practical. Measure saved person-hours and service reliability before making city-scale cost or congestion-reduction promises.

The spoken narrative and completed pitch sentence are in [PITCH.md](PITCH.md).
