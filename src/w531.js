// 5/3/1 μία φορά την εβδομάδα: Μέρα Α (Squat + Bench) / Μέρα Β (Deadlift + Press) εναλλάξ — 6 προπονήσεις ο κύκλος.
// Τα κιλά (μέγιστα, training max) είναι δεδομένα στον προσωπικό χώρο, όχι στον κώδικα.
import * as store from './store.js';
import { today } from './util.js';
import { space } from './gym.js';

export const LIFTS = { sq: 'Back squat', bp: 'Bench press', dl: 'Deadlift', ohp: 'Strict press' };
export const UPPER = new Set(['bp', 'ohp']);
export const DAYS = [['sq', 'bp'], ['dl', 'ohp']];
export const WEEKS = [
  { name: '5άρια', sets: [[0.65, 5], [0.75, 5], [0.85, 5]] },
  { name: '3άρια', sets: [[0.7, 3], [0.8, 3], [0.9, 3]] },
  { name: '5 · 3 · 1', sets: [[0.75, 5], [0.85, 3], [0.95, 1]] },
];
const WARM = [[0.4, 5], [0.5, 5], [0.6, 3]];
export const START_PCT = 0.85;          // training max = 85% του μέγιστου (ξεκίνημα μετά από διάλειμμα)
export const FEEL = [['easy', '😀 Εύκολο'], ['ok', '🙂 Οκ'], ['hard', '😓 Βαρύ'], ['pain', '🤕 Πόνος']];
// βοηθητικές: μονόζυγο κάθε φορά για την πλάτη
export const ACC = [
  [['Strict pull-ups', '5 σετ × όσες βγαίνουν καθαρά, αφήνοντας 1–2 στην άκρη (με λάστιχο αν χρειάζεται)'], ['Hanging knee raises', '3 × 10']],
  [['Strict pull-ups — αρνητικές', '4 × 3, κατέβασμα σε 4–5″'], ['Dumbbell row', '4 × 8–10 ανά χέρι'], ['Plank', '3 × 40″']],
];

const sp = () => space();
export const cfg = () => store.records('w531', [sp()]).find((r) => r.id === 'w531') || null;
export const logs = () => store.records('w531log', [sp()]).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (b._m || '').localeCompare(a._m || '')));
export const round = (kg) => Math.max(20, Math.round(kg / 2.5) * 2.5);
export const kg = (x) => `${String(Math.round(x * 100) / 100).replace('.', ',')} kg`;
/** δίσκοι ανά πλευρά (μπάρα 20 kg) */
export function plates(w) {
  let side = Math.max(0, (w - 20) / 2); const out = [];
  for (const p of [25, 20, 15, 10, 5, 2.5, 1.25]) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return out;
}
export const e1rm = (w, r) => Math.round(w * (1 + r / 30) * 10) / 10;

export function session(c = cfg()) {
  const step = c?.step || 0;
  return { step, n: (step % 6) + 1, day: DAYS[step % 2], dayName: step % 2 ? 'Β' : 'Α', wk: Math.floor((step % 6) / 2), cycle: c?.cycle || 1 };
}
export function plan(c = cfg()) {
  const s = session(c);
  return s.day.map((l) => {
    const tm = c.tm[l];
    return {
      lift: l, tm,
      warm: WARM.map(([p, r]) => ({ w: round(tm * p), r })),
      main: WEEKS[s.wk].sets.map(([p, r], i) => ({ w: round(tm * p), r, plus: i === 2, p })),
      fsl: { w: round(tm * WEEKS[s.wk].sets[0][0]), sets: 3, reps: 5 },
    };
  });
}
export async function setup(orm) {
  const tm = {}; for (const l of Object.keys(LIFTS)) tm[l] = round(orm[l] * START_PCT);
  await store.put(sp(), 'w531', { type: 'w531', orm, tm, step: 0, cycle: 1, start: today() });
}
export async function setTM(tm) { const c = cfg(); await store.put(sp(), 'w531', { ...strip(c), tm }); }
const strip = (r) => { const o = { ...r }; delete o._sp; delete o._m; delete o.id; return o; };

/**
 * Τέλος προπόνησης. res: { lift: { reps, feel } }. Επιστρέφει τις αλλαγές στα κιλά (για μήνυμα).
 * Κανόνες: κάτω από τις ελάχιστες στο τελευταίο σετ → training max −10% · στο τέλος του κύκλου +2,5 (πάνω κορμός) / +5 (κάτω),
 * +διπλό αν ήταν «εύκολο» με 4+ παραπάνω επαναλήψεις · με «πόνο» δεν ανεβαίνει.
 */
export async function finish(res) {
  const c = cfg(); const s = session(c); const p = plan(c); const tm = { ...c.tm }; const changes = [];
  const d = today();
  for (const x of p) {
    const r = res[x.lift] || {}; const top = x.main[2]; const reps = Number(r.reps);
    await store.put(sp(), null, { type: 'w531log', d, lift: x.lift, cycle: s.cycle, wk: s.wk, w: top.w, target: top.r, reps: Number.isFinite(reps) ? reps : null, feel: r.feel || null, e1rm: Number.isFinite(reps) && reps > 0 ? e1rm(top.w, reps) : null });
    if (Number.isFinite(reps) && reps < top.r && r.feel !== 'pain') { tm[x.lift] = round(tm[x.lift] * 0.9); changes.push(`${LIFTS[x.lift]}: ${kg(c.tm[x.lift])} → ${kg(tm[x.lift])} (λιγότερες από ${top.r})`); }
  }
  let step = s.step + 1, cycle = c.cycle || 1;
  if (step % 6 === 0) {                                            // τέλος κύκλου
    for (const l of Object.keys(LIFTS)) {
      const last = logs().find((g) => g.lift === l && g.cycle === cycle && g.wk === 2);
      if (!last || last.feel === 'pain' || last.reps == null || last.reps < 1) continue;
      if (tm[l] !== c.tm[l]) continue;                             // μόλις μειώθηκε
      let inc = UPPER.has(l) ? 2.5 : 5; if (last.feel === 'easy' && last.reps >= 5) inc *= 2;
      tm[l] = round(tm[l] + inc); changes.push(`${LIFTS[l]}: +${kg(inc)} → ${kg(tm[l])}`);
    }
    cycle += 1;
  }
  await store.put(sp(), 'w531', { ...strip(c), tm, step, cycle });
  return changes;
}
export async function skip() { const c = cfg(); await store.put(sp(), 'w531', { ...strip(c), step: (c.step || 0) + 1 }); }
