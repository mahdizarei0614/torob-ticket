"""Four small terminal-area discovery blocks, never whole-airport/city scraping.

Only selected hotel objects and the exact geometry nodes they reference are
retained. Source URLs and response counts are recorded for reproducibility.
"""
import hashlib
import json
import subprocess
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
AREAS = [
    ('istanbul', '28.735,41.255,28.748,41.266'),
    ('tokyo', '139.762,35.538,139.774,35.552'),
    ('sydney', '151.160,-33.940,151.171,-33.929'),
    ('bangkok', '100.744,13.686,100.756,13.700'),
]
discovery = json.loads((HERE / 'discovery.json').read_text())
selected = []
audits = []
for city_id, bbox in AREAS:
    url = 'https://api.openstreetmap.org/api/0.6/map.json?bbox=' + bbox
    response = subprocess.run(['curl', '--fail', '--silent', '--show-error',
                              '--max-time', '25', '--user-agent',
                              'TorobTicketLocalHotelDirectory/1.0 offline-data-curation',
                              url], check=True, capture_output=True).stdout
    payload = json.loads(response)
    hotels = [e for e in payload['elements'] if e.get('tags', {}).get('tourism') == 'hotel'
              and e.get('tags', {}).get('name')]
    nodes = {n for e in hotels for n in e.get('nodes', [])}
    selected.extend(e for e in payload['elements'] if e in hotels or (e['type'] == 'node' and e['id'] in nodes))
    for e in hotels:
        discovery['candidates'].append({'cityId': city_id, 'osmType': e['type'],
            'osmId': str(e['id']), 'discoveryUrl': url, 'discoveryTitle': e['tags']['name']})
    audits.append({'cityId': city_id, 'query': url, 'candidates': len(hotels),
                   'responseElements': len(payload['elements']),
                   'responseSha256': hashlib.sha256(response).hexdigest()})
    print(city_id, len(hotels), [e['tags']['name'] for e in hotels], flush=True)
    time.sleep(0.5)
discovery['audits'].extend(audits)
(HERE / 'discovery.json').write_text(json.dumps(discovery, ensure_ascii=False, indent=2) + '\n')
(HERE / 'selected-terminal-block-source.json').write_text(json.dumps({'elements': selected, 'audits': audits}, ensure_ascii=False, indent=2) + '\n')
