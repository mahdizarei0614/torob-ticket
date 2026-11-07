"""Deterministic admission/curation of the explicitly sourced OSM hotel POIs.

Run only after acquire-real-hotel-directory.py. --complete is an explicit final
freeze and fails unless all 34 actual catalog destinations are represented.
"""
import argparse
import hashlib
import json
import math
import re
import unicodedata
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUTPUT = ROOT / 'libs/fixtures/src/catalog/real-hotel-directory.json'
REVISION = 'hotel-directory-osm-2026-10-30'
PARENT_CITIES = {'tehran', 'mashhad', 'isfahan', 'shiraz'}
EXCLUDED = {
    ('node', '3676888125'): 'Former Union Square Inn is current extended-stay apartments with rental application and lease requirements; official operator does not establish ordinary one-night hotel inventory.',
    ('way', '265320185'): 'Former Ramada343West44th repurposed as multi-year Project Renewal shelter; NYC official community-board corroboration recorded.',
    ('node', '8512836517'): 'Descriptive Polish label does not establish a specific property identity.',
    ('node', '4640134371'): 'Teacher-house access/ordinary public hotel eligibility is not established.',
    ('way', '457504145'): 'Club guesthouse; ordinary public hotel eligibility not established.',
    ('node', '4640340599'): 'Teacher-house access/ordinary public hotel eligibility is not established.',
    ('node', '11181240422'): 'Generic word hotel is not a verifiable property name.',
    ('node', '4417542190'): 'Generic building label does not establish a hotel property name.',
    ('node', '4302905910'): 'Generic Local hotel label does not establish a property identity.',
    ('node', '4302906625'): 'Hostel-style iStay.inn identity not suitable for the authored hotel room inventory.',
    ('node', '4302906351'): 'Historical The Club identity needs current operator corroboration.',
    ('node', '5064277922'): 'Historical Travelodge Toronto East identity needs current operator corroboration.',
    ('way', '150506087'): 'Student residence; unrestricted hotel inventory not established.',
    ('way', '428017466'): 'Residential/SRO identity needs current public hotel corroboration.',
    ('node', '7161285151'): 'Airside transit-only property; eligibility is not part of this destination hotel flow.',
    ('node', '11626362759'): 'Airside transit-only Oryx Garden property; eligibility is outside the destination hotel flow.',
    ('node', '6313204370'): 'Airside transit-only property; official YOTEL guidance distinguishes it from landside.',
    ('node', '1733186698'): 'Golden Tulip Seeb closed in 2019; historical OSM hotel tag is stale (closure corroboration recorded).',
    ('node', '5030320423'): 'Duplicate Hezar Hotel property; retain richer primary OSM object 5016468221.',
    ('node', '5078153121'): '711 guesthouse lies 23m from Khansalar; possible alternate/hostel identity omitted conservatively.',
    ('node', '9798206209'): 'Park Hotel lies 49m from Crater; current independent identity not corroborated, omitted conservatively.',
}

def distance(a, b):
    lat_a, lat_b = map(math.radians, [a['latitude'], b['latitude']])
    dlat = lat_a - lat_b
    dlon = math.radians(a['longitude'] - b['longitude'])
    hav = math.sin(dlat / 2) ** 2 + math.cos(lat_a) * math.cos(lat_b) * math.sin(dlon / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(hav)))

def point_for(element, objects):
    if element['type'] == 'node':
        return {'latitude': element['lat'], 'longitude': element['lon']}, 'osm-node-exact'
    ways = [element] if element['type'] == 'way' else [
        objects[('way', str(m['ref']))] for m in element.get('members', [])
        if m['type'] == 'way' and m.get('role', '') in ('', 'outer')
        and ('way', str(m['ref'])) in objects]
    nodes = [objects[('node', str(n))] for way in ways for n in way['nodes']
             if ('node', str(n)) in objects]
    required = {str(n) for way in ways for n in way['nodes']}
    assert required and required <= {str(n['id']) for n in nodes}, 'Missing footprint geometry'
    return {
        'latitude': round((min(n['lat'] for n in nodes) + max(n['lat'] for n in nodes)) / 2, 7),
        'longitude': round((min(n['lon'] for n in nodes) + max(n['lon'] for n in nodes)) / 2, 7),
    }, f'osm-{element["type"]}-outer-bounds-center'

