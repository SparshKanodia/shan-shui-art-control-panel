# Source and changes

The drawing code is Lingdong Huang's **{Shan, Shui}***, copyright 2018,
distributed under the MIT license in `LICENSE`.

Source: https://github.com/LingDong-/shan-shui-inf
Pinned commit: `9f754d2b2e73495db7883d4d4055a7b0903b0454`

`reference/shan-shui-original.html` preserves the complete upstream source.
`scripts/vendor-shan-shui.mjs` extracts its procedural drawing routines and adds
SVG groups, a geometry-capture callback, and a terrain noise-strength parameter.
At the default 100% noise, original coordinates, random call order, marks,
shading, and painter order are unchanged. The upstream page UI and DOM event
handlers are omitted.
The wrapper runs the classic script in a worker and adds input validation.
Numeric seeds are passed directly to the upstream PRNG. Its original arithmetic
and the noise implementation are retained; this is not a new random generator.

The upstream PerlinNoise section credits Processing's p5.js noise implementation:
https://github.com/processing/p5.js/blob/0.5.16/src/math/noise.js
p5.js is licensed under LGPL-2.1; see `p5-LICENSE.txt`. Its source is included in
both the preserved upstream file and the generated, unminified drawing script.

The controls and explanation panel are local additions. Five educational views
show clean cosine, noisy ridge, terrain details, internal contour guides, and
finished ink. These are views of the same generated mountain, not a replay of
upstream execution order. The clean curve and contour guides are teaching
overlays and are removed from the finished view.

The noise amount blends every terrain profile between its clean cosine and its
original noisy form, including vertical offsets. Details and texture are then
generated from those profiles. At 100%, the final SVG matches the original.
The complete source and older full-landscape worker paths remain preserved.
