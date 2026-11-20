// Πιθανές διπλές κινήσεις: ίδιο είδος, ποσό και περιγραφή, μέσα σε λίγες μέρες
import * as store from './store.js';
import { norm, addDays } from './util.js';

const keyOf = (r) => `${r.kind}|${Math.round((r.a || 0) * 100)}|${norm(r.desc || r.cat || '').trim()}`;
const okRec = () => store.records('pref').find((r) => r.id === 'dupok');
export const dismissed = () => new Set(okRec()?.keys || []);
/** μια ίδια κίνηση στον ίδιο μήνα (για τον έλεγχο πριν την καταχώρηση) */
export function sameInMonth({ kind, a, desc, cat, d }, exceptId) {
  const k = keyOf({ kind, a, desc, cat });
  return store.records('tx').filter((r) => r.id !== exceptId && keyOf(r) === k && (r.d || '').slice(0, 7) === (d || '').slice(0, 7)).sort((x, y) => (x.d < y.d ? 1 : -1))[0] || null;
}
/** ομάδες πιθανών διπλών εξόδων (ημερομηνίες ως 3 μέρες μακριά) — όχι μεταφορές/πληρωμές μεταξύ μας */
export function scan() {
  const by = new Map();
  for (const r of store.records('tx')) { if (!r.d || !(r.a > 0) || r.kind !== 'Έξοδο') continue; const k = keyOf(r); (by.get(k) || by.set(k, []).get(k)).push(r); }
  const ok = dismissed(); const out = [];
  for (const [k, l] of by) {
    if (l.length < 2) continue; l.sort((x, y) => (x.d < y.d ? -1 : 1));
    let g = [l[0]];
    const flush = () => { if (g.length > 1) { const gk = `${k}|${g.map((x) => x.id).sort().join(',')}`; if (!ok.has(gk)) out.push({ key: gk, rs: g.slice() }); } };
    for (let i = 1; i < l.length; i++) { if (l[i].d <= addDays(g[g.length - 1].d, 3)) g.push(l[i]); else { flush(); g = [l[i]]; } }
    flush();
  }
  return out.sort((a, b) => (a.rs[0].d < b.rs[0].d ? 1 : -1));
}
export async function dismiss(key) {
  const cur = okRec(); const keys = [...new Set([...(cur?.keys || []), key])];
  await store.put(cur?._sp || 'shared', 'dupok', { type: 'pref', keys });
}
