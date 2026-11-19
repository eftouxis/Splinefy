// Backups: everything to an Excel file, or a full JSON copy per space
import * as store from './store.js';
import { movements, fx } from './ledger.js';
import { today, norm } from './util.js';
import { workbook, download } from './xlsx.js';
import * as L from './lessons.js';

const FREQ = (r) => (r.unit === 'd' ? (r.every === 7 ? 'κάθε εβδομάδα' : `κάθε ${r.every} μέρες`) : r.every === 1 ? 'κάθε μήνα' : r.every === 12 ? 'κάθε χρόνο' : `κάθε ${r.every} μήνες`);
export const PARTS = [['tx', 'Κινήσεις'], ['rec', 'Επαναλαμβανόμενα'], ['stu', 'Μαθητές'], ['les', 'Μαθήματα'], ['pay', 'Πληρωμές μαθητών']];
/** Excel· opts: parts (Set από PARTS), from/to (ημερομηνίες), q (λέξη), stu (ένας μαθητής) — χωρίς opts: όλα */
export async function excel(opts = {}) {
  const me = store.state.user; const t = today();
  const want = (k) => !opts.parts || opts.parts.has(k);
  const from = opts.from || '0000', to = opts.to && opts.to < t ? opts.to : t;
  const q = norm(opts.q || '').trim(); const hit = (...xs) => !q || norm(xs.filter(Boolean).join(' ')).includes(q);
  const stuOk = (id) => !opts.stu || id === opts.stu;
  const sp = Object.fromEntries(store.state.spaces.map((s) => [s.id, s.name]));
  const mine = me === 'Χαρά' ? ['V', 'Χαρά'] : ['U', 'Άλκης'];
  const tx = (want('tx') && !opts.stu ? movements() : []).filter((r) => r.d <= to && r.d >= from && !r.skipped && hit(r.desc, r.cat, r.note, r.payer, r.for, r.trip)).sort((a, b) => (a.d < b.d ? 1 : -1));
  const rows = [['Ημερομηνία', 'Ποσό', 'Περιγραφή', 'Κατηγορία', 'Τύπος', 'Πλήρωσε / πήρε', 'Για ποιον', 'Ταξίδι', 'Σημείωση', 'Χώρος', `Μερίδιο ${mine[1]}`, 'Κοινά', 'Φίλιππος', 'Πάγιο']];
  for (const r of tx) {
    const f = fx(r);
    rows.push([{ d: r.d }, { m: r.a || 0 }, r.desc || '', r.kind === 'Μεταφορά' ? '' : r.cat || '', r.kind, r.payer || '', r.for || '', r.trip || '', r.note || '', sp[r._sp] || '',
      f[mine[0]] ? { m: r.kind === 'Έσοδο' ? -f[mine[0]] : f[mine[0]] } : null, f.W ? { m: f.W } : null, f.X ? { m: f.X } : null, r.rec ? 'ναι' : '']);
  }
  const sheets = want('tx') && !opts.stu ? [{ name: 'Κινήσεις', rows, widths: [12, 11, 30, 16, 10, 12, 12, 16, 24, 14, 12, 11, 11, 8] }] : [];
  const recs = store.records('rec').filter((r) => hit(r.name, r.cat, r.note));
  if (want('rec') && !opts.stu) sheets.push({ name: 'Επαναλαμβανόμενα', widths: [26, 11, 14, 14, 10, 10, 12, 12], rows: [['Όνομα', 'Ποσό', 'Συχνότητα', 'Κατηγορία', 'Πληρώνει', 'Για ποιον', 'Από', 'Έως'],
    ...recs.map((r) => [r.name, { m: r.a || 0 }, FREQ(r), r.cat, r.payer, r.for || '', r.start ? { d: r.start } : '', r.end ? { d: r.end } : ''])] });
  if (L.hasLessons() && L.students().length) {
    const st = L.students().filter((x) => stuOk(x.id) && (opts.stu || hit(x.name, x.full, x.note)));
    const lab = (id) => { const x = L.student(id); return x ? L.label(x) : ''; };
    const okS = (id) => stuOk(id) && (opts.stu || hit(lab(id), L.student(id)?.full));
    if (want('stu')) sheets.push({ name: 'Μαθητές', widths: [16, 24, 10, 9, 10, 12, 12, 12, 24], rows: [['Όνομα', 'Ονοματεπώνυμο', 'Τιμή', 'Ώρες', '€/ώρα', 'Υπόλοιπο', 'Από', 'Έως', 'Σημειώσεις'],
      ...st.map((s) => { const p = L.priceAt(s); return [L.label(s), s.full || '', { m: p.price || 0 }, p.dur || 0, { m: L.rateAt(s, t) }, { m: L.balance(s.id) }, s.start ? { d: s.start } : '', s.end ? { d: s.end } : '', s.note || '']; })] });
    if (want('les')) sheets.push({ name: 'Μαθήματα', widths: [12, 16, 8, 10, 14], rows: [['Ημερομηνία', 'Μαθητής', 'Ώρες', 'Αξία', 'Σημείωση'],
      ...L.lessons({ all: true, to }).filter((l) => l.d >= from && okS(l.stu)).reverse().map((l) => [{ d: l.d }, L.label(L.student(l.stu)), Math.round(l.h * 1000) / 1000, { m: l.v }, !l.h ? 'δεν έγινε' : !l.sched ? 'έκτακτο' : l.ov ? 'αλλαγή' : ''])] });
    if (want('pay')) sheets.push({ name: 'Πληρωμές μαθητών', widths: [12, 16, 10, 24], rows: [['Ημερομηνία', 'Μαθητής', 'Ποσό', 'Σημείωση'],
      ...L.payments().filter((p) => p.d >= from && p.d <= to && okS(p.stu)).map((p) => [{ d: p.d }, L.label(L.student(p.stu)), { m: p.a || 0 }, p.note || ''])] });
  }
  if (!sheets.length) return -1;
  const blob = await workbook(sheets);
  download(blob, opts.name || (opts.parts || opts.q || opts.from || opts.to ? `Splinefy_epilogi_${t}.xlsx` : `Oikonomika_${t}.xlsx`));
  return sheets.reduce((n, x) => n + x.rows.length - 1, 0);
}
/** full copy of every space you can see (can be loaded back from Ρυθμίσεις → Εισαγωγή) */
export function json() {
  const t = today(); let n = 0;
  for (const s of store.visibleSpaces()) {
    const d = store.state.data[s.id]; if (!d) continue;
    const records = [...d.recs.values()].filter((r) => !r._x).map(({ _t, _u, _m, _x, _sp, ...r }) => r);
    n += records.length;
    download(new Blob([JSON.stringify({ format: 1, space: { id: s.id, name: s.name, members: s.members }, created: new Date().toISOString(), records })], { type: 'application/json' }), `Antigrafo_${s.id}_${t}.json`);
  }
  return n;
}
