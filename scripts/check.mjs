import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
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

// ---------------------------------------------------------------------------
// Landscape: viewport tiles, deterministic seeds, shared boundary plans.
// ---------------------------------------------------------------------------
const coreCode = readFileSync(new URL('../public/landscape-core.js', import.meta.url), 'utf8');
const landscapeWorkerCode = readFileSync(new URL('../public/landscape.worker.js', import.meta.url), 'utf8');
function worldScope(seed = 1234) {
  const world = context(adapted);
  vm.runInContext(`${coreCode}\nvar LWORLD = Landscape.createWorld(${seed});`, world);
  return code => vm.runInContext(code, world, { timeout: 60000 });
}
const scope = worldScope();
const tiles = seed => {
  const run = worldScope(seed);
  return index => run(`LWORLD.render(${index})`);
};
assert.equal(scope('JSON.stringify(Landscape.visibleChunks(-10, 1400))'), '[-1,0,1,2]');
assert.equal(scope('JSON.stringify(Landscape.visibleChunks(511, 2))'), '[0,1]');
assert.equal(scope('JSON.stringify(Landscape.visibleChunks(512, 1))'), '[1]');
assert.equal(scope('JSON.stringify(Landscape.visibleChunks(0, 512))'), '[0]');
assert.equal(scope('JSON.stringify(Landscape.visibleChunks(-513, 2))'), '[-2,-1]');
for (const bad of [
  'Landscape.visibleChunks(0, 0)', 'Landscape.visibleChunks(0, 16385)',
  'Landscape.visibleChunks(NaN, 512)', 'Landscape.visibleChunks(2 ** 44, 512)',
]) assert.throws(() => scope(bad), /supported coordinate range/, bad);

const objectsOf = svg => {
  const map = new Map();
  for (const part of svg.split('<g data-object="').slice(1)) map.set(part.slice(0, part.indexOf('"')), part);
  return map;
};
const eastward = tiles(1234);
const firstTile = eastward(0), secondTile = eastward(1), southernTile = eastward(-5), farTile = eastward(40);
for (const [name, svg] of [['0', firstTile], ['1', secondTile], ['-5', southernTile], ['40', farTile]]) {
  assert(svg.length > 0, `tile ${name} must contain artwork`);
  assert(!/NaN|Infinity/.test(svg), `tile ${name} must have valid coordinates`);
}
const westEdge = objectsOf(firstTile), eastEdge = objectsOf(secondTile);
const crossing = [...eastEdge.keys()].filter(id => westEdge.has(id));
assert(crossing.length > 0, 'At least one object must cross the 0|1 boundary');
for (const id of crossing) {
  assert.equal(westEdge.get(id), eastEdge.get(id), `Object ${id} must be identical in both tiles it crosses`);
}
const homeward = tiles(1234);
const revisited = {};
for (const index of [40, -5, 1, 0]) revisited[index] = homeward(index);
assert.deepEqual([firstTile, secondTile, southernTile, farTile],
  [revisited[0], revisited[1], revisited[-5], revisited[40]],
  'Tiles must not depend on travel order or direct jumps');
assert.notEqual(tiles(42)(0), firstTile, 'A different world seed must draw a different country');

// ---------------------------------------------------------------------------
// Landscape worker: IndexedDB archive, eviction, regeneration, failure surfacing.
// ---------------------------------------------------------------------------
function fakeArchive() {
  const records = new Map();
  const loose = { hold() {}, release() {}, oncomplete: null, onabort: null, onerror: null, error: null };
  function transaction() {
    let pending = 0, completed = false;
    const tx = {
      oncomplete: null, onabort: null, onerror: null, error: null,
      hold() { pending += 1; },
      release() { pending -= 1; queueMicrotask(check); },
      objectStore: () => objectStore(tx),
    };
    function check() { if (pending === 0 && !completed && tx.oncomplete) { completed = true; tx.oncomplete(); } }
    return tx;
  }
  function cursorRequest(tx) {
    const request = { onsuccess: null, onerror: null };
    let position = 0;
    const ordered = () => [...records.entries()].sort((a, b) =>
      (a[1].touched - b[1].touched) || String(a[0]).localeCompare(String(b[0])));
    const step = () => {
      tx.hold();
      queueMicrotask(() => {
        const entry = ordered()[position];
        let removed = false;
        const cursor = entry ? {
          delete() { removed = true; tx.hold(); queueMicrotask(() => { records.delete(entry[0]); tx.release(); }); },
          continue() { if (!removed) position += 1; step(); },
        } : null;
        request.onsuccess?.({ target: { result: cursor } });
        tx.release();
      });
    };
    queueMicrotask(step);
    return request;
  }
  function objectStore(tx) {
    function request(op) {
      const box = { onsuccess: null, onerror: null };
      tx.hold();
      queueMicrotask(() => { op(box); tx.release(); });
      return box;
    }
    return {
      get: key => request(box => { box.result = records.get(key); box.onsuccess?.({ target: box }); }),
      put: record => request(() => { records.set(record.key, record); }),
      count: () => request(box => { box.result = records.size; box.onsuccess?.({ target: box }); }),
      createIndex: () => ({}),
      index: () => ({ openCursor: () => cursorRequest(tx) }),
    };
  }
  const idb = {
    open() {
      const request = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => {
        request.result = {
          close() {},
          createObjectStore: () => objectStore(loose),
          transaction: () => transaction(),
        };
        request.onupgradeneeded?.({ target: request });
        request.onsuccess?.({ target: request });
      });
      return request;
    },
  };
  return { idb, records };
}

const overrideWorld = `
  Landscape = {
    CHUNK: Landscape.CHUNK, hash: Landscape.hash, visibleChunks: Landscape.visibleChunks,
    VERSION: 'stub-tiles-v1',
    createWorld: seed => ({ render: index => '<g data-object="' + index + '">tile ' + index + ' of ' + seed + '</g>' }),
  };`;

