// Φάρμακα (Αγωγές) — three ways:
//   every: every N hours, in phases (2 days every 4 h, then 2 days every 6 h); the next dose counts from when the previous one was really given
//   times: at set times of the day (08:00 · 14:00 · 20:00), every day or on chosen weekdays (Δευ/Τετ/Παρ), for N days / weeks / months,
//          until a date, or with no end (e.g. a thyroid pill); a missed dose stays missed, the next keeps its time
// No names in the code: «for whom» comes from the users, the booklets (child / pet) and the medicines already entered.
// ✓ = given (optional per medicine: «track»). Notification at the time of each dose (remind.js → Apps Script: email or phone via Google Calendar).
import * as store from './store.js';
import { addDays, addMonths } from './util.js';

const H = 36e5;
export const pad = (n) => String(n).padStart(2, '0');
export const local = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const ms = (s) => new Date(s).getTime();
export const all = () => store.records('med').sort((a, b) => (a.start < b.start ? 1 : -1));
export const DEF_TIMES = { 1: ['09:00'], 2: ['08:00', '20:00'], 3: ['08:00', '14:00', '20:00'], 4: ['08:00', '12:00', '16:00', '20:00'], 5: ['08:00', '11:00', '14:00', '17:00', '20:00'], 6: ['06:00', '10:00', '14:00', '18:00', '22:00', '02:00'] };
export const LEADS = [[0, 'Στην ώρα της δόσης'], [5, '5 λεπτά πριν'], [10, '10 λεπτά πριν'], [15, '15 λεπτά πριν'], [30, '30 λεπτά πριν'], [60, '1 ώρα πριν'], [120, '2 ώρες πριν']];   // + «Άλλο…» (any minutes / hours)
export const DUR_U = [['d', 'μέρες'], ['w', 'εβδομάδες'], ['m', 'μήνες']];
export const WD = [[1, 'Δευ'], [2, 'Τρί'], [3, 'Τετ'], [4, 'Πέμ'], [5, 'Παρ'], [6, 'Σάβ'], [0, 'Κυρ']];
/** last day (inclusive, yyyy-mm-dd) of a «times» medicine, or null = no end */
export function lastDay(m) {
  if (m.until) return m.until;
  if (!m.durN || !m.start) return null;
  const lt = (m.times || []).filter(Boolean).sort().pop();       // started after the day's last time: the days count from tomorrow
  const d0 = lt && m.start.slice(11, 16) > lt ? addDays(m.start.slice(0, 10), 1) : m.start.slice(0, 10), n = Number(m.durN);
  return addDays(m.durU === 'm' ? addMonths(d0, n) : addDays(d0, m.durU === 'w' ? 7 * n : n), -1);
}
const isTimes = (m) => m.mode === 'times';
/** every dose: [{k, at (ms), given (ms|null), h, phase, missed}] — for open-ended medicines up to a few days ahead */
export function doses(m, horizon = Date.now() + 10 * 24 * H) {
  if (isTimes(m)) {
    const times = (m.times || []).filter(Boolean).slice().sort(); if (!m.start || !times.length) return [];
    const last = lastDay(m); const wd = (m.wd || []).map(Number); const st = ms(m.start) - 60000; const tk = m.taken || {}; const tf = m.trackFrom ? ms(m.trackFrom) : 0;
    const out = []; let d = m.start.slice(0, 10);
    for (let i = 0; i < 4000; i++) {
      if (last && d > last) break;
      const day = new Date(d + 'T12:00'); if (!last && day.getTime() > horizon) break;
      if (!wd.length || wd.includes(day.getDay())) for (const t of times) { const at = ms(`${d}T${t}`); if (at >= st && (at >= tf || tk[local(at)])) out.push({ k: out.length, at, given: tk[local(at)] ? ms(tk[local(at)]) : null, h: 0, phase: 0 }); }
      d = addDays(d, 1);
    }
    const now = Date.now(); let lp = -1; out.forEach((x, i) => { if (x.at <= now) lp = i; });
    out.forEach((x, i) => { x.missed = x.given == null && i < lp; });       // a later dose's time has come: this one was not given
    return out;
  }
  const ph = (m.phases || []).filter((p) => Number(p.days) > 0 && Number(p.h) > 0); if (!m.start || !ph.length) return [];
  const bounds = []; let e = ms(m.start); for (const p of ph) { e += Number(p.days) * 24 * H; bounds.push(e); }
  const given = (m.given || []).map(ms).sort((a, b) => a - b);
  const out = []; let t = ms(m.start);
  for (let k = 0; k < 500; k++) {
    const pi = bounds.findIndex((b) => t < b - 60000); if (pi < 0) break;              // past the end of the last phase
    const g = given[k] ?? null; const h = Number(ph[pi].h);
    out.push({ k, at: t, given: g, h, phase: pi });
    t = (g ?? t) + h * H;
  }
  for (let k = out.length; k < given.length; k++) out.push({ k, at: given[k], given: given[k], h: 0, phase: -1 });   // extra doses given
  return out;
}
export const endOf = (m) => { if (isTimes(m)) { const l = lastDay(m); return l ? ms(`${l}T23:59`) : Infinity; } let e = ms(m.start || 0); for (const p of m.phases || []) e += Number(p.days || 0) * 24 * H; return e; };
export const tracked = (m) => m.track !== false;
export function status(m, now = Date.now()) {
  const ds = doses(m);
  let next;
  if (!tracked(m)) next = ds.find((d) => d.at >= now - 30 * 60000) || null;
  else next = ds.find((d) => d.given == null && !d.missed) || null;
  const over = !!m.stopped || !next || (isTimes(m) && next.at < now - 24 * H);
  const open = isTimes(m) && !lastDay(m);
  return { ds, next, done: ds.filter((d) => d.given != null).length + (m.takenOld || 0), missed: ds.filter((d) => d.missed).length, total: open ? null : ds.length, over, open };
}
export const active = () => all().filter((m) => !status(m).over);
export async function give(m, when = Date.now()) {
  if (isTimes(m)) {
    const nx = status(m).next; if (!nx) return;
    const tk = { ...(m.taken || {}), [local(nx.at)]: local(when) }; let old = m.takenOld || 0;
    const cut = local(Date.now() - 45 * 24 * H);                                     // keep the record small: older ones only as a count
    for (const k of Object.keys(tk)) if (k < cut) { delete tk[k]; old++; }
    await store.put(m._sp, m.id, { taken: tk, takenOld: old || null }); return;
  }
  await store.put(m._sp, m.id, { given: [...(m.given || []), local(when)].sort() });
}
/** home: the doses whose time has come (or comes within the hour) and are not ticked — like the Εργασίες.
 *  A medicine without ✓ (track off) shows only today's; ticking it turns ✓ on from that dose. */
