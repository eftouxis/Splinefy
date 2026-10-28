import { esc, eur, today, parseAmount, norm, MONTHS, MONTHS_GEN, addMonths } from '../util.js';
import { categories, memory, billType, recurringMovements } from '../ledger.js';
import { addDays } from '../util.js';
import * as store from '../store.js';
import * as LS from '../lessons.js';
import * as K from '../cars.js';
import { othHtml, readOth } from './othui.js';
import { label as stuLabel } from './lessons/ui.js';

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
        if (r.kind === 'Έξοδο' && r.both != null) { f.payer = 'Και οι 2'; f.bothX = String(Math.round(((r.a || 0) - r.both) * 100) / 100).replace('.', ','); }
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
        <label class="row" style="margin:4px 0 10px"><input type="checkbox" name="fwd" style="width:auto" ${f.fwd ? 'checked' : ''}> <b>Από εδώ και πέρα</b>&nbsp;με αυτό το ποσό (π.χ. νέα τιμή)</label>
        <div class="note small">Χωρίς το τικ αλλάζει μόνο αυτή τη φορά. Οι προηγούμενες φορές μένουν πάντα όπως ήταν. <a href="#/rec/${esc(f.sp)}/${esc(f.rec)}">Όλες οι ρυθμίσεις του παγίου ›</a></div></div>
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
        <div class="chips" data-stu>${LS.students().filter((s) => f.allStu || LS.isActive(s) || s.id === f.stu).map((s) => `<button type="button" class="chip ${s.id === f.stu ? 'on' : ''}" data-id="${esc(s.id)}">${esc(stuLabel(s))}</button>`).join('')}
        ${f.allStu ? '' : '<button type="button" class="chip" data-allstu>Παλιοί…</button>'}
        <button type="button" class="chip ${f.stu ? '' : 'on'}" data-id="">Κανένας</button></div></label>` : ''}
      ${k === 'Έσοδο' && f.cat === 'Μισθός' ? (() => {
        const base = f.d || today(); const auto = monthFromText(f.desc, base); const sel = f.mm || auto || base.slice(0, 7);
        const opts = [-3, -2, -1, 0, 1].map((n) => addMonths(`${base.slice(0, 7)}-01`, n).slice(0, 7));
        if (!opts.includes(sel)) opts.unshift(sel);
        return `<label class="f"><span>Αφορά μήνα (μετράει σε αυτόν, όποια μέρα κι αν πληρώθηκες)</span><select name="mm">${opts.map((m) => `<option value="${m}" ${m === sel ? 'selected' : ''}>${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</option>`).join('')}</select></label>
          <label class="row small" style="margin:-2px 2px 10px"><input type="checkbox" name="extra" style="width:auto" ${f.extra ? 'checked' : ''}> Έκτακτο (αναδρομικά, δώρο κ.λπ.) — μετράει επιπλέον του μισθού</label>`;
      })() : ''}
      <label class="f"><span>Περιγραφή</span><input name="desc" list="descs" value="${esc(f.desc)}" autocomplete="off" placeholder="${k === 'Μεταφορά' ? 'π.χ. revolut' : 'π.χ. Σκλαβενίτης'}"></label>
      <datalist id="descs">${descs.map((d) => `<option value="${esc(d)}">`).join('')}</datalist>
      ${k === 'Μεταφορά' ? `
        <label class="f"><span>Έδωσε</span>${seg('payer', [...people, 'Φίλιππος'].map((p) => [p, p]), f.payer)}</label>
        <label class="f"><span>Πήρε</span>${seg('for', [...people, 'Φίλιππος'].map((p) => [p, p]), f.for)}</label>
        <div class="note small">Φίλιππος = ο λογαριασμός του (κατάθεση ή ανάληψη).</div>`
      : `<label class="f"><span>${k === 'Έσοδο' ? 'Πήρε' : 'Πλήρωσε'}</span>${seg('payer', (k === 'Έξοδο' ? [...people, 'Και οι 2'] : people).map((p) => [p, p]), f.payer)}</label>
        ${k === 'Έξοδο' && f.payer === 'Και οι 2' ? `<div class="grid2"><label class="f"><span>Έδωσε ο Άλκης (€)</span><input name="both" inputmode="decimal" value="${esc(f.both)}"></label>
          <label class="f"><span>Έδωσε η Χαρά (€)</span><input name="bothX" inputmode="decimal" value="${esc(f.bothX ?? '')}"></label></div>` : ''}
        <label class="f"><span>Για ποιον</span>${k === 'Έσοδο'
          ? seg('for', [['', 'Μόνο γι’ αυτόν'], ['Κοινό', 'Κοινό ½'], ['Φίλιππος', 'Φίλιππος']], f.for)
          : seg('for', [['Κοινό', 'Κοινό ½'], ['Άλκης', 'Άλκης'], ['Χαρά', 'Χαρά'], ['Φίλιππος', 'Φίλιππος']], f.for)}</label>`}
      ${k === 'Έξοδο' && K.cars().length && (K.isFuelText(f.desc) || f.cat === 'Αυτοκίνητο' || f.car) ? (() => {
        const fuel = K.isFuelText(f.desc) && f.cat !== 'Αυτοκίνητο', service = !fuel && f.cat === 'Αυτοκίνητο';
        if (!f.carTouched && !f.id) f.car = K.carFromText(f.desc, f.cat) || null;
        return `<div class="note" style="margin-bottom:10px"><label class="f"><span>${fuel ? '⛽ Καύσιμα για' : '🔧 Ποιο αυτοκίνητο'}</span><div class="chips" data-car>${K.cars().filter((c) => !c.sold || c.id === f.car).map((c) => `<button type="button" class="chip ${c.id === f.car ? 'on' : ''}" data-id="${esc(c.id)}">🚗 ${esc(c.name)}</button>`).join('')}
          ${service ? '' : `<button type="button" class="chip ${f.car ? '' : 'on'}" data-id="">Κανένα</button>`}</div></label>
          ${fuel && f.car ? `<div class="grid2"><label class="f"><span>Χιλιόμετρα κοντέρ (προαιρετικά)</span><input name="km" inputmode="numeric" value="${esc(f.km ?? '')}"></label>
            <label class="f"><span>${K.fuelFromText(f.desc, f.car) === 'Αέριο' ? 'Κιλά' : 'Λίτρα'} (προαιρετικά)</span><input name="q" inputmode="decimal" value="${esc(f.q ?? '')}"></label></div>` : ''}
          ${service ? `<label class="f" style="margin:0"><span>Τι έκαναν (προαιρετικά)</span><textarea name="note" rows="2" placeholder="π.χ. λάδια, φίλτρα, τακάκια">${esc(f.note || '')}</textarea></label>` : ''}</div>`;
      })() : ''}
      ${k === 'Έξοδο' && (f.bill || billType(f.desc)) ? `<div class="note" style="margin-bottom:10px"><div class="small" style="font-weight:600;margin-bottom:6px">📄 Λογαριασμός (προαιρετικά)</div>
        <div class="grid3"><label class="f"><span>Είδος</span><input name="bill" value="${esc(f.bill || billType(f.desc))}"></label>
        <label class="f"><span>Περίοδος</span><input name="period" value="${esc(f.period || '')}" placeholder="π.χ. 8/8–2/10"></label>
        <label class="f"><span>${({ 'Ρεύμα': 'kWh', 'Νερό': 'm³', 'Θέρμανση': 'Μονάδες' })[f.bill || billType(f.desc)] || 'Κατανάλωση'}</span><input name="cons" inputmode="decimal" value="${esc(f.cons ?? '')}"></label></div></div>` : ''}
      ${!f.id && k !== 'Μεταφορά' ? (() => {
        const n = norm(f.desc).trim(); const t0 = f.d || today();
        const defs = n ? store.records('rec').filter((r) => norm(r.name).trim() === n) : [];
        const occ = defs.length ? recurringMovements(addMonths(t0, 2)).find((m) => defs.some((x) => x.id === m.rec) && Math.abs((new Date(m.d) - new Date(t0)) / 864e5) <= 20) : null;
        const def = occ ? defs.find((x) => x.id === occ.rec) : null;
        if (occ) return `<div class="note" style="margin-bottom:10px">↻ Το «${esc(def.name)}» είναι πάγιο και μπαίνει μόνο του (${esc(occ.d.split('-').reverse().join('/'))}, ${eur(occ.a)}). Για νέο ποσό <a href="#/edit/${esc(def._sp)}/${esc(occ.id)}">πάτα εδώ</a> και διάλεξε «Από εδώ και πέρα» — αλλιώς θα μετρηθεί δύο φορές.</div>`;
        return `<label class="row small" style="margin:0 2px 10px"><input type="checkbox" name="rep" style="width:auto" ${f.rep ? 'checked' : ''}> ↻ Επαναλαμβάνεται
          <select name="repf" style="width:auto;padding:6px 8px;font-size:14px;margin-left:6px">${[['m1', 'κάθε μήνα'], ['m2', 'κάθε 2 μήνες'], ['m3', 'κάθε 3 μήνες'], ['m6', 'κάθε 6 μήνες'], ['m12', 'κάθε χρόνο'], ['d14', 'κάθε 2 εβδομάδες'], ['d7', 'κάθε εβδομάδα']].map(([v, l]) => `<option value="${v}" ${v === (f.repf || 'm1') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
      })() : ''}
      <details class="more" ${f.trip || f.share || (f.oth && f.oth.length) || f.moreOpen || (f.note && f.cat !== 'Αυτοκίνητο') ? 'open' : ''}><summary>Περισσότερα ▾</summary>
        ${k === 'Έξοδο' ? `<label class="f"><span>Ταξίδι</span><input name="trip" list="trips" value="${esc(f.trip)}" autocomplete="off"></label>
          <datalist id="trips">${trips.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
          <label class="f"><span>Άλλο μοίρασμα (όχι μισά-μισά): μερίδιο Άλκη (€)</span><input name="share" inputmode="decimal" value="${esc(f.share)}"></label>
          ${othHtml(f.oth)}
` : ''}
        ${k === 'Έξοδο' && f.cat === 'Αυτοκίνητο' && K.cars().length && !K.isFuelText(f.desc) ? '' : `<label class="f"><span>Σημείωση</span><textarea name="note" rows="2">${esc(f.note || '')}</textarea></label>`}
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
      root.querySelectorAll('input[name],select[name],textarea[name]').forEach((el) => { if (el.name === 'othp' || el.name === 'otha') return; f[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
      if (root.querySelector('[data-othrow]') || f.oth) f.oth = readOth(root) || (root.querySelector('[data-othrow]') ? [] : f.oth);
    };
    root.querySelector('[data-othadd]')?.addEventListener('click', () => { read(); f.oth = [...(f.oth || []), { p: '', f: 0.5 }]; f.moreOpen = 1; ui.render(); });
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
      read();
      if (f.kind === 'Έσοδο' && f.cat === 'Ιδιαίτερα' && !f.stu && LS.hasLessons()) {
        const n = norm(f.desc).trim(); const hit = LS.students().filter((s) => n && (norm(s.full) === n || norm(s.name) === n || (norm(s.full || '').startsWith(n) && n.length > 3)));
        const act = hit.filter((s) => LS.isActive(s)); const one = act.length === 1 ? act[0] : hit.length === 1 ? hit[0] : null;
        if (one) { f.stu = one.id; f.desc = one.full || one.name; if (!parseAmount(f.a)) { const b = LS.balance(one.id); f.a = String(b > 0.005 ? b : LS.priceAt(one).price || '').replace('.', ','); } ui.render(); return; }
      }
      const m = memory().get(norm(f.desc));
      if (!m) { if (!f.id) f.bill = billType(f.desc) || ''; ui.render(); return; }
      if (!f.touched.cat && m.kind === f.kind && m.cat) f.cat = m.cat;
      if (!f.touched.for && m.kind === f.kind) f.for = m.for ?? f.for;
      if (!f.bill) f.bill = billType(f.desc);
      ui.render(); root.querySelector('[name=a]')?.focus();
    });
    root.querySelector('[name=cat]')?.addEventListener('change', () => { f.touched.cat = 1; read(); ui.render(); });
    root.querySelector('[data-car]')?.addEventListener('click', (e) => {
      if (e.target.dataset.id === undefined) return; read(); f.car = e.target.dataset.id || null; f.carTouched = 1; ui.render();
    });
    root.querySelector('[data-stu]')?.addEventListener('click', (e) => {
      if (e.target.dataset.allstu !== undefined) { read(); f.allStu = 1; ui.render(); return; }
      if (e.target.dataset.id === undefined) return; read();
      f.stu = e.target.dataset.id || null;
      if (f.stu) { const st = LS.student(f.stu); f.desc = st.full || st.name; if (!parseAmount(f.a)) { const b = LS.balance(f.stu); f.a = String(b > 0.005 ? b : LS.priceAt(st).price || '').replace('.', ','); } }
      ui.render();
    });
    root.querySelector('[name=toShared]')?.addEventListener('change', () => { read(); ui.render(); });
    const bA = root.querySelector('[name=both]'), bX = root.querySelector('[name=bothX]'), aI = root.querySelector('[name=a]');
    const fill = (src, dst) => { const t = parseAmount(aI.value), v = parseAmount(src.value); if (t != null && v != null) dst.value = String(Math.round((t - v) * 100) / 100).replace('.', ','); };
    bA?.addEventListener('input', () => fill(bA, bX)); bX?.addEventListener('input', () => fill(bX, bA));
    root.querySelector('[name=mm]')?.addEventListener('change', () => { read(); f.mmTouched = 1; });
    root.querySelector('[name=desc]')?.addEventListener('blur', () => { if (f.cat !== 'Μισθός' || f.mmTouched) return; read(); const m = monthFromText(f.desc, f.d); if (m && m !== f.mm) { f.mm = m; ui.render(); } });
    if (!f.id && !f.a) setTimeout(() => root.querySelector('[name=a]')?.focus(), 50);

    const save = async (again) => {
      read();
      const amt = parseAmount(f.a);
      if (amt == null || amt < 0) { ui.toast('Γράψε ποσό'); return; }
      if (f.occ) {
        const [rid, d] = f.id.split('@');
        if (f.fwd) {                                // split the recurring item: the old one ends the day before, a new one starts here
          const def = store.state.data[f.sp].recs.get(rid);
          const { id: _i, _t, _u, _m, _x, _sp, ...rest } = def;
          const ov = store.state.data[f.sp].recs.has(f.id) ? [{ id: f.id, del: true }] : [];
          if (!def.start || d <= def.start) await store.putMany(f.sp, [{ id: rid, set: { a: amt, payer: f.payer } }, ...ov]);   // the very first time: just change it
          else await store.putMany(f.sp, [{ id: rid, set: { end: addDays(d, -1) } }, { id: null, set: { ...rest, a: amt, payer: f.payer, start: d } }, ...ov]);
          f = null; ui.toast('Νέο ποσό από εδώ και πέρα ✓'); ui.back(); return;
        }
        await store.put(f.sp, f.id, { type: 'recx', a: amt, payer: f.payer, skip: f.skipped || null });
        f = null; ui.toast('Αποθηκεύτηκε ✓'); ui.back(); return;
      }
      if (f.kind !== 'Μεταφορά' && !f.cat) { ui.toast('Διάλεξε κατηγορία'); return; }
      if (f.kind === 'Έξοδο' && f.cat === 'Αυτοκίνητο' && K.cars().length && !K.isFuelText(f.desc) && !f.car) { ui.toast('Διάλεξε αυτοκίνητο'); return; }
      if (f.payer === 'Και οι 2') {
        const al = parseAmount(f.both), ch = parseAmount(f.bothX);
        if (al == null && ch == null) { ui.toast('Γράψε πόσα έδωσε ο καθένας'); return; }
        f.both = String(al ?? Math.round((amt - ch) * 100) / 100);
        if (Number(f.both) < 0 || Number(f.both) > amt + 0.005) { ui.toast('Τα ποσά δεν ταιριάζουν με το σύνολο'); return; }
      } else if (f.kind === 'Έξοδο') f.both = '';
      if (f.kind === 'Μεταφορά' && f.payer === f.for) { ui.toast('«Έδωσε» και «Πήρε» δεν μπορεί να είναι ίδιοι'); return; }
      const rec = { type: 'tx', d: f.d, a: amt, desc: f.desc.trim(), cat: f.kind === 'Μεταφορά' ? 'Μεταφορά μεταξύ μας' : f.cat, kind: f.kind,
        payer: f.payer, for: f.for, both: parseAmount(f.both), share: parseAmount(f.share), trip: f.trip || null, note: f.note || null,
        bill: f.bill || billType(f.desc) || null, period: f.period || null, cons: parseAmount(f.cons),
        stu: f.kind === 'Έσοδο' && f.cat === 'Ιδιαίτερα' ? f.stu || null : null, md: null,
        extra: f.kind === 'Έσοδο' && f.cat === 'Μισθός' && (f.extra === true || f.extra === 'on') ? true : null,
        car: f.kind === 'Έξοδο' && f.car && (K.isFuelText(f.desc) || f.cat === 'Αυτοκίνητο') ? f.car : null,
        km: f.car && K.isFuelText(f.desc) ? parseAmount(String(f.km ?? '').replace(/\./g, '')) : null, q: f.car && K.isFuelText(f.desc) ? parseAmount(f.q) : null,
        ft: f.car && f.cat !== 'Αυτοκίνητο' && K.isFuelText(f.desc) ? K.fuelFromText(f.desc, f.car) : null,
        oth: f.kind === 'Έξοδο' ? readOth(root) : null };
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
        const tsp = targetSpace(f);
        await store.put(tsp, null, rec);
        if (f.rep && (f.rep === true || f.rep === 'on')) {        // from now on it is a recurring item (starts at the next time)
          const [u, e] = [f.repf?.[0] === 'd' ? 'd' : 'm', Number((f.repf || 'm1').slice(1))];
          const next = u === 'd' ? addDays(f.d, e) : addMonths(f.d, e);
          await store.put(tsp, null, { type: 'rec', name: rec.desc || rec.cat, a: rec.a, cat: rec.cat, kind: rec.kind, payer: rec.payer, for: rec.for, unit: u, every: e, start: next, oth: rec.oth || null, both: null });
          ui.toast('Καταχωρήθηκε ✓ και μπήκε στα πάγια');
        }
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
