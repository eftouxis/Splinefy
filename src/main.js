import * as store from './store.js';
import * as sync from './sync.js';
import { CONFIG } from './config.js';
import home from './views/home.js';
import form from './views/form.js';
import list from './views/list.js';
import settings from './views/settings.js';
import welcome from './views/welcome.js';
import lessons from './views/lessons/index.js';
import rec from './views/rec.js';
import cats from './views/cats.js';
import stats from './views/stats.js';
import { hasLessons } from './lessons.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const ROUTES = [
  [/^#?\/?$/, home, 'home'], [/^#\/add\/(exp|inc|trf)(?:\?.*)?$/, form, 'add'], [/^#\/edit\/([\w-]+)\/(.+)$/, form, 'add'],
  [/^#\/list(?:\/(.*))?$/, list, 'list'], [/^#\/settings$/, settings, 'settings'],
  [/^#\/lessons(?:\/(\w+))?(?:\/(.+))?$/, lessons, 'lessons'],
  [/^#\/rec(?:\/([\w-]+))?(?:\/(.+))?$/, rec, 'settings'], [/^#\/cats$/, cats, 'settings'],
  [/^#\/stats(?:\/(\w+))?(?:\/(.+))?$/, stats, 'stats'],
];
let current = null, syncState = { busy: false, msg: '', err: '', last: 0 };

export const ui = {
  go: (h) => { if (location.hash === h) render(); else location.hash = h; },
  back: () => (history.length > 1 ? history.back() : ui.go('#/')),
  toast(msg, ms = 2200) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  },
  confirm(text, okLabel = 'Ναι', danger = true) {
    return new Promise((res) => {
      const bg = document.createElement('div'); bg.className = 'sheet-bg';
      bg.innerHTML = `<div class="sheet"><div class="mid">${text}</div>
        <button class="btn ${danger ? 'red' : 'primary'}" data-ok>${okLabel}</button><button class="btn" data-no>Άκυρο</button></div>`;
      bg.addEventListener('click', (e) => { if (e.target.dataset.ok !== undefined) { bg.remove(); res(true); } else if (e.target === bg || e.target.dataset.no !== undefined) { bg.remove(); res(false); } });
      document.body.appendChild(bg);
    });
  },
  sync: () => syncState,
  syncNow,
  render,
};

const SVG = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const svg = (k) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SVG[k]}</svg>`;
function navHtml(active) {
  const a = (h, i, t, k, cls = '') => `<a href="${h}" class="${cls} ${active === k ? 'on' : ''}"><span class="i">${svg(i)}</span>${t}</a>`;
  const les = hasLessons();
  return `<div class="in" style="grid-template-columns:repeat(${les ? 6 : 5},1fr)">${a('#/', 'home', 'Αρχική', 'home')}${a('#/list', 'list', 'Κινήσεις', 'list')}${a('#/add/exp', 'plus', 'Νέα', 'add', 'plus')}
    ${les ? a('#/lessons', 'book', 'Μαθήματα', 'lessons') : ''}${a('#/stats', 'stats', 'Στατιστικά', 'stats')}${a('#/settings', 'gear', 'Ρυθμίσεις', 'settings')}</div>`;
}

export function render() {
  const h = location.hash || '#/';
  let view = home, params = [], key = 'home';
  for (const [re, v, k] of ROUTES) { const m = h.match(re); if (m) { view = v; params = m.slice(1).filter((x) => x !== undefined).map(decodeURIComponent); key = k; break; } }
  if (!store.state.user) { view = welcome; key = 'welcome'; }
  current = view;
  app.innerHTML = view.html(params, ui);
  view.mount?.(app, params, ui);
  nav.innerHTML = key === 'welcome' ? '' : navHtml(key);
  if (!view.keepScroll) window.scrollTo(0, 0);
}

let syncTimer = null;
async function syncNow(manual = false) {
  if (!store.state.user) return;
  if (!CONFIG.devServer && !(await sync.signedIn())) { if (manual) ui.go('#/settings'); return; }
  syncState.busy = true; syncState.err = ''; refreshSyncBadge();
  try {
    const r = await sync.syncAll((m) => { syncState.msg = m; refreshSyncBadge(); });
    syncState.last = Date.now(); syncState.err = r.errors.join(' · ');
    if (manual) ui.toast(r.errors.length ? 'Πρόβλημα στον συγχρονισμό' : `Συγχρονίστηκε ✓ (${r.up}↑ ${r.down}↓)`);
  } catch (e) { syncState.err = e.message; }
  syncState.busy = false; syncState.msg = ''; refreshSyncBadge();
}
export function refreshSyncBadge() {
  const b = document.querySelector('[data-syncbadge]'); if (!b) return;
  b.outerHTML = syncBadge();
}
export function syncBadge() {
  const s = syncState;
  if (s.busy) return `<button class="sync" data-syncbadge onclick="window.__sync()">⟳ συγχρονισμός…</button>`;
  if (s.err) return `<button class="sync err" data-syncbadge onclick="window.__sync()" title="${s.err.replace(/"/g, '')}">⚠ όχι συγχρονισμένο</button>`;
  if (!s.last) return `<button class="sync" data-syncbadge onclick="window.__sync()">☁ συγχρονισμός</button>`;
  const min = Math.round((Date.now() - s.last) / 60000);
  return `<button class="sync" data-syncbadge onclick="window.__sync()">✓ ${min < 1 ? 'μόλις τώρα' : `πριν ${min}΄`}</button>`;
}
window.__sync = () => syncNow(true);
window.__ui = ui;

function scheduleSync(ms = 4000) { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), ms); }

async function start() {
  const theme = localStorage.getItem('theme'); if (theme) document.documentElement.dataset.theme = theme;
  try { if (await sync.handleRedirect()) setTimeout(() => ui.toast('Συνδέθηκες στο OneDrive ✓'), 300); }
  catch (e) { setTimeout(() => ui.toast('Σύνδεση: ' + e.message, 4000), 300); }
  await store.init();
  syncState.last = (await store.kv.get('lastSync')) || 0;
  window.addEventListener('hashchange', () => { document.querySelectorAll('.sheet-bg').forEach((e) => e.remove()); render(); });
  let lastV = store.state.version;
  store.on((v) => {
    if (current?.live && v !== lastV) { lastV = v; render(); }
    scheduleSync(5000);
  });
  render();
  syncNow(false);
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(false); else refreshSyncBadge(); }, 120000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(false); });
  if ('serviceWorker' in navigator && !CONFIG.devServer && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js');
}
start();
