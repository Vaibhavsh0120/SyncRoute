"""Build the operational CP network from bundled OSM, offline and deterministically.

All connected public drivable ways in the study rectangle are considered.
Geometry is clipped at the rectangle and nonbranching degree-two nodes are
contracted without replacing curved road polylines by straight chords.
"""
import json
import math
import xml.etree.ElementTree as ET
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BBOX = (77.211, 28.6265, 77.2265, 28.639)
ALLOWED = {'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service'}
GATES = [('janpath', 'Janpath', (77.2193008, 28.6271445)),
         ('state-entry', 'State Entry Road', (77.2199895, 28.6379408)),
         ('barakhamba', 'Barakhamba Road', (77.2257948, 28.6292208)),
         ('baba-kharak', 'Baba Kharak Singh Marg', (77.2123345, 28.6294567))]


def distance(a, b):
    return math.hypot((a[0] - b[0]) * 97600, (a[1] - b[1]) * 111320)


def clip(a, b):
    lo, hi = 0., 1.
    dx, dy = b[0] - a[0], b[1] - a[1]
    for p, q in [(-dx, a[0] - BBOX[0]), (dx, BBOX[2] - a[0]),
                 (-dy, a[1] - BBOX[1]), (dy, BBOX[3] - a[1])]:
        if p == 0:
            if q < 0:
                return None
        elif p < 0:
            lo = max(lo, q / p)
        else:
            hi = min(hi, q / p)
        if lo > hi:
            return None
    return lo, hi


raw = ET.parse(ROOT / 'public/map/osm-raw.osm').getroot()
coordinates = {n.attrib['id']: [float(n.attrib['lon']), float(n.attrib['lat'])] for n in raw.findall('node')}
edges = {}
source_way_count = 0
for way in raw.findall('way'):
    tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
    highway = tags.get('highway', '')
    if not (highway in ALLOWED or highway in {f'{h}_link' for h in ALLOWED}):
        continue
    if any(tags.get(k) in ('private', 'no') for k in ('access', 'vehicle', 'motor_vehicle')) or tags.get('service') == 'parking_aisle':
        continue
    refs = [n.attrib['ref'] for n in way.findall('nd') if n.attrib['ref'] in coordinates]
    oneway = tags.get('oneway', 'yes' if tags.get('junction') == 'roundabout' else 'no')
    count = 0
    for i, (a_id, b_id) in enumerate(zip(refs, refs[1:])):
        a, b = coordinates[a_id], coordinates[b_id]
        clipped = clip(a, b)
        if clipped is None:
            continue
        lo, hi = clipped
        if lo >= hi:
            continue
        ids = []
        for t, original, suffix in [(lo, a_id, 'a'), (hi, b_id, 'b')]:
            if (suffix == 'a' and t == 0) or (suffix == 'b' and t == 1):
                ids.append(original)
            else:
                node = f'boundary-{way.attrib["id"]}-{i}-{suffix}'
                coordinates[node] = [round(a[j] + (b[j] - a[j]) * t, 9) for j in range(2)]
                ids.append(node)
        if distance(coordinates[ids[0]], coordinates[ids[1]]) < .2:
            continue
        for reverse in ([False] if oneway in ('yes', '1', 'true') else [True] if oneway == '-1' else [False, True]):
            start, end = ids[::-1] if reverse else ids
            edge_id = f'osm-{way.attrib["id"]}-{i}-{"r" if reverse else "f"}'
            edges[edge_id] = {'from': start, 'to': end,
                             'coordinates': [coordinates[start], coordinates[end]],
                             'name': tags.get('name', highway.replace('_', ' ').title()),
                             'freeFlowSpeed': 12 if highway.startswith('primary') or highway.startswith('secondary') else 8 if highway in ('service', 'living_street') or tags.get('name') == 'Inner Circle' else 10,
                             '_ways': {way.attrib['id']}}
            count += 1
    source_way_count += count > 0


def adjacency(es):
    outgoing, incoming = defaultdict(set), defaultdict(set)
    for key, e in es.items():
        outgoing[e['from']].add(key)
        incoming[e['to']].add(key)
    return outgoing, incoming


outgoing, incoming = adjacency(edges)
all_nodes = set(outgoing) | set(incoming)
visited, order = set(), []
for start in sorted(all_nodes):
    if start in visited:
        continue
    stack = [(start, False)]
    while stack:
        n, done = stack.pop()
        if done:
            order.append(n)
            continue
        if n in visited:
            continue
        visited.add(n)
        stack.append((n, True))
        stack.extend((edges[e]['to'], False) for e in sorted(outgoing[n], reverse=True) if edges[e]['to'] not in visited)
components, visited = [], set()
for start in reversed(order):
    if start in visited:
        continue
    component, stack = set(), [start]
    while stack:
        n = stack.pop()
        if n in visited:
            continue
        visited.add(n)
        component.add(n)
        stack.extend(edges[e]['from'] for e in incoming[n] if edges[e]['from'] not in visited)
    components.append(component)
