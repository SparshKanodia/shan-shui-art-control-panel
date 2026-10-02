import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function offlineShell(): Plugin {
  return {
    name: 'offline-shell',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).sort();
      const publicFiles = ['generator.worker.js', 'vendor/shan-shui.js', 'vendor/LICENSE', 'vendor/NOTICE.md', 'vendor/p5-LICENSE.txt'];
      const assets = [...files, ...publicFiles].map((file) => `/${file}`);
      const cacheVersion = Date.now().toString(36);
      const source = `
const CACHE_NAME = 'mathematics-into-art-${cacheVersion}';
const SHELL = ['/', '/index.html', ${assets.map((asset) => JSON.stringify(asset)).join(', ')}];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key.startsWith('mathematics-into-art-')).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Static shell files do not vary by Origin, even when the host adds that header.
  event.respondWith(caches.match(event.request, { ignoreVary: SHELL.includes(new URL(event.request.url).pathname) }).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => event.request.mode === 'navigate' ? caches.match('/') : Response.error())));
});
`;
      this.emitFile({ type: 'asset', fileName: 'service-worker.js', source });
    },
  };
}

export default defineConfig({ plugins: [react(), offlineShell()] });
