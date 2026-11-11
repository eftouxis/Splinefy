// Shared pieces of the lessons screens: bottom sheets, lesson / payment / slot editors.
import { esc, eur, today, dShort, dFull, parseAmount, addDays, pad, MONTHS, MONTHS_GEN, norm } from '../../util.js';
import * as store from '../../store.js';
import * as L from '../../lessons.js';

export const fmtH = (h) => {
  if (!h) return '0';
  if (Math.abs(h * 2 - Math.round(h * 2)) < 1e-6) return String(Math.round(h * 2) / 2).replace('.', ',');
  const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${pad(m % 60)}`;
};
export const hoursTxt = (h) => {
  if (h && Math.abs(h * 2 - Math.round(h * 2)) > 1e-6) { const m = Math.round(h * 60), H = Math.floor(m / 60); return `${H ? H + (H === 1 ? ' ώρα ' : ' ώρες ') : ''}${m % 60}΄`; }
  return `${fmtH(h)} ${h === 1 ? 'ώρα' : 'ώρες'}`;
};
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
/** Monefy-like question for a recurring item: resolves 'one' | 'fwd' | 'all' | null (do not save) */
export function askScope(title, sub, { one = 'Μόνο αυτή τη φορά', fwd = 'Αυτή και οι επόμενες', all = 'Όλες (και οι παλιές)', del = false } = {}) {
  return new Promise((res) => sheet(`<div class="mid">${esc(title)}</div><div class="small muted" style="margin-bottom:10px">${sub || ''}</div>
    ${one ? `<button class="btn primary" data-s="one">${esc(one)}</button>` : ''}
    ${fwd ? `<button class="btn ${one ? '' : 'primary'}" data-s="fwd">${esc(fwd)}</button>` : ''}
    ${all ? `<button class="btn" data-s="all"${del ? ' style="color:var(--red)"' : ''}>${esc(all)}</button>` : ''}
    <button class="btn ghost" data-s="">${del ? 'Άκυρο' : 'Μην αποθηκεύσεις'}</button>`, (el, close) => {
    el.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => { close(); res(b.dataset.s || null); }; });
  }));
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
export const label = (s) => L.label(s);
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
  const slot = l?.slot ? L.slots(stu).find((x) => x.id === l.slot && Math.abs((x.h || st.dur || 1) - sched) < 1e-9) : null;   // one weekly slot behind this day
  const hol = L.holidayOn(d);
  let h = l ? cur : (st.dur || 1), time = l?.time || '';
  const opts = [...new Set([1, 1.5, 2, st.dur || 1].map((x) => Math.round(x * 1e6) / 1e6))].sort((a, b) => a - b);
  sheet(`<div class="row"><div class="grow"><div class="mid">${esc(L.label(st))}</div><div class="small muted">${dShort(d)} ${d.slice(0, 4)}${hol ? ' · ' + esc(hol.name) : ''}</div></div>
      <div class="small muted right">${sched ? 'Πρόγραμμα: ' + hoursTxt(sched) : 'Εκτός προγράμματος'}<br>${(() => { const b = L.balance(stu); return Math.abs(b) < 0.005 ? 'εξοφλημένος' : b > 0 ? `<b class="neg">χρωστάει ${eur(b)}</b>` : `<span class="pos">προπλήρωσε ${eur(-b)}${(() => { const pp = L.prepaid(stu); return pp ? ` · ${pp.n} μαθ. ως ${dShort(pp.until || d)}` : ''; })()}</span>`; })()}</div></div>
    <label class="f" style="margin-top:12px"><span>Ώρες</span>${segBtns('h', opts.map((x) => [x, x ? fmtH(x) : 'Δεν έγινε']), h)}</label>
    <div class="grid2"><label class="f"><span>Άλλη διάρκεια (π.χ. 1:20)</span><input name="hx" inputmode="decimal" placeholder="${fmtH(h)}"></label>
      <label class="f"><span>Ώρα / σημείωση</span><input name="time" value="${esc(time)}" placeholder="π.χ. 17:00"></label></div>
    <div class="small muted" data-valtxt></div>
    ${(() => { const on = L.notes(stu).filter((n) => n.d === d || (n.imp && !n.done && n.d < d)); return on.length ? `<div class="note small" style="margin:8px 0">${on.map((n) => `<div class="row" style="margin:3px 0"><span class="grow">${n.imp ? (n.done ? '✓ ' : '📌 ') : '📝 '}${esc(n.text)}${n.d !== d ? ` <span class="muted">(${dShort(n.d)})</span>` : ''}</span>${n.imp && !n.done ? `<button type="button" class="btn sm" data-ndone="${esc(n.id)}" style="width:auto">✓</button>` : ''}</div>`).join('')}</div>` : ''; })()}
    <label class="f"><span>📌 Για την επόμενη φορά (στην αρχική από την προηγούμενη μέρα)</span><input name="nimp" placeholder="π.χ. γράφει διαγώνισμα την Παρασκευή"></label>
    <label class="f"><span>📝 Σημείωση μαθήματος</span><input name="nnote" placeholder="π.χ. πήρε 18 στο τεστ, κάναμε εξισώσεις"></label>
    <button class="btn primary" data-ok>Αποθήκευση</button>
    ${l?.ov && sched ? '<button class="btn" data-reset>Όπως το πρόγραμμα</button>' : ''}
    ${slot ? '<button class="btn" data-slotfrom>↻ Άλλη μέρα / ώρα από εδώ και πέρα</button><button class="btn" data-sdel style="color:var(--red)">🗑 Διαγραφή</button>' : ''}
    ${l?.ov && !sched ? '<button class="btn" data-dellesson style="color:var(--red)">🗑 Διαγραφή μαθήματος</button>' : ''}
    ${location.hash.startsWith('#/lessons/s/') ? '' : `<button class="btn" data-card>Καρτέλα ${esc(L.label(st))} › (πληρωμές, χρωστούμενα)</button>`}
    <button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-card]')?.addEventListener('click', () => { close(); ui.go(`#/lessons/s/${stu}`); });
    const val = () => { el.querySelector("[data-valtxt]").textContent = h ? `Αξία: ${eur(h * L.rateAt(st, d))}` : 'Δεν χρεώνεται'; };
    val();
    bindSeg(el, (n, v) => { h = Number(v); el.querySelector('[name=hx]').value = ''; val(); });
    el.querySelector('[name=hx]').addEventListener('input', (e) => { const x = parseAmount(e.target.value.replace(/(\d+):(\d+)/, '$1+$2/60')); if (x != null) { h = x; el.querySelectorAll('[data-seg] button').forEach((b) => b.classList.remove('on')); val(); } });
    el.querySelector('[data-no]').onclick = close;
    el.querySelectorAll('[data-ndone]').forEach((b) => b.addEventListener('click', async () => { await store.put(L.LSP, b.dataset.ndone, { done: 1 }); b.closest('.row').firstElementChild.textContent = '✓ ' + b.closest('.row').firstElementChild.textContent.replace(/^📌 /, ''); b.remove(); }));
    const saveNotes = async () => {
      const imp = el.querySelector('[name=nimp]').value.trim(), nt = el.querySelector('[name=nnote]').value.trim();
      if (imp) await store.put(L.LSP, null, { type: 'lnote', stu, d, text: imp, imp: 1, done: null });
      if (nt) await store.put(L.LSP, null, { type: 'lnote', stu, d, text: nt, imp: null });
    };
    el.querySelector('[data-dellesson]')?.addEventListener('click', async () => { await store.del(L.LSP, l.ov); close(); ui.toast('Το μάθημα σβήστηκε ✓'); });
    el.querySelector('[data-reset]')?.addEventListener('click', async () => { await store.del(L.LSP, l.ov, { quiet: true }); close(); ui.toast('Όπως το πρόγραμμα ✓'); });
    el.querySelector('[data-slotfrom]')?.addEventListener('click', () => { close(); slotSheet(ui, stu, slot, d); });
    el.querySelector('[data-sdel]')?.addEventListener('click', async () => {
      const ans = await askScope('Διαγραφή', `${esc(L.label(st))} · ${dShort(d)} ${d.slice(0, 4)}`, { del: true });
      if (!ans) return;
      await store.batch(async () => {
        if (ans === 'one') await store.put(L.LSP, `lx:${stu}:${d}`, { type: 'lx', stu, d, h: 0, time: null });
        else { if (l?.ov) await store.del(L.LSP, l.ov); if (ans === 'fwd') await slotFrom(slot, d, null); else await slotAll(slot, null); }
      }, `Μάθημα ${L.label(st)} · ${dShort(d)}${ans === 'one' ? '' : ans === 'fwd' ? ' και τα επόμενα' : ' (όλα)'}`);
      close(); ui.toast(ans === 'one' ? 'Διαγράφηκε ✓' : ans === 'fwd' ? 'Διαγράφηκε από εδώ και πέρα ✓' : 'Διαγράφηκε ✓');
    });
    el.querySelector('[data-ok]').onclick = async () => {
      await saveNotes();
      time = el.querySelector('[name=time]').value.trim();
      if (time === (l?.time || '') && l && Math.abs(h - cur) > 1e-9 && h) time = spanOf(time, h) || '';     // other hours, same start → the end follows
      const id = `lx:${stu}:${d}`;
      const same = Math.abs(h - sched) < 1e-9 && (time === (l?.time || '') || !l?.ov);
      const onlyThis = async () => {
        if (same && sched) { if (l?.ov) await store.del(L.LSP, l.ov, { quiet: true }); }
        else if (!sched && !h) { if (l?.ov) await store.del(L.LSP, l.ov); close(); ui.toast('Το μάθημα σβήστηκε ✓'); return; }   // extra lesson that did not happen → gone
        else await store.put(L.LSP, id, { type: 'lx', stu, d, h: Math.round(h * 1e6) / 1e6, time: time || null });
        close(); ui.toast(h ? 'Αποθηκεύτηκε ✓' : 'Σημειώθηκε ότι δεν έγινε');
      };
      const timeCh = time !== (l?.time || '');
      if (!slot || (same && !timeCh) || (Math.abs(h - sched) < 1e-9 && !timeCh)) return onlyThis();
      // a lesson of the weekly schedule changed: like Monefy — only this, this and the next ones, all
      const ans = await askScope('Αποθήκευση αλλαγής', `${esc(L.label(st))} · ${dShort(d)} ${d.slice(0, 4)}`);
      if (!ans) return;
      if (ans === 'one') return onlyThis();
      if (l?.ov) await store.del(L.LSP, l.ov, { quiet: true });
      const set = h ? { h: Math.round(h * 1e6) / 1e6, time: spanOf(time || slot.time, h) } : null;
      if (ans === 'fwd') await slotFrom(slot, d, set); else await slotAll(slot, set);
      close(); ui.toast(!h ? 'Σταμάτησε ✓ — τα προηγούμενα μένουν' : ans === 'fwd' ? 'Άλλαξε από εδώ και πέρα ✓' : 'Άλλαξε σε όλα ✓');
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
      d = el.querySelector('[name=d]').value; const h = parseAmount(el.querySelector('[name=h]').value.replace(/(\d+):(\d+)/, '$1+$2/60'));
      if (!d || !h) { ui.toast('Ημερομηνία και ώρες'); return; }
      const ex = L.lessons({ stu, from: d, to: d, all: true })[0];
      await store.put(L.LSP, `lx:${stu}:${d}`, { type: 'lx', stu, d, h: (ex && ex.h > 0 ? ex.h : 0) + h });
      close(); ui.toast('Προστέθηκε ✓');
    };
  });
}

