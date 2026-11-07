// #/gym — Γυμναστική: προπονήσεις (strength + WOD με αποτέλεσμα) και ρεκόρ, με αναζήτηση σε όλα
import { esc, today, dFull, dShort, monthLabel, norm } from '../util.js';
import * as store from '../store.js';
import * as G from '../gym.js';
import { sheet } from './lessons/ui.js';

let ui = null, q = '';
const nrm = (x) => norm(x).replace(/ς/g, 'σ');
const TABS = [['log', '🏋️ Προπονήσεις'], ['timer', '⏱ Χρονόμετρο'], ['pr', '🏆 Ρεκόρ']];
const first = (s, n = 90) => { const l = String(s || '').split('\n').map((x) => x.trim()).filter(Boolean).join(' · '); return l.length > n ? l.slice(0, n) + '…' : l; };

// ---------- λίστες ----------
const wRow = (w) => `<div class="item" data-w="${esc(w.id)}" style="cursor:pointer;align-items:flex-start">
  <div style="min-width:74px" class="small"><b>${dShort(w.d)}</b></div>
  <div class="grow"><div class="t" style="white-space:normal">${esc(G.head(w))}${G.result(w) ? ` <span style="color:var(--brand)">· ${esc(G.result(w))}</span>` : ''}</div>
  <div class="s" style="white-space:normal">${w.str ? `💪 ${esc(first(w.str, 60))}${w.strRes ? ` → <b>${esc(w.strRes)}</b>` : ''}<br>` : ''}${w.wod ? `⏱ ${esc(first(w.wod))}` : ''}${w.notes ? `<br><span class="muted">📝 ${esc(first(w.notes, 70))}</span>` : ''}</div></div></div>`;
function logBody(list = G.workouts()) {
  if (!list.length) return `<div class="card muted center">${q ? `Δεν βρέθηκε κάτι για «${esc(q)}».` : 'Δεν έχεις γράψει προπόνηση ακόμα. Πάτα «+ Προπόνηση» και γράψε ό,τι λέει ο πίνακας και πώς τα πήγες.'}</div>`;
  const by = new Map(); for (const w of list) { const k = w.d.slice(0, 7); if (!by.has(k)) by.set(k, []); by.get(k).push(w); }
  return [...by].map(([k, l]) => `<h2>${monthLabel(k)} <span class="small muted">(${l.length})</span></h2><div class="list">${l.map(wRow).join('')}</div>`).join('');
}
const pRow = (g) => { const up = g.l.length > 1 && g.best === g.last;
  return `<div class="item" data-pg="${esc(g.k)}" style="cursor:pointer">
  <div class="grow"><div class="t">${esc(G.plabel(g.best))}</div><div class="s">${dFull(g.best.d)}${g.l.length > 1 ? ` · ${g.l.length} φορές${g.best !== g.last ? ` · τελευταία ${esc(G.pval(g.last))}` : ''}` : ''}</div></div>
  <div style="text-align:right"><b style="font-size:17px">${esc(G.pval(g.best))}</b>${up ? '<div class="small" style="color:var(--green)">🏆 πρόσφατο</div>' : ''}</div></div>`; };
function prBody(list = G.groups()) {
  if (!list.length) return `<div class="card muted center">${q ? `Δεν βρέθηκε ρεκόρ για «${esc(q)}».` : 'Εδώ μπαίνουν τα μέγιστα κιλά (1RM, 3RM…), οι χρόνοι στα benchmark (Fran, Murph…) και τα max επαναλήψεων. Πάτα «+ Ρεκόρ».'}</div>`;
  const sec = (t, l) => (l.length ? `<h2>${t}</h2><div class="list">${l.map(pRow).join('')}</div>` : '');
  return sec('Κιλά', list.filter((g) => g.best.kind === 'kg')) + sec('Χρόνοι', list.filter((g) => g.best.kind === 'time')) + sec('Επαναλήψεις', list.filter((g) => g.best.kind === 'reps'));
}
function search() {
  const tok = nrm(q).split(/\s+/).filter(Boolean);
  const hit = (s) => { const x = nrm(s); return tok.every((t) => x.includes(t)); };
  const ws = G.workouts().filter((w) => hit(`${w.title || ''} ${G.fmtName(w.fmt)} ${w.cap || ''} ${w.str || ''} ${w.strRes || ''} ${w.wod || ''} ${G.result(w)} ${w.notes || ''} ${dFull(w.d)} ${monthLabel(w.d.slice(0, 7))}`));
  const ps = G.groups().filter((g) => g.l.some((p) => hit(`${G.plabel(p)} ${G.pval(p)} ${p.n || ''} ${dFull(p.d)}`)));
  if (!ws.length && !ps.length) return `<div class="card muted center">Δεν βρέθηκε κάτι για «${esc(q)}».</div>`;
  return (ps.length ? `<h2>🏆 Ρεκόρ</h2><div class="list">${ps.map(pRow).join('')}</div>` : '') + (ws.length ? logBody(ws) : '');
}

