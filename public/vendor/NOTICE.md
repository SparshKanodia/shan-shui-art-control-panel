# Source and changes

The drawing code is Lingdong Huang's **{Shan, Shui}**, copyright 2018,
distributed under the MIT license in `LICENSE`.

Source: https://github.com/LingDong-/shan-shui-inf
Pinned commit: `9f754d2b2e73495db7883d4d4055a7b0903b0454`

`public/vendor/shan-shui.js` is that source, unminified, with these local
changes:

- The mountain routine gained SVG presentation groups, a geometry-capture
  callback, and a terrain noise-strength parameter.
- Structures were removed. Upstream plants transmission towers on the ridge,
  pavilions at its top and foot, huts with figures on the flatlands, and a debug
  loader full of arches; none of that is drawn here. Mountains, flat and distant
  mountains, rocks, all eight trees, water and boats keep their upstream
  routines and are the only things drawn.
- Debug logging, the PRNG distribution benchmark, and unreachable debug object
  tags were deleted.

Because the removed routines consumed random numbers, the brushwork that follows
them no longer matches upstream mark for mark, even at 100% noise. The terrain
does: the ridge, the ten profiles and the noise blend are unchanged. The upstream
page UI and DOM event handlers are omitted.

The wrapper runs the classic script in a worker and adds input validation.
Numeric seeds are passed directly to the upstream PRNG. Its original arithmetic
and the noise implementation are retained; this is not a new random generator.

The upstream PerlinNoise section credits Processing's p5.js noise implementation:
https://github.com/processing/p5.js/blob/0.5.16/src/math/noise.js
p5.js is licensed under LGPL-2.1; see `p5-LICENSE.txt`. Its source is included in
the generated, unminified drawing script.

The controls and explanation panel are local additions. Five educational views
show clean cosine, noisy ridge, terrain details, internal contour guides, and
finished ink. These are views of the same generated mountain, not a replay of
upstream execution order. The clean curve and contour guides are teaching
overlays and are removed from the finished view.

The noise amount blends every terrain profile between its clean cosine and its
original noisy form, including vertical offsets. Details and texture are then
generated from those profiles.
