# SyncRoute final project review

Reviewed on 24 October 2026. Scope: application code, simulation and routing, playback lifecycle, map assets and generation, 3D/2D rendering, dashboard interactions, exports, dependency audit, documentation and the proposed real-world architecture.

## Result

The local simulation is working, with the confirmed functional defects below fixed and regression coverage added. This review does not certify a real traffic controller. There is no trained MARL policy, telemetry backend or connection to public signal hardware.

## Changes and resolved findings

| Area | Finding | Resolution |
| --- | --- | --- |
| Architecture | Closed-way-only extraction omitted complete OSM building relations and mapped stepped parts | Recovered 28 polygons from 25 relations and 62 height-tagged above-ground parts; preserved 36 courtyard holes |
| Geography | An underground station footprint appeared as an above-ground building | Excluded below-ground building ways, relations and parts |
| City detail | Thin architecture and limited street/roof context | 785 building volumes, 560 trees, 100 lamps, 44 benches, 941 park surfaces, 31 courtyard plazas and 871 roof details across 190 volumes |
| Fleet | 3D map used flat symbols | Added batched dimensional cars, motorbikes, compact buses and ambulances with glass, wheels, lights, roofs and shadows; retained 2D sprites |
| Map picking | 3D cell clicks queried nonexistent layers | Query the actual hex layers; dimensional vehicle picking and complete vehicle inspection now work |
| Inspector | Vehicle selection produced no details; empty/stale selections were unclear | Added speed, stopped time, road, endpoints and route changes, plus explicit empty-cell and departed-vehicle states |
| Playback | Pausing within the rendering throttle could leave vehicles between engine positions | Final interpolation frames bypass the throttle; unchanged settled frames do not rebuild geometry |
| Emergency priority | An ambulance behind a blocked receiver could indefinitely hold a green and starve feasible cross traffic | Suspend priority when the single-lane head cannot discharge; restore ordinary service and safely request priority again when space opens |
| Routing | Green permission was checked before a blocked adopting head could select an available diversion | Let stopped junction heads evaluate qualifying diversions before signal feasibility; crossing still requires green, clearance and storage |
| Claims | UI implied live monitoring and trained AI | Label local simulation and adaptive rules; explain proposed MARL separately; include controller/fleet assumptions in JSON exports |
| Operating context | Weather, restriction and emergency state were hidden | Show actual selected-world simulated context and unfinished demand |
| Documentation | Reduced-network counts and fixed signal timing were stale | Corrected to 419 nodes, 888 directed links, 28 controllers, 38 gateways and seeded 20–40 second fixed greens |
| Pitch | Missing method/benefits and an inaccurate Europe–India contrast | Completed the sourced pitch and staged deployment/MARL roadmap |

No invented building footprints were added. Geometry comes from the saved OSM response; heights, materials, vegetation and furniture remain illustrative. Incomplete relations are skipped rather than filling unknown courtyard geometry. Some sparse perimeter areas remain limited by source coverage.

## Verification evidence

- `npm test`: **41 tests passed across 4 files**. Coverage includes conservation, downstream storage, signal clearance, minimum green, fixed-clock behavior, weather normalization, deterministic demand, route-adoption thresholds, both emergency regressions, blocked-route diversion, geometry validity/rotation/queue dimensions and inspector edge states.
- `npm run lint`: passed.
- `npm run build`: TypeScript and Vite production build passed. Vite retains a large-chunk advisory; main JavaScript is about 1.95 MB, about 534 kB gzip, with the local MapLibre worker about 519 kB. This remains a loading/performance improvement opportunity, especially on low-end devices.
- `npm run benchmark`: all five scenarios at seed 42, 1,200 ticks each, two policies. Every tick passed vehicle-conservation and road-storage checks. All requested vehicles completed within the horizon in these runs.
- `npm audit --omit=dev --audit-level=high`: zero reported production dependency vulnerabilities at review time. This is a package audit, not a full security certification.
- `git diff --check`: passed.
- Offline scene generation: repeat outputs have identical SHA256 hashes; finite coordinates, closed rings, valid extrusion ranges and 1,900 park/roof containment checks passed. Every building coordinate traces to raw OSM.
- Browser: rendered before/after views at 1,440 desktop and 390 mobile, with additional 1,728-width measurement. Tested start/pause/reset, scenario reset, seed validation and application, same-endpoint route guard, hide/show routes, strategy switching, cell/signal/vehicle picking, JSON download, fullscreen, Escape, focus containment/restoration and camera reset. A selected motorbike correctly displayed its road and 36.0 km/h speed. No horizontal page overflow was observed at checked widths.
- Production browser: both map canvases loaded with external requests blocked; zero external requests, failed requests, page errors or map fallbacks. Tested playback with reduced motion. Geist body/heading font loading was confirmed.

Browser screenshots and exported verification data are local ignored files under `.playwright-mcp/`; benchmark output is regenerated in `artifacts/benchmark.json`.

### Seed-42 benchmark results

| Scenario | Fixed waiting (vehicle-min) | Adaptive waiting (vehicle-min) | Waiting reduction | Completed fixed / adaptive | Unfinished fixed / adaptive |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full city | 278.6 | 85.5 | 69.3% | 901 / 901 | 0 / 0 |
| Balanced | 117.3 | 27.6 | 76.5% | 200 / 200 | 0 / 0 |
| Rush | 469.5 | 100.1 | 78.7% | 300 / 300 | 0 / 0 |
| Incident | 475.9 | 116.8 | 75.4% | 300 / 300 | 0 / 0 |
| Ambulance | 479.8 | 99.6 | 79.2% | 301 / 301 | 0 / 0 |

These are authored simulator outcomes from one seed, not predicted Delhi savings or evidence for MARL. Fixed and adaptive controllers have different timing/start-phase policies. A field study needs tuned baselines, common calibrated initial conditions, multiple demand and training seeds, held-out networks and uncertainty estimates. The emergency trip took 241 / 169 seconds in city mode and 257 / 163 seconds in the ambulance scenario.

## Design review limits

Better Design visual/behavior guidance and review rules were used. Comprehension checks passed for the actual page regions after simplifying the controller explanation. `inspect-spacing` completed captures at 390, 1,440 and 1,728 px. Its whole-page heuristic report flags intentionally clipped offscreen MapLibre markers/SVGs, map viewport overflow, distributed flex gaps and nested third-party navigation corners; it also reached its findings limit. Those flags were inspected with rendered screenshots and page-overflow/interaction checks; the automated spacing report is **not** a clean pass.

The dashboard-structure endpoint requires a supplied multi-step fixture, which this simulation request does not contain; calling it with an empty fixture was rejected. Its public-HTTPS final review receipt was not obtained: this task changes and pushes the repository without creating a hosted deployment. No remote design certification is claimed. Context7 documentation lookup was quota-blocked; official MapLibre/H3 sources were used as fallback.

## Remaining real-world and performance work

The present engine uses one logical lane and one common 7.5 m storage slot per class. Compact buses are deliberately shorter than full-size real buses. There is no lane changing, overtaking, calibrated vehicle dynamics or pedestrian/cyclist crossing model. Bus priority, city-scale coordination and authenticated emergency green corridors are proposed capabilities, not completed field integrations.

Before a pilot: survey and calibrate actual turns, lanes, phases and demand; integrate approved sensors with data-quality checks; train/evaluate the proposed MARL policy offline against strong baselines; add independent controller safety limits and outage fallback; run shadow mode and hardware validation with the authority. The full plan is in [REAL_WORLD_ROADMAP.md](REAL_WORLD_ROADMAP.md), and the completed narrative is in [PITCH.md](PITCH.md).