retained = max(components, key=len)
before_scc = len(edges)
edges = {k: e for k, e in edges.items() if e['from'] in retained and e['to'] in retained}
after_scc = len(edges)
outgoing, incoming = adjacency(edges)
gate_ids = {}
for gate, name, target in GATES:
    closest = min(retained - set(gate_ids), key=lambda n: (distance(coordinates[n], target), n))
    gate_ids[closest] = (gate, name)

# Boundary nodes remain addressable as additional origins/destinations.
protected = set(gate_ids) | {n for n in retained if n.startswith('boundary-')}
queue = deque(sorted(retained))
merge_id = 0
while queue:
    n = queue.popleft()
    if n in protected or not incoming[n] or not outgoing[n]:
        continue
    ins, outs = [edges[k] for k in sorted(incoming[n])], [edges[k] for k in sorted(outgoing[n])]
    neighbours = {e['from'] for e in ins} | {e['to'] for e in outs}
    if len(neighbours) != 2 or any(e['from'] == n for e in ins) or any(e['to'] == n for e in outs):
        continue
    pairs = []
    if len(ins) == len(outs) == 1 and ins[0]['from'] != outs[0]['to']:
        pairs = [(ins[0], outs[0])]
    elif len(ins) == len(outs) == 2 and {e['from'] for e in ins} == {e['to'] for e in outs}:
        pairs = [(a, b) for a in ins for b in outs if a['from'] != b['to']]
        if len(pairs) != 2:
            continue
    else:
        continue
    for key in list(incoming[n] | outgoing[n]):
        e = edges.pop(key)
        outgoing[e['from']].discard(key)
        incoming[e['to']].discard(key)
    for a, b in pairs:
        key = f'merged-{merge_id}'
        merge_id += 1
        e = {'from': a['from'], 'to': b['to'], 'coordinates': a['coordinates'] + b['coordinates'][1:],
             'name': a['name'] if a['name'] == b['name'] else f'{a["name"]} / {b["name"]}',
             'freeFlowSpeed': min(a['freeFlowSpeed'], b['freeFlowSpeed']), '_ways': a['_ways'] | b['_ways']}
        edges[key] = e
        outgoing[e['from']].add(key)
        incoming[e['to']].add(key)
    queue.extend(sorted(neighbours))

node_ids = {e[k] for e in edges.values() for k in ('from', 'to')}
names = {n: gate_ids[n][0] if n in gate_ids else f'junction-{n}' for n in node_ids}
network_edges = []
retained_ways = set()
for i, (_, edge) in enumerate(sorted(edges.items(), key=lambda item: (item[1]['from'], item[1]['to'], item[0]))):
    retained_ways.update(edge['_ways'])
    length = sum(distance(a, b) for a, b in zip(edge['coordinates'], edge['coordinates'][1:]))
    network_edges.append({'id': f'road-{i:03}', 'name': edge['name'], 'from': names[edge['from']],
                          'to': names[edge['to']], 'coordinates': edge['coordinates'],
                          'length': round(length, 2), 'freeFlowSpeed': edge['freeFlowSpeed'],
                          'capacity': max(1, math.floor(length / 7.5))})
incoming_edges = defaultdict(list)
outgoing_edges = defaultdict(list)
for edge in network_edges:
    incoming_edges[edge['to']].append(edge)
    outgoing_edges[edge['from']].append(edge)

# Signal controllers represent a spaced selection of substantial intersections.
# All other junctions remain fully routable with ordinary simulated yielding.
signal_candidates = []
for n in sorted(node_ids):
    approaches = incoming_edges[names[n]]
    departures = outgoing_edges[names[n]]
    neighbours = {e['from'] for e in approaches} | {e['to'] for e in departures}
    if len(approaches) >= 2 and len(neighbours) >= 3:
        signal_candidates.append(n)


def signal_rank(n):
    approaches = incoming_edges[names[n]]
    roads = approaches + outgoing_edges[names[n]]
    major = sum(e['freeFlowSpeed'] >= 12 for e in roads)
    named = sum(e['name'] not in ('Service', 'Residential', 'Living Street', 'Unclassified') for e in roads)
    neighbours = {e['from'] for e in approaches} | {e['to'] for e in outgoing_edges[names[n]]}
    return (-major, -len(neighbours), -named, -len(approaches), n)


selected = []
canonical_intersections = [(77.2198833, 28.6357191), (77.2224344, 28.631252),
                           (77.2194853, 28.6298938), (77.2167421, 28.6314291)]
for target in canonical_intersections:
    n = min(signal_candidates, key=lambda n: (distance(coordinates[n], target), signal_rank(n)))
    if n not in selected and all(distance(coordinates[n], coordinates[other]) >= 150 for other in selected):
        selected.append(n)
midpoint = ((BBOX[0] + BBOX[2]) / 2, (BBOX[1] + BBOX[3]) / 2)


