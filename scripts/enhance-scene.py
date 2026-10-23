"""Recover OSM architecture and add deterministic local city detail.

Run ``python scripts/enhance-scene.py`` after fetch-map.py. Offline, stdlib only.
Footprints and courtyards come from saved OSM XML; colours, missing heights,
vegetation, furnishings and roof equipment are illustrative visual assumptions.
Outputs rebuild from raw input, so repeated runs are identical.
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
CELL = 30


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


def in_polygon(p, rings):
    return inside(p, rings[0]) and not any(inside(p, ring) for ring in rings[1:])


def bounds(ring):
    return min(p[0] for p in ring), min(p[1] for p in ring), max(p[0] for p in ring), max(p[1] for p in ring)


def cells(box, pad=0):
    x0, y0, x1, y1 = box
    for x in range(math.floor((x0 - pad) / CELL), math.floor((x1 + pad) / CELL) + 1):
        for y in range(math.floor((y0 - pad) / CELL), math.floor((y1 + pad) / CELL) + 1):
            yield x, y


def circle(p, radius, vertices=8, phase=0):
    ring = [(p[0] + radius * math.cos(phase + i * math.tau / vertices),
             p[1] + radius * math.sin(phase + i * math.tau / vertices)) for i in range(vertices)]
    return ring + [ring[0]]


def rectangle(p, width, depth, angle=0):
    c, s = math.cos(angle), math.sin(angle)
    return [(p[0] + x * c - y * s, p[1] + x * s + y * c)
            for x, y in [(-width / 2, -depth / 2), (width / 2, -depth / 2),
                         (width / 2, depth / 2), (-width / 2, depth / 2), (-width / 2, -depth / 2)]]


def centroid(ring):
    cross = [a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:])]
    total = sum(cross)
    if abs(total) > .001:
        p = (sum((a[0] + b[0]) * c for a, b, c in zip(ring, ring[1:], cross)) / (3 * total),
             sum((a[1] + b[1]) * c for a, b, c in zip(ring, ring[1:], cross)) / (3 * total))
        if inside(p, ring):
            return p
    return None


def polygon_anchor(rings):
    p = centroid(rings[0])
    if p and in_polygon(p, rings):
        return p
    x0, y0, x1, y1 = bounds(rings[0])
    # Courtyard-building centroids frequently lie inside their holes.
    for i in range(1, 20):
        for j in range(1, 20):
            p = (x0 + (x1 - x0) * i / 20, y0 + (y1 - y0) * j / 20)
            if in_polygon(p, rings):
                return p
    return None


def segment_distance(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length2 = dx * dx + dy * dy
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2)) if length2 else 0
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def contained(ring, polygon, margin=0):
    # Samples prevent equipment / paths spanning narrow concavities or holes.
    for a, b in zip(ring, ring[1:]):
        steps = max(1, math.ceil(math.dist(a, b)))
        for i in range(steps + 1):
            p = (a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps)
            if not in_polygon(p, polygon):
                return False
            if margin and any(segment_distance(p, u, v) < margin
                              for boundary in polygon for u, v in zip(boundary, boundary[1:])):
                return False
    return not any(inside(hole[0], ring) for hole in polygon[1:])


raw = ET.parse(OUT / 'osm-raw.osm').getroot()
nodes = {n.attrib['id']: [float(n.attrib['lon']), float(n.attrib['lat'])] for n in raw.findall('node')}
ways = {w.attrib['id']: w for w in raw.findall('way')}
tags = {id: {t.attrib['k']: t.attrib['v'] for t in w.findall('tag')} for id, w in ways.items()}
parks = json.loads((OUT / 'parks.geojson').read_text(encoding='utf-8'))
roads = json.loads((OUT / 'roads.geojson').read_text(encoding='utf-8'))


def number(value):
    match = re.fullmatch(r'\s*(-?\d+(?:\.\d+)?)\s*(?:m|metres|meters)?\s*', value.split(';')[0])
    return float(match[1]) if match else None


def height(osm):
    explicit = number(osm.get('height', ''))
    levels = number(osm.get('building:levels', ''))
    return round(max(4, min(70, explicit if explicit is not None else (levels if levels is not None else 3) * 3.2)), 2)


def underground(osm):
    return (osm.get('location') == 'underground' or
            (number(osm.get('level', '0')) or 0) < 0 or
            (number(osm.get('layer', '0')) or 0) < 0 or
            (number(osm.get('building:levels', '')) == 0 and
             (number(osm.get('building:levels:underground', '0')) or 0) > 0))


def way_nodes(id):
    return [n.attrib['ref'] for n in ways[id].findall('nd')]


def join_rings(ids):
    if any(id not in ways for id in ids):
        return None
    pending = [way_nodes(id) for id in ids]
    rings = []
    while pending:
        ring = pending.pop(0)
        while ring and ring[0] != ring[-1]:
            found = False
            for i, part in enumerate(pending):
                if ring[-1] == part[0]:
                    ring += part[1:]
                elif ring[-1] == part[-1]:
                    ring += list(reversed(part))[1:]
                elif ring[0] == part[-1]:
                    ring = part[:-1] + ring
                elif ring[0] == part[0]:
                    ring = list(reversed(part))[:-1] + ring
                else:
                    continue
                pending.pop(i)
                found = True
                break
            if not found:
                return None
        if len(ring) < 4 or any(n not in nodes for n in ring):
            return None
        rings.append([nodes[n] for n in ring])
    return rings


buildings = {'type': 'FeatureCollection', 'features': []}
building_tags = []
relation_members = set()
recovered_relations = []
skipped_relations = []


def building(id, osm, rings, source, osm_type='way'):
    h = height(osm)
    base = number(osm.get('min_height', ''))
    if base is None:
        min_level = number(osm.get('building:min_level', osm.get('min_level', '')))
        base = max(0, min_level or 0) * 3.2
    base = round(max(0, min(h - .4, base)), 2)
    props = {'osm_id': id, 'osm_type': osm_type, 'name': osm.get('name', ''), 'highway': '',
             'height': h, 'base': base, 'source': source}
    buildings['features'].append({'type': 'Feature', 'properties': props,
                                  'geometry': {'type': 'Polygon', 'coordinates': rings}})
    building_tags.append(osm)


# Relations contain large CP commercial blocks omitted by the closed-way pass.
# Keep open courtyards and assemble outer shells even when split over ways.
for relation in raw.findall('relation'):
    osm = {t.attrib['k']: t.attrib['v'] for t in relation.findall('tag')}
    if osm.get('type') != 'multipolygon' or osm.get('building') in (None, 'no') or underground(osm):
        continue
    members = [m for m in relation.findall('member') if m.attrib['type'] == 'way']
    outer_ids = [m.attrib['ref'] for m in members if m.attrib.get('role', '') in ('', 'outer')]
    inner_ids = [m.attrib['ref'] for m in members if m.attrib.get('role') == 'inner']
    outer, inner = join_rings(outer_ids), join_rings(inner_ids)
    if not outer or inner is None:
        skipped_relations.append(relation.attrib['id'])
        continue
    relation_members.update(outer_ids + inner_ids)
    for i, shell in enumerate(outer):
        holes = [hole for hole in inner if inside(xy(hole[0]), list(map(xy, shell)))]
        building(relation.attrib['id'] + (f'-{i}' if len(outer) > 1 else ''), osm,
                 [shell] + holes, 'osm-relation', 'relation')
    recovered_relations.append(relation.attrib['id'])

for id, osm in tags.items():
    if id in relation_members or osm.get('building') in (None, 'no') or underground(osm):
        continue
    rings = join_rings([id])
    if rings:
        building(id, osm, rings, 'osm-way')

# Above-ground parts with height evidence restore stepped tower volumes.
# Unknown-height parts are omitted to avoid coincident duplicate roofs.
for id, osm in tags.items():
    if 'building' in osm or osm.get('building:part') in (None, 'no'):
        continue
    if number(osm.get('height', '')) is None and number(osm.get('building:levels', '')) is None:
        continue
    if underground(osm):
        continue
    rings = join_rings([id])
    if rings:
        building(id, osm, rings, 'osm-building-part')

footprints = [[list(map(xy, ring)) for ring in f['geometry']['coordinates']] for f in buildings['features']]
index = defaultdict(list)
for n, rings in enumerate(footprints):
    for cell in cells(bounds(rings[0])):
        index[cell].append(n)


def in_building(p):
    return any(in_polygon(p, footprints[n]) for n in index[(math.floor(p[0] / CELL), math.floor(p[1] / CELL))])


def canopy_clear(p, radius):
    candidates = set(n for cell in cells((p[0], p[1], p[0], p[1]), radius) for n in index[cell])
    return all(not in_polygon(p, footprints[n]) and
               all(segment_distance(p, a, b) > radius
                   for ring in footprints[n] for a, b in zip(ring, ring[1:])) for n in candidates)


road_segments = []
road_index = defaultdict(list)
road_width = {'primary': 9, 'primary_link': 5, 'secondary': 7.5, 'secondary_link': 5,
              'tertiary': 6, 'tertiary_link': 4.5, 'residential': 4, 'unclassified': 4,
              'service': 3.2, 'living_street': 3, 'pedestrian': 2.5, 'footway': 1.1,
              'path': 1, 'cycleway': 1.3, 'steps': 1.2}
for road in roads['features']:
    osm = tags.get(str(road['properties']['osm_id']), {})
    if (number(osm.get('layer', '0')) or 0) < 0 or osm.get('tunnel') == 'yes':
        continue
    width = road_width.get(road['properties'].get('highway'), 2)
    points = list(map(xy, road['geometry']['coordinates']))
    for a, b in zip(points, points[1:]):
        n = len(road_segments)
        road_segments.append((a, b, width))
        for cell in cells(bounds([a, b]), width + 6):
            road_index[cell].append(n)


def clear_street(p, radius=0):
    return all(segment_distance(p, *road_segments[n][:2]) > road_segments[n][2] + radius
               for n in road_index[(math.floor(p[0] / CELL), math.floor(p[1] / CELL))])


for feature, rings, osm in zip(buildings['features'], footprints, building_tags):
    props = feature['properties']
    p = polygon_anchor(rings) or rings[0][0]
    h = props['height']
    heritage = 105 < math.hypot(*p) < 465 and h < 20 and osm.get('building') not in ('apartments', 'residential')
    facade = ('heritage' if heritage else 'glass' if h >= 22 else 'residential'
              if osm.get('building') in ('apartments', 'residential', 'house') else 'stone')
    palettes = {'heritage': ['#e5d8bf', '#efe2c9', '#e6d9c3', '#dccdb5'],
                'stone': ['#c6b9a5', '#c5c3b7', '#cdbfa9', '#bdb4a9'],
                'glass': ['#8faebc', '#9db5bf', '#91a8b5', '#aabac2'],
                'residential': ['#d5c4b0', '#cdbca9', '#d9cfbe', '#c4b5a4']}
    props.update(facade=facade, facadeColor=RNG.choice(palettes[facade]),
                 roofColor=RNG.choice(['#a4a69d', '#b2b0a4', '#929e9f', '#a7aaa4', '#b7b4aa']),
                 floors=max(1, round(h / 3.2)))

features = []
detail_checks = []


def polygon(ring, kind, height, base, color, source='illustrative', holes=None):
    features.append({'type': 'Feature', 'properties': {'kind': kind, 'height': round(height, 2),
                     'base': round(base, 2), 'color': color, 'source': source},
                     'geometry': {'type': 'Polygon', 'coordinates': [[lonlat(p) for p in ring]] +
                                  [[lonlat(p) for p in hole] for hole in (holes or [])]}})


park_rings = [[list(map(xy, ring)) for ring in f['geometry']['coordinates']] for f in parks['features']]
park_boxes = [bounds(rings[0]) for rings in park_rings]
path_areas = []
park_path_count = 0

# Mapped footways become short surface strips wholly inside park boundaries.
for road in roads['features']:
    if road['properties'].get('highway') not in ('footway', 'path', 'pedestrian'):
        continue
    osm = tags.get(str(road['properties']['osm_id']), {})
    if (number(osm.get('layer', '0')) or 0) < 0 or osm.get('tunnel') == 'yes':
        continue
    points = list(map(xy, road['geometry']['coordinates']))
    for a, b in zip(points, points[1:]):
        length = math.dist(a, b)
        steps = max(1, math.ceil(length / 4))
        angle = math.atan2(b[1] - a[1], b[0] - a[0])
        for i in range(steps):
            p = (a[0] + (b[0] - a[0]) * (i + .5) / steps,
                 a[1] + (b[1] - a[1]) * (i + .5) / steps)
            ring = rectangle(p, length / steps + .05, 1.7, angle)
            for park in park_rings:
                if in_polygon(p, park) and contained(ring, park):
                    polygon(ring, 'park-path', .13, .02, '#d6cbb2', 'osm-footway')
                    path_areas.append(ring)
                    detail_checks.append((ring, park))
                    park_path_count += 1
                    break

# Small illustrative seating courts stay within the actual park boundaries.
park_seats = []
for n, park in enumerate(park_rings):
    p = polygon_anchor(park)
    if p is None:
        continue
    radius = 8 if n == 0 else 4.2
    court = circle(p, radius, 16)
    if not contained(court, park, .5) or in_building(p):
        continue
    polygon(court, 'park-path', .18, .03, '#d8cdb7')
    path_areas.append(court)
    detail_checks.append((court, park))
    for angle in (0, math.pi / 2, math.pi, math.pi * 1.5):
        q = (p[0] + (radius - 1.3) * math.cos(angle), p[1] + (radius - 1.3) * math.sin(angle))
        seat = rectangle(q, 2, .55, angle + math.pi / 2)
        if contained(seat, park):
            park_seats.append((q, angle + math.pi / 2, park))

tree_positions = []
tree_sources = []


def add_tree(p, source, park=None):
    scale = RNG.uniform(.78, 1.18)
    radius = 3.4 * scale
    phase = RNG.random() * math.tau
    crown = circle(p, radius, phase=phase)
    if not canopy_clear(p, radius) or not clear_street(p, radius + .25):
        return False
    if park is not None and not contained(crown, park, .15):
        return False
    if any(inside(p, ring) or any(segment_distance(p, a, b) < radius + .4 for a, b in zip(ring, ring[1:]))
           for ring in path_areas):
        return False
    if any(math.dist(p, q) < 7.2 for q in tree_positions):
        return False
    trunk, lower, top = 3 * scale, 7 * scale, 9 * scale
    polygon(circle(p, .3 * scale, 6, phase), 'tree-trunk', trunk, 0, '#74533c')
    polygon(crown, 'tree-crown', lower, trunk, RNG.choice(['#386c45', '#508653', '#6b965b', '#487850']))
    polygon(circle((p[0] + .25, p[1] - .2), 2.2 * scale, phase=phase + .3),
            'tree-crown', top, lower - .4, RNG.choice(['#508653', '#6b965b', '#42794b']))
    tree_positions.append(p)
    tree_sources.append(source)
    return True


weights = [(x1 - x0) * (y1 - y0) for x0, y0, x1, y1 in park_boxes]
clusters = [[(RNG.uniform(b[0], b[2]), RNG.uniform(b[1], b[3])) for _ in range(6)] for b in park_boxes]
for attempt in range(30000):
    if len(tree_positions) >= 320:
        break
    n = RNG.choices(range(len(park_rings)), weights=weights)[0]
    x0, y0, x1, y1 = park_boxes[n]
    if RNG.random() < .65:
        anchor = RNG.choice(clusters[n])
        p = (RNG.gauss(anchor[0], 21), RNG.gauss(anchor[1], 21))
    else:
        p = (RNG.uniform(x0, x1), RNG.uniform(y0, y1))
    if -950 < p[0] < 650 and -850 < p[1] < 750:
        add_tree(p, 'park', park_rings[n])

# Sidewalk trees and unobtrusive lamp columns follow mapped carriageways.
street_candidates = []
lamp_candidates = []
for road in roads['features']:
    highway = road['properties'].get('highway')
    if highway not in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified'):
        continue
    points = list(map(xy, road['geometry']['coordinates']))
    offset = road_width[highway] + 4.4
    for a, b in zip(points, points[1:]):
        length = math.dist(a, b)
        if length < 12:
            continue
        steps = max(1, int(length / 25))
        for j in range(steps):
            t = (j + .5) / steps
            for side in (-1, 1):
                p = (a[0] + (b[0] - a[0]) * t - (b[1] - a[1]) / length * offset * side,
                     a[1] + (b[1] - a[1]) * t + (b[0] - a[0]) / length * offset * side)
                if -825 < p[0] < 670 and -695 < p[1] < 685:
                    street_candidates.append(p)
                    if j % 2 == 0:
                        lamp_candidates.append(p)
RNG.shuffle(street_candidates)
for p in street_candidates:
    if len(tree_positions) >= 560:
        break
    add_tree(p, 'street')

lamp_positions = []
for p in lamp_candidates:
    if len(lamp_positions) >= 100:
        break
    if not canopy_clear(p, .7) or not clear_street(p, .7):
        continue
    if any(math.dist(p, q) < 8 for q in tree_positions) or any(math.dist(p, q) < 22 for q in lamp_positions):
        continue
    polygon(circle(p, .35, 6), 'street-furniture', .4, 0, '#89918a')
    polygon(circle(p, .12, 6), 'street-furniture', 5.3, .3, '#626f70')
    polygon(circle(p, .4, 6), 'street-furniture', 5.6, 5.25, '#e3d9ba')
    lamp_positions.append(p)

for p, angle, park in park_seats:
    seat = rectangle(p, 2, .55, angle)
    polygon(seat, 'street-furniture', .55, .2, '#98785d')
    back = rectangle((p[0] - .2 * math.sin(angle), p[1] + .2 * math.cos(angle)), 2, .12, angle)
    polygon(back, 'street-furniture', .98, .53, '#b28e67')
    detail_checks.extend([(seat, park), (back, park)])

# Relation courtyards remain open and gain restrained illustrative paving.
courtyard_count = 0
for rings in footprints:
    for hole in rings[1:]:
        p = centroid(hole)
        if p and math.hypot(*p) < 1000 and not in_building(p):
            polygon(hole, 'courtyard-plaza', .08, .01, '#c9c6b8')
            courtyard_count += 1

# Roof details are tested against walls AND courtyard holes.
roof_count = 0
roof_detail_count = 0
order = sorted(range(len(footprints)), key=lambda i: math.hypot(*(polygon_anchor(footprints[i]) or footprints[i][0][0])))
for n in order:
    if roof_count >= 190:
        break
    rings = footprints[n]
    p = polygon_anchor(rings)
    if p is None:
        continue
    h = buildings['features'][n]['properties']['height']
    x0, y0, x1, y1 = bounds(rings[0])
    roof_parts = [(rectangle(p, 3.5, 2.4), h + 1.25, h + .3, '#cbd0c7'),
                  (circle((p[0] + 4.2, p[1] + 2.8), 1.15), h + 2.2, h + .3, '#687778')]
    if (x1 - x0) * (y1 - y0) > 400:
        roof_parts += [(rectangle((p[0] - 4, p[1] + j * 2.1), 4.8, 1.5), h + .85, h + .4, '#547480') for j in (-1, 0, 1)]
    added = False
    for ring, top, base, color in roof_parts:
        if contained(ring, rings, .25):
            polygon(ring, 'roof-detail', top, base, color)
            detail_checks.append((ring, rings))
            roof_detail_count += 1
            added = True
    # Short inset parapets define roof edges without dense meshes.
    for a, b in sorted(zip(rings[0], rings[0][1:]), key=lambda edge: -math.dist(*edge))[:2]:
        length = math.dist(a, b)
        if length < 8:
            continue
        angle = math.atan2(b[1] - a[1], b[0] - a[0])
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        for sign in (-1, 1):
            q = (mid[0] - math.sin(angle) * .65 * sign, mid[1] + math.cos(angle) * .65 * sign)
            ring = rectangle(q, min(30, length - 3), .35, angle)
            if contained(ring, rings, .1):
                polygon(ring, 'roof-detail', h + .9, h + .3, '#c2c3b8')
                detail_checks.append((ring, rings))
                roof_detail_count += 1
                added = True
                break
    if added:
        roof_count += 1

assert 250 <= len(tree_positions) <= 560, len(tree_positions)
assert all(not in_building(p) and clear_street(p) for p in tree_positions)
assert all(contained(ring, polygon) for ring, polygon in detail_checks)
assert all(math.isfinite(value) for f in features for ring in f['geometry']['coordinates'] for p in ring for value in p)
assert all(f['properties']['height'] > f['properties']['base'] >= 0 for f in features)
assert all(f['properties']['height'] > f['properties']['base'] >= 0 for f in buildings['features'])
assert all(len(ring) >= 4 and ring[0] == ring[-1] for f in buildings['features'] for ring in f['geometry']['coordinates'])

(OUT / 'buildings.geojson').write_text(json.dumps(buildings, separators=(',', ':')), encoding='utf-8')
(OUT / 'scenery.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'buildings': len(buildings['features']),
                  'building_sources': dict(Counter(f['properties']['source'] for f in buildings['features'])),
                  'recovered_relations': len(recovered_relations), 'incomplete_relations_skipped': skipped_relations,
                  'building_courtyard_holes': sum(len(p) - 1 for p in footprints),
                  'trees': len(tree_positions), 'tree_locations': dict(Counter(tree_sources)),
                  'park_path_strips': park_path_count, 'street_lamps': len(lamp_positions),
                  'park_benches': len(park_seats), 'courtyard_plazas': courtyard_count,
                  'roof_buildings': roof_count, 'roof_details': roof_detail_count,
                  'contained_detail_checks': len(detail_checks),
                  'features': dict(Counter(f['properties']['kind'] for f in features)),
                  'facades': dict(Counter(f['properties']['facade'] for f in buildings['features'])),
                  'buildings_bytes': (OUT / 'buildings.geojson').stat().st_size,
                  'scenery_bytes': (OUT / 'scenery.geojson').stat().st_size}, indent=2))
