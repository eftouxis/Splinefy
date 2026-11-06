// #/rec — recurring items (πάγια): list, add, change from a date, stop
import { esc, eur, today, addDays, addMonths, dFull, dShort, parseAmount } from '../util.js';
import * as store from '../store.js';
import { categories, recurringMovements } from '../ledger.js';
import { ICON } from './common.js';
import * as FQ from './freq.js';
import { readOth, rowsOth, forHtml, forPick, bindOth } from './othui.js';
import { chain, delAll, delFrom } from '../recops.js';
import { askScope } from './lessons/ui.js';

const FREQ = [['m1', 'Κάθε μήνα', 'm', 1], ['m2', 'Κάθε 2 μήνες', 'm', 2], ['m3', 'Κάθε 3 μήνες', 'm', 3], ['m6', 'Κάθε 6 μήνες', 'm', 6],
  ['m12', 'Κάθε χρόνο', 'm', 12], ['d7', 'Κάθε εβδομάδα', 'd', 7], ['d14', 'Κάθε 2 εβδομάδες', 'd', 14]];
const freqKey = (r) => `${r.unit || 'm'}${r.every || 1}`;
const freqLabel = (r) => { const l = FQ.label(r.unit || 'm', r.every || 1); return l[0].toUpperCase() + l.slice(1); };
const seg = (name, opts, val) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-val="${esc(v)}" class="${v === val ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
const personalSpace = () => store.state.spaces.find((s) => s.owner === store.state.user && s.members.length === 1 && s.members.includes(store.state.user));
/** the last time it happened on or before a day */
function lastDate(r, upto = today()) {
  if (!r.start) return null; let last = null;
  for (let n = 0; n < 2000; n++) { const d = r.unit === 'd' ? addDays(r.start, n * (r.every || 1)) : addMonths(r.start, n * (r.every || 1)); if (d > upto || (r.end && d > r.end)) break; last = d; }
  return last;
}
const stepFrom = (d, fr) => (fr.unit === 'd' ? addDays(d, fr.every) : addMonths(d, fr.every));
function nextDate(r, from = today()) {
  if (!r.start) return null;
  for (let n = 0; n < 2000; n++) {
    const d = r.unit === 'd' ? addDays(r.start, n * (r.every || 1)) : addMonths(r.start, n * (r.every || 1));
    if (r.end && d > r.end) return null;
    if (d >= from) return d;
  }
  return null;
}
const monthly = (r) => (r.kind === 'Έσοδο' ? 0 : ((r.a || 0) - (r.oth || []).reduce((s, o) => s + (o.a != null ? o.a : (o.f || 0) * (r.a || 0)), 0)) * (r.unit === 'd' ? 30.44 / (r.every || 1) : 1 / (r.every || 1)));