// ---------- προπόνηση ----------
function wSheet(w = null, copy = null) {
  const src = w || copy || {}; const t = today();
  let fmt = src.fmt || 'amrap', rx = src.rx || 'rx'; const R = w || (copy?._res ? copy : null);
  const prs = w ? G.prs().filter((p) => p.w === w.id) : [];
  sheet(`<div class="mid">${w ? 'Προπόνηση' : 'Νέα προπόνηση'}</div>
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Πότε</span><input type="date" name="d" value="${esc(w?.d || t)}"></label>
    <label class="f"><span>Όνομα (προαιρετικά)</span><input name="title" value="${esc(src.title || '')}" placeholder="π.χ. Murph, Hero WOD"></label></div>
    <label class="f"><span>💪 Strength</span><textarea name="str" rows="3" placeholder="π.χ. 4 sets: 6 weighted pull-ups + 16 gorilla rows, 2' rest">${esc(src.str || '')}</textarea></label>
    <label class="f"><span>Πώς πήγε το strength</span><input name="strRes" value="${esc(R?.strRes || '')}" placeholder="π.χ. +12 kg σε όλα τα σετ, 24 kg KB στα rows"></label>
    <div class="card" style="background:var(--chip);box-shadow:none;padding:10px;margin:0 0 12px"><b class="small">🏆 Ρεκόρ από σήμερα (προαιρετικά)</b>
      <div class="grid2" style="margin-top:6px"><label class="f" style="margin:0"><span>Άσκηση</span><input name="pn" list="gymnames" value="${esc(prs[0]?.name || '')}" placeholder="π.χ. Weighted pull-up"></label>
      <div class="grid2" style="gap:6px"><label class="f" style="margin:0"><span>Κιλά</span><input name="pv" inputmode="decimal" value="${esc(prs[0]?.v != null ? String(prs[0].v).replace('.', ',') : '')}"></label>
      <label class="f" style="margin:0"><span>Επαν.</span><input name="pr" inputmode="numeric" value="${esc(prs[0]?.reps || '')}" placeholder="1"></label></div></div>
      <div class="small muted" style="margin-top:4px">Μπαίνει και στα Ρεκόρ. Για χρόνους/benchmark χρησιμοποίησε το «+ Ρεκόρ».</div></div>
    <label class="f"><span>⏱ WOD</span><textarea name="wod" rows="5" placeholder="π.χ. 500 m run · 8 heavy KB swings · 16 toes to ring · 24 cal bike">${esc(src.wod || '')}</textarea></label>
    <div class="grid2"><label class="f"><span>Μορφή</span><select name="fmt">${G.FMT.map(([v, l]) => `<option value="${v}" ${v === fmt ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f"><span>Λεπτά (cap)</span><input name="cap" inputmode="numeric" value="${esc(src.cap || '')}" placeholder="π.χ. 17"></label></div>
    <div data-r-amrap class="grid2"><label class="f"><span>Γύροι</span><input name="rr" inputmode="numeric" value="${esc(R?.rr ?? '')}"></label><label class="f"><span>+ επαναλήψεις</span><input name="rp" inputmode="numeric" value="${esc(R?.rp ?? '')}"></label></div>
    <div data-r-time class="grid2"><label class="f"><span>Χρόνος (λλ:δδ)</span><input name="tm" inputmode="decimal" value="${esc(R?.tm != null ? G.mmss(R.tm) : '')}" placeholder="π.χ. 12:34"></label>
      <label class="row small" style="gap:6px;align-self:end;margin-bottom:14px"><input type="checkbox" name="capped" style="width:auto" ${R?.capped ? 'checked' : ''}> <span>Δεν τελείωσε (cap)</span></label></div>
    <label class="f" data-r-other><span>Αποτέλεσμα</span><input name="rt" value="${esc(R?.rt || '')}" placeholder="π.χ. όλοι οι γύροι, 150 cal συνολικά"></label>
    <label class="f"><span>&nbsp;</span><div class="seg" data-rx><button type="button" data-val="rx" class="${rx === 'rx' ? 'on' : ''}">Rx</button><button type="button" data-val="sc" class="${rx === 'sc' ? 'on' : ''}">Scaled</button></div></label>
    <label class="f"><span>Σημειώσεις</span><textarea name="notes" rows="2" placeholder="π.χ. 24 kg στα swings, 6 MU αντί για toes to ring, κουρασμένος">${esc(R?.notes || '')}</textarea></label>
    <div class="small" style="margin:-4px 2px 10px" data-prev></div>
    <datalist id="gymnames">${G.names().map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <button class="btn primary" data-ok>Αποθήκευση</button>
    ${w ? '<button class="btn" data-copy>↺ Ξανά αυτή την προπόνηση (νέα με σημερινή ημερομηνία)</button><button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}
    <button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const qq = (n) => el.querySelector(`[name=${n}]`);
    const show = () => { fmt = qq('fmt').value; el.querySelector('[data-r-amrap]').hidden = fmt !== 'amrap'; el.querySelector('[data-r-time]').hidden = fmt !== 'time'; el.querySelector('[data-r-other]').hidden = fmt === 'amrap' || fmt === 'time'; };
    const prev = () => { const p = G.same({ id: w?.id, d: qq('d').value || t, title: qq('title').value.trim(), wod: qq('wod').value.trim() })[0];
      el.querySelector('[data-prev]').innerHTML = p ? `↺ Την έκανες και ${dFull(p.d)}${G.result(p) ? `: <b>${esc(G.result(p))}</b>` : ''}` : ''; };
    qq('fmt').addEventListener('change', show); show(); ['title', 'wod', 'd'].forEach((n) => qq(n).addEventListener('change', prev)); prev();
    el.querySelectorAll('[data-rx] button').forEach((b) => b.addEventListener('click', () => { rx = b.dataset.val; el.querySelectorAll('[data-rx] button').forEach((x) => x.classList.toggle('on', x === b)); }));
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-copy]')?.addEventListener('click', () => { close(); wSheet(null, w); });
    el.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await ui.confirm(`Διαγραφή της προπόνησης ${dFull(w.d)};`, 'Διαγραφή'))) return;
      for (const p of prs) await store.del(p._sp, p.id); await store.del(w._sp, w.id); close();
    });
    el.querySelector('[data-ok]').onclick = async () => {
      const num = (n) => { const v = qq(n).value.trim().replace(',', '.'); return v === '' || isNaN(Number(v)) ? null : Number(v); };
      const v = { d: qq('d').value || t, title: qq('title').value.trim() || null, str: qq('str').value.trim() || null, strRes: qq('strRes').value.trim() || null, wod: qq('wod').value.trim() || null,
        fmt, cap: num('cap'), rr: fmt === 'amrap' ? num('rr') : null, rp: fmt === 'amrap' ? num('rp') : null, tm: fmt === 'time' ? G.toSec(qq('tm').value) : null, capped: fmt === 'time' && qq('capped').checked ? 1 : null,
        rt: fmt === 'amrap' || fmt === 'time' ? null : qq('rt').value.trim() || null, rx, notes: qq('notes').value.trim() || null };
      if (!v.str && !v.wod && !v.title) { ui.toast('Γράψε τι έκανες (strength ή WOD)'); return; }
      if (fmt === 'time' && qq('tm').value.trim() && v.tm == null) { ui.toast('Ο χρόνος γράφεται λλ:δδ, π.χ. 12:34'); return; }
      const sp = w?._sp || G.space();
      const id = await store.put(sp, w?.id || null, { type: 'gwod', ...v });
      const wid = w?.id || id;
      // ρεκόρ από το strength
      const pn = qq('pn').value.trim(), pv = num('pv'), pr = Math.max(1, num('pr') || 1); let msg = 'Αποθηκεύτηκε ✓';
      if (pn && pv != null) {
        const pf = { type: 'gpr', name: pn, kind: 'kg', reps: pr, v: pv, d: v.d, w: wid };
        const pid = await store.put(prs[0]?._sp || sp, prs[0]?.id || null, pf);
        const b = G.isBest({ ...pf, id: prs[0]?.id || pid }); if (b === 'pr') msg = `🏆 Νέο ρεκόρ: ${G.plabel(pf)} ${G.pval(pf)}!`;
      } else if (prs[0]) await store.del(prs[0]._sp, prs[0].id);
      // σύγκριση με την προηγούμενη ίδια
      const p = G.same({ ...v, id: wid })[0];
      if (p && msg === 'Αποθηκεύτηκε ✓') { const c = G.better(v, p); if (c > 0) msg = `💪 Καλύτερα από ${dFull(p.d)} (${G.result(p)})`; }
      close(); ui.toast(msg, 4000);
    };
  });
}

