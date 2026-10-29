// #/rec — recurring items (πάγια): list, add, change from a date, stop
import { esc, eur, today, addDays, addMonths, dFull, dShort, parseAmount } from '../util.js';
import * as store from '../store.js';
import { categories, recurringMovements } from '../ledger.js';
import { ICON } from './common.js';
import * as FQ from './freq.js';
import { othHtml, readOth } from './othui.js';

const FREQ = [['m1', 'Κάθε μήνα', 'm', 1], ['m2', 'Κάθε 2 μήνες', 'm', 2], ['m3', 'Κάθε 3 μήνες', 'm', 3], ['m6', 'Κάθε 6 μήνες', 'm', 6],
  ['m12', 'Κάθε χρόνο', 'm', 12], ['d7', 'Κάθε εβδομάδα', 'd', 7], ['d14', 'Κάθε 2 εβδομάδες', 'd', 14]];
const freqKey = (r) => `${r.unit || 'm'}${r.every || 1}`;
const freqLabel = (r) => { const l = FQ.label(r.unit || 'm', r.every || 1); return l[0].toUpperCase() + l.slice(1); };
/** parts of one recurring item: same kind, one ends the day before the next one starts */
function chain(d) {
  const all = store.records('rec').filter((x) => x.kind === d.kind && x.start);
  const out = [d]; let a = d, b = d;
  for (let i = 0; i < 50; i++) { const p = all.find((x) => x.end && x.end < a.start && x.end >= addDays(a.start, -45) && !out.includes(x) && (x.name === a.name || x.a === a.a) && x.unit === a.unit && x.every === a.every); if (!p) break; out.push(p); a = p; }
  for (let i = 0; i < 50; i++) { if (!b.end) break; const n = all.find((x) => x.start > b.end && x.start <= addDays(b.end, 45) && !out.includes(x) && (x.name === b.name || x.a === b.a) && x.unit === b.unit && x.every === b.every); if (!n) break; out.push(n); b = n; }
  return out;
}
const seg = (name, opts, val) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-val="${esc(v)}" class="${v === val ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
const personalSpace = () => store.state.spaces.find((s) => s.owner === store.state.user && s.members.length === 1 && s.members.includes(store.state.user));
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
    const mine = act.filter((r) => r._sp !== 'shared'), shared = act.filter((r) => r._sp === 'shared');
    const row = (r) => {
      const nx = nextDate(r);
      return `<div class="item" data-go="#/rec/${esc(r._sp)}/${esc(r.id)}"><div class="dot">${ICON[r.cat] || '📄'}</div>
        <div class="grow"><div class="t">${esc(r.name)}</div>
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
      f = cur ? { ...cur, key, sp, a: String(cur.a ?? '').replace('.', ','), ...FQ.fromRec(cur.unit, cur.every), from: t }
        : { key, kind: 'Έξοδο', name: '', a: '', cat: 'Πάγια έξοδα', payer: me, for: 'Κοινό', fq: 'm1', start: t, end: '' };
    }
    if (id && !cur) return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Δεν βρέθηκε</h1></div>`;
    const past = cur && cur.start && cur.start < t;
    const upcoming = cur ? recurringMovements(addMonths(t, 13)).filter((m) => m.rec === cur.id && m.d >= t).slice(0, 4) : [];
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>${cur ? esc(cur.name) : 'Νέο επαναλαμβανόμενο'}</h1></div>
    ${seg('kind', [['Έξοδο', 'Έξοδο'], ['Έσοδο', 'Έσοδο']], f.kind)}
    <div class="card" style="margin-top:10px">
      <label class="f"><span>Όνομα</span><input name="name" value="${esc(f.name)}" placeholder="π.χ. Netflix, Ενοίκιο"></label>
      <div class="grid2"><label class="f"><span>Ποσό</span><input name="a" inputmode="decimal" value="${esc(f.a)}"></label>
      <label class="f"><span>Κατηγορία</span><select name="cat">${categories(f.kind).map((c) => `<option ${c === f.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div>
      <label class="f"><span>Κάθε πότε</span>${FQ.freqHtml('fq', f)}</label>
      <label class="f"><span>${f.kind === 'Έσοδο' ? 'Τα παίρνει' : 'Πληρώνει'}</span>${seg('payer', [['Άλκης', 'Άλκης'], ['Χαρά', 'Χαρά']], f.payer)}</label>
      ${f.kind === 'Έξοδο' ? `<label class="f"><span>Για ποιον</span>${seg('for', [['Κοινό', 'Κοινό ½'], ['Άλκης', 'Άλκης'], ['Χαρά', 'Χαρά'], ['Φίλιππος', 'Φίλιππος']], f.for)}</label>`
        : `<label class="f"><span>Για ποιον</span>${seg('for', [['', 'Μόνο γι’ αυτόν/ή'], ['Κοινό', 'Κοινό ½'], ['Φίλιππος', 'Φίλιππος']], f.for || '')}</label>`}
      ${f.kind === 'Έξοδο' ? `<div class="small" style="font-weight:700;margin:4px 2px 6px">Μέρος το πληρώνουν άλλοι (αδερφή, φίλοι…) — προαιρετικά</div>${othHtml(f.oth)}` : ''}
      <div class="grid2"><label class="f"><span>${past ? 'Πρώτη φορά (μην το αλλάζεις)' : 'Πρώτη φορά'}</span><input type="date" name="start" value="${esc(f.start || '')}"></label>
      <label class="f"><span>Τελευταία φορά (κενό = συνεχίζει)</span><input type="date" name="end" value="${esc(f.end || '')}"></label></div>
      ${past ? `<label class="f"><span>Οι αλλαγές σε ποσό / συχνότητα / ποιος πληρώνει ισχύουν από</span><input type="date" name="from" value="${esc(f.from)}"></label>
        <div class="note small">Οι προηγούμενες φορές μένουν όπως ήταν.</div>` : ''}
      ${upcoming.length ? `<div class="small muted" style="margin-top:8px">Επόμενες: ${upcoming.map((m) => `${dShort(m.d)}${m.a !== cur.a ? ' (' + eur(m.a) + ')' : ''}${m.skipped ? ' ✗' : ''}`).join(' · ')}</div>` : ''}
    </div>
    <button class="btn primary" style="width:100%" data-save>${cur ? 'Αποθήκευση' : 'Προσθήκη'}</button>
    ${cur ? `<button class="btn" style="width:100%;margin-top:8px" data-stop>Σταματάει (τελευταία φορά η προηγούμενη)</button>
      <button class="btn" style="width:100%;margin-top:8px;color:var(--red)" data-del>Διαγραφή (σβήνει και όλες τις παλιές φορές)</button>` : ''}`;
  },
  mount(root, [sp, id], ui) {
    const read = () => {
      root.querySelectorAll('input[name],select[name]').forEach((el) => { if (el.name !== 'othp' && el.name !== 'otha') f[el.name] = el.value; });
      if (root.querySelector('[data-othrow]')) f.oth = readOth(root) || [];
    };
    root.querySelector('[data-othadd]')?.addEventListener('click', () => { read(); f.oth = [...(f.oth || []), { p: '', f: 0.5 }]; ui.render(); });
    root.querySelector('[data-back]').addEventListener('click', () => { f = null; ui.go('#/rec'); });
    root.querySelectorAll('[data-seg]').forEach((sg) => sg.addEventListener('click', (e) => {
      const v = e.target.dataset.val; if (v === undefined) return; read(); f[sg.dataset.seg] = v;
      if (sg.dataset.seg === 'kind') { f.cat = categories(v)[0] || ''; f.for = v === 'Έσοδο' ? '' : 'Κοινό'; }
      ui.render();
    }));
    root.querySelector('[data-freq]')?.addEventListener('change', () => { read(); f.cn = f.fqn; f.cu = f.fqu; ui.render(); });
    root.querySelector('[name=fqn]')?.addEventListener('input', (e) => { f.cn = e.target.value; });
    root.querySelector('[name=fqu]')?.addEventListener('change', (e) => { f.cu = e.target.value; });
    if (!id) setTimeout(() => root.querySelector('[name=name]')?.focus(), 50);
    const cur = id ? store.state.data[sp].recs.get(id) : null;
    root.querySelector('[data-save]')?.addEventListener('click', async () => {
      read();
      const a = parseAmount(f.a); if (!f.name.trim() || a == null) { ui.toast('Όνομα και ποσό'); return; }
      const fr = FQ.toRec({ fq: f.fq, cn: f.fqn, cu: f.fqu }); if (!fr) { ui.toast('Γράψε κάθε πόσο'); return; }
      const { unit, every } = fr;
      const rec = { type: 'rec', name: f.name.trim(), a, cat: f.cat, kind: f.kind, payer: f.payer, for: f.kind === 'Έσοδο' ? f.for || '' : f.for, unit, every, start: f.start || null, end: f.end || null, oth: f.kind === 'Έξοδο' && f.oth && f.oth.length ? f.oth : null };
      const personal = personalSpace();
      const target = personal && f.payer === store.state.user && (rec.for === store.state.user || (f.kind === 'Έσοδο' && !rec.for)) ? personal.id : 'shared';
      if (!cur) { await store.put(target, null, rec); f = null; ui.toast('Προστέθηκε ✓'); ui.go('#/rec'); return; }
      const money = ['a', 'payer', 'for', 'unit', 'every', 'kind'].some((k) => String(cur[k] ?? '') !== String(rec[k] ?? '')) || JSON.stringify(cur.oth || null) !== JSON.stringify(rec.oth || null);
      const from = f.from || today();
      if (cur.start && cur.start < from && money) {
        // keep the past: old one ends the day before, the new one starts at the next occurrence on/after «from»
        const nx = nextDate({ ...cur, unit, every }, from) || from;
        await store.put(sp, cur.id, { end: addDays(nx, -1) });
        await store.put(target, null, { ...rec, start: nx, end: rec.end && rec.end >= nx ? rec.end : null });
      } else if (target !== sp) {
        await store.move(sp, target, { ...cur, ...rec });
      } else await store.put(sp, cur.id, rec);
      // name / category are labels: give them to the earlier and later parts of the same item too (parts made by «from a date» changes)
      if (cur.cat !== rec.cat || cur.name !== rec.name) {
        for (const p of chain(cur)) if (p.id !== cur.id && (p.cat !== rec.cat || p.name !== rec.name)) await store.put(p._sp, p.id, { cat: rec.cat, name: rec.name });
      }
      f = null; ui.toast('Αποθηκεύτηκε ✓'); ui.go('#/rec');
    });
    root.querySelector('[data-stop]')?.addEventListener('click', async () => {
      read(); const from = f.from || today();
      if (!(await ui.confirm(`Σταματάει από ${dFull(from)}; (οι προηγούμενες φορές μένουν)`, 'Σταματάει', false))) return;
      await store.put(sp, cur.id, { end: addDays(from, -1) }); f = null; ui.toast('Σταμάτησε ✓'); ui.go('#/rec');
    });
    root.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await ui.confirm('Θα σβηστεί και από τις παλιές κινήσεις. Αν απλώς σταμάτησε, πάτα «Σταματάει». Διαγραφή;', 'Διαγραφή'))) return;
      await store.del(sp, cur.id); f = null; ui.toast('Διαγράφηκε'); ui.go('#/rec');
    });
  },
};
export default {
  live: true,
  html(p, ui) { return (p[0] ? formView : listView).html(p[0] === 'new' ? [] : p, ui); },
  mount(root, p, ui) { (p[0] ? formView : listView).mount(root, p[0] === 'new' ? [] : p, ui); },
};
