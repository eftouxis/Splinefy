// Personal movements that sit in the shared space (old Excel/Splid rows, imported recurring items):
// the other person can see them although they concern only me. They move to my personal space; nothing about the money changes.
import * as store from './store.js';
import { fx } from './ledger.js';

const ME = () => store.state.user;
export const mySpace = () => store.state.spaces.find((s) => s.owner === ME() && s.members.length === 1 && s.members.includes(ME()))?.id || null;
const zero = (x) => Math.abs(x || 0) < 0.005;
/** only me: I paid, it is for me, the other one and Φίλιππος are not touched (so the «who owes whom» stays the same) */
function onlyMine(r) {
  const me = ME(); if (r.kind === 'Μεταφορά' || r.payer !== me || (r.oth && r.oth.length) || r.both != null || r.stu) return false;
  if (r.kind === 'Έξοδο' && r.for !== me) return false;
  if (r.kind === 'Έσοδο' && r.for && r.for !== me) return false;
  const f = fx({ ...r, d: r.d || r.start || '2000-01-01' }, '9999-12-31');
  return zero(f.P - f.Q) && zero(f.T) && (me === 'Άλκης' ? zero(f.R) && zero(f.S) : zero(f.P) && zero(f.Q));
}
export function misplaced() {
  if (!mySpace()) return { tx: [], rec: [] };
  const sh = store.state.data.shared; if (!sh) return { tx: [], rec: [] };
  const tx = [], rec = [];
  for (const r of sh.recs.values()) { if (r._x) continue; if (r.type === 'tx' && onlyMine(r)) tx.push(r); else if (r.type === 'rec' && onlyMine(r)) rec.push(r); }
  return { tx, rec };
}
export async function moveMine() {
  const to = mySpace(); const { tx, rec } = misplaced(); if (!to) return 0;
  const sh = store.state.data.shared; const recIds = new Set(rec.map((r) => r.id));
  const extra = [...sh.recs.values()].filter((r) => !r._x && r.type === 'recx' && recIds.has(String(r.id).split('@')[0]));
  const all = [...tx, ...rec, ...extra];
  const clean = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_') && k !== 'id'));
  for (let i = 0; i < all.length; i += 400) {
    const part = all.slice(i, i + 400);
    await store.putMany(to, part.map((r) => ({ id: r.id, set: clean(r) })));
    await store.putMany('shared', part.map((r) => ({ id: r.id, del: true })));
  }
  return tx.length + rec.length;
}
