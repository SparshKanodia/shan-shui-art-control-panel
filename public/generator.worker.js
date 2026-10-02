// Classic worker isolates upstream's global variables and Math.random override.
self.window = self;
importScripts('./vendor/shan-shui.js');

let settingsKey = '';
let mountainSvg = '';
let curvePoints;
let study;
const originalMountain = Mount.mountain;
const group = (part, svg) => `<g data-part="${part}">${svg}</g>`;
// Surface groups are presentation only; upstream geometry and random calls stay intact.
for (const name of ['flatMount', 'distMount']) {
  const draw = Mount[name];
  Mount[name] = (...args) => group('detail', draw.apply(Mount, args));
}
const originalWater = water;
water = (...args) => group('detail', originalWater(...args));
const originalBoat = Arch.boat01;
Arch.boat01 = (...args) => group('detail', originalBoat.apply(Arch, args));

self.onmessage = ({ data }) => {
  try {
    const { id, seed, mode, width, height, texture = 200, x = 0, amount = 100 } = data;
    if (!Number.isInteger(seed) || seed < 1 || seed > 999999 ||
        !['curve', 'study', 'mountain', 'landscape'].includes(mode) ||
        !Number.isInteger(amount) || amount < 0 || amount > 100 ||
        !Number.isFinite(x) || Math.abs(x) > 1000000 ||
        !Number.isFinite(width) || width < 400 || width > 800 ||
        !Number.isFinite(height) || height < 200 || height > 600 ||
        !Number.isInteger(texture) || texture < 50 || texture > 400) {
      throw new Error('Choose valid drawing settings.');
    }
    const key = JSON.stringify([seed, mode, width, height, texture, amount]);
    if (key !== settingsKey) {
      // A fresh worker resets the upstream PRNG and lazy noise table together.
      if (settingsKey && key !== settingsKey) throw new Error('Restart the generator for new settings.');
      Math.seed(seed);
      settingsKey = key;
    }
    if (mode === 'study') {
      if (!study) {
        let contours;
        const svg = originalMountain(500, 520, 0, {
          wid: width, hei: height, tex: texture, noiseAmount: amount / 100,
          capture: profiles => { contours = profiles.map(profile => profile.map(([x, y]) => [500 + x, 520 + y])); },
        });
        if (/NaN|Infinity/.test(svg)) throw new Error('Invalid drawing coordinates. Try another seed.');
        const clean = contours[0].map(([x], i) => [x, 520 - height * Math.cos((i / 50 - 0.5) * Math.PI)]);
        study = { clean, ridge: contours[0], contours, svg };
      }
      self.postMessage({ id, ...study });
      return;
    }
    if (mode === 'curve') {
      if (!curvePoints) {
        // The first profile from Mount.mountain, before vegetation or brushwork.
        const offset = Math.random() * 520 / 100;
        const clean = [], noisy = [];
        for (let i = 0; i < 50; i++) {
          const u = (i / 50 - 0.5) * Math.PI;
          const x = 500 + u / Math.PI * width;
          const y = Math.cos(u);
          clean.push([x, 520 - y * height]);
          noisy.push([x, 520 - y * Noise.noise(u + 10, 0, 0) * height + offset]);
        }
        curvePoints = { clean, noisy };
      }
      self.postMessage({ id, ...curvePoints });
      return;
    }
    let svg;
    if (mode === 'mountain') {
      mountainSvg ||= originalMountain(500, 520, 0, { wid: width, hei: height, tex: texture });
      svg = mountainSvg;
    } else {
      chunkloader(x, x + 1400);
      chunkrender(x, x + 1400);
      svg = MEM.canv;
    }
    if (/NaN|Infinity/.test(svg)) throw new Error('The generator produced invalid coordinates. Try another seed.');
    self.postMessage({ id, svg });
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Drawing failed.' });
  }
};
