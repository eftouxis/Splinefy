// Sync: every device writes only its own files (ops/<device>-<time>.json) and reads everybody else's.
import * as store from './store.js';
import { CONFIG } from './config.js';
import { autoBackup } from './backup.js';

// ---------- Microsoft sign-in (OAuth 2.0 + PKCE, personal accounts) ----------
const AUTH = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const SCOPES = 'offline_access User.Read Files.ReadWrite.All';
const redirect = () => location.origin + location.pathname;
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function pkce() {
  const v = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const c = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  return { v, c };
}
export async function signIn(silent = false) {
  if (!CONFIG.clientId) throw new Error('Λείπει το Application ID (config.js).');
  const { v, c } = await pkce(); const st = Math.random().toString(36).slice(2);
  sessionStorage.setItem('pkce', JSON.stringify({ v, st, back: location.hash }));
  const q = new URLSearchParams({ client_id: CONFIG.clientId, response_type: 'code', redirect_uri: redirect(), scope: SCOPES,
    code_challenge: c, code_challenge_method: 'S256', state: st, response_mode: 'query' });
  if (silent) q.set('prompt', 'none');
  location.assign(`${AUTH}/authorize?${q}`);
}
async function tokenRequest(body) {
  const r = await fetch(`${AUTH}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CONFIG.clientId, scope: SCOPES, ...body }) });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.error_description || j.error), { code: j.error });
  const tok = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in - 120) * 1000 };
  await store.kv.set('token', tok); return tok;
}
/** called on start-up: finishes a sign-in redirect if there is one */
export async function handleRedirect() {
  const p = new URLSearchParams(location.search);
  if (!p.get('code') && !p.get('error')) return false;
  const saved = JSON.parse(sessionStorage.getItem('pkce') || '{}');
  history.replaceState(null, '', redirect() + (saved.back || ''));
  if (p.get('error')) { await store.kv.set('authError', p.get('error')); return false; }
  if (p.get('state') !== saved.st) return false;
  await tokenRequest({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirect(), code_verifier: saved.v });
  await store.kv.set('authError', null);
  return true;
}
async function accessToken() {
  let tok = await store.kv.get('token');
  if (!tok) throw Object.assign(new Error('Δεν έχεις συνδεθεί στο OneDrive.'), { code: 'signin' });
  if (Date.now() < tok.exp) return tok.access;
  try { tok = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tok.refresh }); return tok.access; }
  catch (e) { throw Object.assign(new Error('Η σύνδεση έληξε.'), { code: 'signin' }); }
}
export const signedIn = async () => !!(await store.kv.get('token'));
export async function signOut() { await store.kv.set('token', null); }

// ---------- OneDrive (Microsoft Graph) provider ----------
const G = 'https://graph.microsoft.com/v1.0';
async function g(path, opt = {}) {
  const tok = await accessToken();
  const r = await fetch(path.startsWith('http') ? path : G + path, { ...opt, headers: { Authorization: `Bearer ${tok}`, ...(opt.headers || {}) } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`OneDrive ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
export const OneDrive = {
  /** resolve a folder path like «Χαρά & Άλκης/Εφαρμογή»; works for own folders and folders shared with you (added as shortcut) */
  async folder(path, create = true) {
    const parts = path.split('/').filter(Boolean);
    let drive = null, item = null;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      let r = item ? await g(`/drives/${drive}/items/${item}:/${enc(name)}`) : await g(`/me/drive/root:/${enc(name)}`);
      let j = r && (await r.json());
      if (!j && i === 0) {   // shared with me (not added to My files)
        const sw = await (await g('/me/drive/sharedWithMe')).json();
        const hit = (sw.value || []).find((x) => x.name === name && x.remoteItem);
        if (hit) j = hit;
      }
      if (!j) {
        if (!create) return null;
        const parentUrl = item ? `/drives/${drive}/items/${item}/children` : '/me/drive/root/children';
        j = await (await g(parentUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }) })).json();
      }
      if (j.remoteItem) { drive = j.remoteItem.parentReference.driveId; item = j.remoteItem.id; }
      else { drive = j.parentReference.driveId; item = j.id; }
    }
    return { drive, item };
  },
  async list(f) {
    let url = `/drives/${f.drive}/items/${f.item}/children?$select=name,id,size&$top=500`, out = [];
    while (url) { const j = await (await g(url)).json(); out = out.concat(j.value); url = j['@odata.nextLink']; }
    return out;
  },
  async get(f, name) { const r = await g(`/drives/${f.drive}/items/${f.item}:/${enc(name)}:/content`); return r ? r.json() : null; },
  async del(f, name) { await g(`/drives/${f.drive}/items/${f.item}:/${enc(name)}`, { method: 'DELETE' }); },
  async put(f, name, data) {
    const body = JSON.stringify(data);
    if (body.length < 3.5e6) {
      await g(`/drives/${f.drive}/items/${f.item}:/${enc(name)}:/content`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
      return;
    }
    const s = await (await g(`/drives/${f.drive}/items/${f.item}:/${enc(name)}:/createUploadSession`, { method: 'POST' })).json();
    const bytes = new TextEncoder().encode(body); const CH = 3276800;
    for (let o = 0; o < bytes.length; o += CH) {
      const part = bytes.slice(o, o + CH);
      await fetch(s.uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${o}-${o + part.length - 1}/${bytes.length}` }, body: part });
    }
  },
};

// ---------- development provider (local test server) ----------
export const DevServer = (base) => ({
  async folder(path) { return { path }; },
  async list(f) { return (await (await fetch(`${base}/list?p=${encodeURIComponent(f.path)}`)).json()); },
  async get(f, name) { const r = await fetch(`${base}/get?p=${encodeURIComponent(f.path + '/' + name)}`); return r.ok ? r.json() : null; },
  async put(f, name, data) { await fetch(`${base}/put?p=${encodeURIComponent(f.path + '/' + name)}`, { method: 'POST', body: JSON.stringify(data) }); },
});

// ---------- the sync itself ----------
let running = null;
export function provider() { return CONFIG.devServer ? DevServer(CONFIG.devServer) : OneDrive; }

export async function syncAll(onStatus = () => {}) {
  if (running) return running;
  running = (async () => {
    const P = provider(); const res = { up: 0, down: 0, errors: [] };
    for (const sp of store.visibleSpaces()) {
      try {
        onStatus(`Συγχρονισμός: ${sp.name}…`);
        const root = await P.folder(sp.folder); const opsF = await P.folder(sp.folder + '/ops');
        // base snapshot
        if (!store.hasBase(sp.id)) {
          const b = await P.get(root, 'base.json'); if (b) await store.importBase(sp.id, b);
        } else if (!(await store.kv.get(`baseUp:${sp.id}`))) {
          const files = await P.list(root);
          if (!files.some((x) => x.name === 'base.json')) await P.put(root, 'base.json', await store.getBase(sp.id));
          await store.kv.set(`baseUp:${sp.id}`, true);
        }
        // upload my pending changes
        const pend = await store.pendingOps(sp.id);
        if (pend.length) {
          const name = `${store.state.device}-${Date.now().toString(36)}.json`;
          await P.put(opsF, name, { device: store.state.device, user: store.state.user, ops: pend.map(({ i, r, s, x, u, ux }) => ({ i, r, s, x, u, ...(ux ? { ux } : {}) })) });
          await store.markSynced(pend, name); res.up += pend.length;
        }
        // download everybody else's
        const seen = new Set((await store.kv.get(`seen:${sp.id}`)) || []);
        const files = (await P.list(opsF)).filter((x) => x.name.endsWith('.json') && !seen.has(x.name) && !x.name.startsWith(store.state.device + '-'));
        for (const fl of files) {
          const j = await P.get(opsF, fl.name);
          if (j && j.ops) { await store.applyRemote(sp.id, j.ops); res.down += j.ops.length; }
          seen.add(fl.name);
        }
        await store.kv.set(`seen:${sp.id}`, [...seen]);
        try { await autoBackup(P, sp); } catch (e) { console.warn('backup', e); }
      } catch (e) { res.errors.push(`${sp.name}: ${e.message}`); if (e.code === 'signin') { res.signin = true; break; } }
    }
    await store.kv.set('lastSync', Date.now());
    onStatus(''); return res;
  })();
  try { return await running; } finally { running = null; }
}
