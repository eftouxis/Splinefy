// #/health — 🩺 Υγεία παιδιών (ένα ή περισσότερα): ημερολόγιο (πυρετός, φάρμακα, συμπτώματα) και βιβλιάριο με αναζήτηση σε όλα (επισκέψεις, εξετάσεις, εμβόλια, ανάπτυξη, έγγραφα)
import { esc, today, dFull } from '../util.js';
import * as store from '../store.js';
import * as H from '../health.js';
import { sheet } from './lessons/ui.js';
import { rxSheet } from './meds.js';
import { parseRx } from '../meds.js';

const TABS = [['sum', 'Σύνοψη'], ['log', 'Ημερολόγιο'], ['hist', 'Ιστορικό'], ['labs', 'Εξετάσεις'], ['vac', 'Εμβόλια'], ['growth', 'Ανάπτυξη'], ['docs', 'Έγγραφα']];
let q = '', kindF = '', logF = 'health';
const C = () => ({ child: H.cur() === H.FIRST ? null : H.cur() });   // new records: which child (the first child's records carry no child field, as before)
let TOK = [];
const dec = (x) => (x == null ? '' : String(x).replace('.', ','));

// ---------- highlight (accent-insensitive) ----------
function hl(text) {
  text = String(text ?? ''); if (!TOK.length || !text) return esc(text);
  let out = '', map = [];
  for (let i = 0; i < text.length; i++) for (const c of H.norm(text[i])) { out += c; map.push(i); }
  const mk = new Array(text.length).fill(false);
  for (const t of TOK) { let i = out.indexOf(t); while (i >= 0) { for (let k = i; k < i + t.length; k++) mk[map[k]] = true; i = out.indexOf(t, i + t.length); } }
  let r = '', open = false;
  for (let i = 0; i < text.length; i++) { if (mk[i] !== open) { r += mk[i] ? '<mark>' : '</mark>'; open = mk[i]; } r += esc(text[i]); }
  return r + (open ? '</mark>' : '');
}

// ---------- chart ----------
export function chart(pts, ref = {}) {
  if (pts.length < 2) return '';
  const W = 640, Ht = 200, pl = 40, pr = 12, pt = 12, pb = 26;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 1; x1 += 1; }
  let y0 = Math.min(...ys, ref.lo ?? Infinity), y1 = Math.max(...ys, ref.hi ?? -Infinity);
  const pad = (y1 - y0) * 0.12 || 1; const pos = Math.min(...ys) >= 0; y0 -= pad; y1 += pad; if (pos && y0 < 0) y0 = 0;
  const X = (x) => pl + ((x - x0) / (x1 - x0)) * (W - pl - pr), Y = (y) => pt + (1 - (y - y0) / (y1 - y0)) * (Ht - pt - pb);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${Ht}">`;
  if (ref.lo != null || ref.hi != null) { const a = Y(ref.hi ?? y1), b = Y(ref.lo ?? y0); s += `<rect class="h-band" x="${pl}" y="${Math.min(a, b)}" width="${W - pl - pr}" height="${Math.abs(b - a)}"/>`; }
  for (let k = 0; k <= 4; k++) { const v = y0 + ((y1 - y0) * k) / 4; s += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${pl - 5}" y="${Y(v) + 4}" text-anchor="end">${+v.toFixed(v < 10 || y1 - y0 < 5 ? 1 : 0)}</text>`; }
  const st = x1 - x0 > 30 ? 6 : x1 - x0 > 8 ? 3 : 1;
  for (let m = Math.ceil(x0 / st) * st; m <= x1; m += st) s += `<text class="ax" x="${X(m)}" y="${Ht - 7}" text-anchor="middle">${m >= 12 ? (m % 12 ? `${Math.floor(m / 12)}ε${m % 12}μ` : `${m / 12}ε`) : `${m}μ`}</text>`;
  s += `<polyline class="h-ln" points="${pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')}"/>`;
  pts.forEach((p) => { s += `<circle class="h-pt ${p.f || ''}" cx="${X(p.x)}" cy="${Y(p.y)}" r="4"><title>${esc(p.t)}</title></circle>`; });
  return s + '</svg>';
}

// ---------- pieces ----------
const pill = (k) => `<span class="h-pill h-${{ Νόσος: 'red', Εμβολιασμός: 'teal', Νοσηλεία: 'amber' }[k] || 'grey'}">${hl(k)}</span>`;
const docLinks = (ids) => (ids || []).map((id) => H.docs().find((d) => d.id === id)).filter(Boolean).map((d) => `<button class="h-lnk" data-doc="${esc(d.id)}">📄 ${esc(d.title)}</button>`).join(' ');
function visitRow(v) {
  const meas = [v.w != null && `Βάρος ${dec(v.w)} kg`, v.h != null && `Ύψος ${dec(v.h)} cm`, v.hc != null && `Π.Κ. ${dec(v.hc)} cm`].filter(Boolean).join(' · ');
  const lab = H.labs().find((l) => l.d === v.d);
  return `<div class="h-item" data-visit="${esc(v.id)}">
    <div class="row wrap" style="gap:6px"><b>${hl(dFull(v.d))}</b>${pill(v.kind || '')}<span class="small muted">${esc(H.ageAt(v.d))}</span></div>
    <div style="font-weight:600;margin-top:3px">${hl(v.title)}</div>
    ${v.text ? `<div class="small" style="margin-top:3px;line-height:1.45">${hl(v.text)}</div>` : ''}
    ${v.meds?.length ? `<div class="row wrap" style="gap:5px;margin-top:5px">${v.meds.map((m) => `<span class="h-med">💊 ${hl(m)}</span>`).join('')}</div>` : ''}
    ${meas ? `<div class="small muted" style="margin-top:4px">${hl(meas)}</div>` : ''}
    ${lab || v.docs?.length ? `<div class="small" style="margin-top:5px">${lab ? `<button class="h-lnk" data-lab="${esc(lab.d)}">🧪 Αποτελέσματα εξετάσεων</button> ` : ''}${docLinks(v.docs)}</div>` : ''}
  </div>`;
}
function trend(key, withChart = true) {
  const rs = H.results().filter((r) => r.key === key).sort((a, b) => (a.lab.d < b.lab.d ? -1 : 1));
  const sc = (r) => { const n = H.num(r.value); return r.unit.startsWith('/') && n > 1000 ? n / 1000 : n; };
  const pts = rs.filter((r) => !isNaN(H.num(r.value))).map((r) => ({ x: H.monthsAt(r.lab.d), y: sc(r), f: r.flag, t: `${dFull(r.lab.d)}: ${r.value} ${r.unit}` }));
  const last = [...rs].reverse().find((r) => r.ref);
  return `${withChart ? chart(pts, last ? H.parseRef(last.ref) : {}) : ''}
  <div style="overflow-x:auto"><table class="t" style="font-size:13.5px"><tr><th>Ημ/νία</th><th>Ηλικία</th><th>Τιμή</th><th>Όρια</th></tr>
  ${rs.map((r) => `<tr class="click" data-lab="${esc(r.lab.d)}"><td>${dFull(r.lab.d)}</td><td class="muted">${H.ageAt(r.lab.d)}</td><td class="h-${r.flag}">${esc(r.value)} <span class="small muted">${esc(r.unit)}</span></td><td class="small muted">${esc(r.ref)}</td></tr>`).join('')}</table></div>
  ${withChart && pts.length > 1 ? '<div class="small muted" style="margin-top:6px">Πράσινη ζώνη: τα όρια της πιο πρόσφατης εξέτασης (αλλάζουν με την ηλικία).</div>' : ''}`;
}
function vacTable(list) {
  const t = today();
  const cell = (d) => {
    if (!d) return '<td></td>';
    if (d.d) return `<td class="h-dose ok"><b>✓</b> ${hl(dFull(d.d))}<br><span class="muted">${hl(d.b || '')}</span></td>`;
    const st = d.to < t ? 'late' : d.from <= t ? 'due' : 'fut';
    return `<td class="h-dose ${st}">${{ late: 'Εκκρεμεί', due: 'Τώρα', fut: 'Αργότερα' }[st]}<br>${dFull(d.from)} – ${dFull(d.to)}<br><span class="muted">${hl(d.b || '')}</span></td>`;
  };
  const n = Math.max(3, ...list.map((v) => (v.doses || []).length));
  return `<div style="overflow-x:auto"><table class="t h-vt"><tr><th>Εμβόλιο</th>${Array.from({ length: n }, (_, i) => `<th>${i + 1}η</th>`).join('')}</tr>
  ${list.map((v) => `<tr class="click" data-vac="${esc(v.id)}"><td><b>${hl(v.disease)}</b>${v.note ? `<div class="small muted" style="margin-top:3px">${hl(v.note)}</div>` : ''}</td>${Array.from({ length: n }, (_, i) => cell((v.doses || [])[i])).join('')}</tr>`).join('')}</table></div>`;
}
const docRow = (d) => `<div class="item" data-doc="${esc(d.id)}"><div class="dot">${(d.mime || '').startsWith('image') ? '🖼️' : '📄'}</div><div class="grow"><div class="t" style="white-space:normal">${hl(d.title)}</div><div class="s">${hl(dFull(d.d))}</div></div><button class="btn sm ghost" data-docedit="${esc(d.id)}" style="width:auto">✎</button></div>`;

