// Google Calendar (read only): the private lessons in the calendar («Όνομα», «Όνομα - Γ΄ Λυκείου» …) are compared with the
// lessons of the app; differences (other time, other duration, moved / extra lesson, not in the calendar) become suggestions
// that Άλκης accepts or ignores. Nothing changes by itself and nothing before «sync from» is touched.
import * as store from './store.js';
import * as L from './lessons.js';
import { today, addDays, norm } from './util.js';

const GIS = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
let token = null, tokenExp = 0, client = null;

export const pref = () => store.records('pref', [L.LSP]).find((r) => r.id === 'gcal') || {};
export const setPref = (fields) => store.put(L.LSP, 'gcal', { type: 'pref', ...fields });
export const connected = () => !!pref().client && !!pref().from;
export const hasToken = () => !!token && Date.now() < tokenExp - 60000;

const load = () => new Promise((res, rej) => {
  if (window.google?.accounts?.oauth2) return res();
  const s = document.createElement('script'); s.src = GIS; s.onload = res; s.onerror = () => rej(new Error('δεν φορτώθηκε η σύνδεση Google')); document.head.appendChild(s);
});
/** Google sign-in popup (must come from a tap); afterwards it is silent for about an hour */
export async function signIn(prompt = '') {
  await load();
  const cid = pref().client; if (!cid) throw new Error('λείπει το Client ID');
  return new Promise((res, rej) => {
    client = window.google.accounts.oauth2.initTokenClient({
      client_id: cid, scope: SCOPE, ...(pref().hint ? { hint: pref().hint } : {}),     // known account → no account picker, the window closes by itself
      callback: (r) => { if (r.error) return rej(new Error(r.error)); token = r.access_token; tokenExp = Date.now() + (Number(r.expires_in) || 3600) * 1000; try { localStorage.setItem('gtok', JSON.stringify([token, tokenExp])); } catch (_) { /* */ } res(); },
      error_callback: (e) => rej(new Error(e?.message || e?.type || 'ακυρώθηκε')),
    });
    client.requestAccessToken({ prompt });
  });
}
try { const [t, e] = JSON.parse(localStorage.getItem('gtok') || '[]'); if (t && e > Date.now()) { token = t; tokenExp = e; } } catch (_) { /* */ }     // kept across app restarts while valid

async function g(path) {
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) { token = null; throw new Error('χρειάζεται ξανά σύνδεση Google'); }
  if (!r.ok) throw new Error(`Google ${r.status}`);
  return r.json();
}
export async function calendars() {
  const l = (await g('/users/me/calendarList?minAccessRole=reader')).items || [];
  const me = l.find((c) => c.primary)?.id; if (me && pref().hint !== me) setPref({ hint: me });
  return l;
}
async function events(calId, from, to) {
  let out = [], page = '';
  do {
    const q = new URLSearchParams({ timeMin: new Date(from + 'T00:00:00').toISOString(), timeMax: new Date(to + 'T23:59:59').toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250', ...(page ? { pageToken: page } : {}) });
    const j = await g(`/calendars/${encodeURIComponent(calId)}/events?${q}`); out = out.concat(j.items || []); page = j.nextPageToken || '';
  } while (page);
  return out.filter((e) => e.status !== 'cancelled' && e.start?.dateTime && e.end?.dateTime);
}

const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOf = (time) => (String(time || '').match(/(\d{1,2})[:.](\d{2})/) || []).slice(1, 3).map((x) => x.padStart(2, '0')).join(':');
/** which student an event is: «Όνομα», «Όνομα - Γ΄ Λυκείου», «Όνομα - IB» (school periods, breaks etc. match nobody) */
function studentOf(title, list) {
  const t = norm(String(title || '').split(/\s[-–—|]\s|,|\(/)[0]).trim(); if (!t) return null;
  const hit = list.filter((s) => [s.name, s.full, L.label(s)].filter(Boolean).some((n) => norm(n).trim() === t));
  return hit.length === 1 ? hit[0] : null;
}

/** suggestions: [{key, stu, d, kind:'time'|'add'|'gone', h, time, was}] */
export async function check() {
  const p = pref(); if (!p.client || !p.from) throw new Error('δεν έχει ρυθμιστεί');
  if (!hasToken()) throw new Error('χρειάζεται σύνδεση Google');
  const cals = await calendars(); const cal = cals.find((c) => norm(c.summary || '') === norm(p.cal || 'Εργασία')) || null;
  if (!cal) throw new Error(`δεν βρέθηκε το ημερολόγιο «${p.cal || 'Εργασία'}»`);
  // only lessons that already started (today included): the calendar is the record of what happened
  const t = today(); const from = [p.from, addDays(t, -21)].sort()[1], to = t;
  const stus = L.students().filter((s) => L.isActive(s, t));
  const now = Date.now(); const ev = (await events(cal.id, from, to)).filter((e) => new Date(e.start.dateTime).getTime() <= now).map((e) => { const a = new Date(e.start.dateTime), b = new Date(e.end.dateTime); const st = studentOf(e.summary, stus); return st && { stu: st.id, d: ymd(a), h: Math.round(((b - a) / 36e5) * 100) / 100, time: `${hm(a)}–${hm(b)}`, title: e.summary }; }).filter(Boolean);
  const ign = new Set(p.ign || []); const out = [];
  const seenStu = new Set(ev.map((e) => e.stu));
  for (const s of stus) {
    const mine = ev.filter((e) => e.stu === s.id); const ls = L.lessons({ stu: s.id, from, to, all: true });
    for (const e of mine) {
      const l = ls.find((x) => x.d === e.d);
      if (!l || !(l.h > 0)) out.push({ stu: s.id, d: e.d, kind: 'add', h: e.h, time: e.time, was: null });
      else if (Math.abs(l.h - e.h) > 0.01 || startOf(l.time) !== startOf(e.time)) out.push({ stu: s.id, d: e.d, kind: 'time', h: e.h, time: e.time, was: { h: l.h, time: l.time || '' } });
    }
    if (!seenStu.has(s.id)) continue;            // a student who is not in the calendar at all: no «not found» guesses
    for (const l of ls) if (l.h > 0 && l.d < t && !mine.some((e) => e.d === l.d)) out.push({ stu: s.id, d: l.d, kind: 'gone', h: 0, time: '', was: { h: l.h, time: l.time || '' } });
  }
  return out.map((x) => ({ ...x, key: `${x.stu}|${x.d}|${x.kind}|${x.h}|${x.time}` })).filter((x) => !ign.has(x.key)).sort((a, b) => (a.d < b.d ? -1 : 1));
}
/** accept: the lesson of that day takes the calendar's hours / time (or «did not happen») */
export async function apply(x) {
  await store.put(L.LSP, `lx:${x.stu}:${x.d}`, { type: 'lx', stu: x.stu, d: x.d, h: x.h, time: x.time || null });
}
export async function ignore(x) { const p = pref(); await setPref({ ign: [...(p.ign || []), x.key].slice(-400) }); }
