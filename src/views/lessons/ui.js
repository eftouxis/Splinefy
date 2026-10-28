// Shared pieces of the lessons screens: bottom sheets, lesson / payment / slot editors.
import { esc, eur, today, dShort, dFull, parseAmount, addDays, pad } from '../../util.js';
import * as store from '../../store.js';
import * as L from '../../lessons.js';

export const fmtH = (h) => {
  if (!h) return '0';
  if (Math.abs(h * 2 - Math.round(h * 2)) < 1e-6) return String(Math.round(h * 2) / 2).replace('.', ',');
  const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${pad(m % 60)}`;
};
export const hoursTxt = (h) => `${fmtH(h)} ${h === 1 ? 'ώρα' : 'ώρες'}`;
export const DSHORT = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'];

/** bottom sheet with its own form; mount(el, close) wires it up */
export function sheet(html, mount) {
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet">${html}</div>`;
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  document.body.appendChild(bg);
  mount?.(bg.querySelector('.sheet'), close);
  return close;
}
const segBtns = (name, opts, val) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-val="${esc(v)}" class="${String(v) === String(val) ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
function bindSeg(el, onPick) {
  el.querySelectorAll('[data-seg]').forEach((sg) => sg.addEventListener('click', (e) => {
    const v = e.target.dataset.val; if (v === undefined) return;
    sg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.target));
    onPick(sg.dataset.seg, v);
  }));
}
/** label of a student: the short name, or the full name when two have the same short name */
export function label(s, list = L.students()) {
  return list.filter((x) => x.name === s.name).length > 1 ? s.full || s.name : s.name;
}
export function studentChips(list, sel, name = 'stu') {
  return `<div class="chips" data-chips="${name}">${list.map((s) => `<button type="button" class="chip ${s.id === sel ? 'on' : ''}" data-id="${esc(s.id)}">${esc(label(s))}</button>`).join('')}</div>`;
}
function bindChips(el, name, onPick) {
  const box = el.querySelector(`[data-chips="${name}"]`); if (!box) return;
  box.addEventListener('click', (e) => {
    const id = e.target.dataset.id; if (!id) return;
    box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.target)); onPick(id);
  });
}

