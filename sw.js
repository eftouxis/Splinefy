// Offline: app files are cached; network-first so updates arrive when online.
const CACHE = 'oikonomika-v47';
const FILES = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'src/main.js', 'src/util.js', 'src/hlc.js', 'src/idb.js', 'src/store.js', 'src/ledger.js', 'src/sync.js', 'src/config.js',
  'src/views/common.js', 'src/views/home.js', 'src/views/form.js', 'src/views/list.js', 'src/views/settings.js', 'src/views/welcome.js',
  'src/lessons.js', 'src/views/lessons/index.js', 'src/views/lessons/ui.js', 'src/views/lessons/student.js', 'src/views/lessons/more.js', 'src/views/rec.js', 'src/views/cats.js', 'src/stats.js', 'src/views/stats.js', 'src/cars.js', 'src/views/cars.js', 'src/xlsx.js', 'src/export.js', 'src/people.js', 'src/views/people.js', 'src/views/othui.js', 'src/views/calc.js', 'src/trips.js', 'src/views/trips.js', 'src/views/philippos.js', 'src/views/freq.js', 'src/views/names.js', 'src/plan.js', 'src/views/goals.js', 'src/views/balances.js', 'src/views/debts.js', 'src/views/couple.js', 'src/tidy.js', 'src/office.js', 'src/views/office/index.js', 'src/views/office/entry.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;     // Graph / login go straight to the network
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
