# Cosine into contour

A five-step mountain study using Lingdong Huang's [Shan, Shui](https://github.com/LingDong-/shan-shui-inf).

```sh
npm install
npm run dev
npm test
npm run build
```

1. **Generate cosine** shows one clean, noise-free cosine arch.
2. **Add noise** shows the same sample positions shaped by the original four-octave Perlin noise.
3. **Add details** reveals terrain-following trees, rocks, and buildings where the generator places them.
4. **Inner contours** exposes the nine smaller profiles that guide texture.
5. **Ink & shading** replaces those guides with the original brush marks and shading.

Width and height control the arch. Noise amount blends every terrain profile from 0% (clean cosine) to 100% (the exact original noisy profile). Details and ink follow those same profiles. The seed is repeatable and never affects the first clean curve. Play stages advances to the finished mountain and stops; pause/resume preserves the current step. The stages reveal one completed drawing for teaching rather than replaying upstream execution order.

A header switcher moves between the study and a separate **Landscape** view: a canvas-sized camera that travels across a fixed world in 512-unit tiles. Only the tiles the camera actually touches are generated, and only once navigation settles (a short debounce cancels anything that becomes stale). Every tile is placed by its coordinates alone — world, cell, and object seeds are hashed from the seed and the tile index — so a stretch of country returns unchanged however you travel to it, independent of travel order. Objects near an edge are planned in both neighbouring tiles from shared plans and drawn byte-identically, so seams cannot diverge. Finished tiles are compressed into a bounded local archive (at most 64 entries of 2 MiB each) in IndexedDB; leaving the view releases them from live memory, revisits read them back, and anything evicted, unreadable, or over the limit is simply drawn again from its seed. Work stops when you hide the tab, change the world seed, keep moving, or leave the landscape. `src/Landscape.tsx` holds the camera and lifecycle, `public/landscape-core.js` plans and draws tiles, and `public/landscape.worker.js` serves them and runs the archive.

`src/App.tsx` contains the two panels and SVG presentation. `public/generator.worker.js` captures all ten profiles and the finished SVG from one upstream mountain call. `npm test` checks exact finished-output equivalence at 100% noise, shared ridge/contour coordinates, 0/50/100% noise continuity, seed replay, and validation. Existing full-landscape equivalence checks remain; the active interface focuses on one mountain.

Source is pinned to `9f754d2b2e73495db7883d4d4055a7b0903b0454`. The intact HTML is in `reference/shan-shui-original.html`; `scripts/vendor-shan-shui.mjs` reproduces the adapted vendor script. Generator © 2018 Lingdong Huang, MIT; the embedded p5.js noise implementation is LGPL-2.1. Notices and licenses are in `public/vendor/`.

The previous pre-rebuild app is backed up in `.backup/before-shan-shui-rebuild-2026-10-02.zip`. The production app caches its local worker and vendor source for offline reload.
