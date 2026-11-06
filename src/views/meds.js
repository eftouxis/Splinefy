// #/meds — Φάρμακα: at set times of the day or every N hours, from a prescription, notification per medicine (none / email / phone)
// #/meds/<who> — only one person's. Names come from the data (users, the child's and the pet's booklets, medicines entered) — none in the code.
import { esc } from '../util.js';
import * as store from '../store.js';
import * as M from '../meds.js';
import * as H from '../health.js';
import * as P from '../pet.js';
import { sheet } from './lessons/ui.js';

const mySp = () => store.state.spaces.find((s) => s.owner === store.state.user && s.members.length === 1)?.id || null;
const child = () => H.profile().name || null;
const pet = () => (P.hasData() ? P.name() : null);
const ico = (who) => (who && who === pet() ? '🐕' : who && who === child() ? '👶' : '🧑');
const book = (who) => (who && who === pet() ? '#/pet' : who && who === child() ? '#/health' : null);
const num = (v) => Number(String(v ?? '').replace(',', '.')) || 0;
const people = () => [...new Set([...store.DEFAULT_SPACES.find((s) => s.id === 'shared').members, child(), pet(), ...M.all().map((m) => m.who)].filter(Boolean))];

// ---- pieces shared by the sheets ----
const whoPick = (cur) => `<label class="f"><span>Για ποιον</span><div class="chips" data-whos>${people().map((p) => `<button type="button" class="chip ${p === cur ? 'on' : ''}" data-who="${esc(p)}">${ico(p)} ${esc(p)}</button>`).join('')}
  <button type="button" class="chip" data-who="">+ Άλλος</button></div><input name="whoX" placeholder="Όνομα" style="margin-top:6px" hidden></label>`;
