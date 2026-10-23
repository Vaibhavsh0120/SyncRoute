"""Reproducible local OSM backdrop + reduced illustrative simulation network.

Run from repository root. Existing raw XML is reused; delete it to refresh.
OSM data is ODbL, https://www.openstreetmap.org/copyright .
"""
import json
import math
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/map'
OUT.mkdir(exist_ok=True, parents=True)
URL = 'https://api.openstreetmap.org/api/0.6/map?bbox=77.208,28.625,77.225,28.639'
raw = OUT / 'osm-raw.osm'
if not raw.exists():
    urllib.request.urlretrieve(URL, raw)
root = ET.parse(raw).getroot()
coords = {n.attrib['id']: [float(n.attrib['lon']), float(n.attrib['lat'])] for n in root.findall('node')}
ways = {}
for w in root.findall('way'):
    tags = {t.attrib['k']: t.attrib['v'] for t in w.findall('tag')}
    points = [coords[n.attrib['ref']] for n in w.findall('nd') if n.attrib['ref'] in coords]
    ways[w.attrib['id']] = (tags, points)

def collection(features):
    return {'type': 'FeatureCollection', 'features': features}

features = {'roads': [], 'buildings': [], 'parks': []}
for id, (tags, points) in ways.items():
    if len(points) < 2:
        continue
    group = 'roads' if 'highway' in tags else 'buildings' if 'building' in tags else 'parks' if tags.get('leisure') in ['park', 'garden'] else None
    if not group or (group != 'roads' and (len(points) < 4 or points[0] != points[-1])):
        continue
    props = {'osm_id': id, 'name': tags.get('name', ''), 'highway': tags.get('highway', ''), 'height': max(4, min(70, float(tags.get('building:levels', '3').split(';')[0]) * 3.2)) if group == 'buildings' else 0}
    geometry = {'type': 'LineString', 'coordinates': points} if group == 'roads' else {'type': 'Polygon', 'coordinates': [points]}
    features[group].append({'type': 'Feature', 'properties': props, 'geometry': geometry})
for name, fs in features.items():
    (OUT / f'{name}.geojson').write_text(json.dumps(collection(fs), separators=(',', ':')), encoding='utf-8')

def dist(a, b):
    return math.hypot((a[0] - b[0]) * 97600, (a[1] - b[1]) * 111320)

# OSM Inner Circle is a clockwise ring. Select eight physical junctions.
inner = ways['23133486'][1][:-1]
inner_targets = [[77.2197696,28.6339283], [77.2203928,28.6337427], [77.2208092,28.6333557], [77.2207567,28.6321678], [77.2195809,28.6316347], [77.2185744,28.6322574], [77.2184253,28.6329495], [77.2186161,28.6334054]]
indices = [min(range(len(inner)), key=lambda j: dist(inner[j], p)) for p in inner_targets]
nodes = [{'id': f'inner-{i}', 'name': f'Inner Circle {i+1}', 'coordinate': inner[j]} for i, j in enumerate(indices)]

# Join every actual OSM Outer Circle segment into its clockwise sequence.
outer_parts = [p for t,p in ways.values() if t.get('name') == 'Outer Circle']
outer = outer_parts.pop(0).copy()
while outer_parts:
    candidate = next((i for i,p in enumerate(outer_parts) if p[0] == outer[-1]), None)
    if candidate is None:
        break
    outer += outer_parts.pop(candidate)[1:]
if outer[0] == outer[-1]:
    outer = outer[:-1]
outer_targets = [[77.2198833,28.6357191], [77.2224344,28.631252], [77.2194853,28.6298938], [77.2167421,28.6314291]]
oi = [min(range(len(outer)), key=lambda j: dist(outer[j], p)) for p in outer_targets]
names = ['State Entry junction', 'Barakhamba junction', 'Janpath junction', 'Baba Kharak Singh junction']
nodes += [{'id': f'outer-{i}', 'name': names[i], 'coordinate': outer[j]} for i,j in enumerate(oi)]
gates = [('state-entry', 'State Entry Road', [77.2199895,28.6379408]), ('barakhamba', 'Barakhamba Road', [77.2257948,28.6292208]), ('janpath', 'Janpath', [77.2193008,28.6271445]), ('baba-kharak', 'Baba Kharak Singh Marg', [77.2123345,28.6294567])]
nodes += [{'id': id, 'name': name, 'coordinate': p, 'gateway': True} for id,name,p in gates]
by_id = {n['id']: n for n in nodes}
edges = []

