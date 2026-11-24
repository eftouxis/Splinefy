// Γυμναστική → 💪 5/3/1: πλήρης προπόνηση (ζέσταμα → δύναμη → βοηθητικές → αποθεραπεία), καταγραφή κιλών/αίσθησης, ιστορικό
import { esc, dFull, today } from '../util.js';
import * as W from '../w531.js';
import { sheet } from './lessons/ui.js';

// ό,τι γράφεις στην τρέχουσα προπόνηση, μέχρι το «Έκανα την προπόνηση»: { lift: { w:[κιλά κύριων σετ], reps, feel, fw }, acc:{}, d, note }
const res = { acc: {} };

function setupBody() {
  return `<div class="card"><div class="mid" style="margin-bottom:6px">💪 5/3/1 — μία φορά την εβδομάδα</div>
    <div class="small muted" style="margin-bottom:10px">Βάλε τα μέγιστά σου (1 επανάληψη), όσο πιο κοντά τα θυμάσαι — δεν χρειάζεται να τα δοκιμάσεις. Το πρόγραμμα ξεκινάει στο ${Math.round(W.START_PCT * 100)}% τους και διορθώνεται μόνο του από το πώς πάνε τα σετ.</div>
    ${Object.entries(W.LIFTS).map(([k, n]) => `<label class="f"><span>${n} (kg)</span><input data-orm="${k}" inputmode="decimal"></label>`).join('')}
    <button class="btn primary" data-start style="width:100%;margin-top:6px">Ξεκίνα</button></div>`;
}
const plates = (w) => { const pl = W.plates(w); return pl.length ? 'ανά πλευρά ' + pl.map((x) => String(x).replace('.', ',')).join(' + ') : 'μόνο μπάρα'; };
const step = (n, t) => `<h2 style="margin-top:18px">${n}. ${t}</h2>`;
const line = 'border-bottom:1px solid var(--line,#2a3442)';