// ---------- ρεκόρ ----------
function pSheet(p = null, base = null) {
  const src = p || base || {}; const t = today(); let kind = src.kind || 'kg';
  sheet(`<div class="mid">${p ? 'Ρεκόρ' : 'Νέο ρεκόρ'}</div>
    <label class="f" style="margin-top:10px"><span>Άσκηση ή benchmark</span><input name="name" list="gymnames2" value="${esc(src.name || '')}" placeholder="π.χ. Back squat, Fran, 2 km row"></label>
    <datalist id="gymnames2">${G.names().map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <label class="f"><span>Τι μετράει</span><div class="seg" data-kind>${G.KINDS.map(([v, l]) => `<button type="button" data-val="${v}" class="${v === kind ? 'on' : ''}">${l}</button>`).join('')}</div></label>
    <div class="grid2"><label class="f"><span data-vl></span><input name="v" inputmode="decimal" value="${esc(p ? (p.kind === 'time' ? G.mmss(p.v) : String(p.v).replace('.', ',')) : '')}"></label>
    <label class="f" data-repsf><span>Επαναλήψεις (1 = 1RM)</span><input name="reps" inputmode="numeric" value="${esc(src.reps || 1)}"></label></div>
    <label class="f"><span>Πότε</span><input type="date" name="d" value="${esc(p?.d || t)}"></label>
    <label class="f"><span>Σημείωση</span><input name="n" value="${esc(p?.n || '')}" placeholder="π.χ. Rx, με ζώνη, 20 kg vest"></label>
    <button class="btn primary" data-ok>Αποθήκευση</button>
    ${p ? `${p.w ? '<button class="btn" data-openw>Άνοιγμα προπόνησης</button>' : ''}<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>` : ''}
    <button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const qq = (n) => el.querySelector(`[name=${n}]`);
    const show = () => { el.querySelector('[data-vl]').textContent = kind === 'kg' ? 'Κιλά' : kind === 'time' ? 'Χρόνος (λλ:δδ)' : 'Επαναλήψεις / θερμίδες'; el.querySelector('[data-repsf]').hidden = kind !== 'kg'; };
    el.querySelectorAll('[data-kind] button').forEach((b) => b.addEventListener('click', () => { kind = b.dataset.val; el.querySelectorAll('[data-kind] button').forEach((x) => x.classList.toggle('on', x === b)); show(); })); show();
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-openw]')?.addEventListener('click', () => { const w = G.workouts().find((x) => x.id === p.w); close(); if (w) wSheet(w); });
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (!(await ui.confirm(`Διαγραφή «${G.plabel(p)} ${G.pval(p)}»;`, 'Διαγραφή'))) return; await store.del(p._sp, p.id); close(); });
    el.querySelector('[data-ok]').onclick = async () => {
      const name = qq('name').value.trim(); const raw = qq('v').value.trim();
      const v = kind === 'time' ? G.toSec(raw) : (raw === '' || isNaN(Number(raw.replace(',', '.'))) ? null : Number(raw.replace(',', '.')));
      if (!name) { ui.toast('Γράψε ποια άσκηση'); return; } if (v == null) { ui.toast(kind === 'time' ? 'Ο χρόνος γράφεται λλ:δδ, π.χ. 3:45' : 'Γράψε τον αριθμό'); return; }
      const f = { type: 'gpr', name, kind, reps: kind === 'kg' ? Math.max(1, Number(qq('reps').value) || 1) : null, v, d: qq('d').value || t, n: qq('n').value.trim() || null, ...(p?.w ? { w: p.w } : {}) };
      const id = await store.put(p?._sp || G.space(), p?.id || null, f);
      const b = G.isBest({ ...f, id: p?.id || id }); close();
      ui.toast(b === 'pr' ? `🏆 Νέο ρεκόρ: ${G.plabel(f)} ${G.pval(f)}!` : 'Αποθηκεύτηκε ✓', 4000);
    };
  });
}
function groupSheet(g) {
  sheet(`<div class="mid">${esc(G.plabel(g.best))}</div><div class="small muted">Καλύτερο: <b>${esc(G.pval(g.best))}</b> (${dFull(g.best.d)})</div>
    <div class="list" style="margin:10px 0">${g.l.map((p, i) => { const nx = g.l[i + 1]; const d = nx && p.kind !== 'time' ? p.v - nx.v : nx ? nx.v - p.v : 0;
      return `<div class="item" data-p="${esc(p.id)}" style="cursor:pointer"><div class="grow"><div class="t">${esc(G.pval(p))}${p === g.best ? ' 🏆' : ''}</div><div class="s">${dFull(p.d)}${p.n ? ` · ${esc(p.n)}` : ''}</div></div>
        ${nx && d ? `<div class="small" style="color:${d > 0 ? 'var(--green)' : 'var(--red)'}">${d > 0 ? '▲' : '▼'} ${esc(p.kind === 'time' ? G.mmss(Math.abs(d)) : String(Math.round(Math.abs(d) * 100) / 100).replace('.', ','))}</div>` : ''}</div>`; }).join('')}</div>
    <button class="btn primary" data-add>+ Νέα φορά</button><button class="btn ghost" data-no>Κλείσιμο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-add]').onclick = () => { close(); pSheet(null, { name: g.best.name, kind: g.best.kind, reps: g.best.reps }); };
    el.querySelectorAll('[data-p]').forEach((r) => r.addEventListener('click', () => { const p = g.l.find((x) => x.id === r.dataset.p); close(); pSheet(p); }));
  });
}

