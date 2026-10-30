// #/office/in/<id|new> and #/office/ex/<id|new> — client payment / office expense
import { esc, eur, today, parseAmount, norm } from '../../util.js';
import * as store from '../../store.js';
import * as O from '../../office.js';
import { calcHtml, bindCalc } from '../calc.js';
import * as FQ from '../freq.js';

const st = { in: null, ex: null };
const chips = (name, list, val) => `<div class="chips" data-ch="${name}">${list.map(([v, l]) => `<button type="button" class="chip ${String(v) === String(val ?? '') ? 'on' : ''}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
const cm = (x) => (x == null || x === '' ? '' : String(x).replace('.', ','));
function blank(k) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  if (k === 'in') return { id: null, d: today(), cl: q.get('cl') || '', svc: '', a: '', pay: 'Μετρητά', rcpt: false, part: '', note: '' };
  return { id: null, d: today(), desc: '', cat: q.get('part') ? 'Αμοιβή συνεργασίας' : '', a: q.get('a') || '', pay: '', part: q.get('part') || '', note: '', rep: false, repf: 'm1' };
}
/** suggestions under a text field (most used first) */
function ac(root, input, listFn, onPick) {
  const box = input.parentElement.querySelector('[data-ac]'); if (!box) return;
  const show = () => {
    const q = norm(input.value).trim(); if (!q) { box.hidden = true; return; }
    const all = listFn(); const st1 = all.filter((x) => norm(x.v).startsWith(q)), inc = all.filter((x) => !norm(x.v).startsWith(q) && norm(x.v).includes(q));
    const hits = [...st1, ...inc].filter((x) => norm(x.v) !== q).slice(0, 7); if (!hits.length) { box.hidden = true; return; }
    box.innerHTML = hits.map((x) => `<button type="button" data-acv="${esc(x.v)}"><b>${esc(x.v)}</b><span class="small muted">${esc(x.s || '')}</span></button>`).join(''); box.hidden = false;
  };
  input.addEventListener('input', show); input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
  box.addEventListener('pointerdown', (e) => e.preventDefault());
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-acv]'); if (!b) return; input.value = b.dataset.acv; box.hidden = true; onPick(b.dataset.acv); });
}
export function entryView(k) {
  const TYPE = k === 'in' ? 'oin' : 'oex';
  return {
    html([id0]) {
      const id = (id0 || 'new').split('?')[0];
      let f = st[k];
      if (!f || (id === 'new' ? f.id : f.id !== id) || location.hash.includes('?')) {
        if (id === 'new') f = blank(k);
        else { const r = store.state.data[O.OSP]?.recs.get(id); if (!r) return '<div class="top"><h1>Δεν βρέθηκε</h1></div>'; f = { ...blank(k), ...r, a: cm(r.a), id, dueK: r.due > 0 ? 'owes' : r.due < 0 ? 'iowe' : '', dueA: r.due ? cm(Math.abs(r.due)) : '' }; }
        st[k] = f; if (location.hash.includes('?')) history.replaceState(null, '', `#/office/${k}/${id}`);
      }
      const parts = O.partners().filter((p) => p.active !== false || p.id === f.part);
      const top = `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>${f.id ? 'Επεξεργασία' : k === 'in' ? 'Πληρωμή πελάτη' : 'Έξοδο γραφείου'}</h1></div>`;
      const amount = `<input class="amount" name="a" inputmode="decimal" placeholder="0,00 €" value="${esc(f.a)}" autocomplete="off">${calcHtml()}`;
      if (k === 'in') {
        const svcs = O.services().slice(0, 7);
        const prevDue = f.cl ? (O.clientPays(f.cl).find((r) => r.id !== f.id && (!f.id || r.d <= f.d))?.due || 0) : 0;
        return `${top}<div class="card">
          <label class="f"><span>Πελάτης</span><span class="ac"><input name="cl" value="${esc(f.cl)}" autocomplete="off" placeholder="Όνομα πελάτη"><span class="ac-list" data-ac hidden></span></span></label>
          <label class="f"><span>Υπηρεσία</span>${chips('svc', svcs.map((s) => [s.name, s.name]), O.svcGroup(f.svc) === f.svc ? f.svc : '')}
            <input name="svc" value="${esc(f.svc)}" placeholder="ή γράψε (π.χ. πακέτο 4 φορές)" style="margin-top:6px"></label>
          ${amount}
          <label class="f" style="margin-top:10px"><span>Ημερομηνία</span><input type="date" name="d" value="${esc(f.d)}"></label>
          <label class="f"><span>Τρόπος πληρωμής</span>${chips('pay', O.PAYS.map((p) => [p, p]), f.pay)}</label>
          <label class="row" style="margin:0 2px 12px"><input type="checkbox" name="rcpt" style="width:auto" ${f.rcpt ? 'checked' : ''}> 🧾 Κόπηκε απόδειξη</label>
          ${parts.length ? `<label class="f"><span>Ήρθε μέσω συνεργάτη</span>${chips('part', [['', 'Κανένας'], ...parts.map((p) => [p.id, p.name])], f.part)}</label>
            ${f.part ? `<div class="small muted" data-fee style="margin:-4px 2px 10px"></div>` : ''}` : ''}
          <label class="f"><span>Μετά από αυτή την πληρωμή</span>${chips('dueK', [['', 'Εντάξει'], ['owes', 'Μου χρωστάει'], ['iowe', 'Του/της χρωστάω']], f.dueK)}
            ${f.dueK ? `<input name="dueA" inputmode="decimal" value="${esc(f.dueA || '')}" placeholder="πόσα €" style="margin-top:6px">` : ''}
            ${prevDue ? `<div class="small ${prevDue > 0 ? 'pos' : 'neg'}" style="margin-top:4px">Από την προηγούμενη φορά: ${prevDue > 0 ? 'σου χρωστούσε' : 'του/της χρωστούσες'} ${eur(Math.abs(prevDue))}</div>` : ''}</label>
          <label class="f"><span>Σημείωση</span><input name="note" value="${esc(f.note || '')}" placeholder="π.χ. 2η από τις 4 του πακέτου"></label>
        </div>
        <button class="btn primary" style="width:100%" data-save>${f.id ? 'Αποθήκευση' : 'Καταχώρηση'}</button>
        ${f.id ? '<button class="btn" style="width:100%;margin-top:8px;color:var(--red)" data-del>Διαγραφή</button>' : '<button class="btn" style="width:100%;margin-top:8px" data-saveadd>Καταχώρηση και νέα</button>'}`;
      }
      return `${top}<div class="card">
        ${amount}
        <div class="grid2" style="margin-top:10px"><label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${esc(f.d)}"></label>
          <label class="f"><span>Τρόπος πληρωμής</span><input name="pay" value="${esc(f.pay || '')}" placeholder="π.χ. Εθνική"></label></div>
        <label class="f"><span>Περιγραφή</span><span class="ac"><input name="desc" value="${esc(f.desc)}" autocomplete="off" placeholder="π.χ. NRG, Marweb Νοέμβριος"><span class="ac-list" data-ac hidden></span></span></label>
        <label class="f"><span>Κατηγορία</span>${chips('cat', O.ECATS.map((c) => [c, c]), f.cat)}</label>
        ${f.cat === 'Αμοιβή συνεργασίας' ? `<label class="f"><span>Σε ποιον συνεργάτη</span>${chips('part', parts.map((p) => [p.id, p.name]), f.part)}</label>` : ''}
        <label class="f"><span>Σημείωση</span><input name="note" value="${esc(f.note || '')}"></label>
        ${f.id ? '' : `<label class="row small" style="margin:0 2px 4px;flex-wrap:wrap"><input type="checkbox" name="rep" style="width:auto" ${f.rep ? 'checked' : ''}> ↻ Επαναλαμβάνεται ${FQ.freqHtml('repf', { fq: f.repf || 'm1', cn: f.repfn, cu: f.repfu }, 'width:auto;padding:6px 8px;font-size:14px;margin-left:6px')}</label>`}
      </div>
      <button class="btn primary" style="width:100%" data-save>${f.id ? 'Αποθήκευση' : 'Καταχώρηση'}</button>
      ${f.id ? '<button class="btn" style="width:100%;margin-top:8px;color:var(--red)" data-del>Διαγραφή</button>' : '<button class="btn" style="width:100%;margin-top:8px" data-saveadd>Καταχώρηση και νέα</button>'}`;
    },
    mount(root, p, ui) {
      const f = st[k]; if (!f) return;
      const read = () => root.querySelectorAll('input[name],select[name]').forEach((el) => { f[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
      root.querySelector('[data-back]').addEventListener('click', () => { st[k] = null; ui.back(); });
      root.querySelectorAll('[data-ch]').forEach((c) => c.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]'); if (!b) return; read(); const n = c.dataset.ch;
        f[n] = f[n] === b.dataset.v && n !== 'cat' && n !== 'pay' && n !== 'dueK' ? '' : b.dataset.v;
        if (n === 'svc') { const s = O.services().find((x) => x.name === f.svc); if (s?.price && !parseAmount(f.a)) f.a = cm(s.price); }
        ui.render();
      }));
      const aI = root.querySelector('[name=a]'); bindCalc(root, aI, () => {});
      const fee = root.querySelector('[data-fee]');
      const upFee = () => { if (!fee) return; const pp = O.partner(f.part); const a = parseAmount(aI.value) || 0; fee.textContent = pp ? `Αμοιβή ${pp.name}: ${eur(a * (pp.pct || 0))} (θα τη χρωστάς)` : ''; };
      upFee(); aI.addEventListener('input', upFee);
      if (k === 'in') {
        const clI = root.querySelector('[name=cl]');
        ac(root, clI, () => O.clients().sort((a, b) => (a.last < b.last ? 1 : -1)).map((c) => ({ v: c.name, s: `${c.n}× · ${c.lastSvc || ''}` })), (v) => {
          read(); const c = O.clients().find((x) => x.name === v);
          if (c && !f.svc) f.svc = c.lastSvc; if (c && !parseAmount(f.a)) f.a = cm(c.lastA);
          const lastP = O.clientPays(v)[0]; if (lastP?.part && !f.part) f.part = lastP.part;
          ui.render();
        });
        if (!f.id && !f.cl) setTimeout(() => clI.focus(), 50);
      } else {
        const dI = root.querySelector('[name=desc]');
        ac(root, dI, () => { const m = new Map(); for (const r of O.expenses(true)) { if (!r.desc || r.sal) continue; const x = m.get(norm(r.desc)) || { v: r.desc, s: r.cat, n: 0, a: r.a, cat: r.cat, pay: r.pay }; x.n++; m.set(norm(r.desc), x); } return [...m.values()].sort((a, b) => b.n - a.n); }, (v) => {
          read(); const last = O.expenses(true).find((r) => norm(r.desc || '') === norm(v)); if (last) { if (!f.cat) f.cat = last.cat; if (!f.pay && last.pay) f.pay = last.pay; if (!parseAmount(f.a)) f.a = cm(last.a); }
          ui.render();
        });
        root.querySelector('[data-freq]')?.addEventListener('change', () => { read(); f.rep = true; ui.render(); });
        if (!f.id && !f.a) setTimeout(() => aI.focus(), 50);
      }
      const save = async (again) => {
        read(); const a = parseAmount(f.a); if (!a) { ui.toast('Γράψε ποσό'); return; }
        let rec;
        if (k === 'in') {
          if (!f.cl.trim()) { ui.toast('Γράψε πελάτη'); return; }
          const pp = O.partner(f.part);
          const dv = parseAmount(f.dueA) || 0; const due = f.dueK === 'owes' ? dv : f.dueK === 'iowe' ? -dv : 0;
          if (f.dueK && !dv) { ui.toast('Γράψε πόσα χρωστάει / χρωστάς'); return; }
          rec = { type: TYPE, d: f.d || today(), cl: f.cl.trim(), svc: f.svc.trim() || null, a, pay: f.pay || null, rcpt: !!f.rcpt, part: f.part || null, fee: pp ? Math.round(a * (pp.pct || 0) * 100) / 100 : null, due: due || null, note: f.note?.trim() || null };
        } else {
          if (!f.cat) { ui.toast('Διάλεξε κατηγορία'); return; }
          if (f.cat === 'Αμοιβή συνεργασίας' && !f.part) { ui.toast('Διάλεξε συνεργάτη'); return; }
          rec = { type: TYPE, d: f.d || today(), desc: f.desc.trim() || f.cat, cat: f.cat, a, pay: f.pay?.trim() || null, part: f.cat === 'Αμοιβή συνεργασίας' ? f.part : null, note: f.note?.trim() || null };
          if (!f.id && f.rep) {
            const fr = FQ.toRec({ fq: f.repf || 'm1', cn: f.repfn, cu: f.repfu }) || { unit: 'm', every: 1 };
            await store.put(O.OSP, null, { type: 'rec', biz: 1, name: rec.desc, a, cat: rec.cat, kind: 'Έξοδο', payer: 'Χαρά', for: 'Χαρά', unit: fr.unit, every: fr.every, start: rec.d });
            st[k] = null; ui.toast('Μπήκε στα επαναλαμβανόμενα του γραφείου ✓'); ui.go('#/office'); return;
          }
        }
        await store.put(O.OSP, f.id || null, rec);
        ui.toast('Καταχωρήθηκε ✓');
        if (again) { const d = f.d; st[k] = { ...blank(k), d, ...(k === 'in' ? { pay: f.pay } : {}) }; ui.render(); } else { st[k] = null; ui.go('#/office'); }
      };
      root.querySelector('[data-save]').addEventListener('click', () => save(false));
      root.querySelector('[data-saveadd]')?.addEventListener('click', () => save(true));
      root.querySelector('[data-del]')?.addEventListener('click', async () => { if (!(await ui.confirm('Διαγραφή;', 'Διαγραφή'))) return; await store.del(O.OSP, f.id); st[k] = null; ui.back(); });
    },
  };
}
