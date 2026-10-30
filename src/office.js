// Γραφείο (Χαρά's business «Healthy Project»): client payments, office expenses, partners with a fee %,
// the salary she pays herself (an office expense that is her personal income), fixed-cost budget, office cushion.
// Everything lives in Χαρά's personal space, so only she sees it.
import { records, state } from './store.js';
import { recurringMovements } from './ledger.js';
import { today, norm } from './util.js';

export const OSP = 'chara';
export const hasOffice = () => state.user === 'Χαρά' && !!state.data[OSP];
export const PAYS = ['Μετρητά', 'POS', 'IRIS', 'Εθνική', 'Revolut', 'IBAN'];
export const ECATS = ['Πάγια έξοδα', 'Marketing', 'Αμοιβή συνεργασίας', 'Πληρωμή Συνεργάτη', 'Εξοπλισμός γραφείου', 'ΕΦΚΑ / Φόροι', 'Λογιστής', 'Αγορές', 'Άλλο'];
export const SALARY_CAT = 'Μισθός Χαράς';
const SAL_NAME = 'Μισθός από γραφείο';

/** «μεμονωμένη πληρωμη», «πακέτο για 4 φορές» … → a few groups for the statistics */
export function svcGroup(s) {
  const t = norm(s || '').trim();
  if (!t) return 'Χωρίς υπηρεσία';
  if (/πρωτη/.test(t)) return 'Πρώτη συνεδρία';
  if (/προκαταβολ|προπληρωμ|εξοφλησ|υπολοιπ|αποπληρωμ/.test(t)) return 'Πακέτο (προκαταβολή / εξόφληση)';
  const m = t.match(/(\d+)\s*(φορ|φ\b|συνεδρ)/); if (/πακετο|συνεδριες|φορες/.test(t) && m) return `Πακέτο ${m[1]} φορές`;
  if (/πακετο/.test(t)) return 'Πακέτο';
  if (/μεμον|μεμων|μεμονομ/.test(t)) return 'Μεμονωμένη συνεδρία';
  return s.trim();
}
const ym = (d) => d.slice(0, 7);
let C = { v: -1 };
function build() {
  if (C.v === state.version) return C;
  const sp = [OSP];
  const parts = records('opart', sp).sort((a, b) => a.name.localeCompare(b.name, 'el'));
  const pById = new Map(parts.map((p) => [p.id, p]));
  const inc = records('oin', sp).map((r) => ({ ...r, fee: r.fee != null ? r.fee : (r.part && pById.get(r.part) ? (r.a || 0) * (pById.get(r.part).pct || 0) : 0) }));
  const t = today();
  const recEx = recurringMovements('2100-01-01', true).filter((r) => !r.skipped).map((r) => ({ id: r.id, type: 'oex', d: r.d, desc: r.desc, cat: r.cat, a: r.a, rec: r.rec, _sp: r._sp, part: null }));
  const salary = recurringMovements('2100-01-01', false).filter((r) => r.salary && !r.skipped && r._sp === OSP).map((r) => ({ id: r.id, type: 'oex', d: r.d, desc: 'Μισθός Χαράς', cat: SALARY_CAT, a: r.a, rec: r.rec, _sp: r._sp, sal: true }));
  const exp = records('oex', sp).concat(recEx, salary);
  C = { v: state.version, parts, pById, inc: inc.sort((a, b) => (a.d < b.d ? 1 : -1)), exp: exp.sort((a, b) => (a.d < b.d ? 1 : -1)), t };
  return C;
}
export const partners = () => build().parts;
export const partner = (id) => build().pById.get(id);
/** payments up to today (future recurring items are only «coming») */
export const incomes = (all = false) => build().inc.filter((r) => all || r.d <= today());
export const expenses = (all = false) => build().exp.filter((r) => all || r.d <= today());
export const salaryDef = () => records('rec', [OSP]).find((r) => r.salary && !(r.end && r.end < today())) || records('rec', [OSP]).find((r) => r.salary) || null;
export const pref = () => records('opref', [OSP]).find((r) => r.id === 'office') || { goal: 0, open: 0 };
export { SAL_NAME };

/** totals for a date range */
export function totals(from, to) {
  let inc = 0, rcpt = 0, exp = 0, sal = 0, fee = 0, n = 0; const bySvc = new Map(), byCat = new Map(), byPay = new Map();
  for (const r of incomes()) {
    const d = r.md || r.d; if (d < from || d > to) continue;
    inc += r.a || 0; n++; if (r.rcpt) rcpt += r.a || 0; fee += r.fee || 0;
    const g = svcGroup(r.svc); bySvc.set(g, (bySvc.get(g) || 0) + (r.a || 0));
    byPay.set(r.pay || '—', (byPay.get(r.pay || '—') || 0) + (r.a || 0));
  }
  for (const r of expenses()) {
    if (r.d < from || r.d > to) continue;
    if (r.sal) { sal += r.a || 0; continue; }
    exp += r.a || 0; byCat.set(r.cat || 'Άλλο', (byCat.get(r.cat || 'Άλλο') || 0) + (r.a || 0));
  }
  return { inc, rcpt, exp, sal, fee, n, res: inc - exp - sal, bySvc, byCat, byPay };
}
/** money of the office now: opening + all income − all expenses − salaries */
export function balance() {
  const p = pref(); const from = p.asOf ? addDaysS(p.asOf, 1) : '2000-01-01';
  return (p.open || 0) + totals(from, today()).res;
}
const addDaysS = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
/** what is owed to each partner: fees from their clients − what was paid to them */
export function partnerStatus(id) {
  const fees = incomes().filter((r) => r.part === id).reduce((s, r) => s + (r.fee || 0), 0);
  const paid = expenses().filter((r) => r.part === id).reduce((s, r) => s + (r.a || 0), 0);
  const n = incomes().filter((r) => r.part === id).length;
  return { fees, paid, owed: fees - paid, n };
}
/** clients: name → {name, n, sum, first, last, svc} */
export function clients() {
  const m = new Map();
  for (const r of incomes(true)) {
    if (!r.cl) continue; const k = norm(r.cl).trim();
    const x = m.get(k) || { name: r.cl.trim(), n: 0, sum: 0, first: r.d, last: r.d, lastSvc: '', lastA: 0 };
    x.n++; x.sum += r.a || 0; if (r.d < x.first) x.first = r.d; if (r.d >= x.last) { x.last = r.d; x.name = r.cl.trim(); x.lastSvc = r.svc || ''; x.lastA = r.a || 0; }
    m.set(k, x);
  }
  return [...m.values()];
}
export const clientPays = (name) => { const k = norm(name).trim(); return incomes(true).filter((r) => norm(r.cl || '').trim() === k); };
/** most used services (as written) and the usual price of each */
export function services() {
  const m = new Map();
  for (const r of incomes(true).slice(0, 400)) {
    const s = (r.svc || '').trim(); if (!s) continue; const k = svcGroup(s);
    const x = m.get(k) || { name: k, n: 0, prices: new Map() }; x.n++; x.prices.set(r.a, (x.prices.get(r.a) || 0) + 1); m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.n - a.n).map((x) => ({ name: x.name, n: x.n, price: [...x.prices.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] }));
}
export function months(y) { const t = today(); return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`).filter((m) => m <= ym(t)); }
export function monthTotals(m) { return totals(`${m}-01`, `${m}-31`); }
export const fixed = () => records('ofix', [OSP]).sort((a, b) => (b.m || 0) - (a.m || 0));
