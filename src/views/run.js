// Γυμναστική → 🏃 Τρέξιμο: η εβδομάδα του προγράμματος, «πώς ήταν;», κανόνες, ιστορικό
import { esc, dFull } from '../util.js';
import * as R from '../run.js';

let sel = null, pain = null, feel = null;
const lines = (t) => t.split(/\s+-\s+/).map((x) => `<div>${esc(x)}</div>`).join('');

export function body() {
  const p = R.plan();
  if (!p) return '<div class="card muted center">Δεν υπάρχει πρόγραμμα ακόμα — πέρασε το αρχείο του από Ρυθμίσεις → Εισαγωγή.</div>';
  const w = R.week(); if (sel == null || sel >= w.s.length) sel = w.best;
  const L = R.logs();
  return `<div class="row" style="margin:4px 2px 4px"><div class="grow"><div class="mid">Εβδομάδα ${w.w} <span class="small muted">από ${w.total}</span></div><div class="small muted">${esc(w.phase)}</div></div>
    <button class="btn sm ghost" data-rw="-1" ${w.i ? '' : 'disabled'}>◀</button><button class="btn sm ghost" data-rw="1" ${w.i < w.total - 1 ? '' : 'disabled'}>▶</button></div>
  <div style="height:6px;background:var(--line,#2a3442);border-radius:3px;margin:0 2px 10px"><div style="height:6px;width:${Math.round(w.i / Math.max(1, w.total - 1) * 100)}%;background:var(--brand,#2ecc9a);border-radius:3px"></div></div>
  ${w.note ? `<div class="small muted" style="margin:0 4px 8px">${esc(w.note)}</div>` : ''}
  ${w.done.length ? `<div class="small" style="margin:0 4px 8px;color:var(--green)">✓ Έγινε ήδη ${w.done.length === 1 ? 'ένα' : w.done.length} αυτή την εβδομάδα — μπορείς να κάνεις κι άλλο ή να πας στην επόμενη (▶)</div>` : ''}
  ${w.s.map((t, k) => `<div class="card click" data-rs="${k}" style="${k === sel ? 'outline:2px solid var(--brand,#2ecc9a)' : 'opacity:.75'}">
    <div class="row"><div class="grow small muted">${k === w.best ? '⭐ Προτεινόμενο' : `Επιλογή ${k + 1}`}${w.mins[k] && w.mins[k] < 999 ? ` · ~${w.mins[k]}′ τρέξιμο` : ''}</div>${w.done.some((g) => g.k === k) ? '<span class="small" style="color:var(--green)">✓</span>' : ''}</div>
    <div style="margin-top:4px;line-height:1.5">${lines(t)}</div></div>`).join('')}
  <div class="card"><div class="small muted">Πόνος στο γόνατο / αστράγαλο (0–10)</div>
    <div class="chips" style="margin:6px 0">${R.PAIN.map(([v, l, d]) => `<button class="chip ${pain === v ? 'on' : ''}" data-pain="${v}">${l} <span class="small muted">${d}</span></button>`).join('')}</div>
    <div class="chips">${R.FEEL.map(([k, l]) => `<button class="chip ${feel === k ? 'on' : ''}" data-rfeel="${k}">${l}</button>`).join('')}</div>
    <button class="btn primary" data-rdone style="width:100%;margin-top:10px">✓ Το έκανα</button></div>
  <details class="card"><summary class="small">ℹ️ Κανόνες πόνου, τεχνική, λεξικό</summary>
    ${[['Κανόνας πόνου', p.rules?.pain], ['Συμβουλές', p.rules?.tips], ['Λεξικό', p.rules?.dict]].filter((x) => x[1]).map(([h, l]) => `<div class="small" style="margin-top:8px"><b>${h}</b>${l.map(([a, b]) => `<div style="margin-top:3px"><b>${esc(a)}</b>: ${esc(b)}</div>`).join('')}</div>`).join('')}</details>
  ${L.length ? `<h2>Ιστορικό τρεξίματος</h2><div class="list">${L.slice(0, 30).map((g) => `<div class="item"><div class="grow"><div class="t">Εβδ. ${p.weeks[g.wk]?.w ?? g.wk + 1}${g.min && g.min < 999 ? ` · ~${g.min}′ τρέξιμο` : ''}</div><div class="s">${dFull(g.d)} · πόνος ${g.pain === 0 ? '0–2' : g.pain === 3 ? '3–4' : '5+'}</div></div><div>${(R.FEEL.find((f) => f[0] === g.feel) || [''])[1]?.split(' ')[0] || ''}</div></div>`).join('')}</div>` : ''}`;
}

export function mount(root, ui) {
  root.querySelectorAll('[data-rs]').forEach((c) => c.addEventListener('click', () => { sel = Number(c.dataset.rs); ui.render(); }));
  root.querySelectorAll('[data-pain]').forEach((b) => b.addEventListener('click', () => { pain = Number(b.dataset.pain); root.querySelectorAll('[data-pain]').forEach((x) => x.classList.toggle('on', x === b)); }));
  root.querySelectorAll('[data-rfeel]').forEach((b) => b.addEventListener('click', () => { feel = b.dataset.rfeel; root.querySelectorAll('[data-rfeel]').forEach((x) => x.classList.toggle('on', x === b)); }));
  root.querySelectorAll('[data-rw]').forEach((b) => b.addEventListener('click', async () => { await R.go(R.prog().wk + Number(b.dataset.rw)); sel = null; ui.render(); }));
  root.querySelector('[data-rdone]')?.addEventListener('click', async () => {
    if (pain == null) { ui.toast('Πες πρώτα αν πόνεσε (0–2 / 3–4 / 5+)'); return; }
    const msg = await R.done(sel, pain, feel); sel = null; pain = null; feel = null;
    ui.toast(`Μπήκε στις Προπονήσεις ✓ · ${msg}`, 4500); ui.render();
  });
}
