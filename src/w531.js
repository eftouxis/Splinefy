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
// γενικό ζέσταμα (8–10′) πριν τις μπάρες — Α: squat/bench, Β: deadlift/press
export const WARMUP = [
  [['Κωπηλατική ή ποδήλατο', "3′ χαλαρά, να ζεσταθείς"], ['World’s greatest stretch', '3 ανά πλευρά, αργά'], ['Goblet squat με ελαφρύ kettlebell', '2 × 8, κάθεσαι βαθιά και μένεις 2″ κάτω'],
    ['Αστράγαλος: ankle rocks', '10 ανά πλευρά — ΜΟΝΟ αν δεν πονάει· αλλιώς παράλειψη'], ['Band pull-aparts', '2 × 15'], ['Push-ups', '10, αργά και ελεγχόμενα'], ['PVC pass-throughs', '10']],
  [['Κωπηλατική ή ποδήλατο', "3′ χαλαρά"], ['Cat–cow', '8 αργές'], ['Glute bridge', '2 × 10, σφίγγεις 2″ πάνω'], ['Good mornings με κοντάρι / άδεια μπάρα', '10'],
    ['Inchworm', '5'], ['Band pull-aparts', '2 × 15'], ['PVC pass-throughs', '10']],
];
// πώς γίνεται κάθε άσκηση (σύντομα)
export const CUES = {
  sq: ['Μπάρα πάνω στους τραπεζοειδείς, φαρδύ πιάσιμο, αγκώνες κάτω', 'Βαθιά ανάσα, σφίξε κοιλιά πριν κατέβεις', 'Γόνατα προς τα δάχτυλα, φτέρνες κάτω', 'Κατεβαίνεις μέχρι ο γοφός να φτάσει τα γόνατα ή λίγο πιο κάτω, ανεβαίνεις δυνατά'],
  bp: ['Ωμοπλάτες πίσω-κάτω και κολλημένες στον πάγκο, πόδια σταθερά στο πάτωμα', 'Πιάσιμο λίγο πιο φαρδύ από τους ώμους, καρποί ίσιοι', 'Κατεβάζεις ελεγχόμενα στο κάτω στήθος, αγκώνες ~45°', 'Σπρώχνεις πάνω και λίγο προς το πρόσωπο · με βαριά σετ, κάποιος να σε φυλάει (spotter)'],
  dl: ['Μπάρα πάνω από τη μέση του πέλματος, πόδια στο πλάτος των γοφών', 'Σκύβεις και πιάνεις, γοφοί πίσω, πλάτη ίσια, στήθος πάνω', '«Σπρώχνεις το πάτωμα» με τα πόδια, η μπάρα ακουμπάει τα πόδια', 'Κάθε επανάληψη ξεκινάει από κάτω — όχι αναπήδηση'],
  ohp: ['Όρθιος, πιάσιμο στο πλάτος των ώμων, μπάρα στο πάνω στήθος', 'Σφίξε γλουτούς και κοιλιά — χωρίς βοήθεια από τα πόδια', 'Το κεφάλι πάει λίγο πίσω για να περάσει η μπάρα, μετά μπροστά', 'Κλειδώνεις πάνω με την μπάρα πάνω από το κεφάλι'],
};
export const REST = 'Ξεκούραση: ζέσταμα με μπάρα 1′ · κύρια σετ 2–3′ · έξτρα όγκος 90″';
// βοηθητικές: μονόζυγο κάθε φορά για την πλάτη — [όνομα, σετ/επαν., πώς]
export const ACC = [
  [['Strict pull-ups', '5 σετ × όσες βγαίνουν καθαρά, αφήνοντας 1–2 στην άκρη', 'Από πλήρες κρέμασμα, χωρίς κούνημα, πηγούνι πάνω από τη μπάρα. Αν βγαίνουν κάτω από 3, με λάστιχο.'],
    ['Hanging knee raises', '3 × 10', 'Κρέμεσαι, φέρνεις τα γόνατα στο στήθος αργά, χωρίς φόρα.']],
  [['Pull-ups — αρνητικές', '4 × 3', 'Ανεβαίνεις με άλμα ή κουτί και κατεβαίνεις όσο πιο αργά μπορείς (4–5″).'],
    ['Dumbbell row', '4 × 8–10 ανά χέρι', 'Χέρι και γόνατο στον πάγκο, πλάτη ίσια, τραβάς τον αλτήρα προς το γοφό.'],
    ['Plank', '3 × 40″', 'Σώμα ίσιο από κεφάλι ως φτέρνες, σφιχτή κοιλιά και γλουτοί.']],
];
export const COOL = 'Αποθεραπεία 5′: χαλαρό περπάτημα και διατάσεις σε γοφούς, οπίσθιους μηριαίους, στήθος, πλάτη.';

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
export async function finish(res, opt = {}) {
  const c = cfg(); const s = session(c); const p = plan(c); const tm = { ...c.tm }; const changes = [];
  const d = opt.d || today();
  for (const x of p) {
    const r = res[x.lift] || {}; const top = x.main[2]; const reps = Number(r.reps);
    const done = x.main.map((m, i) => Number(r.w?.[i]) || m.w); const tw = done[2];
    await store.put(sp(), null, { type: 'w531log', d, lift: x.lift, cycle: s.cycle, wk: s.wk, w: tw, plan: top.w, sets: done, target: top.r, reps: Number.isFinite(reps) ? reps : null, feel: r.feel || null, e1rm: Number.isFinite(reps) && reps > 0 ? e1rm(tw, reps) : null });
    const lighter = tw < top.w - 0.01;
    if (r.feel !== 'pain' && ((Number.isFinite(reps) && reps < top.r) || lighter)) { tm[x.lift] = round(tm[x.lift] * 0.9); changes.push(`${LIFTS[x.lift]}: ${kg(c.tm[x.lift])} → ${kg(tm[x.lift])} (${lighter ? 'πιο ελαφριά από το πρόγραμμα' : `λιγότερες από ${top.r}`})`); }
  }
  // και στις Προπονήσεις
  const fk = (x) => String(x).replace('.', ',');
  await store.put(sp(), null, { type: 'gwod', d, title: `💪 5/3/1 · Μέρα ${s.dayName} (${WEEKS[s.wk].name})`, fmt: 'other', src: '531',
    str: p.map((x) => { const r = res[x.lift] || {}; const dn = x.main.map((m, i) => Number(r.w?.[i]) || m.w); return `${LIFTS[x.lift]}: ${dn.map(fk).join(' / ')} kg × ${x.main.map((m, i) => (i === 2 ? (r.reps ?? '—') : m.r)).join(', ')} · ${x.fsl.sets}×${x.fsl.reps} με ${fk(Number(r.fw) || x.fsl.w)}`; }).join('\n')
      + (opt.acc && opt.acc.length ? '\n' + opt.acc.map(([n, v]) => `${n}: ${v}`).join('\n') : ''),
    strRes: p.map((x) => { const r = res[x.lift] || {}; return `${LIFTS[x.lift]} ${fk(Number(r.w?.[2]) || x.main[2].w)}×${r.reps ?? '—'}`; }).join(' · '),
    notes: [p.map((x) => { const f = FEEL.find((y) => y[0] === res[x.lift]?.feel); return f ? `${LIFTS[x.lift]}: ${f[1]}` : ''; }).filter(Boolean).join(' · '), opt.note || ''].filter(Boolean).join('\n') || null });
  let step = s.step + 1, cycle = c.cycle || 1;
  if (step % 6 === 0) {                                            // τέλος κύκλου
    for (const l of Object.keys(LIFTS)) {
      const last = logs().find((g) => g.lift === l && g.cycle === cycle && g.wk === 2);
      if (!last || last.feel === 'pain' || last.feel === 'hard' || last.reps == null || last.reps < 1) continue;
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