const listView = {
  live: true,
  html() {
    const t = today();
    const all = store.records('rec').filter((r) => !(r.start && r.end && r.end < r.start)).sort((a, b) => (nextDate(a) || '9') < (nextDate(b) || '9') ? -1 : 1);
    const act = all.filter((r) => !r.start || nextDate(r)), old = all.filter((r) => r.start && !nextDate(r));
    const mine = act.filter((r) => r._sp !== 'shared' && !r.biz), shared = act.filter((r) => r._sp === 'shared');
    const row = (r) => {
      const nx = nextDate(r);
      return `<div class="item" data-go="#/rec/${esc(r._sp)}/${esc(r.id)}"><div class="dot">${ICON[r.cat] || '📄'}</div>
        <div class="grow"><div class="t">${esc(r.name)}${r.biz ? ' <span class="space-tag">🏢 Γραφείο</span>' : ''}</div>
        <div class="s">${r.start && r.start > t && nx ? 'ξεκινά ' + dFull(r.start) + ' · ' : ''}${freqLabel(r)} · ${r.start ? (nx ? 'επόμενο ' + dShort(nx) : 'τελείωσε') : '<span class="neg">⚠ χωρίς ημερομηνία έναρξης</span>'}${r.for === 'Κοινό' ? ' · κοινό ½' : ''}${r.oth ? ' · μοιράζεται' : ''}${r.end && r.end >= t ? ' · έως ' + dFull(r.end) : ''}</div></div>
        <div class="amt ${r.kind === 'Έσοδο' ? 'pos' : ''}">${eur(r.a)}</div></div>`;
    };
    const sum = (l) => l.filter((r) => !r.start || r.start <= addMonths(t, 1)).reduce((s, r) => s + monthly(r) * (r.for === 'Κοινό' ? 0.5 : 1), 0);
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Επαναλαμβανόμενα</h1><a class="btn sm primary" href="#/rec/new">+ Νέο</a></div>
    <div class="card small muted">Μπαίνουν μόνα τους την ημέρα τους (σαν να τα γράφεις εσύ). Για μία φορά διαφορετικό ποσό ή «δεν έγινε»: πάτα την κίνηση στην αρχική. Εδώ αλλάζεις μόνιμα.
      <div style="margin-top:6px">Περίπου <b>${eur(sum(act))}</b> τον μήνα (το δικό σου μερίδιο).</div></div>
    ${shared.length ? `<h2>Κοινά (τα βλέπει και η Χαρά)</h2><div class="list">${shared.map(row).join('')}</div>` : ''}
    ${mine.length ? `<h2>Προσωπικά</h2><div class="list">${mine.map(row).join('')}</div>` : ''}
    ${old.length ? `<details class="more" style="margin-top:10px"><summary>Σταματημένα (${old.length}) ▾</summary><div class="list">${old.map(row).join('')}</div></details>` : ''}`;
  },
  mount(root, p, ui) {
    root.querySelector('[data-back]').addEventListener('click', () => ui.go('#/settings'));
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
  },
};

let f = null;
const formView = {
  html([sp, id]) {
    const me = store.state.user; const t = today();
    const cur = id ? store.state.data[sp]?.recs.get(id) : null;
    const key = id ? `${sp}/${id}` : 'new';
    if (!f || f.key !== key) {
      f = cur ? { ...cur, withOth: cur.oth && cur.oth.length ? 1 : 0, key, sp, a: String(cur.a ?? '').replace('.', ','), ...FQ.fromRec(cur.unit, cur.every), from: t }
        : { key, kind: 'Έξοδο', name: '', a: '', cat: 'Πάγια έξοδα', payer: me, for: 'Κοινό', fq: 'm1', start: t, end: '' };
    }
    if (id && !cur) return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Δεν βρέθηκε</h1></div>`;
    const past = cur && cur.start && cur.start < t;
    const upcoming = cur ? recurringMovements(addMonths(t, 13), 'all').filter((m) => m.rec === cur.id && m.d >= t).slice(0, 4) : [];
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>${cur ? esc(cur.name) : 'Νέο επαναλαμβανόμενο'}</h1></div>
    ${seg('kind', [['Έξοδο', 'Έξοδο'], ['Έσοδο', 'Έσοδο']], f.kind)}
    <div class="card" style="margin-top:10px">
      <label class="f"><span>Όνομα</span><input name="name" value="${esc(f.name)}" placeholder="π.χ. Netflix, Ενοίκιο"></label>
      <div class="grid2"><label class="f"><span>Ποσό</span><input name="a" inputmode="decimal" value="${esc(f.a)}"></label>
      <label class="f"><span>Κατηγορία</span><select name="cat">${categories(f.kind).map((c) => `<option ${c === f.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div>
      <label class="f"><span>Κάθε πότε</span>${FQ.freqHtml('fq', f)}</label>
      <label class="f"><span>${f.kind === 'Έσοδο' ? 'Τα παίρνει' : 'Πληρώνει'}</span>${seg('payer', [['Άλκης', 'Άλκης'], ['Χαρά', 'Χαρά']], f.payer)}</label>
      ${f.kind === 'Έξοδο' ? forHtml(f, seg)
        : `<label class="f"><span>Για ποιον</span>${seg('for', [['', 'Μόνο γι’ αυτόν/ή'], ['Κοινό', 'Κοινό ½'], ['Φίλιππος', 'Φίλιππος']], f.for || '')}</label>`}
      ${f.kind === 'Έξοδο' && f.for === 'Χαρά' && !f.withOth ? `<label class="row small" style="margin:-4px 2px 10px"><input type="checkbox" name="ofc" style="width:auto" ${f.ofc && f.ofc !== 'false' ? 'checked' : ''}> 🏢 Έξοδο του γραφείου της Χαράς</label>
        ${f.payer && f.payer !== 'Χαρά' && f.payer !== 'Και οι 2' ? `<label class="row small" style="margin:-6px 2px 10px 26px"><input type="checkbox" name="ooff" style="width:auto" ${f.ooff && f.ooff !== 'false' ? 'checked' : ''}> …και το χρωστάει το γραφείο (όχι η Χαρά)</label>` : ''}` : ''}
      ${f.kind === 'Έσοδο' ? `<label class="f"><span>Φόρος στην εκκαθάριση (%) — π.χ. ενοίκιο</span><input name="taxS" inputmode="decimal" value="${esc(f.taxS ?? (f.tax ? String(Math.round(f.tax * 10000) / 100).replace('.', ',') : ''))}" placeholder="άδειο = κανένας"></label>
        <div class="small muted" style="margin:-6px 2px 10px">Με φόρο: στα έσοδα μπαίνει μόνο το καθαρό· ο φόρος μαζεύεται στις Οφειλές → «Εφορία» μέχρι να πληρωθεί στην εκκαθάριση.</div>` : ''}
      ${cur ? '' : `<label class="f"><span>Ημερομηνία (πρώτη φορά)</span><input type="date" name="start" value="${esc(f.start || '')}"></label>`}

      ${upcoming.length ? `<div class="small muted" style="margin-top:8px">Επόμενες — πάτα μία για να αλλάξεις μέρα ή ποσό:</div>
        <div class="chips" style="margin-top:6px">${upcoming.filter((m) => !m.skipped).map((m) => `<a class="chip" href="#/edit/${esc(m._sp)}/${esc(m.id)}">${dShort(m.d)}${m.a !== cur.a ? ' · ' + eur(m.a) : ''}</a>`).join('')}</div>` : ''}
    </div>
    <button class="btn primary" style="width:100%" data-save>${cur ? 'Αποθήκευση' : 'Προσθήκη'}</button>
    ${cur ? `<button class="btn" style="width:100%;margin-top:8px;color:var(--red)" data-del>Διαγραφή</button>` : ''}`;
  },
  mount(root, [sp, id], ui) {
    const read = () => {
      root.querySelectorAll('input[name],select[name]').forEach((el) => { if (el.name !== 'othp' && el.name !== 'otha') f[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
      if (root.querySelector('[data-othrow]')) f.oth = rowsOth(root);
    };
    bindOth(root, f, read, () => ui.render());
    root.querySelector('[data-back]').addEventListener('click', () => { f = null; ui.go('#/rec'); });
    root.querySelectorAll('[data-seg]').forEach((sg) => sg.addEventListener('click', (e) => {
      const v = e.target.dataset.val; if (v === undefined) return; read();
      if (sg.dataset.seg === 'forx') forPick(f, v, store.state.user); else f[sg.dataset.seg] = v;
      if (sg.dataset.seg === 'kind') { f.cat = categories(v)[0] || ''; f.for = v === 'Έσοδο' ? '' : 'Κοινό'; }
      ui.render();
    }));
    root.querySelector('[data-freq]')?.addEventListener('change', () => { read(); f.cn = f.fqn; f.cu = f.fqu; ui.render(); });
    root.querySelector('[name=fqn]')?.addEventListener('input', (e) => { f.cn = e.target.value; });
    root.querySelector('[name=fqn]')?.addEventListener('change', () => { read(); f.cn = f.fqn; ui.render(); });
    root.querySelector('[name=fqu]')?.addEventListener('change', (e) => { read(); f.cu = e.target.value; ui.render(); });
    if (!id) setTimeout(() => root.querySelector('[name=name]')?.focus(), 50);
    const cur = id ? store.state.data[sp].recs.get(id) : null;
    root.querySelector('[data-save]')?.addEventListener('click', async () => {
      read();
      const a = parseAmount(f.a); if (!f.name.trim() || a == null) { ui.toast('Όνομα και ποσό'); return; }
      const fr = FQ.toRec({ fq: f.fq, cn: f.fqn, cu: f.fqu }); if (!fr) { ui.toast('Γράψε κάθε πόσο'); return; }
      const { unit, every } = fr;
      const rec = { type: 'rec', name: f.name.trim(), a, cat: f.cat, kind: f.kind, payer: f.payer, for: f.kind === 'Έσοδο' ? f.for || '' : f.for, unit, every, start: f.start || cur?.start || null, end: f.end || null, oth: f.kind === 'Έξοδο' && f.withOth ? readOth(root) : null, biz: cur?.biz || null, salary: cur?.salary || null, ofc: f.kind === 'Έξοδο' && f.for === 'Χαρά' && f.ofc && f.ofc !== 'false' ? 1 : null };
      { const tv = parseAmount(String(f.taxS ?? (f.tax ? f.tax * 100 : '')).replace('%', '')); rec.tax = f.kind === 'Έσοδο' && tv ? tv / 100 : null; }
      if (rec.tax && !store.records('person').some((p) => p.tax)) await store.put('shared', null, { type: 'person', name: 'Εφορία (φόρος ενοικίων)', tax: 1, note: 'ο φόρος που μαζεύεται για την εκκαθάριση' });
      rec.ooff = rec.ofc && f.payer !== 'Χαρά' && f.payer !== 'Και οι 2' && f.ooff && f.ooff !== 'false' ? 1 : null;
      const personal = personalSpace();
      const target = personal && f.payer === store.state.user && (rec.for === store.state.user || (f.kind === 'Έσοδο' && !rec.for)) ? personal.id : 'shared';
      if (!cur) { await store.put(target, null, rec); f = null; ui.toast('Προστέθηκε ✓'); ui.go('#/rec'); return; }
      const money = ['a', 'payer', 'for', 'unit', 'every', 'kind', 'ofc', 'ooff', 'tax'].some((k) => String(cur[k] ?? '') !== String(rec[k] ?? '')) || JSON.stringify(cur.oth || null) !== JSON.stringify(rec.oth || null);
      const freqCh = unit !== (cur.unit || 'm') || Number(every) !== Number(cur.every || 1);
      const nx = nextDate(cur, today());
      // the same question as everywhere: «this time» = the next time
      const ans = !money ? 'all' : !nx ? 'all' : await askScope('Αποθήκευση αλλαγής', esc(cur.name), { one: '', fwd: `Από την επόμενη (${dShort(nx)}) και πέρα` });
      if (!ans) return;
      if (ans === 'fwd' && cur.start < nx) {          // the earlier times stay: the old part ends the day before, the new one starts at the next time
        await store.put(sp, cur.id, { end: addDays(nx, -1) });
        await store.put(target, null, { ...rec, start: nx, end: null });
      } else {                                            // all (also the past), or nothing happened yet
        if (target !== sp) await store.move(sp, target, { ...cur, ...rec }); else await store.put(sp, cur.id, rec);
        if (ans === 'all') for (const p of chain(cur)) if (p.id !== cur.id) await store.put(p._sp, p.id, { a: rec.a, payer: rec.payer, for: rec.for, oth: rec.oth, ofc: rec.ofc, ooff: rec.ooff, tax: rec.tax, unit, every });
      }
      // name / category are labels: give them to the earlier and later parts of the same item too (parts made by «from a date» changes)
      if (cur.cat !== rec.cat || cur.name !== rec.name) {
        for (const p of chain(cur)) if (p.id !== cur.id && (p.cat !== rec.cat || p.name !== rec.name)) await store.put(p._sp, p.id, { cat: rec.cat, name: rec.name });
      }
      f = null; ui.toast('Αποθηκεύτηκε ✓'); ui.go('#/rec');
    });
    root.querySelector('[data-del]')?.addEventListener('click', async () => {
      const nx = nextDate(cur, today());
      const ans = await askScope('Διαγραφή', esc(cur.name), { one: '', fwd: nx ? `Από την επόμενη (${dShort(nx)}) και πέρα` : '', del: true });
      if (!ans) return;
      if (ans === 'fwd') await delFrom(cur, nx); else await delAll(cur);
      f = null; ui.toast(ans === 'fwd' ? 'Σταμάτησε ✓ — οι παλιές φορές μένουν' : 'Διαγράφηκε'); ui.go('#/rec');
    });
  },
};
export default {
  live: true,
  html(p, ui) { return (p[0] ? formView : listView).html(p[0] === 'new' ? [] : p, ui); },
  mount(root, p, ui) { (p[0] ? formView : listView).mount(root, p[0] === 'new' ? [] : p, ui); },
};
