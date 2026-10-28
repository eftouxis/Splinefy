import { esc, eur, today, parseAmount, norm, MONTHS, MONTHS_GEN, addMonths } from '../util.js';
import { categories, memory, billType, recurringMovements } from '../ledger.js';
import * as store from '../store.js';
import * as LS from '../lessons.js';

const KIND = { exp: 'Έξοδο', inc: 'Έσοδο', trf: 'Μεταφορά' };
const KEY = { 'Έξοδο': 'exp', 'Έσοδο': 'inc', 'Μεταφορά': 'trf' };
let f = null;          // form state

const STEMS = ['ιανουαρ', 'φεβρουαρ', 'μαρτ', 'απριλ', 'μαι', 'ιουν', 'ιουλ', 'αυγουστ', 'σεπτεμβρ', 'οκτωβρ', 'νοεμβρ', 'δεκεμβρ'];
/** «μισθός οκτωβρίου» → the month it concerns (nearest one not after the next month) */
function monthFromText(desc, d) {
  const t = norm(desc); const i = STEMS.findIndex((st) => new RegExp(`(^|[^a-zα-ω])${st}`).test(t));
  if (i < 0) return null;
  let y = Number(d.slice(0, 4)); const m = `${y}-${String(i + 1).padStart(2, '0')}`;
  return m > addMonths(d, 1).slice(0, 7) ? `${y - 1}${m.slice(4)}` : m;
}
const eomOf = (m) => { const [y, mo] = m.split('-').map(Number); return `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`; };
function blank(kindKey) {
  const me = store.state.user;
  const pre = new URLSearchParams(location.hash.split('?')[1] || '');
  return { mm: '', kind: KIND[kindKey], d: today(), a: '', desc: '', cat: '', payer: me, for: kindKey === 'exp' ? 'Κοινό' : kindKey === 'trf' ? (me === 'Άλκης' ? 'Χαρά' : 'Άλκης') : '',
    both: '', share: '', trip: '', note: '', bill: '', period: '', cons: '', toShared: false, id: null, sp: null, touched: {}, ...(pre.get('cat') ? { cat: pre.get('cat') } : {}) };
}
/** where a movement is stored: personal space only when it concerns the user alone */
function targetSpace(x) {
  const me = store.state.user;
  if (x.stu && x.kind === 'Έσοδο' && x.cat === 'Ιδιαίτερα') return LS.LSP;
  const personal = store.state.spaces.find((s) => s.owner === me && s.members.length === 1);
  if (!personal || x.toShared) return 'shared';
  if (x.kind === 'Μεταφορά' || x.payer !== me) return 'shared';
  if (x.kind === 'Έξοδο' && x.for !== me) return 'shared';
  if (x.kind === 'Έσοδο' && x.for && x.for !== me) return 'shared';
  if (parseAmount(x.both) != null || parseAmount(x.share) != null) return 'shared';
  return personal.id;
}
const seg = (name, opts, val, cls = '') => `<div class="seg ${cls}" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-val="${esc(v)}" class="${v === val ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;

export default {
  html([a, b]) {
    const me = store.state.user;
    let occ = null;
    if (b !== undefined) {                       // edit
      const sp = a, id = decodeURIComponent(b);
      if (!f || f.id !== id) {
        let r = store.state.data[sp]?.recs.get(id);
        if (!r && id.includes('@')) { occ = recurringMovements('2100-01-01').find((x) => x.id === id); r = occ; }
        if (!r) return `<h1>Δεν βρέθηκε</h1><a class="btn" href="#/">Αρχική</a>`;
        f = { ...blank(KEY[r.kind] || 'exp'), ...Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_'))), a: r.a ?? '', both: r.both ?? '', share: r.share ?? '', cons: r.cons ?? '', id, sp, occ: id.includes('@'), touched: { cat: 1, for: 1, payer: 1 }, mm: r.md ? r.md.slice(0, 7) : '' };
      }
    } else if (!f || f.id || f.kindKey !== a || location.hash.includes('?')) { f = blank(a); f.kindKey = a; if (location.hash.includes('?')) history.replaceState(null, '', `#/add/${a}`); }
    const k = f.kind, kk = KEY[k];
    const people = ['Άλκης', 'Χαρά'];
    const cats = categories(k);
    const descs = [...new Set(store.records('tx').sort((x, y) => (x.d < y.d ? 1 : -1)).map((r) => r.desc).filter(Boolean))].slice(0, 400);
    const trips = store.records('trip').map((t) => t.name);
    const target = f.id ? f.sp : targetSpace(f);
    const tgtName = target === 'shared' ? 'Κοινό — το βλέπει και η Χαρά' : 'Προσωπικό — μόνο εσύ';
    if (f.occ) {
      return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>${esc(f.desc)} <span class="small muted">↻ πάγιο</span></h1></div>
      <div class="card"><div class="muted small">Αυτή η φορά: ${esc(f.d)}</div>
        <label class="f"><span>Ποσό αυτή τη φορά</span><input class="amount" name="a" inputmode="decimal" value="${esc(f.a)}"></label>
        <label class="f"><span>Πλήρωσε</span>${seg('payer', people.map((p) => [p, p]), f.payer)}</label>
        <div class="note">Αλλάζει μόνο αυτή τη φορά. Για μόνιμη αλλαγή: Ρυθμίσεις → Πάγια.</div></div>
      <button class="btn primary" style="width:100%" data-save>Αποθήκευση</button>
      <button class="btn" style="width:100%;margin-top:8px" data-skip>${f.skipped ? 'Επαναφορά (έγινε κανονικά)' : 'Δεν έγινε αυτή τη φορά'}</button>`;
    }
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>${f.id ? 'Επεξεργασία' : 'Νέα κίνηση'}</h1></div>
    ${f.id ? '' : seg('kind', [['Έξοδο', 'Έξοδο'], ['Έσοδο', 'Έσοδο'], ['Μεταφορά', 'Μεταφορά']], k, kk)}
    <div class="card" style="margin-top:10px">
      <input class="amount" name="a" inputmode="decimal" placeholder="0,00 €" value="${esc(f.a)}" autocomplete="off">
      <div class="grid2" style="margin-top:10px">
        <label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${esc(f.d)}"></label>
        ${k === 'Μεταφορά' ? '<div></div>' : `<label class="f"><span>Κατηγορία</span><select name="cat"><option value=""></option>${cats.map((c) => `<option ${c === f.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`}
      </div>
      ${k === 'Έσοδο' && f.cat === 'Ιδιαίτερα' && LS.hasLessons() && LS.students().length ? `<label class="f"><span>Μαθητής (για να ξεχρεώνει στην καρτέλα του)</span>
        <div class="chips" data-stu>${LS.students().filter((s) => LS.isActive(s) || s.id === f.stu || LS.balance(s.id) > 0.005).map((s) => `<button type="button" class="chip ${s.id === f.stu ? 'on' : ''}" data-id="${esc(s.id)}">${esc(s.name)}</button>`).join('')}
        <button type="button" class="chip ${f.stu ? '' : 'on'}" data-id="">Κανένας</button></div></label>` : ''}
      ${k === 'Έσοδο' && f.cat === 'Μισθός' ? (() => {
        const base = f.d || today(); const auto = monthFromText(f.desc, base); const sel = f.mm || auto || base.slice(0, 7);
        const opts = [-3, -2, -1, 0, 1].map((n) => addMonths(`${base.slice(0, 7)}-01`, n).slice(0, 7));
        if (!opts.includes(sel)) opts.unshift(sel);
        return `<label class="f"><span>Αφορά μήνα (μετράει σε αυτόν, όποια μέρα κι αν πληρώθηκες)</span><select name="mm">${opts.map((m) => `<option value="${m}" ${m === sel ? 'selected' : ''}>${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</option>`).join('')}</select></label>`;
      })() : ''}
      <label class="f"><span>Περιγραφή</span><input name="desc" list="descs" value="${esc(f.desc)}" autocomplete="off" placeholder="${k === 'Μεταφορά' ? 'π.χ. revolut' : 'π.χ. Σκλαβενίτης'}"></label>
      <datalist id="descs">${descs.map((d) => `<option value="${esc(d)}">`).join('')}</datalist>
      ${k === 'Μεταφορά' ? `
        <label class="f"><span>Έδωσε</span>${seg('payer', [...people, 'Φίλιππος'].map((p) => [p, p]), f.payer)}</label>
        <label class="f"><span>Πήρε</span>${seg('for', [...people, 'Φίλιππος'].map((p) => [p, p]), f.for)}</label>
        <div class="note small">Φίλιππος = ο λογαριασμός του (κατάθεση ή ανάληψη).</div>`
      : `<label class="f"><span>${k === 'Έσοδο' ? 'Πήρε' : 'Πλήρωσε'}</span>${seg('payer', people.map((p) => [p, p]), f.payer)}</label>
        <label class="f"><span>Για ποιον</span>${k === 'Έσοδο'
          ? seg('for', [['', 'Μόνο γι’ αυτόν'], ['Κοινό', 'Κοινό ½'], ['Φίλιππος', 'Φίλιππος']], f.for)
          : seg('for', [['Κοινό', 'Κοινό ½'], ['Άλκης', 'Άλκης'], ['Χαρά', 'Χαρά'], ['Φίλιππος', 'Φίλιππος']], f.for)}</label>`}
      <details class="more" ${f.trip || f.note || f.both || f.share || f.bill ? 'open' : ''}><summary>Περισσότερα ▾</summary>
        ${k === 'Έξοδο' ? `<label class="f"><span>Ταξίδι</span><input name="trip" list="trips" value="${esc(f.trip)}" autocomplete="off"></label>
          <datalist id="trips">${trips.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
          <div class="grid2"><label class="f"><span>Πλήρωσαν και οι 2: έδωσε ο Άλκης (€)</span><input name="both" inputmode="decimal" value="${esc(f.both)}"></label>
          <label class="f"><span>Άλλο μοίρασμα: μερίδιο Άλκη (€)</span><input name="share" inputmode="decimal" value="${esc(f.share)}"></label></div>
          <div class="grid3"><label class="f"><span>Είδος λογαρ.</span><input name="bill" value="${esc(f.bill || billType(f.desc))}"></label>
          <label class="f"><span>Περίοδος</span><input name="period" value="${esc(f.period)}"></label>
          <label class="f"><span>Κατανάλωση</span><input name="cons" inputmode="decimal" value="${esc(f.cons)}"></label></div>` : ''}
        <label class="f"><span>Σημείωση</span><textarea name="note" rows="2">${esc(f.note)}</textarea></label>
        ${!f.id && target !== 'shared' ? `<label class="row small"><input type="checkbox" name="toShared" style="width:auto" ${f.toShared ? 'checked' : ''}> Να μπει στο Κοινό (να το βλέπει και η Χαρά)</label>` : ''}
      </details>
      <div class="small muted" style="margin-top:8px">Αποθηκεύεται στο: <b>${tgtName}</b></div>
    </div>
    <button class="btn primary" style="width:100%" data-save>${f.id ? 'Αποθήκευση' : 'Καταχώρηση'}</button>
    ${f.id ? `<button class="btn" style="width:100%;margin-top:8px;color:var(--red)" data-del>Διαγραφή</button>
      <div class="small muted center" style="margin-top:8px">${f._u ? '' : ''}</div>` : `<button class="btn" style="width:100%;margin-top:8px" data-saveadd>Καταχώρηση και νέα</button>`}`;
  },
  mount(root, [a, b], ui) {
    const read = () => {
      root.querySelectorAll('input[name],select[name],textarea[name]').forEach((el) => { f[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    };
    root.querySelector('[data-back]')?.addEventListener('click', () => { f = null; ui.back(); });
    root.querySelectorAll('[data-seg]').forEach((sg) => sg.addEventListener('click', (e) => {
      const v = e.target.dataset.val; if (v === undefined) return; read();
      const name = sg.dataset.seg;
      if (name === 'kind') { const kk = KEY[v]; const keep = { a: f.a, d: f.d, desc: f.desc }; f = { ...blank(kk), ...keep, kindKey: kk }; history.replaceState(null, '', `#/add/${kk}`); }
      else { f[name] = v; f.touched[name] = 1; }
      ui.render();
    }));
    const desc = root.querySelector('[name=desc]');
    desc?.addEventListener('change', () => {
      read(); const m = memory().get(norm(f.desc)); if (!m) return;
      if (!f.touched.cat && m.kind === f.kind && m.cat) f.cat = m.cat;
      if (!f.touched.for && m.kind === f.kind) f.for = m.for ?? f.for;
      if (!f.bill) f.bill = billType(f.desc);
      ui.render(); root.querySelector('[name=a]')?.focus();
    });
    root.querySelector('[name=cat]')?.addEventListener('change', () => { f.touched.cat = 1; if (f.kind === 'Έσοδο') { read(); ui.render(); } });
    root.querySelector('[data-stu]')?.addEventListener('click', (e) => {
      if (e.target.dataset.id === undefined) return; read();
      f.stu = e.target.dataset.id || null;
      if (f.stu) { const st = LS.student(f.stu); f.desc = st.full || st.name; if (!parseAmount(f.a)) { const b = LS.balance(f.stu); f.a = String(b > 0.005 ? b : LS.priceAt(st).price || '').replace('.', ','); } }
      ui.render();
    });
    root.querySelector('[name=toShared]')?.addEventListener('change', () => { read(); ui.render(); });
    root.querySelector('[name=mm]')?.addEventListener('change', () => { read(); f.mmTouched = 1; });
    root.querySelector('[name=desc]')?.addEventListener('blur', () => { if (f.cat !== 'Μισθός' || f.mmTouched) return; read(); const m = monthFromText(f.desc, f.d); if (m && m !== f.mm) { f.mm = m; ui.render(); } });
    if (!f.id && !f.a) setTimeout(() => root.querySelector('[name=a]')?.focus(), 50);

    const save = async (again) => {
      read();
      const amt = parseAmount(f.a);
      if (amt == null || amt < 0) { ui.toast('Γράψε ποσό'); return; }
      if (f.occ) {
        const [rid, d] = f.id.split('@');
        await store.put(f.sp, f.id, { type: 'recx', a: amt, payer: f.payer, skip: f.skipped || null });
        f = null; ui.toast('Αποθηκεύτηκε ✓'); ui.back(); return;
      }
      if (f.kind !== 'Μεταφορά' && !f.cat) { ui.toast('Διάλεξε κατηγορία'); return; }
      if (f.kind === 'Μεταφορά' && f.payer === f.for) { ui.toast('«Έδωσε» και «Πήρε» δεν μπορεί να είναι ίδιοι'); return; }
      const rec = { type: 'tx', d: f.d, a: amt, desc: f.desc.trim(), cat: f.kind === 'Μεταφορά' ? 'Μεταφορά μεταξύ μας' : f.cat, kind: f.kind,
        payer: f.payer, for: f.for, both: parseAmount(f.both), share: parseAmount(f.share), trip: f.trip || null, note: f.note || null,
        bill: f.bill || billType(f.desc) || null, period: f.period || null, cons: parseAmount(f.cons),
        stu: f.kind === 'Έσοδο' && f.cat === 'Ιδιαίτερα' ? f.stu || null : null, md: null };
      if (f.kind === 'Έσοδο' && f.cat === 'Μισθός') {
        const mm = f.mm || monthFromText(f.desc, f.d) || f.d.slice(0, 7); const dm = f.d.slice(0, 7);
        rec.md = mm < dm ? eomOf(mm) : mm > dm ? `${mm}-01` : null;
        if (!rec.desc) rec.desc = `Μισθός ${MONTHS_GEN[Number(mm.slice(5)) - 1]}`;
      }
      if (f.id) {
        const want = targetSpace({ ...f, toShared: f.sp === 'shared' });
        const cur = store.state.data[f.sp].recs.get(f.id);
        if (cur.fx) { const ok = await ui.confirm('Είναι παλιά κίνηση (από τα Excel). Να αλλάξει;', 'Αλλαγή', false); if (!ok) return; await store.put(f.sp, f.id, { ...rec, fx: null }); }
        else if (want !== f.sp && f.sp !== 'shared') await store.move(f.sp, want, { ...cur, ...rec });
        else await store.put(f.sp, f.id, rec);
      } else {
        await store.put(targetSpace(f), null, rec);
      }
      ui.toast('Καταχωρήθηκε ✓');
      if (again) { const kk = KEY[f.kind]; const d = f.d; f = blank(kk); f.kindKey = kk; f.d = d; ui.render(); }
      else { f = null; ui.go('#/'); }
    };
    root.querySelector('[data-save]')?.addEventListener('click', () => save(false));
    root.querySelector('[data-saveadd]')?.addEventListener('click', () => save(true));
    root.querySelector('[data-skip]')?.addEventListener('click', async () => {
      read(); await store.put(f.sp, f.id, { type: 'recx', skip: f.skipped ? null : 1 }); f = null; ui.toast('Αποθηκεύτηκε ✓'); ui.back();
    });
    root.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await ui.confirm('Διαγραφή αυτής της κίνησης;', 'Διαγραφή'))) return;
      await store.del(f.sp, f.id); f = null; ui.toast('Διαγράφηκε'); ui.back();
    });
  },
};
