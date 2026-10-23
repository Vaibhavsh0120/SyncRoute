# Connaught Place local map assets

Source: OpenStreetMap contributors, licensed under the Open Database License
(ODbL), https://www.openstreetmap.org/copyright .

Downloaded 2026-10-23 using the read-only OSM map API:
https://api.openstreetmap.org/api/0.6/map?bbox=77.208,28.625,77.225,28.639

`osm-raw.osm` is the unmodified XML response (6,821,933 bytes). The API includes
complete ways that intersect this bounding box, so some way coordinates extend
beyond the box. `roads.geojson`, `buildings.geojson`, and `parks.geojson` are
derived locally by `scripts/fetch-map.py`. They contain 1,199 highway ways, 697
closed building footprints, and 11 park/garden ways respectively. Building
heights use OSM building:levels times 3.2 m when available; missing levels use
an illustrative three-storey height. Heights are capped at 70 m for legibility.

The initial Overpass POST request to overpass-api.de returned HTTP 406; GET
requests to overpass.kumi.systems and overpass.private.coffee timed out. The
official OSM map API succeeded. The Overpass query remains in
`scripts/overpass-query.txt` for auditability.

The simulation network in `src/data/network.ts` deliberately reduces this
geography to 16 nodes and 28 directed links. The two rings follow actual OSM
clockwise polylines. The Middle Circle remains visible as map context but is
omitted from simulated traffic. Four gateway corridors represent Janpath,
Barakhamba Road, Baba Kharak Singh Marg, and State Entry Road. Physical radial
access polylines are retained, with short tapers into the reduced junctions.
Opposite radial and gateway links aggregate nearby paired access lanes and
allow illustrative two-way movement. They are not current legal turn guidance.

Four two-phase signal controllers, lane capacities, free-flow speeds, turn
permissions, incident location, vehicle arrivals, and timings are illustrative
model inputs, not measurements or representations of current Delhi operations.
Signal phase 0 serves incoming clockwise Outer Circle traffic; phase 1 serves
the aggregated gateway and radial access movement. Phase compatibility is an
abstract junction model rather than a physical engineering signal plan. The
incident capacity restriction is on the north radial exit, approaching the
State Entry junction.

The application reads only the bundled GeoJSON. It uses locally drawn car
sprites and DOM road/landmark labels; no remote map tiles, fonts, glyph servers,
API keys, or geolocation are required. The full H3 resolution-10 study-area
grid is generated locally; empty cells remain outlined with transparent fill.

## Illustrative city detail

Run `python scripts/enhance-scene.py` after `scripts/fetch-map.py` to regenerate
the offline visual detail. It uses Python's standard library and a fixed random
seed. Building footprints remain the OSM polygons. A parseable OSM `height`
in metres takes precedence over the levels-derived height, with the same 4-70 m
visual bounds. All other heights retain the fetched levels/default assumption.
`floors` is a rendering estimate derived from height, rather than a new survey.

Building facade classes and colours are illustrative: low central blocks use
warm cream heritage colours, taller buildings use muted blue-grey glass, and
other buildings use stone and residential neutrals. Roofs use concrete greys.
These colours and classifications do not assert the real appearance, materials,
heritage status, or use of individual properties.

`scenery.geojson` contains deterministic decorative trees and small rooftop
equipment. Park trees are placed within actual OSM park polygons, including
Rajiv Chowk Central Park and Palika Park; the full canopy is checked against
park boundaries and building footprints. Additional trees are offset alongside
mapped streets and checked against nearby street centerlines and footprints.
Their positions, species, dimensions and density are visual assumptions, not
an inventory of real vegetation. Layered green octagonal crowns and brown
trunks make these lightweight, locally rendered 3D symbols. Rooftop rectangles
and tanks are illustrative equipment on fifty central buildings, with all
equipment vertices checked inside the respective footprint. No remote assets
or additional map service are used.

## Expanded operational road scope

`python scripts/generate-network.py` rebuilds `src/data/network.ts` offline
from the original OSM XML. This supersedes the initial reduced 16-node network
described above. The operational extent is longitude 77.211-77.2265 and
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