// ---------- diary ----------
const QUICK = [['temp', 'Πυρετός'], ['med', 'Φάρμακο'], ['sym', 'Σύμπτωμα'], ['note', 'Σημείωση']];
function logLine(x) {
  const v = x.k === 'temp' ? (x.val != null ? `${dec(x.val)}°C` : '') : x.k === 'growth' ? [x.w != null && `${dec(x.w)} kg`, x.h != null && `${dec(x.h)} cm`, x.hc != null && `Π.Κ. ${dec(x.hc)}`].filter(Boolean).join(' · ') : x.val ? `${dec(x.val)} ${x.unit || ''}`.trim() : '';
  return [x.title, v].filter(Boolean).join(' · ') || H.LOGK[x.k]?.[1] || '';
}
const logRow = (x) => `<div class="h-item" data-log="${esc(x.id)}"><div class="row" style="gap:8px;align-items:flex-start"><span class="small muted" style="min-width:38px">${esc(x.t.slice(11, 16))}</span><span>${H.LOGK[x.k]?.[0] || '•'}</span>
  <div class="grow"><div style="font-weight:600">${hl(logLine(x))}</div>${x.text ? `<div class="small" style="margin-top:2px;white-space:pre-line">${hl(x.text)}</div>` : ''}${x.dr ? `<div class="small" style="margin-top:4px;white-space:pre-line;border-left:3px solid var(--teal);padding-left:7px">👩‍⚕️ ${hl(x.dr)}</div>` : ''}</div></div></div>`;
