"""Add reproducible illustrative visual detail to the bundled OSM scene.

Run `python scripts/enhance-scene.py` after fetch-map.py. Offline, stdlib only.
Colours, tree positions, roof equipment and inferred heights are visual
assumptions, not a survey of the actual buildings or vegetation.
"""
import json
import math
import random
import re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'public/map'
RNG = random.Random(231023)
ORIGIN = (77.21955, 28.6328)
SX, SY = 97600.0, 111320.0


def xy(p):
    return ((p[0] - ORIGIN[0]) * SX, (p[1] - ORIGIN[1]) * SY)


def lonlat(p):
    return [round(ORIGIN[0] + p[0] / SX, 7), round(ORIGIN[1] + p[1] / SY, 7)]


def inside(p, ring):
    x, y = p
    result = False
    for a, b in zip(ring, ring[1:]):
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            result = not result
    return result


def bounds(ring):
    return min(p[0] for p in ring), min(p[1] for p in ring), max(p[0] for p in ring), max(p[1] for p in ring)


def circle(p, radius, vertices=8, phase=0):
    ring = [(p[0] + radius * math.cos(phase + i * math.tau / vertices),
             p[1] + radius * math.sin(phase + i * math.tau / vertices)) for i in range(vertices)]
    return ring + [ring[0]]


def centroid(ring):
    cross = [a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:])]
    total = sum(cross)
    if abs(total) > .001:
        p = (sum((a[0] + b[0]) * c for a, b, c in zip(ring, ring[1:], cross)) / (3 * total),
             sum((a[1] + b[1]) * c for a, b, c in zip(ring, ring[1:], cross)) / (3 * total))
        if inside(p, ring):
            return p
    x0, y0, x1, y1 = bounds(ring)
    for i in range(1, 10):
        for j in range(1, 10):
            p = (x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * j / 10)
            if inside(p, ring):
                return p
    return None


buildings = json.loads((OUT / 'buildings.geojson').read_text(encoding='utf-8'))
parks = json.loads((OUT / 'parks.geojson').read_text(encoding='utf-8'))
roads = json.loads((OUT / 'roads.geojson').read_text(encoding='utf-8'))
tags = {w.attrib['id']: {t.attrib['k']: t.attrib['v'] for t in w.findall('tag')}
        for w in ET.parse(OUT / 'osm-raw.osm').getroot().findall('way')}
footprints = [list(map(xy, f['geometry']['coordinates'][0])) for f in buildings['features']]
index = defaultdict(list)
for n, ring in enumerate(footprints):
    x0, y0, x1, y1 = bounds(ring)
    for x in range(math.floor(x0 / 30), math.floor(x1 / 30) + 1):
        for y in range(math.floor(y0 / 30), math.floor(y1 / 30) + 1):
            index[(x, y)].append(n)


def in_building(p):
    return any(inside(p, footprints[n]) for n in index[(math.floor(p[0] / 30), math.floor(p[1] / 30))])


def segment_distance(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length2 = dx * dx + dy * dy
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2)) if length2 else 0
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def canopy_clear(p, radius):
    candidates = set()
    for x in range(math.floor((p[0] - radius) / 30), math.floor((p[0] + radius) / 30) + 1):
        for y in range(math.floor((p[1] - radius) / 30), math.floor((p[1] + radius) / 30) + 1):
            candidates.update(index[(x, y)])
    return all(not inside(p, footprints[n]) and
               all(segment_distance(p, a, b) > radius for a, b in zip(footprints[n], footprints[n][1:]))
               for n in candidates)


road_segments = []
road_index = defaultdict(list)
for road in roads['features']:
    if road['properties'].get('highway') not in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service'):
        continue
    points = list(map(xy, road['geometry']['coordinates']))
    for a, b in zip(points, points[1:]):
        n = len(road_segments)
        road_segments.append((a, b))
        x0, y0, x1, y1 = bounds([a, b])
        for x in range(math.floor((x0 - 8) / 30), math.floor((x1 + 8) / 30) + 1):
            for y in range(math.floor((y0 - 8) / 30), math.floor((y1 + 8) / 30) + 1):
                road_index[(x, y)].append(n)


def clear_street(p):
    return all(segment_distance(p, *road_segments[n]) > 7.2
               for n in road_index[(math.floor(p[0] / 30), math.floor(p[1] / 30))])


for feature, ring in zip(buildings['features'], footprints):
    props = feature['properties']
    osm = tags.get(str(props['osm_id']), {})
    match = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(?:m|metres|meters)?\s*', osm.get('height', ''))
    if match:
        props['height'] = round(max(4, min(70, float(match[1]))), 2)
    p = centroid(ring) or ring[0]
    h = props['height']
    # The low blocks around the two CP rings are given a warm heritage palette.
    d = math.hypot(*p)
    heritage = 105 < d < 465 and h < 20 and osm.get('building') not in ('apartments', 'residential')
    facade = 'heritage' if heritage else 'glass' if h >= 20 else 'residential' if osm.get('building') in ('apartments', 'residential', 'house') else 'stone'
    palettes = {'heritage': ['#e5d8bf', '#efe2c9'], 'stone': ['#c6b9a5'],
                'glass': ['#8faebc'], 'residential': ['#d5c4b0', '#cdbca9']}
    props.update(facade=facade, facadeColor=RNG.choice(palettes[facade]),
                 roofColor=RNG.choice(['#9b9c94', '#a6a69d', '#858d8e']),
                 floors=max(1, round(h / 3.2)))

features = []