function bindWho(el, cur, onChange) {
  let who = cur || null;
  el.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => {
    el.querySelectorAll('[data-who]').forEach((x) => x.classList.toggle('on', x === b));
    const x = el.querySelector('[name=whoX]'); x.hidden = b.dataset.who !== ''; if (!x.hidden) x.focus();
    who = b.dataset.who || null; onChange?.(who);
  }));
  return () => (el.querySelector('[name=whoX]').hidden ? who : el.querySelector('[name=whoX]').value.trim() || null);
}
const spPick = (rec, who) => (mySp() ? `<label class="f"><span>Ποιος το βλέπει</span><select name="sp"><option value="shared" ${(rec ? rec._sp === 'shared' : who !== store.state.user) ? 'selected' : ''}>Και οι δύο</option><option value="${mySp()}" ${(rec ? rec._sp === mySp() : who === store.state.user) ? 'selected' : ''}>Μόνο εγώ</option></select></label>` : '');
const notifyPick = (m) => { const ch = !m ? 'mail' : !(m.mailTo || []).length ? 'none' : m.ch || 'mail';
  return `<div class="f"><span class="small muted" style="display:block;margin-bottom:6px">Ειδοποίηση για κάθε δόση</span>
    <div class="seg" data-ch>${[['none', 'Καμία'], ['mail', '📧 Email'], ['cal', '🔔 Κινητό']].map(([v, l]) => `<button type="button" data-val="${v}" class="${v === ch ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="f" data-chlead style="margin:8px 0 0" ${ch === 'none' ? 'hidden' : ''}><span>Πότε</span><select name="lead">${M.LEADS.map(([v, l]) => `<option value="${v}" ${v === Number(m?.lead || 0) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="row small" data-chwho style="margin:8px 2px 0;gap:16px" ${ch === 'none' ? 'hidden' : ''}>${['Άλκης', 'Χαρά'].map((u) => `<label class="row" style="gap:6px"><input type="checkbox" name="mail_${u}" style="width:auto" ${m ? ((m.mailTo || []).includes(u) ? 'checked' : '') : u === store.state.user ? 'checked' : ''}> ${u}</label>`).join('')}</div>
    <div class="small muted" data-chhint style="margin:6px 2px 0"></div></div>`; };
function bindNotify(el) {
  let ch = el.querySelector('[data-ch] .on')?.dataset.val || 'mail';
  const hint = () => { el.querySelector('[data-chwho]').hidden = ch === 'none'; el.querySelector('[data-chlead]').hidden = ch === 'none'; el.querySelector('[data-chhint]').textContent = ch === 'cal' ? 'Ειδοποίηση στο κινητό μέσω Google Ημερολογίου (ημερολόγιο «Splinefy») — από το ίδιο script των υπενθυμίσεων.' : ch === 'mail' ? 'Email για κάθε δόση.' : 'Χωρίς ειδοποίηση — φαίνεται μόνο στην εφαρμογή.'; };
  el.querySelectorAll('[data-ch] button').forEach((b) => b.addEventListener('click', () => { ch = b.dataset.val; el.querySelectorAll('[data-ch] button').forEach((x) => x.classList.toggle('on', x === b)); hint(); })); hint();
  return () => { const to = ch === 'none' ? [] : ['Άλκης', 'Χαρά'].filter((u) => el.querySelector(`[name=mail_${u}]`).checked); return { mailTo: to, ch: to.length ? ch : null, lead: to.length ? Number(el.querySelector('[name=lead]').value) || null : null }; };
}

// ---- medicine card ----
const card = (m, home = false) => {
  const s = M.status(m); const nx = s.next; const late = nx && M.tracked(m) && nx.at < Date.now() - 60000;
  const cur = nx && m.mode !== 'times' ? (m.phases || [])[nx.phase] : null; const nt = M.notifyTxt(m);
  const prog = m.mode === 'times' ? (M.tracked(m) ? `${s.done} δόθηκαν${s.total ? ` από ${s.total}` : ''}${s.missed ? ` · <span class="neg">${s.missed} χάθηκαν</span>` : ''}` : '') : `δόση ${s.done + 1} από ${s.total}`;
  return `<div class="${home ? '' : 'item'}" data-med="${esc(m.id)}" style="cursor:pointer;${home ? 'margin-top:8px' : ''}">
    <div class="grow"><div class="t" style="white-space:normal">💊 ${esc(m.name)}${m.who ? ` <span class="muted">· ${esc(m.who)}</span>` : ''}${nt ? ` <span class="small">${nt}</span>` : ''}</div>
      <div class="s" style="white-space:normal">${nx && !s.over ? `<span class="${late ? 'neg' : ''}"><b>Επόμενη: ${M.when(nx.at)}</b> (${M.inTxt(nx.at)})</span><br>${[prog, cur ? `κάθε ${String(cur.h).replace('.', ',')} ώρες` : home ? '' : M.schedTxt(m), m.dose ? esc(m.dose) : ''].filter(Boolean).join(' · ')}` : `τελείωσε · ${s.done} δόσεις`}</div></div>
    ${nx && !s.over && M.tracked(m) ? `<button type="button" class="btn sm primary" data-give="${esc(m.id)}" style="width:auto">✓ Δόθηκε</button>` : ''}</div>`;
};
export function medsCard() {
  const l = M.active().filter((m) => M.tracked(m) || (M.status(m).next?.at || 0) < Date.now() + 3 * 36e5); if (!l.length) return '';
  return `<div class="card" style="border-left:4px solid #5b8def"><div class="row"><b class="grow">💊 Φάρμακα</b><a class="small" href="#/meds" style="color:var(--brand);text-decoration:none;font-weight:600">όλα ›</a></div>${l.map((m) => card(m, true)).join('')}</div>`;
}
export function bindMeds(root, ui) {
  root.querySelectorAll('[data-give]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation(); const m = M.all().find((x) => x.id === b.dataset.give); if (!m) return;
    const nx = M.status(m).next; let at = Date.now();
    if (nx && Math.abs(Date.now() - nx.at) > 30 * 60000) {        // far from the planned time: when was it really given?
      at = await new Promise((res) => sheet(`<div class="mid">Πότε δόθηκε;</div><div class="small muted" style="margin-bottom:10px">💊 ${esc(m.name)} · δόση ${M.when(nx.at)}${m.mode === 'times' ? '' : ' · η επόμενη μετράει από εκεί'}</div>
        <button class="btn primary" data-t="now">Τώρα (${M.hm(Date.now())})</button>
        ${nx.at < Date.now() ? `<button class="btn" data-t="plan">Στην ώρα του (${M.when(nx.at)})</button>` : ''}
        <label class="f"><span>Άλλη ώρα</span><input type="datetime-local" name="gt" value="${M.local(Date.now())}"></label><button class="btn" data-t="other">Αποθήκευση</button>
        <button class="btn ghost" data-t="">Άκυρο</button>`, (el, close) => {
        el.querySelectorAll('[data-t]').forEach((x) => { x.onclick = () => { close(); const k = x.dataset.t; res(k === 'now' ? Date.now() : k === 'plan' ? nx.at : k === 'other' ? M.ms(el.querySelector('[name=gt]').value) : null); }; });
      }));
      if (!at) return;
    }
    await M.give(m, at); const n = M.status(M.all().find((x) => x.id === m.id)).next;
    ui.toast(n ? `✓ Επόμενη: ${M.when(n.at)}` : '✓ Ήταν η τελευταία δόση', 6000, { label: 'Αναίρεση', fn: () => M.ungive(M.all().find((x) => x.id === m.id)) });
  }));
  root.querySelectorAll('[data-med]').forEach((r) => r.addEventListener('click', () => medSheet(ui, M.all().find((x) => x.id === r.dataset.med))));
}

// ---- one medicine ----
export function medSheet(ui, m = null, preset = {}) {
  const v0 = { mode: 'times', times: M.DEF_TIMES[1], wd: [], durN: null, durU: 'd', track: true, ...preset, ...(m || {}) };
  let mode = m ? (m.mode === 'times' ? 'times' : 'every') : v0.mode === 'every' ? 'every' : 'times';     // older ones (no mode) = every N hours
  let phases = (v0.phases || [{ days: 2, h: 4 }]).map((p) => ({ ...p }));
  let times = (v0.times || ['09:00']).slice().sort(); let wd = (v0.wd || []).map(Number);
  let end = v0.until ? 'until' : v0.durN ? 'dur' : m || preset.name ? 'none' : 'dur';
  const drawPh = () => phases.map((p, i) => `<div class="row" style="gap:6px;margin-bottom:6px"><input name="pd${i}" inputmode="decimal" value="${esc(String(p.days).replace('.', ','))}" style="width:70px"><span class="small">μέρες, κάθε</span>
      <input name="ph${i}" inputmode="decimal" value="${esc(String(p.h).replace('.', ','))}" style="width:70px"><span class="small grow">ώρες</span>${phases.length > 1 ? `<button type="button" class="btn sm ghost" data-pdel="${i}" style="width:auto">✕</button>` : ''}</div>`).join('');
  const drawT = () => times.map((t, i) => `<span class="row" style="gap:2px;display:inline-flex;margin:0 6px 6px 0"><input type="time" name="t${i}" value="${esc(t)}" style="width:auto">${times.length > 1 ? `<button type="button" class="btn sm ghost" data-tdel="${i}" style="width:auto;padding:4px 6px">✕</button>` : ''}</span>`).join('');
  const s = m ? M.status(m) : null;
  sheet(`<div class="mid">${m ? 'Φάρμακο' : 'Νέο φάρμακο'}</div>
    <div style="margin-top:10px">${whoPick(v0.who)}</div>
    <label class="f"><span>Φάρμακο / συμπλήρωμα</span><input name="name" value="${esc(v0.name || '')}" placeholder="π.χ. Depon σιρόπι, βιταμίνη D"></label>
    <div class="grid2"><label class="f"><span>Δόση (προαιρετικά)</span><input name="dose" value="${esc(v0.dose || '')}" placeholder="π.χ. 1,5 ml, 2 εισπνοές"></label>
    <label class="f"><span>Μορφή (προαιρετικά)</span><input name="form" value="${esc(v0.form || '')}" placeholder="π.χ. σιρόπι"></label></div>
    <label class="f"><span>Πώς</span><div class="seg" data-mode><button type="button" data-val="times" class="${mode === 'times' ? 'on' : ''}">Σε ώρες της ημέρας</button><button type="button" data-val="every" class="${mode === 'every' ? 'on' : ''}">Κάθε τόσες ώρες</button></div></label>
    <div data-m-times ${mode === 'times' ? '' : 'hidden'}>
      <div class="f"><span class="small muted" style="display:block;margin-bottom:6px">Ώρες <span data-qt>${[1, 2, 3, 4].map((n) => `<button type="button" class="chip" data-q="${n}" style="margin-left:4px">${n}×</button>`).join('')}</span></span>
        <div data-times>${drawT()}</div><button type="button" class="btn sm" data-tadd style="width:auto">+ Ώρα</button></div>
      <div class="f"><span class="small muted" style="display:block;margin-bottom:6px">Μέρες (καμία επιλεγμένη = κάθε μέρα)</span><div class="chips" data-wd>${M.WD.map(([v, l]) => `<button type="button" class="chip ${wd.includes(v) ? 'on' : ''}" data-d="${v}">${l}</button>`).join('')}</div></div>
      <label class="f"><span>Ξεκινάει</span><input type="datetime-local" name="startT" value="${esc(v0.start || M.local(Date.now()))}"></label>
      <label class="f"><span>Μέχρι πότε</span><div class="seg" data-end>${[['dur', 'Για…'], ['until', 'Έως'], ['none', 'Χωρίς τέλος']].map(([v, l]) => `<button type="button" data-val="${v}" class="${v === end ? 'on' : ''}">${l}</button>`).join('')}</div></label>
      <div class="grid2" data-e-dur ${end === 'dur' ? '' : 'hidden'}><label class="f"><span>Διάρκεια</span><input name="durN" inputmode="numeric" value="${esc(v0.durN || 10)}"></label>
        <label class="f"><span>&nbsp;</span><select name="durU">${M.DUR_U.map(([v, l]) => `<option value="${v}" ${v === (v0.durU || 'd') ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <label class="f" data-e-until ${end === 'until' ? '' : 'hidden'}><span>Τελευταία μέρα</span><input type="date" name="until" value="${esc(v0.until || '')}"></label>
      <div class="small muted" data-thint style="margin:-4px 2px 10px"></div>
    </div>
    <div data-m-every ${mode === 'every' ? '' : 'hidden'}>
      <label class="f"><span>Πρώτη δόση</span><input type="datetime-local" name="start" value="${esc(v0.start || M.local(Date.now()))}"></label>
      <div class="f"><span class="small muted" style="display:block;margin-bottom:6px">Πρόγραμμα (με τη σειρά)</span><div data-phases>${drawPh()}</div>
        <button type="button" class="btn sm" data-padd style="width:auto">+ Μετά…</button></div>
      <div class="small muted" style="margin:-4px 2px 10px">Π.χ. «2 μέρες κάθε 4 ώρες» και «+ Μετά…» «2 μέρες κάθε 6 ώρες». Κάθε επόμενη δόση μετράει από τη στιγμή που πάτησες ✓ στην προηγούμενη.</div>
    </div>
    <label class="f"><span>Οδηγίες / σημειώσεις</span><textarea name="notes" rows="2" placeholder="π.χ. με φαγητό · μετά στοπ">${esc(v0.notes || '')}</textarea></label>
    <label class="row small" style="margin:0 2px 10px;gap:6px"><input type="checkbox" name="track" style="width:auto" ${v0.track !== false ? 'checked' : ''}> <span>✓ Σημειώνω κάθε δόση που δίνεται</span></label>
    ${notifyPick(m || (preset.mailTo ? preset : null))}
    <div class="grid2"><label class="f"><span>Συνταγή (αρ.)</span><input name="rx" inputmode="numeric" value="${esc(v0.rx || '')}"></label>
    <label class="f"><span>Σύνδεσμος</span><input name="rxUrl" value="${esc(v0.rxUrl || '')}" placeholder="https://…"></label></div>
    ${spPick(m, v0.who)}
    ${s && s.ds.length && M.tracked(m) ? `<details class="small" style="margin:0 2px 10px"><summary>Δόσεις (${s.done}${s.total ? '/' + s.total : ''})</summary>${s.ds.filter((d) => d.at <= Date.now() + 36e5 * 24).slice(-60).map((d) => `<div>${d.given ? '✓' : d.missed ? '✕' : '○'} ${M.when(d.given || d.at)}${d.given && Math.abs(d.given - d.at) > 15 * 60000 ? ` <span class="muted">(πρόγραμμα ${M.hm(d.at)})</span>` : ''}${d.missed ? ' <span class="muted">δεν δόθηκε</span>' : ''}</div>`).join('')}</details>` : ''}
    <button class="btn primary" data-ok>Αποθήκευση</button>
    ${m && s?.done ? '<button class="btn" data-undo>↶ Αναίρεση τελευταίας δόσης</button>' : ''}
    ${m && !s?.over ? '<button class="btn" data-stop>Σταμάτησε</button>' : ''}
    ${m ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}
    <button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const q = (n) => el.querySelector(`[name=${n}]`);
    const getWho = bindWho(el, v0.who, (w) => { const sp = q('sp'); if (sp && !m) sp.value = w === store.state.user ? mySp() : 'shared'; });
    const getNotify = bindNotify(el);
    const readPh = () => { phases = phases.map((p, i) => ({ days: num(q('pd' + i).value), h: num(q('ph' + i).value) })); };
    const readT = () => { times = times.map((t, i) => q('t' + i)?.value || t); };
    const redrawPh = () => { el.querySelector('[data-phases]').innerHTML = drawPh(); bindPh(); };
    const bindPh = () => el.querySelectorAll('[data-pdel]').forEach((b) => { b.onclick = () => { readPh(); phases.splice(Number(b.dataset.pdel), 1); redrawPh(); }; });
    const redrawT = () => { el.querySelector('[data-times]').innerHTML = drawT(); bindT(); hint(); };
    const bindT = () => { el.querySelectorAll('[data-tdel]').forEach((b) => { b.onclick = () => { readT(); times.splice(Number(b.dataset.tdel), 1); redrawT(); }; }); el.querySelectorAll('[data-times] input').forEach((i) => i.addEventListener('change', hint)); };
    const vals = () => {
      readT(); const v = { mode, times: [...new Set(times.filter(Boolean))].sort(), wd: wd.slice(), start: q('startT').value, durN: end === 'dur' ? Math.max(1, Number(q('durN').value) || 1) : null, durU: end === 'dur' ? q('durU').value : null, until: end === 'until' ? q('until').value || null : null };
      return v;
    };
    const hint = () => { if (mode !== 'times') return; const v = vals(); const l = M.lastDay(v); const ds = M.doses(v);
      el.querySelector('[data-thint]').textContent = !v.start ? '' : `${M.schedTxt(v)}${l ? ` — ${ds.length} δόσεις` : ''}${ds[0] ? ` · πρώτη ${M.when(ds[0].at)}` : ''}`; };
    bindPh(); bindT(); hint();
    el.querySelectorAll('[data-mode] button').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.val; el.querySelectorAll('[data-mode] button').forEach((x) => x.classList.toggle('on', x === b)); el.querySelector('[data-m-times]').hidden = mode !== 'times'; el.querySelector('[data-m-every]').hidden = mode !== 'every'; hint(); }));
    el.querySelectorAll('[data-end] button').forEach((b) => b.addEventListener('click', () => { end = b.dataset.val; el.querySelectorAll('[data-end] button').forEach((x) => x.classList.toggle('on', x === b)); el.querySelector('[data-e-dur]').hidden = end !== 'dur'; el.querySelector('[data-e-until]').hidden = end !== 'until'; hint(); }));
    el.querySelectorAll('[data-wd] [data-d]').forEach((b) => b.addEventListener('click', () => { const d = Number(b.dataset.d); wd = wd.includes(d) ? wd.filter((x) => x !== d) : [...wd, d]; b.classList.toggle('on', wd.includes(d)); hint(); }));
    el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { times = M.DEF_TIMES[b.dataset.q].slice(); redrawT(); }));
    el.querySelector('[data-tadd]').onclick = () => { readT(); times.push('12:00'); redrawT(); };
    el.querySelector('[data-padd]').onclick = () => { readPh(); phases.push({ days: 2, h: 6 }); redrawPh(); };
    ['startT', 'durN', 'durU', 'until'].forEach((n) => q(n).addEventListener('change', hint));
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-undo]')?.addEventListener('click', async () => { await M.ungive(m); close(); ui.toast('Αναιρέθηκε η τελευταία δόση'); });
    el.querySelector('[data-stop]')?.addEventListener('click', async () => { await store.put(m._sp, m.id, { stopped: M.local(Date.now()) }); close(); ui.toast('Σταμάτησε — δεν έρχονται άλλες ειδοποιήσεις'); });
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (!(await ui.confirm(`Διαγραφή «${m.name}»;`, 'Διαγραφή'))) return; await store.del(m._sp, m.id); close(); });
    el.querySelector('[data-ok]').onclick = async () => {
      const name = q('name').value.trim(); if (!name) { ui.toast('Γράψε το φάρμακο'); return; }
      let v;
      if (mode === 'times') { v = vals(); if (!v.times.length || !v.start) { ui.toast('Ώρες και πότε ξεκινάει'); return; } if (end === 'until' && !v.until) { ui.toast('Βάλε την τελευταία μέρα'); return; } }
      else { readPh(); const ph = phases.filter((p) => p.days > 0 && p.h > 0); if (!ph.length || !q('start').value) { ui.toast('Πρώτη δόση και πρόγραμμα'); return; } v = { mode: 'every', start: q('start').value, phases: ph }; }
      Object.assign(v, { name, who: getWho(), dose: q('dose').value.trim() || null, form: q('form').value.trim() || null, notes: q('notes').value.trim() || null, track: q('track').checked,
        rx: q('rx').value.trim() || null, rxUrl: q('rxUrl').value.trim() || null, ...getNotify() });
      const sp = q('sp')?.value || 'shared';
      if (m && sp !== m._sp) await store.move(m._sp, sp, { ...m, ...v }); else await store.put(sp, m?.id || null, { type: 'med', ...v });
      close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}

// ---- from a prescription: paste the text, get one medicine per line ----
export function rxSheet(ui, { who = null, text = '' } = {}) {
  sheet(`<div class="mid">📋 Φάρμακα από συνταγή</div>
    <div class="small muted" style="margin:4px 0 10px">Επικόλλησε το κείμενο της συνταγής ή γράψε μία γραμμή για κάθε φάρμακο: «Depon σιρόπι 5 ml 3 φορές την ημέρα x 5 ημέρες», «Βιταμίνη D Χ 1 για 3 μήνες».</div>
    ${whoPick(who)}
    <label class="f"><span>Κείμενο</span><textarea name="txt" rows="5">${esc(text)}</textarea></label>
    <label class="f"><span>Ξεκινάνε</span><input type="datetime-local" name="from" value="${M.local(Date.now())}"></label>
    <div data-prev class="list" style="margin-bottom:10px"></div>
    ${notifyPick(null)}
    ${spPick(null, who)}
    <div class="small muted" style="margin:0 2px 10px">Παίρνουν τις συνηθισμένες ώρες (1× 09:00, 2× 08:00 · 20:00, 3× 08:00 · 14:00 · 20:00) — μετά πατάς κάθε φάρμακο και αλλάζεις ό,τι θες.</div>
    <button class="btn primary" data-ok>Δημιουργία</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const q = (n) => el.querySelector(`[name=${n}]`);
    const getWho = bindWho(el, who, (w) => { const sp = q('sp'); if (sp) sp.value = w === store.state.user ? mySp() : 'shared'; }); const getNotify = bindNotify(el);
    const prev = () => { const l = M.parseRx(q('txt').value); const f = M.ms(q('from').value) || Date.now();
      el.querySelector('[data-prev]').innerHTML = l.map((p) => `<div class="item"><div class="grow"><div class="t" style="white-space:normal">💊 ${esc(p.name)}${p.dose ? ` · ${esc(p.dose)}` : ''}</div><div class="s" style="white-space:normal">${esc(M.schedTxt(M.fromRx(p, null, f)))}${p.notes ? ` · ${esc(p.notes)}` : ''}${p.rx ? ` · συνταγή ${esc(p.rx)}` : ''}</div></div></div>`).join('') || '<div class="item muted small">Δεν βρέθηκε φάρμακο ακόμα — χρειάζεται «N φορές την ημέρα» ή «x N» και «x / για N ημέρες / μήνες».</div>';
      el.querySelector('[data-ok]').textContent = l.length ? `Δημιουργία ${l.length} ${l.length === 1 ? 'φαρμάκου' : 'φαρμάκων'}` : 'Δημιουργία'; };
    q('txt').addEventListener('input', prev); q('from').addEventListener('change', prev); prev();
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => {
      const l = M.parseRx(q('txt').value); if (!l.length) { ui.toast('Δεν βρέθηκε φάρμακο'); return; }
      const w = getWho(); if (!w) { ui.toast('Για ποιον;'); return; }
      const sp = q('sp')?.value || 'shared'; const f = M.ms(q('from').value) || Date.now(); const n = getNotify();
      await store.putMany(sp, l.map((p) => ({ id: null, set: { type: 'med', ...M.fromRx(p, w, f), ...n } })));
      close(); ui.toast(`✓ ${l.length} ${l.length === 1 ? 'φάρμακο' : 'φάρμακα'}`);
    };
  });
}