/** payment of a student = income «Ιδιαίτερα» in the personal ledger */
const addMonthsU = (s, n) => { const [y, m] = s.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
/** the month a payment concerns → stored date (last day of an earlier month / first day of a later one), null when it is the payment month */
const mdOf = (mm, d) => { if (!mm || mm === d.slice(0, 7)) return null; if (mm < d.slice(0, 7)) { const [y, m] = mm.split('-').map(Number); return `${mm}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; } return `${mm}-01`; };
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
    <label class="f"><span>Αφορά μήνα (π.χ. εξόφληση Οκτωβρίου)</span><select name="mm"></select></label>
    <label class="f"><span>📌 Για την επόμενη φορά (στην αρχική από την προηγούμενη μέρα)</span><input name="nimp" placeholder="π.χ. γράφει διαγώνισμα την Παρασκευή"></label>
    <label class="f"><span>📝 Σημείωση μαθητή (στην καρτέλα του)</span><input name="nnote" placeholder="π.χ. θέλει επανάληψη στις εξισώσεις"></label>
    <button class="btn primary" data-ok>${tx ? 'Αποθήκευση' : 'Καταχώρηση'}</button>
    ${tx ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const inp = el.querySelector('[name=a]');
    const showBal = () => {
      const a = parseAmount(inp.value) || 0; const b = L.balance(stu) + (tx && tx.stu === stu ? tx.a : 0) - a;
      el.querySelector('[data-bal]').textContent = `Υπόλοιπο μετά: ${Math.abs(b) < 0.005 ? 'εξοφλημένος ✓' : b > 0 ? 'χρωστάει ' + eur(b) : 'προπληρωμένα ' + eur(-b)}`;
    };
    showBal(); inp.addEventListener('input', showBal);
    const D = el.querySelector('[name=d]'), MM = el.querySelector('[name=mm]'); let mmTouched = !!tx?.md;
    const fillMM = () => { const base = D.value || today(); const cur = MM.value || (tx?.md || base).slice(0, 7);
      const opts = [-3, -2, -1, 0, 1].map((n) => addMonthsU(`${base.slice(0, 7)}-01`, n).slice(0, 7)); if (!opts.includes(cur)) opts.unshift(cur);
      const sel = mmTouched ? cur : base.slice(0, 7);
      MM.innerHTML = opts.map((m) => `<option value="${m}" ${m === sel ? 'selected' : ''}>${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</option>`).join(''); };
    fillMM(); D.addEventListener('change', fillMM); MM.addEventListener('change', () => { mmTouched = true; });
    const STEMS = ['ιανουαρ', 'φεβρουαρ', 'μαρτ', 'απριλ', 'μαι', 'ιουν', 'ιουλ', 'αυγουστ', 'σεπτεμβρ', 'οκτωβρ', 'νοεμβρ', 'δεκεμβρ'];
    el.querySelector('[name=note]').addEventListener('input', (e) => {      // «εξόφληση Οκτωβρίου» → Οκτώβριος
      const t = norm(e.target.value); const i = STEMS.findIndex((x) => new RegExp(`(^|[^a-zα-ω])${x}`).test(t)); if (i < 0) return;
      const base = D.value || today(); let y = Number(base.slice(0, 4)); let m = `${y}-${String(i + 1).padStart(2, '0')}`; if (m > addMonthsU(`${base.slice(0, 7)}-01`, 1).slice(0, 7)) m = `${y - 1}${m.slice(4)}`;
      mmTouched = true; if (![...MM.options].some((o) => o.value === m)) MM.insertAdjacentHTML('afterbegin', `<option value="${m}">${MONTHS[i]} ${m.slice(0, 4)}</option>`); MM.value = m;
    });
    bindChips(el, 'stu', (id) => { stu = id; if (!tx) inp.value = String(suggest(id)).replace('.', ','); showBal(); });
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (!(await ui.confirm('Διαγραφή της πληρωμής;', 'Διαγραφή'))) return; await store.del(L.LSP, tx.id); close(); ui.toast('Διαγράφηκε'); });
    el.querySelector('[data-ok]').onclick = async () => {
      const a = parseAmount(inp.value); if (!a) { ui.toast('Γράψε ποσό'); return; }
      const st = L.student(stu);
      await store.put(L.LSP, tx?.id || null, { type: 'tx', kind: 'Έσοδο', cat: 'Ιδιαίτερα', payer: 'Άλκης', for: '', a, d: el.querySelector('[name=d]').value || today(),
        desc: st.full || st.name, stu, note: el.querySelector('[name=note]').value.trim() || null, md: mdOf(MM.value, el.querySelector('[name=d]').value || today()) });
      const dd = el.querySelector('[name=d]').value || today(); const imp = el.querySelector('[name=nimp]').value.trim(), nt = el.querySelector('[name=nnote]').value.trim();
      if (imp) await store.put(L.LSP, null, { type: 'lnote', stu, d: dd, text: imp, imp: 1, done: null });
      if (nt) await store.put(L.LSP, null, { type: 'lnote', stu, d: dd, text: nt, imp: null });
      close(); ui.toast('Πληρωμή καταχωρήθηκε ✓');
    };
  });
}

/** «17:00» or «17:00–18:00» with new hours → «17:00–18:30» (anything else is kept as written) */
export function spanOf(time, h) {
  const m = String(time || '').match(/^\s*(\d{1,2})[:.](\d{2})/); if (!m || !h) return time || null;
  const a = Number(m[1]) * 60 + Number(m[2]), b = a + Math.round(h * 60);
  return `${pad(Math.floor(a / 60))}:${m[2]}–${pad(Math.floor(b / 60) % 24)}:${pad(b % 60)}`;
}
/** change a weekly slot from day d on (set = new fields) or stop it from d (set = null); the lessons before d stay as they were */
export async function slotFrom(slot, d, set) {
  const base = { type: 'sched', stu: slot.stu, wd: slot.wd, h: slot.h, time: slot.time || null, to: slot.to || null };
  const ops = slotChain(slot).filter((p) => p.id !== slot.id && p.from > d).map((p) => (set ? { id: p.id, set } : { id: p.id, del: true }));   // the later parts follow
  if (slot.from >= d) ops.push(set ? { id: slot.id, set } : { id: slot.id, del: true });
  else { ops.push({ id: slot.id, set: { to: addDays(d, -1) } }); if (set) ops.push({ id: null, set: { ...base, from: d, ...set } }); }
  return store.putMany(L.LSP, ops);
}
/** the parts of one weekly lesson (each change «from a day on» makes a new part that starts the day after the previous one ends) */
export function slotChain(slot) {
  const all = L.slots(slot.stu); const out = [slot]; let a = slot, b = slot;
  for (let i = 0; i < 50; i++) { const p = all.find((x) => !out.includes(x) && x.to && addDays(x.to, 1) === a.from); if (!p) break; out.push(p); a = p; }
  for (let i = 0; i < 50; i++) { if (!b.to) break; const n = all.find((x) => !out.includes(x) && x.from === addDays(b.to, 1)); if (!n) break; out.push(n); b = n; }
  return out;
}
/** all the times of one weekly lesson, also the past (set = null deletes them) */
export async function slotAll(slot, set) { return store.putMany(L.LSP, slotChain(slot).map((p) => (set ? { id: p.id, set } : { id: p.id, del: true }))); }
/** weekly slot of a student: a new one, or a change asked like Monefy (from the next lesson on / all); a finished one is corrected as it is */
export function slotSheet(ui, stu, slot = null, from0 = null) {
  const st = L.student(stu); const t = today();
  const Y = L.yearOf(t);
  let wd = slot?.wd || 1;
  const ended = slot && slot.to && slot.to < t && !from0;
  const started = slot && !ended && slot.from < (from0 || t);
  const next = started ? (from0 || L.lessons({ stu, from: t, to: addDays(t, 120), all: true }).find((x) => x.slot === slot.id)?.d || t) : null;
  sheet(`<div class="mid">${slot ? (ended ? 'Διόρθωση προγράμματος' : 'Αλλαγή προγράμματος') : 'Νέα ημέρα στο πρόγραμμα'} · ${esc(L.label(st))}</div>
    <label class="f" style="margin-top:10px"><span>Ημέρα</span>${segBtns('wd', DSHORT.map((n, i) => [i + 1, n]), wd)}</label>
    <div class="grid2"><label class="f"><span>Ώρες</span><input name="h" inputmode="decimal" value="${fmtH(slot?.h || st.dur || 1)}"></label>
    <label class="f"><span>Ώρα</span><input name="time" value="${esc(slot?.time || '')}" placeholder="π.χ. 17:00–18:30"></label></div>
    ${started ? '' : `<div class="grid2"><label class="f"><span>Πρώτο μάθημα</span><input type="date" name="from" value="${slot?.from || (t < L.winter(Y) ? L.winter(Y) : t)}"></label>
      ${ended ? `<label class="f"><span>Τελευταίο μάθημα</span><input type="date" name="to" value="${slot.to}"></label>` : '<div></div>'}</div>`}
    <div class="small muted" style="margin:-4px 2px 10px">Τα μαθήματα μπαίνουν ως το τέλος της χρονιάς (${dFull(L.yEnd(Y))}) ή ως το «Τελευταίο μάθημα» του μαθητή.</div>
    <button class="btn primary" data-ok>Αποθήκευση</button>
    ${slot ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}
    <button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    bindSeg(el, (n, v) => { wd = Number(v); });
    el.querySelector('[data-no]').onclick = close;
    const q = (n) => el.querySelector(`[name=${n}]`);
    const sub = esc(L.label(st)); const prog = { one: '', fwd: `Από το επόμενο (${next ? dShort(next) : ''}) και πέρα` };
    const vals = () => ({ wd, h: parseAmount(q('h').value.replace(/(\d+):(\d+)/, '$1+$2/60')), time: q('time').value.trim() || null });
    el.querySelector('[data-del]')?.addEventListener('click', async () => {
      const ans = started ? await askScope('Διαγραφή', sub, { ...prog, del: true })
        : (await ui.confirm('Θα σβηστούν και τα μαθήματα αυτής της γραμμής. Διαγραφή;', 'Διαγραφή')) && 'all';
      if (!ans) return;
      await store.batch(async () => { if (ans === 'fwd') await slotFrom(slot, next, null); else if (started) await slotAll(slot, null); else await store.del(L.LSP, slot.id); },
        `Πρόγραμμα ${L.label(st)}${ans === 'fwd' && next ? ` · από ${dShort(next)}` : ''}`);
      close(); ui.toast('Αποθηκεύτηκε ✓');
    });
    el.querySelector('[data-ok]').onclick = async () => {
      const v = vals(); if (!v.h) { ui.toast('Γράψε ώρες'); return; }
      if (slot && (v.time || '') === (slot.time || '') && Math.abs(v.h - slot.h) > 1e-9) v.time = spanOf(v.time, v.h);    // other hours, same start → the end follows
      if (!slot) { const from = q('from').value || t; await store.put(L.LSP, null, { type: 'sched', stu, ...v, from, to: L.yEnd(L.yearOf(from)) }); }
      else if (started) {
        const ch = v.wd !== slot.wd || Math.abs(v.h - slot.h) > 1e-9 || (v.time || '') !== (slot.time || '');
        if (!ch) { close(); return; }
        const ans = await askScope('Αποθήκευση αλλαγής', sub, prog);
        if (!ans) return;
        if (ans === 'fwd') await slotFrom(slot, next, v); else await slotAll(slot, v);
      } else {
        const to = ended ? q('to').value || slot.to : slot.to;
        const from = q('from').value || slot.from; if (to && to < from) { ui.toast('Το «τελευταίο» είναι πριν από το «πρώτο»'); return; }
        await store.put(L.LSP, slot.id, { ...v, from, to });
      }
      close(); ui.toast('Το πρόγραμμα αποθηκεύτηκε ✓');
    };
  });
}
export { dFull };

/** open «για την επόμενη φορά» notes, soonest lesson first (home and lessons home) */
export function notesCard() {
  const t = today(); const l = L.openNotes().filter((n) => L.noteShow(n) <= t);     // shown from the day before the next lesson (or the day set)
  if (!l.length) return '';
  const rows = l.map((n) => { const nx = L.nextLessonFrom(n.stu, n.d < t ? t : addDays(n.d, 1)); return { n, nx: nx?.d || '9999' }; }).sort((a, b) => (a.nx < b.nx ? -1 : 1));
  return `<div class="card" style="border-left:4px solid #e0a030"><b>📌 Για τα μαθήματα</b>
    ${rows.map(({ n, nx }) => `<div class="row small" style="margin-top:6px"><span class="grow" data-go="#/lessons/s/${esc(n.stu)}" style="cursor:pointer"><b>${esc(L.label(L.student(n.stu)))}</b>${nx === t ? ' <span class="neg">· σήμερα</span>' : nx !== '9999' ? ` · ${dShort(nx)}` : ''}: ${esc(n.text)}</span><button class="btn sm" data-ndone="${esc(n.id)}" style="width:auto">✓</button></div>`).join('')}</div>`;
}
export function bindNotes(root, ui) {
  root.querySelectorAll('[data-ndone]').forEach((b) => b.addEventListener('click', async (e) => { e.stopPropagation(); await store.put(L.LSP, b.dataset.ndone, { done: 1 }); ui.render(); }));
}
/** add / edit a note on the student's card */
export function noteSheet(ui, stu, n = null) {
  sheet(`<div class="mid">${n ? 'Σημείωση' : 'Νέα σημείωση'} · ${esc(L.label(L.student(stu)))}</div>
    <label class="f" style="margin-top:10px"><span>Κείμενο</span><input name="text" value="${esc(n?.text || '')}" placeholder="π.χ. διαγώνισμα Παρασκευή, βαθμός 17"></label>
    <div class="grid2"><label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${esc(n?.d || today())}"></label>
    <label class="row small" style="margin-top:22px"><input type="checkbox" name="imp" style="width:auto" ${n?.imp || !n ? 'checked' : ''}> <span>📌 Θύμισέ το την επόμενη φορά</span></label></div>
    <label class="f" data-showf><span>Να εμφανιστεί στην αρχική από</span><input type="date" name="show" value="${esc(n?.show || '')}"></label>
    <div class="small muted" style="margin:-6px 2px 10px" data-showhint></div>
    <button class="btn primary" data-ok>Αποθήκευση</button>${n ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    const hint = () => {                                   // empty = the day before the next lesson
      const imp = el.querySelector('[name=imp]').checked; el.querySelector('[data-showf]').hidden = !imp; el.querySelector('[data-showhint]').hidden = !imp;
      const def = L.noteShow({ stu, d: el.querySelector('[name=d]').value || today() });
      el.querySelector('[data-showhint]').textContent = el.querySelector('[name=show]').value ? '' : `Κενό = την προηγούμενη μέρα του επόμενου μαθήματος (${dFull(def)}).`;
    };
    ['imp', 'd', 'show'].forEach((k) => el.querySelector(`[name=${k}]`).addEventListener('change', hint)); hint();
    el.querySelector('[data-del]')?.addEventListener('click', async () => { await store.del(n._sp, n.id); close(); });
    el.querySelector('[data-ok]').onclick = async () => {
      const text = el.querySelector('[name=text]').value.trim(); if (!text) return;
      const imp = el.querySelector('[name=imp]').checked;
      await store.put(L.LSP, n?.id || null, { type: 'lnote', stu, d: el.querySelector('[name=d]').value || today(), text, imp: imp ? 1 : null, done: imp && n?.done ? n.done : null, show: imp ? el.querySelector('[name=show]').value || null : null }); close();
    };
  });
}

// ---- Google Calendar suggestions (Μαθήματα home)
import * as GC from '../../gcal.js';
let gcRes = null, gcAt = 0, gcErr = '', gcBusy = false;
const KIND_TXT = { time: 'άλλη ώρα / διάρκεια', add: 'μάθημα που δεν υπάρχει στην εφαρμογή', gone: 'δεν είναι στο ημερολόγιο — να διαγραφεί;' };
export function gcalCard() {
  if (!GC.connected()) return '';
  const head = `<div class="row"><b class="grow">📅 Από το Google Calendar</b><button class="btn sm" data-gcheck ${gcBusy ? 'disabled' : ''}>${gcBusy ? 'Έλεγχος…' : gcRes ? 'Ξανά' : 'Έλεγχος'}</button></div>`;
  if (gcErr) return `<div class="card">${head}<div class="small neg" style="margin-top:6px">${esc(gcErr)}</div></div>`;
  if (!gcRes) return `<div class="card">${head}<div class="small muted" style="margin-top:4px">Σύγκρινε τα μαθήματα με το ημερολόγιο.</div></div>`;
  if (!gcRes.length) return `<div class="card">${head}<div class="small pos" style="margin-top:4px">✓ Όλα ίδια με το ημερολόγιο</div></div>`;
  return `<div class="card" style="border-left:4px solid #4285f4">${head}
    ${gcRes.map((x, i) => `<div class="row small" style="margin-top:8px;gap:6px"><span class="grow"><b>${esc(L.label(L.student(x.stu)))}</b> · ${dShort(x.d)}<br><span class="muted">${KIND_TXT[x.kind]}:</span> ${x.kind === 'gone' ? `ήταν ${hoursTxt(x.was.h)}${x.was.time ? ' ' + esc(x.was.time) : ''} → διαγραφή` : `${x.was ? `${hoursTxt(x.was.h)}${x.was.time ? ' ' + esc(x.was.time) : ''} → ` : ''}<b>${hoursTxt(x.h)} ${esc(x.time)}</b>`}</span>
      <button class="btn sm primary" data-gok="${i}" style="width:auto">✓</button><button class="btn sm ghost" data-gno="${i}" style="width:auto">✕</button></div>`).join('')}
    ${gcRes.length > 1 ? '<button class="btn sm" data-gall style="margin-top:10px">✓ Όλα</button>' : ''}
    <div class="small muted" style="margin-top:6px">✓ = άλλαξέ το στην εφαρμογή · ✕ = άφησέ το όπως είναι (δεν ξαναρωτάει)</div></div>`;
}
export function bindGcal(root, ui) {
  const run = async (interactive) => {
    gcBusy = true; gcErr = ''; ui.render();
    try { if (!GC.hasToken()) { if (!interactive) throw new Error('Πάτα «Έλεγχος» για σύνδεση με Google'); await GC.signIn(); } gcRes = await GC.check(); gcAt = Date.now(); }
    catch (e) { gcErr = e.message; }
    gcBusy = false; ui.render();
  };
  root.querySelector('[data-gcheck]')?.addEventListener('click', () => run(true));
  root.querySelectorAll('[data-gok]').forEach((b) => b.addEventListener('click', async () => { const x = gcRes[Number(b.dataset.gok)]; await GC.apply(x); gcRes = gcRes.filter((y) => y !== x); ui.render(); }));
  root.querySelectorAll('[data-gno]').forEach((b) => b.addEventListener('click', async () => { const x = gcRes[Number(b.dataset.gno)]; await GC.ignore(x); gcRes = gcRes.filter((y) => y !== x); ui.render(); }));
  root.querySelector('[data-gall]')?.addEventListener('click', async () => { for (const x of gcRes) await GC.apply(x); gcRes = []; ui.render(); });
  if (GC.connected() && GC.hasToken() && !gcBusy && Date.now() - gcAt > 10 * 60000) run(false);     // silent re-check while the Google session lasts
}

// ---------- «Πλήρωσε;» — επιβεβαίωση πληρωμών μετά το μάθημα / τον μήνα ----------
const NUDGE = 'paynudge-off';
const nudgeOff = () => { try { return localStorage.getItem(NUDGE) === '1'; } catch (_) { return false; } };
/** κάρτα για την αρχική και τα Μαθήματα: τι περιμένει «ναι / άλλο ποσό / όχι ακόμα / δεν έγινε» */
export function confirmCard() {
  if (!L.hasLessons()) return '';
  const list = L.toConfirm();
  const unset = L.students().filter((s) => !s.pay && L.isActive(s));
  // όσοι δεν έχουν ακόμα «πώς πληρώνει»: μένουν εδώ ώσπου να οριστούν όλοι (ή «Όχι τώρα»)
  const setup = unset.length && !nudgeOff() ? `<div class="card"><div class="mid">💶 Πώς σε πληρώνει ο καθένας;</div>
      <div class="small muted" style="margin:4px 0 8px">Μετά από κάθε μάθημα (ή στο τέλος του μήνα) σε ρωτάω «πλήρωσε;» και με ένα «ναι» μπαίνει το έσοδο και ξεχρεώνεται.${unset.length < L.students().filter((s) => L.isActive(s)).length ? ` Έμειναν ${unset.length}.` : ''}</div>
      ${unset.map((s) => `<div class="row small" style="gap:6px;margin-bottom:6px;flex-wrap:wrap"><b class="grow">${esc(L.label(s))}</b>${L.PAYMODES.map(([v, l]) => `<button class="chip" data-pmode="${esc(s.id)}|${v}">${l}</button>`).join('')}</div>`).join('')}
      <button class="btn sm ghost" data-pnudge style="margin-top:4px">Όχι τώρα</button></div>` : '';
  if (!list.length) return setup;
  const row = (x, i) => {
    const nm = esc(L.label(x.st)); const bal = L.balance(x.st.id);
    const when = x.mode === 'lesson' ? `${dShort(x.d)}${x.l.time ? ' · ' + esc(String(x.l.time).slice(0, 5)) : ''} · ${hoursTxt(x.l.h)}` : `${MONTHS[Number(x.m.slice(5)) - 1]} · ${x.n} ${x.n === 1 ? 'μάθημα' : 'μαθήματα'}`;
    const all = bal > x.a + 0.5 ? `<button class="btn sm green" data-pall="${i}" style="width:auto">✓ Όλο ${eur(bal)}</button>` : '';
    return `<div class="item" style="display:block"><div class="row"><b class="grow">${nm}</b><span class="small muted">${when}</span></div>
      <div class="small" style="margin:4px 0 6px">${x.mode === 'lesson' ? 'Πλήρωσε το μάθημα;' : `Πλήρωσε τα μαθήματα του ${MONTHS_GEN[Number(x.m.slice(5)) - 1]};`}${bal > x.a + 0.5 ? ` <span class="muted">(χρωστάει συνολικά ${eur(bal)})</span>` : ''}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm green" data-pyes="${i}" style="width:auto">✓ Ναι, ${eur(x.a)}</button>${all}
        <button class="btn sm" data-pother="${i}" style="width:auto">Άλλο ποσό</button><button class="btn sm ghost" data-plater="${i}" style="width:auto">Όχι ακόμα</button>
        ${x.mode === 'lesson' ? `<button class="btn sm ghost" data-pnot="${i}" style="width:auto">Δεν έγινε</button>` : ''}
        ${x.st.php || x.st.ph ? `<button class="btn sm ghost" data-pmsg="${i}" style="width:auto">💬 Στείλε το ποσό</button>` : ''}</div></div>`;
  };
  return `<div class="card" style="padding-bottom:6px"><div class="mid">💶 Πλήρωσε; <span class="small muted">(${list.length})</span></div><div class="list" style="margin-top:8px">${list.slice(0, 6).map(row).join('')}</div>
    ${list.length > 6 ? `<div class="small muted" style="margin:6px 2px">και άλλα ${list.length - 6}…</div>` : ''}</div>${setup}`;
}
export function bindConfirm(root, ui) {
  if (!root.querySelector('[data-pyes],[data-pmode],[data-pnudge]')) return;
  const list = L.toConfirm(); const t = today();
  const ack = (x, ans, a = null) => store.put(L.LSP, `la:${x.k}`, { type: 'lack', k: x.k, ans, a, at: t });
  const pay = async (x, a, d = t) => {
    const st = x.st; const m = x.mode === 'month' ? x.m : null;
    await store.put(L.LSP, null, { type: 'tx', kind: 'Έσοδο', cat: 'Ιδιαίτερα', payer: 'Άλκης', for: '', a, d, desc: st.full || st.name, stu: st.id,
      note: m ? `${MONTHS[Number(m.slice(5)) - 1]}` : null, md: m ? mdOf(m, d) : null });
    await ack(x, 'paid', a);
    ui.toast(`+${eur(a)} από ${L.label(st)} — μπήκε στα έσοδα ✓`, 3500);
  };
  const get = (b, k) => list[Number(b.dataset[k])];
  root.querySelectorAll('[data-pyes]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const x = get(b, 'pyes'); if (x) pay(x, x.a, x.mode === 'lesson' ? x.d : t); }));
  root.querySelectorAll('[data-pall]').forEach((b) => b.addEventListener('click', async (e) => { e.stopPropagation(); const x = get(b, 'pall'); if (!x) return;
    const bal = L.balance(x.st.id); await pay(x, Math.round(bal * 100) / 100, t);
    for (const y of L.toConfirm().filter((y) => y.st.id === x.st.id)) await ack(y, 'paid', 0);     // όλο το χρέος → και τα υπόλοιπα «πλήρωσε;» του κλείνουν
  }));
  root.querySelectorAll('[data-pmsg]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const x = get(b, 'pmsg'); if (x) msgSheet(ui, x.st.id, 'debt'); }));
  root.querySelectorAll('[data-plater]').forEach((b) => b.addEventListener('click', async (e) => { e.stopPropagation(); const x = get(b, 'plater'); if (!x) return; await ack(x, 'later'); ui.toast(`${L.label(x.st)}: μένει στα «Μου χρωστάνε»`); }));
  root.querySelectorAll('[data-pnot]').forEach((b) => b.addEventListener('click', async (e) => { e.stopPropagation(); const x = get(b, 'pnot'); if (!x) return;
    await store.put(L.LSP, `lx:${x.st.id}:${x.d}`, { type: 'lx', stu: x.st.id, d: x.d, h: 0, time: null }); await ack(x, 'no'); ui.toast('Σημειώθηκε ότι δεν έγινε'); }));
  root.querySelectorAll('[data-pother]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const x = get(b, 'pother'); if (!x) return;
    sheet(`<div class="mid">${esc(L.label(x.st))}: πόσα πλήρωσε;</div>
      <input class="amount" name="a" inputmode="decimal" value="${esc(String(x.a).replace('.', ','))}" style="margin-top:10px">
      <div class="small muted" style="margin:4px 2px 10px">Χρωστάει συνολικά ${eur(L.balance(x.st.id))}. Ό,τι μείνει, μένει στα «Μου χρωστάνε»· αν δώσει παραπάνω, μετράει ως προπληρωμή.</div>
      <label class="f"><span>Πότε</span><input type="date" name="d" value="${x.mode === 'lesson' ? x.d : t}"></label>
      <button class="btn primary" data-ok>Καταχώριση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
      setTimeout(() => el.querySelector('[name=a]').select(), 50);
      el.querySelector('[data-no]').onclick = close;
      el.querySelector('[data-ok]').onclick = async () => { const a = parseAmount(el.querySelector('[name=a]').value); close();
        if (a > 0) await pay(x, a, el.querySelector('[name=d]').value || t); else { await ack(x, 'later'); ui.toast('Δεν μπήκε πληρωμή — μένει στα «Μου χρωστάνε»'); } };
    });
  }));
  root.querySelectorAll('[data-pmode]').forEach((b) => b.addEventListener('click', async (e) => { e.stopPropagation(); const [id, v] = b.dataset.pmode.split('|');
    const st = L.student(id); await store.put(L.LSP, id, { pay: v, paySince: t }); ui.toast(`${st ? L.label(st) : ''}: ${(L.PAYMODES.find((m) => m[0] === v) || [0, ''])[1]} ✓`); }));
  root.querySelector('[data-pnudge]')?.addEventListener('click', (e) => { e.stopPropagation(); try { localStorage.setItem(NUDGE, '1'); } catch (_) { /* */ } ui.render(); });
}

