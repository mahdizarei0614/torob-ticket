"""Verify the frozen directory against retained primary hotel geometry."""
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DIRECTORY = ROOT / 'libs/fixtures/src/catalog/real-hotel-directory.json'
objects = {(e['type'], str(e['id'])): e for e in json.loads((HERE / 'osm-acquired.json').read_text())['elements']}
iran = {(e['type'], str(e['id'])): e for e in json.loads((HERE / 'root-iran-primary-evidence.json').read_text())['elements']}
rows = json.loads(DIRECTORY.read_text())['hotels']
errors = []

def centroid(geometry):
    # Translate before shoelace sums: raw geographic products subtract nearly
    # equal values and cause metres of cancellation error for small footprints.
    x0, y0 = geometry[0]['lon'], geometry[0]['lat']
    points = [(p['lon'] - x0, p['lat'] - y0) for p in geometry]
    pairs = list(zip(points, points[1:]))
    twice_area = math.fsum(a[0] * b[1] - b[0] * a[1] for a, b in pairs)
    x = math.fsum((a[0] + b[0]) * (a[0] * b[1] - b[0] * a[1]) for a, b in pairs) / (3 * twice_area)
    y = math.fsum((a[1] + b[1]) * (a[0] * b[1] - b[0] * a[1]) for a, b in pairs) / (3 * twice_area)
    return {'latitude': round(y + y0, 7), 'longitude': round(x + x0, 7)}

for row in rows:
    key = (row['osmType'], str(row['osmId']))
    element = objects.get(key) or iran.get(key)
    if not element:
        errors.append([row['hotelId'], 'missing primary object'])
        continue
    if element['version'] != row['osmVersion'] or element['timestamp'] != row['osmTimestamp']:
        errors.append([row['hotelId'], 'source version mismatch'])
    if element.get('tags', {}).get('tourism') != 'hotel':
        errors.append([row['hotelId'], 'primary object is not tourism=hotel'])
    method = row['coordinateMethod']
    if method == 'osm-node-exact':
        point = {'latitude': element['lat'], 'longitude': element['lon']}
    elif method == 'osm-way-polygon-centroid':
        point = centroid(element['geometry'])
    else:
        ways = [element] if element['type'] == 'way' else [
            objects[('way', str(member['ref']))] for member in element['members']
            if member['type'] == 'way' and member.get('role', '') in ('', 'outer')]
        nodes = [objects[('node', str(n))] for way in ways for n in way['nodes']]
        point = {
            'latitude': round((min(n['lat'] for n in nodes) + max(n['lat'] for n in nodes)) / 2, 7),
            'longitude': round((min(n['lon'] for n in nodes) + max(n['lon'] for n in nodes)) / 2, 7),
        }
    if point != row['point']:
        errors.append([row['hotelId'], 'point mismatch', point, row['point']])

report = {
    'directorySha256': hashlib.sha256(DIRECTORY.read_bytes()).hexdigest(),
    'checked': len(rows), 'coordinateMethods': dict(Counter(r['coordinateMethod'] for r in rows)),
    'errors': errors, 'status': 'pass' if not errors else 'fail',
}
(HERE / 'author-coordinate-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
assert not errors
