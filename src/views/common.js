import { esc, eur, dShort } from '../util.js';
import { fx, othSum } from '../ledger.js';
import { spaceById, state } from '../store.js';

export const ICON = {
  'Σούπερ μάρκετ': '🛒', 'Φαγητό έτοιμο': '🍽️', 'Σπίτι': '🏠', 'Πάγια έξοδα': '📄', 'Αγορές': '🛍️', 'Ευζωία': '💆', 'Ιατρικά': '💊',
  'Μεταφορικά': '🚌', 'Αυτοκίνητο': '🚗', 'Δίτροχα': '🛵', 'Διασκέδαση': '🎉', 'Δώρα': '🎁', 'Ταξίδι': '✈️', 'Κατοικίδιο': '🐾',
  'Οικογένεια': '👪', 'Διάφορα': '📦', 'Μισθός': '💼', 'Ιδιαίτερα': '📚', 'Πωλήσεις': '🏷️', 'Επιδόματα': '🏛️', 'Δώρο': '🎁',
  'Από οικογένεια': '👪', 'Ενοίκιο': '🔑', 'Άλλο': '➕',
};
export const icon = (r) => (r.kind === 'Μεταφορά' ? '⇄' : ICON[r.cat] || '•');

/** «Άλκης → Κοινό» style subtitle */
export function who(r) {
  if (r.kind === 'Μεταφορά') return `${esc(r.payer)} → ${esc(r.for)}`;
  const O = fx(r).O || (r.for === 'Φίλιππος' ? 'Φίλιππος' : r.for || 'Κοινό');
  const f = { O };
  const fo = r.kind === 'Έσοδο' ? (r.for === 'Κοινό' ? 'κοινό' : r.for === 'Φίλιππος' ? 'για Φίλιππο' : '') : (f.O === 'Κοινό' ? 'κοινό' : f.O === r.payer ? '' : `για ${f.O}`);
  return [esc(r.payer), fo].filter(Boolean).join(' · ');
}

export function itemHtml(r, opts = {}) {
  const sign = r.kind === 'Έσοδο' ? '+' : r.kind === 'Μεταφορά' ? '' : '−';
  const cls = r.kind === 'Έσοδο' ? 'pos' : r.kind === 'Μεταφορά' ? '' : '';
  const sp = spaceById(r._sp);
  // only personal items get a tag (shared is the default); «κοινό» in the text already means «μισά-μισά»
  const tag = sp && r._sp !== 'shared' && state.spaces.filter((s) => s.members.includes(state.user)).length > 1
    ? `<span class="space-tag">Προσωπικό</span>` : '';
  const future = r.d > opts.today;
  return `<div class="item" data-edit="${esc(r._sp)}/${esc(r.id)}" style="${future || r.skipped ? 'opacity:.55' : ''}">
    <div class="dot">${icon(r)}</div>
    <div class="grow"><div class="t">${esc(r.desc || r.cat || '')}${r.rec ? ' <span class="small muted">↻</span>' : ''}</div>
      <div class="s">${opts.showDate ? dShort(r.d) + ' · ' : ''}${esc(r.kind === 'Μεταφορά' ? 'Μεταφορά' : r.cat || '')} · ${who(r)}${othSum(r) ? ` · ${(() => { const o = fx(r).O; return o === 'Κοινό' ? 'κοινό μέρος' : 'μένει ' + esc(o); })()} ${eur((r.a || 0) - othSum(r))}` : ''} ${tag}</div></div>
    <div class="right"><div class="amt ${cls}" style="${r.skipped ? 'text-decoration:line-through' : ''}">${sign}${eur(opts.amt != null ? opts.amt : r.a)}</div>${opts.amt != null && Math.abs(opts.amt - (r.a || 0)) > 0.004 ? `<div class="small muted">από ${eur(r.a)}</div>` : ''}</div></div>`;
}
export function bindEdit(root, ui) {
  root.querySelectorAll('[data-edit]').forEach((el) => el.addEventListener('click', () => ui.go(`#/edit/${el.dataset.edit}`)));
}