/** one lesson (student + day): hours, cancel, back to schedule */
export function lessonSheet(stu, d, ui) {
  const st = L.student(stu);
  const l = L.lessons({ stu, from: d, to: d, all: true })[0];
  const sched = l?.sched || 0, cur = l ? l.h : 0;
  const hol = L.holidayOn(d);
  let h = l ? cur : (st.dur || 1), time = l?.time || '';
  const opts = [...new Set([0, 1, 1.5, 2, st.dur || 1].map((x) => Math.round(x * 1e6) / 1e6))].sort((a, b) => a - b);
  sheet(`<div class="row"><div class="grow"><div class="mid">${esc(st.name)}</div><div class="small muted">${dShort(d)} ${d.slice(0, 4)}${hol ? ' · ' + esc(hol.name) : ''}</div></div>
      <div class="small muted right">${sched ? 'Πρόγραμμα: ' + hoursTxt(sched) : 'Εκτός προγράμματος'}</div></div>
    <label class="f" style="margin-top:12px"><span>Ώρες</span>${segBtns('h', opts.map((x) => [x, x ? fmtH(x) : 'Δεν έγινε']), h)}</label>
    <div class="grid2"><label class="f"><span>Άλλη διάρκεια (π.χ. 1,25 ή 4/3)</span><input name="hx" inputmode="decimal" placeholder="${fmtH(h)}"></label>
      <label class="f"><span>Ώρα / σημείωση</span><input name="time" value="${esc(time)}" placeholder="π.χ. 17:00"></label></div>
    <div class="small muted" data-valtxt></div>
    <button class="btn primary" data-ok>Αποθήκευση</button>
    ${l?.ov ? '<button class="btn" data-reset>Όπως το πρόγραμμα</button>' : ''}
    <button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const val = () => { el.querySelector("[data-valtxt]").textContent = h ? `Αξία: ${eur(h * L.rateAt(st, d))}` : 'Δεν χρεώνεται'; };
    val();
    bindSeg(el, (n, v) => { h = Number(v); el.querySelector('[name=hx]').value = ''; val(); });
    el.querySelector('[name=hx]').addEventListener('input', (e) => { const x = parseAmount(e.target.value); if (x != null) { h = x; el.querySelectorAll('[data-seg] button').forEach((b) => b.classList.remove('on')); val(); } });
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-reset]')?.addEventListener('click', async () => { await store.del(L.LSP, l.ov); close(); ui.toast('Όπως το πρόγραμμα ✓'); });
    el.querySelector('[data-ok]').onclick = async () => {
      time = el.querySelector('[name=time]').value.trim();
      const id = `lx:${stu}:${d}`;
      const same = Math.abs(h - sched) < 1e-9 && (time === (l?.time || '') || !l?.ov);
      if (same && sched) { if (l?.ov) await store.del(L.LSP, l.ov); }
      else await store.put(L.LSP, id, { type: 'lx', stu, d, h: Math.round(h * 1e6) / 1e6, time: time || null });
      close(); ui.toast(h ? 'Αποθηκεύτηκε ✓' : 'Σημειώθηκε ότι δεν έγινε');
    };
  });
}

/** add a lesson outside the schedule */
export function addLessonSheet(ui, stu0 = null, d0 = today()) {
  const list = L.students().filter((s) => L.isActive(s, d0));
  let stu = stu0 || list[0]?.id, d = d0;
  if (!stu) { ui.toast('Πρόσθεσε πρώτα μαθητή'); return; }
  sheet(`<div class="mid">Νέο μάθημα</div><div class="small muted" style="margin-bottom:10px">έκτακτο ή αναπλήρωση (τα κανονικά μπαίνουν μόνα τους από το πρόγραμμα)</div>
    ${studentChips(list, stu)}
    <div class="grid2" style="margin-top:12px"><label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${d}"></label>
    <label class="f"><span>Ώρες</span><input name="h" inputmode="decimal" value="${fmtH(L.student(stu)?.dur || 1)}"></label></div>
    <button class="btn primary" data-ok>Προσθήκη</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    bindChips(el, 'stu', (id) => { stu = id; el.querySelector('[name=h]').value = fmtH(L.student(id).dur || 1); });
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => {
      d = el.querySelector('[name=d]').value; const h = parseAmount(el.querySelector('[name=h]').value.replace(':', '+1/60*'));
      if (!d || !h) { ui.toast('Ημερομηνία και ώρες'); return; }
      const ex = L.lessons({ stu, from: d, to: d, all: true })[0];
      await store.put(L.LSP, `lx:${stu}:${d}`, { type: 'lx', stu, d, h: (ex && ex.h > 0 ? ex.h : 0) + h });
      close(); ui.toast('Προστέθηκε ✓');
    };
  });
}

