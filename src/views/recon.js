// #/recon — 🧮 Έλεγχος υπολοίπου
import { esc, eur, dFull, MONTHS } from '../util.js';
import * as R from '../recon.js';
import { sheet } from './lessons/ui.js';

let vals = {};
const num = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
const sgn = (x) => `${x >= 0 ? '+' : '−'}${eur(Math.abs(x))}`;
const row = (l, v, cls = '') => `<div class="row" style="padding:5px 0;border-bottom:1px solid var(--line,#2a3442)"><span class="grow ${cls}">${l}</span><b>${sgn(v)}</b></div>`;

export default {
  live: true,
  html() {
    const accts = R.cfg()?.accts || ['Μετρητά'];
    const b = R.base(); const e = R.expected(b); const C = R.checks();
    const actual = accts.reduce((s, a) => s + (num(vals[a]) || 0), 0); const filled = accts.some((a) => vals[a] != null && vals[a] !== '');
    const diff = e && filled ? Math.round((actual - e.total) * 100) / 100 : null;
    const ms = e ? [...e.months.entries()].sort((x, y) => (x[0] < y[0] ? 1 : -1)) : [];
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1 class="grow">🧮 Έλεγχος υπολοίπου</h1><button class="btn sm ghost" data-accts>Λογαριασμοί</button></div>
    ${!b ? `<div class="card">Χρειάζεται αφετηρία: βάλε <a href="#/settings">αρχικό υπόλοιπο στις Ρυθμίσεις</a>, ή γράψε παρακάτω τι έχεις σήμερα και πάτα «Αποδέχομαι — νέα αφετηρία».</div>` : ''}
    <div class="card"><div class="small muted" style="margin-bottom:6px">Τι έχεις σήμερα</div>
      ${accts.map((a) => `<label class="f"><span>${esc(a)}</span><input data-acct="${esc(a)}" inputmode="decimal" value="${esc(vals[a] ?? '')}" placeholder="0,00"></label>`).join('')}
      <div class="row" style="margin-top:4px"><span class="grow">Σύνολο</span><b data-actual>${eur(actual)}</b></div></div>
    ${e ? `<div class="card"><div class="small muted" style="margin-bottom:6px">Τι θα έπρεπε να έχεις</div>
      <div class="row" style="padding:5px 0;border-bottom:1px solid var(--line,#2a3442)"><span class="grow">${b.src === 'check' ? `Έλεγχος ${dFull(b.d)}` : `Αρχικό υπόλοιπο ${dFull(b.d)}`}</span><b>${eur(b.a)}</b></div>
      ${row('Έσοδα', e.inc, 'pos')}${row('Έξοδα', e.exp)}${e.inv ? row('Σε επενδύσεις / αποταμίευση', e.inv) : ''}
      ${row('Με τη Χαρά (κοινά, πληρωμές μεταξύ σας)', e.partner)}${e.phil ? row('Λεφτά του Φιλίππου που κρατάς', e.phil) : ''}${e.others ? row('Με άλλους (Οφειλές)', e.others) : ''}
      <div class="row" style="padding-top:8px"><span class="grow mid">Αναμενόμενο</span><span class="mid">${eur(e.total)}</span></div></div>` : ''}
    ${diff != null ? `<div class="card center" style="border:2px solid ${Math.abs(diff) < 5 ? 'var(--green)' : 'var(--red)'}"><div class="small muted">Διαφορά (έχεις − θα έπρεπε)</div>
      <div class="big ${Math.abs(diff) < 5 ? 'pos' : 'neg'}" style="font-size:28px;font-weight:700">${sgn(diff)}</div>
      <div class="small muted">${Math.abs(diff) < 5 ? 'Όλα συμφωνούν 👍' : diff < 0 ? 'Έχεις λιγότερα: μάλλον λείπουν έξοδα που δεν πέρασες' : 'Έχεις περισσότερα: μάλλον λείπει κάποιο έσοδο ή υπάρχει διπλό έξοδο'}</div></div>` : ''}
    ${filled ? `<button class="btn" data-save style="width:100%">💾 Αποθήκευση ελέγχου</button>
      <button class="btn primary" data-accept style="width:100%;margin-top:6px">✓ Αποδέχομαι — νέα αφετηρία</button>` : ''}
    ${ms.length ? `<h2>Ανά μήνα (από την αφετηρία)</h2><div class="small muted" style="margin:0 4px 6px">Πόσο άλλαξαν τα χρήματά σου κάθε μήνα σύμφωνα με τις κινήσεις — πάτα έναν μήνα για τις κινήσεις του.</div>
      <div class="list">${ms.slice(0, 24).map(([m, v]) => `<div class="item click" data-m="${m}"><div class="grow">${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</div><b class="${v >= 0 ? 'pos' : 'neg'}">${sgn(v)}</b></div>`).join('')}</div>` : ''}
    ${C.length ? `<h2>Προηγούμενοι έλεγχοι</h2><div class="list">${C.slice(0, 20).map((c) => `<div class="item"><div class="grow"><div class="t">${dFull(c.d)}${c.accepted ? ' · αφετηρία' : ''}</div><div class="s">είχες ${eur(c.actual)}${c.expected != null ? ` · θα έπρεπε ${eur(c.expected)}` : ''}</div></div>${c.diff != null ? `<b class="${Math.abs(c.diff) < 5 ? 'pos' : 'neg'}">${sgn(c.diff)}</b>` : ''}</div>`).join('')}</div>` : ''}`;
  },
  mount(root, p, ui) {
    root.querySelector('[data-back]')?.addEventListener('click', () => ui.go('#/apps'));
    root.querySelectorAll('[data-acct]').forEach((i) => i.addEventListener('change', () => { vals[i.dataset.acct] = i.value; ui.render(); }));
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { window.__listSet?.({ month: b.dataset.m, q: '', view: 'mine' }); ui.go('#/list'); }));
    const accts = () => R.cfg()?.accts || ['Μετρητά'];
    const got = () => Object.fromEntries(accts().map((a) => [a, num(vals[a]) || 0]));
    root.querySelector('[data-save]')?.addEventListener('click', async () => { await R.save(got(), false); ui.toast('Ο έλεγχος αποθηκεύτηκε ✓'); ui.render(); });
    root.querySelector('[data-accept]')?.addEventListener('click', async () => {
      if (!(await ui.confirm('Τα σημερινά ποσά γίνονται η νέα αφετηρία — ο επόμενος έλεγχος μετράει από σήμερα. Η διαφορά μέχρι τώρα δεν θα ξαναφαίνεται.', 'Αποδέχομαι'))) return;
      await R.save(got(), true); vals = {}; ui.toast('Νέα αφετηρία ✓'); ui.render();
    });
    root.querySelector('[data-accts]')?.addEventListener('click', () => {
      sheet(`<div class="mid">Λογαριασμοί</div><div class="small muted" style="margin:4px 0 8px">Ένας ανά γραμμή — π.χ. Μετρητά, η τράπεζά σου, Revolut. Οι επενδύσεις δεν μπαίνουν εδώ.</div>
        <textarea data-list rows="5">${esc(accts().join('\n'))}</textarea><button class="btn primary" data-ok style="width:100%;margin-top:8px">Αποθήκευση</button><button class="btn ghost" data-no style="width:100%;margin-top:6px">Άκυρο</button>`, (el, close) => {
        el.querySelector('[data-no]').onclick = close;
        el.querySelector('[data-ok]').onclick = async () => { const l = el.querySelector('[data-list]').value.split('\n').map((x) => x.trim()).filter(Boolean); if (!l.length) return; await R.setAccts(l); close(); ui.render(); };
      });
    });
  },
};