export function body() {
  const c = W.cfg(); if (!c) return setupBody();
  const s = W.session(c); const P = W.plan(c); const L = W.logs(); const day = s.step % 2;
  return `<div class="row" style="margin:4px 2px 2px"><div class="grow"><div class="mid">Μέρα ${s.dayName}: ${P.map((x) => W.LIFTS[x.lift]).join(' + ')}</div><div class="small muted">${W.WEEKS[s.wk].name} · κύκλος ${s.cycle} · προπόνηση ${s.n}/6 · ~60′</div></div><button class="btn sm ghost" data-tmedit>Κιλά</button></div>

  ${step(1, 'Ζέσταμα (8–10′)')}
  <div class="card">${W.WARMUP[day].map(([n, d]) => `<div style="margin:5px 0"><b>${esc(n)}</b> <span class="small muted">· ${esc(d)}</span></div>`).join('')}</div>

  ${step(2, 'Δύναμη')}
  <div class="small muted" style="margin:0 4px 8px">${W.REST}. Αν ένα σετ δεν βγαίνει, γράψε στο κουτάκι τα κιλά που σήκωσες.</div>
  ${P.map((x) => { const r = res[x.lift] || {}; return `<div class="card">
    <div class="row"><div class="grow mid">${W.LIFTS[x.lift]}</div><div class="small muted">TM ${W.kg(x.tm)}</div></div>
    <details style="margin:6px 0"><summary class="small">Πώς γίνεται</summary><ul class="small" style="margin:6px 0 0 18px;padding:0">${W.CUES[x.lift].map((q) => `<li style="margin:3px 0">${esc(q)}</li>`).join('')}</ul></details>
    <div class="small muted" style="margin-top:6px">Ζέσταμα με μπάρα</div>
    ${x.warm.map((w) => `<div class="row small" style="padding:4px 0;${line}"><b style="width:76px">${W.kg(w.w)}</b><span style="width:44px">× ${w.r}</span><span class="grow muted">${plates(w.w)}</span></div>`).join('')}
    <div class="small muted" style="margin-top:10px">Κύρια σετ — στο τελευταίο κάνεις όσες περισσότερες βγαίνουν καθαρά</div>
    ${x.main.map((m, i) => `<div class="row" style="gap:6px;padding:5px 0;${line}">
      <input data-w="${x.lift}|${i}" inputmode="decimal" value="${esc(String(r.w?.[i] ?? m.w).replace('.', ','))}" style="width:70px;padding:6px"><span class="small">kg</span>
      ${m.plus ? `<span class="small">×</span><input data-reps="${x.lift}" inputmode="numeric" value="${esc(r.reps ?? '')}" placeholder="${m.r}+" style="width:58px;padding:6px">` : `<span class="small" style="width:58px">× ${m.r}</span>`}
      <span class="grow small muted">${plates(m.w)}</span></div>`).join('')}
    <div class="small muted" style="margin-top:10px">Έξτρα όγκος: ${x.fsl.sets} × ${x.fsl.reps}</div>
    <div class="row" style="gap:6px;padding:5px 0"><input data-fw="${x.lift}" inputmode="decimal" value="${esc(String(r.fw ?? x.fsl.w).replace('.', ','))}" style="width:70px;padding:6px"><span class="small">kg</span><span class="grow small muted">${plates(x.fsl.w)}</span></div>
    <div class="small muted" style="margin-top:8px">Πώς ήταν;</div>
    <div class="chips" style="margin-top:4px">${W.FEEL.map(([k, l]) => `<button class="chip ${r.feel === k ? 'on' : ''}" data-feel="${x.lift}|${k}">${l}</button>`).join('')}</div>
  </div>`; }).join('')}

  ${step(3, 'Βοηθητικές (πλάτη, κοιλιακοί)')}
  <div class="card">${W.ACC[day].map(([n, d, how], i) => `<div style="margin:6px 0 10px"><b>${esc(n)}</b> <span class="small muted">· ${esc(d)}</span>
    <div class="small muted" style="margin:2px 0 4px">${esc(how)}</div>
    <input data-acc="${i}" value="${esc(res.acc[i] ?? '')}" placeholder="τι έκανες (π.χ. 5, 5, 4, 4, 3)" style="padding:6px"></div>`).join('')}</div>

  ${step(4, 'Αποθεραπεία')}
  <div class="card small">${esc(W.COOL)}</div>

  <div class="card" style="margin-top:14px">
    <label class="f"><span>Ημερομηνία</span><input type="date" data-d value="${esc(res.d || today())}"></label>
    <label class="f"><span>Σημείωση (προαιρετικά)</span><input data-note value="${esc(res.note || '')}" placeholder="π.χ. ο αστράγαλος οκ, κουρασμένος"></label>
    <button class="btn primary" data-finish style="width:100%">✓ Έκανα την προπόνηση</button>
    <button class="btn ghost" data-skip style="width:100%;margin-top:6px">Παράλειψη αυτής</button></div>

  ${L.length ? `<h2>Ιστορικό</h2><div class="list">${L.slice(0, 30).map((g) => `<div class="item"><div class="grow"><div class="t">${W.LIFTS[g.lift]} · ${W.kg(g.w)} × ${g.reps ?? '—'}</div><div class="s">${dFull(g.d)} · ${W.WEEKS[g.wk]?.name || ''}${g.e1rm ? ` · ≈ ${W.kg(g.e1rm)} μέγιστο` : ''}</div></div><div>${(W.FEEL.find((f) => f[0] === g.feel) || ['', ''])[1].split(' ')[0]}</div></div>`).join('')}</div>` : ''}`;
}