const nowT = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
function logSheet(k, x = null) {
  k = x?.k || k || 'note'; const K = H.LOGK[k];
  const prev = [...new Set(H.logs().filter((l) => l.k === k && l.title).map((l) => l.title))].slice(0, 30);
  const amt = ['med', 'food', 'bottle', 'pump'].includes(k);
  sheet(`<div class="mid">${K[0]} ${x ? K[1] : `Νέο: ${K[1]}`}${H.profiles().length > 1 ? ` · ${esc(H.firstName(H.profile()))}` : ''}</div>
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${esc((x?.t || nowT()).slice(0, 10))}"></label><label class="f"><span>Ώρα</span><input type="time" name="tm" value="${esc((x?.t || nowT()).slice(11, 16))}"></label></div>
    ${k === 'temp' ? `<label class="f"><span>Θερμοκρασία °C</span><input name="val" inputmode="decimal" value="${esc(dec(x?.val))}" placeholder="38,5"></label>` : ''}
    ${k === 'growth' ? `<div class="grid3"><label class="f"><span>Βάρος kg</span><input name="w" inputmode="decimal" value="${dec(x?.w)}"></label><label class="f"><span>Ύψος cm</span><input name="h" inputmode="decimal" value="${dec(x?.h)}"></label><label class="f"><span>Π.Κ. cm</span><input name="hc" inputmode="decimal" value="${dec(x?.hc)}"></label></div>` : ''}
    ${k !== 'temp' && k !== 'growth' ? `<label class="f"><span>${{ med: 'Φάρμακο', sym: 'Σύμπτωμα', visit: 'Γιατρός / ειδικότητα', vacc: 'Εμβόλιο', exam: 'Εξετάσεις', teeth: 'Δόντι' }[k] || 'Τίτλος'}</span><input name="title" list="hlt" value="${esc(x?.title || '')}"><datalist id="hlt">${prev.map((t) => `<option value="${esc(t)}">`).join('')}</datalist></label>` : ''}
    ${amt ? `<div class="grid2"><label class="f"><span>Ποσότητα</span><input name="val" inputmode="decimal" value="${esc(dec(x?.val))}"></label><label class="f"><span>Μονάδα</span><input name="unit" list="hlu" value="${esc(x?.unit || (k === 'med' ? 'ml' : ''))}"><datalist id="hlu">${H.UNITS.map((u) => `<option value="${u}">`).join('')}</datalist></label></div>` : ''}
    <label class="f"><span>Σημειώσεις</span><textarea name="text" rows="${k === 'note' || k === 'visit' ? 5 : 3}" placeholder="${k === 'sym' ? 'π.χ. βήχας τη νύχτα, τι είπε η παιδίατρος' : ''}">${esc(x?.text || '')}</textarea></label>
    ${k === 'med' ? '<div class="small muted" style="margin:-4px 2px 10px">Για υπενθυμίσεις δόσεων: Εφαρμογές → 💊 Φάρμακα.</div>' : ''}
    ${k === 'sym' ? `<label class="f"><span>👩‍⚕️ Τι είπε η παιδίατρος (επικόλληση από το μήνυμα)</span><textarea name="dr" rows="4" placeholder="π.χ. Fucicort 2 φορές την ημέρα για 3 ημέρες. Αν πονάει, παυσίπονο.">${esc(x?.dr || '')}</textarea></label>
      <div data-rxp class="small" style="margin:-4px 2px 8px"></div>
      ${x?.guide ? '' : `<label class="row" style="gap:8px;margin:0 2px 12px"><input type="checkbox" name="mkg" checked style="width:auto"> <span class="small">Κράτα το ως οδηγία παιδιάτρου για την επόμενη φορά</span></label>`}
      <div data-gm></div>` : ''}
    ${x && k === 'temp' ? '<button class="btn" data-adv>💡 Τι λένε οι οδηγίες γι\' αυτή τη θερμοκρασία</button>' : ''}
    ${x && ['sym', 'visit', 'note'].includes(k) && x.text ? '<button class="btn" data-mkguide>📋 Κάνε το οδηγία παιδιάτρου</button>' : ''}
    <button class="btn primary" data-ok>Αποθήκευση</button>${x ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const g = (n) => el.querySelector(`[name=${n}]`)?.value.trim() ?? ''; const nv = (n) => { const v = H.num(g(n)); return isNaN(v) ? null : v; };
    const ti = el.querySelector('[name=title]');
    ti?.addEventListener('change', () => { if (!amt) return; const last = H.logs().find((l) => l.k === k && l.title === ti.value.trim() && l.val); if (last && !g('val')) { el.querySelector('[name=val]').value = dec(last.val); el.querySelector('[name=unit]').value = last.unit || ''; } });
    el.querySelector('[data-no]').onclick = close;
    const gm = el.querySelector('[data-gm]');
    const showG = () => { if (!gm) return; const gs = H.guidesFor(`${g('title')} ${g('text')}`); gm.innerHTML = gs.map(guideCard).join(''); };
    if (gm) { el.querySelector('[name=title]').addEventListener('input', showG); el.querySelector('[name=text]').addEventListener('input', showG); showG(); }
    const rxp = el.querySelector('[data-rxp]');
    const showRx = () => { if (!rxp) return; const l = parseRx(g('dr')); rxp.innerHTML = l.length ? `💊 Θα φτιαχτεί αγωγή στα Φάρμακα: ${l.map((p) => `<b>${esc(p.name)}</b> ${p.perDay}×/ημέρα${p.durN ? ` για ${p.durN} ${p.durU === 'm' ? 'μήνες' : p.durU === 'w' ? 'εβδομάδες' : 'ημέρες'}` : ''}`).join(', ')} — με ειδοποίηση, αφού πατήσεις Αποθήκευση.` : (g('dr') ? '<span class="muted">Δεν βρέθηκε φάρμακο με πρόγραμμα (χρειάζεται π.χ. «2 φορές την ημέρα για 3 ημέρες»).</span>' : ''); };
    el.querySelector('[name=dr]')?.addEventListener('input', showRx); showRx();
    el.querySelector('[data-adv]')?.addEventListener('click', () => adviceSheet(x));
    el.querySelector('[data-mkguide]')?.addEventListener('click', () => { close(); guideSheet(null, { title: x.title || '', text: x.text, src: `${dFull(x.t.slice(0, 10))}` }); });
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await ui.confirm('Διαγραφή της καταχώρισης;', 'Διαγραφή')) { await store.del(H.SP, x.id); close(); } });
    el.querySelector('[data-ok]').onclick = async () => {
      const rec = { type: 'hlog', k, t: `${g('d') || today()}T${g('tm') || '12:00'}`, title: g('title') || null, text: g('text') || null, val: k === 'temp' || amt ? nv('val') : null, unit: amt ? g('unit') || null : null };
      if (k === 'sym') rec.dr = g('dr') || null;
      if (k === 'growth') Object.assign(rec, { w: nv('w'), h: nv('h'), hc: nv('hc') });
      if (k === 'temp' && rec.val == null) { ui.toast('Γράψε θερμοκρασία'); return; }
      if (!rec.title && !rec.text && rec.val == null && k !== 'growth') { ui.toast('Γράψε κάτι'); return; }
      const id = await store.put(H.SP, x?.id || null, { ...(x ? {} : C()), ...rec }); close();
      if (!x && k === 'temp') { adviceSheet({ ...rec, id }); return; }
      if (k === 'sym' && rec.dr) {
        const child = x ? H.childOf(x) : H.cur();
        if (el.querySelector('[name=mkg]')?.checked) {   // 3. keep it as an instruction for next time
          const keys = [...new Set(H.norm(rec.title || '').split(/[^a-zα-ω]+/).filter((w) => w.length >= 4).map((w) => w.slice(0, Math.max(4, w.length - 2))))].join(', ');
          const gid = await store.put(H.SP, null, { type: 'hguide', title: rec.title || 'Οδηγία', keys: keys || null, text: rec.dr, src: `${H.firstName(H.profile(child))}, ${dFull(rec.t.slice(0, 10))}` });
          await store.put(H.SP, id, { guide: gid });
        }
        if (!x || x.dr !== rec.dr) {                      // 2. the medicines → Φάρμακα, with the reminder (preview, times and notification in the next screen)
          if (parseRx(rec.dr).length) { rxSheet(ui, { who: H.firstName(H.profile(child)) || null, text: rec.dr }); return; }
        }
        ui.toast('Αποθηκεύτηκε ✓'); return;
      }
      if (!x && k === 'sym' && H.guidesFor(`${rec.title || ''} ${rec.text || ''}`).length) { info('📋 Οδηγίες παιδιάτρου', H.guidesFor(`${rec.title || ''} ${rec.text || ''}`).map(guideCard).join('')); return; }
      ui.toast('Αποθηκεύτηκε ✓');
    };
    setTimeout(() => el.querySelector(k === 'temp' ? '[name=val]' : '[name=title]')?.focus(), 50);
  });
}

// ---------- pediatrician's instructions ----------
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const whenTxt = (d) => { const t = new Date(); t.setHours(0, 0, 0, 0); const dd = new Date(d); dd.setHours(0, 0, 0, 0); const diff = Math.round((dd - t) / 864e5); return `${diff === 0 ? '' : diff === 1 ? 'αύριο ' : diff === -1 ? 'χθες ' : dFull(d.toISOString().slice(0, 10)) + ' '}${hhmm(d)}`; };
const guideCard = (g) => `<div class="card" style="background:var(--chip);box-shadow:none;margin:8px 0;padding:10px 12px"><div class="row"><b class="grow">📋 ${esc(g.title)}</b>${g.src ? `<span class="small muted">${esc(g.src)}</span>` : ''}</div><div class="small" style="white-space:pre-line;margin-top:4px">${esc(g.text || '')}</div></div>`;
/** after a temperature: what the instructions say (give X ml of Y — with ✓ «Το έδωσα» — or wait) */
function adviceSheet(rec) {
  const at = new Date(rec.t); const a = H.feverAdvice(H.childOf(rec), rec.val, at); const P = H.feverRules();
  const name = H.profiles().length > 1 ? ` · ${esc(H.firstName(H.profile(H.childOf(rec))))}` : '';
  let body = `<div class="mid">🌡️ ${dec(rec.val)}°C${name}</div><div class="small muted">${dFull(rec.t.slice(0, 10))} ${rec.t.slice(11, 16)}</div>`;
  if (a.state === 'none') {
    body += `<div class="card" style="margin-top:10px">Δεν έχεις γράψει ακόμα τις οδηγίες της παιδιάτρου για τον πυρετό (από πόσο, ποιο φάρμακο, πόσο ανά κιλό, κάθε πόσες ώρες).<button class="btn primary" data-fe style="margin-top:10px">📋 Γράψε τις οδηγίες πυρετού</button></div>`;
  } else if (a.state === 'ok') {
    body += `<div class="card" style="margin-top:10px">✅ ${esc(a.reason)}</div>`;
  } else if (a.state === 'give') {
    const w = a.weight; const old = w && (new Date() - new Date(w.d)) / 864e5 > 90;
    body += `<div class="card" style="margin-top:10px;border:2px solid var(--teal)"><div class="small muted">Σύμφωνα με τις οδηγίες:</div>
      <div style="font-size:22px;font-weight:800;margin:4px 0">💊 ${esc(a.drug.name)} ${a.dose ? `${dec(a.dose.ml)} ml` : ''}</div>
      ${a.dose ? `<div class="small muted">${esc(a.dose.how)}${w ? ` · βάρος από ${dFull(w.d)}` : ''}</div>` : `<div class="small" style="color:var(--red)">${w ? 'Λείπει κάτι από τη δόση στις οδηγίες.' : 'Δεν υπάρχει βάρος — γράψε μια 📏 Μέτρηση.'}</div>`}
      ${old ? `<div class="small" style="color:#a86a10;margin-top:4px">⚠️ Το βάρος είναι παλιό (${dFull(w.d)}) — αν έχει αλλάξει, γράψε νέα 📏 Μέτρηση.</div>` : ''}
      <div class="small" style="margin-top:6px">${esc(a.reason)}</div>
      ${a.next.length ? `<div class="small muted" style="margin-top:4px">${a.next.map((n) => `${esc(n.name)}: τελευταία ${whenTxt(new Date(n.last.t))}`).join(' · ')}</div>` : ''}</div>
      ${a.dose ? `<button class="btn primary" data-gave>✓ Το έδωσα (${esc(a.drug.name)} ${dec(a.dose.ml)} ml)</button>` : ''}`;
  } else {
    body += `<div class="card" style="margin-top:10px;border:2px solid var(--red)"><b>⏳ ${esc(a.reason)}</b>
      <div class="small" style="margin-top:6px">${a.next.filter((n) => n.at).map((n) => `${esc(n.name)}: από ${whenTxt(n.at)}`).join('<br>')}</div></div>`;
  }
  if (P?.notes && a.state !== 'none') body += `<div class="small" style="white-space:pre-line;margin:4px 2px 10px">📋 ${esc(P.notes)}</div>`;
  if (a.state !== 'none') body += `<div class="small muted" style="margin:0 2px 10px">Υπολογισμός από τις οδηγίες που έχεις γράψει και το τελευταίο βάρος — αν κάτι δεν σου φαίνεται σωστό, ρώτα την παιδίατρο.</div>`;
  body += `<button class="btn ghost" data-x>Κλείσιμο</button>`;
  sheet(body, (el, close) => {
    el.querySelector('[data-x]').onclick = close;
    el.querySelector('[data-fe]')?.addEventListener('click', () => { close(); feverSheet(); });
    el.querySelector('[data-gave]')?.addEventListener('click', async () => {
      const r = rec.child ? { child: rec.child } : {};
      await store.put(H.SP, null, { ...r, type: 'hlog', k: 'med', t: nowT(), title: a.drug.name, val: a.dose.ml, unit: 'ml', text: `Για πυρετό ${dec(rec.val)}°C (οδηγίες)` });
      close(); ui.toast(`✓ ${a.drug.name} ${dec(a.dose.ml)} ml`);
    });
  });
}
function feverSheet() {
  const P = H.feverRules() || {}; const D = [...(P.drugs || []), {}, {}].slice(0, 2);
  const drugHtml = (d, i) => `<div class="card" style="padding:10px;margin:8px 0;background:var(--chip);box-shadow:none" data-drug="${i}">
    <b>${i === 0 ? '1ο φάρμακο (πρώτα)' : '2ο φάρμακο (αν δεν επιτρέπεται ακόμα το 1ο)'}</b>
    <div class="grid2" style="margin-top:6px"><label class="f"><span>Όνομα</span><input data-f="name" value="${esc(d.name || '')}" placeholder="${i ? 'π.χ. Algofren' : 'π.χ. Depon'}"></label><label class="f"><span>Άλλα ονόματα (,)</span><input data-f="alias" value="${esc(d.alias || '')}" placeholder="${i ? 'αλγκοφρεν, ibuprofen' : 'ντεπον, παρακεταμόλη'}"></label></div>
    <label class="f"><span>Δόση</span><select data-f="mode">${[['kgdiv', 'ml = κιλά ÷ αριθμό (π.χ. ½ των κιλών → 2)'], ['mgkg', 'mg ανά κιλό (+ συγκέντρωση σιροπιού)'], ['mlkg', 'ml ανά κιλό'], ['fixed', 'σταθερά ml']].map(([v, l]) => `<option value="${v}" ${(d.mode || 'kgdiv') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="grid3" data-m="mgkg mlkg"><label class="f" data-m="mgkg mlkg"><span data-pl>${d.mode === 'mlkg' ? 'ml/kg' : 'mg/kg'}</span><input data-f="perKg" inputmode="decimal" value="${esc(d.perKg || '')}"></label><label class="f" data-m="mgkg"><span>mg στο σιρόπι</span><input data-f="concMg" inputmode="decimal" value="${esc(d.concMg || '')}" placeholder="π.χ. 120"></label><label class="f" data-m="mgkg"><span>ανά ml</span><input data-f="concMl" inputmode="decimal" value="${esc(d.concMl || '')}" placeholder="π.χ. 5"></label></div>
    <div data-m="kgdiv"><label class="f"><span>Κιλά διά</span><input data-f="div" inputmode="decimal" value="${esc(d.div || '')}" placeholder="${i ? 'π.χ. 3' : 'π.χ. 2'}"></label></div>
    <div data-m="fixed"><label class="f"><span>ml</span><input data-f="fixed" inputmode="decimal" value="${esc(d.fixed || '')}"></label></div>
    <div class="grid2"><label class="f"><span>Ίδιο φάρμακο κάθε (ώρες)</span><input data-f="everyH" inputmode="decimal" value="${esc(d.everyH || '')}"></label><label class="f"><span>Μέγιστο ml ανά δόση (αν υπάρχει)</span><input data-f="maxMl" inputmode="decimal" value="${esc(d.maxMl || '')}"></label></div></div>`;
  sheet(`<div class="mid">📋 Οδηγίες πυρετού</div><div class="small muted" style="margin:4px 2px 8px">Γράψε τα όπως τα είπε η παιδίατρος (ή όπως γράφει η συσκευασία για το βάρος του). Ισχύουν για όλα τα παιδιά — η δόση βγαίνει από το βάρος του καθενός.</div>
    <div class="grid2"><label class="f"><span>Αντιπυρετικό από (°C)</span><input name="threshold" inputmode="decimal" value="${esc(P.threshold || '')}" placeholder="π.χ. 38"></label><label class="f"><span>Διαφορά ανάμεσα στα 2 φάρμακα (ώρες)</span><input name="crossH" inputmode="decimal" value="${esc(P.crossH || '')}" placeholder="π.χ. 4"></label></div>
    ${D.map(drugHtml).join('')}
    <label class="f"><span>Άλλες οδηγίες (π.χ. πότε να την πάρετε τηλέφωνο)</span><textarea name="notes" rows="3">${esc(P.notes || '')}</textarea></label>
    <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const sync = () => el.querySelectorAll('[data-drug]').forEach((c) => { const m = c.querySelector('[data-f=mode]').value; c.querySelectorAll('[data-m]').forEach((x) => { x.style.display = x.dataset.m.split(' ').includes(m) ? '' : 'none'; }); c.querySelector('[data-pl]').textContent = m === 'mlkg' ? 'ml/kg' : 'mg/kg'; });
    el.querySelectorAll('[data-f=mode]').forEach((x) => x.addEventListener('change', sync)); sync();
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => {
      const drugs = [...el.querySelectorAll('[data-drug]')].map((c) => Object.fromEntries([...c.querySelectorAll('[data-f]')].map((i) => [i.dataset.f, i.value.trim() || null]))).filter((d) => d.name);
      const v = (n) => el.querySelector(`[name=${n}]`).value.trim() || null;
      if (!v('threshold') || !drugs.length) { ui.toast('Γράψε το όριο πυρετού και τουλάχιστον ένα φάρμακο'); return; }
      await store.put(H.SP, 'hfever', { type: 'hfever', threshold: v('threshold'), crossH: v('crossH'), withinH: null, notes: v('notes'), drugs }); close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}
function guideSheet(g = null, pre = {}) {
  const v = g || pre;
  sheet(`<div class="mid">📋 ${g ? 'Οδηγία παιδιάτρου' : 'Νέα οδηγία παιδιάτρου'}</div>
    <label class="f" style="margin-top:10px"><span>Για τι (π.χ. Λαρυγγίτιδα)</span><input name="title" value="${esc(v.title || '')}"></label>
    <label class="f"><span>Λέξεις που τη φέρνουν (,) — π.χ. βήχας, λαρυγγ, κρουπ</span><input name="keys" value="${esc(v.keys || '')}"></label>
    <label class="f"><span>Τι είπε η παιδίατρος</span><textarea name="text" rows="7">${esc(v.text || '')}</textarea></label>
    <label class="f"><span>Από πότε / ποιος</span><input name="src" value="${esc(v.src || '')}"></label>
    <button class="btn primary" data-ok>Αποθήκευση</button>${g ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const val = (n) => el.querySelector(`[name=${n}]`).value.trim() || null;
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await ui.confirm(`Διαγραφή «${esc(g.title)}»;`, 'Διαγραφή')) { await store.del(H.SP, g.id); close(); } });
    el.querySelector('[data-ok]').onclick = async () => {
      if (!val('title') || !val('text')) { ui.toast('Γράψε τίτλο και οδηγία'); return; }
      await store.put(H.SP, g?.id || null, { type: 'hguide', title: val('title'), keys: val('keys'), text: val('text'), src: val('src') }); close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}
function guidesSheet() {
  const P = H.feverRules(); const w = H.latestWeight();
  const doses = (P?.drugs || []).map((d) => { const x = H.doseFor(d, w?.w); return `${esc(d.name)}: ${x ? `<b>${dec(x.ml)} ml</b>` : '—'}${d.everyH ? ` · κάθε ${esc(d.everyH)}ω` : ''}`; }).join('<br>');
  sheet(`<div class="row"><div class="mid grow">📋 Οδηγίες παιδιάτρου</div><button class="btn sm ghost" data-x style="width:auto;margin:0">✕</button></div>
    <div class="card" style="margin-top:10px"><div class="row"><b class="grow">🌡️ Πυρετός</b><button class="btn sm" data-fe style="width:auto;margin:0">${P ? '✎' : '+ Γράψε'}</button></div>
    ${P ? `<div class="small" style="margin-top:6px">Αντιπυρετικό από ${esc(P.threshold)}°C${P.crossH ? ` · ${esc(P.drugs?.[0]?.name || '')} ↔ ${esc(P.drugs?.[1]?.name || '')}: διαφορά ${esc(P.crossH)}ω` : ''}</div>
      <div class="small" style="margin-top:6px">${esc(H.firstName(H.profile()))}${w ? ` (${dec(w.w)} kg, ${dFull(w.d)})` : ' (χωρίς βάρος)'}:<br>${doses}</div>` : '<div class="small muted" style="margin-top:6px">Δεν έχουν γραφτεί ακόμα.</div>'}</div>
    <div class="row" style="margin:12px 2px 4px"><b class="grow">Συμπτώματα</b><button class="btn sm" data-ng style="width:auto;margin:0">+ Οδηγία</button></div>
    <div class="list">${H.guides().map((g) => `<div class="item" data-g="${esc(g.id)}"><div class="grow"><div class="t">${esc(g.title)}</div><div class="s">${esc((g.text || '').slice(0, 80))}</div></div></div>`).join('') || '<div class="item muted small">Καμία ακόμα. Γράψε μία εδώ, ή άνοιξε μια παλιά καταχώριση στο Ημερολόγιο → «Κάνε το οδηγία».</div>'}</div>`, (el, close) => {
    el.querySelector('[data-x]').onclick = close;
    el.querySelector('[data-fe]').onclick = () => { close(); feverSheet(); };
    el.querySelector('[data-ng]').onclick = () => { close(); guideSheet(); };
    el.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { close(); guideSheet(H.guides().find((x) => x.id === b.dataset.g)); }));
  });
}

// ---------- tabs ----------
const TAB = {
  sum() {
    const p = H.profile(), pend = H.vacPending(), late = pend.filter((x) => x.st !== 'fut'), next = pend.find((x) => x.st === 'fut');
    const g = H.growth(), gw = [...g].reverse().find((x) => x.w != null), gh = [...g].reverse().find((x) => x.h != null);
    const lab = H.labs().find((l) => (l.rows || []).some((r) => H.ANALYTES[r[0]]?.[1] !== 'Αλλεργία'));
    const ill = H.visits().filter((v) => v.kind === 'Νόσος').slice(0, 8);
    const fev = H.lastFever(), recent = H.logs().filter((x) => H.LOGK[x.k]?.[2]).slice(0, 4);
    const diary = `<div class="card"><div class="row"><b class="grow">Ημερολόγιο</b><button class="h-lnk" data-gotab="log">όλο ›</button></div>
      <div class="row wrap" style="gap:6px;margin-top:8px">${QUICK.map(([k, l]) => `<button class="chip" data-newlog="${k}">${H.LOGK[k][0]} ${l}</button>`).join('')}<button class="chip" data-guides>📋 Οδηγίες παιδιάτρου</button></div>
      ${fev ? `<div class="small" style="margin-top:10px"><b>Τελευταίος πυρετός:</b> ${dFull(fev.day)} · έως ${dec(fev.max)}°C${fev.meds.length ? ` · ${esc(fev.meds.join(', '))}` : ''}</div>` : ''}
      ${recent.length ? `<div style="margin-top:6px">${recent.map((x) => `<div class="small muted" style="margin-top:3px">${dFull(x.t.slice(0, 10))} ${x.t.slice(11, 16)} · ${H.LOGK[x.k][0]} ${esc(logLine(x))}</div>`).join('')}</div>` : ''}</div>`;
    return `${diary}<div class="card"><div class="row"><b class="grow">Στοιχεία</b><button class="btn sm ghost" data-prof style="width:auto">✎</button></div>
      <table class="t" style="font-size:13.5px;margin-top:4px">
        <tr><td class="muted">Γέννηση</td><td>${p.birth ? `${dFull(p.birth)} (${H.ageAt(today())})` : '–'}${p.name ? ` · ${esc(p.name)}` : ''}</td></tr>
        ${p.blood ? `<tr><td class="muted">Ομάδα αίματος</td><td>${esc(p.blood)}</td></tr>` : ''}
        ${p.pediatrician ? `<tr><td class="muted">Παιδίατρος</td><td>${esc(p.pediatrician)}</td></tr>` : ''}
        ${p.allergies ? `<tr><td class="muted">Αλλεργίες</td><td>${esc(p.allergies)}</td></tr>` : ''}
        ${gw ? `<tr><td class="muted">Βάρος</td><td>${dec(gw.w)} kg <span class="small muted">(${dFull(gw.d)})</span></td></tr>` : ''}
        ${gh ? `<tr><td class="muted">Ύψος</td><td>${dec(gh.h)} cm <span class="small muted">(${dFull(gh.d)})</span></td></tr>` : ''}
        ${p.birthInfo ? `<tr><td class="muted">Τοκετός</td><td class="small">${esc(p.birthInfo)}</td></tr>` : ''}
      </table>
      <div class="row wrap" style="gap:8px;margin-top:10px"><button class="btn sm" data-newchild style="width:auto;margin:0">👶 + Παιδί</button>
      <label class="btn sm" style="width:auto;margin:0">📥 Εισαγωγή (.json)<input type="file" accept=".json,application/json" data-imp hidden></label></div></div>
    ${late.length || next ? `<div class="card"><b>Εμβόλια</b>${late.map((x) => `<div class="row" style="margin-top:8px;align-items:flex-start"><span class="h-dot ${x.st}"></span><div class="grow"><b>${esc(x.v.disease)} — ${esc(x.d.b || '')}</b><div class="small muted">${x.st === 'late' ? 'Έληξε το διάστημα' : 'Τώρα'} ${dFull(x.d.from)} – ${dFull(x.d.to)}${x.st === 'late' ? ' — δεν έχει καταγραφεί δόση' : ''}</div></div></div>`).join('')}
      ${next ? `<div class="row" style="margin-top:8px;align-items:flex-start"><span class="h-dot fut"></span><div class="grow"><b>Επόμενο: ${esc(next.v.disease)}</b><div class="small muted">${esc(next.d.b || '')} · ${dFull(next.d.from)} – ${dFull(next.d.to)}</div></div></div>` : ''}</div>` : ''}
    ${lab ? `<div class="card"><div class="row"><b class="grow">Τελευταίες εξετάσεις — ${dFull(lab.d)}</b><button class="h-lnk" data-lab="${esc(lab.d)}">όλες ›</button></div>
      ${(lab.rows || []).filter((r) => H.flag(r)).map((r) => `<div class="row wrap" style="margin-top:7px;gap:6px"><button class="h-lnk" data-trend="${esc(r[0])}">${esc(H.aName(r[0]))}</button><span class="h-pill h-${H.flag(r) === 'hi' ? 'red' : 'blue'}">${esc(r[1])} ${esc(r[2] || '')} ${H.flag(r) === 'hi' ? '↑' : '↓'}</span><span class="small muted">όρια ${esc(r[3] === '!' ? '' : r[3] || '')}</span></div>`).join('') || '<div class="small muted" style="margin-top:6px">Όλα εντός ορίων.</div>'}</div>` : ''}
    ${ill.length ? `<div class="card"><b>Πρόσφατα επεισόδια</b>${ill.map((v) => `<div class="small" style="margin-top:7px"><b>${dFull(v.d)}</b> · ${esc(v.title)}${v.meds?.length ? `<div class="muted">${esc(v.meds.join(', '))}</div>` : ''}</div>`).join('')}</div>` : ''}
    ${(() => { const qc = H.quick(14); return qc.length ? `<div class="card"><b>Γρήγορη αναζήτηση</b><div class="chips" style="margin-top:8px">${qc.map((c) => `<button class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>` : ''; })()}`;
  },
  log() {
    const L = H.logs().filter((x) => logF === 'all' || (logF === 'health' ? H.LOGK[x.k]?.[2] : !H.LOGK[x.k]?.[2]));
    const days = new Map(); for (const x of L) { const d = x.t.slice(0, 10); if (!days.has(d)) days.set(d, []); days.get(d).push(x); }
    const n = H.logs().filter((x) => !H.LOGK[x.k]?.[2]).length;
    let h = `<div class="row wrap" style="gap:6px;margin-bottom:8px">${QUICK.map(([k, l]) => `<button class="btn sm" data-newlog="${k}" style="width:auto;margin:0">${H.LOGK[k][0]} ${l}</button>`).join('')}
      <button class="btn sm" data-guides style="width:auto;margin:0">📋 Οδηγίες</button>
      <select data-newlogx style="width:auto;padding:6px 8px;font-size:13px"><option value="">+ Άλλο…</option>${Object.entries(H.LOGK).filter(([k]) => !QUICK.some(([q]) => q === k)).map(([k, [i, l]]) => `<option value="${k}">${i} ${l}</option>`).join('')}</select></div>
      ${n ? `<div class="chips" style="margin-bottom:10px">${[['health', 'Υγεία'], ['care', 'Φροντίδα μωρού'], ['all', 'Όλα']].map(([k, l]) => `<button class="chip ${logF === k ? 'on' : ''}" data-logf="${k}">${l}</button>`).join('')}</div>` : ''}`;
    if (!days.size) return h + '<div class="card muted center">Τίποτα ακόμα — π.χ. «🌡️ Θερμοκρασία» ή «💊 Φάρμακο» όταν αρρωστήσει.</div>';
    let shown = 0;
    for (const [d, xs] of days) {
      if (shown++ > 120) { h += '<div class="small muted center">… για παλαιότερα, γράψε στην αναζήτηση (π.χ. τη χρονιά)</div>'; break; }
      const temps = xs.filter((x) => x.k === 'temp').map((x) => H.num(x.val)).filter((v) => !isNaN(v)); const mx = temps.length ? Math.max(...temps) : null;
      h += `<div class="row" style="margin:12px 2px 4px;gap:6px"><b class="grow">${dFull(d)} <span class="small muted" style="font-weight:400">${esc(H.ageAt(d))}</span></b>${mx != null ? `<span class="h-pill ${mx >= 38 ? 'h-red' : 'h-grey'}">🌡️ ${dec(mx)}°</span>` : ''}</div>
        <div class="list">${xs.map(logRow).join('')}</div>`;
    }
    return h;
  },
  hist() {
    const kinds = [...new Set(H.visits().map((v) => v.kind).filter(Boolean))];
    const l = H.visits().filter((v) => !kindF || v.kind === kindF);
    return `<div class="chips" style="margin-bottom:10px"><button class="chip ${kindF ? '' : 'on'}" data-kind="">Όλα</button>${kinds.map((k) => `<button class="chip ${kindF === k ? 'on' : ''}" data-kind="${esc(k)}">${esc(k)}</button>`).join('')}</div>
      <div class="list">${l.map(visitRow).join('') || '<div class="item muted">Τίποτα ακόμα</div>'}</div>`;
  },
  labs() {
    const res = H.results(); const dates = [...new Set(H.labs().map((l) => l.d))].sort().reverse();
    let h = `<div class="small muted" style="margin:0 2px 8px">Πάτα μια εξέταση για την πορεία της ή μια ημερομηνία για όλο το φύλλο. ↑ ↓ = εκτός ορίων.</div>
      <div class="card" style="padding:0;overflow:auto;max-height:72vh"><table class="t h-mx"><tr><th>Εξέταση</th>${dates.map((d) => `<th><button class="h-lnk" data-lab="${d}">${dFull(d)}</button><br><span class="muted" style="font-weight:400">${H.ageAt(d)}</span></th>`).join('')}</tr>`;
    const keys = [...new Set(res.map((r) => r.key))];
    const groups = [...H.GROUPS, ...new Set(keys.filter((k) => !H.ANALYTES[k]).map(H.aGroup))];
    for (const g of groups) {
      const ks = keys.filter((k) => H.aGroup(k) === g).sort((a, b) => Object.keys(H.ANALYTES).indexOf(a) - Object.keys(H.ANALYTES).indexOf(b)); if (!ks.length) continue;
      h += `<tr class="h-grp"><td colspan="${dates.length + 1}">${esc(g)}</td></tr>`;
      for (const k of ks) h += `<tr class="click" data-trend="${esc(k)}"><td>${esc(H.aName(k))}</td>${dates.map((d) => { const r = res.find((x) => x.key === k && x.lab.d === d); return r ? `<td class="r h-${r.flag}" title="${esc(r.unit)} · ${esc(r.ref)}">${esc(r.value)}</td>` : '<td></td>'; }).join('')}</tr>`;
    }
    return h + '</table></div>';
  },
  vac() {
    const pend = H.vacPending().filter((x) => x.st !== 'fut');
    return `${pend.length ? `<div class="card">${pend.map((x) => `<div class="row" style="margin:4px 0;align-items:flex-start"><span class="h-dot ${x.st}"></span><div class="grow"><b>${esc(x.v.disease)} — ${esc(x.d.b || '')}</b><div class="small muted">${x.st === 'late' ? 'Έληξε το διάστημα' : 'Τώρα'}: ${dFull(x.d.from)} – ${dFull(x.d.to)}</div></div></div>`).join('')}</div>` : ''}
      <div class="card" style="padding:6px">${vacTable(H.vaccines())}</div><div class="small muted" style="margin:0 2px">Πάτα ένα εμβόλιο για να γράψεις δόση ή να αλλάξεις κάτι.</div>`;
  },
  growth() {
    const g = H.growth(); const mk = (f) => g.filter((x) => x[f] != null).map((x) => ({ x: H.monthsAt(x.d), y: Number(x[f]), t: `${dFull(x.d)}: ${dec(x[f])}` }));
    return `<div class="card"><b>Βάρος (kg)</b>${chart(mk('w'))}</div><div class="card"><b>Ύψος (cm)</b>${chart(mk('h'))}</div><div class="card"><b>Περίμετρος κεφαλής (cm)</b>${chart(mk('hc'))}</div>
      <div class="card"><table class="t" style="font-size:13.5px"><tr><th>Ημ/νία</th><th>Ηλικία</th><th class="r">kg</th><th class="r">cm</th><th class="r">Π.Κ.</th></tr>
      ${[...g].reverse().map((x) => `<tr><td>${dFull(x.d)}</td><td class="muted">${H.ageAt(x.d)}</td><td class="r">${dec(x.w)}</td><td class="r">${dec(x.h)}</td><td class="r">${dec(x.hc)}</td></tr>`).join('')}</table>
      <div class="small muted" style="margin-top:6px">Οι μετρήσεις έρχονται από τις επισκέψεις και από το Ημερολόγιο (📏 Μέτρηση).</div></div>`;
  },
  docs() {
    return `<div class="list">${H.docs().map(docRow).join('') || '<div class="item muted">Κανένα έγγραφο</div>'}</div>
      <div class="small muted" style="margin:8px 2px">Τα αρχεία είναι στο OneDrive, στον φάκελο «${esc(store.spaceById(H.SP)?.folder || '')}/${H.DOC_DIR}».</div>`;
  },
};

// ---------- search ----------
function search() {
  TOK = H.norm(q).split(/\s+/).filter(Boolean);
  const m = (s) => { const n = H.norm(s); return TOK.every((t) => n.includes(t)); };
  const res = H.results(); let h = '';
  const keys = [...new Set(res.map((r) => r.key))].filter((k) => m(`${H.aName(k)} ${H.aGroup(k)} ${H.ANALYTES[k]?.[2] || ''} ${k}`));
  if (keys.length) h += `<h2>Εξετάσεις (${keys.length})</h2>` + keys.map((k) => `<div class="card"><b>${hl(H.aName(k))}</b> <span class="small muted">· ${esc(H.aGroup(k))}</span>${trend(k, keys.length <= 4)}</div>`).join('');
  const ls = keys.length ? [] : H.labs().filter((l) => m(`${dFull(l.d)} ${l.d.slice(5, 7)}/${l.d.slice(0, 4)} ${l.place} ${l.note || ''} εξετασεις αιματος`));
  if (ls.length) h += `<h2>Φύλλα εξετάσεων (${ls.length})</h2><div class="list">${ls.map((l) => `<div class="item" data-lab="${esc(l.d)}"><div class="grow"><div class="t">${hl(dFull(l.d))} · ${hl(l.place)}</div><div class="s">${hl(l.note || '')}</div></div></div>`).join('')}</div>`;
  const vs = H.vaccines().filter((v) => m(`${v.disease} ${v.tags || ''} ${v.note || ''} ${(v.doses || []).map((d) => `${d.b || ''} ${d.d ? dFull(d.d) : ''}`).join(' ')} εμβολια εμβολιο`));
  if (vs.length) h += `<h2>Εμβόλια (${vs.length})</h2><div class="card" style="padding:6px">${vacTable(vs)}</div>`;
  if (TOK.some((t) => t.length >= 3 && ['βαρο', 'υψο', 'μηκο', 'κεφαλ', 'αναπτυξ', 'κιλα', 'περιμετρ'].some((w) => t.startsWith(w) || w.startsWith(t)))) h += '<h2>Ανάπτυξη</h2>' + TAB.growth();
  const vis = H.visits().filter((v) => m(`${dFull(v.d)} ${v.d.slice(5, 7)}/${v.d.slice(0, 4)} ${v.kind} ${v.title} ${v.text || ''} ${(v.meds || []).join(' ')}`));
  if (vis.length) h += `<h2>Ιστορικό (${vis.length})</h2><div class="list">${vis.map(visitRow).join('')}</div>`;
  const lg = H.logs().filter((x) => m(`${dFull(x.t.slice(0, 10))} ${x.t.slice(5, 7)}/${x.t.slice(0, 4)} ${H.LOGK[x.k]?.[1] || ''} ${x.title || ''} ${x.text || ''} ${x.dr || ''} ${x.val != null ? dec(x.val) : ''} ${x.unit || ''}`));
  if (lg.length) h += `<h2>Ημερολόγιο (${lg.length})</h2><div class="list">${lg.slice(0, 200).map((x) => logRow(x).replace('<span class="small muted" style="min-width:38px">', `<span class="small muted" style="min-width:38px">${dFull(x.t.slice(0, 10))}<br>`)).join('')}</div>`;
  const ds = H.docs().filter((d) => m(`${d.title} ${dFull(d.d)} ${d.file || ''} εγγραφο`));
  if (ds.length) h += `<h2>Έγγραφα (${ds.length})</h2><div class="list">${ds.map(docRow).join('')}</div>`;
  return h || `<div class="card muted center">Δεν βρέθηκε κάτι για «${esc(q)}».</div>`;
}

// ---------- sheets ----------
function info(title, body) { sheet(`<div class="row"><div class="mid grow">${title}</div><button class="btn sm ghost" data-x style="width:auto;margin:0">✕</button></div><div style="margin-top:8px" data-ib>${body}</div>`, (el, close) => { el.querySelector('[data-x]').onclick = close; bindBody(el, close); }); }
function showTrend(k) { TOK = []; info(esc(H.aName(k)), trend(k)); }
function showLab(d) {
  TOK = [];
  info(`Εξετάσεις ${dFull(d)} <span class="small muted">${H.ageAt(d)}</span>`, H.labs().filter((l) => l.d === d).map((l) => `<div class="row wrap"><div class="small muted grow">${esc(l.place)}${l.note ? ' · ' + esc(l.note) : ''}</div><button class="btn sm" data-labedit="${esc(l.id)}" style="width:auto;margin:0">✎</button></div>
    ${l.docs?.length ? `<div class="small" style="margin-top:4px">${docLinks(l.docs)}</div>` : ''}
    <table class="t" style="font-size:13.5px;margin:6px 0 16px"><tr><th>Εξέταση</th><th>Τιμή</th><th>Όρια</th></tr>
    ${(l.rows || []).map((r) => `<tr class="click" data-trend="${esc(r[0])}"><td>${esc(H.aName(r[0]))}</td><td class="h-${H.flag(r)}">${esc(r[1])} <span class="small muted">${esc(r[2] || '')}</span></td><td class="small muted">${esc(r[3] === '!' ? '' : r[3] || '')}</td></tr>`).join('')}</table>`).join(''));
}
let ui;
async function openDoc(id) {
  const d = H.docs().find((x) => x.id === id); if (!d) return;
  const close = sheet(`<div class="mid">${esc(d.title)}</div><div class="small muted">${dFull(d.d)}</div><div data-dv style="margin-top:10px" class="muted">Φόρτωση από το OneDrive…</div><button class="btn ghost" data-x>Κλείσιμο</button>`, (el, cl) => { el.querySelector('[data-x]').onclick = cl; });
  const el = [...document.querySelectorAll('.sheet [data-dv]')].pop();
  try {
    const b = await H.fileOf(d);
    if (!b) { el.innerHTML = `Το αρχείο «${esc(d.file)}» δεν είναι ακόμα στον φάκελο.<br><button class="btn primary" data-up>📎 Ανέβασέ το τώρα</button>`; el.querySelector('[data-up]').onclick = () => { close(); docSheet(d); }; return; }
    const url = URL.createObjectURL(b);
    el.innerHTML = `${b.type.startsWith('image') ? `<img src="${url}" style="width:100%;border-radius:10px">` : ''}<a class="btn primary" href="${url}" target="_blank" rel="noopener" style="width:100%;margin-top:8px">Άνοιγμα</a><a class="btn" href="${url}" download="${esc(d.file)}" style="width:100%;margin-top:8px">Λήψη</a>`;
  } catch (e) { el.textContent = 'Δεν άνοιξε: ' + e.message; }
}
/** attached documents widget: shows chips with ✕, + upload */
function attachHtml(ids) { return `<div class="f" style="margin-bottom:10px"><span class="small muted" style="font-weight:600">Έγγραφα</span><div data-att class="row wrap" style="gap:6px;margin-top:4px"></div>
  <label class="btn sm" style="width:auto;margin-top:6px">📎 Επισύναψη αρχείου<input type="file" accept="application/pdf,image/*" data-file hidden></label>
  <select data-pick style="margin-top:6px"><option value="">…ή διάλεξε υπάρχον έγγραφο</option>${H.docs().map((d) => `<option value="${esc(d.id)}">${dFull(d.d)} · ${esc(d.title)}</option>`).join('')}</select></div>`; }
function attachMount(el, ids, getDate, getTitle) {
  const draw = () => { el.querySelector('[data-att]').innerHTML = ids.map((id) => { const d = H.docs().find((x) => x.id === id); return d ? `<span class="h-med">📄 ${esc(d.title)} <button type="button" data-rm="${esc(id)}" style="border:0;background:none;color:var(--red);cursor:pointer">✕</button></span>` : ''; }).join('') || '<span class="small muted">—</span>'; el.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { ids.splice(ids.indexOf(b.dataset.rm), 1); draw(); })); };
  el.querySelector('[data-pick]').onchange = (e) => { if (e.target.value && !ids.includes(e.target.value)) ids.push(e.target.value); e.target.value = ''; draw(); };
  el.querySelector('[data-file]').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; const d = getDate() || today(); const title = getTitle() || f.name.replace(/\.\w+$/, '');
    ui.toast('Ανέβασμα στο OneDrive…', 6000);
    try { const name = await H.upload(f, d, title); const id = await store.put(H.SP, null, { type: 'hdoc', d, title, file: name, mime: f.type || null, ...C() }); ids.push(id); draw(); ui.toast('Ανέβηκε ✓'); } catch (er) { ui.toast('Δεν ανέβηκε: ' + er.message, 4000); }
  };
  draw();
}
function visitSheet(v = null) {
  const docs = [...(v?.docs || [])];
  sheet(`<div class="mid">${v ? 'Επίσκεψη' : 'Νέα επίσκεψη / συμβάν'}</div>
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${esc(v?.d || today())}"></label>
    <label class="f"><span>Είδος</span><select name="kind">${H.KINDS.map((k) => `<option ${k === (v?.kind || 'Νόσος') ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
    <label class="f"><span>Τίτλος / διάγνωση</span><input name="title" value="${esc(v?.title || '')}" placeholder="π.χ. Ίωση, MMR (2η δόση)"></label>
    <label class="f"><span>Σημειώσεις (ευρήματα, οδηγίες)</span><textarea name="text" rows="4">${esc(v?.text || '')}</textarea></label>
    <label class="f"><span>Φάρμακα (ένα σε κάθε γραμμή)</span><textarea name="meds" rows="3" placeholder="π.χ. Depon σιρόπι 5 ml 3×/ημ × 5 ημ">${esc((v?.meds || []).join('\n'))}</textarea></label>
    <div class="grid3"><label class="f"><span>Βάρος kg</span><input name="w" inputmode="decimal" value="${dec(v?.w)}"></label><label class="f"><span>Ύψος cm</span><input name="h" inputmode="decimal" value="${dec(v?.h)}"></label><label class="f"><span>Π.Κ. cm</span><input name="hc" inputmode="decimal" value="${dec(v?.hc)}"></label></div>
    ${attachHtml()}
    <button class="btn primary" data-ok>Αποθήκευση</button>${v ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const g = (n) => el.querySelector(`[name=${n}]`).value.trim(); const nv = (n) => { const x = H.num(g(n)); return isNaN(x) ? null : x; };
    attachMount(el, docs, () => g('d'), () => g('title'));
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await ui.confirm(`Διαγραφή «${esc(v.title)}»;`, 'Διαγραφή')) { await store.del(H.SP, v.id); close(); } });
    el.querySelector('[data-ok]').onclick = async () => {
      if (!g('title')) { ui.toast('Γράψε τίτλο'); return; }
      await store.put(H.SP, v?.id || null, { ...(v ? {} : C()), type: 'hvisit', d: g('d') || today(), kind: g('kind'), title: g('title'), text: g('text') || null, meds: g('meds') ? g('meds').split('\n').map((s) => s.trim()).filter(Boolean) : null, w: nv('w'), h: nv('h'), hc: nv('hc'), docs });
      close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}
function labSheet(l = null) {
  const docs = [...(l?.docs || [])]; const rows = (l?.rows || [['', '', '', '']]).map((r) => [...r]);
  const names = [...new Set([...Object.keys(H.ANALYTES), ...H.results().map((r) => r.key)])].map(H.aName);
  const lastOf = (k) => H.results().filter((r) => r.key === k).sort((a, b) => (a.lab.d < b.lab.d ? 1 : -1))[0];
  sheet(`<div class="mid">${l ? 'Εξετάσεις' : 'Νέες εξετάσεις'}</div>
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${esc(l?.d || today())}"></label>
    <label class="f"><span>Εργαστήριο</span><input name="place" list="hplaces" value="${esc(l?.place || '')}"><datalist id="hplaces">${[...new Set(H.labs().map((x) => x.place))].map((p) => `<option value="${esc(p)}">`).join('')}</datalist></label></div>
    <label class="f"><span>Σημείωση</span><input name="note" value="${esc(l?.note || '')}"></label>
    <datalist id="hnames">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="small muted" style="margin:0 2px 4px">Εξέταση · Τιμή · Μονάδα · Όρια (π.χ. 11-14,5 ή &lt;25)</div><div data-rows></div>
    <button class="btn sm" data-addrow style="width:auto">+ Γραμμή</button>
    ${attachHtml()}
    <button class="btn primary" data-ok>Αποθήκευση</button>${l ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const g = (n) => el.querySelector(`[name=${n}]`).value.trim();
    const box = el.querySelector('[data-rows]');
    const read = () => box.querySelectorAll('.h-lr').forEach((r, i) => { rows[i] = [r.querySelector('[data-k]').value.trim(), r.querySelector('[data-v]').value.trim(), r.querySelector('[data-u]').value.trim(), r.querySelector('[data-r]').value.trim()]; });
    const draw = () => {
      box.innerHTML = rows.map((r, i) => `<div class="h-lr"><input data-k list="hnames" value="${esc(r[0] ? H.aName(r[0]) : '')}" placeholder="Εξέταση"><input data-v value="${esc(r[1])}" placeholder="Τιμή" inputmode="decimal"><input data-u value="${esc(r[2])}" placeholder="Μονάδα"><input data-r value="${esc(r[3] === '!' ? '!' : r[3])}" placeholder="Όρια"><button type="button" data-rm="${i}">✕</button></div>`).join('');
      box.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { read(); rows.splice(Number(b.dataset.rm), 1); draw(); }));
      box.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('change', () => { const row = inp.closest('.h-lr'); const k = H.aKey(inp.value); const last = k && lastOf(k); if (last) { if (!row.querySelector('[data-u]').value) row.querySelector('[data-u]').value = last.unit; if (!row.querySelector('[data-r]').value) row.querySelector('[data-r]').value = last.ref; } }));
    };
    draw();
    el.querySelector('[data-addrow]').onclick = () => { read(); rows.push(['', '', '', '']); draw(); box.lastElementChild?.querySelector('input')?.focus(); };
    attachMount(el, docs, () => g('d'), () => `Εξετάσεις ${g('place')}`.trim());
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await ui.confirm(`Διαγραφή των εξετάσεων ${dFull(l.d)};`, 'Διαγραφή')) { await store.del(H.SP, l.id); close(); document.querySelectorAll('.sheet-bg').forEach((x) => x.remove()); } });
    el.querySelector('[data-ok]').onclick = async () => {
      read(); const out = rows.filter((r) => r[0] && r[1]).map((r) => [H.aKey(r[0]), r[1], r[2], r[3]]);
      if (!out.length) { ui.toast('Γράψε τουλάχιστον μία τιμή'); return; }
      await store.put(H.SP, l?.id || null, { ...(l ? {} : C()), type: 'hlab', d: g('d') || today(), place: g('place') || '—', note: g('note') || null, rows: out, docs });
      document.querySelectorAll('.sheet-bg').forEach((x) => x.remove()); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}