// ---------- σελίδα ----------
export default {
  live: true, keepScroll: true,
  html(p) {
    const tab = TABS.some(([k]) => k === p[0]) ? p[0] : 'log';
    const add = tab === 'pr' ? ['data-newp', '+ Ρεκόρ'] : ['data-neww', '+ Προπόνηση'];
    if (tab === 'timer' && !q && T.phase !== 'setup') return `<div data-body>${timerBody()}</div>`;   // τρέχει: μόνο το χρονόμετρο, μεγάλο
    const nw = G.workouts().length;
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>🏋️ Γυμναστική</h1><button class="btn sm primary" ${add[0]} style="width:auto">${add[1]}</button></div>
      ${nw || G.prs().length ? `<div class="h-search"><input data-q value="${esc(q)}" placeholder="Αναζήτηση: άσκηση, WOD, ρεκόρ, μήνας…" autocomplete="off" enterkeyhint="search">${q ? '<button data-qx>✕</button>' : ''}</div>` : ''}
      <div class="tabs" data-tabs ${q ? 'style="opacity:.5"' : ''}>${TABS.map(([k, l]) => `<button class="${!q && k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div data-body>${q ? search() : tab === 'pr' ? prBody() : tab === 'timer' ? timerBody() : logBody()}</div>`;
  },
  mount(root, p, u) {
    ui = u; const tab = TABS.some(([k]) => k === p[0]) ? p[0] : 'log';
    root.querySelector('[data-back]')?.addEventListener('click', () => (q ? ((q = ''), u.render()) : u.go('#/apps')));
    root.querySelector('[data-neww]')?.addEventListener('click', () => wSheet());
    root.querySelector('[data-newp]')?.addEventListener('click', () => pSheet());
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { q = ''; u.go(`#/gym/${b.dataset.tab}`); if (`#/gym/${b.dataset.tab}` === location.hash) u.render(); }));
    const body = root.querySelector('[data-body]');
    const bind = () => {
      body.querySelectorAll('[data-w]').forEach((r) => r.addEventListener('click', () => { const w = G.workouts().find((x) => x.id === r.dataset.w); if (w) wSheet(w); }));
      body.querySelectorAll('[data-pg]').forEach((r) => r.addEventListener('click', () => { const g = G.groups().find((x) => x.k === r.dataset.pg); if (g) groupSheet(g); }));
    };
    const inp = root.querySelector('[data-q]');
    if (inp) {
      let tm; inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => {
        const had = !!q; q = inp.value.trim();
        if (!!q !== had) { const pos = inp.selectionStart; u.render(); const ni = document.querySelector('[data-q]'); ni.focus(); ni.setSelectionRange(pos, pos); return; }
        body.innerHTML = q ? search() : tab === 'pr' ? prBody() : tab === 'timer' ? timerBody() : logBody(); bind();
      }, 150); });
      root.querySelector('[data-qx]')?.addEventListener('click', () => { q = ''; u.render(); });
    }
    bind(); if (tab === 'timer') timerMount(root);
  },
};

