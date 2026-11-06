// Splinefy — υπενθυμίσεις με email (Google Apps Script, στον δικό σου λογαριασμό Google)
//
// Στήσιμο (μία φορά):
// 1. script.google.com → Νέο έργο → σβήσε ό,τι έχει και επικόλλησε όλο αυτό το αρχείο → Αποθήκευση (όνομα: Splinefy υπενθυμίσεις).
// 2. Πάνω, διάλεξε τη συνάρτηση «setup» → Εκτέλεση → δώσε άδεια (Advanced → Go to … → Allow).
//    Φτιάχνει το καθημερινό ξυπνητήρι (κάθε πρωί 7–8) και σου στέλνει ένα δοκιμαστικό email.
// 3. Ανάπτυξη (Deploy) → Νέα ανάπτυξη → τύπος «Εφαρμογή ιστού» (Web app)
//    Εκτέλεση ως: «Εγώ» · Ποιος έχει πρόσβαση: «Οποιοσδήποτε» → Ανάπτυξη → αντέγραψε τη διεύθυνση (…/exec).
// 4. Splinefy → Ρυθμίσεις → «Υπενθυμίσεις με email» → επικόλλησε τη διεύθυνση → Αποθήκευση & δοκιμή.
//
// Η εφαρμογή στέλνει εδώ μόνο τις υπενθυμίσεις (σημειώσεις μαθητών, Εργασίες, Φάρμακα: κείμενο και ώρα) — τίποτα οικονομικό.
// Τα email πάνε μόνο στον λογαριασμό που έτρεξε το script.
// «🔔 Στο κινητό»: το script βάζει γεγονός με ειδοποίηση στο Google Ημερολόγιο «Splinefy» (το βλέπεις στο κινητό σαν ειδοποίηση).
// Μετά από ενημέρωση του κώδικα: ξανατρέξε «setup» (θα ζητήσει άδεια και για το Ημερολόγιο) — η διεύθυνση /exec μένει ίδια αν κάνεις
// «Διαχείριση αναπτύξεων → ✎ → Έκδοση: Νέα έκδοση».

const P = PropertiesService.getScriptProperties();
const TZ = 'Europe/Athens';
const me = () => Session.getEffectiveUser().getEmail();
const out = (s) => ContentService.createTextOutput(s);
const todayStr = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// properties hold at most ~9 KB each: the list is kept in pieces
function putBig(key, val) {
  const str = JSON.stringify(val); const n = Math.ceil(str.length / 8000) || 1; const old = Number(P.getProperty(key + '#') || 0);
  const all = {}; for (let i = 0; i < n; i++) all[`${key}_${i}`] = str.slice(i * 8000, (i + 1) * 8000); all[key + '#'] = String(n);
  P.setProperties(all); for (let i = n; i < old; i++) P.deleteProperty(`${key}_${i}`);
}
function getBig(key, def) {
  const n = Number(P.getProperty(key + '#') || 0); if (!n) return def;
  let str = ''; for (let i = 0; i < n; i++) str += P.getProperty(`${key}_${i}`) || '';
  try { return JSON.parse(str); } catch (_) { return def; }
}
function locked(fn) { const l = LockService.getScriptLock(); if (!l.tryLock(20000)) return; try { fn(); } finally { l.releaseLock(); } }
const nowStr = () => Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm");
const li = (i) => `<li style="margin:6px 0">${esc(i.icon || '📌')} <b>${esc(i.who)}</b>${i.next ? ` · ${esc(i.next)}` : ''}<br>${esc(i.text)}</li>`;
function send(list, tail) {
  // grouped by who gets them: «me» = the owner of the script, or another address (Αγωγές «και οι δύο»)
  const groups = {};
  list.forEach((i) => { const to = (i.to && i.to.length ? i.to : ['me']).map((x) => (x === 'me' ? me() : x)).join(','); (groups[to] = groups[to] || []).push(i); });
  Object.keys(groups).forEach((to) => send1(to, groups[to], tail));
}
function send1(to, list, tail) {
  MailApp.sendEmail({ to, subject: `${list.length === 1 ? `${list[0].icon || '📌'} ${list[0].who} — ${list[0].text}` : `🔔 ${list.length} υπενθυμίσεις`} · Splinefy`.slice(0, 120),
    htmlBody: `<div style="font-family:sans-serif;font-size:15px"><ul style="padding-left:18px">${list.map(li).join('')}</ul><div style="color:#888;font-size:12px">${tail}</div></div>` });
}

function doGet() { return out('Splinefy υπενθυμίσεις: εντάξει'); }

