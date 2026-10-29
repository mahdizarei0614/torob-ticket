# Local ground operator marks

23 operating brands, collected on 2026-10-29: 9 rail and 14 bus. Each has 32,
64 and 128 px transparent RGBA PNGs. The 69 PNGs total 281,344 bytes; the largest
is 16,053 bytes. This bounded library does not claim exhaustive operator coverage
or prove current operations, availability, certification or partnership.

Every original is an authentic SVG served by MrBilit's public
`directus.mrbilit.com` image service. Its URL was read from the visible result
card's image beside the operator's name. `manifest.json` records that exact URL,
the dated card page, retrieval date, source bytes/SHA-256, image format/geometry,
identity evidence, rights status, rasterization, alpha trim, output dimensions,
bytes/SHA-256 and alpha coverage. Marketplace image codes identify this source
file; they are not TorobTicket provider IDs or evidence of a direct operator
relationship. No open reuse license was published with these files. Trademarks
and other rights remain with their respective holders; no permission is granted
by this collection.

Sharp 0.35.5 / librsvg 2.63.2 rasterizes the original SVG at density 200 inside a
512 px box. Pillow 12.3.0 trims transparent margins, retains original colors and
geometry, preserves aspect ratio and fits the artwork inside 7/8 of each square.
Outputs use Lanczos resizing, RGBA8 PNG optimization and zlib level 9. No artwork
was generated, redrawn or recolored. The soft tile color is CSS behind the image;
it is not baked into the PNG.

The registry at `libs/ui/src/presentation/ground-operator-brands.ts` accepts exact
namespaced operating identities: `rail:<id>` for train and `bus:<id>` for bus.
The mode must agree. Names and marks resolve together; legacy technical fixture
IDs retain their existing presentation names. Bare IDs, marketplace codes,
ambiguous provider+operator inputs, wrong modes, missing identities and image
failures retain a neutral local fallback. A 40 px card uses 64 px and 128 px
sources; no runtime image service or remote request is required. The preexisting
52 airline brands and their 156 PNGs are preserved.

Rail IDs: `raja`, `fadak`, `bonrail`, `joopar`, `mahtab-seir-jam`, `pars-larim`,
`rail-seir-kowsar`, `rail-tarabar-saba`, `noor-alreza`.

Bus IDs: `iran-peyma`, `hamsafar`, `royal-safar`, `seir-o-safar`, `tarabar-bita`,
`arya-safar`, `levan-noor`, `giti-peyma`, `mihan-noor`, `eiman-safar`,
`peyk-motamed`, `arta-sabalan`, `peyk-saba`, `adl`.
