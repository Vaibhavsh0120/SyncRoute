# Connaught Place local map assets

Source: OpenStreetMap contributors, licensed under the Open Database License
(ODbL), https://www.openstreetmap.org/copyright .

Downloaded 2026-10-23 using the read-only OSM map API:
https://api.openstreetmap.org/api/0.6/map?bbox=77.208,28.625,77.225,28.639

`osm-raw.osm` is the unmodified XML response (6,821,933 bytes). The API includes
complete ways that intersect this bounding box, so some way coordinates extend
beyond the box. `roads.geojson`, `buildings.geojson`, and `parks.geojson` are
derived locally by `scripts/fetch-map.py`. Its initial extraction contains
1,199 highway ways, 697 closed building footprints, and 11 park/garden ways.
The architecture recovery below expands the building output to 785 volumes.
Building heights use OSM building:levels times 3.2 m when available; missing
levels use an illustrative three-storey height. Heights are capped at 70 m
for legibility.

The initial Overpass POST request to overpass-api.de returned HTTP 406; GET
requests to overpass.kumi.systems and overpass.private.coffee timed out. The
official OSM map API succeeded. The Overpass query remains in
`scripts/overpass-query.txt` for auditability.

The simulation network in `src/data/network.ts` contains 419 nodes and 888
directed links generated from the saved OSM road topology, including the Inner,
Middle and Outer Circles and connected surrounding streets. Four named gateway
corridors represent Janpath, Barakhamba Road, Baba Kharak Singh Marg, and State
Entry Road; 34 additional boundary nodes are gateways. The complete generation
method and exclusions are described under Expanded operational road scope.

Twenty-eight two-phase controllers, lane capacities, free-flow speeds, phase
compatibility, incident location, vehicle arrivals and timings are illustrative
model inputs, not measurements or representations of current Delhi operations.
Phases group incoming approaches by bearing and operate an abstract junction
model. The generated incident restricts the State Entry approach nearest its
central junction. This is a local simulation, not legal traffic guidance or a
physical engineering signal plan.

The map reads only the bundled GeoJSON. It uses locally drawn vehicle symbols
and DOM road/landmark labels; no remote map tiles, fonts, glyph servers,
API keys, or geolocation are required. The full H3 resolution-10 study-area
grid is generated locally; empty cells remain outlined with transparent fill.

## Illustrative city detail

Run `python scripts/enhance-scene.py` after `scripts/fetch-map.py` to regenerate
the offline architecture and visual detail. It uses Python's standard library,
the saved XML, and a fixed random seed. It rebuilds both generated files from
raw input on every run, so repeated runs have identical output. No network
request, new data download, 3D model package or paid map service is involved.

The original extractor only handled closed building ways. The enhancement now
assembles complete OSM building multipolygon relations, joins split outer ways,
and retains their inner courtyard rings. This restores 28 building polygons
from 25 relations, including A-Block, Statesman House, the YMCA Tourist Hotel,
and several other commercial blocks omitted from the original backdrop. The
saved response lacks inner members for relations 5243436 and 5247754; these two
relations are skipped rather than drawing their courtyards as solid buildings.
Sixty-two additional above-ground `building:part` ways with a parseable height
or level count restore stepped towers and rooflines. Parts tagged below ground,
and parts without height evidence, are omitted. Two original closed-way
underground train-station footprints are also excluded from the surface scene,
including Rajiv Chowk's station outline beneath Central Park. This leaves 695
surface building ways. The resulting 785 volumes retain 36 courtyard holes. Their
footprints are mapped OSM geometry; no invented building infill is added.

A parseable OSM `height` in metres takes precedence over the levels-derived
height, with the same 4-70 m visual bounds. `min_height`, `building:min_level`,
and `min_level` provide a rendering base where present, bounded below the roof.
Other heights retain the levels/default assumption. `floors` is a rendering
estimate derived from height, rather than a new survey. `source` and `osm_type`
distinguish closed ways, recovered relations and mapped building parts.

Building facade classes and colours are illustrative: low central blocks use
varied warm cream heritage colours, taller buildings use muted blue-grey glass,
and other buildings use stone and residential neutrals. Roofs use concrete greys.
These colours and classifications do not assert the real appearance, materials,
heritage status, or use of individual properties.

`scenery.geojson` contains 3,911 lightweight polygon features (about 1.29 MB):

- 560 trees: 320 within actual OSM parks and 240 alongside mapped streets.
  Their 560 trunks and 1,120 layered crowns use varied sizes and green tones.
  Canopies are checked against building shells, courtyard holes, park edges,
  mapped footways, and carriageway buffers; trees are spaced at least 7.2 m
  apart. These are decorative symbols, not an inventory of actual vegetation.
- 941 park-path surfaces: 930 short strips follow saved above-ground OSM
  footways and pedestrian paths inside real park polygons; eleven small seating
  courts are illustrative. The strips' 1.7 m width is a visual assumption.
  Their boundaries and edges are checked inside their respective parks.
- 100 illustrative street lamps and 44 two-piece park benches, producing 388
  `street-furniture` polygons. Lamp locations are offset from road centerlines
  and checked against building footprints and nearby trees. Bench locations
  stay inside the actual park boundaries.
- 31 illustrative paved courtyards follow recovered OSM inner rings; the
  corresponding building polygons keep those courtyards open.
- 871 illustrative roof details across 190 central building volumes: tanks,
  small utility housings, solar-bank symbols and short inset parapets. Their
  boundaries are sampled at intervals no greater than 1 m against the full
  building polygon, including courtyard holes. Heights and equipment choices
  do not assert the real installation on any property.

All scenic features carry `source`: `osm-footway` means a surface follows a
mapped path alignment; `illustrative` describes assumed scenery. Even a mapped
alignment's displayed width, material, colour and elevation are illustrative.
Carriageway exclusion buffers are visual estimates by road class (3-9 m from
centerline for ordinary motor roads), not surveyed widths. Underground/tunnel
paths do not create surface scenery. The generator asserts closed building
rings, finite scenery coordinates, positive extrusion ranges, tree clearance,
and 1,900 park/roof containment checks before writing either output.

## Expanded operational road scope

`python scripts/generate-network.py` rebuilds `src/data/network.ts` offline
from the original OSM XML. This supersedes the original fetch script's reduced
16-node network. The operational extent is longitude 77.211-77.2265 and
latitude 28.6265-28.639. It considers every mapped primary, secondary,
tertiary, residential, unclassified, living-street and service way, together
with their link-road variants. Ways marked `access`, `vehicle`, or
`motor_vehicle` as `private` or `no`, and service parking aisles, are excluded;
pedestrian ways, paths, steps and footways remain visual backdrop only.
Missing access restrictions are treated as public for this model.

Ways are clipped at the study rectangle. OSM shared-node topology defines
junctions; a visual crossing without a shared OSM node does not create a turn.
Explicit OSM `oneway=yes/1/true` and `oneway=-1` are retained, and roundabouts
default to one way unless tagged otherwise. The largest strongly connected
drivable component is retained so every operational origin can reach every
other destination. Disconnected components and one-way dead ends at the study
boundary are therefore excluded from simulated routing. Nonbranching degree-two
nodes are contracted while preserving all intermediate OSM polyline points.
No service or residential roads are dropped merely to hit a node-count target.

The generated network has 419 nodes and 888 directed links, retaining 301 of
352 candidate drivable OSM ways. The four canonical named gateways are snapped
to their nearest retained OSM nodes; 34 additional boundary nodes are gateways.
Twenty-eight substantial intersections receive illustrative two-phase
controllers. Candidates must have at least two incoming links and three distinct
neighbouring junctions. Four original Outer Circle junction areas are seeded,
then arterial approaches, named roads and branch count determine priority.
Controllers are spaced at least 150 m apart, with a 160 m spacing target and
at least three in each study-area quadrant. Remaining junctions retain all
road links and ordinary simulated yielding. Incoming approaches are grouped by
north-south versus east-west bearing; where all are on the same axis, they are
split deterministically between the two service phases. These are simulation
controls, not claims about real signal locations, installation, phase plans,
turn permissions, legal traffic guidance or measured timings.

Link lengths come from their retained polylines. Free-flow speeds of 8, 10 or
12 m/s are illustrative, and each link's vehicle storage is its length divided
by 7.5 m, rounded down with a minimum of one vehicle. These parameters are
model assumptions rather than observed Delhi traffic capacity. The generated
incident link is the State Entry approach nearest its central junction.
Regenerate in this order when rebuilding all data: `fetch-map.py`,
`enhance-scene.py`, then `generate-network.py`; the first script still emits
the original reduced network before the final script replaces it.
