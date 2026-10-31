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
export const COMM_CAT = 'Προμήθειες πληρωμών';
/** methods that may carry a commission */
export const FEE_PAYS = ['POS', 'IRIS', 'Revolut', 'Εθνική', 'IBAN'];
/** commission rates change only from a date on: [{from, rates:{POS:{p,f}}}] oldest first; earlier payments keep the older rates */
const feeHistory = (p) => (p?.pfh ? [...p.pfh] : p?.pfee ? [{ from: '2000-01-01', rates: p.pfee }] : []).sort((a, b) => (a.from < b.from ? -1 : 1));
const ratesAt = (h, d) => { let r = {}; for (const x of h) if (x.from <= d) r = x.rates; return r; };
export const payFeeHistory = () => feeHistory(pref());
export const payFees = (d = today()) => ratesAt(feeHistory(pref()), d);

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
/** expenses marked «🏢 για το γραφείο» in the household money (tx + recurring), as office expenses */
function viaSharedList() {
  const m = (r, rec) => ({ id: r.id, type: 'oex', d: r.d, desc: r.desc, cat: r.cat, a: r.a, pay: r.payer !== 'Χαρά' ? `πλήρωσε ${r.payer}` : null, payer: r.payer, ooff: r.ooff && r.payer !== 'Χαρά' ? 1 : null, inv: r.inv || null, ivat: r.ivat ?? null, rec, _sp: r._sp, ext: true });
  return records('tx').filter((r) => r.ofc && r.kind === 'Έξοδο').map((r) => m(r, undefined))
    .concat(recurringMovements('2100-01-01', false).filter((r) => r.ofc && !r.skipped && r.kind === 'Έξοδο').map((r) => m(r, r.rec)));
}
/** VAT inside an invoice: what was written, else computed from the total */
export const invVat = (r) => (r.ivat != null ? r.ivat : (r.a || 0) - (r.a || 0) / (1 + vatRate()));
/** what the office owes to people who paid office expenses for it («το χρωστάει το γραφείο») minus repayments — visible to both */
export function officeDebts(t = today()) {
  const m = new Map(); const add = (p, k, v) => { const x = m.get(p) || { who: p, spent: 0, paid: 0, items: [], reps: [] }; x[k] += v; m.set(p, x); return x; };
  for (const r of viaSharedList()) if (r.ooff && r.d <= t) add(r.payer, 'spent', r.a || 0).items.push(r);
  for (const r of records('orep')) if (r.d <= t) add(r.to, 'paid', r.a || 0).reps.push(r);
  return [...m.values()].map((x) => ({ ...x, owed: Math.round((x.spent - x.paid) * 100) / 100 }));
}
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
  // expenses marked «🏢 για το γραφείο» in the shared/personal money (e.g. Cosmote paid by Άλκης for Χαρά)
  const viaShared = viaSharedList();
  // card / IRIS commissions: one computed expense per month and method, from the rates in the office settings
  const hist = feeHistory(records('opref', sp).find((r) => r.id === 'office')); const comm = new Map();
  for (const r of inc) {
    const f = ratesAt(hist, r.d)[r.pay]; if (!f || (!f.p && !f.f) || !r.a) continue; const k = `${ym(r.d)}|${r.pay}`;
    const x = comm.get(k) || { m: ym(r.d), pay: r.pay, a: 0, base: 0, n: 0 }; x.a += r.a * (f.p || 0) + (f.f || 0); x.base += r.a; x.n++; comm.set(k, x);
  }
  const commEx = [...comm.values()].map((x) => { const end = `${x.m}-${String(new Date(Number(x.m.slice(0, 4)), Number(x.m.slice(5)), 0).getDate()).padStart(2, '0')}`;
    return { id: `comm-${x.m}-${x.pay}`, type: 'oex', d: end < t ? end : t, desc: `Προμήθεια ${x.pay} (${x.n} πληρωμές, ${Math.round(x.base)} €)`, cat: COMM_CAT, a: Math.round(x.a * 100) / 100, pay: x.pay, comm: true, _sp: OSP }; });
  const exp = records('oex', sp).concat(recEx, salary, viaShared, commEx);
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
/** VAT rate for receipts (setting, default 24%) */
export const vatRate = () => { const v = pref().vat; return v != null ? v : 0.24; };
/** a payment split: with a receipt the amount includes VAT; without one it is all net */
export function split(a, rcpt, rate = vatRate()) { const net = rcpt ? a / (1 + rate) : a; return { net, vat: a - net }; }
export { SAL_NAME };

