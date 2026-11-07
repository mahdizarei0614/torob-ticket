# Reproducible hotel-directory inputs

These source inputs and curation tools were relocated from historical evidence.
The runtime directory remains `libs/fixtures/src/catalog/real-hotel-directory.json`;
this move changes no property, coordinate, provenance or authored room offer.

Run from the repository root:

```sh
python3 tools/acquire-real-hotel-directory.py
python3 tools/hotel-directory/curate-directory.py --complete
python3 tools/hotel-directory/verify-coordinates.py
```

Acquisition explicitly requests curated public OSM objects and uses the network;
curation and coordinate verification use the retained local inputs. Acquisition
may cache additional responses under `.local/evidence/hotel-directory-acquisition`.
Read the runtime directory's README and retained source reports for attribution,
exclusions and the distinction between sourced geography and authored prices.
