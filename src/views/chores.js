// #/chores — Εργασίες: what repeats and when it is due (overdue / soon / later), ☐ = done today
import { esc, today, dFull, dShort, monthLabel, norm } from '../util.js';
import * as store from '../store.js';
import * as C from '../chores.js';
import { sheet } from './lessons/ui.js';

// κοινή (στον κοινό χώρο, τη βλέπουν όλοι του) ή προσωπική (στον δικό μου χώρο — δεν φτάνει καν στη συσκευή του άλλου)
const isMine = (c) => c._sp !== 'shared';
let showF = '';
let tab = 'due', hq = '', hOne = null;            // καρτέλα · αναζήτηση στο ιστορικό · μία εργασία μόνο                                    // '' όλες · 'shared' κοινές · 'mine' προσωπικές
const ago = (n) => (n === 0 ? 'σήμερα' : n === 1 ? 'αύριο' : n === -1 ? 'χθες' : n > 0 ? `σε ${n} μέρες` : `πριν ${-n} μέρες`);
const row = (c) => {
  const n = C.daysTo(c.due);
  return `<div class="sw" data-sw="${esc(c.id)}"><div class="sw-bg"><span>⏭ Προσπέραση</span><span>✓ Έγινε</span></div><div class="item" data-chore="${esc(c.id)}" style="cursor:pointer">
    <button type="button" class="btn sm ghost" data-tick="${esc(c.id)}" title="Έγινε σήμερα" style="width:auto;font-size:22px;padding:2px 8px">☐</button>
    <div class="grow"><div class="t" style="white-space:normal">${esc(c.name)}${(c.mailTo || []).includes(store.state.user) ? ` <span class="small">${c.ch === 'cal' ? '🔔' : '📧'}</span>` : ''}</div>
      <div class="s" style="white-space:normal"><span class="${n < 0 ? 'neg' : n === 0 ? 'neg' : ''}">Λήγει: ${dFull(c.due)} (${ago(n)})</span><br>${c.last ? `Τελευταία: ${dFull(c.last)} (${ago(C.daysTo(c.last))})` : 'Δεν έχει γίνει ακόμα'} · ${C.everyTxt(c)}${c.notes ? `<br><span class="muted">📝 ${esc(c.notes.split('\n')[0].slice(0, 80))}${c.notes.length > 80 || c.notes.includes('\n') ? '…' : ''}</span>` : ''}</div></div>
    <div class="small muted" style="text-align:right">${C.mySpace() ? `<div title="${isMine(c) ? 'Προσωπική — μόνο εσύ' : 'Κοινή'}">${isMine(c) ? '👤' : '👥'}</div>` : ''}${c.grp ? esc(c.grp) : ''}</div></div></div>`;
};
export function choresCard() {                    // home: what is due (overdue + today)
  const l = C.dueNow(); if (!l.length) return '';
  return `<div class="card" style="border-left:4px solid var(--red)"><div class="row"><b class="grow">✅ Εργασίες για τώρα</b><a class="small" href="#/chores" style="color:var(--brand);text-decoration:none;font-weight:600">όλες ›</a></div>
    ${l.slice(0, 6).map((c) => { const old = C.daysTo(c.due) < -30;           // very late: stronger
      return `<div class="row small" style="margin-top:6px"><span class="grow" data-chopen="${esc(c.id)}" style="cursor:pointer">${old ? '<b>' : ''}${esc(c.name)}${old ? '</b>' : ''} <span class="neg">· ${old ? '<b>' : ''}${ago(C.daysTo(c.due))}${old ? '</b>' : ''}</span></span><button class="btn sm" data-tick="${esc(c.id)}" style="width:auto">✓ Έγινε</button></div>`; }).join('')}
    ${l.length > 6 ? `<div class="small muted" style="margin-top:6px">και ${l.length - 6} ακόμα</div>` : ''}</div>`;
}
export function bindTicks(root, ui) {
  root.querySelectorAll('[data-chopen]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const c = C.all().find((x) => x.id === b.dataset.chopen); if (c) choreSheet(ui, c); }));
  root.querySelectorAll('[data-tick]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation(); const c = C.all().find((x) => x.id === b.dataset.tick); if (!c) return;
    await C.done(c); ui.toast(`✓ ${c.name} — επόμενη ${dFull(C.due({ ...c, last: today(), next: null }))}`, 5000, { label: 'Αναίρεση', fn: () => C.undo(store.records('chore').find((x) => x.id === c.id)) });
  }));
}
/** σύρσιμο: ← αριστερά = έγινε σήμερα · δεξιά → = προσπέραση αυτής της φοράς (με «Αναίρεση») */
export function bindSwipe(root, ui) {
  root.querySelectorAll('[data-sw]').forEach((el) => {
    const row = el.querySelector('.item'); let x0 = null, y0 = 0, dx = 0, drag = false, swiped = false;
    const thr = () => Math.min(110, el.offsetWidth * 0.3);
    const reset = () => { row.style.transition = 'transform .2s'; row.style.transform = ''; el.classList.remove('l', 'r', 'go'); };
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; x0 = e.clientX; y0 = e.clientY; dx = 0; drag = false; row.style.transition = 'none'; });
    el.addEventListener('pointermove', (e) => {
      if (x0 == null) return; const mx = e.clientX - x0, my = e.clientY - y0;
      if (!drag) { if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { x0 = null; return; } if (Math.abs(mx) < 12) return; drag = true; try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ } }
      dx = mx; row.style.transform = `translateX(${dx}px)`; el.classList.toggle('l', dx < 0); el.classList.toggle('r', dx > 0); el.classList.toggle('go', Math.abs(dx) > thr());
    });
    const end = async () => {
      if (x0 == null) return; x0 = null; if (!drag) return; swiped = true; setTimeout(() => { swiped = false; }, 350);
      if (Math.abs(dx) <= thr()) { reset(); return; }
      const left = dx < 0; row.style.transition = 'transform .18s'; row.style.transform = `translateX(${left ? -1 : 1}${el.offsetWidth}px)`;
      const c = C.all().find((x) => x.id === el.dataset.sw); if (!c) { reset(); return; }
      const fresh = () => store.records('chore').find((x) => x.id === c.id);
      if (navigator.vibrate) try { navigator.vibrate(15); } catch (_) { /* */ }
      if (left) { await C.done(c); ui.toast(`✓ ${c.name} — επόμενη ${dFull(C.due(fresh() || c))}`, 5000, { label: 'Αναίρεση', fn: () => C.undo(fresh()) }); }
      else { const nx = await C.skip(c); ui.toast(`⏭ ${c.name}: προσπεράστηκε η ${dFull(c.due)} — επόμενη ${dFull(nx)}`, 5000, { label: 'Αναίρεση', fn: () => C.undo(fresh()) }); }
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', () => { x0 = null; if (drag) reset(); });
    el.addEventListener('click', (e) => { if (swiped) { e.stopPropagation(); e.preventDefault(); } }, true);
  });
}
export function choreSheet(ui, c = null, office = false) {
  office = office || !!c?.office;
  const t = today(); const grps = C.groups();
  let unit = c?.unit || 'm'; let mode = c?.mode || 'after';
  let spSel = c ? c._sp : (showF === 'mine' && C.mySpace()) || 'shared';
  sheet(`<div class="mid">${c ? 'Εργασία' : 'Νέα εργασία'}</div>
    <label class="f" style="margin-top:10px"><span>Τι</span><input name="name" value="${esc(c?.name || '')}" placeholder="π.χ. Καθαρισμός ψυγείου"></label>
    <div class="grid2"><label class="f"><span>Κάθε</span><input name="every" inputmode="numeric" value="${esc(c?.every || 1)}"></label>
    <label class="f"><span>&nbsp;</span><select name="unit">${C.UNITS.map(([v, l]) => `<option value="${v}" ${v === unit ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <label class="f"><span>Πώς μετράει η επόμενη</span><div class="seg" data-mode><button type="button" data-val="after" class="${mode === 'after' ? 'on' : ''}">Μετά την ολοκλήρωση</button><button type="button" data-val="fixed" class="${mode === 'fixed' ? 'on' : ''}">Σταθερές ημερομηνίες</button></div></label>
    <div data-fixed ${mode === 'fixed' ? '' : 'hidden'}><div class="grid2"><label class="f"><span>Πρώτη ημερομηνία</span><input type="date" name="anchor" value="${esc(c?.anchor || c?.next || t)}"></label>
      <label class="f" data-wkf><span>Κάθε μήνα / χρόνο</span><select name="wk"></select></label></div></div>
    <div class="grid2"><label class="f"><span>Τελευταία φορά</span><input type="date" name="last" value="${esc(c?.last || '')}"></label>
    <label class="f" data-nextf><span>Επόμενη (κενό = αυτόματα)</span><input type="date" name="next" value="${esc(c?.next || '')}"></label></div>
    <div class="small muted" style="margin:-6px 2px 10px" data-duehint></div>
    <label class="f"><span>Ομάδα (προαιρετικά)</span><input name="grp" list="chgrps" value="${esc(c?.grp || '')}" placeholder="π.χ. Σπίτι, Κατοικίδιο, Αυτοκίνητο"><datalist id="chgrps">${grps.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></label>
    <label class="f"><span>Σημειώσεις (προαιρετικά)</span><textarea name="notes" rows="3" placeholder="π.χ. ποιο φάρμακο, τηλέφωνο τεχνικού, link">${esc(c?.notes || '')}</textarea></label>
    ${c?.notes && /https?:\/\//.test(c.notes) ? `<div class="small" style="margin:-6px 2px 10px">${[...c.notes.matchAll(/https?:\/\/\S+/g)].map((m) => `<a href="${esc(m[0])}" target="_blank" rel="noopener" style="color:var(--brand)">🔗 Άνοιγμα συνδέσμου</a>`).join(' · ')}</div>` : ''}
    <label class="row small" style="margin:0 2px 12px;gap:6px"><input type="checkbox" name="home" style="width:auto" ${c?.home === false ? '' : 'checked'}> <span>🏠 Στην Αρχική όταν λήγει, μέχρι να πατήσεις ✓ Έγινε</span></label>
    <label class="f"><span>Ειδοποίηση όταν λήγει (σε μένα)</span><select name="mail">${[['none', 'Καμία'], ['mail', '📧 Email'], ['cal', '🔔 Στο κινητό (Google Ημερολόγιο)']].map(([v, l]) => `<option value="${v}" ${v === (!c ? 'mail' : !(c.mailTo || []).includes(store.state.user) ? 'none' : c.ch === 'cal' ? 'cal' : 'mail') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="grid2" data-rmd><label class="f"><span>Πότε</span><select name="rmdD">${[['', 'Το πρωί της ημέρας'], ['0', 'Την ίδια μέρα, σε ώρα…'], ['1', '1 μέρα πριν'], ['2', '2 μέρες πριν'], ['3', '3 μέρες πριν'], ['7', '1 εβδομάδα πριν'], ['14', '2 εβδομάδες πριν'], ['30', '1 μήνα πριν']].map(([v, l]) => `<option value="${v}" ${v === (c?.rmdD != null ? String(c.rmdD) : c?.rmdT ? '0' : '') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f" data-rmdt><span>Ώρα</span><input type="time" name="rmdT" value="${esc(c?.rmdT || '20:00')}"></label></div>
    ${office || !C.mySpace() ? '' : `<label class="f"><span>Ποιος τη βλέπει</span><div class="seg" data-spseg><button type="button" data-val="shared" class="${spSel === 'shared' ? 'on' : ''}">👥 Κοινή</button><button type="button" data-val="${C.mySpace()}" class="${spSel !== 'shared' ? 'on' : ''}">👤 Προσωπική</button></div></label>
      <div class="small muted" style="margin:-6px 2px 10px" data-sphint></div>`}
    ${c ? (() => { const h = C.hist(c); return h.length ? `<div class="small muted" style="margin:0 2px 10px">Έγινε ${h.length} ${h.length === 1 ? 'φορά' : 'φορές'}: ${h.slice(0, 5).map((e) => dFull(e.d)).join(' · ')}${h.length > 5 ? ' …' : ''} <button type="button" class="h-lnk" data-allh style="background:none;border:0;color:var(--brand);font-weight:600;cursor:pointer;padding:0">όλο το ιστορικό ›</button></div>` : ''; })() : ''}
    <button class="btn primary" data-ok>Αποθήκευση</button>
    ${c ? `<div class="card" style="background:var(--chip);box-shadow:none;padding:10px;margin:10px 0"><b class="small">✓ Έγινε</b>
      <div class="grid2" style="margin-top:6px"><label class="f" style="margin:0"><span>Πότε</span><input type="date" name="dd" value="${t}" max="${t}"></label>
      <label class="f" style="margin:0"><span>Σημείωση (προαιρετικά)</span><input name="dn" placeholder="π.χ. πλήρωσα 2 μήνες"></label></div>
      <button class="btn" data-doneon style="margin-top:8px">✓ Έγινε</button></div>
      <button class="btn" data-del style="color:var(--red)">Διαγραφή</button>` : ''}
    <button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const q = (n) => el.querySelector(`[name=${n}]`);
    const vals = () => ({ home: q('home').checked ? null : false, name: q('name').value.trim(), every: Math.max(1, Number(q('every').value) || 1), unit: q('unit').value, last: q('last').value || null, next: q('next').value || null,
      mode, anchor: mode === 'fixed' ? q('anchor').value || t : null, wk: mode === 'fixed' && ['m', 'y'].includes(q('unit').value) ? q('wk').value || null : null, doneOcc: mode === 'fixed' ? (c?.mode === 'fixed' && c?.anchor === q('anchor').value ? c.doneOcc || null : (q('last').value ? q('last').value : null)) : null, grp: q('grp').value.trim() || null, notes: q('notes').value.trim() || null, mailTo: [...new Set([...(c?.mailTo || []).filter((u) => u !== store.state.user), ...(q('mail').value !== 'none' ? [store.state.user] : [])])], ch: q('mail').value === 'cal' ? 'cal' : null, rmdD: q('rmdD').value === '' ? null : Number(q('rmdD').value), rmdT: q('rmdD').value === '' ? null : q('rmdT').value || '09:00' });
    const wkFill = () => { const a = q('anchor').value || t; const keep = q('wk').value || c?.wk || ''; q('wk').innerHTML = C.wkOpts(a).map(([v, l]) => `<option value="${v}" ${v === keep ? 'selected' : ''}>${l}</option>`).join(''); el.querySelector('[data-wkf]').hidden = !['m', 'y'].includes(q('unit').value); };
    const hint = () => {
      wkFill(); const v = vals(); el.querySelector('[data-fixed]').hidden = mode !== 'fixed';
      el.querySelector('[data-duehint]').textContent = v.next ? '' : mode === 'fixed' ? `Επόμενες: ${[0, 1, 2].map((i) => { let d = C.due(v); for (let j = 0; j < i; j++) d = C.occAfter(v, d); return dFull(d); }).join(' · ')} — μένουν σε αυτές τις ημερομηνίες ό,τι μέρα κι αν το κάνεις.`
        : v.last ? `Λήγει: ${dFull(C.due(v))} — η επόμενη μετράει από τη μέρα που θα το κάνεις.` : 'Χωρίς «τελευταία φορά» λήγει σήμερα — ή βάλε «Επόμενη».';
    };
    el.querySelectorAll('[data-mode] button').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.val; el.querySelectorAll('[data-mode] button').forEach((x) => x.classList.toggle('on', x === b)); hint(); }));
    ['every', 'unit', 'last', 'next', 'anchor', 'wk'].forEach((n) => q(n).addEventListener('change', hint)); hint();
    const rmd = () => { el.querySelector('[data-rmd]').hidden = q('mail').value === 'none'; el.querySelector('[data-rmdt]').hidden = q('rmdD').value === ''; };
    q('mail').addEventListener('change', rmd); q('rmdD').addEventListener('change', rmd); rmd();
    const spHint = () => { const h = el.querySelector('[data-sphint]'); if (h) h.textContent = spSel === 'shared' ? `Τη βλέπουν: ${(store.spaceById('shared')?.members || []).join(', ')} — την τσεκάρει όποιος την κάνει.` : 'Μόνο εσύ — δεν φτάνει καν στη συσκευή του άλλου.'; };
    el.querySelectorAll('[data-spseg] button').forEach((b) => b.addEventListener('click', () => { spSel = b.dataset.val; el.querySelectorAll('[data-spseg] button').forEach((x) => x.classList.toggle('on', x === b)); spHint(); })); spHint();
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-doneon]')?.addEventListener('click', async () => { const d = q('dd').value || t; await C.done(c, d > t ? t : d, q('dn').value.trim() || null); close(); ui.toast(`✓ Έγινε ${d === t ? 'σήμερα' : dFull(d)}`); });
    el.querySelector('[data-allh]')?.addEventListener('click', () => { close(); tab = 'hist'; hOne = c.id; hq = ''; ui.render(); });
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (!(await ui.confirm(`Διαγραφή «${c.name}»;`, 'Διαγραφή'))) return; await store.del(c._sp, c.id); close(); });
    el.querySelector('[data-ok]').onclick = async () => {
      const v = vals(); if (!v.name) { ui.toast('Γράψε τι είναι'); return; }
      if (!v.last && !v.next) v.next = t;
      const sp = office ? (c?._sp || C.mySpace() || 'shared') : spSel;
      if (c && sp !== c._sp) await store.move(c._sp, sp, { ...c, ...v }); else await store.put(sp, c?.id || null, { type: 'chore', ...v, ...(c ? {} : { by: store.state.user, office: office ? 1 : null }) });
      close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}
// ---------- ιστορικό ----------
const nrm = (x) => norm(x).replace(/ς/g, 'σ');
function histList(office) {
  let l = C.allHist(C.all().filter((c) => (!office || c.office) && (!hOne || c.id === hOne) && (!showF || (showF === 'mine') === isMine(c))));
  const tok = nrm(hq).split(/\s+/).filter(Boolean);
  if (tok.length) l = l.filter((e) => { const x = nrm(`${e.c.name} ${e.c.grp || ''} ${e.n || ''} ${e.by || ''} ${dFull(e.d)} ${monthLabel(e.d.slice(0, 7))} ${e.skip ? 'προσπεραση προσπεραστηκε' : ''}`); return tok.every((t) => x.includes(t)); });
  return l;
}
function histBody(office) {
  const l = histList(office); if (!l.length) return `<div class="card muted center">${hq ? `Δεν βρέθηκε κάτι για «${esc(hq)}».` : 'Δεν έχει ολοκληρωθεί κάτι ακόμα. Όταν πατάς ☐ ή «✓ Έγινε», καταγράφεται εδώ.'}</div>`;
  const by = new Map(); for (const e of l) { const k = e.d.slice(0, 7); if (!by.has(k)) by.set(k, []); by.get(k).push(e); }
  const nd = l.filter((e) => !e.skip).length, ns = l.length - nd;
  return `<div class="small muted" style="margin:2px 2px 4px">${nd} ${nd === 1 ? 'φορά' : 'φορές'}${ns ? ` · ${ns} ${ns === 1 ? 'προσπέραση' : 'προσπεράσεις'}` : ''}</div>` + [...by].map(([k, es]) => `<h2>${monthLabel(k)} <span class="small muted">(${es.length})</span></h2><div class="list">${es.map((e) => `<div class="item" data-he="${esc(e.c.id)}|${esc(e.d)}|${e.skip ? 's' : ''}" style="cursor:pointer${e.skip ? ';opacity:.6' : ''}">
    <div style="min-width:72px" class="small"><b>${dShort(e.d)}</b></div>
    <div class="grow"><div class="t" style="white-space:normal">${e.skip ? '⏭ ' : ''}${esc(e.c.name)}</div>
    <div class="s" style="white-space:normal">${[e.skip ? 'προσπεράστηκε' : '', e.c.grp ? esc(e.c.grp) : '', !isMine(e.c) && e.by ? `✓ ${esc(e.by)}` : ''].filter(Boolean).join(' · ')}${e.n ? `${e.c.grp || (!isMine(e.c) && e.by) ? '<br>' : ''}📝 ${esc(e.n)}` : ''}</div></div>
    ${C.mySpace() ? `<div class="small muted">${isMine(e.c) ? '👤' : '👥'}</div>` : ''}</div>`).join('')}</div>`).join('');
}
function histSheet(ui, c, d0) {
  const e = C.hist(c).find((x) => x.d === d0); if (!e) return; const t = today();
  sheet(`<div class="mid">${esc(c.name)}</div><div class="small muted">${e.by ? `Το σημείωσε: ${esc(e.by)}` : 'Από παλιότερη καταγραφή'}</div>
    <label class="f" style="margin-top:10px"><span>Πότε έγινε</span><input type="date" name="d" value="${esc(e.d)}" max="${t}"></label>
    <label class="f"><span>Σημείωση</span><input name="n" value="${esc(e.n || '')}"></label>
    <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn" data-open>Άνοιγμα εργασίας</button>
    <button class="btn" data-del style="color:var(--red)">Διαγραφή αυτής της φοράς</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => { const d = el.querySelector('[name=d]').value || e.d; await C.editHist(c, d0, { d: d > t ? t : d, n: el.querySelector('[name=n]').value.trim() || null }); close(); ui.toast('Αποθηκεύτηκε ✓'); };
    el.querySelector('[data-open]').onclick = () => { close(); choreSheet(ui, c); };
    el.querySelector('[data-del]').onclick = async () => { if (!(await ui.confirm(`Να σβηστεί η φορά ${dFull(e.d)};`, 'Διαγραφή'))) return; await C.editHist(c, d0, null); close(); ui.toast('Σβήστηκε'); };
  });
}
const view = (office) => ({
  live: true,
  html() {
    const all = C.all().filter((c) => !office || c.office); const t = today();
    const nMine = all.filter(isMine).length; const chips = !office && C.mySpace() && nMine && nMine < all.length;
    if (!chips) showF = '';
    const l = all.filter((c) => !showF || (showF === 'mine') === isMine(c));
    const sec = (title, list) => (list.length ? `<h2>${title}</h2><div class="list">${list.map(row).join('')}</div>` : '');
    const tabs = all.length ? `<div class="seg" data-tabs style="margin-bottom:10px"><button type="button" data-tab="due" class="${tab === 'due' ? 'on' : ''}">Εκκρεμότητες</button><button type="button" data-tab="hist" class="${tab === 'hist' ? 'on' : ''}">🕘 Ιστορικό</button></div>` : '';
    const chipRow = chips ? `<div class="chips" style="margin-bottom:6px">${[['', `Όλες (${all.length})`], ['shared', `👥 Κοινές (${all.length - nMine})`], ['mine', `👤 Προσωπικές (${nMine})`]].map(([v, lb]) => `<button class="chip ${showF === v ? 'on' : ''}" data-showf="${v}">${lb}</button>`).join('')}</div>` : '';
    const top = `<div class="top">${office ? '' : '<button class="btn sm ghost" data-back>‹</button>'}<h1>Εργασίες${office ? ' γραφείου' : ''}</h1><button class="btn sm primary" data-new>+ Εργασία</button></div>${tabs}`;
    if (tab === 'hist' && all.length) {
      const one = hOne && all.find((c) => c.id === hOne); if (!one) hOne = null;
      return `${top}<div class="h-search" style="margin-bottom:8px"><input data-hq value="${esc(hq)}" placeholder="Αναζήτηση: εργασία, ομάδα, σημείωση, μήνας…" autocomplete="off" enterkeyhint="search" style="width:100%"></div>
        ${one ? `<div class="chips" style="margin-bottom:6px"><button class="chip on" data-hone>✕ ${esc(one.name)}</button></div>` : chipRow}<div data-hb>${histBody(office)}</div>`;
    }
    return `${top}
    ${chips ? `<div class="chips" style="margin-bottom:6px">${[['', `Όλες (${all.length})`], ['shared', `👥 Κοινές (${all.length - nMine})`], ['mine', `👤 Προσωπικές (${nMine})`]].map(([v, lb]) => `<button class="chip ${showF === v ? 'on' : ''}" data-showf="${v}">${lb}</button>`).join('')}</div>` : ''}
    ${all.length ? '' : `<div class="note">${office ? 'Ό,τι επαναλαμβάνεται στο γραφείο: παραγγελίες, καθαρισμός ζυγαριάς, ανανεώσεις συνδρομών, δηλώσεις…' : 'Ό,τι επαναλαμβάνεται και δεν είναι χρήματα: καθαρισμοί, εμβόλια, ανανεώσεις, συντηρήσεις…'} Βάζεις κάθε πότε και πότε έγινε τελευταία φορά· όταν λήγει, εμφανίζεται στην αρχική και (αν θες) σου έρχεται email. Πάτα ☐ όταν το κάνεις.</div>`}
    ${sec('Έληξαν', l.filter((c) => c.due < t))}${sec('Σήμερα', l.filter((c) => c.due === t))}
    ${sec('Τις επόμενες 30 μέρες', l.filter((c) => c.due > t && C.daysTo(c.due) <= 30))}${sec('Αργότερα', l.filter((c) => C.daysTo(c.due) > 30))}
    ${l.length ? '<div class="small muted" style="margin-top:12px">☐ ή σύρε ← αριστερά = έγινε σήμερα · σύρε δεξιά → = προσπέραση αυτής της φοράς (η λήξη πάει στην επόμενη, χωρίς να μετρήσει ως «έγινε»). Για άλλη μέρα, πάτα την εργασία και άλλαξε την «Τελευταία φορά». 📧 / 🔔 = έρχεται email / ειδοποίηση στο κινητό όταν λήγει (Ρυθμίσεις → Υπενθυμίσεις με email).</div>' : ''}`;
  },
  mount(root, p, ui) {
    root.querySelector('[data-back]')?.addEventListener('click', () => ui.back());
    root.querySelector('[data-new]').addEventListener('click', () => choreSheet(ui, null, office));
    root.querySelectorAll('[data-chore]').forEach((r) => r.addEventListener('click', () => choreSheet(ui, store.records('chore').find((x) => x.id === r.dataset.chore))));
    root.querySelectorAll('[data-showf]').forEach((b) => b.addEventListener('click', () => { showF = b.dataset.showf; ui.render(); }));
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; hOne = null; ui.render(); }));
    root.querySelector('[data-hone]')?.addEventListener('click', () => { hOne = null; ui.render(); });
    const bindHist = (box) => box.querySelectorAll('[data-he]').forEach((r) => r.addEventListener('click', () => { const [id, d, sk] = r.dataset.he.split('|'); const c = store.records('chore').find((x) => x.id === id); if (!c) return;
      if (!sk) { histSheet(ui, c, d); return; }
      ui.confirm(`«${c.name}»: προσπεράστηκε η ${dFull(d)}${(c.skips || []).find((x) => x.d === d)?.by ? ` (${(c.skips || []).find((x) => x.d === d).by})` : ''}. Να σβηστεί από το ιστορικό; (η λήξη δεν αλλάζει)`, 'Σβήσιμο').then(async (ok) => { if (ok) { await C.delSkip(c, d); ui.toast('Σβήστηκε'); } }); }));
    const hb = root.querySelector('[data-hb]');
    if (hb) {
      bindHist(hb); let tm;
      root.querySelector('[data-hq]').addEventListener('input', (e) => { clearTimeout(tm); tm = setTimeout(() => { hq = e.target.value.trim(); hb.innerHTML = histBody(office); bindHist(hb); }, 150); });
    }
    bindTicks(root, ui); bindSwipe(root, ui);
  },
});
export const officeTasks = view(true);
export default view(false);
