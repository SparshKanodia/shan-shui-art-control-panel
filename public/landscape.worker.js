self.window = self;
importScripts('./vendor/shan-shui.js', './landscape-core.js');
// Upstream logs a line per seed and per planner step; a landscape visit would flood the console.
console.log = () => {};

// Cache limits apply across all seeds: at most 64 * 2 MiB of archived payloads.
const ARCHIVE_LIMIT = 64, MAX_PAYLOAD = 2 * 1024 * 1024;
let archiveWarning = '';
function openArchive() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('shan-shui-landscape', 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('chunks', { keyPath: 'key' });
      store.createIndex('touched', 'touched');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Local archive is blocked.'));
  });
}
function transaction(db, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readwrite');
    const store = tx.objectStore('chunks');
    let result;
    action(store, value => { result = value; });
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Archive transaction failed.'));
  });
}
async function restore(db, key) {
  const record = await transaction(db, (store, done) => {
    const request = store.get(key);
    request.onsuccess = () => {
      const record = request.result;
      if (record) store.put({ ...record, touched: Date.now() });
      done(record);
    };
  });
  if (!record) return null;
  if (!(record.payload instanceof Blob) || record.payload.size > MAX_PAYLOAD) throw new Error('Invalid archived chunk.');
  const stream = record.compressed ? record.payload.stream().pipeThrough(new DecompressionStream('gzip')) : record.payload.stream();
  return new Response(stream).text();
}
async function archive(db, key, svg) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const compressed = typeof CompressionStream !== 'undefined';
  const payload = compressed ? await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob() : blob;
  if (payload.size > MAX_PAYLOAD) throw new Error('This chunk exceeds the archive size limit.');
  await transaction(db, store => {
    store.put({ key, payload, compressed, touched: Date.now() });
    const count = store.count();
    count.onsuccess = () => {
      let excess = count.result - ARCHIVE_LIMIT;
      if (excess <= 0) return;
      store.index('touched').openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (cursor && excess-- > 0) { cursor.delete(); cursor.continue(); }
      };
    };
  });
}

self.onmessage = async ({ data }) => {
  let db;
  try {
    const { seed, x, width, indices } = data;
    const visible = Landscape.visibleChunks(x, width);
    if (!Array.isArray(indices) || indices.length > visible.length || new Set(indices).size !== indices.length ||
        indices.some(index => !Number.isSafeInteger(index) || !visible.includes(index))) {
      throw new Error('Only chunks intersecting the canvas may be requested.');
    }
    const world = Landscape.createWorld(seed);
    try { db = await openArchive(); }
    catch { archiveWarning = 'Local archive unavailable. Revisited scenery will be regenerated.'; }
    for (const index of indices) {
      const key = `${Landscape.VERSION}:${seed}:${index}`;
      let svg = null, source = 'generated', saved = false;
      if (db) {
        try { svg = await restore(db, key); }
        catch { archiveWarning = 'A saved chunk could not be read; it will be regenerated.'; }
      }
      if (svg !== null) { source = 'archive'; saved = true; }
      else {
        // Work is restricted to this visible tile. Navigation terminates the worker.
        svg = world.render(index);
        if (db) {
          try { await archive(db, key, svg); saved = true; }
          catch { archiveWarning = 'Some scenery could not be saved locally. Revisits may regenerate it.'; }
        }
      }
      self.postMessage({ type: 'chunk', seed, index, svg, source, saved, warning: archiveWarning });
    }
    self.postMessage({ type: 'done', warning: archiveWarning });
  } catch (error) {
    self.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'Landscape generation failed.' });
  } finally { db?.close(); }
};
