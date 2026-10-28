// #/cars — cars: summary per car, reminders, per-year table, services, fill-ups
import { esc, eur, eur0, today, dFull, parseAmount } from '../util.js';
import * as store from '../store.js';
import * as K from '../cars.js';
import { sheet } from './lessons/ui.js';

const k0 = (x) => eur0(x).replace(' €', '');
const n1 = (x, d = 1) => (x == null ? '–' : x.toFixed(d).replace('.', ','));
const km = (x) => (x == null ? '–' : Math.round(x).toLocaleString('el-GR'));
const back = (h) => `<button class="btn sm ghost" data-back="${h}">‹</button>`;
const STATUS = { late: ['⚠', 'neg', 'πέρασε'], soon: ['⏰', 'neg', ''], ok: ['✓', 'pos', 'εντάξει'] };
function remRow(r, withCar) {
  const [ic, cls] = STATUS[r.status] || ['•', 'muted'];
  const when = !r.next ? 'χωρίς ημερομηνία' : r.days < 0 ? `πέρασε ${dFull(r.next)}` : r.days <= 30 ? `σε ${r.days} μέρες (${dFull(r.next)})` : dFull(r.next);
  return `<div class="item" data-rem="${esc(r.id)}"><div class="dot">${ic}</div><div class="grow"><div class="t">${esc(r.what)}${withCar ? ' · ' + esc(K.car(r.car)?.name || '') : ''}</div>
    <div class="s ${r.status === 'ok' ? '' : cls}">${when}${r.kmLeft != null ? ` · μένουν ${km(r.kmLeft)} km` : ''}</div></div><div class="muted">›</div></div>`;
}
const listView = {
  html() {
    const cs = K.cars(); const rems = K.reminders().filter((r) => !K.car(r.car)?.sold);
    const urgent = rems.filter((r) => r.status === 'late' || r.status === 'soon');
    return `<div class="top">${back('#/stats')}<h1>Αυτοκίνητα</h1><button class="btn sm" data-addcar>+ Αυτοκίνητο</button></div>
    ${urgent.length ? `<div class="list" style="margin-bottom:12px">${urgent.map((r) => remRow(r, true)).join('')}</div>` : ''}
    ${cs.map((c) => { const s = K.summary(c.id); return `<div class="card" data-go="#/cars/${esc(c.id)}" style="cursor:pointer;${c.sold ? 'opacity:.6' : ''}">
      <div class="row"><div class="grow"><div class="mid">🚗 ${esc(c.name)}</div><div class="small muted">${esc(c.model || '')} ${c.plate ? '· ' + esc(c.plate) : ''} · συνήθως ${esc(c.fuel || '')}${c.sold ? ' · πουλήθηκε' : ''}</div></div><div class="muted">›</div></div>
      <div class="grid3" style="margin-top:10px">
        <div><div class="small muted">Χιλιόμετρα</div><b>${km(s.last)}</b></div>
        <div><div class="small muted">km / μήνα</div><b>${km(s.kmMonth)}</b></div>
        <div><div class="small muted">€ / km</div><b>${s.perKm ? n1(s.perKm, 2) + ' €' : '–'}</b></div>
        <div><div class="small muted">Βενζίνη l/100</div><b>${n1(s.petrol)}</b></div>
        <div><div class="small muted">Αέριο kg/100</div><b>${n1(s.gas)}</b></div>
        <div><div class="small muted">Καύσιμα €/100km</div><b>${s.eur100 ? n1(s.eur100) + ' €' : '–'}</b></div>
      </div>
      <div class="small muted" style="margin-top:8px">Φέτος: καύσιμα ${eur0(s.year.fuel)} · συνεργεία κ.λπ. ${eur0(s.year.service)} · σύνολο <b>${eur0(s.year.total)}</b> · (κατανάλωση, km/μήνα, €/km: τελευταίοι 12 μήνες)</div></div>`; }).join('')}
    <h2>Υπενθυμίσεις</h2>
    <div class="list">${rems.map((r) => remRow(r, true)).join('') || '<div class="item muted">Καμία</div>'}<div class="item" data-addrem><div class="dot">+</div><div class="grow t" style="color:var(--teal)">Νέα υπενθύμιση</div></div></div>
    <div class="note small" style="margin-top:12px">Καύσιμα και συνεργεία τα γράφεις στα Έξοδα (Μεταφορικά / Αυτοκίνητο): το αυτοκίνητο διαλέγεται μόνο του από την περιγραφή (π.χ. «CNG» → αυτό με αέριο, «βενζίνη punto» → Punto). Αν βάλεις και χιλιόμετρα / λίτρα, βγαίνει η κατανάλωση.</div>`;
  },
  mount(root, p, ui) {
    root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.back)));
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
    root.querySelectorAll('[data-rem]').forEach((b) => b.addEventListener('click', () => remSheet(ui, store.records('crem', ['shared']).find((r) => r.id === b.dataset.rem))));
    root.querySelector('[data-addrem]')?.addEventListener('click', () => remSheet(ui, null));
    root.querySelector('[data-addcar]')?.addEventListener('click', () => carSheet(ui, null));
  },
};
const detail = {
  html([id]) {
    const c = K.car(id); if (!c) return `<div class="top">${back('#/cars')}<h1>Δεν βρέθηκε</h1></div>`;
    const t = today(); const Y = Number(t.slice(0, 4));
    const hasP = K.fills(id).some((f) => f.ft === 'Βενζίνη'), hasG = K.fills(id).some((f) => f.ft === 'Αέριο');
    const f0 = K.fills(id)[0]?.d || t; const yrs = []; for (let y = Y; y >= Number(f0.slice(0, 4)); y--) yrs.push(y);
    const rows = yrs.map((y) => {
      const a = `${y}-01-01`, b = y === Y ? t : `${y}-12-31`; const k = K.kmIn(id, a, b); const m = K.money(id, a, b);
      const pl = K.fills(id).filter((f) => f.ft === 'Βενζίνη' && f.d >= a && f.d <= b).reduce((s, f) => s + (f.q || 0), 0);
      const gl = K.fills(id).filter((f) => f.ft === 'Αέριο' && f.d >= a && f.d <= b).reduce((s, f) => s + (f.q || 0), 0);
      if (!k && !m.total) return '';
      return `<tr><td><b>${y}</b></td><td class="r">${km(k)}</td><td class="r">${k0(m.fuel)}</td>${hasP ? `<td class="r">${pl ? n1(K.consumption(id, 'Βενζίνη', a, b)) : ''}</td>` : ''}${hasG ? `<td class="r">${gl ? n1(K.consumption(id, 'Αέριο', a, b)) : ''}</td>` : ''}<td class="r">${k0(m.service)}</td><td class="r"><b>${k0(m.total)}</b></td><td class="r">${k ? n1(m.total / k, 2) : ''}</td></tr>`;
    }).join('');
    const ev = K.events(id).slice().reverse(); const fl = K.fills(id).slice().reverse().slice(0, 25);
    return `<div class="top">${back('#/cars')}<h1>🚗 ${esc(c.name)}</h1><button class="btn sm" data-editcar>Επεξεργασία</button></div>
    <div class="grid2" style="margin-bottom:12px"><button class="btn" data-odo>+ Χιλιόμετρα (κοντέρ)</button><a class="btn" href="#/add/exp?cat=Αυτοκίνητο">+ Συνεργείο / έξοδο</a></div>
    <div class="card" style="overflow-x:auto"><table class="t st"><tr><th>Έτος</th><th class="r">km</th><th class="r">Καύσιμα</th>${hasP ? '<th class="r">l/100</th>' : ''}${hasG ? '<th class="r">kg/100</th>' : ''}<th class="r">Συνεργ.</th><th class="r">Σύνολο</th><th class="r">€/km</th></tr>${rows}</table>
      <div class="small muted" style="margin-top:6px">ποσά σε €</div></div>
    <h2>Υπενθυμίσεις</h2><div class="list">${K.reminders(id).map((r) => remRow(r, false)).join('') || '<div class="item muted">Καμία</div>'}</div>
    <h2>Συνεργεία, ΚΤΕΟ κ.λπ.</h2>
    <div class="list">${ev.slice(0, 40).map((e) => `<div class="item" ${e.tx ? `data-edit="${esc(e._sp)}/${esc(e.id)}"` : `data-ev="${esc(e.id)}"`}><div class="dot">🔧</div><div class="grow"><div class="t">${esc(e.title || e.typ || '')}</div>
      <div class="s">${dFull(e.d)}${e.km ? ' · ' + km(e.km) + ' km' : ''}${e.typ ? ' · ' + esc(e.typ) : ''}${e.tx && e.note ? ' · ' + esc(e.note) : ''}</div></div><div class="amt">${e.a ? eur(e.a) : ''}</div></div>`).join('') || '<div class="item muted">—</div>'}</div>
    <h2>Γεμίσματα</h2>
    <div class="list">${fl.map((f) => `<div class="item" ${f.tx ? `data-edit="${esc(f._sp)}/${esc(f.id)}"` : ''}><div class="dot">⛽</div><div class="grow"><div class="t">${esc(f.ft)}${f.q ? ' · ' + n1(f.q, 2) + (f.ft === 'Αέριο' ? ' kg' : ' l') : ''}</div>
      <div class="s">${dFull(f.d)}${f.km ? ' · ' + km(f.km) + ' km' : ''}${f.note ? ' · ' + esc(f.note) : ''}</div></div><div class="amt">${eur(f.a)}</div></div>`).join('') || '<div class="item muted">—</div>'}</div>`;
  },
  mount(root, [id], ui) {
    root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.back)));
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => ui.go(`#/edit/${b.dataset.edit}`)));
    root.querySelectorAll('[data-rem]').forEach((b) => b.addEventListener('click', () => remSheet(ui, store.records('crem', ['shared']).find((r) => r.id === b.dataset.rem))));
    root.querySelector('[data-editcar]')?.addEventListener('click', () => carSheet(ui, K.car(id)));
    root.querySelector('[data-odo]')?.addEventListener('click', () => sheet(`<div class="mid">Χιλιόμετρα ${esc(K.car(id).name)}</div>
      <div class="grid2" style="margin-top:10px"><label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${today()}"></label><label class="f"><span>Κοντέρ (km)</span><input name="km" inputmode="numeric" placeholder="${km(K.lastKm(id))}"></label></div>
      <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
      el.querySelector('[data-no]').onclick = close;
      el.querySelector('[data-ok]').onclick = async () => { const k = parseAmount(el.querySelector('[name=km]').value.replace(/\./g, '')); if (!k) return; await store.put('shared', null, { type: 'odo', car: id, d: el.querySelector('[name=d]').value, km: k }); close(); ui.toast('Αποθηκεύτηκε ✓'); };
    }));
  },
};
function remSheet(ui, r) {
  const list = K.cars().filter((c) => !c.sold);
  sheet(`<div class="mid">${r ? esc(r.what) : 'Νέα υπενθύμιση'}</div>
    ${r ? `<button class="btn green" data-done>✓ Έγινε σήμερα</button>` : ''}
    <label class="f" style="margin-top:10px"><span>Αυτοκίνητο</span><select name="car">${list.map((c) => `<option value="${esc(c.id)}" ${r?.car === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label class="f"><span>Τι</span><input name="what" value="${esc(r?.what || '')}" placeholder="π.χ. ΚΤΕΟ, Ασφάλεια, Σέρβις"></label>
    <div class="grid2"><label class="f"><span>Τελευταία φορά</span><input type="date" name="last" value="${esc(r?.last || '')}"></label><label class="f"><span>km τότε</span><input name="lastKm" inputmode="numeric" value="${esc(r?.lastKm ?? '')}"></label></div>
    <div class="grid3"><label class="f"><span>Κάθε (μήνες)</span><input name="months" inputmode="numeric" value="${esc(r?.months ?? '')}"></label><label class="f"><span>Κάθε (km)</span><input name="km" inputmode="numeric" value="${esc(r?.km ?? '')}"></label>
    <label class="f"><span>Ή μέχρι</span><input type="date" name="until" value="${esc(r?.until || '')}"></label></div>
    <button class="btn primary" data-ok>Αποθήκευση</button>${r ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const g = (n) => el.querySelector(`[name=${n}]`).value.trim();
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-done]')?.addEventListener('click', async () => { await store.put('shared', r.id, { last: today(), lastKm: K.lastKm(r.car), until: null }); close(); ui.toast('Σημειώθηκε ✓'); });
    el.querySelector('[data-del]')?.addEventListener('click', async () => { await store.del('shared', r.id); close(); });
    el.querySelector('[data-ok]').onclick = async () => {
      if (!g('what')) { ui.toast('Γράψε τι'); return; }
      const num = (x) => (x ? parseAmount(x.replace(/\./g, '')) : null);
      await store.put('shared', r?.id || null, { type: 'crem', car: g('car'), what: g('what'), last: g('last') || null, lastKm: num(g('lastKm')), months: num(g('months')), km: num(g('km')), until: g('until') || null });
      close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}
function carSheet(ui, c) {
  let fuel = c?.fuel || 'Βενζίνη';
  sheet(`<div class="mid">${c ? esc(c.name) : 'Νέο αυτοκίνητο'}</div>
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Όνομα</span><input name="name" value="${esc(c?.name || '')}"></label><label class="f"><span>Πινακίδα</span><input name="plate" value="${esc(c?.plate || '')}"></label></div>
    <label class="f"><span>Μοντέλο</span><input name="model" value="${esc(c?.model || '')}"></label>
    <label class="f"><span>Καύσιμο που βάζεις συνήθως</span><div class="seg" data-seg="fuel">${['Βενζίνη', 'Αέριο', 'Diesel'].map((v) => `<button type="button" data-val="${v}" class="${v === fuel ? 'on' : ''}">${v}</button>`).join('')}</div></label>
    ${c ? `<label class="row small"><input type="checkbox" name="sold" style="width:auto" ${c.sold ? 'checked' : ''}> Πουλήθηκε (το ιστορικό μένει)</label>` : ''}
    <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-seg]').addEventListener('click', (e) => { if (!e.target.dataset.val) return; fuel = e.target.dataset.val; el.querySelectorAll('[data-seg] button').forEach((b) => b.classList.toggle('on', b === e.target)); });
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => {
      const g = (n) => el.querySelector(`[name=${n}]`).value.trim(); if (!g('name')) return;
      await store.put('shared', c?.id || null, { type: 'car', name: g('name'), plate: g('plate') || null, model: g('model') || null, fuel, sold: el.querySelector('[name=sold]')?.checked || null });
      close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}
export default {
  live: true,
  html(p, ui) { return (p[0] ? detail : listView).html(p, ui); },
  mount(root, p, ui) { (p[0] ? detail : listView).mount(root, p, ui); },
};