function tmSheet(ui) {
  const c = W.cfg();
  sheet(`<div class="mid">Training max (kg)</div><div class="small muted" style="margin:4px 0 10px">Από αυτά βγαίνουν όλα τα κιλά. Άλλαξέ τα αν κάτι είναι πολύ βαρύ ή πολύ ελαφρύ.</div>
    ${Object.entries(W.LIFTS).map(([k, n]) => `<label class="f"><span>${n}</span><input data-tm="${k}" inputmode="decimal" value="${String(c.tm[k]).replace('.', ',')}"></label>`).join('')}
    <button class="btn primary" data-ok style="width:100%">Αποθήκευση</button><button class="btn ghost" data-no style="width:100%;margin-top:6px">Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => {
      const tm = {}; for (const k of Object.keys(W.LIFTS)) { const v = Number(el.querySelector(`[data-tm="${k}"]`).value.replace(',', '.')); if (!(v > 0)) { ui.toast('Βάλε κιλά σε όλα'); return; } tm[k] = W.round(v); }
      await W.setTM(tm); close(); ui.render();
    };
  });
}

const numv = (v) => Number(String(v).replace(',', '.'));
export function mount(root, ui) {
  root.querySelector('[data-start]')?.addEventListener('click', async () => {
    const orm = {}; for (const k of Object.keys(W.LIFTS)) { const v = numv(root.querySelector(`[data-orm="${k}"]`).value || ''); if (!(v > 0)) { ui.toast(`Βάλε κιλά στο ${W.LIFTS[k]}`); return; } orm[k] = v; }
    await W.setup(orm); ui.render();
  });
  const L = (l) => (res[l] ||= {});
  root.querySelectorAll('[data-w]').forEach((i) => i.addEventListener('input', () => { const [l, k] = i.dataset.w.split('|'); (L(l).w ||= [])[Number(k)] = numv(i.value) || null; }));
  root.querySelectorAll('[data-reps]').forEach((i) => i.addEventListener('input', () => { L(i.dataset.reps).reps = i.value; }));
  root.querySelectorAll('[data-fw]').forEach((i) => i.addEventListener('input', () => { L(i.dataset.fw).fw = numv(i.value) || null; }));
  root.querySelectorAll('[data-acc]').forEach((i) => i.addEventListener('input', () => { res.acc[i.dataset.acc] = i.value; }));
  root.querySelector('[data-d]')?.addEventListener('change', (e) => { res.d = e.target.value; });
  root.querySelector('[data-note]')?.addEventListener('input', (e) => { res.note = e.target.value; });
  root.querySelectorAll('[data-feel]').forEach((b) => b.addEventListener('click', () => { const [l, f] = b.dataset.feel.split('|'); L(l).feel = f; root.querySelectorAll(`[data-feel^="${l}|"]`).forEach((x) => x.classList.toggle('on', x === b)); }));
  root.querySelector('[data-tmedit]')?.addEventListener('click', () => tmSheet(ui));
  root.querySelector('[data-skip]')?.addEventListener('click', async () => { if (await ui.confirm('Να πάει στην επόμενη προπόνηση χωρίς καταγραφή;', 'Ναι')) { await W.skip(); ui.render(); } });
  root.querySelector('[data-finish]')?.addEventListener('click', async () => {
    const P = W.plan(); const s = W.session();
    const miss = P.filter((x) => { const v = res[x.lift]?.reps; return (v == null || v === '' || !Number.isFinite(Number(v))) && res[x.lift]?.feel !== 'pain'; });
    if (miss.length) { ui.toast(`Γράψε πόσες έκανες στο τελευταίο σετ (${miss.map((x) => W.LIFTS[x.lift]).join(', ')})`, 3500); return; }
    const nf = P.filter((x) => !res[x.lift]?.feel); if (nf.length) { ui.toast(`Πες πώς ήταν (${nf.map((x) => W.LIFTS[x.lift]).join(', ')})`, 3000); return; }
    const acc = W.ACC[s.step % 2].map(([n], i) => [n, (res.acc[i] || '').trim()]).filter(([, v]) => v);
    const pain = P.some((x) => res[x.lift]?.feel === 'pain');
    const ch = await W.finish(Object.fromEntries(P.map((x) => [x.lift, { ...res[x.lift], reps: Number(res[x.lift]?.reps) }])), { d: res.d || today(), acc, note: (res.note || '').trim() });
    for (const k of Object.keys(res)) delete res[k]; res.acc = {};
    ui.toast(`Μπήκε στις Προπονήσεις ✓ · ${pain ? 'με πόνο δεν ανεβαίνουν κιλά — αν συνεχίζει, φυσικοθεραπευτής' : ch.length ? ch.join(' · ') : `επόμενη: Μέρα ${W.session().dayName}`}`, 5500); ui.render();
  });
}