// ---------- χρονόμετρο: AMRAP · For time · EMOM · Tabata/διαστήματα · σκέτο ----------
// Η κατάσταση μένει εδώ (όχι στη σελίδα), ώστε να συνεχίζει ό,τι κι αν ξαναζωγραφιστεί· η οθόνη μένει ανοιχτή όσο τρέχει.
const MODES = [['amrap', 'AMRAP'], ['time', 'For time'], ['emom', 'EMOM'], ['tabata', 'Tabata / διαστήματα'], ['stop', 'Χρονόμετρο']];
const T = { mode: 'amrap', min: 12, cap: '', every: 60, nr: 10, work: 20, rest: 10, tr: 8, moves: [''], pre: 10,
  phase: 'setup', t0: 0, paused: 0, pauseAt: 0, rounds: 0, laps: [], last: -1, end: null };
let tick = null, lock = null, actx = null;
const now = () => performance.now();
const el = () => (T.phase === 'setup' ? 0 : ((T.pauseAt || now()) - T.t0 - T.paused) / 1000);   // δευτερόλεπτα από το «πάμε» (αρνητικά = αντίστροφη μέτρηση)
const fmtS = (x) => { x = Math.max(0, Math.ceil(x - 1e-9)); return G.mmss(x); };
const total = () => (T.mode === 'amrap' ? T.min * 60 : T.mode === 'emom' ? T.every * T.nr : T.mode === 'tabata' ? (T.work + T.rest) * T.tr - T.rest : T.mode === 'time' && Number(T.cap) ? Number(T.cap) * 60 : null);
function beep(f = 880, d = 0.15, v = 0.5) {
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = f; o.connect(g); g.connect(actx.destination); g.gain.setValueAtTime(v, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d); o.start(); o.stop(actx.currentTime + d); } catch (_) { /* */ }
}
async function wake(on) {
  try { if (on && !lock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } if (!on && lock) { await lock.release(); lock = null; } } catch (_) { lock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (T.phase === 'run' || T.phase === 'count')) wake(true); });
