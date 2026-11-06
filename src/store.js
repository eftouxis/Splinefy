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
  if (op.ux && r._x && op.i > r._x) { delete r._x; r._u = op.u; r._m = op.i; }     // undelete (restore from a backup)
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

function mkOp(spaceId, r, extra) { const k = `${spaceId}|${tick(S.device)}`; return { k, sp: spaceId, r, u: S.user, synced: 0, i: k.split('|')[1], ...extra }; }
async function write(spaceId, ops) {
  const sp = S.data[spaceId]; if (!sp || !ops.length) return;
  await idb.opsPut(ops); for (const op of ops) applyOp(sp, op); bump();
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
  notePut(spaceId, id, set);
  await write(spaceId, [mkOp(spaceId, id, { s: set })]);
  return id;
}
/** several changes in one go: [{id, set:{...}} | {id, del:true}]; opts.quiet: not a delete the user made (no «Αναίρεση», not in «Πρόσφατα διαγραμμένα») */
export async function putMany(spaceId, changes, opts = {}) {
  const ops = [];
  const dels = !opts.quiet && changes.some((c) => c.del);
  if (dels) { openG(spaceId); depth++; }                 // the other changes of the same call are part of the same delete
  try {
    for (const ch of changes) {
      const id = ch.id || uid(); const extra = {};
      if (ch.undel) extra.ux = 1;
      if (ch.del) { extra.x = 1; if (dels) noteDel(spaceId, id); }
      else { extra.s = Object.fromEntries(Object.entries(ch.set).map(([f, v]) => [f, v === '' || v === undefined ? null : v])); if (dels) notePut(spaceId, id, extra.s); }
      ops.push(mkOp(spaceId, id, extra));
    }
    await write(spaceId, ops);
  } finally { if (dels) depth--; }
  if (dels) await flushG();
}
/** delete a record (it stays as a tombstone with its fields, so it can come back); opts.quiet as in putMany */
export async function del(spaceId, id, opts = {}) {
  const noted = !opts.quiet && noteDel(spaceId, id);
  await write(spaceId, [mkOp(spaceId, id, { x: 1 })]);
  if (noted) await flushG();
}
/** move a record to another space (e.g. personal -> shared) */
export async function move(fromId, toId, rec) {
  const { id, _t, _u, _m, _x, _sp, ...fields } = rec;
  const nid = await put(toId, null, fields);
  await del(fromId, id, { quiet: true });
  return nid;
}

// ---- «Αναίρεση» and «Πρόσφατα διαγραμμένα» ----
// Every delete is written down in a «trash» record of the same space, so it syncs to everyone who sees that space.
// Deletes close in time, or made inside batch(), form one group: one «Αναίρεση» / «Επαναφορά» brings all of them back,
// together with what else that action changed (e.g. the end date of a recurring item, «not this time» on a lesson).
const GAP = 1500;
const delL = new Set();
export const onDeleted = (fn) => { delL.add(fn); return () => delL.delete(fn); };
let G = null, depth = 0;
function openG(spaceId, label) {
  if (!G) G = { id: `trash:${uid()}`, sp: spaceId || null, at: Date.now(), by: S.user, items: [], prev: [], made: [], label: label || null, seen: new Set() };
  else { if (label && !G.label) G.label = label; if (!G.sp) G.sp = spaceId || null; }
  return G;
}
function noteDel(spaceId, id) {
  const r = S.data[spaceId]?.recs.get(id); if (!r || r._x || r.type === 'trash') return false;
  const g = openG(spaceId); g.sp = g.sp || spaceId; const k = `d${spaceId}|${id}`;
  if (g.seen.has(k)) return false;
  g.seen.add(k); g.items.push({ sp: spaceId, id }); return true;
}
function notePut(spaceId, id, set) {
  if (!G || !depth) return;
  const r = S.data[spaceId]?.recs.get(id); const k = `${spaceId}|${id}`;
  G.sp = G.sp || spaceId;
  if (!r) { if (!G.seen.has('m' + k)) { G.seen.add('m' + k); G.made.push({ sp: spaceId, id }); } return; }
  if (G.seen.has('m' + k) || r.type === 'trash') return;
  let p = G.prev.find((x) => x.sp === spaceId && x.id === id);
  if (!p) { p = { sp: spaceId, id, f: {} }; G.prev.push(p); }
  for (const f of Object.keys(set)) if (!(f in p.f)) p.f[f] = r[f] ?? null;
}
async function flushG() {
  const g = G; if (!g || depth) return;
  if (!g.items.length && !(g.label && (g.prev.length || g.made.length))) { if (!g.items.length) G = null; return; }
  await write(g.sp, [mkOp(g.sp, g.id, { s: { type: 'trash', at: g.at, by: g.by, label: g.label, items: g.items, prev: g.prev, made: g.made } })]);
  clearTimeout(g.timer); g.timer = setTimeout(() => { if (G === g && !depth) G = null; }, GAP);
  for (const f of delL) { try { f(g); } catch (_) { /* a listener must not break the delete */ } }
}
/** several steps of one delete (e.g. «this and the next ones»): one group, one «Αναίρεση»; label = what it was */
export async function batch(fn, label) {
  openG(null, label); depth++;
  try { return await fn(); } finally {
    depth--;
    if (!depth) { const g = G; await flushG(); if (G === g) G = null; }
  }
}
/** bring back a group of deletes (a «trash» record): the records, the fields that action changed, and remove what it made */
export async function restore(t) {
  if (!t || t._x) return false;
  const by = {}; const add = (sp, o) => (by[sp] = by[sp] || []).push(o);
  for (const it of t.items || []) add(it.sp, { r: it.id, ux: 1, s: {} });
  for (const p of t.prev || []) add(p.sp, { r: p.id, s: p.f });
  for (const m of t.made || []) add(m.sp, { r: m.id, x: 1 });
  for (const [sp, list] of Object.entries(by)) await write(sp, list.map(({ r, ...o }) => mkOp(sp, r, o)));
  if (G && G.id === t.id) G = null;
  await write(t._sp, [mkOp(t._sp, t.id, { x: 1 })]);
  return true;
}
/** the trash record of a group (for «Αναίρεση» right after the delete) */
export const trashOf = (g) => { const r = S.data[g.sp]?.recs.get(g.id); if (r) r._sp = g.sp; return r; };
/** a deleted record as it was (for describing it) */
export const anyRecord = (sp, id) => S.data[sp]?.recs.get(id) || null;

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
