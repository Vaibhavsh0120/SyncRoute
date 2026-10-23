# SyncRoute city and project review

User authorization: improve the existing map, buildings, cars, bikes and buses; fill the pitch; review and fix the project; continue without questions and push after validation.

## Intent

Make the existing offline Connaught Place simulation more legible, detailed and useful while retaining reproducible fixed/adaptive comparison. Preserve Cobalt components, Carbon icons, MapLibre, H3, existing geography and engine safety constraints.

## Approach and boundaries

Improve the current MapLibre scene with dimensional vehicle geometry and deterministic OSM-derived or explicitly illustrative architecture. This gains visible depth and density without a second rendering engine; the tradeoff is stylized geometry rather than photorealistic models. Recover source footprints before generating infill; keep parks and road corridors clear.

Keep the existing adaptive rules as the running controller. Describe cooperative multi-agent reinforcement learning as a future evaluated policy, trained centrally and executed locally behind hard safety rules. H3 indexes observations and neighboring regions; it is not a communication protocol. No live infrastructure integration or model-training claim is permitted.

## Deliverables

- Denser architectural context, roof equipment and street furniture with accurate provenance and repeatable offline generation.
- Recognizable dimensional fleet in 3D, readable 2D symbols, working cell and vehicle inspection, useful map reset.
- Clear simulated-data and controller labels, complete selected-object details and accessible controls.
- Completed sourced pitch, deployment and MARL roadmap, final project review and updated operating instructions.
- Tests, production build, benchmark covering all five scenarios, browser checks at desktop and mobile sizes, then Git commit and push.

## Review focus

Vehicle conservation and finite storage; safe signals and emergency priority; stale/empty selections; scene clearance from roads and parks; same-clock comparisons; responsive overlay collisions; performance with the full-city scenario; offline loading; accurate claims and export metadata.
