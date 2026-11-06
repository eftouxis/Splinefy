// #/chores — Εργασίες: what repeats and when it is due (overdue / soon / later), ☐ = done today
import { esc, today, dFull } from '../util.js';
import * as store from '../store.js';
import * as C from '../chores.js';
import { sheet } from './lessons/ui.js';

// κοινή (στον κοινό χώρο, τη βλέπουν όλοι του) ή προσωπική (στον δικό μου χώρο — δεν φτάνει καν στη συσκευή του άλλου)
const isMine = (c) => c._sp !== 'shared';
let showF = '';                                    // '' όλες · 'shared' κοινές · 'mine' προσωπικές
const ago = (n) => (n === 0 ? 'σήμερα' : n === 1 ? 'αύριο' : n === -1 ? 'χθες' : n > 0 ? `σε ${n} μέρες` : `πριν ${-n} μέρες`);
const row = (c) => {
  const n = C.daysTo(c.due);
  return `<div class="item" data-chore="${esc(c.id)}" style="cursor:pointer">
    <button type="button" class="btn sm ghost" data-tick="${esc(c.id)}" title="Έγινε σήμερα" style="width:auto;font-size:22px;padding:2px 8px">☐</button>
    <div class="grow"><div class="t" style="white-space:normal">${esc(c.name)}${(c.mailTo || []).includes(store.state.user) ? ` <span class="small">${c.ch === 'cal' ? '🔔' : '📧'}</span>` : ''}</div>
      <div class="s" style="white-space:normal"><span class="${n < 0 ? 'neg' : n === 0 ? 'neg' : ''}">Λήγει: ${dFull(c.due)} (${ago(n)})</span><br>${c.last ? `Τελευταία: ${dFull(c.last)} (${ago(C.daysTo(c.last))})` : 'Δεν έχει γίνει ακόμα'} · ${C.everyTxt(c)}${c.notes ? `<br><span class="muted">📝 ${esc(c.notes.split('\n')[0].slice(0, 80))}${c.notes.length > 80 || c.notes.includes('\n') ? '…' : ''}</span>` : ''}</div></div>
    <div class="small muted" style="text-align:right">${C.mySpace() ? `<div title="${isMine(c) ? 'Προσωπική — μόνο εσύ' : 'Κοινή'}">${isMine(c) ? '👤' : '👥'}</div>` : ''}${c.grp ? esc(c.grp) : ''}</div></div>`;
};
export function choresCard() {                    // home: what is due (overdue + today)
  const l = C.dueNow(); if (!l.length) return '';
  return `<div class="card" style="border-left:4px solid var(--red)"><div class="row"><b class="grow">✅ Εργασίες για τώρα</b><a class="small" href="#/chores" style="color:var(--brand);text-decoration:none;font-weight:600">όλες ›</a></div>
    ${l.slice(0, 6).map((c) => `<div class="row small" style="margin-top:6px"><span class="grow">${esc(c.name)} <span class="neg">· ${ago(C.daysTo(c.due))}</span></span><button class="btn sm" data-tick="${esc(c.id)}" style="width:auto">✓ Έγινε</button></div>`).join('')}
    ${l.length > 6 ? `<div class="small muted" style="margin-top:6px">και ${l.length - 6} ακόμα</div>` : ''}</div>`;
}
export function bindTicks(root, ui) {
  root.querySelectorAll('[data-tick]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation(); const c = C.all().find((x) => x.id === b.dataset.tick); if (!c) return;
    await C.done(c); ui.toast(`✓ ${c.name} — επόμενη ${dFull(C.due({ ...c, last: today(), next: null }))}`, 5000, { label: 'Αναίρεση', fn: () => C.undo(store.records('chore').find((x) => x.id === c.id)) });
  }));
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
    <label class="f"><span>Ειδοποίηση όταν λήγει (σε μένα)</span><select name="mail">${[['none', 'Καμία'], ['mail', '📧 Email'], ['cal', '🔔 Στο κινητό (Google Ημερολόγιο)']].map(([v, l]) => `<option value="${v}" ${v === (!c ? 'mail' : !(c.mailTo || []).includes(store.state.user) ? 'none' : c.ch === 'cal' ? 'cal' : 'mail') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="grid2" data-rmd><label class="f"><span>Πότε</span><select name="rmdD">${[['', 'Το πρωί της ημέρας'], ['0', 'Την ίδια μέρα, σε ώρα…'], ['1', '1 μέρα πριν'], ['2', '2 μέρες πριν'], ['3', '3 μέρες πριν'], ['7', '1 εβδομάδα πριν'], ['14', '2 εβδομάδες πριν'], ['30', '1 μήνα πριν']].map(([v, l]) => `<option value="${v}" ${v === (c?.rmdD != null ? String(c.rmdD) : c?.rmdT ? '0' : '') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f" data-rmdt><span>Ώρα</span><input type="time" name="rmdT" value="${esc(c?.rmdT || '20:00')}"></label></div>
    ${office || !C.mySpace() ? '' : `<label class="f"><span>Ποιος τη βλέπει</span><div class="seg" data-spseg><button type="button" data-val="shared" class="${spSel === 'shared' ? 'on' : ''}">👥 Κοινή</button><button type="button" data-val="${C.mySpace()}" class="${spSel !== 'shared' ? 'on' : ''}">👤 Προσωπική</button></div></label>
      <div class="small muted" style="margin:-6px 2px 10px" data-sphint></div>`}
    ${c?.hist?.length ? `<div class="small muted" style="margin:0 2px 10px">Έγινε: ${c.hist.slice(0, 12).map(dFull).join(' · ')}</div>` : ''}
    <button class="btn primary" data-ok>Αποθήκευση</button>
    ${c ? `<button class="btn" data-doneon>✓ Έγινε σήμερα</button><button class="btn" data-del style="color:var(--red)">Διαγραφή</button>` : ''}
    <button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const q = (n) => el.querySelector(`[name=${n}]`);
    const vals = () => ({ name: q('name').value.trim(), every: Math.max(1, Number(q('every').value) || 1), unit: q('unit').value, last: q('last').value || null, next: q('next').value || null,
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
    el.querySelector('[data-doneon]')?.addEventListener('click', async () => { await C.done(c); close(); ui.toast('✓ Έγινε'); });
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
const view = (office) => ({
  live: true,
  html() {
    const all = C.all().filter((c) => !office || c.office); const t = today();
    const nMine = all.filter(isMine).length; const chips = !office && C.mySpace() && nMine && nMine < all.length;
    if (!chips) showF = '';
    const l = all.filter((c) => !showF || (showF === 'mine') === isMine(c));
    const sec = (title, list) => (list.length ? `<h2>${title}</h2><div class="list">${list.map(row).join('')}</div>` : '');
    return `<div class="top">${office ? '' : '<button class="btn sm ghost" data-back>‹</button>'}<h1>Εργασίες${office ? ' γραφείου' : ''}</h1><button class="btn sm primary" data-new>+ Εργασία</button></div>
    ${chips ? `<div class="chips" style="margin-bottom:6px">${[['', `Όλες (${all.length})`], ['shared', `👥 Κοινές (${all.length - nMine})`], ['mine', `👤 Προσωπικές (${nMine})`]].map(([v, lb]) => `<button class="chip ${showF === v ? 'on' : ''}" data-showf="${v}">${lb}</button>`).join('')}</div>` : ''}
    ${all.length ? '' : `<div class="note">${office ? 'Ό,τι επαναλαμβάνεται στο γραφείο: παραγγελίες, καθαρισμός ζυγαριάς, ανανεώσεις συνδρομών, δηλώσεις…' : 'Ό,τι επαναλαμβάνεται και δεν είναι χρήματα: καθαρισμοί, εμβόλια, ανανεώσεις, συντηρήσεις…'} Βάζεις κάθε πότε και πότε έγινε τελευταία φορά· όταν λήγει, εμφανίζεται στην αρχική και (αν θες) σου έρχεται email. Πάτα ☐ όταν το κάνεις.</div>`}
    ${sec('Έληξαν', l.filter((c) => c.due < t))}${sec('Σήμερα', l.filter((c) => c.due === t))}
    ${sec('Τις επόμενες 30 μέρες', l.filter((c) => c.due > t && C.daysTo(c.due) <= 30))}${sec('Αργότερα', l.filter((c) => C.daysTo(c.due) > 30))}
    ${l.length ? '<div class="small muted" style="margin-top:12px">☐ = έγινε σήμερα (η επόμενη μετράει από σήμερα). Για άλλη μέρα, πάτα την εργασία και άλλαξε την «Τελευταία φορά». 📧 / 🔔 = έρχεται email / ειδοποίηση στο κινητό όταν λήγει (Ρυθμίσεις → Υπενθυμίσεις με email).</div>' : ''}`;
  },
  mount(root, p, ui) {
    root.querySelector('[data-back]')?.addEventListener('click', () => ui.back());
    root.querySelector('[data-new]').addEventListener('click', () => choreSheet(ui, null, office));
    root.querySelectorAll('[data-chore]').forEach((r) => r.addEventListener('click', () => choreSheet(ui, store.records('chore').find((x) => x.id === r.dataset.chore))));
    root.querySelectorAll('[data-showf]').forEach((b) => b.addEventListener('click', () => { showF = b.dataset.showf; ui.render(); }));
    bindTicks(root, ui);
  },
});
export const officeTasks = view(true);
export default view(false);
