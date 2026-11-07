// #/pet — 🐕 Κατοικίδιο: βιβλιάριο υγείας με αναζήτηση σε όλα (ιστορικό, εμβόλια, βάρος, φάρμακα, περιστατικά, φροντίδα, έγγραφα).
// Το όνομα και όλο το ιστορικό έρχονται από τα δεδομένα — τίποτα για το ζώο μέσα στον κώδικα.
import { esc, today, dFull } from '../util.js';
import * as store from '../store.js';
import * as P from '../pet.js';
import { sheet } from './lessons/ui.js';
import { chart } from './health.js';

const TABS = [['sum', 'Σύνοψη'], ['hist', 'Ιστορικό'], ['vac', 'Εμβόλια'], ['weight', 'Βάρος'], ['meds', 'Φάρμακα'], ['inc', 'Περιστατικά'], ['care', 'Φροντίδα'], ['docs', 'Έγγραφα']];
let q = '', kindF = '', TOK = [], ui;
const dec = (x) => (x == null ? '' : String(x).replace('.', ','));
const euro = (x) => (x == null ? '' : `${dec(x)} €`);

function hl(text) {
  text = String(text ?? ''); if (!TOK.length || !text) return esc(text);
  let out = '', map = [];
  for (let i = 0; i < text.length; i++) for (const c of P.norm(text[i])) { out += c; map.push(i); }
  const mk = new Array(text.length).fill(false);
  for (const t of TOK) { let i = out.indexOf(t); while (i >= 0) { for (let k = i; k < i + t.length; k++) mk[map[k]] = true; i = out.indexOf(t, i + t.length); } }
  let r = '', open = false;
  for (let i = 0; i < text.length; i++) { if (mk[i] !== open) { r += mk[i] ? '<mark>' : '</mark>'; open = mk[i]; } r += esc(text[i]); }
  return r + (open ? '</mark>' : '');
}
const pill = (k, tone) => `<span class="h-pill h-${tone || P.TONE[k] || 'grey'}">${hl(k)}</span>`;
const docLinks = (ids) => (ids || []).map((id) => P.docs().find((d) => d.id === id)).filter(Boolean).map((d) => `<button class="h-lnk" data-doc="${esc(d.id)}">📄 ${esc(d.title)}</button>`).join(' ');
function evRow(e) {
  const extra = [e.tx && '🧾 από τα έξοδα', e.vet && `👩‍⚕️ ${e.vet}`, e.w != null && `⚖️ ${dec(e.w)} kg`, e.cost != null && euro(e.cost)].filter(Boolean).join(' · ');
  return `<div class="h-item" data-ev="${esc(e.id)}">
    <div class="row wrap" style="gap:6px"><b>${hl(dFull(e.d))}</b>${pill(e.kind || 'Επίσκεψη')}${e.sev ? pill(e.sev, 'grey') : ''}${e.glands && e.kind !== 'Αδένες' ? pill('Αδένες', 'grey') : ''}</div>
    <div style="font-weight:600;margin-top:3px">${hl(e.title)}</div>
    ${e.text ? `<div class="small" style="margin-top:3px;line-height:1.45">${hl(e.text)}</div>` : ''}
    ${e.vacc?.length ? `<div class="row wrap" style="gap:5px;margin-top:5px">${e.vacc.map((v) => `<span class="h-med">💉 ${hl(v)}</span>`).join('')}</div>` : ''}
    ${e.meds?.length ? `<div class="row wrap" style="gap:5px;margin-top:5px">${e.meds.map((m) => `<span class="h-med">💊 ${hl(m)}</span>`).join('')}</div>` : ''}
    ${extra ? `<div class="small muted" style="margin-top:4px">${hl(extra)}</div>` : ''}
    ${e.docs?.length ? `<div class="small" style="margin-top:5px">${docLinks(e.docs)}</div>` : ''}
  </div>`;
}
const list = (l, empty = 'Τίποτα ακόμα') => `<div class="list">${l.map(evRow).join('') || `<div class="item muted">${empty}</div>`}</div>`;
const stTxt = { late: 'Έχει λήξει', due: 'Πλησιάζει', ok: 'OK', none: 'Δεν έχει καταγραφεί' };
const stDot = { late: 'late', due: 'due', ok: 'fut', none: 'due' };
function schedRows(rows) {
  return rows.map((s) => `<div class="row" style="margin-top:8px;align-items:flex-start"><span class="h-dot ${stDot[s.st]}"></span><div class="grow"><b>${hl(s.t)}</b>
    <div class="small muted">${s.last ? `Τελευταία: ${dFull(s.last)}` : 'Καμία καταγραφή'}${s.every ? ` · κάθε ${s.every} ${s.every == 1 ? 'μήνα' : 'μήνες'}` : ''}</div></div>
    <div class="small" style="text-align:right"><b class="${s.st === 'late' ? 'red' : ''}">${stTxt[s.st]}</b>${s.due ? `<div class="muted">${s.st === 'late' ? 'από' : ''} ${dFull(s.due)}</div>` : ''}</div></div>`).join('');
}
function weightChart() {
  const w = P.weights(); if (w.length < 2) return '';
  return chart(w.map((x) => ({ x: P.monthsAt(x.d, w[0].d), y: x.w, t: `${dFull(x.d)}: ${dec(x.w)} kg` })));
}
const docRow = (d) => `<div class="item" data-doc="${esc(d.id)}"><div class="dot">${(d.mime || '').startsWith('image') ? '🖼️' : '📄'}</div><div class="grow"><div class="t" style="white-space:normal">${hl(d.title)}</div><div class="s">${hl(dFull(d.d))}${d.file ? '' : ' · δεν έχει ανέβει αρχείο'}</div></div><button class="btn sm ghost" data-docedit="${esc(d.id)}" style="width:auto">✎</button></div>`;