/** payment of a student = income «Ιδιαίτερα» in the personal ledger */
export function paySheet(ui, stu0 = null, tx = null) {
  const list = L.students().filter((s) => L.isActive(s) || s.id === stu0 || s.id === tx?.stu);
  let stu = stu0 || tx?.stu || list[0]?.id;
  if (!stu) { ui.toast('Πρόσθεσε πρώτα μαθητή'); return; }
  const suggest = (id) => { const b = L.balance(id); return b > 0.005 ? b : L.priceAt(L.student(id)).price || ''; };
  sheet(`<div class="mid">${tx ? 'Πληρωμή' : 'Νέα πληρωμή'}</div>
    <div style="margin:10px 0">${studentChips(list, stu)}</div>
    <input class="amount" name="a" inputmode="decimal" value="${esc(tx ? tx.a : String(suggest(stu)).replace('.', ','))}">
    <div class="small muted center" data-bal style="margin:6px 0 10px"></div>
    <div class="grid2"><label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${tx ? tx.d : today()}"></label>
    <label class="f"><span>Σημείωση</span><input name="note" value="${esc(tx?.note || '')}"></label></div>
    <div class="note small">Μπαίνει μία φορά και φαίνεται και στην καρτέλα του μαθητή και στα έσοδά σου (Ιδιαίτερα).</div>
    <button class="btn primary" data-ok>${tx ? 'Αποθήκευση' : 'Καταχώρηση'}</button>
    ${tx ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const inp = el.querySelector('[name=a]');
    const showBal = () => {
      const a = parseAmount(inp.value) || 0; const b = L.balance(stu) + (tx && tx.stu === stu ? tx.a : 0) - a;
      el.querySelector('[data-bal]').textContent = `Υπόλοιπο μετά: ${Math.abs(b) < 0.005 ? 'εξοφλημένος ✓' : b > 0 ? 'χρωστάει ' + eur(b) : 'προπληρωμένα ' + eur(-b)}`;
    };
    showBal(); inp.addEventListener('input', showBal);
    bindChips(el, 'stu', (id) => { stu = id; if (!tx) inp.value = String(suggest(id)).replace('.', ','); showBal(); });
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (!(await ui.confirm('Διαγραφή της πληρωμής;', 'Διαγραφή'))) return; await store.del(L.LSP, tx.id); close(); ui.toast('Διαγράφηκε'); });
    el.querySelector('[data-ok]').onclick = async () => {
      const a = parseAmount(inp.value); if (!a) { ui.toast('Γράψε ποσό'); return; }
      const st = L.student(stu);
      await store.put(L.LSP, tx?.id || null, { type: 'tx', kind: 'Έσοδο', cat: 'Ιδιαίτερα', payer: 'Άλκης', for: '', a, d: el.querySelector('[name=d]').value || today(),
        desc: st.full || st.name, stu, note: el.querySelector('[name=note]').value.trim() || null });
      close(); ui.toast('Πληρωμή καταχωρήθηκε ✓');
    };
  });
}

/** weekly slot of a student (changes from a date keep the past as it was) */
export function slotSheet(ui, stu, slot = null) {
  const st = L.student(stu); const t = today();
  const Y = L.yearOf(t);
  let wd = slot?.wd || 1;
  const started = slot && slot.from < t;
  sheet(`<div class="mid">${slot ? 'Αλλαγή προγράμματος' : 'Νέα ημέρα στο πρόγραμμα'} · ${esc(st.name)}</div>
    <label class="f" style="margin-top:10px"><span>Ημέρα</span>${segBtns('wd', DSHORT.map((n, i) => [i + 1, n]), wd)}</label>
    <div class="grid2"><label class="f"><span>Ώρες</span><input name="h" inputmode="decimal" value="${fmtH(slot?.h || st.dur || 1)}"></label>
    <label class="f"><span>Ώρα</span><input name="time" value="${esc(slot?.time || '')}" placeholder="π.χ. 17:00–18:30"></label></div>
    <div class="grid2"><label class="f"><span>${started ? 'Η αλλαγή ισχύει από' : 'Από'}</span><input type="date" name="from" value="${started ? t : slot?.from || (t < L.winter(Y) ? L.winter(Y) : t)}"></label>
    <label class="f"><span>Έως</span><input type="date" name="to" value="${slot?.to || L.yEnd(Y)}"></label></div>
    ${started ? '<div class="note small">Τα μαθήματα πριν από αυτή την ημερομηνία μένουν όπως ήταν.</div>' : ''}
    <button class="btn primary" data-ok>Αποθήκευση</button>
    ${slot ? `<button class="btn" data-stop style="color:var(--red)">${started ? 'Σταματάει από την ημερομηνία «ισχύει από»' : 'Διαγραφή'}</button>` : ''}
    <button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    bindSeg(el, (n, v) => { wd = Number(v); });
    el.querySelector('[data-no]').onclick = close;
    const vals = () => ({ wd, h: parseAmount(el.querySelector('[name=h]').value.replace(/(\d+):(\d+)/, '$1+$2/60')), time: el.querySelector('[name=time]').value.trim() || null,
      from: el.querySelector('[name=from]').value, to: el.querySelector('[name=to]').value || null });
    el.querySelector('[data-stop]')?.addEventListener('click', async () => {
      const v = vals();
      if (started) await store.put(L.LSP, slot.id, { to: addDays(v.from, -1) }); else await store.del(L.LSP, slot.id);
      close(); ui.toast('Αποθηκεύτηκε ✓');
    });
    el.querySelector('[data-ok]').onclick = async () => {
      const v = vals(); if (!v.h || !v.from) { ui.toast('Ώρες και ημερομηνία'); return; }
      const rec = { type: 'sched', stu, ...v };
      if (started && (v.wd !== slot.wd || Math.abs(v.h - slot.h) > 1e-9 || v.from !== t)) {
        await store.putMany(L.LSP, [{ id: slot.id, set: { to: addDays(v.from, -1) } }, { id: null, set: rec }]);
      } else if (started) await store.put(L.LSP, slot.id, { time: v.time, to: v.to });
      else await store.put(L.LSP, slot?.id || null, rec);
      close(); ui.toast('Το πρόγραμμα αποθηκεύτηκε ✓');
    };
  });
}
export { dFull };
