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

`src/App.tsx` contains the two panels and SVG presentation. `public/generator.worker.js` captures all ten profiles and the finished SVG from one upstream mountain call. `npm test` checks exact finished-output equivalence at 100% noise, shared ridge/contour coordinates, 0/50/100% noise continuity, seed replay, and validation. Existing full-landscape equivalence checks remain; the active interface focuses on one mountain.

Source is pinned to `9f754d2b2e73495db7883d4d4055a7b0903b0454`. The intact HTML is in `reference/shan-shui-original.html`; `scripts/vendor-shan-shui.mjs` reproduces the adapted vendor script. Generator © 2018 Lingdong Huang, MIT; the embedded p5.js noise implementation is LGPL-2.1. Notices and licenses are in `public/vendor/`.

The previous pre-rebuild app is backed up in `.backup/before-shan-shui-rebuild-2026-10-02.zip`. The production app caches its local worker and vendor source for offline reload.