// ---- the list (all, or one person's) ----
const sec = (t, inner) => `<h2>${t}</h2><div class="list">${inner}</div>`;
export default {
  live: true,
  html([who] = []) {
    const l = M.all().filter((m) => !who || m.who === who); const on = l.filter((m) => !M.status(m).over), off = l.filter((m) => M.status(m).over); const bk = book(who);
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>${who ? `💊 ${esc(who)}` : 'Φάρμακα'}</h1></div>
    <div class="chips" style="margin-bottom:12px"><a class="chip ${who ? '' : 'on'}" href="#/meds" style="text-decoration:none">Όλοι</a>${people().map((p) => `<a class="chip ${p === who ? 'on' : ''}" href="#/meds/${encodeURIComponent(p)}" style="text-decoration:none">${ico(p)} ${esc(p)}</a>`).join('')}</div>
    <div class="grid2" style="margin-bottom:10px"><button class="btn primary" data-new>+ Φάρμακο</button><button class="btn" data-rx>📋 Από συνταγή</button></div>
    ${bk ? `<a class="note small" href="${bk}" style="display:block;text-decoration:none;color:inherit;margin-bottom:10px">${ico(who)} Βιβλιάριο υγείας: επισκέψεις, εμβόλια, βάρος ›</a>` : ''}
    ${l.length ? '' : '<div class="note">Φάρμακα με ώρες: «3 φορές την ημέρα για 10 μέρες», «κάθε μεσημέρι έως μια μέρα», «Δευ/Τετ/Παρ», «χωρίς τέλος» ή «κάθε 4 ώρες». Πατάς ✓ όταν δίνεις τη δόση και, για όποιο θες, έρχεται ειδοποίηση στην ώρα της (email ή στο κινητό). Με «📋 Από συνταγή» επικολλάς το κείμενο της συνταγής και φτιάχνονται όλα μαζί.</div>'}
    ${on.length ? sec('Τώρα', on.map((m) => card(m)).join('')) : ''}
    ${off.length ? sec('Τελείωσαν', off.slice(0, 20).map((m) => card(m)).join('')) : ''}`;
  },
  mount(root, [who] = [], ui) {
    root.querySelector('[data-back]').addEventListener('click', () => ui.back());
    root.querySelector('[data-new]').addEventListener('click', () => medSheet(ui, null, who ? { who } : {}));
    root.querySelector('[data-rx]').addEventListener('click', () => rxSheet(ui, { who }));
    bindMeds(root, ui);
    const tm = setInterval(() => { if (!document.body.contains(root) || !location.hash.startsWith('#/meds')) clearInterval(tm); else if (!document.querySelector('.sheet-bg')) ui.render(); }, 60000);
  },
};
