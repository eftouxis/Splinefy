// Γυμναστική → 💪 5/3/1: η σημερινή προπόνηση, «πώς ήταν;», ιστορικό, κιλά
import { esc, dFull } from '../util.js';
import * as W from '../w531.js';
import { sheet } from './lessons/ui.js';

const res = {};      // επαναλήψεις / αίσθηση της τρέχουσας προπόνησης (μέχρι να πατηθεί «Τέλος»)

function setupBody() {
  return `<div class="card"><div class="mid" style="margin-bottom:6px">💪 5/3/1 — μία φορά την εβδομάδα</div>
    <div class="small muted" style="margin-bottom:10px">Βάλε τα μέγιστά σου (1 επανάληψη). Το πρόγραμμα ξεκινάει στο ${Math.round(W.START_PCT * 100)}% τους.</div>
    ${Object.entries(W.LIFTS).map(([k, n]) => `<label class="f"><span>${n} (kg)</span><input data-orm="${k}" inputmode="decimal"></label>`).join('')}
    <button class="btn primary" data-start style="width:100%;margin-top:6px">Ξεκίνα</button></div>`;
}

function setRow(s, cls = '') {
  const pl = W.plates(s.w);
  return `<tr class="${cls}"><td><b>${W.kg(s.w)}</b></td><td class="r">× ${s.r}${s.plus ? '+' : ''}</td><td class="small muted" style="white-space:normal">${pl.length ? 'ανά πλευρά ' + pl.map((x) => String(x).replace('.', ',')).join(' + ') : 'μόνο μπάρα'}</td></tr>`;
}

export function body() {
  const c = W.cfg(); if (!c) return setupBody();
  const s = W.session(c); const P = W.plan(c);
  const L = W.logs();
  return `<div class="row" style="margin:4px 2px 8px"><div class="grow"><div class="mid">Μέρα ${s.dayName} · ${W.WEEKS[s.wk].name}</div><div class="small muted">Κύκλος ${s.cycle} · προπόνηση ${s.n}/6</div></div><button class="btn sm ghost" data-tmedit>Κιλά</button></div>
  ${P.map((x) => { const r = res[x.lift] || {}; return `<div class="card">
    <div class="row"><div class="grow mid">${W.LIFTS[x.lift]}</div><div class="small muted">TM ${W.kg(x.tm)}</div></div>
    <table class="t st" style="margin-top:6px;width:100%;table-layout:fixed"><colgroup><col style="width:30%"><col style="width:18%"><col></colgroup>
      <tr><td colspan="3" class="small muted" style="white-space:normal">Ζέσταμα</td></tr>${x.warm.map((w) => setRow(w, 'muted')).join('')}
      <tr><td colspan="3" class="small muted" style="padding-top:8px;white-space:normal">Κύρια σετ — το τελευταίο: όσες περισσότερες βγαίνουν καθαρά</td></tr>${x.main.map((m) => setRow(m)).join('')}
      <tr><td colspan="3" class="small muted" style="padding-top:8px;white-space:normal">Έξτρα όγκος: ${x.fsl.sets} × ${x.fsl.reps} με ${W.kg(x.fsl.w)}</td></tr>
    </table>
    <div class="row" style="gap:8px;margin-top:10px"><span class="small">Τελευταίο σετ:</span><input data-reps="${x.lift}" inputmode="numeric" value="${esc(r.reps ?? '')}" placeholder="επαν." style="width:80px"></div>
    <div class="chips" style="margin-top:6px">${W.FEEL.map(([k, l]) => `<button class="chip ${r.feel === k ? 'on' : ''}" data-feel="${x.lift}|${k}">${l}</button>`).join('')}</div>
  </div>`; }).join('')}
  <div class="card"><div class="small muted" style="margin-bottom:4px">Βοηθητικές</div>${W.ACC[s.step % 2].map(([n, d]) => `<div style="margin:4px 0"><b>${n}</b> <span class="small muted">· ${d}</span></div>`).join('')}</div>
  <button class="btn primary" data-finish style="width:100%">✓ Τέλος προπόνησης</button>
  <button class="btn ghost" data-skip style="width:100%;margin-top:6px">Παράλειψη αυτής</button>
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

export function mount(root, ui) {
  root.querySelector('[data-start]')?.addEventListener('click', async () => {
    const orm = {}; for (const k of Object.keys(W.LIFTS)) { const v = Number((root.querySelector(`[data-orm="${k}"]`).value || '').replace(',', '.')); if (!(v > 0)) { ui.toast(`Βάλε κιλά στο ${W.LIFTS[k]}`); return; } orm[k] = v; }
    await W.setup(orm); ui.render();
  });
  root.querySelectorAll('[data-reps]').forEach((i) => i.addEventListener('input', () => { (res[i.dataset.reps] ||= {}).reps = i.value; }));
  root.querySelectorAll('[data-feel]').forEach((b) => b.addEventListener('click', () => { const [l, f] = b.dataset.feel.split('|'); (res[l] ||= {}).feel = f; root.querySelectorAll(`[data-feel^="${l}|"]`).forEach((x) => x.classList.toggle('on', x === b)); }));
  root.querySelector('[data-tmedit]')?.addEventListener('click', () => tmSheet(ui));
  root.querySelector('[data-skip]')?.addEventListener('click', async () => { if (await ui.confirm('Να πάει στην επόμενη προπόνηση χωρίς καταγραφή;', 'Ναι')) { await W.skip(); ui.render(); } });
  root.querySelector('[data-finish]')?.addEventListener('click', async () => {
    const P = W.plan(); const miss = P.filter((x) => { const v = res[x.lift]?.reps; return (v == null || v === '' || !Number.isFinite(Number(v))) && res[x.lift]?.feel !== 'pain'; });
    if (miss.length) { ui.toast(`Γράψε πόσες έκανες στο τελευταίο σετ (${miss.map((x) => W.LIFTS[x.lift]).join(', ')})`, 3500); return; }
    const ch = await W.finish(Object.fromEntries(P.map((x) => [x.lift, { reps: Number(res[x.lift]?.reps), feel: res[x.lift]?.feel }])));
    const pain = P.some((x) => res[x.lift]?.feel === 'pain');
    for (const k of Object.keys(res)) delete res[k];
    ui.toast(pain ? 'Με πόνο δεν ανεβαίνουν κιλά — αν συνεχίζει, ρώτα φυσικοθεραπευτή' : ch.length ? `Καλή δουλειά 💪 · ${ch.join(' · ')}` : 'Καλή δουλειά 💪 · Επόμενη: ' + `Μέρα ${W.session().dayName}`, 5000); ui.render();
  });
}