export function pending(now = Date.now()) {
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  return all().filter((m) => !m.stopped).flatMap((m) => doses(m).filter((d) => d.given == null && !d.missed && d.at <= now + H && (tracked(m) || d.at >= d0.getTime())).map((d) => ({ m, d })))
    .sort((a, b) => a.d.at - b.d.at);
}
/** ✓ for one dose (from the home page) */
export async function giveDose(m, at, when = Date.now()) {
  const on = tracked(m) ? {} : { track: true, trackFrom: local(at) };
  if (!isTimes(m)) { await store.put(m._sp, m.id, { ...on, given: [...(m.given || []), local(when)].sort() }); return; }
  await store.put(m._sp, m.id, { ...on, taken: { ...(m.taken || {}), [local(at)]: local(when) } });
}
export async function ungive(m) {
  if (isTimes(m)) { const tk = { ...(m.taken || {}) }; const last = Object.entries(tk).sort((a, b) => (a[1] < b[1] ? 1 : -1))[0]; if (last) delete tk[last[0]]; await store.put(m._sp, m.id, { taken: tk }); return; }
  const g = (m.given || []).slice().sort(); g.pop(); await store.put(m._sp, m.id, { given: g });
}
export const phaseTxt = (p) => `${String(p.days).replace('.', ',')} ${Number(p.days) === 1 ? 'μέρα' : 'μέρες'} κάθε ${String(p.h).replace('.', ',')} ώρες`;
export const hm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const DAYS = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'];
const dmy = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
export const when = (t) => { const d = new Date(t), n = new Date(); const same = d.toDateString() === n.toDateString(); const tm = new Date(n); tm.setDate(n.getDate() + 1);
  return same ? `σήμερα ${hm(t)}` : d.toDateString() === tm.toDateString() ? `αύριο ${hm(t)}` : `${DAYS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hm(t)}`; };
export const inTxt = (t) => { const m = Math.round((t - Date.now()) / 60000); if (m < -1) return `καθυστέρηση ${m > -60 ? -m + "'" : Math.floor(-m / 60) + ' ώρ. ' + (-m % 60) + "'"}`; if (m <= 1) return 'τώρα'; return m < 60 ? `σε ${m}'` : m < 24 * 60 ? `σε ${Math.floor(m / 60)} ώρ. ${m % 60 ? (m % 60) + "'" : ''}` : `σε ${Math.round(m / 1440)} μέρες`; };
/** «3 φορές την ημέρα (08:00 · 14:00 · 20:00) · έως 16/11/2026» */
export function schedTxt(m) {
  if (!isTimes(m)) return (m.phases || []).map(phaseTxt).join(', μετά ');
  const t = (m.times || []).slice().sort(); const wd = (m.wd || []).map(Number); const l = lastDay(m);
  const per = wd.length ? `${t.length > 1 ? t.length + ' φορές' : '1 φορά'} · ${WD.filter(([v]) => wd.includes(v)).map((x) => x[1]).join('/')}` : t.length === 1 ? '1 φορά την ημέρα' : `${t.length} φορές την ημέρα`;
  return `${per} (${t.join(' · ')})${l ? ` · έως ${dmy(l)}` : ' · συνεχίζεται'}`;
}
export const notifyTxt = (m) => (!(m.mailTo || []).length ? '' : `${m.ch === 'cal' ? '🔔' : '📧'} ${(m.mailTo || []).length > 1 ? 'και οι δύο' : m.mailTo[0]}`);

// ---- from a prescription / the doctor's note (pasted from an e-prescription page, or typed) ----
const cap = (s) => (s === s.toUpperCase() && /[A-ZΑ-Ω]/.test(s) ? s.charAt(0) + s.slice(1).toLowerCase() : s);
const UNIT = (w) => (/^μ[ηή]ν/.test(w) ? 'm' : /^εβδ/.test(w) ? 'w' : 'd');
/** one line (or «|»-separated part) per medicine: «DEPON OR.SO 120MG/5ML 3 φορές την ημέρα x 5 ημέρες | …»,
 *  «Βιταμίνη D 1 ml Χ 1 για 3 μήνες» → [{name, form, dose, perDay, durN, durU, notes, rx}] */
export function parseRx(text) {
  const out = []; let rx = null;
  for (const ln of String(text || '').split('\n')) for (const raw of ln.split('|')) {
    const r = raw.match(/Συνταγή\s*(\d{6,})/i); if (r) rx = r[1];
    const s = raw.replace(/\[?Συνταγή\s*\d{6,}\]?(\([^)]*\))?/gi, '').trim(); if (!s) continue; let perDay = null, durN = null, durU = 'd', notes = '';
    let f = s.match(/(\d+)\s*φορ(?:ές|ες|ά|α)\s*(?:την|τη)?\s*(?:ημέρα|μέρα|ημερησίως)/i);
    let cut = f ? f.index : -1;
    if (f) perDay = Number(f[1]);
    else { f = s.match(/(?:^|\s)[xχΧ×]\s*(\d+)(?![\d.,]|\s*(?:ημέρ|μέρ|εβδ|μήν|μην))/i); if (f) { perDay = Number(f[1]); cut = f.index; } }
    const du = s.match(/(?:(?:^|\s)[xχΧ×]|για)\s*(\d+)\s*(ημέρ\S*|μέρ\S*|εβδομ\S*|μήν\S*|μην\S*)/i);
    if (du) { durN = Number(du[1]); durU = UNIT(du[2].toLowerCase()); notes = s.slice(du.index + du[0].length).replace(/^[\s,.;:-]+/, '').trim(); if (cut < 0 || du.index < cut) cut = du.index; }
    if (!perDay && !durN) continue;                                                     // not a medicine line
    const head = (cut >= 0 ? s.slice(0, cut) : s).trim();
    const dm = head.match(/(\d+(?:[.,]\d+)?\s*(?:ml|mg|gr|g|σταγόνες|ψεκασμ\S*|εισπνο\S*|δισκ\S*|κάψ\S*|scoop\S*))\s*$/i);
    const dose = dm ? dm[1].replace('.', ',') : null; const h2 = dm ? head.slice(0, dm.index).trim() : head;
    const words = h2.split(/\s+/); let i = 0; const nm = [];
    for (; i < words.length; i++) { if (i > 0 && /[\d.\/]/.test(words[i])) break; nm.push(words[i]); }
    out.push({ name: cap(nm.join(' ')) || h2, form: words.slice(i).join(' ') || null, dose, perDay: perDay || 1, durN, durU, notes: notes || null, rx });
  }
  return out;
}
/** a «times» medicine starting at `from` (first dose the first set time from then on) */
export function fromRx(p, who, from = Date.now()) {
  return { name: p.name, form: p.form, who, dose: p.dose, mode: 'times', times: DEF_TIMES[Math.min(6, p.perDay)] || DEF_TIMES[1], wd: [], start: local(from), durN: p.durN, durU: p.durU, until: null, notes: p.notes, rx: p.rx, track: true };
}
