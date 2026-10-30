import { esc, eur, today, parseAmount, norm, MONTHS, MONTHS_GEN, addMonths } from '../util.js';
import { categories, memory, billType, recurringMovements } from '../ledger.js';
import { addDays } from '../util.js';
import * as store from '../store.js';
import * as LS from '../lessons.js';
import * as K from '../cars.js';
import { othHtml, readOth } from './othui.js';
import { label as stuLabel } from './lessons/ui.js';
import { calcHtml, bindCalc } from './calc.js';
import * as FQ from './freq.js';
import * as T from '../trips.js';
import * as P from '../people.js';
import { fx } from '../ledger.js';
import { tripSheet } from './trips.js';

/** «who finally pays what» line under the expense form */
function burdenHtml(f) {
  const amt = parseAmount(f.a); if (f.kind !== 'Έξοδο' || !amt) return '';
  const oth = (f.oth || []).filter((o) => o.p && (o.a != null || o.f));
  const both = f.payer === 'Και οι 2' ? parseAmount(f.both) ?? (parseAmount(f.bothX) != null ? amt - parseAmount(f.bothX) : null) : null;
  const r = { kind: 'Έξοδο', d: '2000-01-01', a: amt, payer: f.payer === 'Και οι 2' ? 'Άλκης' : f.payer, for: f.for || 'Κοινό', both, share: f.for === 'Κοινό' ? parseAmount(f.share) : null, oth };
  const x = fx(r, '9999-12-31');
  const othParts = oth.map((o) => [P.person(o.p)?.name || '—', o.a != null ? o.a : o.f * amt]);
  const parts = (x.O === 'Φίλιππος' ? [['Φίλιππος', x.N]] : [['Άλκης', x.Q], ['Χαρά', x.S]]).filter(([, v]) => Math.abs(v) > 0.004).concat(othParts);
  const lines = [`Τελικά το επιβαρύνονται: ${parts.map(([n, v]) => `${esc(n)} <b>${eur(v)}</b>`).join(' · ') || '—'}`];
  if (x.O === 'Φίλιππος') lines.push('Βγαίνει από τα χρήματα του Φιλίππου (πορτοφόλι του).');
  else { const net = x.P - x.Q; if (Math.abs(net) > 0.004) lines.push(net > 0 ? `→ Η Χαρά χρωστάει στον Άλκη <b>${eur(net)}</b> από αυτό` : `→ Ο Άλκης χρωστάει στη Χαρά <b>${eur(-net)}</b> από αυτό`); }
  if (othParts.length) lines.push(r.payer === store.state.user ? `→ ${othParts.map(([n, v]) => `${esc(n)} <b>${eur(v)}</b>`).join(', ')} στα Χρωστούμενα (σου τα χρωστάνε)` : '→ Τα Χρωστούμενα μετράνε μόνο όταν πλήρωσες εσύ.');
  if (parseAmount(f.share) != null && f.for !== 'Κοινό') lines.push('<span class="neg">Το «όχι μισό-μισό» ισχύει μόνο με «Κοινό».</span>');
  return lines.join('<br>');
}

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
    both: '', share: '', trip: '', note: '', bill: '', period: '', cons: '', toShared: false, id: null, sp: null, touched: {}, ...(pre.get('cat') ? { cat: pre.get('cat') } : {}), ...(pre.get('trip') ? { trip: pre.get('trip'), tripTouched: 1 } : {}), ...(pre.get('for') ? { for: pre.get('for'), touched: { for: 1 } } : {}), ...(pre.get('payer') ? { payer: pre.get('payer') } : {}), ...(pre.get('a') ? { a: pre.get('a') } : {}) };
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
const ftOf = (f) => (f.touched?.ft && f.ft ? f.ft : K.fuelFromText(f.desc, f.car));
/** suggestions under «Περιγραφή» while typing (most used first) */
let AC = { v: -1, list: [] };
function acList() {
  if (AC.v === store.state.version) return AC.list;
  const m = new Map();
  for (const r of store.records('tx')) { if (!r.desc) continue; const k = norm(r.desc).trim(); const x = m.get(k) || { d: r.desc.trim(), n: 0, last: '', cat: r.cat, kind: r.kind }; x.n++; if (r.d > x.last) { x.last = r.d; x.d = r.desc.trim(); x.cat = r.cat; x.kind = r.kind; } m.set(k, x); }
  for (const r of store.records('rec')) { const k = norm(r.name).trim(); if (!m.has(k)) m.set(k, { d: r.name, n: 1, last: r.start || '', cat: r.cat, kind: r.kind }); }
  AC = { v: store.state.version, list: [...m.values()].sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : -1)) };
  return AC.list;
}
function bindAc(root, input, kind) {
  const box = root.querySelector('[data-ac]'); if (!box || !input) return;
  const show = () => {
    const q = norm(input.value).trim(); if (!q) { box.hidden = true; return; }
    const all = acList().filter((x) => x.kind === kind || kind === 'Μεταφορά');
    const st = all.filter((x) => norm(x.d).startsWith(q)), inc = all.filter((x) => !norm(x.d).startsWith(q) && norm(x.d).includes(q));
    const hits = [...st, ...inc].filter((x) => norm(x.d) !== q).slice(0, 7);
    if (!hits.length) { box.hidden = true; return; }
    box.innerHTML = hits.map((x) => `<button type="button" data-acv="${esc(x.d)}"><b>${esc(x.d)}</b><span class="small muted">${esc(x.cat || '')} · ${x.n}×</span></button>`).join('');
    box.hidden = false;
  };
  input.addEventListener('input', show);
  input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
  box.addEventListener('pointerdown', (e) => e.preventDefault());
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-acv]'); if (!b) return; input.value = b.dataset.acv; box.hidden = true; input.dispatchEvent(new Event('change')); });
}
const cm = (x) => (x == null || x === '' ? '' : String(x).replace('.', ','));
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
        f = { ...blank(KEY[r.kind] || 'exp'), ...Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_'))), a: cm(r.a), both: cm(r.both), share: cm(r.share), cons: cm(r.cons), q: cm(r.q), id, sp, occ: id.includes('@'), touched: { cat: 1, for: 1, payer: 1, ft: r.ft ? 1 : 0 }, tripTouched: 1, withOth: r.oth && r.oth.length ? 1 : 0, mm: r.md ? r.md.slice(0, 7) : '' };
        if (r.kind === 'Έξοδο' && r.both != null) { f.payer = 'Και οι 2'; f.bothX = String(Math.round(((r.a || 0) - r.both) * 100) / 100).replace('.', ','); }
      }
    } else if (!f || f.id || f.kindKey !== a || location.hash.includes('?')) { f = blank(a); f.kindKey = a; if (location.hash.includes('?')) history.replaceState(null, '', `#/add/${a}`); }
    const k = f.kind, kk = KEY[k];
    const people = ['Άλκης', 'Χαρά'];
    const cats = categories(k);
    const descs = [...new Set(store.records('tx').sort((x, y) => (x.d < y.d ? 1 : -1)).map((r) => r.desc).filter(Boolean))].slice(0, 400);
    const trips = store.records('trip').map((t) => t.name);
    const target = f.id ? f.sp : targetSpace(f);
    if (k === 'Έξοδο' && !f.id && !f.tripTouched) { const on = T.tripOn(f.d || today()); f.trip = on ? on.name : ''; f.tripAuto = !!on; }
    const tripPicks = k === 'Έξοδο' ? [...new Set([...(f.trip ? [f.trip] : []), ...T.recentTrips(f.d || today())])] : [];
    const tgtName = target === 'shared' ? 'Κοινό — το βλέπει και η Χαρά' : 'Προσωπικό — μόνο εσύ';
    if (f.occ) {
      return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>${esc(f.desc)} <span class="small muted">↻ επαναλαμβανόμενο</span></h1></div>
      <div class="card"><div class="muted small">Αυτή η φορά: ${esc(f.d.split('-').reverse().join('/'))} · για ${esc(f.for === 'Κοινό' ? 'κοινό (½ ο καθένας)' : f.for || f.payer)}${f.oth && f.oth.length ? ' · μοιράζεται και με άλλους' : ''}</div>
        <label class="f"><span>Ποσό αυτή τη φορά</span><input class="amount" name="a" inputmode="decimal" value="${esc(f.a)}">${calcHtml()}</label>
        <label class="f"><span>Πλήρωσε</span>${seg('payer', people.map((p) => [p, p]), f.payer)}</label>
        <label class="row" style="margin:4px 0 10px"><input type="checkbox" name="fwd" style="width:auto" ${f.fwd ? 'checked' : ''}> <b>Από εδώ και πέρα</b>&nbsp;με αυτό το ποσό (π.χ. νέα τιμή)</label>
        <div class="note small">Χωρίς το τικ αλλάζει μόνο αυτή τη φορά. Οι προηγούμενες φορές μένουν πάντα όπως ήταν. <a href="#/rec/${esc(f.sp)}/${esc(f.rec)}">Όλες οι ρυθμίσεις του επαναλαμβανόμενου (και «Για ποιον») ›</a></div></div>
      <button class="btn primary" style="width:100%" data-save>Αποθήκευση</button>
      <button class="btn" style="width:100%;margin-top:8px" data-skip>${f.skipped ? 'Επαναφορά (έγινε κανονικά)' : 'Δεν έγινε αυτή τη φορά'}</button>`;
    }
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>${f.id ? 'Επεξεργασία' : 'Νέα κίνηση'}</h1></div>
    ${f.id ? '' : seg('kind', [['Έξοδο', 'Έξοδο'], ['Έσοδο', 'Έσοδο'], ['Μεταφορά', 'Μεταφορά']], k, kk)}
    <div class="card" style="margin-top:10px">
      <input class="amount" name="a" inputmode="decimal" placeholder="0,00 €" value="${esc(f.a)}" autocomplete="off">
      ${calcHtml()}
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
      <label class="f"><span>Περιγραφή</span><span class="ac"><input name="desc" value="${esc(f.desc)}" autocomplete="off" placeholder="${k === 'Μεταφορά' ? 'π.χ. revolut' : 'π.χ. Σκλαβενίτης'}"><span class="ac-list" data-ac hidden></span></span></label>
      ${k === 'Μεταφορά' ? `
        <label class="f"><span>Έδωσε</span>${seg('payer', [...people, 'Φίλιππος'].map((p) => [p, p]), f.payer)}</label>
        <label class="f"><span>Πήρε</span>${seg('for', [...people, 'Φίλιππος'].map((p) => [p, p]), f.for)}</label>
        <div class="note small">Φίλιππος = ο λογαριασμός του (κατάθεση ή ανάληψη).<br>Με άλλους (μαμά, αδερφή, φίλοι): <a href="#/debts">Οφειλές</a> → το άτομο → «Μου έδωσε» / «Της έδωσα».</div>`
      : `<label class="f"><span>${k === 'Έσοδο' ? 'Πήρε' : 'Πλήρωσε'}</span>${seg('payer', (k === 'Έξοδο' ? [...people, 'Και οι 2'] : people).map((p) => [p, p]), f.payer)}</label>
        ${k === 'Έξοδο' && f.payer === 'Και οι 2' ? `<div class="grid2"><label class="f"><span>Έδωσε ο Άλκης (€)</span><input name="both" inputmode="decimal" value="${esc(f.both)}"></label>
          <label class="f"><span>Έδωσε η Χαρά (€)</span><input name="bothX" inputmode="decimal" value="${esc(f.bothX ?? '')}"></label></div>` : ''}
        <label class="f"><span>Για ποιον</span>${k === 'Έσοδο'
          ? seg('for', [['', 'Μόνο γι’ αυτόν'], ['Κοινό', 'Κοινό ½'], ['Φίλιππος', 'Φίλιππος']], f.for)
          : seg('forx', [['Κοινό', 'Κοινό ½'], ['Άλκης', 'Άλκης'], ['Χαρά', 'Χαρά'], ['Φίλιππος', 'Φίλιππος'], ['__oth', '+ Άλλοι']], f.withOth ? '__oth' : f.for)}</label>
        ${k === 'Έξοδο' && f.withOth ? `<div class="note" style="margin:-2px 0 10px"><div class="small" style="font-weight:700;margin-bottom:6px">Μοιράζεται και με άλλους (αδερφή, φίλοι…)</div>
          ${othHtml(f.oth)}
          <label class="f" style="margin:0"><span>Το υπόλοιπο είναι για</span>${seg('for', [[me, 'Εμένα'], ['Κοινό', 'Κοινό ½ με ' + (me === 'Άλκης' ? 'Χαρά' : 'Άλκη')], [me === 'Άλκης' ? 'Χαρά' : 'Άλκης', me === 'Άλκης' ? 'Χαρά' : 'Άλκη']], f.for)}</label></div>` : ''}
        ${k === 'Έξοδο' ? `<div class="burden muted" data-burden>${burdenHtml(f)}</div>` : ''}`}
      ${k === 'Έξοδο' && f.trip && f.tripAuto && !f.tripTouched ? `<div class="note trip-on" style="margin-bottom:10px"><span class="grow">✈️ Μπαίνει στο ταξίδι <b>${esc(f.trip)}</b> (είσαι σε ταξίδι αυτές τις μέρες)</span><button type="button" class="btn sm" data-notrip>Όχι</button></div>` : ''}
      ${k === 'Έξοδο' && K.cars().length && (K.isFuelText(f.desc) || f.cat === 'Αυτοκίνητο' || f.car) ? (() => {
        const fuel = K.isFuelText(f.desc) && f.cat !== 'Αυτοκίνητο', service = !fuel && f.cat === 'Αυτοκίνητο';
        if (!f.carTouched && !f.id) f.car = K.carFromText(f.desc, f.cat) || null;
        return `<div class="note" style="margin-bottom:10px"><label class="f"><span>${fuel ? '⛽ Καύσιμα για' : '🔧 Ποιο αυτοκίνητο'}</span><div class="chips" data-car>${K.cars().filter((c) => !c.sold || c.id === f.car).map((c) => `<button type="button" class="chip ${c.id === f.car ? 'on' : ''}" data-id="${esc(c.id)}">🚗 ${esc(c.name)}</button>`).join('')}
          ${service ? '' : `<button type="button" class="chip ${f.car ? '' : 'on'}" data-id="">Κανένα</button>`}</div></label>
          ${fuel && f.car && K.isBi(f.car) ? `<label class="f"><span>Τι έβαλες</span>${seg('ft', [['Αέριο', 'Αέριο (CNG)'], ['Βενζίνη', 'Βενζίνη']], ftOf(f))}</label>` : ''}
          ${fuel && f.car ? `<div class="grid2"><label class="f"><span>Χιλιόμετρα κοντέρ (προαιρετικά)</span><input name="km" inputmode="numeric" value="${esc(f.km ?? '')}"></label>
            <label class="f"><span>${ftOf(f) === 'Αέριο' ? 'Κιλά' : 'Λίτρα'} (προαιρετικά)</span><input name="q" inputmode="decimal" value="${esc(f.q ?? '')}"></label></div>` : ''}
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
        if (occ) return `<div class="note" style="margin-bottom:10px">↻ Το «${esc(def.name)}» είναι επαναλαμβανόμενο και μπαίνει μόνο του (${esc(occ.d.split('-').reverse().join('/'))}, ${eur(occ.a)}). Για νέο ποσό <a href="#/edit/${esc(def._sp)}/${esc(occ.id)}">πάτα εδώ</a> και διάλεξε «Από εδώ και πέρα» — αλλιώς θα μετρηθεί δύο φορές.</div>`;
        return `<label class="row small" style="margin:0 2px 10px;flex-wrap:wrap"><input type="checkbox" name="rep" style="width:auto" ${f.rep ? 'checked' : ''}> ↻ Επαναλαμβάνεται
          ${FQ.freqHtml('repf', { fq: f.repf || 'm1', cn: f.repfn, cu: f.repfu }, 'width:auto;padding:6px 8px;font-size:14px;margin-left:6px')}</label>`;
      })() : ''}
      <details class="more" ${f.trip || f.share || (f.oth && f.oth.length) || f.moreOpen || (f.note && f.cat !== 'Αυτοκίνητο') ? 'open' : ''}><summary>Περισσότερα ▾</summary>
        ${k === 'Έξοδο' ? `<label class="f"><span>✈️ Ταξίδι (για να μετράει στα έξοδα του ταξιδιού)</span>
          ${tripPicks.length ? `<div class="chips" data-trips style="margin-bottom:6px">${tripPicks.map((t) => `<button type="button" class="chip ${t === f.trip ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}${f.trip ? '<button type="button" class="chip" data-t="">Κανένα</button>' : ''}</div>` : ''}
          <div class="row"><input name="trip" list="trips" value="${esc(f.trip)}" autocomplete="off" placeholder="διάλεξε ή γράψε όνομα" class="grow"><button type="button" class="btn sm" data-newtrip>+ Νέο</button></div></label>
          <datalist id="trips">${trips.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
          ${f.for === 'Κοινό' || parseAmount(f.share) != null ? `<label class="f"><span>Κοινό αλλά όχι μισό-μισό: πόσα είναι ${me === 'Άλκης' ? 'τα δικά σου' : 'του Άλκη'} (€)</span><input name="share" inputmode="decimal" value="${esc(f.share)}" placeholder="άδειο = μισό-μισό">
            <div class="small muted" style="margin:4px 2px 0">Π.χ. λογαριασμός 46,73 € όπου τα 10 € ${me === 'Άλκης' ? 'είναι δικά σου' : 'είναι του Άλκη'}: γράψε 10 — τα υπόλοιπα χρεώνονται στη${me === 'Άλκης' ? ' Χαρά' : ' Χαρά (σε σένα)'}.</div></label>` : ''}
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
      else if (name === 'forx') {
        if (v === '__oth') { f.withOth = 1; if (!f.oth || !f.oth.length) f.oth = [{ p: '', f: 0.5 }]; if (f.for === 'Φίλιππος') f.for = store.state.user; }
        else { f.withOth = 0; f.oth = null; f.for = v; }
        f.touched.for = 1;
      } else { f[name] = v; f.touched[name] = 1; }
      ui.render();
    }));
    const desc = root.querySelector('[name=desc]');
    bindAc(root, desc, f.kind);
    desc?.addEventListener('change', () => {
      read();
      if (f.kind === 'Έσοδο' && f.cat === 'Ιδιαίτερα' && !f.stu && LS.hasLessons()) {
        const n = norm(f.desc).trim(); const hit = LS.students().filter((s) => n && (norm(s.full) === n || norm(s.name) === n || (norm(s.full || '').startsWith(n) && n.length > 3)));
        const act = hit.filter((s) => LS.isActive(s)); const one = act.length === 1 ? act[0] : hit.length === 1 ? hit[0] : null;
        if (one) { f.stu = one.id; f.desc = one.full || one.name; if (!parseAmount(f.a)) { const b = LS.balance(one.id); f.a = String(b > 0.005 ? b : LS.priceAt(one).price || '').replace('.', ','); } ui.render(); return; }
      }
      const m = memory().get(norm(f.desc)) || store.records('rec').find((x) => norm(x.name).trim() === norm(f.desc).trim() && x.kind === f.kind);
      if (!m) { if (!f.id) f.bill = billType(f.desc) || ''; ui.render(); return; }
      if (!f.touched.cat && m.kind === f.kind && m.cat) f.cat = m.cat;
      if (!f.touched.for && m.kind === f.kind) f.for = m.for ?? f.for;
      if (!f.touched.for && m.kind === f.kind && f.kind === 'Έξοδο' && m.oth && m.oth.length) { f.oth = m.oth.map((o) => ({ ...o })); f.withOth = 1; }
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
    root.querySelector('[data-freq]')?.addEventListener('change', () => { read(); f.rep = true; ui.render(); });
    const upBurden = () => { const b = root.querySelector('[data-burden]'); if (!b) return; read(); b.innerHTML = burdenHtml(f); };
    bindCalc(root, aI, upBurden);
    root.addEventListener('input', (e) => { if (['a', 'share', 'both', 'bothX', 'otha'].includes(e.target.name)) upBurden(); });
    root.addEventListener('change', (e) => { if (e.target.name === 'othp') upBurden(); });
    root.querySelector('[name=d]')?.addEventListener('change', () => { read(); if (f.kind === 'Έξοδο' && !f.tripTouched) ui.render(); });
    root.querySelector('[data-notrip]')?.addEventListener('click', () => { read(); f.trip = ''; f.tripTouched = 1; f.tripAuto = false; ui.render(); });
    root.querySelector('[data-trips]')?.addEventListener('click', (e) => { const t = e.target.dataset.t; if (t === undefined) return; read(); f.trip = t === f.trip ? '' : t; f.tripTouched = 1; f.moreOpen = 1; ui.render(); });
    root.querySelector('[name=trip]')?.addEventListener('change', () => { read(); f.tripTouched = 1; f.moreOpen = 1; });
    root.querySelector('[data-newtrip]')?.addEventListener('click', () => { read(); tripSheet(ui, null, (name) => { f.trip = name; f.tripTouched = 1; f.moreOpen = 1; ui.render(); }); });

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
        ft: f.car && f.cat !== 'Αυτοκίνητο' && K.isFuelText(f.desc) ? ftOf(f) : null,
        oth: f.kind === 'Έξοδο' && f.withOth ? readOth(root) : null };
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
          const fr = FQ.toRec({ fq: f.repf || 'm1', cn: f.repfn, cu: f.repfu }) || { unit: 'm', every: 1 }; const [u, e] = [fr.unit, fr.every];
          const next = u === 'd' ? addDays(f.d, e) : addMonths(f.d, e);
          await store.put(tsp, null, { type: 'rec', name: rec.desc || rec.cat, a: rec.a, cat: rec.cat, kind: rec.kind, payer: rec.payer, for: rec.for, unit: u, every: e, start: next, oth: rec.oth || null, both: null });
          ui.toast('Καταχωρήθηκε ✓ και μπήκε στα επαναλαμβανόμενα');
        } else ui.toast('Καταχωρήθηκε ✓');
      }
      if (f.id) ui.toast('Καταχωρήθηκε ✓');
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
