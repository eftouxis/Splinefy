// Κάρτες: QR και barcodes (πόντοι, γυμναστήριο, σταθμός…). Κάθε κάρτα είναι κάποιου (who) ή κοινή (who = null).
// Δικές μου και «μόνο εγώ» → στον προσωπικό μου χώρο (δεν φτάνουν στον άλλο)· όλες οι άλλες → στον κοινό.
// Τίποτα από τα δεδομένα δεν είναι στον κώδικα: μπαίνουν από την εφαρμογή ή με εισαγωγή του αρχείου του Catima.
import * as store from './store.js';
import { norm } from './util.js';

export const mySpace = () => store.state.spaces.find((s) => s.owner === store.state.user && s.members.length === 1)?.id || null;
export const people = () => (store.DEFAULT_SPACES.find((s) => s.id === 'shared')?.members || []).slice();
export const all = () => store.records('card');
/** η σειρά: ⭐ πρώτες, μετά όσες άνοιξες πιο πρόσφατα */
export const sorted = (l = all()) => l.slice().sort((a, b) => (b.star ? 1 : 0) - (a.star ? 1 : 0) || (b.used || 0) - (a.used || 0) || (a.name || '').localeCompare(b.name || '', 'el'));
export const isPrivate = (c) => c._sp !== 'shared';
export const pinOf = (c) => (c.pin || {})[store.state.user] || null;
export const byPin = (n) => all().find((c) => Number(pinOf(c)) === Number(n)) || null;
export const nrm = (x) => norm(x).replace(/ς/g, 'σ');
export async function opened(c) { await store.put(c._sp, c.id, { used: Date.now() }); }
/** ένα «📌 N» ανά άτομο: όποια άλλη το είχε, το χάνει */
export async function setPin(c, n) {
  const me = store.state.user;
  for (const x of all()) if (x.id !== c.id && Number((x.pin || {})[me]) === Number(n) && n) { const p = { ...(x.pin || {}) }; delete p[me]; await store.put(x._sp, x.id, { pin: p }); }
  const p = { ...(c.pin || {}) }; if (n) p[me] = Number(n); else delete p[me];
  await store.put(c._sp, c.id, { pin: p });
}
export const hex = (argb) => `#${((Number(argb) >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
/** κείμενο πάνω στο χρώμα: λευκό ή μαύρο */
export const ink = (h) => { const n = parseInt(String(h || '#888').slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff'; };

// ---------- εισαγωγή από Catima (.zip ή catima.csv) ----------
function csvRows(t) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += ch; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
/** μόνο οι κάρτες: το τμήμα με επικεφαλίδα _id, store, … cardid */
export function parseCatima(text) {
  const rows = csvRows(text.replace(/^﻿/, '')); let head = null; const out = [];
  for (const r of rows) {
    if (r.length === 1 && r[0] === '') { head = null; continue; }
    if (!head) { if (r.includes('cardid') && r.includes('store')) head = r; else head = r.length ? ['?'] : null; continue; }
    if (head[0] === '?') continue;
    const o = Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])); if (!o.cardid) continue;
    out.push({ cid: o._id, name: o.store || 'Κάρτα', code: o.cardid, alt: o.barcodeid || null, fmt: o.barcodetype || 'QR_CODE', color: o.headercolor ? hex(o.headercolor) : null,
      note: o.note || null, star: o.starstatus === '1' ? 1 : null, arch: o.archive === '1' ? 1 : null, used: o.lastused ? Number(o.lastused) * 1000 : null, exp: o.expiry ? Number(o.expiry) : null });
  }
  return out;
}
// ελάχιστο zip: κεντρικός κατάλογος + inflate του browser
async function unzip(buf) {
  const v = new DataView(buf); let e = buf.byteLength - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Δεν είναι αρχείο zip');
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const files = new Map();
  for (let i = 0; i < n; i++) {
    const meth = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nl)); p += 46 + nl + xl + cl;
    files.set(name.split('/').pop(), async () => {
      const ds = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true); const raw = new Uint8Array(buf, ds, csize);
      if (meth === 0) return raw;
      if (meth !== 8) throw new Error('Άγνωστη συμπίεση');
      return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    });
  }
  return files;
}
/** μικρό εικονίδιο (96px) ως data URL, για να μη βαραίνει ο συγχρονισμός */
async function tinyIcon(bytes) {
  try { const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' })); const s = 96, k = Math.min(s / bmp.width, s / bmp.height);
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const u = cv.toDataURL('image/webp', 0.8); return u.startsWith('data:image/webp') ? u : cv.toDataURL('image/png'); } catch (_) { return null; }
}
/** διάβασε το αρχείο → λίστα καρτών (χωρίς να αποθηκεύσει) */
export async function readFile(file) {
  if (/\.csv$/i.test(file.name)) return parseCatima(await file.text());
  const files = await unzip(await file.arrayBuffer());
  const csv = files.get('catima.csv') || [...files].find(([k]) => /\.csv$/i.test(k))?.[1];
  if (!csv) throw new Error('Δεν βρέθηκε catima.csv μέσα στο zip');
  const list = parseCatima(new TextDecoder().decode(await csv()));
  for (const c of list) { const f = files.get(`card_${c.cid}_icon.png`); if (f) c.icon = await tinyIcon(await f()); }
  return list;
}
/** αποθήκευση: χωρίς διπλά (ίδιος κωδικός + τύπος → ενημερώνεται) */
export async function importCards(list) {
  let n = 0;
  for (const c of list) {
    const { cid, keep, priv, ...f } = c; if (keep === false) continue;
    const old = all().find((x) => x.code === f.code && x.fmt === f.fmt);
    const sp = priv && mySpace() ? mySpace() : 'shared';
    const rec = { type: 'card', ...f, who: f.who ?? null, src: 'catima' };
    if (old) { if (old._sp !== sp) await store.move(old._sp, sp, { ...old, ...rec }); else await store.put(old._sp, old.id, rec); }
    else await store.put(sp, null, rec);
    n++;
  }
  return n;
}
