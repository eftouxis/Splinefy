// Automatic backups: once a day, after a successful sync, a full copy of every space goes to OneDrive
// («<φάκελος χώρου>/Αντίγραφα/YYYY-MM-DD.json») and the last few also stay on this device.
// Old copies are thinned out: every day for 2 weeks, one per week for 3 months, one per month for ever.
// Restoring writes the differences as normal changes, so every device gets the restored state.
import * as store from './store.js';
import { today } from './util.js';

export const BK_FOLDER = 'Αντίγραφα';
const LOCAL_KEEP = 3;

export function snapshot(spId) {
  const s = store.spaceById(spId); const d = store.state.data[spId];
  const records = [...d.recs.values()].filter((r) => !r._x).map(({ _t, _u, _m, _x, _sp, ...r }) => r);
  return { format: 1, space: { id: s.id, name: s.name, members: s.members }, created: new Date().toISOString(), records };
}
const weekKey = (s) => { const d = new Date(s + 'T12:00'); const th = new Date(d); th.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const y = th.getFullYear(); return `${y}-${Math.ceil(((th - new Date(y, 0, 1)) / 864e5 + 1) / 7)}`; };
const daysAgo = (s) => (new Date(today() + 'T12:00') - new Date(s + 'T12:00')) / 864e5;
/** which dated copies to keep (names 'YYYY-MM-DD.json') */
export function keep(names) {
  const ds = names.map((n) => n.slice(0, 10)).filter((d) => /^\d{4}-\d\d-\d\d$/.test(d)).sort().reverse();
  const k = new Set(); const wk = new Set(), mo = new Set();
  for (const d of ds) {
    if (daysAgo(d) <= 14) k.add(d);
    if (daysAgo(d) <= 92 && !wk.has(weekKey(d))) { wk.add(weekKey(d)); k.add(d); }
    if (!mo.has(d.slice(0, 7))) { mo.add(d.slice(0, 7)); k.add(d); }
  }
  return k;
}
/** after a sync: one copy per space per day */
export async function autoBackup(P, sp) {
  const t = today(); const d = store.state.data[sp.id];
  if (!d || !d.recs.size || (await store.kv.get(`bk:${sp.id}`)) === t) return;
  const snap = snapshot(sp.id);
  // on this device
  const loc = ((await store.kv.get(`bkl:${sp.id}`)) || []).filter((x) => x.date !== t);
  loc.unshift({ date: t, n: snap.records.length, snap }); await store.kv.set(`bkl:${sp.id}`, loc.slice(0, LOCAL_KEEP));
  // on OneDrive (once a day, whichever device is first)
  const f = await P.folder(`${sp.folder}/${BK_FOLDER}`);
  const files = (await P.list(f)).filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x.name));
  if (!files.some((x) => x.name === `${t}.json`)) await P.put(f, `${t}.json`, snap);
  const k = keep(files.map((x) => x.name).concat(`${t}.json`));
  for (const x of files) if (!k.has(x.name.slice(0, 10)) && P.del) await P.del(f, x.name);
  await store.kv.set(`bk:${sp.id}`, t);
}
export const lastBackup = async (spId) => store.kv.get(`bk:${spId}`);
export const localBackups = async (spId) => (await store.kv.get(`bkl:${spId}`)) || [];
export async function driveBackups(P, sp) {
  const f = await P.folder(`${sp.folder}/${BK_FOLDER}`);
  return { f, list: (await P.list(f)).filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x.name)).sort((a, b) => (a.name < b.name ? 1 : -1)) };
}
/** what a restore would change */
export function diff(snap) {
  const spId = snap.space.id; const d = store.state.data[spId]; if (!d) throw new Error('άγνωστος χώρος');
  const want = new Map(snap.records.map((r) => [r.id, r])); const ch = []; let add = 0, upd = 0, del = 0;
  for (const [id, cur] of d.recs) {
    if (cur._x) continue;
    const w = want.get(id);
    if (!w) { ch.push({ id, del: true }); del++; continue; }
    const set = {};
    for (const k of new Set([...Object.keys(w), ...Object.keys(cur)])) {
      if (k === 'id' || k.startsWith('_')) continue;
      if (JSON.stringify(cur[k] ?? null) !== JSON.stringify(w[k] ?? null)) set[k] = w[k] ?? null;
    }
    if (Object.keys(set).length) { ch.push({ id, set }); upd++; }
  }
  for (const [id, w] of want) {
    const cur = d.recs.get(id); if (cur && !cur._x) continue;
    const { id: _i, ...set } = w;
    if (cur) for (const k of Object.keys(cur)) if (!k.startsWith('_') && k !== 'id' && !(k in set)) set[k] = null;   // fields added after the backup
    ch.push({ id, set, undel: !!cur }); add++;
  }
  return { spId, ch, add, upd, del };
}
export async function restore(snap) {
  const x = diff(snap);
  for (let i = 0; i < x.ch.length; i += 500) await store.putMany(x.spId, x.ch.slice(i, i + 500));
  return x;
}
