// Έλεγχος υπολοίπου: πόσα θα έπρεπε να έχεις (μετρητά + τράπεζες) σύμφωνα με τις κινήσεις, έναντι όσων έχεις πραγματικά.
// Αφετηρία: ο τελευταίος έλεγχος που «αποδέχτηκες», αλλιώς το αρχικό υπόλοιπο (Ρυθμίσεις). Ποσά λογαριασμών = δεδομένα, όχι κώδικας.
import * as store from './store.js';
import { state } from './store.js';
import { today } from './util.js';
import { movements, fx, othSum } from './ledger.js';
import { startBal, mySpace } from './views/list.js';
import { KINDS } from './people.js';

const SAVE = new Set(['Επενδύσεις', 'Αποταμίευση']);
export const cfg = () => store.records('pref', [mySpace()]).find((r) => r.id === 'recon') || null;
export const checks = () => store.records('recon', [mySpace()]).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (b._m || '').localeCompare(a._m || '')));
export async function setAccts(accts) { await store.put(mySpace(), 'recon', { type: 'pref', accts }); }

/** αφετηρία: { d, a, incl, src } — incl: μετράει και η ίδια η μέρα (αρχικό υπόλοιπο) ή μόνο μετά (έλεγχος στο τέλος της μέρας) */
export function base() {
  const c = checks().find((x) => x.accepted);
  if (c) return { d: c.d, a: c.actual, incl: false, src: 'check' };
  const sb = startBal(); return sb ? { d: sb.d, a: sb.a, incl: true, src: 'start' } : null;
}
/** αναμενόμενο υπόλοιπο και από πού βγαίνει */
export function expected(b = base(), to = today()) {
  if (!b) return null;
  const me = state.user, A = me === 'Άλκης';
  const r0 = { inc: 0, exp: 0, inv: 0, partner: 0, phil: 0, others: 0, n: 0, months: new Map() };
  const inR = (d) => (b.incl ? d >= b.d : d > b.d) && d <= to;
  for (const r of movements()) {
    if (r.skipped || !inR(r.d)) continue;
    const f = fx(r, to); const U = A ? f.U : f.V, P = A ? f.P : f.R, Q = A ? f.Q : f.S;
    const own = -U, partner = -(P - Q), phil = A ? f.T || 0 : 0, oth = r.payer === me && r.oth ? -othSum(r) : 0;
    if (!(own || partner || phil || oth)) continue;
    if (own > 0) r0.inc += own; else if (SAVE.has(r.cat)) r0.inv += own; else r0.exp += own;
    r0.partner += partner; r0.phil += phil; r0.others += oth; r0.n++;
    const m = r.d.slice(0, 7); r0.months.set(m, (r0.months.get(m) || 0) + own + partner + phil + oth);
  }
  for (const m of store.records('pmov')) {                        // Οφειλές με άλλους: «Μου έδωσε» +, «Του/της έδωσα» −
    if (!inR(m.d || '')) continue; const s = m.k === 'got' ? 1 : m.k === 'gave' ? -1 : 0; if (!s) continue;
    r0.others += s * (m.a || 0); const mm = m.d.slice(0, 7); r0.months.set(mm, (r0.months.get(mm) || 0) + s * (m.a || 0));
  }
  const tot = b.a + r0.inc + r0.exp + r0.inv + r0.partner + r0.phil + r0.others;
  return { ...r0, base: b, total: Math.round(tot * 100) / 100 };
}
export async function save(accts, accepted) {
  const e = expected(); const actual = Math.round(Object.values(accts).reduce((s, v) => s + (Number(v) || 0), 0) * 100) / 100;
  await store.put(mySpace(), null, { type: 'recon', d: today(), accts, actual, expected: e ? e.total : null, diff: e ? Math.round((actual - e.total) * 100) / 100 : null, accepted: accepted ? 1 : null });
}
export const KIND_LABELS = KINDS;
