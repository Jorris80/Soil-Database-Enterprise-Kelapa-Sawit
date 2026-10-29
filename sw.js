/* Soil Database Enterprise — Service Worker (PWA offline) v1.1.1 */
const VERSION = 'sdbe-v1.1.2';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://unpkg.com/pmtiles@4.3.0/dist/pmtiles.js',
  'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js',
  'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',
  'https://unpkg.com/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'unpkg.com', 'cdn.sheetjs.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'lh3.googleusercontent.com']; // lh3 = foto/logo di Google Drive (tersedia offline setelah dilihat)

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    // pustaka: best-effort, gagal satu tidak menggagalkan instalasi
    await Promise.all(LIBS.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                         // API POST ke Apps Script: selalu jaringan
  const url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return; // jangan cache API
  if (req.headers.has('range') || /\.pmtiles$/i.test(url.pathname)) return; // PMTiles online: range request langsung
  if (/tile\.openstreetmap\.org|arcgisonline\.com|opentopomap\.org/.test(url.hostname)) return; // patuhi kebijakan ubin peta (tanpa cache massal)

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        const c = await caches.open(VERSION); c.put('./index.html', r.clone());
        return r;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  if (url.origin === location.origin || CDN_HOSTS.includes(url.hostname)) {
    // stale-while-revalidate
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    })());
  }
});