function landscapeHarness({ archive, world: override, big } = {}) {
  const scope = context('');
  scope.Blob = Blob;
  scope.Response = Response;
  scope.CompressionStream = CompressionStream;
  scope.DecompressionStream = DecompressionStream;
  if (big !== undefined) scope.__BIG = big;
  if (archive) scope.indexedDB = archive.idb;
  scope.importScripts = () => {
    vm.runInContext(adapted, scope);
    vm.runInContext(coreCode, scope);
    if (override) vm.runInContext(override, scope);
  };
  const inbox = [];
  scope.postMessage = data => inbox.push(data);
  vm.runInContext(landscapeWorkerCode, scope);
  return async data => { inbox.length = 0; await scope.onmessage({ data }); return inbox.slice(); };
}

const archive = fakeArchive();
const stubSend = landscapeHarness({ archive, world: overrideWorld });
const firstBatch = await stubSend({ seed: 7, x: 0, width: 1400, indices: [0, 1, 2] });
assert.equal(firstBatch.filter(message => message.type === 'chunk').length, 3);
assert(firstBatch.every(message => message.type === 'chunk' ? message.source === 'generated' && message.saved : true),
  'Fresh tiles are generated and archived');
const restored = await landscapeHarness({ archive, world: overrideWorld })({ seed: 7, x: 0, width: 1400, indices: [0, 1, 2] });
for (const message of restored) if (message.type === 'chunk') {
  assert.equal(message.source, 'archive', 'Archived tiles are read back');
  assert.equal(message.svg, firstBatch.find(item => item.index === message.index).svg, 'Restored tiles are byte-identical');
}
const reseeded = await stubSend({ seed: 8, x: 0, width: 512, indices: [0] });
assert.equal(reseeded[0].source, 'generated', 'A new world seed starts a new archive namespace');

// A fresh archive proves the 64-entry bound and identical regeneration.
const eviction = fakeArchive();
const evictSend = landscapeHarness({ archive: eviction, world: overrideWorld });
const oldest = await evictSend({ seed: 7, x: 0, width: 512, indices: [0] });
assert.equal(oldest[0].source, 'generated');
for (let index = 1; index <= 64; index++) {
  const reply = await evictSend({ seed: 7, x: index * 512, width: 512, indices: [index] });
  assert.equal(reply[0].type, 'chunk');
}
assert.equal(eviction.records.size, 64, `Archive must stay bounded at 64, found ${eviction.records.size}`);
assert(!eviction.records.has('stub-tiles-v1:7:0'), 'The least recently used tile must be evicted first');
const regenerated = await evictSend({ seed: 7, x: 0, width: 512, indices: [0] });
assert.equal(regenerated[0].source, 'generated', 'Evicted tiles regenerate from seed and coordinates');
assert.equal(regenerated[0].svg, oldest[0].svg, 'Regenerated tiles are identical to the evicted original');

// A chunk that cannot fit the per-entry limit is not archived, and says so.
const oversizedArchive = fakeArchive();
const oversizedSend = landscapeHarness({
  archive: oversizedArchive,
  world: `
    Landscape = {
      CHUNK: Landscape.CHUNK, hash: Landscape.hash, visibleChunks: Landscape.visibleChunks,
      VERSION: 'stub-tiles-v1',
      createWorld: seed => ({
        render: index => (index === 99 ? globalThis.__BIG : '<g data-object="' + index + '">tile ' + index + '</g>'),
      }),
    };`,
  big: randomBytes(3 * 1024 * 1024).toString('base64'),
});
const oversizedReply = await oversizedSend({ seed: 7, x: 99 * 512, width: 512, indices: [99] });
assert.equal(oversizedReply[0].type, 'chunk');
assert.equal(oversizedReply[0].saved, false, 'A chunk over the limit is not archived');
assert.equal(oversizedArchive.records.size, 0, 'Nothing is written when the limit is exceeded');
assert.match(oversizedReply[0].warning ?? '', /could not be saved/, 'Archive failures are surfaced');

const offline = await landscapeHarness({ world: overrideWorld })({ seed: 7, x: 0, width: 512, indices: [0] });
assert.equal(offline[0].type, 'chunk');
assert.match(offline[0].warning, /archive unavailable/, 'A missing archive is surfaced without failing');
const rejected = await stubSend({ seed: 7, x: 0, width: 512, indices: [0, 9] });
assert.equal(rejected[0].type, 'error');
assert.match(rejected[0].error, /intersecting the canvas/);
const badSeed = await landscapeHarness()({ seed: 0, x: 0, width: 512, indices: [0] });
assert.equal(badSeed[0].type, 'error');
assert.match(badSeed[0].error, /seed from 1 to 999999/);

// One real payload travels the whole archive round trip, compressed.
const realArchive = fakeArchive();
const generated = await landscapeHarness({ archive: realArchive })({ seed: 1234, x: 0, width: 512, indices: [0] });
assert.equal(generated[0].type, 'chunk');
assert.equal(generated[0].svg, firstTile, 'The worker must return the core tile unchanged');
assert(realArchive.records.size === 1, 'The real tile must fit the archive limit');
const fetched = await landscapeHarness({ archive: realArchive })({ seed: 1234, x: 0, width: 512, indices: [0] });
assert.equal(fetched[0].source, 'archive');
assert.equal(fetched[0].svg, firstTile, 'The archived tile must decompress back to the original');

console.log('PASS: visible-tile selection, invalid viewports, boundary plans, seam identity, negative tiles, travel order, and direct jumps.');
console.log('PASS: archive round trip, bounded 64-entry store, identical regeneration after eviction, and surfaced archive failures.');

