import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { original } from './vendor-shan-shui.mjs';

const adapted = readFileSync(new URL('../public/vendor/shan-shui.js', import.meta.url), 'utf8');
const workerCode = readFileSync(new URL('../public/generator.worker.js', import.meta.url), 'utf8');
const ungroup = svg => svg.replace(/<g data-part="[a-z]+">|<\/g>/g, '');
function context(source) {
  const world = vm.createContext({ Math: Object.create(Math), console: { log() {} }, btoa });
  world.self = world; world.window = world;
  vm.runInContext(source, world);
  return world;
}
for (const seed of [1, 1234, 999999]) {
  const before = context(original);
  const after = context(adapted);
  const draw = `Math.seed(${seed}); Mount.mountain(500, 520, 0, {wid:650, hei:520, tex:200})`;
  const expected = vm.runInContext(draw, before, { timeout: 30000 });
  const actual = vm.runInContext(draw, after, { timeout: 30000 });
  assert.equal(ungroup(actual), expected, 'Presentation groups must not change a single upstream mark');
  assert.equal((actual.match(/data-part="ridge"/g) ?? []).length, 1, 'Exactly one ridge per mountain');
  assert(!/NaN|Infinity/.test(actual));
}
function worker() {
  const world = context('');
  world.importScripts = () => vm.runInContext(adapted, world);
  let result;
  world.postMessage = data => { result = data; };
  vm.runInContext(workerCode, world);
  return data => { world.onmessage({ data }); return result; };
}
const options = { id: 1, seed: 1234, mode: 'mountain', width: 650, height: 520, texture: 200, x: 0 };
const draw = worker();
const first = draw(options);
assert(first.svg && !first.error);
assert.equal(draw(options).svg, first.svg, 'Repeated messages must preserve the drawing');
assert.equal(worker()(options).svg, first.svg, 'Fresh workers must reproduce the seed');
assert.notEqual(worker()({ ...options, seed: 42 }).svg, first.svg);
for (const bad of [{ seed: 0 }, { seed: '山' }, { x: Infinity }, { width: 900 }, { texture: 1.5 }, { mode: 'invalid' }, { amount: -1 }, { amount: 101 }]) {
  assert(draw({ ...options, ...bad }).error, 'Reject invalid settings');
}
const landscape = worker();
const scroll = landscape({ ...options, mode: 'landscape' });
assert(scroll.svg && !scroll.error, JSON.stringify(scroll));
assert(!/NaN|Infinity/.test(scroll.svg));
assert.equal(landscape({ ...options, mode: 'landscape' }).svg, scroll.svg);
const baseline = context(original);
const expectedScroll = vm.runInContext('Math.seed(1234); chunkloader(0,1400); chunkrender(0,1400); MEM.canv', baseline, { timeout: 30000 });
assert.equal(ungroup(scroll.svg), expectedScroll, 'The entire landscape must match the original planner and drawing order');
assert(landscape({ ...options, mode: 'landscape', x: -700 }).svg);
assert(landscape({ ...options, mode: 'landscape', x: 1400 }).svg);
const curve = worker()({ ...options, mode: 'curve' });
assert.equal(curve.clean.length, 50);
assert.equal(curve.noisy.length, 50);
const ridge = vm.runInContext('Math.seed(1234); Mount.mountain(500,520,0,{wid:650,hei:520,ret:1})[0][0]', context(original));
for (let i = 0; i < 50; i++) {
  assert(Math.abs(curve.noisy[i][0] - (500 + ridge[i][0])) < 1e-10);
  assert(Math.abs(curve.noisy[i][1] - (520 + ridge[i][1])) < 1e-10, 'Full noise must match the upstream ridge');
}
assert.equal(curve.clean[25][1], 0, 'Clean cosine peak must have the chosen height');
const otherSeed = worker()({ ...options, mode: 'curve', seed: 42 });
assert.equal(JSON.stringify(otherSeed.clean), JSON.stringify(curve.clean), 'The clean cosine must be seed-independent');
assert.notEqual(JSON.stringify(otherSeed.noisy), JSON.stringify(curve.noisy));
const fullStudy = worker()({ ...options, mode: 'study' });
assert.equal(fullStudy.svg, first.svg, 'Finished study must preserve every original mark at full noise');
const originalProfiles = vm.runInContext('Math.seed(1234); Mount.mountain(500,520,0,{wid:650,hei:520,ret:1})[0]', context(original));
for (const amount of [0, 50, 100]) {
  const studyWorker = worker();
  const study = studyWorker({ ...options, mode: 'study', amount });
  assert(study.svg && !study.error);
  assert.equal(study.contours.length, 10);
  assert.equal(JSON.stringify(study.ridge), JSON.stringify(study.contours[0]));
  assert.equal(studyWorker({ ...options, mode: 'study', amount }).svg, study.svg);
  for (let j = 0; j < 10; j++) for (let i = 0; i < 50; i++) {
    const cleanY = 520 - 520 * Math.cos((i / 50 - 0.5) * Math.PI) * (1 - j / 10);
    const expectedY = cleanY * (1 - amount / 100) + (520 + originalProfiles[j][i][1]) * amount / 100;
    assert(Math.abs(study.contours[j][i][1] - expectedY) < 1e-10, 'Every inner contour must follow the selected noise amount');
  }
}
console.log('PASS: five-stage study, exact finished SVG, shared ridge/contours, and 0/50/100% noise continuity.');
console.log('PASS: noise-free cosine and noisy points match the original first profile.');
console.log('PASS: exact upstream mountain and landscape equivalence, one ridge, seed replay, worker validation, and scroll generation.');

