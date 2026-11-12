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
import carsView from './views/cars.js';
import peopleView from './views/people.js';
import tripsView from './views/trips.js';
import choresView from './views/chores.js';
import medsView from './views/meds.js';
import appsView from './views/apps.js';
import philView from './views/philippos.js';
import healthView from './views/health.js';
import petView from './views/pet.js';
import gymView from './views/gym.js';
import cardsView from './views/cards.js';
import namesView from './views/names.js';
import goalsView from './views/goals.js';
import changelogView from './views/changelog.js';
import trashView from './views/trash.js';
import * as TR from './trash.js';
import odebtView from './views/odebt.js';
import debtsView from './views/debts.js';
import coupleView from './views/couple.js';
import officeView from './views/office/index.js';
import { hasOffice } from './office.js';
import { hasLessons } from './lessons.js';
import { autoCalc } from './views/calc.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const ROUTES = [
  [/^#?\/?$/, home, 'home'], [/^#\/add\/(exp|inc|trf)(?:\?.*)?$/, form, 'add'], [/^#\/edit\/([\w-]+)\/(.+)$/, form, 'add'],
  [/^#\/list(?:\/(.*))?$/, list, 'list'], [/^#\/settings$/, settings, 'settings'],
  [/^#\/lessons(?:\/(\w+))?(?:\/(.+))?$/, lessons, 'lessons'],
  [/^#\/rec(?:\/([\w-]+))?(?:\/(.+))?$/, rec, 'settings'], [/^#\/cats$/, cats, 'settings'],
  [/^#\/stats(?:\/(\w+))?(?:\/(.+))?$/, stats, 'stats'], [/^#\/cars(?:\/([\w-]+))?$/, carsView, 'apps'], [/^#\/people(?:\/([\w-]+))?$/, peopleView, 'debts'],
  [/^#\/trips(?:\/(.+))?$/, tripsView, 'apps'], [/^#\/chores$/, choresView, 'apps'], [/^#\/meds(?:\/(.+))?$/, medsView, 'apps'], [/^#\/apps$/, appsView, 'apps'], [/^#\/philippos$/, philView, 'apps'], [/^#\/health(?:\/(\w+))?$/, healthView, 'apps'], [/^#\/pet(?:\/(\w+))?$/, petView, 'apps'], [/^#\/gym(?:\/(\w+))?$/, gymView, 'apps'], [/^#\/cards(?:\/([\w-]+))?(?:\/(\d+))?$/, cardsView, 'apps'], [/^#\/names$/, namesView, 'settings'], [/^#\/changelog$/, changelogView, 'settings'], [/^#\/trash$/, trashView, 'settings'], [/^#\/odebt(?:\/([^/]+))?$/, odebtView, 'debts'], [/^#\/goals$/, goalsView, 'apps'], [/^#\/debts$/, debtsView, 'debts'], [/^#\/couple$/, coupleView, 'debts'], [/^#\/office(?:\/(\w+))?(?:\/(.+))?$/, officeView, 'office'],
];
let current = null, syncState = { busy: false, msg: '', err: '', last: 0, fresh: false };
/** true once this app session has synced (or cannot sync): news cards wait for it, so an «OK» from another device is known first */
export const syncedThisSession = () => syncState.fresh || !!CONFIG.devServer;

export const ui = {
  go: (h) => { if (location.hash === h) render(); else location.hash = h; },
  back: () => (history.length > 1 ? history.back() : ui.go('#/')),
  toast(msg, ms = 2200, act = null) {
    if (!act && document.querySelector('.toast.undo') && /διαγράφ|σβήστηκε/i.test(msg)) return;     // the «Αναίρεση» message already says it
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    if (act) { const b = document.createElement('button'); b.textContent = act.label; b.style.cssText = 'margin-left:12px;background:none;border:0;color:inherit;text-decoration:underline;font-weight:700'; b.onclick = () => { t.remove(); act.fn(); }; t.appendChild(b); }
    document.body.appendChild(t);
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

// after every delete: «Διαγράφηκε … Αναίρεση» for 10 seconds (one message for a group of deletes)
const UNDO_MS = 10000;
store.onDeleted((g) => {
  document.querySelectorAll('.toast').forEach((x) => { if (x.classList.contains('undo') || /διαγράφ|σβήστηκε/i.test(x.textContent)) x.remove(); });
  const t = document.createElement('div'); t.className = 'toast undo';
  t.style.cssText = 'display:flex;align-items:center;gap:12px;z-index:60;width:min(90vw,420px)';
  const m = document.createElement('span'); m.style.cssText = 'flex:1;min-width:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical';
  m.textContent = `Διαγράφηκε: ${TR.title(g)}`;
  const b = document.createElement('button'); b.textContent = 'Αναίρεση'; b.dataset.undo = '';
  b.style.cssText = 'background:none;border:0;color:inherit;text-decoration:underline;font-weight:700;font-size:inherit;padding:4px 0;white-space:nowrap';
  b.onclick = async () => { t.remove(); if (await store.restore(store.trashOf(g))) ui.toast('Επανήλθε ✓'); };
  t.append(m, b); document.body.appendChild(t);
  setTimeout(() => t.remove(), UNDO_MS);
});

const SVG = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  debt: '<path d="M4 8h14l-4-4"/><path d="M20 16H6l4 4"/>',
  brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const svg = (k) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SVG[k]}</svg>`;
function navHtml(active) {
  const a = (h, i, t, k, cls = '') => `<a href="${h}" class="${cls} ${active === k ? 'on' : ''}"><span class="i">${svg(i)}</span>${t}</a>`;
  const les = hasLessons(), off = hasOffice(), extra = les || off;
  // Αρχική in the middle: three on the left, three on the right (Μαθήματα / Γραφείο, Εφαρμογές, Ρυθμίσεις)
  return `<div class="in ${extra ? 'n7' : ''}" style="grid-template-columns:repeat(${extra ? 7 : 6},1fr)">${a('#/debts', 'debt', 'Οφειλές', 'debts')}${a('#/stats', 'stats', 'Στατιστικά', 'stats')}${a('#/list', 'list', 'Κινήσεις', 'list')}
    ${a('#/', 'home', 'Αρχική', 'home', 'plus')}${les ? a('#/lessons', 'book', 'Μαθήματα', 'lessons') : ''}${off ? a('#/office', 'brief', 'Γραφείο', 'office') : ''}${a('#/apps', 'apps', 'Εφαρμογές', 'apps')}${a('#/settings', 'gear', 'Ρυθμίσεις', 'settings')}</div>`;
}

export function render() {
  const h = location.hash || '#/';
  let view = home, params = [], key = 'home';
  for (const [re, v, k] of ROUTES) { const m = h.match(re); if (m) { view = v; params = m.slice(1).filter((x) => x !== undefined).map(decodeURIComponent); key = k; break; } }
  if (!store.state.user) { view = welcome; key = 'welcome'; }
  current = view;
  app.innerHTML = view.html(params, ui);
  view.mount?.(app, params, ui);
  app.querySelectorAll('.tabs').forEach((t) => { const on = t.querySelector('.on'); if (on) t.scrollLeft = on.offsetLeft - (t.clientWidth - on.offsetWidth) / 2; });   // the chosen tab in view
  nav.innerHTML = key === 'welcome' ? '' : navHtml(key);
  // inside Γραφείο: a second row just above the bar with its sections
  let sub = document.getElementById('subnav');
  const SUBS = {
    office: hasOffice() && [['clients', '👥', 'Πελάτες', 'c'], ['partners', '🤝', 'Συνεργάτες'], ['stats', '📊', 'Στατιστικά'], ['list', '📄', 'Κινήσεις'], ['cash', '🏦', 'Ταμείο'], ['fixed', '📋', 'Πάγια'], ['rec', '↻', 'Επαναλ.'], ['tasks', '✅', 'Εργασίες']],
    lessons: hasLessons() && [['sched', '🗓', 'Πρόγραμμα'], ['sal', '💼', 'Μισθοί'], ['stats', '📊', 'Στατιστικά'], ['hol', '🏖', 'Αργίες'], ['all', '👥', 'Μαθητές'], ['help', '❓', 'Οδηγίες']],
  };
  if (SUBS[key]) {
    if (!sub) { sub = document.createElement('div'); sub.id = 'subnav'; document.body.appendChild(sub); }
    const cur = (h.match(new RegExp(`^#\\/${key}\\/?(\\w*)`)) || [])[1] || '';
    sub.innerHTML = SUBS[key].map(([k, i, t, alt]) => `<a href="#/${key}/${k}" class="${cur === k || (alt && cur === alt) ? 'on' : ''}"><span>${i}</span>${t}</a>`).join('');
    document.body.classList.add('has-sub'); const on = sub.querySelector('.on'); if (on) sub.scrollLeft = on.offsetLeft - sub.clientWidth / 2 + on.clientWidth / 2;
  } else if (sub) { sub.remove(); document.body.classList.remove('has-sub'); }
  if (!view.keepScroll) window.scrollTo(0, 0);
}

let syncTimer = null;
async function syncNow(manual = false) {
  if (!store.state.user) return;
  if (!CONFIG.devServer && !(await sync.signedIn())) { syncState.fresh = true; if (manual) ui.go('#/settings'); return; }
  syncState.busy = true; syncState.err = ''; refreshSyncBadge();
  try {
    const r = await sync.syncAll((m) => { syncState.msg = m; refreshSyncBadge(); });
    syncState.last = Date.now(); syncState.err = r.errors.join(' · '); syncState.signin = !!r.signin;
    if (r.signin) {
      // Microsoft lets a web app keep a sign-in for 24 hours only; renew it by itself (the Microsoft account is remembered, so usually no password)
      if (manual) { sync.signIn(false); return; }
      const last = Number((await store.kv.get('silentAt')) || 0); const busy = /#\/(add|edit)/.test(location.hash) || document.querySelector('.sheet-bg');
      if (!busy && Date.now() - last > 30 * 60000) { await store.kv.set('silentAt', Date.now()); sync.signIn(true); return; }
    }
    if (manual) ui.toast(r.errors.length ? 'Πρόβλημα στον συγχρονισμό' : `Συγχρονίστηκε ✓ (${r.up}↑ ${r.down}↓)`);
  } catch (e) { syncState.err = e.message; }
  syncState.busy = false; syncState.msg = ''; refreshSyncBadge();
  if (!syncState.fresh) { syncState.fresh = true; import('./remind.js').then((R) => R.push()).catch(() => {}); try { await (await import('./recops.js')).adoptFirst(); } catch (e) { console.warn('adopt', e); } if (current?.live) render(); }
}
export function refreshSyncBadge() {
  const b = document.querySelector('[data-syncbadge]'); if (!b) return;
  b.outerHTML = syncBadge();
}
export function syncBadge() {
  const s = syncState;
  if (s.busy) return `<button class="sync" data-syncbadge onclick="window.__sync()">⟳ συγχρονισμός…</button>`;
  if (s.signin) return `<button class="sync err" data-syncbadge onclick="window.__sync()">🔑 πάτα για σύνδεση</button>`;
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
  autoCalc();
  // reopen where you left off (not inside a half-filled form)
  const FORM = /^#\/(add|edit|office\/(in|ex)\/|rec\/)/;
  try { const last = localStorage.getItem('lastHash'), seen = Number(localStorage.getItem('lastSeen') || 0);       // back where you were only if it was a few minutes ago
    if ((!location.hash || location.hash === '#/' || location.hash === '#') && last && last !== '#/' && !FORM.test(last) && Date.now() - seen < 10 * 60000) history.replaceState(null, '', last); } catch (_) { /* */ }
  const seenNow = () => { try { localStorage.setItem('lastSeen', String(Date.now())); } catch (_) { /* */ } };
  seenNow(); setInterval(() => { if (document.visibilityState === 'visible') seenNow(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') seenNow(); else if (Date.now() - Number(localStorage.getItem('lastSeen') || 0) > 10 * 60000 && location.hash !== '#/' && !/^#\/cards\//.test(location.hash) && !FORM.test(location.hash) && !document.querySelector('.sheet-bg')) location.hash = '#/'; else seenNow(); });
  window.addEventListener('hashchange', () => { try { if (!FORM.test(location.hash)) localStorage.setItem('lastHash', location.hash); } catch (_) { /* */ } document.querySelectorAll('.sheet-bg').forEach((e) => e.remove()); render(); });
  let lastV = store.state.version;
  store.on((v) => {
    if (current?.live && v !== lastV) { lastV = v; render(); }
    scheduleSync(5000);
    if (syncState.fresh) import('./remind.js').then((R) => R.push()).catch(() => {});      // reminders by email: the list when it changes
  });
  render();
  syncNow(false);
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(false); else refreshSyncBadge(); }, 120000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(false); });
  if ('serviceWorker' in navigator && !CONFIG.devServer && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
}
start();
