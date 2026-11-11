// Lessons engine — same rules as the lessons Excel:
// weekly schedule → lessons (not on «αργία» days) · per-day overrides (extra / cancelled / other hours)
// value = hours × price per hour · balance = opening + lessons up to today − payments.
import { records, state } from './store.js';
import { today, addDays, parseISO, iso, pad } from './util.js';

export const LSP = 'alkis';                 // private space of Άλκης
export const hasLessons = () => state.user === 'Άλκης' && !!state.data[LSP];
export const DAYNAMES = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];

// ---- school year: 16 June Y → 15 June Y+1 (winter schedule from 1 September) ----
export const yearOf = (d) => { const y = Number(d.slice(0, 4)); return d.slice(5) >= '06-16' ? y : y - 1; };
export const yStart = (Y) => `${Y}-06-16`;
export const yEnd = (Y) => `${Y + 1}-06-15`;
export const winter = (Y) => `${Y}-09-01`;
export const yLabel = (Y) => `${Y}–${String(Y + 1).slice(2)}`;
/** the 13 month keys of a school year (June … June) */
export const yMonths = (Y) => Array.from({ length: 13 }, (_, i) => { const d = new Date(Y, 5 + i, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; });
const wd = (d) => { const x = parseISO(d).getDay(); return x === 0 ? 7 : x; };   // 1 = Monday … 7 = Sunday
export const eom = (m) => { const [y, mo] = m.split('-').map(Number); return `${m}-${pad(new Date(y, mo, 0).getDate())}`; };
export const isoWeekStart = (d) => addDays(d, 1 - wd(d));

/** Orthodox Easter (same formula as the Excel) */
export function easter(y) {
  const a = (19 * (y % 19) + 15) % 30, b = (2 * (y % 4) + 4 * (y % 7) - a + 34) % 7;
  const m = Math.floor((a + b + 114) / 31), d = ((a + b + 114) % 31) + 1;
  return addDays(`${y}-${pad(m)}-${pad(d)}`, 13);
}
const workdayBefore = (d) => { let x = addDays(d, -1); while (wd(x) > 5) x = addDays(x, -1); return x; };
/** automatic holidays of a school year: kind «αργία» (no lessons), «γιορτή», «ειδική» (only shown) */
export function autoHolidays(Y) {
  const e0 = easter(Y), e1 = easter(Y + 1), Z = Y + 1;
  const agiasmos = (() => { const d = `${Y}-09-11`; return wd(d) === 6 ? addDays(d, 2) : wd(d) === 7 ? addDays(d, 1) : d; })();
  const trion = wd(`${Z}-01-30`) > 5 ? workdayBefore(`${Z}-01-30`) : `${Z}-01-30`;
  return [
    [addDays(e0, 50), null, 'Αγίου Πνεύματος', 'αργία'], [`${Y}-08-15`, null, 'Δεκαπενταύγουστος', 'αργία'],
    [agiasmos, null, 'Αγιασμός', 'γιορτή'], [workdayBefore(`${Y}-10-28`), null, 'Γιορτή 28ης Οκτωβρίου', 'γιορτή'],
    [`${Y}-10-28`, null, '28η Οκτωβρίου', 'αργία'], [`${Y}-11-17`, null, 'Πολυτεχνείο', 'αργία'],
    [`${Y}-12-24`, `${Z}-01-07`, 'Διακοπές Χριστουγέννων', 'αργία'], [trion, null, 'Τριών Ιεραρχών (σχολική γιορτή)', 'γιορτή'],
    [`${Z}-01-30`, null, 'Τριών Ιεραρχών', 'αργία'], [addDays(e1, -59), null, 'Τσικνοπέμπτη', 'ειδική'],
    [addDays(e1, -48), null, 'Καθαρά Δευτέρα', 'αργία'], [workdayBefore(`${Z}-03-25`), null, 'Γιορτή 25ης Μαρτίου', 'γιορτή'],
    [`${Z}-03-25`, null, '25η Μαρτίου', 'αργία'], [addDays(e1, -6), addDays(e1, 7), 'Διακοπές Πάσχα', 'αργία'],
    [`${Z}-05-01`, null, 'Πρωτομαγιά', 'αργία'], [addDays(e1, 50), null, 'Αγίου Πνεύματος', 'αργία'],
  ].map(([from, to, name, kind]) => ({ id: `auto:${Y}:${name}:${from}`, from, to: to || from, name, kind, auto: true }));
}
/** all holidays of a school year: automatic (unless switched off) + own */
export function holidays(Y) {
  const off = new Set(records('holoff', [LSP]).map((r) => r.key));
  const own = records('hol', [LSP]).filter((h) => h.from <= yEnd(Y) && (h.to || h.from) >= yStart(Y)).map((h) => ({ ...h, to: h.to || h.from }));
  return autoHolidays(Y).map((h) => ({ ...h, off: off.has(`${h.name}:${h.from}`) })).concat(own).sort((a, b) => (a.from < b.from ? -1 : 1));
}
const RANK = { 'αργία': 3, 'γιορτή': 2, 'ειδική': 1 };

// ---- cached computation (rebuilt when the data changes) ----
let cache = { v: -1 };
function build() {
  if (cache.v === state.version) return cache;
  const all = records('student', [LSP]).sort((a, b) => a.name.localeCompare(b.name, 'el'));
  const byId = new Map(all.map((s) => [s.id, s]));
  const students = all.filter((s) => !s.archived);               // archived = old school years (from the old Excel files)
  const archive = all.filter((s) => s.archived);
  const slots = records('sched', [LSP]).filter((s) => byId.has(s.stu));
  const lx = records('lx', [LSP]).filter((x) => byId.has(x.stu));
  // holidays for every school year that has a slot or a lesson
  const years = new Set([yearOf(today())]);
  for (const s of slots) { years.add(yearOf(s.from)); if (s.to) years.add(yearOf(s.to)); }
  for (const x of lx) years.add(yearOf(x.d));
  const hol = new Map();                                   // date -> {name, kind}
  for (const Y of years) for (const h of holidays(Y)) {
    if (h.off) continue;
    for (let d = h.from; d <= h.to; d = addDays(d, 1)) { const cur = hol.get(d); if (!cur || RANK[h.kind] > RANK[cur.kind]) hol.set(d, h); }
  }
  // scheduled lessons
  const L = new Map();                                     // `${stu}|${d}` -> lesson
  for (const sl of slots) {
    const st = byId.get(sl.stu);
    let from = sl.from || yStart(yearOf(today())); if (st.start && st.start > from) from = st.start;
    let to = sl.to || yEnd(yearOf(sl.from || today())); if (st.end && st.end < to) to = st.end;
    let d = from; const k = (sl.wd - wd(d) + 7) % 7; d = addDays(d, k);
    for (; d <= to; d = addDays(d, 7)) {
      if (hol.get(d)?.kind === 'αργία') continue;
      const key = `${sl.stu}|${d}`; const cur = L.get(key);
      const h = sl.h || st.dur || 1;
      if (cur) { cur.h += h; cur.sched += h; } else L.set(key, { stu: sl.stu, d, h, sched: h, time: sl.time || '', slot: sl.id });
    }
  }
  for (const x of lx) {
    const key = `${x.stu}|${x.d}`; const cur = L.get(key);
    if (cur) { cur.oh = cur.h; cur.otime = cur.time; cur.h = x.h || 0; cur.ov = x.id; if (x.time) cur.time = x.time; if (x.v != null) cur.fv = x.v; }
    else L.set(key, { stu: x.stu, d: x.d, h: x.h || 0, sched: 0, time: x.time || '', ov: x.id, fv: x.v });
  }
  const cancelled = [];                                          // προγραμματισμένα που ακυρώθηκαν (για το «δεν θα γίνει»)
  for (const [k, l] of L) if (!(l.h > 0)) { if (l.sched) cancelled.push({ stu: l.stu, d: l.d, time: l.otime || l.time }); L.delete(k); }
  const lessons = [...L.values()].map((l) => ({ ...l, v: l.fv != null ? l.fv : valueOf(byId.get(l.stu), l.d, l.h) }))
    .sort((a, b) => (a.d === b.d ? (a.time < b.time ? -1 : 1) : a.d < b.d ? -1 : 1));
  const pays = records('tx', [LSP]).filter((r) => r.stu && byId.has(r.stu)).concat(records('lpay', [LSP]).filter((r) => byId.has(r.stu)));
  cache = { v: state.version, students, archive, byId, slots, lx, hol, lessons, pays, cancelled, labels: null };
  return cache;
}
export const students = () => build().students;
export const archive = () => build().archive;
const firstName = (s) => (s.full || s.name || '').trim().split(/\s+/)[0];
/** how a student is shown: first name; full name only when two active students share it */
export function label(s) {
  if (!s) return '';
  const c = build();
  if (!c.labels) {
    c.labels = new Map(); const act = c.students.filter((x) => isActive(x));
    for (const x of c.students) {
      const f = firstName(x);
      const dup = isActive(x) && act.some((y) => y.id !== x.id && firstName(y) === f);
      c.labels.set(x.id, dup ? (x.full || x.name) : f);
    }
  }
  return c.labels.get(s.id) || firstName(s);
}
export const student = (id) => build().byId.get(id);
export const slots = (stu) => build().slots.filter((s) => !stu || s.stu === stu);
export const holidayOn = (d) => build().hol.get(d);
/** lessons (only those with hours > 0 unless all=true) */
export function lessons({ stu, from = '0000', to = '9999', all = false } = {}) {
  return build().lessons.filter((l) => (!stu || l.stu === stu) && l.d >= from && l.d <= to && (all || l.h > 0));
}
export function payments(stu) {
  return build().pays.filter((p) => !stu || p.stu === stu).sort((a, b) => (a.d < b.d ? 1 : -1));
}

/** price per hour at a date (price / duration; later price changes in «rates») */
export function rateAt(st, d) {
  if (!st) return 0;
  let price = st.price, dur = st.dur;
  for (const r of st.rates || []) if (r.from <= d) { price = r.price; dur = r.dur; }
  return price && dur ? price / dur : 0;
}
/** αξία μαθήματος: αν κρατάει όσο το κανονικό (±1΄) → ακριβώς η τιμή του μαθήματος· αλλιώς αναλογικά, στρογγυλεμένο στο λεπτό του ευρώ.
 *  (π.χ. 40 € για 1:20 → 40,00 και όχι 39,90 από στρογγυλέματα των ωρών) */
export function valueOf(st, d, h) {
  if (!st || !h) return 0; const { price, dur } = priceAt(st, d); if (!price || !dur) return 0;
  if (Math.abs(h - dur) < 1 / 60 + 1e-9) return price;
  return Math.round(price * (h / dur) * 100) / 100;
}
export const priceAt = (st, d = today()) => { let p = st.price, du = st.dur; for (const r of st.rates || []) if (r.from <= d) { p = r.price; du = r.dur; } return { price: p, dur: du }; };
/** «now» student: not stopped, and has a lesson in the last 45 / next 60 days or a running schedule (no yearly bookkeeping) */
export function isActive(st, d = today()) {
  if (st.end && st.end < d) return false;
  if (st.start && st.start > d && st.start > addDays(d, 60)) return false;
  if (st.start && st.start >= addDays(d, -45)) return true;
  if (slots(st.id).some((s) => !s.to || s.to >= d)) return true;
  return lessons({ stu: st.id, from: addDays(d, -45), to: addDays(d, 60) }).length > 0;
}

/** balance of a student: + he owes, − paid in advance */
/** a lesson counts (value, «χρωστάει», «✓ έγινε») once it has started: earlier days, or today after its start time */
export function started(l, now = new Date()) {
  const t = today(); if (l.d < t) return true; if (l.d > t) return false;
  const m = String(l.time || '').match(/(\d{1,2})[:.](\d{2})/); if (!m) return true;
  return Number(m[1]) * 60 + Number(m[2]) <= now.getHours() * 60 + now.getMinutes();
}
export function balance(stu, asOf = today()) {
  const st = student(stu); if (!st) return 0;
  const done = lessons({ stu, to: asOf }).filter((l) => asOf !== today() || started(l)).reduce((s, l) => s + l.v, 0);
  const paid = payments(stu).reduce((s, p) => s + (p.a || 0), 0);
  return (st.open || 0) + done - paid;
}
export function summary(stu) {
  const st = student(stu); const t = today();
  const bal = balance(stu); const rate = rateAt(st, t);
  const p = payments(stu);
  const next = lessons({ stu, from: addDays(t, 1) })[0];
  return { bal, rate, unpaidH: rate && bal > 0.005 ? bal / rate : 0, lastPay: p[0] || null, next };
}

/** index 0..12 of a date inside school year Y (June start … June end), or -1 */
export function monthIdx(Y, d) {
  if (d < yStart(Y) || d > yEnd(Y)) return -1;
  return (Number(d.slice(0, 4)) - Y) * 12 + Number(d.slice(5, 7)) - 6;
}
/** month totals of a school year: lessons value (with planned), received, salaries, extras */
export function yearStats(Y) {
  const months = yMonths(Y); const t = today();
  const out = months.map((m) => ({ m, les: 0, lesDone: 0, hours: 0, recv: 0, sal: 0, salGot: 0, salExp: 0, extra: 0, total: 0 }));
  const weeks = new Set();
  for (const l of lessons({ from: yStart(Y), to: yEnd(Y) })) {
    const r = out[monthIdx(Y, l.d)];
    r.les += l.v; r.hours += l.h; if (started(l)) r.lesDone += l.v;
    weeks.add(isoWeekStart(l.d));
  }
  // salaries: what you received, in the month it concerns (md); June salary belongs to the end of the year
  const sIdx = (d) => { const i = (Number(d.slice(0, 4)) - Y) * 12 + Number(d.slice(5, 7)) - 6; return i >= 1 && i <= 12 ? i : -1; };
  for (const tx of records('tx', [LSP])) {
    if (tx.kind !== 'Έσοδο') continue;
    if (tx.cat === 'Ιδιαίτερα') { const i = monthIdx(Y, tx.md || tx.d); if (i >= 0) out[i].recv += tx.a || 0; }
    else if (tx.cat === 'Μισθός') { const i = sIdx(tx.md || tx.d); if (i >= 0) { if (tx.extra) out[i].extra += tx.a || 0; else out[i].salGot += tx.a || 0; } }
  }
  // expected salaries (for the months that have not ended yet)
  for (const s of records('sal', [LSP])) { const i = sIdx(`${s.m}-01`); if (i >= 0) out[i].salExp += s.a || 0; }
  for (const r of out) {
    const ended = eom(r.m) < t;
    r.sal = ended ? r.salGot : Math.max(r.salGot, r.salExp); r.salEst = !ended && r.salExp > r.salGot;
  }
  for (const r of out) r.total = r.les + r.sal + r.extra;
  // old years (before the app): the monthly totals of the Excel history are the official ones
  const lh = records('lhist', [LSP]).find((h) => h.y === Y); let excel = false;
  if (lh && !students().some((s) => s.start && yearOf(s.start) <= Y && (!s.end || yearOf(s.end) >= Y) && lessons({ stu: s.id, from: yStart(Y), to: yEnd(Y) }).length)) {
    excel = true;
    out.forEach((r, i) => { r.les = lh.m[i] || 0; r.sal = 0; r.extra = 0; r.salEst = false; r.total = r.les; });
  }
  const sum = (f) => out.reduce((s, r) => s + r[f], 0);
  const workMonths = weeks.size / 4.35;
  return { Y, excel, months: out, les: sum('les'), sal: sum('sal'), extra: sum('extra'), recv: sum('recv'), total: sum('total'),
           weeks: weeks.size, workMonths, avgWork: workMonths ? sum('les') / workMonths : 0 };
}
/** totals per month for old years (history) and computed years */
export function history() {
  const old = records('lhist', [LSP]).map((h) => ({ Y: h.y, m: h.m.map((x) => x ?? null), old: true }));
  const have = new Set(old.map((h) => h.Y));
  const first = lessons({}).length ? yearOf(lessons({})[0].d) : yearOf(today());
  for (let Y = first; Y <= yearOf(today()); Y++) if (!have.has(Y)) { const s = yearStats(Y); old.push({ Y, m: s.months.map((r) => r.total), old: false }); }
  return old.sort((a, b) => a.Y - b.Y).map((h) => ({ ...h, total: h.m.reduce((s, x) => s + (x || 0), 0) }));
}
export { wd, iso };

// ---- notes per lesson / student: «για την επόμενη φορά» (shown until ticked) and general notes (grades, what we did)
export const notes = (stu = null) => records('lnote', [LSP]).filter((n) => !stu || n.stu === stu).sort((a, b) => (a.d === b.d ? 0 : a.d < b.d ? 1 : -1));
export const openNotes = (stu = null) => notes(stu).filter((n) => n.imp && !n.done);
/** the student's next lesson on or after a day (for «την επόμενη φορά») */
export function nextLessonFrom(stu, d) { return lessons({ stu, from: d, to: addDays(d, 60) }).find((l) => l.h > 0) || null; }
/** from which day a «next time» note shows on the home page: the day set, else the day before the next lesson */
export function noteShow(n) {
  if (n.show) return n.show;
  const nx = nextLessonFrom(n.stu, addDays(n.d, 1)); return nx ? addDays(nx.d, -1) : n.d;
}

/** money paid in advance → which coming lessons it covers: {credit, n, hours, until, rest, next[]} */
export function prepaid(stu) {
  const bal = balance(stu); if (bal > -0.005) return null;
  let credit = -bal; const out = { credit, n: 0, hours: 0, until: null, rest: 0, next: [] };
  const t = today();
  for (const l of lessons({ stu, from: t, to: addDays(t, 366) })) {
    if (started(l) || !(l.h > 0) || !(l.v > 0)) continue;
    if (credit + 0.005 < l.v) break;
    credit -= l.v; out.n++; out.hours += l.h; out.until = l.d; out.next.push(l);
  }
  out.rest = Math.round(credit * 100) / 100;
  return out;
}

// ---------- πληρωμές: «πλήρωσε;» μετά το μάθημα ή στο τέλος του μήνα ----------
// Κάθε μαθητής έχει st.pay: 'lesson' (πληρώνει με το μάθημα) · 'month' (στο τέλος του μήνα) · 'none' / κενό (δεν ρωτάει).
// Η απάντηση κρατιέται σε εγγραφή 'lack' (k = «μαθητής|ημερομηνία» ή «μαθητής|M|μήνας»), για να μη ρωτήσει ξανά.
export const PAYMODES = [['lesson', 'Με το μάθημα'], ['month', 'Με τον μήνα'], ['none', 'Μη ρωτάς']];
export const acks = () => new Map(records('lack', [LSP]).map((a) => [a.k, a]));
/** τελείωσε: περασμένη μέρα, ή σήμερα μετά την ώρα λήξης */
export function ended(l, now = new Date()) {
  const t = today(); if (l.d < t) return true; if (l.d > t) return false;
  const m = String(l.time || '').match(/(\d{1,2})[:.](\d{2})/); if (!m) return now.getHours() >= 21;
  return Number(m[1]) * 60 + Number(m[2]) + (l.h || 1) * 60 <= now.getHours() * 60 + now.getMinutes();
}
/** ό,τι περιμένει επιβεβαίωση, παλιότερα πρώτα */
export function toConfirm(now = new Date()) {
  const t = today(); const A = acks(); const out = [];
  for (const st of students()) {
    if (st.pay !== 'lesson' && st.pay !== 'month') continue;
    if (balance(st.id) <= 0.005) continue;                       // έχει ήδη πληρώσει / προπληρώσει → τίποτα να ρωτήσω
    const since = st.paySince && st.paySince > addDays(t, -45) ? st.paySince : addDays(t, -45);
    if (st.pay === 'lesson') {
      for (const l of lessons({ stu: st.id, from: since, to: t })) { const k = `${st.id}|${l.d}`; if (ended(l, now) && !A.has(k)) out.push({ mode: 'lesson', st, l, k, d: l.d, a: Math.round(l.v * 100) / 100 }); }
    } else {
      const ms = new Set(lessons({ stu: st.id, from: since.slice(0, 7) + '-01', to: t }).map((l) => l.d.slice(0, 7)));
      for (const m of ms) {
        const k = `${st.id}|M|${m}`; if (A.has(k)) continue;
        const ls = lessons({ stu: st.id, from: `${m}-01`, to: eom(m) }); const last = ls[ls.length - 1];
        if (!last || !ended(last, now)) continue;                    // ρωτάει μετά το τελευταίο μάθημα του μήνα
        out.push({ mode: 'month', st, m, k, d: last.d, n: ls.length, a: Math.round(ls.reduce((s, l) => s + l.v, 0) * 100) / 100 });
      }
    }
  }
  return out.sort((a, b) => (a.d < b.d ? -1 : 1));
}

/** τι αξίζει μήνυμα (μόνο για μαθητές με κινητό): αύριο · αλλαγή ώρας/μέρας · ακύρωση · χρέος. sent = ό,τι έχει ήδη σταλεί */
export const hasPhone = (st) => !!(st && (st.ph || st.php || st.php2));
export function toMessage() {
  build(); const t = today(), tm1 = addDays(t, 1), wk = addDays(t, 7);
  const sent = new Map(records('lmsg', [LSP]).map((m) => [m.k, m])); const out = [];
  const ok = (stu) => { const st = cache.byId.get(stu); return st && hasPhone(st) ? st : null; };
  for (const l of cache.lessons) {
    if (l.d < t || l.d > wk) continue; const st = ok(l.stu); if (!st) continue;
    const changed = l.ov && l.sched && (l.time !== l.otime || l.h !== l.oh), extra = !l.sched;
    if (changed || (extra && l.d > t)) { const k = `C|${l.stu}|${l.d}|${l.time}|${l.h}`; if (!sent.has(k)) out.push({ kind: 'change', st, l, k, d: l.d }); }
    else if (l.d === tm1) { const k = `R|${l.stu}|${l.d}`; if (!sent.has(k)) out.push({ kind: 'remind', st, l, k, d: l.d }); }
  }
  for (const c of cache.cancelled) {
    if (c.d < t || c.d > wk) continue; const st = ok(c.stu); if (!st) continue;
    const k = `X|${c.stu}|${c.d}`; if (!sent.has(k)) out.push({ kind: 'cancel', st, l: c, k, d: c.d });
  }
  for (const st of cache.students) {
    if (!hasPhone(st)) continue; const b = balance(st.id); if (b <= 0.5) continue;
    // όχι για κάθε μικρό χρέος: μόνο αν είπες «Όχι ακόμα» ή αν το πιο παλιό απλήρωτο μάθημα είναι πάνω από 2 εβδομάδες πίσω
    const later = records('lack', [LSP]).some((a) => a.ans === 'later' && a.k.startsWith(`${st.id}|`));
    let acc = 0, oldest = null; for (const l of lessons({ stu: st.id, to: t }).reverse()) { if (acc >= b - 0.005) break; acc += l.v; oldest = l.d; }
    if (!later && !(oldest && oldest <= addDays(t, -14))) continue;
    const k = `D|${st.id}|${Math.round(b * 100)}`; const s = sent.get(k);
    if (!s) out.push({ kind: 'debt', st, k, d: '9999', a: b });
  }
  return out.sort((a, b) => (a.d < b.d ? -1 : 1));
}