def edge(id, name, a, b, points, capacity=36, phase=None):
    points = [by_id[a]['coordinate']] + points + [by_id[b]['coordinate']]
    points = [p for i,p in enumerate(points) if i == 0 or p != points[i-1]]
    obj = {'id': id, 'name': name, 'from': a, 'to': b, 'coordinates': points, 'length': round(sum(dist(a,b) for a,b in zip(points, points[1:])), 2), 'freeFlowSpeed': 10 if 'inner' not in id else 8, 'capacity': capacity}
    if phase is not None:
        obj['signalPhase'] = phase
    edges.append(obj)

def ring_slice(ring, a, b):
    return ring[a:b+1] if b > a else ring[a:] + ring[:b+1]

for i in range(8):
    edge(f'inner-{i}', 'Inner Circle', f'inner-{i}', f'inner-{(i+1)%8}', ring_slice(inner, indices[i], indices[(i+1)%8]), 24)
for i in range(4):
    edge(f'outer-{i}', 'Outer Circle', f'outer-{i}', f'outer-{(i+1)%4}', ring_slice(outer, oi[i], oi[(i+1)%4]), 64, 0)

# Two-way radial links aggregate nearby paired one-way access lanes. They are
# explicit illustrative turn permissions, not a claim of current legal routing.
radials = [(0, ['24577486'], 0), (3, ['24577482', '1375201075'], 1), (4, ['24577480'], 2), (5, ['24577488'], 3)]
for inner_id, ids, i in radials:
    points = sum([ways[id][1] for id in ids], [])
    a, b = by_id[f'inner-{inner_id}']['coordinate'], by_id[f'outer-{i}']['coordinate']
    if dist(points[-1], a) < dist(points[0], a):
        points.reverse()
    edge(f'radial-out-{i}', f'Radial access {i+1}', f'inner-{inner_id}', f'outer-{i}', points, 24, 1)
    edge(f'radial-in-{i}', f'Radial access {i+1}', f'outer-{i}', f'inner-{inner_id}', list(reversed(points)), 24)

spokes = [ways['688548344'][1] + ways['688548345'][1], list(reversed(ways['80499778'][1])), list(reversed(ways['563679821'][1])), ways['24583332'][1]]
for i, (id, name, _) in enumerate(gates):
    # Retain only between the chosen boundary and junction to avoid backtracking.
    a,b=by_id[f'outer-{i}']['coordinate'],by_id[id]['coordinate']
    points=[p for p in spokes[i] if dist(a,p) <= dist(a,b) + 12]
    if points and dist(points[-1],a)<dist(points[0],a):
        points.reverse()
    edge(f'gateway-out-{i}', name, f'outer-{i}', id, points, 40)
    edge(f'gateway-in-{i}', name, id, f'outer-{i}', list(reversed(points)), 40, 1)

signals = [{'id': f'signal-{i}', 'nodeId': f'outer-{i}', 'name': names[i], 'phases': [[f'outer-{(i-1)%4}'], [f'radial-out-{i}', f'gateway-in-{i}']]} for i in range(4)]
network = {'nodes': nodes, 'edges': edges, 'signals': signals, 'center': [77.21965,28.6327], 'bounds': [[77.2117,28.6266],[77.2264,28.6384]], 'incidentEdgeId': 'radial-out-0', 'gateways': [g[0] for g in gates]}
ts = "import type { Coordinate, RoadEdge, RoadNetwork } from '../domain/types'\n\n/** Physical OSM polylines; reduced links and signal control are illustrative. */\nexport const NETWORK: RoadNetwork = " + json.dumps(network, indent=2) + "\n\n"
ts += '''export function coordinateAt(edge: RoadEdge, position: number): Coordinate {
  const distance = Math.max(0, Math.min(edge.length, position))
  const lengths = edge.coordinates.slice(1).map((b, i) => {
    const a = edge.coordinates[i]
    return Math.hypot((b[0] - a[0]) * 97600, (b[1] - a[1]) * 111320)
  })
  const actualLength = lengths.reduce((sum, n) => sum + n, 0)
  let remaining = distance / edge.length * actualLength
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const t = lengths[i] ? remaining / lengths[i] : 0
      const a = edge.coordinates[i], b = edge.coordinates[i + 1]
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    }
    remaining -= lengths[i]
  }
  return edge.coordinates[edge.coordinates.length - 1]
}

export const networkGeometry = {
  type: 'FeatureCollection' as const,
  features: NETWORK.edges.map(edge => ({ type: 'Feature' as const, properties: { id: edge.id, name: edge.name }, geometry: { type: 'LineString' as const, coordinates: edge.coordinates } })),
}
'''
(ROOT / 'src/data/network.ts').write_text(ts, encoding='utf-8')
print(json.dumps({'features': {k:len(v) for k,v in features.items()}, 'nodes':len(nodes), 'edges':len(edges), 'outer_points':len(outer), 'unjoined_outer_parts':len(outer_parts)}))
