// Local-first store: per space = base snapshot + operation log (last-writer-wins per field).
import * as idb from './idb.js';
import { tick, observe } from './hlc.js';
import { uid } from './util.js';

export const DEFAULT_SPACES = [
  { id: 'shared', name: 'Κοινό', folder: 'Χαρά & Άλκης/Εφαρμογή', owner: 'Άλκης', members: ['Άλκης', 'Χαρά'] },
  { id: 'alkis', name: 'Προσωπικό Άλκη', folder: 'Εφαρμογή – Άλκης', owner: 'Άλκης', members: ['Άλκης'] },
  { id: 'chara', name: 'Προσωπικό Χαράς', folder: 'Εφαρμογή – Χαρά', owner: 'Χαρά', members: ['Χαρά'] },
];

const S = {
  device: null, user: null, spaces: [], data: {}, listeners: new Set(), version: 0,
};
export const state = S;

function emptySpace() { return { recs: new Map(), hasBase: false, baseCreated: null }; }

function applyOp(sp, op) {
  observe(op.i);
  let r = sp.recs.get(op.r);
  if (!r) { r = { id: op.r, _t: {} }; sp.recs.set(op.r, r); }
  if (op.s) {
    for (const [f, v] of Object.entries(op.s)) {
      const ft = r._t[f] || '0';
      if (op.i > ft) { r[f] = v; r._t[f] = op.i; r._u = op.u; r._m = op.i; }
    }
  }
  if (op.x && (!r._x || op.i > r._x)) { r._x = op.i; r._u = op.u; r._m = op.i; }
}

function loadBase(sp, base) {
  for (const rec of base.records) { rec._t = {}; sp.recs.set(rec.id, rec); }
  sp.hasBase = true; sp.baseCreated = base.created;
}

export async function init() {
  S.device = await idb.kvGet('device');
  if (!S.device) { S.device = uid().slice(0, 8); await idb.kvSet('device', S.device); }
  S.user = (await idb.kvGet('user')) || null;
  S.spaces = (await idb.kvGet('spaces')) || DEFAULT_SPACES;
  for (const d of DEFAULT_SPACES) if (!S.spaces.some((x) => x.id === d.id)) S.spaces = [...S.spaces, d];   // new spaces in later versions
  S.data = {};
  for (const sp of S.spaces) {
    S.data[sp.id] = emptySpace();
    const b = await idb.baseGet(sp.id);
    if (b) loadBase(S.data[sp.id], b);
  }
  const ops = (await idb.opsAll()).sort((a, b) => (a.i < b.i ? -1 : 1));
  for (const o of ops) if (S.data[o.sp]) applyOp(S.data[o.sp], o);
  bump();
}

export const on = (fn) => { S.listeners.add(fn); return () => S.listeners.delete(fn); };
function bump() { S.version++; for (const f of S.listeners) f(S.version); }

export async function setUser(u) { S.user = u; await idb.kvSet('user', u); bump(); }
export async function setSpaces(list) {
  S.spaces = list; await idb.kvSet('spaces', list);
  for (const sp of list) if (!S.data[sp.id]) S.data[sp.id] = emptySpace();
  bump();
}
export const visibleSpaces = () => S.spaces.filter((sp) => !S.user || sp.members.includes(S.user));
export const spaceById = (id) => S.spaces.find((s) => s.id === id);

export async function importBase(spaceId, base) {
  const sp = S.data[spaceId] || (S.data[spaceId] = emptySpace());
  await idb.baseSet(spaceId, base);
  // keep ops; rebuild
  sp.recs = new Map(); loadBase(sp, base);
  const ops = (await idb.opsAll()).filter((o) => o.sp === spaceId).sort((a, b) => (a.i < b.i ? -1 : 1));
  for (const o of ops) applyOp(sp, o);
  bump();
}

/** create or update a record (only changed fields are written) */
export async function put(spaceId, id, fields) {
  const sp = S.data[spaceId];
  id = id || uid();
  const cur = sp.recs.get(id);
  const set = {};
  for (const [k, v] of Object.entries(fields)) {
    const val = v === '' ? null : v;
    if (!cur || JSON.stringify(cur[k] ?? null) !== JSON.stringify(val)) set[k] = val;
  }
  if (cur && !Object.keys(set).length) return id;
  const op = { k: `${spaceId}|${tick(S.device)}`, sp: spaceId, r: id, s: set, u: S.user, synced: 0 };
  op.i = op.k.split('|')[1];
  await idb.opsPut([op]); applyOp(sp, op); bump();
  return id;
}
/** several changes in one go: [{id, set:{...}} | {id, del:true}] */
export async function putMany(spaceId, changes) {
  const sp = S.data[spaceId]; const ops = [];
  for (const ch of changes) {
    const k = `${spaceId}|${tick(S.device)}`;
    const op = { k, sp: spaceId, r: ch.id || uid(), u: S.user, synced: 0, i: k.split('|')[1] };
    if (ch.del) op.x = 1; else op.s = Object.fromEntries(Object.entries(ch.set).map(([f, v]) => [f, v === '' || v === undefined ? null : v]));
    ops.push(op);
  }
  if (!ops.length) return;
  await idb.opsPut(ops); for (const op of ops) applyOp(sp, op); bump();
}
export async function del(spaceId, id) {
  const sp = S.data[spaceId];
  const op = { k: `${spaceId}|${tick(S.device)}`, sp: spaceId, r: id, x: 1, u: S.user, synced: 0 };
  op.i = op.k.split('|')[1];
  await idb.opsPut([op]); applyOp(sp, op); bump();
}
/** move a record to another space (e.g. personal -> shared) */
export async function move(fromId, toId, rec) {
  const { id, _t, _u, _m, _x, _sp, ...fields } = rec;
  const nid = await put(toId, null, fields);
  await del(fromId, id);
  return nid;
}

export function records(type, spaces = visibleSpaces().map((s) => s.id)) {
  const out = [];
  for (const sid of spaces) {
    const sp = S.data[sid]; if (!sp) continue;
    for (const r of sp.recs.values()) if (r.type === type && !r._x) { r._sp = sid; out.push(r); }
  }
  return out;
}
export function setting(spaceId = 'shared') {
  const r = S.data[spaceId]?.recs.get('settings');
  return r && !r._x ? r : {};
}

// ---- sync support ----
export async function pendingOps(spaceId) { return (await idb.opsAll()).filter((o) => o.sp === spaceId && !o.synced); }
export async function markSynced(list, file) { await idb.opsPut(list.map((o) => ({ ...o, synced: 1, file }))); }
export async function applyRemote(spaceId, ops) {
  const sp = S.data[spaceId];
  const list = ops.map((o) => ({ ...o, k: `${spaceId}|${o.i}`, sp: spaceId, synced: 1 }));
  await idb.opsPut(list);
  for (const o of list.sort((a, b) => (a.i < b.i ? -1 : 1))) applyOp(sp, o);
  bump();
}
export const kv = { get: idb.kvGet, set: idb.kvSet };
export const hasBase = (sid) => !!S.data[sid]?.hasBase;
export const getBase = (sid) => idb.baseGet(sid);
