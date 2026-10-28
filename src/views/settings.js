import { esc } from '../util.js';
import * as store from '../store.js';
import * as sync from '../sync.js';
import { CONFIG } from '../config.js';
import * as EX from '../export.js';

let signed = null;

export default {
  html() {
    const S = store.state;
    const counts = store.visibleSpaces().map((sp) => {
      const d = S.data[sp.id]; const n = d ? [...d.recs.values()].filter((r) => !r._x && r.type === 'tx').length : 0;
      return { sp, n, base: d?.hasBase };
    });
    const theme = document.documentElement.dataset.theme || 'auto';
    return `<div class="top"><h1>Ρυθμίσεις</h1></div>
    <h2>Ποιος είσαι σε αυτή τη συσκευή</h2>
    <div class="card"><div class="chips">${['Άλκης', 'Χαρά'].map((u) => `<button class="chip ${S.user === u ? 'on' : ''}" data-user="${u}">${u}</button>`).join('')}</div></div>
    <h2>Οργάνωση</h2>
    <div class="list"><a class="item" href="#/rec" style="text-decoration:none;color:inherit"><div class="dot">↻</div><div class="grow t">Πάγια</div><div class="muted">›</div></a>
      <a class="item" href="#/people" style="text-decoration:none;color:inherit"><div class="dot">🤝</div><div class="grow t">Χρωστούμενα με άλλους</div><div class="muted">›</div></a>
      <a class="item" href="#/cats" style="text-decoration:none;color:inherit"><div class="dot">🏷️</div><div class="grow t">Κατηγορίες και «Είδος»</div><div class="muted">›</div></a>
      ${store.state.user === 'Άλκης' ? '<a class="item" href="#/lessons/help" style="text-decoration:none;color:inherit"><div class="dot">📚</div><div class="grow t">Μαθήματα: οδηγίες</div><div class="muted">›</div></a>' : ''}</div>
    <h2>Συγχρονισμός (OneDrive)</h2>
    <div class="card">
      ${CONFIG.devServer ? `<div class="note">Δοκιμαστική λειτουργία: συγχρονισμός με τοπικό φάκελο δοκιμών.</div>` :
        !CONFIG.clientId ? `<div class="note">Η σύνδεση με το OneDrive ενεργοποιείται μόλις μπει το Application ID της Microsoft.</div>` :
        `<div class="row"><div class="grow">${signed ? '✓ Συνδεδεμένο με λογαριασμό Microsoft' : 'Δεν έχεις συνδεθεί'}</div>
          ${signed ? `<button class="btn sm" data-signout>Αποσύνδεση</button>` : `<button class="btn sm primary" data-signin>Σύνδεση</button>`}</div>`}
      <div class="row" style="margin-top:10px"><div class="grow small muted">${esc(syncLine())}</div><button class="btn sm" data-syncnow>Συγχρονισμός τώρα</button></div>
    </div>
    <h2>Χώροι (φάκελοι στο OneDrive)</h2>
    <div class="card">
      ${counts.map(({ sp, n, base }) => `<div style="margin-bottom:12px">
        <div class="row"><b class="grow">${esc(sp.name)}</b><span class="small muted">${n.toLocaleString('el-GR')} κινήσεις${base ? '' : ' · χωρίς αρχικά δεδομένα'}</span></div>
        <div class="small muted">${sp.members.length > 1 ? 'Το βλέπουν: ' + sp.members.join(', ') : 'Μόνο: ' + sp.members[0] + ' (ιδιωτικός φάκελος)'}</div>
        <input data-folder="${sp.id}" value="${esc(sp.folder)}" style="margin-top:6px"></div>`).join('')}
      <button class="btn sm" data-savefolders>Αποθήκευση φακέλων</button>
    </div>
    <h2>Αντίγραφο ασφαλείας</h2>
    <div class="card"><div class="small muted" style="margin-bottom:8px">Όλα σου τα δεδομένα σε αρχείο, όποτε θέλεις. Τα δεδομένα είναι πάντα και στο OneDrive· αυτό είναι επιπλέον.</div>
      <div class="grid2"><button class="btn" data-xlsx>⬇ Excel</button><button class="btn" data-json>⬇ Πλήρες αντίγραφο</button></div></div>
    <h2>Εισαγωγή</h2>
    <div class="card"><div class="small muted" style="margin-bottom:8px">Αρχεία που φτιάχτηκαν από τα Excel (οικονομικά ή μαθήματα). Μετά ανεβαίνουν μόνα τους στο OneDrive.</div>
      <input type="file" accept=".json,application/json" multiple data-import></div>
    <h2>Εμφάνιση</h2>
    <div class="card"><div class="chips">${[['auto', 'Αυτόματο'], ['light', 'Φωτεινό'], ['dark', 'Σκούρο']].map(([v, l]) => `<button class="chip ${theme === v ? 'on' : ''}" data-theme="${v}">${l}</button>`).join('')}</div></div>
    <div class="small muted center" style="margin:16px 0">Συσκευή ${esc(S.device)} · έκδοση 0.9.5 (28/10)</div>`;
  },
  mount(root, p, ui) {
    if (signed === null) sync.signedIn().then((s) => { signed = s; ui.render(); });
    root.querySelectorAll('[data-user]').forEach((b) => b.addEventListener('click', async () => { await store.setUser(b.dataset.user); ui.render(); }));
    root.querySelector('[data-signin]')?.addEventListener('click', () => sync.signIn());
    root.querySelector('[data-signout]')?.addEventListener('click', async () => { await sync.signOut(); signed = false; ui.render(); });
    root.querySelector('[data-syncnow]')?.addEventListener('click', () => ui.syncNow(true));
    root.querySelector('[data-savefolders]')?.addEventListener('click', async () => {
      const list = store.state.spaces.map((sp) => ({ ...sp, folder: root.querySelector(`[data-folder="${sp.id}"]`)?.value.trim() || sp.folder }));
      await store.setSpaces(list); ui.toast('Αποθηκεύτηκε ✓');
    });
    root.querySelector('[data-import]')?.addEventListener('change', async (e) => {
      for (const file of e.target.files) {
        try {
          const j = JSON.parse(await file.text());
          if (j.mode === 'changes') {                    // corrections over several spaces
            const by = {};
            for (const c of j.changes) {
              const d = store.state.data[c.sp]; if (!d) continue;
              if (!d.recs.has(c.id) && (c.delete || !c.set?.type)) continue;      // new records need their type
              (by[c.sp] = by[c.sp] || []).push(c.delete ? { id: c.id, del: true } : { id: c.id, set: c.set });
            }
            let n = 0; for (const [sp, ch] of Object.entries(by)) { await store.putMany(sp, ch); n += ch.length; }
            ui.toast(`${j.what || file.name}: ${n} αλλαγές ✓`, 3500); continue;
          }
          if (!j.space || !j.records) throw new Error('άγνωστη μορφή');
          if (j.mode === 'merge') {                      // e.g. lessons from the Excel: added as normal changes (they sync)
            if (!store.state.data[j.space.id]?.hasBase) throw new Error('φέρε πρώτα τα βασικά δεδομένα αυτού του χώρου');
            const ch = j.records.map(({ id, ...set }) => ({ id, set }));
            const other = {};
            for (const l of j.links || []) {
              const sp = l.sp || j.space.id; if (!store.state.data[sp]?.recs.has(l.id)) continue;
              if (sp === j.space.id) ch.push({ id: l.id, set: l.set }); else (other[sp] = other[sp] || []).push({ id: l.id, set: l.set });
            }
            await store.putMany(j.space.id, ch);
            for (const [sp, c2] of Object.entries(other)) await store.putMany(sp, c2);
            ui.toast(`${j.what || file.name}: ${ch.length} εγγραφές ✓`, 3000); continue;
          }
          if (!store.spaceById(j.space.id)) await store.setSpaces([...store.state.spaces, { ...j.space, folder: j.space.name, owner: j.space.members[0] }]);
          await store.importBase(j.space.id, j);
          ui.toast(`${file.name}: ${j.records.length.toLocaleString('el-GR')} εγγραφές ✓`);
        } catch (err) { ui.toast(`${file.name}: ${err.message}`, 4000); }
      }
      ui.render();
    });
    root.querySelector('[data-xlsx]')?.addEventListener('click', async (e) => { e.target.disabled = true; try { const n = await EX.excel(); ui.toast(`Excel με ${n.toLocaleString('el-GR')} κινήσεις ✓`); } catch (err) { ui.toast('Σφάλμα: ' + err.message, 4000); } e.target.disabled = false; });
    root.querySelector('[data-json]')?.addEventListener('click', () => { const n = EX.json(); ui.toast(`Αντίγραφο ${n.toLocaleString('el-GR')} εγγραφών ✓`); });
    root.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.theme;
      if (v === 'auto') { delete document.documentElement.dataset.theme; localStorage.removeItem('theme'); }
      else { document.documentElement.dataset.theme = v; localStorage.setItem('theme', v); }
      ui.render();
    }));
  },
};
function syncLine() {
  const s = window.__ui?.sync?.() || {};
  return s.err ? `Τελευταίο πρόβλημα: ${s.err}` : s.last ? `Τελευταίος συγχρονισμός: ${new Date(s.last).toLocaleString('el-GR')}` : 'Δεν έχει γίνει ακόμα συγχρονισμός';
}
