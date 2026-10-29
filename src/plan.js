// Pay-off plans (e.g. money owed to mother) + this month's spending room that keeps the instalment safe
import { state } from './store.js';
import * as P from './people.js';
import { movements, totals, fx } from './ledger.js';
import { records } from './store.js';
import { today, addMonths, MONTHS } from './util.js';

const ym = (d) => d.slice(0, 7);
export const mLabel = (m) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
/** plan status for one person: debt left, instalment, paid this month, still due this month, last month */
export function status(p, t = today()) {
  if (!p?.plan?.m) return null;
  const b = P.balance(p.id); const debt = Math.max(0, -b); const cur = ym(t);
  const paid = P.entries(p.id).filter((e) => e.m && e.m.k === 'gave' && ym(e.d) === cur).reduce((s, e) => s + e.a, 0);
  if (p.plan.from && p.plan.from > cur) { const n = Math.ceil(debt / p.plan.m - 1e-9); return { p, debt, m: p.plan.m, paid, due: 0, end: addMonths(`${p.plan.from}-01`, n - 1).slice(0, 7), months: n, buffer: p.plan.buffer || 0, later: p.plan.from }; }
  const due = Math.max(0, Math.min(p.plan.m, debt + paid) - paid);
  const after = Math.max(0, debt - due); const n = Math.ceil(after / p.plan.m - 1e-9);   // instalments after this month
  const end = addMonths(`${cur}-01`, n).slice(0, 7);
  return { p, debt, m: p.plan.m, paid, due, end, months: n + (due > 0.004 ? 1 : 0), buffer: p.plan.buffer || 0 };
}
export const plans = () => P.people().map((p) => status(p)).filter((s) => s && s.debt > 0.004);
/** savings goals (e.g. a safety cushion): money put in category «Αποταμίευση» counts towards them */
const mySpace = () => state.spaces.find((x) => x.owner === state.user && x.members.length === 1)?.id || 'shared';
export const goalSpace = mySpace;
export function goals(t = today()) {
  const col = state.user === 'Χαρά' ? 'V' : 'U'; const cur = ym(t);
  return records('goal', [mySpace()]).map((g) => {
    const cat = g.cat || 'Αποταμίευση'; let saved = g.start || 0, month = 0;
    for (const r of movements()) {
      if (r.kind !== 'Έξοδο' || r.cat !== cat || r.skipped || r.d > t || (g.from && ym(r.d) < g.from)) continue;
      const v = Math.abs(fx(r)[col] || 0); saved += v; if (ym(r.d) === cur) month += v;
    }
    const left = Math.max(0, g.target - saved); const started = !g.from || g.from <= cur;
    const due = started && left > 0.004 ? Math.max(0, Math.min(g.m, left + month) - month) : 0;
    const n = g.m ? Math.ceil((started ? Math.max(0, left - due) : left) / g.m - 1e-9) : null;
    const end = left < 0.005 || !g.m ? null : started ? addMonths(`${cur}-01`, n).slice(0, 7) : addMonths(`${g.from}-01`, n - 1).slice(0, 7);
    return { g, cat, saved, month, left, due, end, pct: g.target ? Math.min(1, saved / g.target) : 0 };
  });
}
/** spending room this month for the current user */
export function room(t = today()) {
  const ps = plans(); const gs = goals(t).filter((x) => x.left > 0.004);
  if (!ps.length && !gs.length) return null;
  const me = state.user; const list = movements(); const m0 = `${ym(t)}-01`;
  const cur = totals(list, me, m0, t);
  let avg = 0; for (let i = 1; i <= 3; i++) { const a = addMonths(m0, -i); const z = totals(list, me, a, `${a.slice(0, 7)}-31`); avg += z.inc; }
  avg /= 3;
  const basis = Math.max(cur.inc, avg);
  const due = ps.reduce((s, x) => s + x.due, 0) + gs.reduce((s, x) => s + x.due, 0), buffer = Math.max(0, ...ps.map((x) => x.buffer || 0));
  const free = basis - cur.exp - (cur.save || 0) - due;
  const level = free < 0 ? 'over' : free < Math.max(buffer, basis * 0.1) ? 'warn' : 'ok';
  return { ps, gs, inc: cur.inc, avg, basis, exp: cur.exp, save: cur.save || 0, due, free, buffer, level };
}