function vacSheet(v = null) {
  const doses = (v?.doses || []).map((d) => ({ ...d }));
  sheet(`<div class="mid">${v ? esc(v.disease) : 'Νέο εμβόλιο'}</div>
    <label class="f" style="margin-top:10px"><span>Νόσος / εμβόλιο</span><input name="disease" value="${esc(v?.disease || '')}"></label>
    <div data-doses></div><button class="btn sm" data-add style="width:auto">+ Δόση</button>
    <label class="f" style="margin-top:10px"><span>Σημείωση</span><input name="note" value="${esc(v?.note || '')}"></label>
    <button class="btn primary" data-ok>Αποθήκευση</button>${v ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const box = el.querySelector('[data-doses]');
    const read = () => box.querySelectorAll('.h-dr').forEach((r, i) => { const done = r.querySelector('[data-st]').value === 'done'; doses[i] = done ? { d: r.querySelector('[data-d]').value || today(), b: r.querySelector('[data-b]').value.trim() } : { from: r.querySelector('[data-f]').value, to: r.querySelector('[data-t]').value || r.querySelector('[data-f]').value, b: r.querySelector('[data-b]').value.trim() }; });
    const draw = () => {
      box.innerHTML = doses.map((d, i) => `<div class="h-dr card" style="padding:10px;margin:8px 0;background:var(--chip);box-shadow:none"><div class="row"><b class="grow">${i + 1}η δόση</b><button type="button" class="btn sm ghost" data-rm="${i}" style="width:auto;margin:0;color:var(--red)">✕</button></div>
        <div class="grid2"><select data-st><option value="done" ${d.d ? 'selected' : ''}>✓ Έγινε</option><option value="plan" ${d.d ? '' : 'selected'}>Προγραμματισμένη</option></select><input data-b value="${esc(d.b || '')}" placeholder="Σκεύασμα"></div>
        <div data-dn ${d.d ? '' : 'hidden'} style="margin-top:6px"><input type="date" data-d value="${esc(d.d || '')}"></div>
        <div data-pl class="grid2" ${d.d ? 'hidden' : ''} style="margin-top:6px"><input type="date" data-f value="${esc(d.from || '')}" title="από"><input type="date" data-t value="${esc(d.to || '')}" title="έως"></div></div>`).join('');
      box.querySelectorAll('[data-st]').forEach((s) => (s.onchange = () => { const r = s.closest('.h-dr'); r.querySelector('[data-dn]').hidden = s.value !== 'done'; r.querySelector('[data-pl]').hidden = s.value === 'done'; if (s.value === 'done' && !r.querySelector('[data-d]').value) r.querySelector('[data-d]').value = today(); }));
      box.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { read(); doses.splice(Number(b.dataset.rm), 1); draw(); }));
    };
    draw();
    el.querySelector('[data-add]').onclick = () => { read(); const last = doses.filter((d) => d.d).pop(); doses.push({ d: today(), b: last?.b || '' }); draw(); };
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await ui.confirm(`Διαγραφή «${esc(v.disease)}»;`, 'Διαγραφή')) { await store.del(H.SP, v.id); close(); } });
    el.querySelector('[data-ok]').onclick = async () => {
      read(); const disease = el.querySelector('[name=disease]').value.trim(); if (!disease) { ui.toast('Γράψε το εμβόλιο'); return; }
      const ds = doses.filter((d) => d.d || d.from); const done = ds.filter((d) => d.d).sort((a, b) => (a.d < b.d ? -1 : 1)), plan = ds.filter((d) => !d.d).sort((a, b) => (a.from < b.from ? -1 : 1));
      await store.put(H.SP, v?.id || null, { ...(v ? {} : C()), type: 'hvac', disease, note: el.querySelector('[name=note]').value.trim() || null, doses: [...done, ...plan], ...(v ? {} : { ord: H.vaccines().length }) });
      close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}
function docSheet(d = null) {
  sheet(`<div class="mid">${d ? 'Έγγραφο' : 'Νέο έγγραφο'}</div>
    <label class="f" style="margin-top:10px"><span>Τίτλος</span><input name="title" value="${esc(d?.title || '')}" placeholder="π.χ. Εξετάσεις αίματος — διαγνωστικό κέντρο"></label>
    <label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${esc(d?.d || today())}"></label>
    <label class="f"><span>${d ? `Αρχείο: ${esc(d.file || '—')} — αντικατάσταση (προαιρετικά)` : 'Αρχείο (PDF ή φωτογραφία)'}</span><input type="file" name="file" accept="application/pdf,image/*"></label>
    <button class="btn primary" data-ok>Αποθήκευση</button>${d ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const g = (n) => el.querySelector(`[name=${n}]`);
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await ui.confirm(`Διαγραφή «${esc(d.title)}» από τη λίστα; (το αρχείο μένει στο OneDrive)`, 'Διαγραφή')) { await store.del(H.SP, d.id); close(); } });
    el.querySelector('[data-ok]').onclick = async (e) => {
      const f = g('file').files[0], title = g('title').value.trim(), dd = g('d').value || today();
      if (!title) { ui.toast('Γράψε τίτλο'); return; } if (!d && !f) { ui.toast('Διάλεξε αρχείο'); return; }
      e.target.disabled = true; e.target.textContent = 'Ανέβασμα…';
      try {
        let file = d?.file || null, mime = d?.mime || null;
        if (f) { file = await H.upload(f, dd, title, d?.file); mime = f.type || mime; }
        await store.put(H.SP, d?.id || null, { type: 'hdoc', title, d: dd, file, mime, ...(d ? {} : C()) });
        close(); ui.toast('Αποθηκεύτηκε ✓');
      } catch (er) { e.target.disabled = false; e.target.textContent = 'Αποθήκευση'; ui.toast('Δεν ανέβηκε: ' + er.message, 4000); }
    };
  });
}
function profSheet(isNew = false) {
  const p = isNew ? {} : H.profile(); const F = [['name', 'Όνομα'], ['birth', 'Γέννηση', 'date'], ['blood', 'Ομάδα αίματος'], ['pediatrician', 'Παιδίατρος'], ['allergies', 'Αλλεργίες'], ['birthInfo', 'Τοκετός']];
  const vacs = H.vaccines(H.FIRST);
  sheet(`<div class="mid">${isNew ? '👶 Νέο παιδί' : 'Στοιχεία'}</div><div style="margin-top:10px">${F.map(([k, l, t]) => `<label class="f"><span>${l}</span><input name="${k}" ${t ? `type="${t}"` : ''} value="${esc(p[k] || '')}"></label>`).join('')}</div>
    ${isNew && vacs.length ? `<label class="row" style="gap:8px;margin:0 2px 12px"><input type="checkbox" name="cpv" checked style="width:auto"> <span class="small">Με τη λίστα εμβολίων (κενή, χωρίς δόσεις)</span></label>` : ''}
    ${isNew ? `<div class="small muted" style="margin:0 2px 10px">Τα έγγραφά του πάνε στον φάκελο «Υγεία &lt;όνομα&gt;» του OneDrive.</div>` : ''}
    <button class="btn primary" data-ok>Αποθήκευση</button>${!isNew && H.cur() !== H.FIRST ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή παιδιού</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await ui.confirm(`Διαγραφή του «${esc(p.name || '')}» και όλων των εγγραφών του;`, 'Διαγραφή'))) return;
      const all = ['hvisit', 'hlab', 'hvac', 'hdoc', 'hlog'].flatMap((t) => store.records(t, [H.SP]).filter((r) => H.childOf(r) === p.id));
      await store.putMany(H.SP, [...all.map((r) => ({ id: r.id, del: true })), { id: p.id, del: true }]); H.setCur(H.FIRST); close();
    });
    el.querySelector('[data-ok]').onclick = async () => {
      const vals = Object.fromEntries(F.map(([k]) => [k, el.querySelector(`[name=${k}]`).value.trim() || null]));
      if (isNew && !vals.name) { ui.toast('Γράψε όνομα'); return; }
      if (!isNew) { await store.put(H.SP, p.id || H.FIRST, { type: 'hprofile', ...vals }); close(); return; }
      const nid = (H.profiles().length ? 'hprofile-' + Date.now().toString(36) : H.FIRST);
      H.setCur(nid); await store.put(H.SP, nid, { type: 'hprofile', ...vals });
      if (el.querySelector('[name=cpv]')?.checked) await store.putMany(H.SP, vacs.map((v, i) => ({ id: `${nid}-x${i}`, set: { type: 'hvac', child: nid === H.FIRST ? null : nid, ord: v.ord ?? i, disease: v.disease, tags: v.tags || null, note: null, doses: [] } })));
      H.setCur(nid); close(); ui.toast('Νέο παιδί ✓');
    };
  });
}

// ---------- clicks inside any body (tab, search results, info sheets) ----------
function bindBody(root, closeInfo) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); fn(b, e); }));
  on('[data-trend]', (b) => { closeInfo?.(); showTrend(b.dataset.trend); });
  on('[data-lab]', (b) => { closeInfo?.(); showLab(b.dataset.lab); });
  on('[data-doc]', (b) => openDoc(b.dataset.doc));
  on('[data-docedit]', (b) => docSheet(H.docs().find((x) => x.id === b.dataset.docedit)));
  on('[data-visit]', (b, e) => { if (e.target.closest('button')) return; visitSheet(H.visits().find((x) => x.id === b.dataset.visit)); });
  on('[data-vac]', (b) => vacSheet(H.vaccines().find((x) => x.id === b.dataset.vac)));
  on('[data-labedit]', (b) => labSheet(H.labs().find((x) => x.id === b.dataset.labedit)));
  on('[data-log]', (b) => logSheet(null, H.logs().find((x) => x.id === b.dataset.log)));
  on('[data-newlog]', (b) => logSheet(b.dataset.newlog));
  on('[data-guides]', () => guidesSheet());
}

const body0 = (root) => root.querySelector('[data-body]');
export const healthTitle = () => H.appTitle();
export function healthBadge() { const n = H.profiles().reduce((a, p) => a + H.vacPending(p.id).filter((x) => x.st !== 'fut').length, 0); return n ? `${n} ${n === 1 ? 'εμβόλιο εκκρεμεί' : 'εμβόλια εκκρεμούν'}` : ''; }

export default {
  live: true, keepScroll: true,
  html(p) {
    const tab = TABS.some(([k]) => k === p[0]) ? p[0] : 'sum';
    if (!H.hasData()) {
      return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>🩺 Υγεία παιδιών</h1></div>
        <div class="card"><b>Ημερολόγιο & βιβλιάριο υγείας</b><div class="small muted" style="margin:6px 0 10px">Πυρετός, φάρμακα, συμπτώματα, επισκέψεις, εξετάσεις, εμβόλια, ανάπτυξη και έγγραφα — με αναζήτηση σε όλα, κοινά για τους δύο. Αν έχεις αρχείο ιστορικού (.json), εισήγαγέ το εδώ· αλλιώς ξεκίνα με τα στοιχεία του παιδιού.</div>
        <label class="btn primary" style="width:100%">📥 Εισαγωγή ιστορικού (.json)<input type="file" accept=".json,application/json" data-seed hidden></label>
        <button class="btn" data-newchild style="width:100%;margin-top:8px">👶 Νέο παιδί</button></div>`;
    }
    const add = { log: ['data-newlog="note"', '+ Καταχώριση'], hist: ['data-newv', '+ Επίσκεψη'], labs: ['data-newl', '+ Εξετάσεις'], vac: ['data-newx', '+ Εμβόλιο'], docs: ['data-newd', '+ Έγγραφο'], growth: ['data-newlog="growth"', '+ Μέτρηση'], sum: ['data-newv', '+ Νέο'] }[tab];
    const ps = H.profiles();
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>🩺 ${esc(H.appTitle())}</h1><button class="btn sm primary" ${add[0]} style="width:auto">${add[1]}</button></div>
      ${ps.length > 1 ? `<div class="chips" style="margin:0 0 8px">${ps.map((c) => `<button class="chip ${c.id === H.cur() ? 'on' : ''}" data-child="${esc(c.id)}">👶 ${esc(H.firstName(c) || '—')}</button>`).join('')}</div>` : ''}
      <div class="h-search"><input data-q value="${esc(q)}" placeholder="Αναζήτηση: ${esc([...H.quick(3), (H.visits()[0]?.d || today()).slice(0, 4)].join(', '))}…" autocomplete="off" enterkeyhint="search">${q ? '<button data-qx>✕</button>' : ''}</div>
      <div class="tabs" data-tabs ${q ? 'style="opacity:.5"' : ''}>${TABS.map(([k, l]) => `<button class="${!q && k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div data-body>${q ? search() : ((TOK = []), TAB[tab]())}</div>`;
  },
  mount(root, p, u) {
    ui = u; const tab = TABS.some(([k]) => k === p[0]) ? p[0] : 'sum';
    root.querySelector('[data-back]')?.addEventListener('click', () => (q ? ((q = ''), u.render()) : u.go('#/apps')));
    root.querySelector('[data-seed]')?.addEventListener('change', async (e) => { try { const n = await H.importFile(e.target.files[0]); u.toast(`Φορτώθηκαν ${n} εγγραφές ✓`, 4000); } catch (er) { u.toast(er.message, 4000); } });
    if (!body0(root)) { root.querySelector('[data-newchild]')?.addEventListener('click', () => profSheet(true)); return; }
    root.querySelectorAll('[data-child]').forEach((b) => b.addEventListener('click', () => { H.setCur(b.dataset.child); u.render(); }));
    root.querySelector('.top [data-newlog]')?.addEventListener('click', (e) => { e.stopPropagation(); logSheet(e.currentTarget.dataset.newlog || 'note'); });
    const body = root.querySelector('[data-body]');
    const inp = root.querySelector('[data-q]');
    let tm; inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => {
      const had = !!q; q = inp.value.trim();
      if (!!q !== had) { const pos = inp.selectionStart; u.render(); const ni = document.querySelector('[data-q]'); ni.focus(); ni.setSelectionRange(pos, pos); return; }
      body.innerHTML = q ? search() : ((TOK = []), TAB[tab]()); bindAll();
    }, 150); });
    root.querySelector('[data-qx]')?.addEventListener('click', () => { q = ''; u.render(); });
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { q = ''; u.go(`#/health/${b.dataset.tab}`); if (`#/health/${b.dataset.tab}` === location.hash) u.render(); }));
    root.querySelector('[data-newv]')?.addEventListener('click', () => visitSheet());
    root.querySelector('[data-newl]')?.addEventListener('click', () => labSheet());
    root.querySelector('[data-newx]')?.addEventListener('click', () => vacSheet());
    root.querySelector('[data-newd]')?.addEventListener('click', () => docSheet());
    const bindAll = () => {
      bindBody(body);
      body.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { inp.value = b.dataset.q; inp.dispatchEvent(new Event('input')); }));
      body.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { kindF = b.dataset.kind; u.render(); }));
      body.querySelector('[data-prof]')?.addEventListener('click', () => profSheet());
      body.querySelectorAll('[data-newchild]').forEach((b) => b.addEventListener('click', () => profSheet(true)));
      body.querySelector('[data-imp]')?.addEventListener('change', async (e) => { try { const n = await H.importFile(e.target.files[0]); u.toast(`Φορτώθηκαν ${n} εγγραφές ✓`, 4000); } catch (er) { u.toast(er.message, 4000); } });
      body.querySelectorAll('[data-logf]').forEach((b) => b.addEventListener('click', () => { logF = b.dataset.logf; u.render(); }));
      body.querySelectorAll('[data-gotab]').forEach((b) => b.addEventListener('click', () => u.go(`#/health/${b.dataset.gotab}`)));
      body.querySelector('[data-newlogx]')?.addEventListener('change', (e) => { if (e.target.value) logSheet(e.target.value); e.target.value = ''; });
    };
    bindAll();
  },
};