const TAB = {
  sum() {
    const p = P.profile(), sc = P.schedule(), late = sc.filter((s) => s.st === 'late' || s.st === 'none').length, ch = P.chores();
    const w = P.weights().pop(), last = P.events()[0];
    const rows = [['Είδος', [p.species, p.breed].filter(Boolean).join(' · ')], ['Γέννηση', p.birth ? `${dFull(p.birth)} (${P.ageTxt()})` : ''], ['Φύλο', p.sex], ['Μικροτσίπ', p.chip], ['Βάρος', w ? `${dec(w.w)} kg (${dFull(w.d)})` : ''], ['Αλλεργίες', p.allergies], ['Διατροφή', p.diet], ['Κτηνίατρος', p.vet], ['Άλλος κτηνίατρος', p.vet2]].filter((r) => r[1]);
    const inc = P.events().filter((e) => e.kind === 'Περιστατικό').slice(0, 5);
    const qc = P.quick(12);
    return `<div class="card"><div class="row"><b class="grow">Στοιχεία</b><button class="btn sm ghost" data-prof style="width:auto">✎</button></div>
      <table class="t" style="font-size:13.5px;margin-top:4px">${rows.map(([k, v]) => `<tr><td class="muted">${k}</td><td>${esc(v)}</td></tr>`).join('')}</table>
      ${last ? `<div class="small muted" style="margin-top:6px">Τελευταία καταχώριση: ${dFull(last.d)} · ${esc(last.title)}</div>` : ''}</div>
    ${sc.length ? `<div class="card"><div class="row"><b class="grow">Τι εκκρεμεί</b>${late ? `<span class="h-pill h-red">${late}</span>` : ''}<button class="btn sm ghost" data-sched style="width:auto">✎</button></div>${schedRows(sc)}
      <div class="small muted" style="margin-top:8px">Υπολογίζεται από την τελευταία καταγραφή στο βιβλιάριο. Αν κάτι έγινε και δεν γράφτηκε, πρόσθεσέ το με «+ Νέο».</div></div>`
      : `<div class="card"><b>Τι εκκρεμεί</b><div class="small muted" style="margin:6px 0">Φτιάξε το πρόγραμμα φροντίδας (εμβόλια, αποπαρασίτωση, ζύγισμα…) για να βλέπεις τι λήγει.</div><button class="btn sm" data-sched style="width:auto">Πρόγραμμα φροντίδας</button></div>`}
    ${ch.length ? `<div class="card"><div class="row"><b class="grow">Από τις Εργασίες</b><a class="h-lnk" href="#/chores">όλες ›</a></div>${ch.map((c) => `<div class="row small" style="margin-top:7px"><span class="h-dot ${c.due < today() ? 'late' : c.due <= today() ? 'due' : 'fut'}"></span><span class="grow">${esc(c.name)}</span><span class="${c.due < today() ? 'red' : 'muted'}">${dFull(c.due)}</span></div>`).join('')}
      <div class="small muted" style="margin-top:6px">Εργασίες με ομάδα «${esc(P.name())}» — από εκεί έρχονται και οι ειδοποιήσεις.</div></div>` : ''}
    ${inc.length ? `<div class="card"><b>Περιστατικά</b>${inc.map((e) => `<div class="small" style="margin-top:7px"><b>${dFull(e.d)}</b> · ${esc(e.title)}</div>`).join('')}</div>` : ''}
    ${qc.length ? `<div class="card"><b>Γρήγορη αναζήτηση</b><div class="chips" style="margin-top:8px">${qc.map((c) => `<button class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>` : ''}`;
  },
  hist() {
    const kinds = [...new Set(P.events().map((e) => e.kind).filter(Boolean))];
    const l = P.events().filter((e) => !kindF || e.kind === kindF || (kindF === 'Αδένες' && e.glands));
    return `<div class="chips" style="margin-bottom:10px"><button class="chip ${kindF ? '' : 'on'}" data-kind="">Όλα</button>${kinds.map((k) => `<button class="chip ${kindF === k ? 'on' : ''}" data-kind="${esc(k)}">${esc(k)}</button>`).join('')}</div>${list(l)}`;
  },
  vac() {
    const sc = P.schedule().filter((s) => s.kind === 'Εμβόλιο');
    const rows = P.vaccEvents().flatMap((e) => (e.vacc?.length ? e.vacc : [e.title]).map((v) => ({ e, v })));
    return `${sc.length ? `<div class="card"><b>Επόμενα</b>${schedRows(sc)}</div>` : ''}
      <div class="card"><table class="t" style="font-size:13.5px"><tr><th>Ημ/νία</th><th>Εμβόλιο</th></tr>${rows.map((r) => `<tr class="click" data-ev="${esc(r.e.id)}"><td>${hl(dFull(r.e.d))}</td><td>${hl(r.v)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Κανένα</td></tr>'}</table></div>`;
  },
  weight() {
    const w = P.weights(), notes = P.events().filter((e) => /κιλ|βαρο/.test(P.norm(e.text)) && e.w == null);
    return `<div class="card"><b>Βάρος (kg)</b>${weightChart() || `<div class="small muted" style="margin-top:6px">${w.length ? 'Με 2 ή περισσότερες μετρήσεις εμφανίζεται διάγραμμα.' : 'Καμία μέτρηση ακόμα.'}</div>`}
      ${w.length ? `<table class="t" style="font-size:13.5px;margin-top:6px"><tr><th>Ημ/νία</th><th>Ηλικία</th><th class="r">kg</th></tr>${[...w].reverse().map((x) => `<tr><td>${dFull(x.d)}</td><td class="muted">${P.ageTxt(x.d)}</td><td class="r"><b>${dec(x.w)}</b></td></tr>`).join('')}</table>` : ''}</div>
      ${notes.length ? `<div class="card"><b>Τι είπε ο κτηνίατρος</b>${notes.map((e) => `<div class="small" style="margin-top:7px"><b>${dFull(e.d)}</b> · ${hl(e.text)}</div>`).join('')}</div>` : ''}`;
  },
  meds() {
    const m = P.meds();
    return `<div class="card"><table class="t" style="font-size:13.5px"><tr><th>Ημ/νία</th><th>Φάρμακο</th><th>Για</th></tr>${m.map((x) => `<tr class="click" data-ev="${esc(x.e.id)}"><td>${hl(dFull(x.e.d))}</td><td><b>${hl(x.name)}</b></td><td class="small">${hl(x.e.title)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Κανένα</td></tr>'}</table></div>`;
  },
  inc() { return list(P.events().filter((e) => e.kind === 'Περιστατικό'), 'Κανένα περιστατικό'); },
  care() {
    const c = P.profile().care || [];
    return `<div class="card"><div class="row"><b class="grow">Οδηγίες φροντίδας</b><button class="btn sm ghost" data-care style="width:auto">✎</button></div>
      ${c.map(([t, x]) => `<div style="margin-top:9px"><b>${hl(t)}</b><div class="small">${hl(x)}</div></div>`).join('') || '<div class="small muted" style="margin-top:6px">Καμία ακόμα.</div>'}</div>`;
  },
  docs() {
    return `<div class="list">${P.docs().map(docRow).join('') || '<div class="item muted">Κανένα έγγραφο</div>'}</div>
      <div class="small muted" style="margin:8px 2px">Τα αρχεία είναι στο OneDrive, στον φάκελο «${esc(store.spaceById(P.SP)?.folder || '')}/${esc(P.docDir())}».</div>`;
  },
};

function search() {
  TOK = P.norm(q).split(/\s+/).filter(Boolean);
  const m = (s) => { const n = P.norm(s); return TOK.every((t) => n.includes(t)); };
  let h = '';
  if (TOK.some((t) => t.length >= 3 && ['κιλ', 'βαρ', 'ζυγ', 'kg'].some((w) => t.startsWith(w)))) h += '<h2>Βάρος</h2>' + TAB.weight();
  const sc = P.schedule().filter((s) => m(`${s.t} ${s.kind || ''} εκκρεμ`));
  if (sc.length) h += `<h2>Πρόγραμμα</h2><div class="card">${schedRows(sc)}</div>`;
  const ev = P.events().filter((e) => m(`${dFull(e.d)} ${e.d.slice(5, 7)}/${e.d.slice(0, 4)} ${P.evText(e)} ${e.glands ? 'αδενες' : ''} ${e.w != null ? dec(e.w) + ' kg' : ''} ${e.cost != null ? euro(e.cost) : ''}`));
  if (ev.length) h += `<h2>Ιστορικό (${ev.length})</h2>${list(ev)}`;
  const care = (P.profile().care || []).filter(([t, x]) => m(`${t} ${x}`));
  if (care.length) h += `<h2>Φροντίδα</h2><div class="card">${care.map(([t, x]) => `<div style="margin-top:6px"><b>${hl(t)}</b><div class="small">${hl(x)}</div></div>`).join('')}</div>`;
  const ds = P.docs().filter((d) => m(`${d.title} ${dFull(d.d)} ${d.file || ''} εγγραφο`));
  if (ds.length) h += `<h2>Έγγραφα (${ds.length})</h2><div class="list">${ds.map(docRow).join('')}</div>`;
  return h || `<div class="card muted center">Δεν βρέθηκε κάτι για «${esc(q)}».</div>`;
}

// ---------- sheets ----------
async function openDoc(id) {
  const d = P.docs().find((x) => x.id === id); if (!d) return;
  const close = sheet(`<div class="mid">${esc(d.title)}</div><div class="small muted">${dFull(d.d)}</div><div data-dv style="margin-top:10px" class="muted">Φόρτωση από το OneDrive…</div><button class="btn ghost" data-x>Κλείσιμο</button>`, (el, cl) => { el.querySelector('[data-x]').onclick = cl; });
  const el = [...document.querySelectorAll('.sheet [data-dv]')].pop();
  try {
    const b = await P.fileOf(d);
    if (!b) { el.innerHTML = `Δεν έχει ανέβει ακόμα το αρχείο${d.file ? ` «${esc(d.file)}»` : ''}.<br><button class="btn primary" data-up>📎 Ανέβασέ το τώρα</button>`; el.querySelector('[data-up]').onclick = () => { close(); docSheet(d); }; return; }
    const url = URL.createObjectURL(b);
    el.innerHTML = `${b.type.startsWith('image') ? `<img src="${url}" style="width:100%;border-radius:10px">` : ''}<a class="btn primary" href="${url}" target="_blank" rel="noopener" style="width:100%;margin-top:8px">Άνοιγμα</a><a class="btn" href="${url}" download="${esc(d.file)}" style="width:100%;margin-top:8px">Λήψη</a>`;
  } catch (e) { el.textContent = 'Δεν άνοιξε: ' + e.message; }
}
function attachHtml() { return `<div class="f" style="margin-bottom:10px"><span class="small muted" style="font-weight:600">Έγγραφα / φωτογραφίες</span><div data-att class="row wrap" style="gap:6px;margin-top:4px"></div>
  <label class="btn sm" style="width:auto;margin-top:6px">📎 Επισύναψη αρχείου<input type="file" accept="application/pdf,image/*" data-file hidden></label>
  <select data-pick style="margin-top:6px"><option value="">…ή διάλεξε υπάρχον έγγραφο</option>${P.docs().map((d) => `<option value="${esc(d.id)}">${dFull(d.d)} · ${esc(d.title)}</option>`).join('')}</select></div>`; }
function attachMount(el, ids, getDate, getTitle) {
  const draw = () => { el.querySelector('[data-att]').innerHTML = ids.map((id) => { const d = P.docs().find((x) => x.id === id); return d ? `<span class="h-med">📄 ${esc(d.title)} <button type="button" data-rm="${esc(id)}" style="border:0;background:none;color:var(--red);cursor:pointer">✕</button></span>` : ''; }).join('') || '<span class="small muted">—</span>'; el.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { ids.splice(ids.indexOf(b.dataset.rm), 1); draw(); })); };
  el.querySelector('[data-pick]').onchange = (e) => { if (e.target.value && !ids.includes(e.target.value)) ids.push(e.target.value); e.target.value = ''; draw(); };
  el.querySelector('[data-file]').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; const d = getDate() || today(); const title = getTitle() || f.name.replace(/\.\w+$/, '');
    ui.toast('Ανέβασμα στο OneDrive…', 6000);
    try { const nm = await P.upload(f, d, title); const id = await store.put(P.SP, null, { type: 'pdoc', d, title, file: nm, mime: f.type || null }); ids.push(id); draw(); ui.toast('Ανέβηκε ✓'); } catch (er) { ui.toast('Δεν ανέβηκε: ' + er.message, 4000); }
  };
  draw();
}
function evSheet(e = null, kind = null) {
  const docs = [...(e?.docs || [])]; const k0 = e?.kind || kind || 'Επίσκεψη';
  const vets = [...new Set([P.profile().vet, P.profile().vet2, ...P.events().map((x) => x.vet)].filter(Boolean))];
  sheet(`<div class="mid">${e ? esc(e.title) : 'Νέα καταχώριση'}</div>
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${esc(e?.d || today())}"></label>
    <label class="f"><span>Είδος</span><select name="kind">${P.KINDS.map((x) => `<option ${x === k0 ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <label class="f"><span>Τίτλος</span><input name="title" value="${esc(e?.title || '')}" placeholder="π.χ. Ετήσιο εμβόλιο, Διάρροια, Ζύγισμα"></label>
    <label class="f"><span>Σημειώσεις</span><textarea name="text" rows="4">${esc(e?.text || '')}</textarea></label>
    <label class="f"><span>Εμβόλια (ένα σε κάθε γραμμή)</span><textarea name="vacc" rows="2" placeholder="π.χ. Ωτίτιδα">${esc((e?.vacc || []).join('\n'))}</textarea></label>
    <label class="f"><span>Φάρμακα (ένα σε κάθε γραμμή)</span><textarea name="meds" rows="2">${esc((e?.meds || []).join('\n'))}</textarea></label>
    <div class="grid3"><label class="f"><span>Βάρος kg</span><input name="w" inputmode="decimal" value="${dec(e?.w)}"></label><label class="f"><span>Κόστος €</span><input name="cost" inputmode="decimal" value="${dec(e?.cost)}"></label>
    <label class="f"><span>Κτηνίατρος</span><input name="vet" list="pvets" value="${esc(e?.vet || '')}"><datalist id="pvets">${vets.map((v) => `<option value="${esc(v)}">`).join('')}</datalist></label></div>
    <label class="row small" style="margin:0 2px 10px"><input type="checkbox" name="glands" style="width:auto" ${e?.glands ? 'checked' : ''}> <span>Και άδειασμα αδένων</span></label>
    ${attachHtml()}
    <button class="btn primary" data-ok>Αποθήκευση</button>${e ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const g = (n) => el.querySelector(`[name=${n}]`).value.trim(); const lines = (n) => (g(n) ? g(n).split('\n').map((s) => s.trim()).filter(Boolean) : null);
    attachMount(el, docs, () => g('d'), () => g('title'));
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await ui.confirm(`Διαγραφή «${esc(e.title)}»;`, 'Διαγραφή')) { await store.del(P.SP, e.id); close(); } });
    el.querySelector('[data-ok]').onclick = async () => {
      const kind = g('kind'); let title = g('title'); const w = P.num(g('w'));
      if (!title && kind === 'Ζύγισμα' && w != null) title = 'Ζύγισμα';
      if (!title) { ui.toast('Γράψε τίτλο'); return; }
      await store.put(P.SP, e?.id || null, { type: 'pevent', d: g('d') || today(), kind, title, text: g('text') || null, vacc: lines('vacc'), meds: lines('meds'), w, cost: P.num(g('cost')), vet: g('vet') || null, glands: el.querySelector('[name=glands]').checked || null, sev: e?.sev || null, docs });
      close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}
function docSheet(d = null) {
  sheet(`<div class="mid">${d ? 'Έγγραφο' : 'Νέο έγγραφο'}</div>
    <label class="f" style="margin-top:10px"><span>Τίτλος</span><input name="title" value="${esc(d?.title || '')}" placeholder="π.χ. Εξετάσεις αίματος"></label>
    <label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${esc(d?.d || today())}"></label>
    <label class="f"><span>${d?.file ? `Αρχείο: ${esc(d.file)} — αντικατάσταση (προαιρετικά)` : 'Αρχείο (PDF ή φωτογραφία)'}</span><input type="file" name="file" accept="application/pdf,image/*"></label>
    <button class="btn primary" data-ok>Αποθήκευση</button>${d ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const g = (n) => el.querySelector(`[name=${n}]`);
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await ui.confirm(`Διαγραφή «${esc(d.title)}» από τη λίστα; (το αρχείο μένει στο OneDrive)`, 'Διαγραφή')) { await store.del(P.SP, d.id); close(); } });
    el.querySelector('[data-ok]').onclick = async (ev) => {
      const f = g('file').files[0], title = g('title').value.trim(), dd = g('d').value || today();
      if (!title) { ui.toast('Γράψε τίτλο'); return; } if (!d?.file && !f) { ui.toast('Διάλεξε αρχείο'); return; }
      ev.target.disabled = true; ev.target.textContent = 'Ανέβασμα…';
      try {
        let file = d?.file || null, mime = d?.mime || null;
        if (f) { file = await P.upload(f, dd, title, d?.file); mime = f.type || mime; }
        await store.put(P.SP, d?.id || null, { type: 'pdoc', title, d: dd, file, mime });
        close(); ui.toast('Αποθηκεύτηκε ✓');
      } catch (er) { ev.target.disabled = false; ev.target.textContent = 'Αποθήκευση'; ui.toast('Δεν ανέβηκε: ' + er.message, 4000); }
    };
  });
}
const PF = [['name', 'Όνομα'], ['species', 'Είδος'], ['breed', 'Ράτσα'], ['sex', 'Φύλο'], ['birth', 'Γέννηση', 'date'], ['chip', 'Μικροτσίπ'], ['allergies', 'Αλλεργίες'], ['diet', 'Διατροφή'], ['vet', 'Κτηνίατρος'], ['vet2', 'Άλλος κτηνίατρος']];
const saveProf = (set) => store.put(P.SP, 'pprofile', { type: 'pprofile', ...P.profile(), ...set });
function profSheet() {
  const p = P.profile();
  sheet(`<div class="mid">Στοιχεία</div><div style="margin-top:10px">${PF.map(([k, l, t]) => `<label class="f"><span>${l}</span><input name="${k}" ${t ? `type="${t}"` : ''} value="${esc(p[k] || '')}"></label>`).join('')}</div>
    <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => { const set = Object.fromEntries(PF.map(([k]) => [k, el.querySelector(`[name=${k}]`).value.trim() || null])); if (!set.name) { ui.toast('Γράψε όνομα'); return; } await saveProf(set); close(); };
  });
}
/** care schedule: one line per item «Τίτλος | κάθε Ν μήνες | είδος | λέξεις» */
function schedSheet() {
  const s = P.profile().schedule || [];
  const txt = s.map((x) => [x.t, x.every || '', x.kind || '', x.kw || ''].join(' | ')).join('\n');
  sheet(`<div class="mid">Πρόγραμμα φροντίδας</div>
    <div class="small muted" style="margin:6px 2px 8px">Μία γραμμή για καθένα: <b>Τίτλος | κάθε πόσους μήνες | είδος | λέξεις</b>. Το «είδος» και οι «λέξεις» (χωρισμένες με |) λένε ποια καταχώριση του ιστορικού μετράει ως «έγινε».<br>π.χ. <i>Εμβόλιο λεϊσμανίασης | 12 | Εμβόλιο | λεισμαν</i></div>
    <label class="f"><textarea name="s" rows="8" style="font-size:13.5px">${esc(txt)}</textarea></label>
    <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => {
      const schedule = el.querySelector('[name=s]').value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((a) => a[0])
        .map(([t, every, kind, ...kw]) => ({ t, every: Number(every) || null, kind: P.KINDS.includes(kind) ? kind : null, kw: kw.filter(Boolean).join('|') || null }));
      await saveProf({ schedule }); close();
    };
  });
}
function careSheet() {
  const c = P.profile().care || [];
  sheet(`<div class="mid">Οδηγίες φροντίδας</div><div class="small muted" style="margin:6px 2px 8px">Μία γραμμή για καθεμία: <b>Θέμα: οδηγία</b></div>
    <label class="f"><textarea name="c" rows="10" style="font-size:13.5px">${esc(c.map(([t, x]) => `${t}: ${x}`).join('\n'))}</textarea></label>
    <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => { const care = el.querySelector('[name=c]').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ['', l]; }); await saveProf({ care }); close(); };
  });
}

