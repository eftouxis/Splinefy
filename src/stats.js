// Statistics engine: one pass over all movements → totals per view / month / category (cached per data version)
import { state } from './store.js';
import { movements, fx, VIEWS, billType } from './ledger.js';
import { today } from './util.js';

let C = { v: -1 };
const blank = () => ({ inc: 0, exp: 0, cats: new Map(), icats: new Map(), n: 0 });
export function cube() {
  if (C.v === state.version) return C;
  const t = today();
  const M = new Map();                 // `${view}|${YYYY-MM}` → totals
  const descs = new Map();             // `${view}|${cat}` → Map(desc → {a, n, last})
  const trips = new Map();             // trip → {N, P, Q, R, S, from, to, n}
  const bills = [];                    // {d, a, kind, cons, period, desc}
  for (const r of movements()) {
    if (r.kind === 'Μεταφορά' || r.d > t) continue;
    const d = r.md || r.d, m = d.slice(0, 7);
    const f = fx(r);
    const cat = r.trip && r.kind === 'Έξοδο' ? 'Ταξίδι' : r.cat;
    for (const [view, col] of VIEWS) {
      const v = f[col]; if (!v) continue;
      const k = `${view}|${m}`; let s = M.get(k); if (!s) M.set(k, (s = blank()));
      s.n++;
      if (r.kind === 'Έσοδο') { s.inc += -v; s.icats.set(r.cat, (s.icats.get(r.cat) || 0) - v); }
      else { s.exp += v; s.cats.set(cat, (s.cats.get(cat) || 0) + v); }
      if (r.kind === 'Έξοδο' && r.desc) {
        const dk = `${view}|${cat}`; let dm = descs.get(dk); if (!dm) descs.set(dk, (dm = new Map()));
        const key = r.desc.trim().toLowerCase(); const x = dm.get(key) || { desc: r.desc.trim(), a: 0, n: 0, last: '' };
        x.a += v; x.n++; if (r.d > x.last) x.last = r.d; dm.set(key, x);
      }
    }
    if (r.trip && r.kind === 'Έξοδο') {
      const tr = trips.get(r.trip) || { name: r.trip, N: 0, P: 0, Q: 0, R: 0, S: 0, from: r.d, to: r.d, n: 0 };
      tr.N += f.N || 0; tr.P += f.P || 0; tr.Q += f.Q || 0; tr.R += f.R || 0; tr.S += f.S || 0; tr.n++;
      if (r.d < tr.from) tr.from = r.d; if (r.d > tr.to) tr.to = r.d; trips.set(r.trip, tr);
    }
    if (r.kind === 'Έξοδο') {
      const b = r.bill || billType(r.desc);
      if (b) bills.push({ d: r.d, a: r.a || 0, mine: f.U || 0, kind: b, cons: r.cons ?? null, period: r.period || '', desc: r.desc, id: r.id, sp: r._sp });
    }
  }
  C = { v: state.version, M, descs, trips, bills };
  return C;
}
export function month(view, m) { return cube().M.get(`${view}|${m}`) || blank(); }
export function range(view, from, to) {        // months inclusive 'YYYY-MM'
  const out = blank();
  for (const [k, s] of cube().M) {
    const [v, m] = k.split('|'); if (v !== view || m < from || m > to) continue;
    out.inc += s.inc; out.exp += s.exp; out.n += s.n;
    for (const [c, x] of s.cats) out.cats.set(c, (out.cats.get(c) || 0) + x);
    for (const [c, x] of s.icats) out.icats.set(c, (out.icats.get(c) || 0) + x);
  }
  return out;
}
export const year = (view, y) => range(view, `${y}-01`, `${y}-12`);
export function firstMonth(view) {
  let f = '9999'; for (const k of cube().M.keys()) { const [v, m] = k.split('|'); if (v === view && m < f) f = m; } return f === '9999' ? today().slice(0, 7) : f;
}
export function topDescs(view, cat, from = '0000', n = 12) {
  const dm = cube().descs.get(`${view}|${cat}`); if (!dm) return [];
  return [...dm.values()].filter((x) => x.last >= from).sort((a, b) => b.a - a.a).slice(0, n);
}