def address_for(tags):
    if tags.get('addr:full'):
        return tags['addr:full']
    if not tags.get('addr:street'):
        return None
    return ', '.join(v for v in [
        ' '.join(v for v in [tags.get('addr:housenumber'), tags.get('addr:street')] if v),
        tags.get('addr:suburb'), tags.get('addr:city'), tags.get('addr:postcode')
    ] if v)

def normalize(name):
    name = unicodedata.normalize('NFKC', name).casefold().replace('ي', 'ی').replace('ك', 'ک')
    return re.sub(r'[^\w]', '', name)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--complete', action='store_true')
    args = parser.parse_args()
    discovery = json.loads((HERE / 'discovery.json').read_text())
    payload = json.loads((HERE / 'osm-acquired.json').read_text())
    objects = {(e['type'], str(e['id'])): e for e in payload['elements']}
    catalog = json.loads((HERE / 'catalog.json').read_text())
    cities = {c['id']: c for c in catalog['cities']}
    official = {(c['osmType'], c['osmId']): c for c in json.loads((HERE / 'official-corroboration.json').read_text())}
    rows, exclusions, identities = [], [], set()
    candidates_by_id = {}
    for candidate in discovery['candidates']:
        key = (candidate['osmType'], str(candidate['osmId']))
        candidates_by_id.setdefault(key, []).append(candidate)
    for key, candidates in candidates_by_id.items():
        candidate = candidates[0]
        city = cities[candidate['cityId']]
        element = objects.get(key)
        reason = EXCLUDED.get(key)
        tags = element.get('tags', {}) if element else {}
        if not element:
            reason = reason or 'Primary object not acquired.'
        elif tags.get('tourism') != 'hotel':
            reason = reason or 'Primary object is not tagged tourism=hotel.'
        elif not tags.get('name') and not tags.get('name:en'):
            reason = reason or 'No sourced property name.'
        elif any(k.startswith(('disused:', 'abandoned:', 'demolished:', 'removed:', 'proposed:', 'construction:')) for k in tags) or tags.get('construction') or tags.get('access') in ('private', 'no'):
            reason = reason or 'Lifecycle/private access does not establish a current public hotel.'
        point, method = point_for(element, objects) if element else (None, None)
        city_distance = distance(point, city['point']) if point else None
        if point and city_distance > (35 if city['countryCode'] == 'IR' else 75):
            reason = reason or 'Wrong city or distant regional property outside curated destination scope.'
        if reason:
            exclusions.append({'cityId': candidate['cityId'], 'osmType': key[0], 'osmId': key[1], 'name': tags.get('name') or candidate['discoveryTitle'], 'reason': reason, 'cityDistanceKm': round(city_distance, 3) if city_distance is not None else None})
            continue
        corroboration = official.get(key, {})
        persian_name = tags.get('name:fa')
        if persian_name and not re.search(r'[\u0600-\u06ff]', persian_name):
            persian_name = None
        name = corroboration.get('name') or ((persian_name or tags.get('name')) if city['countryCode'] == 'IR' else tags.get('name:en')) or tags.get('name:en') or tags['name']
        if normalize(name) in {'hotel', 'հյուրանոց', 'هتل'}:
            exclusions.append({'cityId': candidate['cityId'], 'osmType': key[0], 'osmId': key[1], 'name': name, 'reason': 'Generic hotel label.'})
            continue
        stars_tag = tags.get('stars', '')
        stars = int(stars_tag) if re.fullmatch(r'[1-5]', stars_tag) else None
        source_tags = {k: v for k, v in tags.items() if k.startswith(('name', 'addr:', 'brand', 'source', 'contact:website')) or k in ('tourism', 'stars', 'website', 'wikidata', 'check_date')}
        url = f'https://www.openstreetmap.org/{key[0]}/{key[1]}'
        row = {
            'hotelId': f'{candidate["cityId"]}-osm-{key[0]}-{key[1]}',
            'destinationCityId': candidate['cityId'], 'name': name, 'point': point,
            'address': corroboration.get('address') or address_for(tags), 'stars': stars,
            'osmType': key[0], 'osmId': key[1], 'sourceUrl': url,
            'verifiedUrls': sorted(set([url] + [c['discoveryUrl'] for c in candidates] + corroboration.get('verifiedUrls', []))),
            'sourceTags': source_tags, 'osmVersion': element['version'],
            'osmTimestamp': element['timestamp'], 'coordinateMethod': method,
        }
        website = corroboration.get('website') or tags.get('website') or tags.get('contact:website')
        if website and website.startswith(('https://', 'http://')):
            row['website'] = website
        rows.append(row)
    # Explicit cap: rich city-centre coverage plus up to three genuine arrival-area
    # hotels. A few airport blocks contain more than one mapped property identity.
    selected = []
    cap_exclusions = []
    for city_id in cities:
        city_rows = [r for r in rows if r['destinationCityId'] == city_id]
        airport_points = [p['point'] for p in catalog['places'] if p['cityId'] == city_id and p['kind'] == 'airport']
        airports = [r for r in city_rows if airport_points and min(distance(r['point'], p) for p in airport_points) <= 5]
        others = [r for r in city_rows if r not in airports]
        airports.sort(key=lambda r: (min(distance(r['point'], p) for p in airport_points), r['hotelId']))
        chosen = airports[:3] + others[:max(0, 14 - min(3, len(airports)))]
        chosen += [r for r in airports[3:] if len(chosen) < 14]
        chosen = chosen[:14]
        selected.extend(chosen)
        cap_exclusions.extend({'cityId': city_id, 'hotelId': r['hotelId'], 'reason': 'Curated 14-property city cap / airport-area balance.'} for r in city_rows if r not in chosen)
    parent_file = HERE / 'root-iran.json'
    if parent_file.exists():
        parent = json.loads(parent_file.read_text())
        parent_rows = parent if isinstance(parent, list) else parent['hotels']
        assert all(r['destinationCityId'] in PARENT_CITIES for r in parent_rows)
        for original in parent_rows:
            row = dict(original)
            row['osmVersion'] = row.pop('sourceVersion')
            row['osmTimestamp'] = row.pop('sourceTimestamp')
            row['coordinateMethod'] = {'OSM hotel POI': 'osm-node-exact', 'OSM building polygon centroid': 'osm-way-polygon-centroid'}[row['coordinateMethod']]
            row['verifiedUrls'] = sorted(set([row['sourceUrl']] + row.get('verifiedUrls', [])))
            selected.append(row)
    selected.sort(key=lambda r: (list(cities).index(r['destinationCityId']), r['hotelId']))
    # Contract text fields trim their boundaries. Normalize only those display
    # boundaries here so the published property still equals its directory row;
    # retain original sourceTags verbatim for independent source comparison.
    for row in selected:
        row['name'] = row['name'].strip()
        if isinstance(row['address'], str):
            row['address'] = row['address'].strip() or None
    coverage = Counter(r['destinationCityId'] for r in selected)
    duplicate_pairs = []
    for index, row in enumerate(selected):
        for previous in selected[:index]:
            if row['destinationCityId'] == previous['destinationCityId'] and normalize(row['name']) == normalize(previous['name']) and distance(row['point'], previous['point']) < 0.5:
                duplicate_pairs.append([previous['hotelId'], row['hotelId']])
    assert len({r['hotelId'] for r in selected}) == len(selected), 'Duplicate hotelId'
    assert len({(r['osmType'], str(r['osmId'])) for r in selected}) == len(selected), 'Duplicate OSM identity'
    assert not duplicate_pairs, f'Duplicate-property names in close proximity: {duplicate_pairs}'
    assert all(distance(r['point'], cities[r['destinationCityId']]['point']) < 100 for r in selected), 'Wrong-city geometry'
    if args.complete:
        assert set(coverage) == set(cities), f'Missing cities: {set(cities) - set(coverage)}'
        assert all(n >= 3 for n in coverage.values()), 'Each destination needs several genuine hotels'
    directory = {'revision': REVISION, 'retrievedAt': '2026-10-30', 'license': 'ODbL-1.0', 'attribution': '© OpenStreetMap contributors', 'status': 'complete' if args.complete else 'draft', 'hotels': selected}
    OUTPUT.write_text(json.dumps(directory, ensure_ascii=False, indent=2) + '\n')
    report = {'revision': REVISION, 'status': directory['status'], 'hotelCount': len(selected), 'cityCount': len(coverage), 'cityCoverage': dict(coverage), 'missingCities': sorted(set(cities) - set(coverage)), 'excluded': exclusions, 'curatedCapExclusions': cap_exclusions, 'nearbyDuplicatePropertyPairs': duplicate_pairs, 'nullStars': sum(r['stars'] is None for r in selected), 'nullAddresses': sum(r['address'] is None for r in selected), 'directorySha256': hashlib.sha256(OUTPUT.read_bytes()).hexdigest()}
    (HERE / 'coverage-and-exclusions.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ('excluded', 'curatedCapExclusions')}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