function bindBody(root) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); fn(b, e); }));
  on('[data-doc]', (b) => openDoc(b.dataset.doc));
  on('[data-docedit]', (b) => docSheet(P.docs().find((x) => x.id === b.dataset.docedit)));
  on('[data-ev]', (b, e) => { if (e.target.closest('button')) return; const ev = P.events().find((x) => x.id === b.dataset.ev); if (ev?.tx) ui.go(`#/edit/${ev.tx}`); else evSheet(ev); });
  on('[data-prof]', profSheet); on('[data-sched]', schedSheet); on('[data-care]', careSheet);
}

export function petTitle() { return P.hasData() ? P.name() : 'Κατοικίδιο'; }
export function petBadge() { const n = P.schedule().filter((s) => s.st === 'late').length; return n ? `${n} ${n === 1 ? 'εκκρεμεί' : 'εκκρεμούν'}` : ''; }

export default {
  live: true, keepScroll: true,
  html(p) {
    const tab = TABS.some(([k]) => k === p[0]) ? p[0] : 'sum';
    if (!P.hasData()) {
      return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>🐕 Κατοικίδιο</h1></div>
        <div class="card"><b>Βιβλιάριο υγείας</b><div class="small muted" style="margin:6px 0 10px">Επισκέψεις, εμβόλια, βάρος, φάρμακα, περιστατικά και έγγραφα — με αναζήτηση σε όλα. Αν έχεις αρχείο ιστορικού (.json), εισήγαγέ το εδώ· αλλιώς ξεκίνα γράφοντας τα στοιχεία.</div>
        <label class="btn primary" style="width:100%">📥 Εισαγωγή ιστορικού (.json)<input type="file" accept=".json,application/json" data-seed hidden></label>
        <button class="btn" data-prof0 style="width:100%;margin-top:8px">+ Νέο (χωρίς ιστορικό)</button></div>`;
    }
    const add = { docs: ['data-newd', '+ Έγγραφο'], weight: ['data-neww', '+ Ζύγισμα'], vac: ['data-newx', '+ Εμβόλιο'], inc: ['data-newi', '+ Περιστατικό'] }[tab] || ['data-newe', '+ Νέο'];
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>🐕 ${esc(P.name())}</h1><button class="btn sm primary" ${add[0]} style="width:auto">${add[1]}</button></div>
      <div class="h-search"><input data-q value="${esc(q)}" placeholder="Αναζήτηση: ${esc([...P.quick(3), (P.events()[0]?.d || today()).slice(0, 4)].join(', '))}…" autocomplete="off" enterkeyhint="search">${q ? '<button data-qx>✕</button>' : ''}</div>
      <div class="tabs" data-tabs ${q ? 'style="opacity:.5"' : ''}>${TABS.map(([k, l]) => `<button class="${!q && k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div data-body>${q ? search() : ((TOK = []), TAB[tab]())}</div>`;
  },
  mount(root, p, u) {
    ui = u; const tab = TABS.some(([k]) => k === p[0]) ? p[0] : 'sum';
    root.querySelector('[data-back]')?.addEventListener('click', () => (q ? ((q = ''), u.render()) : u.go('#/apps')));
    root.querySelector('[data-seed]')?.addEventListener('change', async (e) => { try { const n = await P.importFile(e.target.files[0]); u.toast(`Φορτώθηκαν ${n} εγγραφές ✓`, 4000); } catch (er) { u.toast(er.message, 4000); } });
    root.querySelector('[data-prof0]')?.addEventListener('click', profSheet);
    const body = root.querySelector('[data-body]'); if (!body) return;
    const inp = root.querySelector('[data-q]');
    let tm; inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => {
      const had = !!q; q = inp.value.trim();
      if (!!q !== had) { const pos = inp.selectionStart; u.render(); const ni = document.querySelector('[data-q]'); ni.focus(); ni.setSelectionRange(pos, pos); return; }
      body.innerHTML = q ? search() : ((TOK = []), TAB[tab]()); bindAll();
    }, 150); });
    root.querySelector('[data-qx]')?.addEventListener('click', () => { q = ''; u.render(); });
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { q = ''; u.go(`#/pet/${b.dataset.tab}`); if (`#/pet/${b.dataset.tab}` === location.hash) u.render(); }));
    root.querySelector('[data-newe]')?.addEventListener('click', () => evSheet());
    root.querySelector('[data-neww]')?.addEventListener('click', () => evSheet(null, 'Ζύγισμα'));
    root.querySelector('[data-newx]')?.addEventListener('click', () => evSheet(null, 'Εμβόλιο'));
    root.querySelector('[data-newi]')?.addEventListener('click', () => evSheet(null, 'Περιστατικό'));
    root.querySelector('[data-newd]')?.addEventListener('click', () => docSheet());
    const bindAll = () => {
      bindBody(body);
      body.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { inp.value = b.dataset.q; inp.dispatchEvent(new Event('input')); }));
      body.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { kindF = b.dataset.kind; u.render(); }));
    };
    bindAll();
  },
};
