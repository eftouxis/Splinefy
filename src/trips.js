// Trips: a name + optional dates. While a trip with dates is on, new expenses get its tag automatically.
import { records, state } from './store.js';
import { movements, fx } from './ledger.js';
import { today, addDays, norm } from './util.js';

export const SP = 'shared';
/** a trip only I go on lives in my personal space (the other one does not see it) */
export const mySpace = () => state.spaces.find((s) => s.owner === state.user && s.members.length === 1)?.id || null;
export const whoTxt = (t) => (t._sp && t._sp !== SP ? `μόνο ${state.spaces.find((s) => s.id === t._sp)?.owner || ''}` : 'Χαρά & Άλκης');
/** all trips: records + names used on movements without a record */
export function trips() {
  const recs = records('trip'); const byName = new Map(recs.map((t) => [norm(t.name).trim(), t]));
  const out = recs.map((t) => ({ ...t, rec: true }));
  for (const r of movements()) if (r.trip && !byName.has(norm(r.trip).trim())) { const x = { name: r.trip, rec: false }; byName.set(norm(r.trip).trim(), x); out.push(x); }
  return out;
}
export const byName = (n) => trips().find((t) => norm(t.name).trim() === norm(n).trim());
/** the trip that is on at date d (auto-tag) */
export function tripOn(d) {
  return records('trip').filter((t) => t.auto !== false && t.start && t.end && d >= t.start && d <= t.end).sort((a, b) => (a.start < b.start ? 1 : -1))[0] || null;
}
/** quick picks for the form: on now / upcoming / recently used */
export function recentTrips(d = today()) {
  const used = new Map();
  for (const r of movements()) if (r.trip && r.d >= addDays(d, -120)) used.set(r.trip, Math.max(used.get(r.trip) || 0, Date.parse(r.d)));
  const soon = records('trip').filter((t) => (t.end && t.end >= addDays(d, -30)) || (!t.end && t.start && t.start >= addDays(d, -30))).map((t) => t.name);
  return [...new Set([...soon, ...[...used.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)])].slice(0, 5);
}
export function moves(name) {
  const n = norm(name).trim();
  return movements().filter((r) => r.trip && norm(r.trip).trim() === n && r.kind === 'Έξοδο');
}
export function summary(name) {
  const t = byName(name) || { name }; const ls = moves(name);
  let N = 0, Q = 0, S = 0, from = null, to = null;
  for (const r of ls) { const f = fx(r, '9999-12-31'); N += f.N; Q += f.Q; S += f.S; if (!from || r.d < from) from = r.d; if (!to || r.d > to) to = r.d; }
  const a = t.start || from, b = t.end || to;
  const days = a && b ? Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1) : 1;
  return { trip: t, list: ls, N, Q, S, from: a, to: b, days };
}
/** expenses in the trip dates that have no trip yet (to tag them after creating the trip) */
export function untaggedIn(start, end) {
  return movements().filter((r) => r.kind === 'Έξοδο' && !r.rec && !r.trip && r.d >= start && r.d <= end && r._sp && state.data[r._sp]?.recs.has(r.id));
}
