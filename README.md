# SyncRoute

Preventive traffic management for a simulated Connaught Place, New Delhi. Explore one large angled 3D city and a simultaneous 2D overview. Switch between **Normal mode** (fixed signals and routes) and **Optimized mode** (adaptive signals, preventive routing and ambulance priority). Both worlds receive the same demand, events and simulation time.

## Open in your browser

Requires Node.js 22.12+ (Node 24 recommended).

```powershell
cd D:\_Root\Downloads\SyncRoute
npm install
npm run dev
```

Open the local URL printed by Vite, normally **http://localhost:5173**. Keep the terminal open. Click **Start traffic** to move the vehicles. Use the corner strategy button to switch worlds and **Fullscreen** for an immersive city view. Escape exits the expanded view.

For the production build:

```powershell
npm run build
npm run preview
```

Open the preview URL printed by Vite, normally http://localhost:4173. Do not open `dist/index.html` directly as a file. After installation, the app runs without internet, API keys, Google Maps, a backend or a database. Fonts, geometry, textures and the MapLibre worker are local assets. A local HTTP server must remain running.

## Two-minute demonstration

1. Select **Peak corridor rush**, seed **42**, and start at **10×** or **20×**.
2. Show the 3D city and 2D overview together. Cars follow simulated road paths and signals. The miniature map represents the same selected world.
3. Explain **green** (free flow), **yellow** (emerging congestion, act early), and **red** (established congestion). Select a hexagon to inspect vehicle counts, speed and its transparent 30-second trend projection.
4. Use the corner switch to compare Normal and Optimized. Both continue in the background on the same clock; switching does not replay different traffic.
5. Show the decision log: which signals change, which drivers reroute, and why. Select **Road incident** for a north-radial bottleneck during minutes 3–7, or **Emergency response** for an ambulance entering at minute 3.
6. Read total waiting, completed/requested trips and unfinished vehicles together. Export JSON and reset the same seed to reproduce the run.

Scenario and seed changes reset both worlds and pause playback. Route endpoint changes preview routes without changing benchmark demand. Each run has 10 minutes of arrivals plus 10 minutes of drainage. Any unfinished vehicles at the cutoff remain in the metrics. Balanced traffic is a demand preset; Normal mode is the fixed control strategy.

## Verification

```powershell
npm test
npm run lint
npm run build
npm run benchmark
```

The benchmark runs all five scenarios (full city, balanced, rush, incident and ambulance) at seed 42, checking per-tick conservation and road storage, and writes `artifacts/benchmark.json`. Waiting reductions are simulator outcomes, not predictions about real Delhi traffic. Negative results are retained; zero-denominator percentage comparisons are unavailable.

## Simulation model

- One logical lane per directed road; no overtaking or lane changes. Minimum spacing 7.5m, normal discharge headway 2s, finite storage and upstream spillback.
- One-second engine ticks independent of playback speed. H3 statistics use current engine snapshots; vehicles interpolate between snapshots.
- Normal signals use seeded 20–40s green durations with seeded starting phases and offsets. Both strategies use 2s amber and 1s all-red. Adaptive greens have a 10s minimum and a 40s cap with competing feasible demand.
- Yellow forecasts use recent simulated occupancy trends, not a trained prediction model. Yellow cells propagate preventive pressure and route costs to active roads before established congestion.
- The same immutable demand manifest and incidents feed both worlds. Fifty percent of cars are preassigned routing adoption. Diversions occur only at junctions, with a cooldown and minimum estimated savings.
- Vehicle counts remain conserved: vehicles waiting outside + vehicles on roads + completed vehicles equals requested arrivals. No blocked arrival disappears.
- Completed-trip averages report their completion count; unfinished trips and boundary waiting remain visible. Amber/red stop-arrival ticks retain their measured displacement speed.
- Ambulances cannot overtake a queue inside the single-lane model; priority safely releases vehicles ahead and then resumes ordinary signal service.

Detailed rules and thresholds: [simulation model](src/simulation/README.md).

## Geography and visual assets

Real OpenStreetMap geometry supplies an operational graph of **419 nodes, 888 directed links, 28 controllers and 38 gateways**. More physical signal heads represent approaches to those same controllers. Directions, turn groups, lane counts, signals, demand and timing are illustrative assumptions, not current Delhi traffic guidance. No connection to public infrastructure exists.

Building footprints come from OSM. Facade textures, palettes, roof equipment and tree placement are illustrative visual detail. The local scene recovers multipolygon buildings and height-tagged building parts, preserves courtyard holes, and adds facade palettes, roof equipment, park paths, trees and street furniture. Cars, motorbikes, compact buses and ambulances have dimensional bodies, windows, wheels and lights in 3D, with 2D sprites in the overview. Bus proportions fit the common 7.5m storage slot. See [map provenance](public/map/PROVENANCE.md).

Regenerate map and scenery assets from the saved XML without internet:

```powershell
python scripts/fetch-map.py
python scripts/generate-network.py
python scripts/enhance-scene.py
```

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), under ODbL. The dashboard uses the [Cobalt design system](https://better-design.com/design-systems/cobalt), locally bundled Geist fonts and Carbon Icons. Generated catalog components are preserved under `src/components/ui`; application lint excludes those vendored sources.

## Current controller and next stage

The running adaptive controller uses explicit pressure, storage and preventive routing rules. The 30-second projection uses recent occupancy trends. **No trained reinforcement-learning model is running.** H3 groups spatial observations; it does not provide vehicle communications.

Read the completed, sourced [pitch](docs/PITCH.md), [MARL and real-world pilot roadmap](docs/REAL_WORLD_ROADMAP.md), and [final review](docs/PROJECT_REVIEW.md). The proposed next stage is cooperative multi-agent reinforcement learning with one agent per junction, centralised offline training, local execution and an independent signal safety filter.

The inspector supports vehicles, traffic cells and signals, including empty cells and vehicles that have completed their trips. Use **Reset view** to restore the city camera. Weather, active restriction and ambulance state are visible in Traffic Pattern. **How the controller works** explains the current model and proposed next stage.
