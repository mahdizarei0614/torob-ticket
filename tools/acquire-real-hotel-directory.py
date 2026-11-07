#!/usr/bin/env python3
"""Re-fetch only the explicitly curated public OSM objects. Never scans an area.

Python uses system curl for the platform's trusted TLS certificate store. Original
responses are retained as evidence. This script does not create rates or claim
current availability. The hand-reviewed discovery list is the input boundary.
"""
import argparse
import hashlib
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / 'tools/hotel-directory'
UA = 'TorobTicketLocalHotelDirectory/1.0 offline-data-curation'

def acquire(url, path, refresh=False):
    if path.exists() and not refresh:
        return json.loads(path.read_text())
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.part')
    subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time',
                    '25', '--retry', '1', '--retry-delay', '1', '--user-agent',
                    UA, url, '--output', str(temporary)], check=True)
    payload = json.loads(temporary.read_text())
    temporary.replace(path)
    time.sleep(0.5)
    return payload

def batches(values, size=100):
    values = sorted(set(values), key=int)
    for offset in range(0, len(values), size):
        yield values[offset:offset + size]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    candidates = json.loads((RESEARCH / 'discovery.json').read_text())['candidates']
    root_fragment = RESEARCH / 'root-iran.json'
    if root_fragment.exists():
        # The separately curated Iranian fragment is an equally explicit object
        # boundary. Include its 56 identities when reproducing primary reads.
        candidates.extend(json.loads(root_fragment.read_text())['hotels'])
    result = {}
    for object_type in ('node', 'way'):
        ids = [str(c['osmId']) for c in candidates if c['osmType'] == object_type]
        for index, batch in enumerate(batches(ids)):
            digest = hashlib.sha256(','.join(batch).encode()).hexdigest()[:12]
            path = ROOT / '.local/evidence/hotel-directory-acquisition' / f'{object_type}s-{digest}.json'
            url = f'https://api.openstreetmap.org/api/0.6/{object_type}s.json?{object_type}s=' + ','.join(batch)
            payload = acquire(url, path, args.refresh)
            for element in payload['elements']:
                result[(element['type'], element['id'])] = element
            print(f'{object_type} batch {index}: {len(payload["elements"])} objects', flush=True)
    needed_nodes = [str(node) for element in result.values()
                    if element['type'] == 'way' for node in element['nodes']]
    for index, batch in enumerate(batches(needed_nodes, 200)):
        digest = hashlib.sha256(','.join(batch).encode()).hexdigest()[:12]
        path = ROOT / '.local/evidence/hotel-directory-acquisition' / f'geometry-nodes-{digest}.json'
        url = 'https://api.openstreetmap.org/api/0.6/nodes.json?nodes=' + ','.join(batch)
        for element in acquire(url, path, args.refresh)['elements']:
            result[(element['type'], element['id'])] = element
        print(f'geometry batch {index}: {len(batch)} nodes', flush=True)
    relations = sorted({str(c['osmId']) for c in candidates if c['osmType'] == 'relation'}, key=int)
    for relation in relations:
        path = ROOT / '.local/evidence/hotel-directory-acquisition' / f'relation-{relation}.json'
        url = f'https://api.openstreetmap.org/api/0.6/relation/{relation}/full.json'
        for element in acquire(url, path, args.refresh)['elements']:
            result[(element['type'], element['id'])] = element
    (RESEARCH / 'osm-acquired.json').write_text(json.dumps({'elements': list(result.values())}, ensure_ascii=False, indent=2) + '\n')
    print(f'Acquired {len(result)} unique OSM objects including footprint nodes.', flush=True)

if __name__ == '__main__':
    main()
