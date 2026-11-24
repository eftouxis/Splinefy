// Τρέξιμο: πρόγραμμα ανά εβδομάδα (δεδομένα από εισαγωγή .json — όχι στον κώδικα). Ένα τρέξιμο την εβδομάδα:
// κάθε εβδομάδα του προγράμματος δείχνει τα τρεξίματά της με ένα ⭐ προτεινόμενο· κάνεις ένα και προχωράς.
import * as store from './store.js';
import { today } from './util.js';
import { space } from './gym.js';

const sp = () => space();
export const plan = () => store.records('runplan', [sp()]).find((r) => r.id === 'runplan') || null;
export const prog = () => store.records('runprog', [sp()]).find((r) => r.id === 'runprog') || { wk: 0 };
export const logs = () => store.records('runlog', [sp()]).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (b._m || '').localeCompare(a._m || '')));
export const PAIN = [[0, '0–2', 'Καθόλου / ελάχιστος'], [3, '3–4', 'Λίγος'], [5, '5+', 'Πονάει / κούτσαμα']];
export const FEEL = [['easy', '😀 Άνετο'], ['ok', '🙂 Οκ'], ['hard', '😓 Δύσκολο']];

const minOf = (s) => { let m = 0; const re = /(\d+)'(\d+)''|(\d+)''|(\d+)'/g; let x; while ((x = re.exec(s))) m += x[1] ? Number(x[1]) + Number(x[2]) / 60 : x[3] ? Number(x[3]) / 60 : Number(x[4]); return m; };
const isRun = (s) => /τρεξ|ήρεμο|τρέξιμο/.test(s) && !/περπ(?!ατοτρ)/.test(s.replace(/περπατοτρέξιμο/g, ''));
/** περίπου πόσα λεπτά τρέξιμο έχει μια προπόνηση (για το ⭐) */
export function runMin(t) {
  if (/Αγώνας/.test(t)) return 999;
  let tot = 0;
  for (const part of t.split(/\s+-\s+/)) {
    let n = 0, inner = '', g = part.match(/^(\d+)\*\((.+)\)/);
    if (g) { n = Number(g[1]); inner = g[2]; } else if ((g = part.match(/^\((.+)\)\*(\d+)/))) { n = Number(g[2]); inner = g[1]; }
    if (n) { for (const q of inner.split('+')) if (/τρεξ|τρέξ/.test(q)) tot += n * minOf(q); continue; }
    g = part.match(/^(\d+)\*(\d+)μ/); if (g) { tot += Number(g[1]) * Number(g[2]) / 160; continue; }
    g = part.match(/^(\d+)\*([\d']+'?'?)\s.*τρέξ/); if (g) { tot += Number(g[1]) * minOf(g[2]); continue; }
    if (/περπατοτρέξιμο/.test(part)) tot += minOf(part) * 0.5;
    else if (isRun(part)) tot += part.split('+').filter((p) => /τρεξ|τρέξ|ήρεμο/.test(p)).reduce((s, p) => s + minOf(p), 0);
  }
  return Math.round(tot);
}
export function week(i = prog().wk) {
  const p = plan(); if (!p) return null; const w = p.weeks[Math.min(i, p.weeks.length - 1)];
  const mins = w.s.map(runMin); const best = mins.reduce((b, m, k) => (m >= mins[b] ? k : b), 0);
  return { i, total: p.weeks.length, ...w, mins, best, done: logs().filter((g) => g.wk === i) };
}
async function setWk(wk) { await store.put(sp(), 'runprog', { type: 'runprog', wk: Math.max(0, wk) }); }

/** «Έγινε»: κανόνας πόνου → επόμενη εβδομάδα / ίδια / μία πίσω. Γράφει και στις Προπονήσεις. */
export async function done(k, pain, feel) {
  const w = week(); const text = w.s[k]; const d = today();
  await store.put(sp(), null, { type: 'runlog', d, wk: w.i, k, text, pain, feel, min: w.mins[k] });
  await store.put(sp(), null, { type: 'gwod', d, title: `🏃 Τρέξιμο · εβδ. ${w.w}`, wod: text.split(/\s+-\s+/).join('\n'), fmt: 'other',
    rt: `πόνος ${pain === 0 ? '0–2' : pain === 3 ? '3–4' : '5+'}${feel ? ' · ' + (FEEL.find((f) => f[0] === feel) || ['', ''])[1].split(' ')[1] : ''}`, src: 'run' });
  let to = w.i, msg;
  if (pain >= 5) { to = w.i - 1; msg = 'Μόνο περπάτημα τις επόμενες μέρες · γυρνάμε μία εβδομάδα πίσω'; }
  else if (pain >= 3) { msg = 'Την επόμενη φορά ξανά η ίδια εβδομάδα'; }
  else { to = w.i + 1; msg = to >= w.total ? 'Τέλος προγράμματος 🎉' : `Επόμενη: εβδομάδα ${plan().weeks[to].w}`; }
  if (to !== w.i) await setWk(Math.min(to, w.total - 1));
  return msg;
}
export const go = (wk) => setWk(wk);