/** the app sends the whole list of open reminders: [{id, show:'yyyy-mm-dd', at?:'yyyy-mm-ddTHH:mm', icon, who, text, next}] */
function doPost(e) {
  let body; try { body = JSON.parse(e.postData.contents); } catch (_) { return out('bad'); }
  if (body.test) MailApp.sendEmail({ to: me(), subject: '✓ Splinefy: οι υπενθυμίσεις με email δουλεύουν', htmlBody: 'Από εδώ και πέρα θα σου έρχονται εδώ οι υπενθυμίσεις: Εργασίες και σημειώσεις το πρωί (ή όποτε όρισες), Φάρμακα στην ώρα της δόσης (ή λίγο πριν).' });
  if (Array.isArray(body.items)) locked(() => {
    putBig('items', body.items.slice(0, 400));
    const ids = new Set(body.items.map((i) => i.id)); const sent = getBig('sent', {});
    Object.keys(sent).forEach((k) => { if (!ids.has(k.split('|')[0])) delete sent[k]; });         // forget the closed ones
    putBig('sent', sent);
  });
  const h = Number(Utilities.formatDate(new Date(), TZ, 'H'));
  if (h >= 8) daily();                                      // written after the morning email: today's ones go now
  tick();                                                   // (tick also brings the calendar up to date)
  return out('ok');
}

/** every morning: one email with what starts today (or earlier and was never sent) — not the timed ones */
function daily() {
  locked(() => {
    const items = getBig('items', []); const sent = getBig('sent', {}); const t = todayStr();
    const due = items.filter((i) => i.ch !== 'cal' && !i.at && i.show && i.show <= t && !sent[`${i.id}|${i.show}`]);
    if (!due.length) return;
    send(due, 'Όταν γίνει, πάτα ✓ / ☐ στην εφαρμογή.');
    due.forEach((i) => { sent[`${i.id}|${i.show}`] = t; }); putBig('sent', sent);
  });
}
/** every 5 minutes: the timed ones (medicine doses) whose time came (up to 3 hours late, not older) */
function tick() {
  locked(() => {
    const items = getBig('items', []); const sent = getBig('sent', {}); const n = nowStr();
    const old = Utilities.formatDate(new Date(Date.now() - 3 * 36e5), TZ, "yyyy-MM-dd'T'HH:mm");
    const due = items.filter((i) => i.ch !== 'cal' && i.at && i.at <= n && i.at >= old && !sent[`${i.id}|${i.at}`]);
    if (!due.length) return;
    send(due, 'Όταν τη δώσεις, πάτα ✓ Δόθηκε στην εφαρμογή — η επόμενη μετράει από εκεί.');
    due.forEach((i) => { sent[`${i.id}|${i.at}`] = n; }); putBig('sent', sent);
  });
  syncCal();
}

/** «🔔 Στο κινητό» (ch:'cal'): an event with a pop-up in the calendar «Splinefy», for what comes in the next 2 days;
 *  when it is done / given / deleted in the app, its future event goes away */
function calendar() { return CalendarApp.getCalendarsByName('Splinefy')[0] || CalendarApp.createCalendar('Splinefy', { color: CalendarApp.Color.BLUE }); }
function syncCal() {
  locked(() => {
    const items = getBig('items', []).filter((i) => i.ch === 'cal' && (!i.to || !i.to.length || i.to.indexOf('me') >= 0));
    const map = getBig('cal', {}); const now = Date.now(); const ahead = now + 48 * 36e5;
    const want = {};
    items.forEach((i) => { const w = i.at || (i.show ? i.show + 'T09:00' : ''); if (!w) return;
      const t = Utilities.parseDate(w, TZ, "yyyy-MM-dd'T'HH:mm").getTime(); if (t < now - 10 * 60000 || t > ahead) return; want[`${i.id}|${w}`] = { i, t }; });
    let cal = null; const getCal = () => cal || (cal = calendar());
    Object.keys(map).forEach((k) => {
      const e = map[k];
      if (!want[k] && e.t > now) { try { const ev = getCal().getEventById(e.ev); if (ev) ev.deleteEvent(); } catch (_) { /* already gone */ } delete map[k]; }
      else if (e.t < now - 2 * 864e5) delete map[k];
    });
    Object.keys(want).forEach((k) => {
      if (map[k]) return; const { i, t } = want[k];
      const ev = getCal().createEvent(`${i.icon || '🔔'} ${i.who} — ${i.text}`.slice(0, 200), new Date(t), new Date(t + 10 * 60000), { description: `${i.next || ''}\nΣτην εφαρμογή: ✓ όταν γίνει.` });
      ev.removeAllReminders(); ev.addPopupReminder(0);
      map[k] = { ev: ev.getId(), t };
    });
    putBig('cal', map);
  });
}

/** run once (and again after updating the code): the alarms + a test email */
function setup() {
  ScriptApp.getProjectTriggers().forEach((x) => ScriptApp.deleteTrigger(x));
  ScriptApp.newTrigger('daily').timeBased().everyDays(1).atHour(7).inTimezone(TZ).create();
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(5).create();
  calendar();                                                // asks for calendar permission now and makes «Splinefy»
  MailApp.sendEmail({ to: me(), subject: 'Splinefy: το script στήθηκε', htmlBody: 'Τώρα κάνε «Ανάπτυξη → Εφαρμογή ιστού» και βάλε τη διεύθυνση στις Ρυθμίσεις της εφαρμογής.' });
}