// ---------- 💬 Μηνύματα (SMS): ανοίγει τα μηνύματα του κινητού με έτοιμο κείμενο και παραλήπτη ----------
// Στον μαθητή με το όνομά του· στον γονιό γενικό (χωρίς όνομα, χωρίς πληθυντικό ευγενείας).
const DAYN = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
const DAYG = ['Κυριακής', 'Δευτέρας', 'Τρίτης', 'Τετάρτης', 'Πέμπτης', 'Παρασκευής', 'Σαββάτου'];
/** κλητική του μικρού ονόματος: Στέλιος → Στέλιο, Γιάννης → Γιάννη, Κώστας → Κώστα */
export function voc(st) {
  if (st.voc) return st.voc; const n = (st.name || '').trim();
  return n.replace(/ος$/, 'ο').replace(/ός$/, 'ό').replace(/ης$/, 'η').replace(/ής$/, 'ή').replace(/ας$/, 'α').replace(/άς$/, 'ά');
}
const hello = (now = new Date()) => (now.getHours() * 60 + now.getMinutes() < 12 * 60 + 30 && now.getHours() >= 4 ? 'Καλημέρα' : 'Καλησπέρα');
const dobj = (d) => new Date(`${d}T12:00:00`);
/** «σήμερα» · «αύριο Πέμπτη» · «την Πέμπτη 13/11» */
function whenTxt(d) {
  const t = today(); const w = DAYN[dobj(d).getDay()];
  if (d === t) return 'σήμερα'; if (d === addDays(t, 1)) return `αύριο ${w}`;
  return `${dobj(d).getDay() === 6 || dobj(d).getDay() === 0 ? 'το' : 'την'} ${w} ${dShort(d).replace(/^\D+\s*/, '')}`;
}
const tm = (l) => { const m = String(l?.time || '').match(/(\d{1,2})[:.](\d{2})/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
/** ποια μαθήματα καλύπτει το χρέος: από το πιο πρόσφατο προς τα πίσω, ώσπου να βγει το ποσό */
export function debtLessons(stu) {
  const bal = L.balance(stu); if (bal <= 0.005) return { bal: 0, ls: [] };
  const done = L.lessons({ stu, to: today() }).filter((l) => L.started(l)).reverse(); const ls = []; let s = 0;
  for (const l of done) { if (s >= bal - 0.005) break; ls.unshift(l); s += l.v; }
  return { bal, ls };
}
export const MSG_KINDS = [['remind', '⏰ Υπενθύμιση μαθήματος'], ['debt', '💶 Πόσα χρωστάει'], ['cancel', '✖ Δεν θα γίνει μάθημα'], ['free', '✏️ Ελεύθερο']];
export function msgText(kind, st, to, opt = {}) {
  const kid = to === 'kid'; const hi = `${hello()}${kid ? ` ${voc(st)}` : ''}!`;
  if (kind === 'remind') {
    const l = opt.lesson || L.nextLessonFrom(st.id, today());
    if (!l) return `${hi} `;
    return `${hi} ${kid ? 'Υπενθύμιση: ' : 'Υπενθύμιση: '}${whenTxt(l.d)}${tm(l) ? ` στις ${tm(l)}` : ''} έχουμε μάθημα.`;
  }
  if (kind === 'debt') {
    const { bal, ls } = debtLessons(st.id); if (!bal) return `${hi} `;
    const ms = [...new Set(ls.map((l) => l.d.slice(0, 7)))];
    const what = ms.length === 1 && ls.length ? `τα μαθήματα του ${MONTHS_GEN[Number(ms[0].slice(5)) - 1]} (${ls.length} ${ls.length === 1 ? 'μάθημα' : 'μαθήματα'})`
      : ls.length ? `τα μαθήματα από ${dShort(ls[0].d).replace(/^\D+\s*/, '')} έως ${dShort(ls[ls.length - 1].d).replace(/^\D+\s*/, '')} (${ls.length} μαθήματα)` : 'τα μαθήματα';
    return `${hi} Για ${what} το ποσό είναι ${eur(bal)}. Ευχαριστώ!`;
  }
  if (kind === 'cancel') {
    const l = opt.lesson || L.nextLessonFrom(st.id, today());
    if (!l) return `${hi} `;
    const w = DAYG[dobj(l.d).getDay()];
    return `${hi} Το μάθημα ${l.d === addDays(today(), 1) ? 'της αυριανής' : l.d === today() ? 'της σημερινής' : `της ${w} ${dShort(l.d).replace(/^\D+\s*/, '')}`}${l.d === today() || l.d === addDays(today(), 1) ? ` ${w}` : ''}${tm(l) ? ` στις ${tm(l)}` : ''} δεν θα γίνει. Θα κανονίσουμε άλλη μέρα.`;
  }
  return `${hi} `;
}
const phones = (st) => [['kid', 'Μαθητής', st.ph], ['par', 'Γονιός', st.php], ['par2', 'Γονιός 2', st.php2]].filter((x) => x[2]);
const smsHref = (ph, text) => `sms:${String(ph).replace(/[^\d+]/g, '')}?body=${encodeURIComponent(text)}`;
/** φύλλο «💬 Μήνυμα»: τύπος → σε ποιον → κείμενο (αλλάζει) → Άνοιγμα στα μηνύματα */
export function msgSheet(ui, stu, kind0 = 'remind', opt = {}) {
  const st = L.student(stu); if (!st) return;
  const ph = phones(st);
  if (!ph.length) { ui.toast('Βάλε πρώτα κινητό (Επεξεργασία μαθητή → Κινητά)', 4000); ui.go(`#/lessons/edit/${stu}`); return; }
  let kind = kind0, to = opt.to || (kind0 === 'debt' ? (ph.find((p) => p[0] !== 'kid') || ph[0])[0] : (ph.find((p) => p[0] === 'kid') || ph[0])[0]);
  sheet(`<div class="mid">💬 Μήνυμα · ${esc(L.label(st))}</div>
    <div class="chips" data-mk style="margin:10px 0">${MSG_KINDS.map(([v, l]) => `<button type="button" class="chip ${v === kind ? 'on' : ''}" data-val="${v}">${l}</button>`).join('')}</div>
    <label class="f"><span>Σε ποιον</span><div class="seg" data-mto>${ph.map(([v, l, n]) => `<button type="button" data-val="${v}" class="${v === to ? 'on' : ''}">${l}<div class="small" style="font-weight:400;opacity:.7">${esc(n)}</div></button>`).join('')}</div></label>
    <label class="f"><span>Κείμενο (το αλλάζεις αν θες)</span><textarea name="txt" rows="4"></textarea></label>
    <a class="btn primary" data-send style="display:block;text-align:center">📨 Άνοιγμα στα μηνύματα</a>
    <button class="btn" data-copy>📋 Αντιγραφή κειμένου</button><button class="btn ghost" data-no>Κλείσιμο</button>`, (el, close) => {
    const ta = el.querySelector('[name=txt]'); const send = el.querySelector('[data-send]');
    const num = () => (ph.find((p) => p[0] === to) || ph[0])[2];
    const fill = () => { ta.value = msgText(kind, st, to === 'kid' ? 'kid' : 'par', opt); link(); };
    const link = () => { send.href = smsHref(num(), ta.value.trim()); };
    ta.addEventListener('input', link); fill();
    el.querySelectorAll('[data-mk] .chip').forEach((b) => b.addEventListener('click', () => { kind = b.dataset.val;
      if (kind === 'debt' && to === 'kid' && ph.some((p) => p[0] !== 'kid')) to = ph.find((p) => p[0] !== 'kid')[0];
      el.querySelectorAll('[data-mk] .chip').forEach((x) => x.classList.toggle('on', x === b)); el.querySelectorAll('[data-mto] button').forEach((x) => x.classList.toggle('on', x.dataset.val === to)); fill(); }));
    el.querySelectorAll('[data-mto] button').forEach((b) => b.addEventListener('click', () => { to = b.dataset.val; el.querySelectorAll('[data-mto] button').forEach((x) => x.classList.toggle('on', x === b)); fill(); }));
    send.addEventListener('click', () => { if (opt.onSent) opt.onSent(); setTimeout(close, 300); });
    el.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(ta.value); ui.toast('Αντιγράφηκε ✓'); } catch (_) { ta.select(); } };
    el.querySelector('[data-no]').onclick = close;
  });
}
/** «Υπενθυμίσεις για αύριο»: όλοι όσοι έχουν μάθημα αύριο, ένα κουμπί ο καθένας */
export function tomorrowSheet(ui) {
  const d = addDays(today(), 1); const ls = L.lessons({ from: d, to: d });
  sheet(`<div class="mid">⏰ Υπενθυμίσεις για αύριο</div><div class="small muted" style="margin:4px 2px 10px">${DAYN[dobj(d).getDay()]} ${dShort(d).replace(/^\D+\s*/, '')} · ${ls.length} ${ls.length === 1 ? 'μάθημα' : 'μαθήματα'}</div>
    <div class="list">${ls.map((l, i) => { const st = L.student(l.stu); const ph = phones(st); const kid = ph.find((p) => p[0] === 'kid') || ph[0];
      return `<div class="item"><div class="grow"><div class="t">${esc(L.label(st))}</div><div class="s">${tm(l) || ''}${kid ? ` · ${kid[1]}` : ' · χωρίς κινητό'}</div></div>
        ${kid ? `<a class="btn sm primary" data-tm="${i}" style="width:auto" href="${smsHref(kid[2], msgText('remind', st, kid[0] === 'kid' ? 'kid' : 'par', { lesson: l }))}">📨 Στείλε</a>` : `<a class="btn sm" href="#/lessons/edit/${esc(st.id)}" style="width:auto">+ κινητό</a>`}</div>`; }).join('') || '<div class="item muted">Κανένα μάθημα αύριο</div>'}</div>
    <button class="btn ghost" data-no style="margin-top:8px">Κλείσιμο</button>`, (el, close) => {
    el.querySelectorAll('[data-tm]').forEach((a) => a.addEventListener('click', () => { a.textContent = '✓ Στάλθηκε'; a.classList.remove('primary'); }));
    el.querySelector('[data-no]').onclick = close;
  });
}
