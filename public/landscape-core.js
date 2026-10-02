// Coordinate-based scheduling around the original Shan, Shui drawing routines.
// Loaded only in the landscape worker; the mountain study is unchanged.
self.Landscape = (() => {
  const CHUNK = 512;
  const VERSION = 'landscape-v1';
  function hash(text) {
    let value = 2166136261;
    for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    return value >>> 0;
  }
  function visibleChunks(x, width) {
    if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0 || width > 16384 ||
        !Number.isSafeInteger(Math.floor(x / CHUNK)) || Math.abs(x) > 2 ** 42) {
      throw new Error('The viewing area is outside the supported coordinate range.');
    }
    const first = Math.floor(x / CHUNK), last = Math.ceil((x + width) / CHUNK) - 1;
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }
  function createWorld(seed) {
    if (!Number.isInteger(seed) || seed < 1 || seed > 999999) throw new Error('Choose a seed from 1 to 999999.');
    Noise.noiseSeed(hash(`noise:${seed}`));
    const plans = new Map(), drawings = new Map();
    function plan(cell) {
      if (plans.has(cell)) return plans.get(cell);
      Math.seed(hash(`plan:${seed}:${cell}`));
      MEM.planmtx = Object.create(null);
      const objects = mountplanner(cell * CHUNK, (cell + 1) * CHUNK).flatMap((item, i) => {
        const id = `${cell}:${i}`;
        const record = { ...item, id, depth: item.y };
        return item.tag === 'mount' ? [record, { ...record, tag: 'water', id: `${id}:water`, depth: item.y - 10000 }] : [record];
      });
      plans.set(cell, objects);
      return objects;
    }
    function bounds(item) {
      // Generous horizontal reach decides which tiles an object may paint into.
      // Tiles clip at their own 512-unit edge, so a shared object stays whole.
      if (item.tag === 'distmount') return [item.x - 40, item.x + 1560];
      const radius = { mount: 700, flatmount: 1100, water: 600, boat: 400 }[item.tag];
      return [item.x - radius, item.x + radius];
    }
    function objectsFor(index) {
      const left = index * CHUNK, right = left + CHUNK;
      const objects = [];
      // Neighbouring placement metadata finds silhouettes entering this tile.
      // No neighbouring chunk artwork is generated or queued here.
      for (let cell = index - 4; cell <= index + 4; cell++) {
        for (const item of plan(cell)) {
          const [min, max] = bounds(item);
          if (min < right && max > left) objects.push(item);
        }
      }
      return objects.sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
    }
    function drawObject(item) {
      if (drawings.has(item.id)) return drawings.get(item.id);
      Math.seed(hash(`art:${seed}:${item.id}`));
      let svg = '';
      if (item.tag === 'mount') svg = Mount.mountain(item.x, item.y, Math.random() * 100);
      if (item.tag === 'water') svg = water(item.x, item.y, Math.random() * 100);
      if (item.tag === 'flatmount') svg = Mount.flatMount(item.x, item.y, Math.random() * Math.PI * 2,
        { wid: 600 + Math.random() * 400, hei: 100, cho: 0.5 + Math.random() * 0.2 });
      if (item.tag === 'distmount') svg = Mount.distMount(item.x, item.y, Math.random() * 100,
        { hei: 150, len: randChoice([500, 1000, 1500]) });
      if (item.tag === 'boat') svg = Arch.boat01(item.x, item.y, Math.random(),
        { sca: item.y / 800, fli: randChoice([true, false]) });
      if (/NaN|Infinity/.test(svg)) throw new Error('The landscape generated invalid coordinates. Try a different seed.');
      // Objects keep their world coordinates; every tile clips at its own edge, so
      // a tile that shares an object draws exactly the same geometry as its neighbour.
      const bounded = `<g data-object="${item.id}">${svg}</g>`;
      drawings.set(item.id, bounded);
      return bounded;
    }
    return {
      objectsFor, drawObject,
      render(index) { return objectsFor(index).map(drawObject).join(''); },
    };
  }
  return { CHUNK, VERSION, hash, visibleChunks, createWorld };
})();
