// Ledger logic — same rules as the Excel file (columns M..X).
import { records, setting } from './store.js';
import { today, addDays, addMonths, monthKey, norm } from './util.js';

export const KINDS = { exp: 'Έξοδο', inc: 'Έσοδο', trf: 'Μεταφορά' };

/** computed values of one movement (N amount±, P/Q Άλκης paid/share, R/S Χαρά paid/share, T Φίλιππος, U/V/W/X views) */
/** part of an expense that other people (sister, friends…) owe back to the payer */
export function othSum(r) {
  if (!r.oth || !r.oth.length || r.kind !== 'Έξοδο') return 0;
  return r.oth.reduce((s, o) => s + (o.a != null ? o.a : (o.f || 0) * (r.a || 0)), 0);
}
function whoFor(r) { const fo = r.for || '', k = r.kind; return fo === 'Φίλιππος' ? 'Φίλιππος' : k === 'Έσοδο' ? (fo === 'Κοινό' ? 'Κοινό' : r.payer) : (fo || 'Κοινό'); }
export function fx(r, t = today()) {
  if (r.fx) return r.fx.O ? r.fx : { ...r.fx, O: whoFor(r) };      // frozen Excel rows have no O
  const a = (r.a || 0) - othSum(r), k = r.kind, p = r.payer, fo = r.for || '';
  const N = r.d > t ? 0 : (k === 'Έσοδο' ? -a : a);
  const O = fo === 'Φίλιππος' ? 'Φίλιππος' : k === 'Έσοδο' ? (fo === 'Κοινό' ? 'Κοινό' : p) : (fo || 'Κοινό');
  const both = r.both ?? null, share = r.share ?? null;
  const P = both !== null && k !== 'Έσοδο' ? both : (p === 'Άλκης' ? N : 0);
  const Q = share !== null && O === 'Κοινό' && k === 'Έξοδο' ? share : N * (p === 'Φίλιππος' ? 0 : O === 'Κοινό' ? 0.5 : (O === 'Άλκης' || O === 'Φίλιππος') ? 1 : 0);
  const R = both !== null && k !== 'Έσοδο' ? N - both : (p === 'Χαρά' ? N : 0);
  const S = share !== null && O === 'Κοινό' && k === 'Έξοδο' ? N - share : N * (p === 'Φίλιππος' ? 0 : O === 'Κοινό' ? 0.5 : O === 'Χαρά' ? 1 : 0);
  const T = p === 'Φίλιππος' ? N : (O === 'Φίλιππος' ? -N : 0);
  const U = k === 'Μεταφορά' || O === 'Φίλιππος' ? 0 : Q;
  const V = k === 'Μεταφορά' || O === 'Φίλιππος' ? 0 : S;
  const W = O === 'Κοινό' && k !== 'Μεταφορά' ? N : 0;          // shared expenses and shared income (e.g. rent)
  const X = O === 'Φίλιππος' && k !== 'Μεταφορά' ? N : 0;
  return { N, O, P, Q, R, S, T, U, V, W, X };
}
export const VIEWS = [['Άλκης', 'U'], ['Χαρά', 'V'], ['Κοινά', 'W'], ['Φίλιππος', 'X']];

/** recurring definitions expanded into dated movements (with one-off overrides) */
export function recurringMovements(until = addDays(today(), 60)) {
  const out = [];
  const overrides = new Map(records('recx').map((x) => [x.id, x]));
  for (const def of records('rec')) {
    if (!def.start || !def.a && def.a !== 0) continue;
    const every = def.every || 1, unit = def.unit || 'm';
    for (let n = 0; n < 1000; n++) {
      const d = unit === 'd' ? addDays(def.start, n * every) : addMonths(def.start, n * every);
      if (d > until || (def.end && d > def.end)) break;
      const oid = `${def.id}@${d}`; const ov = overrides.get(oid) || {};
      if (ov.skip) { out.push({ id: oid, type: 'tx', d, a: 0, desc: def.name, cat: def.cat, kind: def.kind, payer: def.payer, for: def.for, rec: def.id, skipped: true, _sp: def._sp }); continue; }
      out.push({ id: oid, type: 'tx', d, a: ov.a ?? def.a, desc: def.name, cat: def.cat, kind: def.kind, payer: ov.payer || def.payer,
                 for: ov.for ?? def.for, rec: def.id, bill: def.bill, oth: def.oth, _sp: def._sp });
    }
  }
  return out;
}

/** all movements visible to the current user (records + recurring) */
export function movements() {
  return records('tx').concat(recurringMovements());
}

export function debt(list = movements()) {
  let ak = 0, ph = 0;
  for (const r of list) { if (r._sp !== 'shared') continue; const f = fx(r); ak += f.P - f.Q; ph += f.T; }
  return { alkisMinusShare: ak, philippos: ph };
}

/** totals for one view over a date range */
export function totals(list, view, from, to) {
  const col = Object.fromEntries(VIEWS)[view];
  let inc = 0, exp = 0; const byCat = new Map(), byInc = new Map();
  for (const r of list) {
    const d = r.md || r.d;                       // salaries: the month they concern (md), not the payment day
    if (d < from || d > to) continue;
    const f = fx(r); const v = f[col] || 0; if (!v) continue;
    if (r.kind === 'Έσοδο') inc += -v;
    else if (r.kind === 'Έξοδο') exp += v;
    const cat = r.trip && r.kind === 'Έξοδο' ? 'Ταξίδι' : r.cat;
    if (r.kind === 'Έξοδο') byCat.set(cat, (byCat.get(cat) || 0) + v);
    else if (r.kind === 'Έσοδο') byInc.set(cat, (byInc.get(cat) || 0) - v);
  }
  return { inc, exp, diff: inc - exp, byCat, byInc };
}

export function categories(kind) {
  const cats = setting().cats || [];
  return cats.filter((c) => (!kind || c.kind === kind) && !c.hidden).map((c) => c.name);
}

/** bill type («Είδος») from description keywords */
export function billType(desc) {
  const kw = setting().billKw || []; const t = norm(desc);
  let hit = '';
  for (const [k, v] of kw) if (k && t.includes(norm(k))) hit = v;
  return hit;
}

/** suggestions: last category / for / payer used with a description */
export function memory() {
  const m = new Map();
  const list = records('tx').filter((r) => r.desc).sort((a, b) => (a.d < b.d ? -1 : 1));
  for (const r of list) m.set(norm(r.desc), r);
  return m;
}
export { monthKey };
