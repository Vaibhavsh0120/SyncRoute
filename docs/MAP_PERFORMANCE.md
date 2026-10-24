# Map interaction optimization

24 October 2026. This pass preserves the local scene and paired traffic model while separating camera interaction from simulation work.

## Changes

- Camera gestures stay inside MapLibre. React receives the settled camera at `moveend`, avoiding a full dashboard render for every pan/zoom frame.
- Running engine steps and snapshot creation execute in a module Web Worker. One request can be in flight, with at most four deterministic ticks per batch. Generation and request IDs reject old reset/scenario responses. Whole pending ticks are retained, bounded by the scenario horizon.
- A stable motion ref supplies interpolation to each map's own animation loop. Interpolation no longer rerenders the dashboard every animation frame.
- Overview vehicles use compact dimensional geometry; full wheels, windows and fittings appear in settled close views from zoom 16.5. Camera movement uses lightweight point symbols and defers dimensional-mesh uploads until the gesture ends. Vehicle identity, location and simulation accounting are unchanged.
- Dynamic vehicle-source uploads are limited to 20 Hz when settled and 10 Hz while moving, including new snapshots. Pause, camera settling and detail changes flush the latest positions immediately.
- The main city no longer uploads the entire point fleet as well as dimensional polygons; its point source only serves the ambulance halo. The overview keeps its 2D symbols.
- Unchanged congestion categories and route geometry skip source replacement. Roof equipment appears from zoom 16.3; building footprints, parks and the flag remain visible in the overview.
- Rendering pixel ratio is capped at 1.5 to limit GPU fill cost on dense/high-DPI displays.
- Opaque facade textures replace the duplicate base/facade blend, the redundant transparent hex extrusion is disabled while the flat congestion overlay remains, and multisample antialiasing is disabled to reduce GPU fill cost.

The tradeoff is fewer tiny vehicle fittings during gestures and at distant zoom, in return for lower geometry and worker traffic. Close, settled views retain detailed models. These are visual changes, not changes to travel times or vehicle conservation.

## View control and landmark

The existing third navigation button now displays **2D** while tilted and **3D** while flat. The same button returns to the saved tilt/bearing, preserving the current location and zoom. Rapid clicks retarget the current transition; reduced-motion mode changes the camera without animation. Native zoom and compass drag behavior remain available.

Central Park again has a large Indian flag: an illustrative 63 m pole with a 24 × 16 m tricolor and navy 24-spoke Chakra. The landmark adds 57 static features, preserves all 3,911 earlier scenery features, and makes no animation or network requests. Regeneration preserves the building output byte-for-byte and is deterministic. Exact provenance and geometry checks are in `public/map/PROVENANCE.md`.

## Lifecycle and verification

Resets synchronously replace the static view, then initialize the worker. The export filename comes from the exported snapshot, so a pending scenario reset cannot mislabel a report. Worker startup/runtime failure stops playback and exposes a Reset recovery message. A pause dispatches no new batches; an already dispatched batch can settle by at most four ticks. Pending whole ticks resume without being dropped.

Unit tests cover worker/direct-engine equivalence, preceding interpolation snapshots, stale/duplicate responses, bounded batches, preserved tick budgets, detail selection, upload cadence, reversible view targets and compact fleet identity/size. Dev and production browser worker tests verify initialization, advancement and generation reset. Browser checks include the same-button 3D → 2D → 3D round trip, repeated/keyboard activation, reduced motion, flag visibility, reset/export behavior and mobile layout.

Performance measurements are local browser evidence, not a guarantee for every GPU. The large MapLibre bundle remains a loading concern. A first MCP browser sample was compositor-throttled to about 1 Hz and was rejected as a usable FPS baseline; comparison runs use a separate foreground headless Chrome process with background throttling disabled.

### Measured comparison

Same local Chrome 156, Intel UHD Graphics / D3D11, 1,440 × 1,000 viewport, DPR 1, ten-second repeated pan/zoom workload. Baseline is commit `8097400`; optimized is this pass. The optimized run includes the restored flag.

| Workload | Before FPS | After FPS | Before p95 frame | After p95 frame |
| --- | ---: | ---: | ---: | ---: |
| Paused traffic | 13.95 | 60.43 | 124 ms | 21 ms |
| Traffic at 20× | 10.34 | 38.53 | 131.7 ms | 41.7 ms |

During the running sample, long main-thread tasks fell from 26 (1,665 ms total) to zero. Both runs had no page errors and advanced approximately 200 simulated seconds during the ten-second 20× sample. The driver completed more gestures in the optimized run because input handling returned faster. This is one local GPU/browser comparison, not a universal FPS guarantee. Ignored evidence: `.playwright-mcp/pan-performance-first.json`, `pan-performance-final.json` and profiling scripts.
