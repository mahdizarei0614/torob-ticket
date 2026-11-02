# TorobTicket production identity

Compact Loop with the owner's requested **two leaves**, selected 2026-10-29.
This is an original Torob-inspired identity; it makes no partnership claim.

## Use

- UI: `BrandLogo` from `@torob-ticket/ui`. Use `language="fa"` for the consumer,
  `language="en"` for admin, and `decorative` inside an already named home link.
  It inherits semantic `--brand-primary`, `--brand-leaf` and `--brand-ink` tokens.
  Light mode is red/green/charcoal; dark mode makes **all** artwork white.
- `symbol-{color,white,mono}.svg` and transparent 256/512/1024 PNGs: compact mark.
- `logo-{fa,en}-{color,white,mono}.{svg,png}`: horizontal lockups.
- `stacked-{fa,en}-{color,white,mono}.{svg,png}`: stacked lockups.
- `wordmark-{fa,en}-{color,white,mono}.svg`: standalone outlined lettering.
- `social-{light,dark}.{svg,png}`: 1200×630 sharing artwork.
- `icon-192.png`, `icon-512.png`: opaque full-color install icons.
- `icon-maskable-{192,512}.png`: opaque icons with the complete mark inside the
  central circular safe area. Do not substitute a transparent logo here.
- At the public root: SVG/favicon ICO (16/32/48), individual PNG favicons,
  180px Apple touch icon, Safari pinned-tab SVG, and consumer/admin manifests.

White variants have actual transparent backgrounds and holes. Use them over a
dark surface. SVG exports contain paths only and do not require installed fonts.
Do not stretch the artwork, apply transport colors, or add decorative effects.
Leave clear space around it; the supplied icons already include their padding.

## Rebuild

Run `pnpm brand:generate`, then `pnpm brand:verify`. The standard build also
verifies exports before packaging. The exporter uses the
existing Playwright dependency and a locally installed Chromium (`pnpm exec
playwright install chromium`), or `PLAYWRIGHT_CHANNEL=chrome pnpm brand:generate`.
No runtime dependency or image API is needed. Commit generated output together
with changes to the vector geometry, outlined wordmarks or semantic palette.
`asset-manifest.json` records exact master/output/font hashes and renderer version.

The source is `libs/ui/src/brand/compact-loop.ts` plus `wordmarks.json`. Lettering
was shaped at weight800 from the locally bundled Vazirmatn and Inter fonts and
converted to outlines using `@napi-rs/canvas`. Both are SIL OFL1.1; original
licenses and notices remain in `assets/fonts/`. Optional wordmark re-authoring:
`CANVAS_PACKAGE=/absolute/path/to/@napi-rs/canvas/package.json node
tools/brand/outline-wordmarks.mjs`, followed by normal export and visual review.
This tool is not a runtime/build dependency. Imagegen concepts, the paired-leaf
reference and exact prompt are in the decision0050 evidence directory; the
production vectors are a clean code-native redraw, not the noisy raster image.

## Release metadata

Both Vite apps copy these local assets. Consumer manifest launches `/`; admin
manifest launches `/admin/`. No service worker/offline behavior is claimed.
Favicon and browser theme color follow the resolved stored/system app theme.
Set `TOROBTICKET_PUBLIC_ORIGIN` to the final HTTP(S) origin during the web build
to emit absolute Open Graph/Twitter image URLs. Without an origin, the build
ships the sharing images but omits domain-dependent tags instead of inventing
a deployment URL. Admin is marked `noindex, nofollow`.

Maskable safe-area reference: https://web.dev/articles/maskable-icon
Manifest icons: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons
