// Κατοικίδιο: βιβλιάριο υγείας — συμβάντα (pevent: επισκέψεις, εμβόλια, περιστατικά, ζυγίσματα…), έγγραφα (pdoc), στοιχεία & πρόγραμμα φροντίδας (pprofile).
// Όλα στον κοινό χώρο. Κανένα στοιχείο του ζώου μέσα στον κώδικα: όνομα, ιστορικό και πρόγραμμα έρχονται από τα δεδομένα (εισαγωγή .json ή καταχώριση).
// Τα αρχεία (PDF, φωτογραφίες) πάνε στο OneDrive, στον φάκελο «<κοινός φάκελος>/Υγεία <όνομα>».
import * as store from './store.js';
import { provider } from './sync.js';
import { parseISO, today, addMonths } from './util.js';
import * as C from './chores.js';

export const SP = 'shared';
export const KINDS = ['Επίσκεψη', 'Εμβόλιο', 'Περιστατικό', 'Ζύγισμα', 'Εξέταση', 'Επέμβαση', 'Αποπαρασίτωση', 'Αδένες', 'Περιποίηση'];
export const TONE = { Περιστατικό: 'red', Εμβόλιο: 'teal', Αποπαρασίτωση: 'teal', Επέμβαση: 'amber' };
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
export function num(v) { v = String(v ?? '').trim().replace(',', '.'); const n = parseFloat(v); return isNaN(n) ? null : n; }

// ---- data ----
const byD = (a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
export const profile = () => store.records('pprofile', [SP])[0] || {};
export const name = () => profile().name || 'Κατοικίδιο';
export const events = () => store.records('pevent', [SP]).sort(byD);
export const docs = () => store.records('pdoc', [SP]).sort(byD);
export const hasData = () => events().length > 0 || !!profile().name;
export const docDir = () => `Υγεία ${name()}`;
/** text of an event used by search and by the care schedule */
export const evText = (e) => [e.kind, e.title, e.text, (e.vacc || []).join(' '), (e.meds || []).join(' '), e.vet, e.sev].filter(Boolean).join(' ');
export const weights = () => events().filter((e) => e.w != null).map((e) => ({ d: e.d, w: Number(e.w) })).sort((a, b) => (a.d < b.d ? -1 : 1));
/** every medicine ever given: {name, e} newest first */
export const meds = () => events().flatMap((e) => (e.meds || []).map((m) => ({ name: m, e })));
export const vaccEvents = () => events().filter((e) => e.vacc?.length || e.kind === 'Εμβόλιο');

// ---- care schedule (from the profile: [{t, every (months), kind?, kw?}]) → last time done & next due ----
export function matches(s, e) {
  if (s.kind && e.kind !== s.kind && !(s.kind === 'Αδένες' && e.glands)) return false;
  if (s.kw) { const t = norm(evText(e) + (e.glands ? ' αδενες' : '')); return norm(s.kw).split('|').some((k) => k && t.includes(k)); }
  if (s.kind === 'Ζύγισμα') return e.w != null;
  return true;
}
export function schedule() {
  const t = today(), ev = events();
  return (profile().schedule || []).map((s, i) => {
    const last = ev.find((e) => matches(s, e))?.d || null;
    const due = last && s.every ? addMonths(last, Number(s.every)) : null;
    return { ...s, i, last, due, st: !last ? 'none' : due && due < t ? 'late' : due && due <= addMonths(t, 1) ? 'due' : 'ok' };
  });
}
/** recurring tasks (Εργασίες) whose group is the pet's name — they carry the email reminders */
export const chores = () => { const n = norm(name()); return C.all().filter((c) => c.grp && norm(c.grp) === n); };

// ---- age ----
export function ageTxt(s = today()) {
  const b = profile().birth; if (!b) return '';
  const B = parseISO(b), d = parseISO(s); let m = (d.getFullYear() - B.getFullYear()) * 12 + d.getMonth() - B.getMonth(); if (d.getDate() < B.getDate()) m--;
  if (m < 0) return ''; const y = Math.floor(m / 12), mm = m % 12;
  return y ? `${y} ${y === 1 ? 'έτους' : 'ετών'}${mm ? ` ${mm} μ.` : ''}` : `${mm} μηνών`;
}
/** x for charts: months since birth (or since the first point) */
export const monthsAt = (s, base) => (parseISO(s) - parseISO(profile().birth || base)) / (864e5 * 30.4375);

// ---- quick-search chips from the data ----
export function quick(n = 12) {
  const cnt = new Map(); const add = (l, d) => { l = String(l || '').trim(); const k = norm(l); if (k.length < 3) return; const x = cnt.get(k) || { l, c: 0, d: '' }; x.c++; if (d > x.d) x.d = d; cnt.set(k, x); };
  for (const e of events()) {
    if (e.kind && !['Επίσκεψη', 'Ζύγισμα'].includes(e.kind)) add(e.kind, e.d);
    for (const m of e.meds || []) { const w = String(m).split(/[\s,(]+/)[0]; if (/^[\p{L}-]{3,}$/u.test(w)) add(w, e.d); }
    for (const v of e.vacc || []) add(String(v).split(/[\s(]+/)[0], e.d);
  }
  return [...cnt.values()].sort((a, b) => b.c - a.c || (a.d < b.d ? 1 : -1)).slice(0, n).map((x) => x.l);
}

// ---- import of a history file (.json — never part of the app's code) ----
const TYPES = ['pevent', 'pdoc', 'pprofile'];
export async function importFile(file) {
  const j = JSON.parse(await file.text());
  const recs = (j.records || []).filter((r) => r && r.id && TYPES.includes(r.type));
  if (j.splinefy !== 'pet' || !recs.length) throw new Error('Δεν είναι αρχείο ιστορικού κατοικιδίου.');
  await store.putMany(SP, recs.map(({ id, ...set }) => ({ id, set })));        // fixed ids: importing twice does not duplicate
  return recs.length;
}

// ---- files on OneDrive ----
async function dir() { const P = provider(); return { P, f: await P.folder(store.spaceById(SP).folder + '/' + docDir()) }; }
const cache = new Map();
export async function fileOf(doc) {
  if (!doc.file) return null;
  if (cache.has(doc.file)) return cache.get(doc.file);
  const { P, f } = await dir(); const b = await P.getBin(f, doc.file);
  if (b) cache.set(doc.file, b.type ? b : new Blob([b], { type: doc.mime || 'application/pdf' }));
  return cache.get(doc.file) || null;
}
export async function upload(file, d, title, keep = null) {
  const ext = (file.name.match(/\.\w+$/) || [''])[0].toLowerCase();
  if (keep && keep.toLowerCase().endsWith(ext)) { const { P, f } = await dir(); await P.putBin(f, keep, file); cache.set(keep, file); return keep; }
  const safe = String(title || file.name).replace(/[\\/:*?"<>|#%]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const nm = `${d} ${safe}${ext && !safe.toLowerCase().endsWith(ext) ? ext : ''}`;
  const { P, f } = await dir(); await P.putBin(f, nm, file); cache.set(nm, file);
  return nm;
}
