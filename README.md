# Cosine into contour

A five-step mountain study and a deterministic travelling landscape, built on
Lingdong Huang's [Shan, Shui](https://github.com/LingDong-/shan-shui-inf).

```sh
npm install
npm run dev
npm run build
npm run preview
```

`npm run build` writes the production site to `dist/`; `npm run preview` serves
that build locally. The build registers a service worker so the app reloads
offline.

## Mountain study

1. **Generate cosine** shows one clean, noise-free cosine arch.
2. **Add noise** shows the same sample positions shaped by the original four-octave Perlin noise.
3. **Add details** reveals terrain-following trees and rocks where the generator places them.
4. **Inner contours** exposes the nine smaller profiles that guide texture.
5. **Ink & shading** replaces those guides with the original brush marks and shading.

Width and height control the arch. Noise amount blends every terrain profile
from 0% (clean cosine) to 100% (the original noisy profile). Details and ink
follow those same profiles. The seed is repeatable and never affects the first
clean curve. Play stages advances to the finished mountain and stops;
pause/resume preserves the current step. The stages reveal one completed drawing
for teaching rather than replaying upstream execution order.

## Landscape

A header switcher moves between the study and a separate **Landscape** view: a
canvas-sized camera that travels across a fixed world in 512-unit tiles. Only the
tiles the camera actually touches are generated, and only once navigation settles
(a short debounce cancels anything that becomes stale). Every tile is placed by
its coordinates alone — world, cell, and object seeds are hashed from the seed
and the tile index — so a stretch of country returns unchanged however you
travel to it, independent of travel order. Objects near an edge are planned in
both neighbouring tiles from shared plans and drawn byte-identically, so seams
cannot diverge. Finished tiles are compressed into a bounded local archive (at
most 64 entries of 2 MiB each) in IndexedDB; leaving the view releases them from
live memory, revisits read them back, and anything evicted, unreadable, or over
the limit is simply drawn again from its seed. Work stops when you hide the tab,
change the world seed, keep moving, or leave the landscape.

## Code map

- `src/App.tsx` — the two panels, the five stages, and SVG presentation.
- `src/Landscape.tsx` — the landscape camera and worker lifecycle.
- `public/generator.worker.js` — captures all ten profiles and the finished SVG
  from one mountain call.
- `public/landscape-core.js` — plans and draws tiles from their coordinates.
- `public/landscape.worker.js` — serves tiles and runs the local archive.
- `public/vendor/shan-shui.js` — the upstream drawing source, unminified, with the
  local changes listed below.

## Source and licensing

Source is pinned to `9f754d2b2e73495db7883d4d4055a7b0903b0454`.
Generator © 2018 Lingdong Huang, MIT; the embedded p5.js noise implementation is
LGPL-2.1. Notices and licenses are in `public/vendor/`.

The drawn world keeps natural scenery only: mountains, trees, rocks, rivers and
boats. The transmission towers, pavilions, arches and huts that upstream plants
on the terrain, and the figures that stand beside them, are not part of this
build — so the finished artwork is not a byte-for-byte copy of upstream's. The
terrain geometry is untouched: the ridge, the inner profiles and the noise blend
are the originals.
