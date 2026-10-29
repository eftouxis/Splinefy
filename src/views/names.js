// #/names — one spelling for each description: suggested groups (same words, different case/accents/order) + rename by hand
import { esc, norm } from '../util.js';
import * as store from '../store.js';
import { sheet } from './lessons/ui.js';

const key1 = (s) => norm(s).replace(/[.,;:!()«»"'’\-–_/]+/g, ' ').replace(/\s+/g, ' ').trim();
const key2 = (s) => key1(s).split(' ').sort().join(' ');
let q = '';
/** every editable record that carries a name: movements (desc) and recurring items (name) */
function items() {
  const out = [];
  for (const r of store.records('tx')) if (r.desc && store.state.data[r._sp]?.recs.has(r.id)) out.push({ r, f: 'desc', v: r.desc });
  for (const r of store.records('rec')) if (r.name) out.push({ r, f: 'name', v: r.name });
  return out;
}
function groups() {
  const g = new Map();
  for (const it of items()) { const k = key2(it.v); if (!k) continue; let x = g.get(k); if (!x) g.set(k, (x = new Map())); const sp = it.v.trim(); x.set(sp, (x.get(sp) || 0) + 1); }
  return [...g.entries()].filter(([, m]) => m.size > 1).map(([k, m]) => ({ k, vars: [...m.entries()].sort((a, b) => b[1] - a[1]) })).sort((a, b) => b.vars.reduce((s, v) => s + v[1], 0) - a.vars.reduce((s, v) => s + v[1], 0));
}
async function renameWhere(match, to) {
  const by = new Map(); let n = 0;
  for (const it of items()) if (match(it.v) && it.v !== to) { if (!by.has(it.r._sp)) by.set(it.r._sp, []); by.get(it.r._sp).push({ id: it.r.id, set: { [it.f]: to } }); n++; }
  for (const [sp, ch] of by) for (let i = 0; i < ch.length; i += 500) await store.putMany(sp, ch.slice(i, i + 500));
  return n;
}
export default {
  live: true,
  html() {
    const gs = groups().slice(0, 60);
    const all = new Map(); for (const it of items()) { const s = it.v.trim(); all.set(s, (all.get(s) || 0) + 1); }
    const n = key1(q); const found = n ? [...all.entries()].filter(([s]) => key1(s).includes(n)).sort((a, b) => b[1] - a[1]).slice(0, 40) : [];
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Ενιαία ονόματα</h1></div>
    <div class="note small" style="margin-bottom:12px">Για να γράφεται κάθε έξοδο πάντα με τον ίδιο τρόπο. Αλλάζει μόνο το όνομα (περιγραφή) — ποσά, ημερομηνίες και κατηγορίες μένουν ίδια. Από εδώ και πέρα, όσο γράφεις, η εφαρμογή σού προτείνει τα ονόματα που ήδη υπάρχουν.</div>
    <h2>Μετονομασία</h2>
    <input type="search" name="q" placeholder="🔍 Βρες ένα όνομα (π.χ. cosmote)" value="${esc(q)}" style="margin-bottom:8px">
    ${n ? `<div class="list">${found.map(([s, c]) => `<div class="item" data-ren="${esc(s)}"><div class="grow"><div class="t">${esc(s)}</div><div class="s">${c} ${c === 1 ? 'φορά' : 'φορές'}</div></div><div class="small" style="color:var(--teal)">Αλλαγή ›</div></div>`).join('') || '<div class="item muted">Τίποτα</div>'}</div>
      ${found.length > 1 ? `<button class="btn" style="width:100%;margin-top:8px" data-renall>Όλα τα παραπάνω (${found.length}) → ένα όνομα</button>` : ''}` : ''}
    <h2>Προτάσεις (${gs.length}) <span class="small muted">· ίδιες λέξεις, άλλη γραφή</span></h2>
    <div class="list">${gs.map((g, i) => `<div class="item" style="display:block"><div class="chips" data-g="${i}" style="margin-bottom:8px">${g.vars.map(([s, c], j) => `<button class="chip ${j === 0 ? 'on' : ''}" data-v="${esc(s)}">${esc(s)} <span class="muted">${c}</span></button>`).join('')}</div>
      <div class="row"><span class="small muted grow">Διάλεξε τη σωστή γραφή</span><button class="btn sm primary" data-merge="${i}">Ενοποίηση</button></div></div>`).join('') || '<div class="item muted">Όλα εντάξει 👍</div>'}</div>`;
  },
  mount(root, p, ui) {
    root.querySelector('[data-back]').addEventListener('click', () => ui.go('#/settings'));
    const qi = root.querySelector('[name=q]');
    qi.addEventListener('input', () => { q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { ui.render(); const x = document.querySelector('[name=q]'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); });
    const gs = groups().slice(0, 60);
    root.querySelectorAll('[data-g]').forEach((c) => c.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; c.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); }));
    root.querySelectorAll('[data-merge]').forEach((b) => b.addEventListener('click', async () => {
      const g = gs[Number(b.dataset.merge)]; const to = root.querySelector(`[data-g="${b.dataset.merge}"] .chip.on`).dataset.v;
      const n = await renameWhere((v) => key2(v) === g.k, to); ui.toast(`${n} αλλαγές → «${to}» ✓`);
    }));
    const ask = (title, from, match) => sheet(`<div class="mid">${title}</div>
      <label class="f" style="margin-top:10px"><span>Νέο όνομα</span><input name="to" value="${esc(from)}"></label>
      <button class="btn primary" data-ok>Αλλαγή παντού</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
      el.querySelector('[data-no]').onclick = close;
      el.querySelector('[data-ok]').onclick = async () => { const to = el.querySelector('[name=to]').value.trim(); if (!to) return; const n = await renameWhere(match, to); close(); ui.toast(`${n} αλλαγές ✓`); };
      setTimeout(() => el.querySelector('[name=to]').select(), 50);
    });
    root.querySelectorAll('[data-ren]').forEach((b) => b.addEventListener('click', () => { const s = b.dataset.ren; ask(`«${esc(s)}» →`, s, (v) => v.trim() === s); }));
    root.querySelector('[data-renall]')?.addEventListener('click', () => { const n = key1(q); const list = [...root.querySelectorAll('[data-ren]')].map((x) => x.dataset.ren); ask(`${list.length} ονόματα με «${esc(q)}» →`, list[0], (v) => list.includes(v.trim()) && key1(v).includes(n)); });
  },
};
