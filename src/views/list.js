import { esc, eur, today, monthLabel, dShort, norm } from '../util.js';
import { movements, fx, othSum, SAVE } from '../ledger.js';
import { state } from '../store.js';
import { itemHtml, bindEdit, ICON, created } from './common.js';

let per = 'm', anc = null;     // περίοδος: μέρα / εβδομάδα / μήνας / χρόνος / όλα — και η μέρα που την ορίζει
let q = '', month = null, shown = 150, rng = null, view = 'mine', catF = null, group = 'day';
const openCats = new Set();      // ανοιχτές κατηγορίες στην προβολή «ανά κατηγορία»
window.__listSet = (o) => { if (o.q !== undefined) q = o.q; if (o.month) { month = o.month; per = 'm'; anc = `${o.month}-01`; rng = null; } if (o.from) rng = [o.from, o.to]; if (o.view) view = o.view; catF = o.cat ? { cat: o.cat, kind: o.kind } : null; shown = 150; };
const VIEWS_L = [['mine', 'Τα δικά μου'], ['home', 'Κοινά σπιτιού'], ['phil', 'Φίλιππος'], ['all', 'Όλες']];
const when = (r) => r.md || r.d;            // salaries count in the month they concern

export default {
  live: true, keepScroll: false,
  html([mode]) {
    const t = today();
    if (mode === 'stats') { location.replace('#/stats'); return ''; }
    if (mode === 'shared') view = 'home';
    if (mode === 'philippos') view = 'phil';
    if (!anc) anc = t; if (per === 'm') month = anc.slice(0, 7); else month = month || t.slice(0, 7);
    const pr = (() => {
      if (per === 'd') return [anc, anc];
      if (per === 'w') { const d = new Date(`${anc}T12:00`); const k = (d.getDay() + 6) % 7; const a = new Date(d); a.setDate(d.getDate() - k); const b = new Date(a); b.setDate(a.getDate() + 6); const f = (x) => x.toISOString().slice(0, 10); return [f(a), f(b)]; }
      if (per === 'y') return [`${anc.slice(0, 4)}-01-01`, `${anc.slice(0, 4)}-12-31`];
      if (per === 'all') return ['0000', '9999'];
      return [`${anc.slice(0, 7)}-01`, `${anc.slice(0, 7)}-31`];
    })();
    const DN = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'];
    const fd = (s) => `${s.slice(8)}/${s.slice(5, 7)}`;
    const perLabel = per === 'd' ? `${DN[new Date(`${anc}T12:00`).getDay()]} ${fd(anc)}/${anc.slice(0, 4)}` : per === 'w' ? `${fd(pr[0])} – ${fd(pr[1])}/${pr[1].slice(0, 4)}` : per === 'y' ? anc.slice(0, 4) : per === 'all' ? 'Όλες οι κινήσεις' : monthLabel(anc.slice(0, 7));
    let list = movements().filter((r) => (!r.rec || r.d <= t) && !r.skipped);
    if (q) {
      const n = norm(q);
      list = list.filter((r) => norm(`${r.desc} ${r.cat} ${r.note || ''} ${r.trip || ''} ${r.payer} ${r.for}`).includes(n));
      if (rng) list = list.filter((r) => when(r) >= rng[0] && when(r) <= rng[1]);
    } else if (rng) list = list.filter((r) => when(r) >= rng[0] && when(r) <= rng[1]);
    else list = list.filter((r) => when(r) >= pr[0] && when(r) <= pr[1]);
    const col = state.user === 'Χαρά' ? 'V' : 'U';          // my share, same as the home page
    const mine = (r) => Math.abs(fx(r, '9999-12-31')[col] || 0);
    const O = (r) => fx(r).O;
    const keep = { mine: (r) => r.kind !== 'Μεταφορά' && mine(r) > 0.004, home: (r) => r.kind !== 'Μεταφορά' && O(r) === 'Κοινό', phil: (r) => O(r) === 'Φίλιππος' || r.payer === 'Φίλιππος', all: () => true }[view];
    if (catF) list = list.filter((r) => r.kind === catF.kind && (catF.kind === 'Έξοδο' ? (catF.cat === 'Ταξίδι' ? !!r.trip : !r.trip && r.cat === catF.cat) : r.cat === catF.cat));
    const hidden = list.length; list = list.filter(keep);
    const extra = hidden - list.length;
    const val = (r) => (view === 'mine' ? mine(r) : (r.a || 0) - (view === 'all' ? 0 : othSum(r)));
    list.sort((a, b) => (a.d === b.d ? (created(b) > created(a) ? 1 : -1) : a.d < b.d ? 1 : -1));
    const sum = (k) => list.reduce((s, r) => s + (r.kind === k ? val(r) : 0), 0);
    // όπως η αρχική και τα Στατιστικά: επενδύσεις / αποταμίευση δεν είναι έξοδα (λεφτά στην άκρη) — φαίνονται χωριστά
    const isSave = (r) => r.kind === 'Έξοδο' && SAVE.has(r.cat);
    const exp = list.reduce((s, r) => s + (r.kind === 'Έξοδο' && !isSave(r) ? val(r) : 0), 0), inc = sum('Έσοδο');
    const sav = list.reduce((s, r) => s + (isSave(r) ? val(r) : 0), 0);
    // πληρώθηκαν αυτόν τον μήνα αλλά «αφορούν» άλλον (μισθοί, εξοφλήσεις): φαίνονται, χωρίς να μετράνε εδώ
    const elsewhere = !q && !rng && !catF && per === 'm' ? movements().filter((r) => r.md && !r.skipped && r.d.startsWith(month) && !when(r).startsWith(month) && keep(r)) : [];
    const days = rng ? Math.max(1, Math.round((new Date(`${rng[1] > t ? t : rng[1]}T12:00:00`) - new Date(`${rng[0]}T12:00:00`)) / 864e5) + 1) : 0;
    let html = '', lastD = '';
    for (const r of list.slice(0, shown)) {
      if (r.d !== lastD) { html += `<div class="day">${dShort(r.d)}${q || r.d.slice(0, 7) !== when(r).slice(0, 7) ? ' ' + r.d.slice(0, 4) : ''}</div>`; lastD = r.d; }
      html += itemHtml(r, { today: t, amt: view === 'mine' ? val(r) : null });
    }
    // ανά κατηγορία: έσοδα, έξοδα, στην άκρη, μεταφορές — η κάθε κατηγορία ανοίγει με τις κινήσεις της
    let catHtml = '';
    if (group === 'cat') {
      const G = new Map();
      for (const r of list) {
        const sec = r.kind === 'Έσοδο' ? 0 : r.kind === 'Μεταφορά' ? 3 : isSave(r) ? 2 : 1;
        const name = r.kind === 'Μεταφορά' ? 'Μεταφορές' : r.cat || 'Χωρίς κατηγορία';
        const key = `${sec}|${name}`; const g = G.get(key) || { sec, name, n: 0, s: 0, rs: [] };
        g.n++; g.s += val(r); g.rs.push(r); G.set(key, g);
      }
      const SECS = ['Έσοδα', 'Έξοδα', 'Στην άκρη (επενδύσεις / αποταμίευση)', 'Μεταφορές'];
      for (let sec = 0; sec < 4; sec++) {
        const gs = [...G.values()].filter((g) => g.sec === sec).sort((a, b) => b.s - a.s);
        if (!gs.length) continue;
        catHtml += `<div class="day">${SECS[sec]}</div>` + gs.map((g) => { const key = `${g.sec}|${g.name}`;
          return `<details class="catgrp" data-ck="${esc(key)}" ${openCats.has(key) ? 'open' : ''}><summary class="item"><div class="dot">${ICON[g.name] || (sec === 3 ? '⇄' : '•')}</div>
            <div class="grow t">${esc(g.name)} <span class="cnt">${g.n}</span></div><div class="amt ${sec === 0 ? 'pos' : ''}">${eur(g.s)}</div></summary>
            <div class="list" style="margin:0 0 6px 14px">${g.rs.map((r) => itemHtml(r, { today: t, showDate: true, amt: view === 'mine' ? val(r) : null })).join('')}</div></details>`; }).join('');
      }
    }
    const note = { mine: 'Μόνο ό,τι σε βαραίνει και μόνο το μερίδιό σου (όπως η αρχική)', home: 'Κοινά έξοδα και έσοδα του σπιτιού — ολόκληρα ποσά', phil: 'Κινήσεις του Φιλίππου', all: 'Όλες οι κινήσεις — ολόκληρα ποσά' }[view];
    return `<div class="top"><h1>Κινήσεις</h1></div>
    <input type="search" name="q" placeholder="🔍 Αναζήτηση" value="${esc(q)}" style="margin-bottom:10px">
    ${q ? `<div class="row" style="gap:6px;margin-bottom:8px"><label class="small muted">Από</label><input type="date" data-qf value="${esc(rng && rng[0] > '2000' ? rng[0] : '')}" style="flex:1"><label class="small muted">έως</label><input type="date" data-qt value="${esc(rng && rng[1] < '2100' ? rng[1] : '')}" style="flex:1">${rng ? '<button class="btn sm ghost" data-norng style="width:auto">✕</button>' : ''}</div>` : rng ? `<div class="row" style="gap:6px;margin-bottom:8px"><input type="date" data-qf value="${esc(rng[0] > '2000' ? rng[0] : '')}" style="flex:1"><span class="small muted">έως</span><input type="date" data-qt value="${esc(rng[1] < '2100' ? rng[1] : '')}" style="flex:1"><button class="btn sm ghost" data-norng style="width:auto">✕</button></div>` : `<div class="row" style="margin-bottom:6px"><button class="btn sm ghost" data-m="-1" ${per === 'all' ? 'style="visibility:hidden"' : ''}>◀</button><div class="grow center mid">${perLabel}</div><button class="btn sm ghost" data-m="1" ${per === 'all' ? 'style="visibility:hidden"' : ''}>▶</button></div>
    <div class="chips" style="margin-bottom:8px;justify-content:center">${[['d', 'Μέρα'], ['w', 'Εβδομάδα'], ['m', 'Μήνας'], ['y', 'Χρόνος'], ['all', 'Όλα'], ['rng', 'Διάστημα']].map(([k, l]) => `<button class="chip ${k === per ? 'on' : ''}" data-per="${k}">${l}</button>`).join('')}</div>`}
    ${catF ? `<div class="note row" style="margin-bottom:8px"><span class="grow">${ICON[catF.cat] || '•'} Μόνο <b>${esc(catF.cat)}</b> (${catF.kind === 'Έξοδο' ? 'έξοδα' : 'έσοδα'})${catF.cat === 'Ταξίδι' ? '<br><span class="small muted">Όλα τα έξοδα με ταξίδι, όποια κατηγορία κι αν έχουν — το ταξίδι γράφεται σε κάθε γραμμή</span>' : ''}</span><button class="btn sm ghost" data-nocat>✕</button></div>` : ''}
    <div class="chips" style="margin-bottom:10px">${VIEWS_L.map(([v, l]) => `<button class="chip ${view === v ? 'on' : ''}" data-view="${v}">${l}</button>`).join('')}</div>
    <div class="card grid3 center" style="padding:10px 6px;margin-bottom:8px">
      <div><div class="small muted">Έσοδα</div><b class="pos">${eur(inc)}</b></div>
      <div><div class="small muted">Έξοδα</div><b class="neg">${eur(exp)}</b></div>
      <div><div class="small muted">Διαφορά</div><b class="${inc - exp < 0 ? 'neg' : 'pos'}">${eur(inc - exp)}</b></div></div>
    ${q ? `<div class="small muted" style="margin:0 2px 6px">${list.length} κινήσεις με «${esc(q)}»</div>` : ''}
    ${q && rng && rng[0] > '2000' && days > 6 && (exp || inc) ? `<div class="small" style="margin:-2px 2px 8px">≈ <b>${eur(((exp || inc) / days) * 30.44)}</b> τον μήνα (${days} μέρες)</div>` : ''}
    <div class="chips" style="margin-bottom:8px"><button class="chip ${group === 'day' ? 'on' : ''}" data-group="day">📅 Ανά μέρα</button><button class="chip ${group === 'cat' ? 'on' : ''}" data-group="cat">🏷 Ανά κατηγορία</button></div>
    <div class="list">${(group === 'cat' ? catHtml : html) || '<div class="item muted">Καμία κίνηση</div>'}</div>
    ${elsewhere.length ? `<h2 style="margin-top:14px">Πληρώθηκαν τώρα, μετράνε σε άλλον μήνα</h2><div class="small muted" style="margin:-4px 2px 6px">Δεν είναι στα σύνολα αυτού του μήνα — άλλαξέ το από «Αφορά μήνα» αν είναι λάθος.</div>
      <div class="list" style="opacity:.75">${elsewhere.map((r) => itemHtml(r, { today: t, showDate: true, amt: view === 'mine' ? val(r) : null }).replace('</div></div>', ` <span class="space-tag">→ ${monthLabel(when(r).slice(0, 7))}</span></div></div>`)).join('')}</div>` : ''}
    ${group === 'day' && list.length > shown ? `<div class="center" style="margin-top:10px"><button class="btn sm" data-more>Περισσότερες…</button></div>` : ''}`;
  },
  mount(root, p, ui) {
    const qi = root.querySelector('[name=q]');
    qi?.addEventListener('input', () => { q = qi.value; shown = 150; clearTimeout(qi._t); qi._t = setTimeout(() => { ui.render(); const n = document.querySelector('[name=q]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      const k = Number(b.dataset.m); const d = new Date(`${anc}T12:00`);
      if (per === 'd') d.setDate(d.getDate() + k); else if (per === 'w') d.setDate(d.getDate() + 7 * k); else if (per === 'y') d.setFullYear(d.getFullYear() + k); else { d.setDate(1); d.setMonth(d.getMonth() + k); }
      anc = d.toISOString().slice(0, 10); if (per === 'm') month = anc.slice(0, 7); shown = 150; ui.render();
    }));
    root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; shown = 150; ui.render(); }));
    root.querySelector('[data-nocat]')?.addEventListener('click', () => { catF = null; ui.render(); });
    root.querySelector('[data-norng]')?.addEventListener('click', () => { rng = null; catF = null; ui.render(); });
    const qr = () => { const a = root.querySelector('[data-qf]').value, b = root.querySelector('[data-qt]').value; rng = a || b ? [a || '2000-01-01', b || '2100-12-31'] : null; ui.render(); };
    root.querySelector('[data-qf]')?.addEventListener('change', qr); root.querySelector('[data-qt]')?.addEventListener('change', qr);
    root.querySelectorAll('[data-per]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.per; shown = 150;
      if (k === 'rng') { const t = today(); rng = [`${t.slice(0, 7)}-01`, t]; ui.render(); return; }
      per = k; rng = null; ui.render();
    }));
    root.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => { group = b.dataset.group; ui.render(); }));
    root.querySelectorAll('details[data-ck]').forEach((d) => d.addEventListener('toggle', () => { if (d.open) openCats.add(d.dataset.ck); else openCats.delete(d.dataset.ck); }));
    root.querySelector('[data-more]')?.addEventListener('click', () => { shown += 300; ui.render(); });
    bindEdit(root, ui);
  },
};