/** πού βρισκόμαστε: τι δείχνει το μεγάλο ρολόι, ποιο διάστημα, πότε τελειώνει το τρέχον κομμάτι */
function state() {
  const e = el();
  if (e < 0) return { big: fmtS(-e), lab: 'Ετοιμάσου', segEnd: 0, col: '#e9a23b' };
  const tot = total();
  if (tot != null && e >= tot) return { done: true };
  if (T.mode === 'amrap') return { big: fmtS(tot - e), lab: `AMRAP ${T.min}'`, segEnd: tot };
  if (T.mode === 'time') return { big: G.mmss(Math.floor(e)), lab: `For time${tot ? ` · cap ${T.cap}'` : ''}`, segEnd: tot };
  if (T.mode === 'stop') return { big: G.mmss(Math.floor(e)), lab: 'Χρονόμετρο', segEnd: null };
  if (T.mode === 'emom') {
    const r = Math.floor(e / T.every); const mv = T.moves.filter(Boolean); const m = mv.length ? mv[r % mv.length] : ''; const nx = mv.length > 1 ? mv[(r + 1) % mv.length] : '';
    return { big: fmtS((r + 1) * T.every - e), lab: `Γύρος ${r + 1} / ${T.nr}`, mv: m, nx: r + 1 < T.nr ? nx : '', segEnd: (r + 1) * T.every };
  }
  const per = T.work + T.rest; const r = Math.floor(e / per); const inW = e - r * per < T.work;           // tabata
  return { big: fmtS(inW ? r * per + T.work - e : (r + 1) * per - e), lab: `${inW ? 'Δουλειά' : 'Ξεκούραση'} · ${r + 1} / ${T.tr}`, col: inW ? '#2e9d5b' : '#5b8def', segEnd: inW ? r * per + T.work : (r + 1) * per };
}
function finish() {
  T.end = { e: Math.min(el(), total() ?? 1e9) }; T.phase = 'done'; clearInterval(tick); tick = null; wake(false);
  beep(660, 0.25); setTimeout(() => beep(660, 0.25), 300); setTimeout(() => beep(990, 0.6), 600); if (navigator.vibrate) try { navigator.vibrate([200, 100, 200]); } catch (_) { /* */ }
  ui?.render();
}
function loop() {
  if (T.phase !== 'run') return;
  const s = state(); if (s.done) { finish(); return; }
  const e = el();
  // ήχοι: 3-2-1 πριν από κάθε αλλαγή, και ψηλός ήχος στο «πάμε» / σε κάθε νέο διάστημα
  const sec = Math.ceil((s.segEnd != null && e >= 0 ? s.segEnd : 0) - e);
  if (e < 0) { const c = Math.ceil(-e); if (c !== T.last) { T.last = c; if (c <= 3) beep(660); } }
  if (e >= 0 && !T.started) { T.started = 1; beep(1100, 0.4); }
  if (e >= 0 && s.segEnd != null) { const key = `${s.segEnd}|${sec}`; if (key !== T.last) { if (T.lastEnd != null && T.lastEnd !== s.segEnd) beep(1100, 0.35); else if (sec <= 3 && sec >= 1) beep(660); T.last = key; T.lastEnd = s.segEnd; } }
  const box = document.querySelector('[data-tbig]'); if (!box) return;
  box.textContent = s.big; const l = document.querySelector('[data-tlab]'); if (l) l.textContent = s.lab;
  const mv = document.querySelector('[data-tmv]'); if (mv) mv.textContent = s.mv || ''; const nx = document.querySelector('[data-tnx]'); if (nx) nx.textContent = s.nx ? `Μετά: ${s.nx}` : '';
  const sc = document.querySelector('[data-tscreen]'); if (sc) sc.style.background = s.col || '';
  const tot = total(); const bar = document.querySelector('[data-tbar]'); if (bar && tot) bar.style.width = `${Math.min(100, Math.max(0, (e / tot) * 100))}%`;
}
function start() {
  beep(1, 0.01, 0.001);                                            // ξεκλειδώνει τον ήχο (χρειάζεται πάτημα)
  Object.assign(T, { phase: 'run', t0: now() + T.pre * 1000, paused: 0, pauseAt: 0, rounds: 0, laps: [], last: -1, lastEnd: null, started: 0, end: null });
  if (!T.pre) T.t0 = now();
  wake(true); clearInterval(tick); tick = setInterval(loop, 100); ui.render();
}
function reset() { clearInterval(tick); tick = null; T.phase = 'setup'; T.end = null; wake(false); ui.render(); }
function timerBody() {
  if (T.phase === 'setup') {
    const n = (k, l, v, w = '') => `<label class="f" ${w}><span>${l}</span><input data-tset="${k}" inputmode="numeric" value="${esc(v)}"></label>`;
    return `<div class="seg" data-tmode style="margin:4px 0 12px;grid-auto-flow:row;grid-template-columns:1fr 1fr 1fr">${MODES.map(([v, l]) => `<button type="button" data-val="${v}" class="${v === T.mode ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${T.mode === 'amrap' ? `<div class="grid2">${n('min', 'Λεπτά', T.min)}</div><div class="small muted" style="margin:-4px 2px 10px">Αντίστροφη μέτρηση· πατάς «+1 γύρος» σε κάθε γύρο.</div>` : ''}
      ${T.mode === 'time' ? `<div class="grid2">${n('cap', 'Time cap σε λεπτά (κενό = χωρίς)', T.cap)}</div><div class="small muted" style="margin:-4px 2px 10px">Μετράει προς τα πάνω· πατάς «Τέλος» όταν τελειώσεις.</div>` : ''}
      ${T.mode === 'emom' ? `<div class="grid2">${n('every', 'Κάθε (δευτερόλεπτα)', T.every)}${n('nr', 'Γύροι', T.nr)}</div>
        <div class="small muted" style="margin:-4px 2px 6px">Συνολικά ${G.mmss(T.every * T.nr)}. Γράψε τι κάνεις σε κάθε λεπτό — αν βάλεις 3, εναλλάσσονται 1-2-3-1-2-3…</div>
        ${T.moves.map((m, i) => `<div class="row" style="gap:6px;margin-bottom:6px"><b class="small" style="min-width:52px">${i + 1}ο ${T.every === 60 ? 'λεπτό' : 'διάστ.'}</b><input data-tmove="${i}" value="${esc(m)}" placeholder="π.χ. 12 cal row"><button type="button" class="btn sm ghost" data-tmdel="${i}" style="width:auto">✕</button></div>`).join('')}
        <button type="button" class="btn sm" data-tmadd style="margin-bottom:12px">+ Άσκηση για το επόμενο λεπτό</button>` : ''}
      ${T.mode === 'tabata' ? `<div class="grid2">${n('work', 'Δουλειά (δευτ.)', T.work)}${n('rest', 'Ξεκούραση (δευτ.)', T.rest)}${n('tr', 'Γύροι', T.tr)}</div><div class="small muted" style="margin:-4px 2px 10px">Tabata = 20 / 10 × 8. Συνολικά ${G.mmss(total() || 0)}.</div>` : ''}
      <div class="grid2">${n('pre', 'Αντίστροφη πριν το ξεκίνημα (δευτ.)', T.pre)}</div>
      <button class="btn primary" data-tstart style="font-size:20px;padding:16px;width:100%">▶ Ξεκίνα</button>
      <div class="note small" style="margin-top:10px">Η οθόνη μένει ανοιχτή όσο τρέχει. Ήχος 3-2-1 πριν από κάθε αλλαγή — άνοιξε την ένταση.</div>`;
  }
  if (T.phase === 'done') {
    const e = T.end.e; const tot = total();
    const res = T.mode === 'amrap' ? `${T.rounds} ${T.rounds === 1 ? 'γύρος' : 'γύροι'}` : T.mode === 'time' ? `${G.mmss(Math.round(e))}${tot && e >= tot ? ' (cap)' : ''}` : G.mmss(Math.round(e));
    return `<div class="card center" style="padding:24px"><div class="small muted">${esc(MODES.find((m) => m[0] === T.mode)[1])} — τέλος</div><div style="font-size:44px;font-weight:800;margin:8px 0">${esc(res)}</div>
      ${T.laps.length ? `<div class="small muted">Γύροι: ${T.laps.map((x, i) => `${i + 1}) ${G.mmss(Math.round(x))}`).join(' · ')}</div>` : ''}</div>
      ${T.mode !== 'stop' ? '<button class="btn primary" data-tsave>📝 Γράψ\' το στις προπονήσεις</button>' : ''}
      <button class="btn" data-treset>↺ Νέο χρονόμετρο</button>`;
  }
  const s = state(); const paused = !!T.pauseAt;
  return `<div data-tscreen style="border-radius:18px;padding:14px 12px;margin:-4px -4px 0;min-height:70vh;display:flex;flex-direction:column;transition:background .3s;${s.col ? `background:${s.col}` : ''}">
    <div class="row"><div class="grow small" style="font-weight:700" data-tlab>${esc(s.lab || '')}</div><div class="small">${lock ? '🔆' : ''}</div></div>
    ${total() ? '<div style="height:6px;background:rgba(127,127,127,.25);border-radius:9px;margin:8px 0;overflow:hidden"><div data-tbar style="height:100%;width:0;background:currentColor;opacity:.6"></div></div>' : ''}
    <div class="grow" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
      <div data-tbig style="font-size:min(30vw,150px);font-weight:800;font-variant-numeric:tabular-nums;line-height:1">${esc(s.big || '')}</div>
      <div data-tmv style="font-size:26px;font-weight:700;margin-top:12px">${esc(s.mv || '')}</div><div data-tnx class="small" style="opacity:.7;margin-top:4px">${s.nx ? `Μετά: ${esc(s.nx)}` : ''}</div>
      ${T.mode === 'amrap' || T.mode === 'time' || T.mode === 'stop' ? `<div style="font-size:20px;margin-top:14px">${T.mode === 'stop' ? 'Γύροι' : 'Γύροι'}: <b>${T.rounds}</b></div>` : ''}
    </div>
    ${T.mode === 'amrap' || T.mode === 'time' || T.mode === 'stop' ? `<button class="btn primary" data-tround style="font-size:24px;padding:22px;margin-bottom:8px">+1 γύρος</button>` : ''}
    <div class="grid2"><button class="btn" data-tpause style="padding:14px">${paused ? '▶ Συνέχεια' : '⏸ Παύση'}</button><button class="btn" data-tstop style="padding:14px">⏹ Τέλος</button></div>
    ${paused ? '<button class="btn ghost" data-treset style="margin-top:6px">Ακύρωση</button>' : ''}</div>`;
}
function timerMount(root) {
  root.querySelectorAll('[data-tmode] button').forEach((b) => b.addEventListener('click', () => { T.mode = b.dataset.val; ui.render(); }));
  root.querySelectorAll('[data-tset]').forEach((i) => i.addEventListener('change', () => { const v = i.value.trim(); T[i.dataset.tset] = i.dataset.tset === 'cap' ? v : Math.max(i.dataset.tset === 'pre' ? 0 : 1, Number(v) || 0); ui.render(); }));
  root.querySelectorAll('[data-tmove]').forEach((i) => i.addEventListener('input', () => { T.moves[Number(i.dataset.tmove)] = i.value; }));
  root.querySelectorAll('[data-tmdel]').forEach((b) => b.addEventListener('click', () => { T.moves.splice(Number(b.dataset.tmdel), 1); if (!T.moves.length) T.moves = ['']; ui.render(); }));
  root.querySelector('[data-tmadd]')?.addEventListener('click', () => { T.moves.push(''); ui.render(); setTimeout(() => { const l = document.querySelectorAll('[data-tmove]'); l[l.length - 1]?.focus(); }, 0); });
  root.querySelector('[data-tstart]')?.addEventListener('click', start);
  root.querySelector('[data-treset]')?.addEventListener('click', reset);
  root.querySelector('[data-tround]')?.addEventListener('click', () => { if (el() < 0) return; T.rounds++; T.laps.push(el()); beep(990, 0.08); if (navigator.vibrate) try { navigator.vibrate(30); } catch (_) { /* */ } ui.render(); });
  root.querySelector('[data-tpause]')?.addEventListener('click', () => { if (T.pauseAt) { T.paused += now() - T.pauseAt; T.pauseAt = 0; wake(true); } else { T.pauseAt = now(); wake(false); } ui.render(); });
  root.querySelector('[data-tstop]')?.addEventListener('click', () => { if (T.pauseAt) { T.paused += now() - T.pauseAt; T.pauseAt = 0; } finish(); });
  root.querySelector('[data-tsave]')?.addEventListener('click', () => {
    const e = Math.round(T.end.e); const tot = total(); const mv = T.moves.filter(Boolean);
    const pre = { _res: 1, fmt: T.mode === 'tabata' ? 'other' : T.mode, cap: T.mode === 'amrap' ? T.min : T.mode === 'time' && Number(T.cap) ? Number(T.cap) : T.mode === 'emom' ? Math.round(T.every * T.nr / 60) : null,
      rr: T.mode === 'amrap' ? T.rounds : null, tm: T.mode === 'time' ? e : null, capped: T.mode === 'time' && tot && e >= tot ? 1 : null,
      rt: T.mode === 'emom' ? `${T.nr} γύροι` : T.mode === 'tabata' ? `${T.tr} × ${T.work}/${T.rest}` : null,
      wod: T.mode === 'emom' && mv.length ? `EMOM ${G.mmss(T.every * T.nr)} (κάθε ${T.every}"):\n${mv.map((m, i) => `${i + 1}) ${m}`).join('\n')}` : T.mode === 'tabata' ? `Tabata ${T.tr} × ${T.work}"/${T.rest}"` : '' };
    reset(); q = ''; ui.go('#/gym/log'); setTimeout(() => wSheet(null, pre), 50);
  });
  if (T.phase === 'run' && !tick) tick = setInterval(loop, 100);
  if (T.phase === 'run') loop();
}
