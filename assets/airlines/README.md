# Local airline marks

52 airline identities, collected on 2026-10-28: 23 Iranian and 29 international.
Each has 32, 64 and 128 px transparent RGBA PNGs. The collection is a set of
identity assets, not an exhaustive roster or evidence of current operations,
inventory, availability, an integration or an airline relationship.

`manifest.json` records each original download URL, file-description/source page,
retrieval date, source bytes and SHA-256, source license claim, attribution, crop,
background removal, dimensions, alpha coverage and output bytes/SHA-256. Authentic
source colors and geometry are retained; no marks were generated or redrawn.
Compact symbols are cropped from existing brand artwork where practical.
Wordmark-only originals remain wordmarks. Four sources have only an
edge-connected near-white background removed; interior brand details remain.

The source mix is 19 airline-hosted files, 17 Wikimedia Commons files and 16
Wikipedia file references (15 English, one Persian). The latter include 12 explicitly non-free
logo references. An official website download does not grant an open reuse
license. Source-reported public-domain and CC license metadata is retained as a
claim by that repository; it is not independent clearance from the airline.
Trademarks remain the property of their respective owners. This collection has
no blanket open license and asserts no endorsement. Saudia's file metadata
contains both a PD label and a non-free flag; both are retained, and it is
classified as non-free here without resolving that conflict.

The Iran Air and Zagros source records report
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Their normalized
derivatives retain that attributed license claim; see the manifest for the named
authors and original file pages. The remaining assets retain their individual
source status. No new permission is granted for non-free source files.

The browser uses exact namespaced identities from
`libs/ui/src/presentation/airline-brands.ts`. Its only authored fixture aliases
are `demo-operator-flight-0` → Iran Air, `-1` → Mahan Air and `-2` → Iran Aseman
Airlines, each paired with its matching Persian display name. These are approved
presentation aliases; source fixture IDs and mocked provider evidence are
unchanged. Unmapped, ambiguous, transport-mismatched or failed image identities
use the neutral local vector fallback. The application never downloads a remote
logo or queries a logo service at runtime.
