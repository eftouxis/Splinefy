// #/cats — categories and «Είδος» keywords (shared settings, both of you see them)
import { esc } from '../util.js';
import * as store from '../store.js';
import { ICON } from './common.js';

export default {
  live: true,
  html() {
    const st = store.setting(); const cats = st.cats || []; const kw = st.billKw || [];
    const n = new Map(); for (const r of store.records('tx')) n.set(r.cat, (n.get(r.cat) || 0) + 1);
    const block = (kind) => cats.map((c, i) => [c, i]).filter(([c]) => c.kind === kind).map(([c, i]) => `<div class="item" style="${c.hidden ? 'opacity:.45' : ''}">
      <div class="dot">${ICON[c.name] || '•'}</div><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${(n.get(c.name) || 0).toLocaleString('el-GR')} κινήσεις${c.hidden ? ' · κρυμμένη' : ''}</div></div>
      <button class="btn sm" data-hide="${i}">${c.hidden ? 'Εμφάνιση' : 'Απόκρυψη'}</button></div>`).join('');
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Κατηγορίες</h1></div>
    <h2>Έξοδα</h2><div class="list">${block('Έξοδο')}</div>
    <h2>Έσοδα</h2><div class="list">${block('Έσοδο')}</div>
    <div class="card" style="margin-top:12px"><div class="mid" style="margin-bottom:8px">Νέα κατηγορία</div>
      <div class="grid2"><input name="nc" placeholder="π.χ. Γυμναστήριο"><select name="nk"><option>Έξοδο</option><option>Έσοδο</option></select></div>
      <button class="btn primary" style="width:100%;margin-top:8px" data-add>Προσθήκη</button>
      <div class="small muted" style="margin-top:6px">«Απόκρυψη» = δεν βγαίνει στις επιλογές· οι παλιές κινήσεις της μένουν.</div></div>
    <h2>«Είδος» λογαριασμών (από λέξη στην περιγραφή)</h2>
    <div class="list">${kw.map(([k, v], i) => `<div class="item"><div class="grow"><div class="t">«${esc(k)}» → ${esc(v)}</div></div><button class="btn sm" data-delkw="${i}">✕</button></div>`).join('')}</div>
    <div class="card" style="margin-top:10px"><div class="grid2"><input name="kk" placeholder="λέξη, π.χ. δεη"><input name="kv" list="kinds" placeholder="είδος, π.χ. Ρεύμα"></div>
      <datalist id="kinds">${[...new Set(kw.map((x) => x[1]))].map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
      <button class="btn primary" style="width:100%;margin-top:8px" data-addkw>Προσθήκη</button></div>`;
  },
  mount(root, p, ui) {
    const st = () => store.setting();
    const save = (fields) => store.put('shared', 'settings', { type: 'settings', ...fields });
    root.querySelector('[data-back]').addEventListener('click', () => ui.go('#/settings'));
    root.querySelectorAll('[data-hide]').forEach((b) => b.addEventListener('click', async () => {
      const cats = (st().cats || []).map((c) => ({ ...c })); const c = cats[Number(b.dataset.hide)]; c.hidden = !c.hidden || undefined; await save({ cats });
    }));
    root.querySelector('[data-add]').addEventListener('click', async () => {
      const name = root.querySelector('[name=nc]').value.trim(), kind = root.querySelector('[name=nk]').value;
      if (!name) return; const cats = st().cats || [];
      if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) { ui.toast('Υπάρχει ήδη'); return; }
      await save({ cats: [...cats, { name, kind }] }); ui.toast('Προστέθηκε ✓');
    });
    root.querySelectorAll('[data-delkw]').forEach((b) => b.addEventListener('click', async () => {
      const kw = [...(st().billKw || [])]; kw.splice(Number(b.dataset.delkw), 1); await save({ billKw: kw });
    }));
    root.querySelector('[data-addkw]').addEventListener('click', async () => {
      const k = root.querySelector('[name=kk]').value.trim().toLowerCase(), v = root.querySelector('[name=kv]').value.trim();
      if (!k || !v) return; await save({ billKw: [...(st().billKw || []), [k, v]] }); ui.toast('Προστέθηκε ✓');
    });
  },
};