def quadrant(n):
    return (coordinates[n][0] >= midpoint[0], coordinates[n][1] >= midpoint[1])


ranked = sorted(signal_candidates, key=signal_rank)
for q in [(False, False), (False, True), (True, False), (True, True)]:
    for n in ranked:
        if sum(quadrant(other) == q for other in selected) >= 3:
            break
        if quadrant(n) == q and n not in selected and all(distance(coordinates[n], coordinates[other]) >= 160 for other in selected):
            selected.append(n)
for n in ranked:
    if len(selected) >= 28:
        break
    if n not in selected and all(distance(coordinates[n], coordinates[other]) >= 160 for other in selected):
        selected.append(n)
assert 24 <= len(selected) <= 32, len(selected)
signals = []
for n in sorted(selected):
    approaches = incoming_edges[names[n]]
    if len(approaches) < 2:
        continue
    phases = [[], []]
    for edge in approaches:
        a, b = edge['coordinates'][-2:]
        phase = 0 if abs((b[1] - a[1]) * 111320) >= abs((b[0] - a[0]) * 97600) else 1
        phases[phase].append(edge['id'])
    if not phases[0] or not phases[1]:
        # Two skew/curved approaches can share an axis; split deterministically
        # so each gets service in this abstract two-phase junction model.
        approaches = sorted(approaches, key=lambda e: e['id'])
        phases = [[e['id'] for e in approaches[::2]], [e['id'] for e in approaches[1::2]]]
    for phase, group in enumerate(phases):
        for edge in approaches:
            if edge['id'] in group:
                edge['signalPhase'] = phase
    signal_name = gate_ids[n][1] if n in gate_ids else ' / '.join(dict.fromkeys(e['name'] for e in approaches))
    signals.append({'id': f'signal-{len(signals):03}', 'nodeId': names[n], 'name': signal_name, 'phases': phases})

nodes = [{'id': names[n], 'name': gate_ids[n][1] if n in gate_ids else f'Junction {n}',
          'coordinate': coordinates[n], **({'gateway': True} if n in protected else {})} for n in sorted(node_ids)]
signal_nodes = {s['nodeId'] for s in signals}
incident_candidates = [e for e in network_edges if e['to'] in signal_nodes and 'State Entry' in e['name']]
if not incident_candidates:
    incident_candidates = [e for e in network_edges if e['to'] in signal_nodes]
incident = min(incident_candidates, key=lambda e: distance(e['coordinates'][-1], (77.21988, 28.63572)))
network = {'nodes': nodes, 'edges': network_edges, 'signals': signals,
           'center': [77.21965, 28.6327], 'bounds': [[BBOX[0], BBOX[1]], [BBOX[2], BBOX[3]]],
           'incidentEdgeId': incident['id'], 'gateways': [g[0] for g in GATES] + [names[n] for n in sorted(protected - set(gate_ids))]}

# Validate actual exported references, connectedness, phase coverage and geometry.
by_id = {n['id']: n for n in nodes}
for edge in network_edges:
    assert edge['coordinates'][0] == by_id[edge['from']]['coordinate']
    assert edge['coordinates'][-1] == by_id[edge['to']]['coordinate']
    assert edge['length'] > 0 and edge['capacity'] > 0
    assert all(math.isfinite(v) for p in edge['coordinates'] for v in p)
for signal in signals:
    assert all(signal['phases'])
    assert set(sum(signal['phases'], [])) == {e['id'] for e in incoming_edges[signal['nodeId']]}
for reverse in (False, True):
    reached, pending = set(), [nodes[0]['id']]
    adjacency_nodes = defaultdict(list)
    for e in network_edges:
        adjacency_nodes[e['to'] if reverse else e['from']].append(e['from'] if reverse else e['to'])
    while pending:
        n = pending.pop()
        if n not in reached:
            reached.add(n)
            pending.extend(adjacency_nodes[n])
    assert reached == set(by_id), 'Export must remain strongly connected'

existing = (ROOT / 'src/data/network.ts').read_text(encoding='utf-8')
helpers = existing[existing.index('export function coordinateAt'):]
text = "import type { Coordinate, RoadEdge, RoadNetwork } from '../domain/types'\n\n/** Complete connected public drivable OSM scope; simulated controls are illustrative. */\nexport const NETWORK: RoadNetwork = "
(ROOT / 'src/data/network.ts').write_text(text + json.dumps(network, indent=2) + '\n\n' + helpers, encoding='utf-8')
print(json.dumps({'candidateWays': source_way_count, 'retainedWays': len(retained_ways),
                  'excludedDisconnectedOrOneWayDeadEndSegmentDirections': before_scc - after_scc,
                  'nodes': len(nodes), 'edges': len(network_edges), 'signals': len(signals),
                  'signalQuadrants': {str(q): sum(quadrant(n) == q for n in selected) for q in [(False, False), (False, True), (True, False), (True, True)]},
                  'gateways': len(network['gateways']), 'incident': incident['id']}, indent=2))
