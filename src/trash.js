// «Πρόσφατα διαγραμμένα»: the groups of deletes of the last 30 days (trash records, synced like everything else)
import * as store from './store.js';
import { eur, dFull } from './util.js';

export const DAYS = 30;
const TYPES = {
  tx: 'Κίνηση', rec: 'Επαναλαμβανόμενο', recx: 'Μία φορά επαναλαμβανόμενου', lx: 'Μάθημα', sched: 'Πρόγραμμα μαθητή', student: 'Μαθητής',
  lnote: 'Σημείωση μαθητή', sal: 'Μισθός', hol: 'Αργία', chore: 'Εργασία', med: 'Αγωγή', car: 'Αυτοκίνητο', crem: 'Υπενθύμιση αυτοκινήτου',
  trip: 'Ταξίδι', goal: 'Στόχος', person: 'Άτομο', pmov: 'Κίνηση με άτομο', orep: 'Επιστροφή', ocl: 'Πελάτης', opart: 'Συνεργάτης',
  oex: 'Έξοδο γραφείου', ofix: 'Πάγιο γραφείου', odo: 'Εργασία γραφείου', hvisit: 'Επίσκεψη γιατρού', hlog: 'Ημερολόγιο υγείας', hprofile: 'Παιδί (στοιχεία)', hvac: 'Εμβόλιο', hlab: 'Εξετάσεις',
  hdoc: 'Έγγραφο υγείας', pevent: 'Συμβάν κατοικιδίου', pdoc: 'Έγγραφο κατοικιδίου', gwod: 'Προπόνηση', gpr: 'Ρεκόρ', card: 'Κάρτα',
};
const nameOf = (sp, id) => { const r = id && store.anyRecord(sp, id); return r ? (r.name || r.title || '') : ''; };
const dd = (d) => (/^\d{4}-\d\d-\d\d/.test(d || '') ? dFull(d.slice(0, 10)) : '');

/** one line for a record (also a deleted one) */
export function describe(r, sp) {
  if (!r) return 'Εγγραφή';
  const t = TYPES[r.type] || 'Εγγραφή';
  const join = (...a) => a.filter(Boolean).join(' · ');
  switch (r.type) {
    case 'tx': return join(r.desc || r.cat || 'Κίνηση', r.a != null ? eur(r.a) : '', dd(r.d));
    case 'rec': return join(r.name, r.a != null ? eur(r.a) : '', '↻');
    case 'recx': { const [rid, d] = String(r.id).split('@'); return join(nameOf(sp, rid) || t, dd(d)); }
    case 'lx': return join(`Μάθημα ${nameOf(sp, r.stu)}`.trim(), dd(r.d));
    case 'sched': return `Πρόγραμμα ${nameOf(sp, r.stu)}`.trim();
    case 'lnote': return join(`Σημείωση ${nameOf(sp, r.stu)}`.trim(), r.text);
    default: return join(`${t}`, r.name || r.title || r.desc || r.disease || r.text || '', r.a != null ? eur(r.a) : '', dd(r.d));
  }
}
/** what a group was: its label, or the first deleted record (+ how many more) */
export function title(g) {
  const items = g.items || [];
  if (g.label) return g.label;
  if (!items.length) { const p = (g.prev || [])[0]; return p ? describe(store.anyRecord(p.sp, p.id), p.sp) : 'Διαγραφή'; }
  const first = describe(store.anyRecord(items[0].sp, items[0].id), items[0].sp);
  return items.length > 1 ? `${first} + ${items.length - 1} ακόμα` : first;
}
/** the groups of the last 30 days, newest first */
export function recent() {
  const from = Date.now() - DAYS * 864e5;
  return store.records('trash').filter((t) => (t.at || 0) >= from).sort((a, b) => b.at - a.at);
}
