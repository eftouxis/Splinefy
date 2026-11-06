// Backups: everything to an Excel file, or a full JSON copy per space
import * as store from './store.js';
import { movements, fx } from './ledger.js';
import { today } from './util.js';
import { workbook, download } from './xlsx.js';
import * as L from './lessons.js';

const FREQ = (r) => (r.unit === 'd' ? (r.every === 7 ? 'κάθε εβδομάδα' : `κάθε ${r.every} μέρες`) : r.every === 1 ? 'κάθε μήνα' : r.every === 12 ? 'κάθε χρόνο' : `κάθε ${r.every} μήνες`);
export async function excel() {
  const me = store.state.user; const t = today();
  const sp = Object.fromEntries(store.state.spaces.map((s) => [s.id, s.name]));
  const mine = me === 'Χαρά' ? ['V', 'Χαρά'] : ['U', 'Άλκης'];
  const tx = movements().filter((r) => r.d <= t && !r.skipped).sort((a, b) => (a.d < b.d ? 1 : -1));
  const rows = [['Ημερομηνία', 'Ποσό', 'Περιγραφή', 'Κατηγορία', 'Τύπος', 'Πλήρωσε / πήρε', 'Για ποιον', 'Ταξίδι', 'Σημείωση', 'Χώρος', `Μερίδιο ${mine[1]}`, 'Κοινά', 'Φίλιππος', 'Πάγιο']];
  for (const r of tx) {
    const f = fx(r);
    rows.push([{ d: r.d }, { m: r.a || 0 }, r.desc || '', r.kind === 'Μεταφορά' ? '' : r.cat || '', r.kind, r.payer || '', r.for || '', r.trip || '', r.note || '', sp[r._sp] || '',
      f[mine[0]] ? { m: r.kind === 'Έσοδο' ? -f[mine[0]] : f[mine[0]] } : null, f.W ? { m: f.W } : null, f.X ? { m: f.X } : null, r.rec ? 'ναι' : '']);
  }
  const sheets = [{ name: 'Κινήσεις', rows, widths: [12, 11, 30, 16, 10, 12, 12, 16, 24, 14, 12, 11, 11, 8] }];
  const recs = store.records('rec');
  sheets.push({ name: 'Επαναλαμβανόμενα', widths: [26, 11, 14, 14, 10, 10, 12, 12], rows: [['Όνομα', 'Ποσό', 'Συχνότητα', 'Κατηγορία', 'Πληρώνει', 'Για ποιον', 'Από', 'Έως'],
    ...recs.map((r) => [r.name, { m: r.a || 0 }, FREQ(r), r.cat, r.payer, r.for || '', r.start ? { d: r.start } : '', r.end ? { d: r.end } : ''])] });
  if (L.hasLessons() && L.students().length) {
    const st = L.students();
    sheets.push({ name: 'Μαθητές', widths: [16, 24, 10, 9, 10, 12, 12, 12, 24], rows: [['Όνομα', 'Ονοματεπώνυμο', 'Τιμή', 'Ώρες', '€/ώρα', 'Υπόλοιπο', 'Από', 'Έως', 'Σημειώσεις'],
      ...st.map((s) => { const p = L.priceAt(s); return [L.label(s), s.full || '', { m: p.price || 0 }, p.dur || 0, { m: L.rateAt(s, t) }, { m: L.balance(s.id) }, s.start ? { d: s.start } : '', s.end ? { d: s.end } : '', s.note || '']; })] });
    sheets.push({ name: 'Μαθήματα', widths: [12, 16, 8, 10, 14], rows: [['Ημερομηνία', 'Μαθητής', 'Ώρες', 'Αξία', 'Σημείωση'],
      ...L.lessons({ all: true, to: t }).reverse().map((l) => [{ d: l.d }, L.label(L.student(l.stu)), Math.round(l.h * 1000) / 1000, { m: l.v }, !l.h ? 'δεν έγινε' : !l.sched ? 'έκτακτο' : l.ov ? 'αλλαγή' : ''])] });
    sheets.push({ name: 'Πληρωμές μαθητών', widths: [12, 16, 10, 24], rows: [['Ημερομηνία', 'Μαθητής', 'Ποσό', 'Σημείωση'],
      ...L.payments().map((p) => [{ d: p.d }, L.label(L.student(p.stu)), { m: p.a || 0 }, p.note || ''])] });
  }
  const blob = await workbook(sheets);
  download(blob, `Oikonomika_${t}.xlsx`);
  return rows.length - 1;
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