def polygon(ring, kind, height, base, color):
    features.append({'type': 'Feature', 'properties': {'kind': kind, 'height': round(height, 2),
                     'base': round(base, 2), 'color': color},
                     'geometry': {'type': 'Polygon', 'coordinates': [[lonlat(p) for p in ring]]}})


tree_positions = []
tree_sources = []


def add_tree(p, source, park=None):
    scale = RNG.uniform(.84, 1.15)
    radius = 3.4 * scale
    phase = RNG.random() * math.tau
    crown = circle(p, radius, phase=phase)
    # Entire canopy stays clear of building footprints and inside its park.
    if not canopy_clear(p, radius):
        return False
    if source == 'street' and not clear_street(p):
        return False
    if park is not None and (not inside(p, park) or
                            any(segment_distance(p, a, b) <= radius for a, b in zip(park, park[1:]))):
        return False
    if any(math.dist(p, q) < 7.4 for q in tree_positions):
        return False
    trunk = 3 * scale
    lower = 7 * scale
    top = 9 * scale
    polygon(circle(p, .3 * scale, 6, phase), 'tree-trunk', trunk, 0, '#74533c')
    polygon(crown, 'tree-crown', lower, trunk, RNG.choice(['#386c45', '#508653', '#6b965b']))
    polygon(circle((p[0] + .25, p[1] - .2), 2.2 * scale, phase=phase + .3), 'tree-crown', top, lower - .4, RNG.choice(['#508653', '#6b965b', '#42794b']))
    tree_positions.append(p)
    tree_sources.append(source)
    return True


# Weighted park sampling with gentle density clusters; all accepted points lie
# within real OSM park boundaries, including Central Park and Palika Park.
park_rings = [list(map(xy, f['geometry']['coordinates'][0])) for f in parks['features']]
park_boxes = [bounds(ring) for ring in park_rings]
weights = [(x1 - x0) * (y1 - y0) for x0, y0, x1, y1 in park_boxes]
clusters = [[(RNG.uniform(b[0], b[2]), RNG.uniform(b[1], b[3])) for _ in range(6)] for b in park_boxes]
for attempt in range(40000):
    if len(tree_positions) >= 270:
        break
    n = RNG.choices(range(len(park_rings)), weights=weights)[0]
    x0, y0, x1, y1 = park_boxes[n]
    if RNG.random() < .65:
        anchor = RNG.choice(clusters[n])
        p = (RNG.gauss(anchor[0], 21), RNG.gauss(anchor[1], 21))
    else:
        p = (RNG.uniform(x0, x1), RNG.uniform(y0, y1))
    if -950 < p[0] < 600 and -850 < p[1] < 750:
        add_tree(p, 'park', park_rings[n])

# Sparse sidewalk greenery along mapped streets, offset from carriageways.
street_candidates = []
for road in roads['features']:
    props = road['properties']
    highway = props.get('highway')
    if highway not in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified'):
        continue
    points = list(map(xy, road['geometry']['coordinates']))
    offset = 12 if highway in ('primary', 'secondary') else 8
    for a, b in zip(points, points[1:]):
        length = math.dist(a, b)
        if length < 12:
            continue
        for j in range(max(1, int(length / 24))):
            t = (j + .5) / max(1, int(length / 24))
            for side in (-1, 1):
                p = (a[0] + (b[0] - a[0]) * t - (b[1] - a[1]) / length * offset * side,
                     a[1] + (b[1] - a[1]) * t + (b[0] - a[0]) / length * offset * side)
                if -825 < p[0] < 670 and -695 < p[1] < 685:
                    street_candidates.append(p)
RNG.shuffle(street_candidates)
for p in street_candidates:
    if len(tree_positions) >= 500:
        break
    add_tree(p, 'street')

# Modest roof detail on fifty central footprints. Equipment corners are tested
# against the actual polygon so tanks/HVAC cannot hang beyond the footprint.
roof_count = 0
for n in sorted(range(len(footprints)), key=lambda i: math.hypot(*(centroid(footprints[i]) or footprints[i][0]))):
    if roof_count >= 50:
        break
    ring = footprints[n]
    p = centroid(ring)
    if p is None:
        continue
    h = buildings['features'][n]['properties']['height']
    rect = [(p[0] + dx, p[1] + dy) for dx, dy in [(-1.5, -1), (1.5, -1), (1.5, 1), (-1.5, 1), (-1.5, -1)]]
    if not all(inside(q, ring) for q in rect):
        continue
    polygon(rect, 'roof-detail', h + 1.3, h, '#c3c6bf')
    tank = circle((p[0] + 4, p[1] + 2.8), 1.3)
    if all(inside(q, ring) for q in tank):
        polygon(tank, 'roof-detail', h + 2, h, '#626b6c')
    roof_count += 1

assert 250 <= len(tree_positions) <= 500, len(tree_positions)
assert all(not in_building(p) for p in tree_positions)
assert all(math.isfinite(value) for f in features for p in f['geometry']['coordinates'][0] for value in p)
assert all(f['properties']['height'] > f['properties']['base'] >= 0 for f in features)
(OUT / 'buildings.geojson').write_text(json.dumps(buildings, separators=(',', ':')), encoding='utf-8')
(OUT / 'scenery.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'trees': len(tree_positions), 'tree_locations': dict(Counter(tree_sources)),
                  'roof_buildings': roof_count, 'features': dict(Counter(f['properties']['kind'] for f in features)),
                  'facades': dict(Counter(f['properties']['facade'] for f in buildings['features'])),
                  'scenery_bytes': (OUT / 'scenery.geojson').stat().st_size}, indent=2))