/** totals for a date range */
export function totals(from, to) {
  let inc = 0, rcpt = 0, exp = 0, sal = 0, fee = 0, n = 0, net = 0, vat = 0, disc = 0, inv = 0, ivat = 0, ninv = 0; const rate = vatRate(); const bySvc = new Map(), byCat = new Map(), byPay = new Map();
  for (const r of incomes()) {
    const d = r.md || r.d; if (d < from || d > to) continue;
    inc += r.a || 0; n++; if (r.rcpt) rcpt += r.a || 0; fee += r.fee || 0; disc += r.disc || 0;
    const sp = split(r.a || 0, r.rcpt, r.vr != null ? r.vr : rate); net += sp.net; vat += sp.vat;
    const g = svcGroup(r.svc); bySvc.set(g, (bySvc.get(g) || 0) + (r.a || 0));
    byPay.set(r.pay || '—', (byPay.get(r.pay || '—') || 0) + (r.a || 0));
  }
  for (const r of expenses()) {
    if (r.d < from || r.d > to) continue;
    if (r.sal) { sal += r.a || 0; continue; }
    if (r.inv) { inv += r.a || 0; ivat += invVat(r); ninv++; }
    exp += r.a || 0; byCat.set(r.cat || 'Άλλο', (byCat.get(r.cat || 'Άλλο') || 0) + (r.a || 0));
  }
  return { inc, rcpt, exp, sal, fee, n, net, vat, disc, inv, ivat, ninv, res: inc - exp - sal, bySvc, byCat, byPay };
}
/** money of the office now: opening + all income − all expenses − salaries */
export function balance() {
  const p = pref(); const from = p.asOf ? addDaysS(p.asOf, 1) : '2000-01-01';
  // cash: expenses that someone else paid «for the office» leave the account only when the office pays them back
  const owed = officeDebts().reduce((s, x) => s + x.items.filter((r) => r.d >= from).reduce((a, r) => a + (r.a || 0), 0) - x.reps.filter((r) => r.d >= from).reduce((a, r) => a + (r.a || 0), 0), 0);
  return (p.open || 0) + totals(from, today()).res + owed;
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
/** a client's open balance = what the latest payment says («μετά από αυτή: μου χρωστάει 5» = +5, «του χρωστάω 5» = −5) */
export function clientDue(name) { const l = clientPays(name)[0]; return l && l.due ? l.due : 0; }
export function clientsWithDue() {
  const m = new Map();
  for (const r of incomes(true)) { if (!r.cl) continue; const k = norm(r.cl).trim(); if (!m.has(k)) m.set(k, r); }   // newest first
  return [...m.values()].filter((r) => r.due && Math.abs(r.due) > 0.004).map((r) => ({ name: r.cl.trim(), due: r.due, d: r.d }));
}
/** movements for a period ('YYYY-MM' or 'YYYY') and a filter: in, ex, rcpt, sal, svc:<group>, cat:<cat>, pay:<method>, part:<id> */
export function filtered(period, f = '') {
  const inP = (d) => d.startsWith(period);
  const [k, ...rest] = f.split(':'); const v = rest.join(':');
  let inc = incomes(true).filter((r) => inP(r.md || r.d)), exp = expenses(true).filter((r) => inP(r.d));
  if (k === 'in') exp = [];
  else if (k === 'ex') { inc = []; exp = exp.filter((r) => !r.sal); }
  else if (k === 'inv') { inc = []; exp = exp.filter((r) => r.inv); }
  else if (k === 'rcpt') { inc = inc.filter((r) => r.rcpt); exp = []; }
  else if (k === 'sal') { inc = []; exp = exp.filter((r) => r.sal); }
  else if (k === 'svc') { inc = inc.filter((r) => svcGroup(r.svc) === v); exp = []; }
  else if (k === 'pay') { inc = inc.filter((r) => (r.pay || '—') === v); exp = []; }
  else if (k === 'part') { inc = inc.filter((r) => r.part === v); exp = exp.filter((r) => r.part === v); }
  else if (k === 'cat') { inc = []; exp = exp.filter((r) => !r.sal && (r.cat || 'Άλλο') === v); }
  return { inc, exp };
}
export const FILTER_LABEL = (f) => { const [k, ...r] = (f || '').split(':'); const v = r.join(':'); return ({ in: 'Μόνο έσοδα', ex: 'Μόνο έξοδα', rcpt: '🧾 Μόνο με απόδειξη', inv: '📑 Αγορές με τιμολόγιο', sal: 'Μόνο μισθός', svc: `Υπηρεσία: ${v}`, pay: `Τρόπος: ${v}`, part: `Συνεργάτης: ${partner(v)?.name || ''}`, cat: `Κατηγορία: ${v}` })[k] || ''; };
