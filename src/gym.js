// Γυμναστική: προπονήσεις (strength + WOD με αποτέλεσμα) και ρεκόρ (κιλά / χρόνοι / επαναλήψεις).
// Όλα στον προσωπικό χώρο του καθενός (δεν φτάνουν στη συσκευή του άλλου)· χωρίς προσωπικό χώρο → στον κοινό.
import * as store from './store.js';
import { norm } from './util.js';

export const space = () => store.state.spaces.find((s) => s.owner === store.state.user && s.members.length === 1)?.id || 'shared';
const mine = () => [space()];

// ---- μορφές WOD ----
export const FMT = [['amrap', 'AMRAP'], ['time', 'For time'], ['emom', 'EMOM'], ['other', 'Άλλο']];
export const fmtName = (f) => (FMT.find((x) => x[0] === f) || [null, ''])[1];

// ---- χρόνος mm:ss ⇄ δευτερόλεπτα ----
export const toSec = (s) => {
  const t = String(s || '').trim().replace(',', '.'); if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 60);                      // σκέτος αριθμός = λεπτά
  const p = t.split(/[:.΄']/).map((x) => Number(x)); if (p.some((x) => isNaN(x))) return null;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + (p[1] || 0);
};
export const mmss = (sec) => { if (sec == null) return ''; const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; const p = (n) => String(n).padStart(2, '0'); return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`; };

// ---- προπονήσεις ----
export const workouts = () => store.records('gwod', mine()).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (b._m || '').localeCompare(a._m || '')));
export function result(w) {
  let r = '';
  if (w.fmt === 'amrap' && (w.rr != null || w.rp != null)) r = `${w.rr || 0} ${Number(w.rr) === 1 ? 'γύρος' : 'γύροι'}${w.rp ? ` + ${w.rp}` : ''}`;
  else if (w.fmt === 'time' && w.tm != null) r = mmss(w.tm);
  else if (w.rt) r = w.rt;
  if (r && w.fmt === 'time' && w.capped) r += ' (cap)';
  return r ? `${r}${w.rx ? ` · ${w.rx === 'rx' ? 'Rx' : 'Scaled'}` : ''}` : '';
}
export const head = (w) => w.title || (w.fmt ? `${fmtName(w.fmt)}${w.cap ? ` ${w.cap}'` : ''}` : 'Προπόνηση');
const key = (s) => norm(s).replace(/ς/g, 'σ').replace(/[^a-z0-9α-ω]+/g, '');
/** η ίδια προπόνηση παλιότερα (ίδιο όνομα ή ίδιο κείμενο WOD) */
export const same = (w) => {
  const kt = w.title ? key(w.title) : '', kw = w.wod ? key(w.wod) : '';
  return workouts().filter((x) => x.id !== w.id && x.d <= (w.d || '9999') && ((kt && key(x.title || '') === kt) || (kw.length > 12 && key(x.wod || '') === kw)));
};
/** σύγκριση αποτελεσμάτων: >0 = καλύτερο */
export function better(a, b) {
  if (a.fmt === 'amrap' && b.fmt === 'amrap') return ((a.rr || 0) * 1000 + (a.rp || 0)) - ((b.rr || 0) * 1000 + (b.rp || 0));
  if (a.fmt === 'time' && b.fmt === 'time' && a.tm != null && b.tm != null) return (a.capped ? 1e6 : 0) - (b.capped ? 1e6 : 0) || b.tm - a.tm;
  return 0;
}

// ---- ρεκόρ ----
export const KINDS = [['kg', 'Κιλά'], ['time', 'Χρόνος'], ['reps', 'Επαναλήψεις']];
export const SUGGEST = ['Back squat', 'Front squat', 'Overhead squat', 'Deadlift', 'Clean', 'Power clean', 'Squat clean', 'Clean & jerk', 'Jerk', 'Snatch', 'Power snatch', 'Squat snatch',
  'Strict press', 'Push press', 'Push jerk', 'Bench press', 'Thruster', 'Weighted pull-up', 'Strict pull-ups', 'Pull-ups', 'Muscle-ups', 'Toes to bar', 'Double unders', 'Handstand push-ups',
  'Fran', 'Grace', 'Isabel', 'Helen', 'Diane', 'Elizabeth', 'Cindy', 'Annie', 'Karen', 'Jackie', 'Murph', 'Fight Gone Bad', '1 km row', '2 km row', '500 m row', '5 km run', '1 mile run'];
export const prs = () => store.records('gpr', mine());
export const pkey = (p) => `${key(p.name)}|${p.kind}|${p.kind === 'kg' ? Number(p.reps) || 1 : ''}`;
export const plabel = (p) => `${p.name}${p.kind === 'kg' && (Number(p.reps) || 1) > 1 ? ` · ${p.reps}RM` : p.kind === 'kg' ? ' · 1RM' : ''}`;
export const pval = (p) => (p.kind === 'kg' ? `${String(p.v).replace('.', ',')} kg` : p.kind === 'time' ? mmss(p.v) : `${p.v} επαν.`);
const beats = (a, b) => (a.kind === 'time' ? a.v < b.v : a.v > b.v);
/** ομάδες: ίδια άσκηση + είδος (+ RM) → καλύτερη, όλες οι φορές */
export function groups() {
  const m = new Map();
  for (const p of prs()) { if (p.v == null) continue; const k = pkey(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
  return [...m].map(([k, l]) => { l.sort((a, b) => (a.d < b.d ? 1 : -1)); const best = l.reduce((x, y) => (beats(y, x) ? y : x)); return { k, l, best, last: l[0] }; })
    .sort((a, b) => (a.last.d < b.last.d ? 1 : -1));
}
/** είναι νέο ρεκόρ; (σε σχέση με όσα υπάρχουν, εκτός από τον εαυτό του) */
export function isBest(p) {
  const others = prs().filter((x) => x.id !== p.id && x.v != null && pkey(x) === pkey(p));
  return !others.length ? 'first' : others.every((x) => beats(p, x)) ? 'pr' : '';
}
export const names = () => [...new Set([...prs().map((p) => p.name), ...SUGGEST])];
