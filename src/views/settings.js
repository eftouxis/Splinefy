import { esc } from '../util.js';
import * as store from '../store.js';
import * as sync from '../sync.js';
import { CONFIG } from '../config.js';
import * as EX from '../export.js';
import { VERSION, LOG } from './changelog.js';
import * as BK from '../backup.js';
import { sheet } from './lessons/ui.js';
let bkInfo = null;

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
    <div class="list"><a class="item" href="#/rec" style="text-decoration:none;color:inherit"><div class="dot">↻</div><div class="grow t">Επαναλαμβανόμενα</div><div class="muted">›</div></a>
      <a class="item" href="#/trips" style="text-decoration:none;color:inherit"><div class="dot">✈️</div><div class="grow t">Ταξίδια <span class="small muted">(ημερομηνίες, όνομα)</span></div><div class="muted">›</div></a>
      <a class="item" href="#/goals" style="text-decoration:none;color:inherit"><div class="dot">🎯</div><div class="grow t">Στόχοι <span class="small muted">(ξεχρέωμα, αποταμίευση)</span></div><div class="muted">›</div></a>
      <a class="item" href="#/cats" style="text-decoration:none;color:inherit"><div class="dot">🏷️</div><div class="grow t">Κατηγορίες και «Είδος»</div><div class="muted">›</div></a>
      <a class="item" href="#/names" style="text-decoration:none;color:inherit"><div class="dot">✏️</div><div class="grow t">Ενιαία ονόματα <span class="small muted">(ίδια γραφή για κάθε έξοδο)</span></div><div class="muted">›</div></a>
      <a class="item" href="#/changelog" style="text-decoration:none;color:inherit"><div class="dot">📜</div><div class="grow t">Τι άλλαξε <span class="small muted">(έκδοση ${VERSION})</span></div><div class="muted">›</div></a></div>
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
    <div class="card"><div class="small muted" style="margin-bottom:8px">🛟 <b>Αυτόματα</b>: κάθε μέρα, μετά τον συγχρονισμό, μπαίνει ένα πλήρες αντίγραφο στο OneDrive (φάκελος «${BK.BK_FOLDER}» μέσα στον φάκελο κάθε χώρου) και τα 3 τελευταία μένουν και σε αυτή τη συσκευή. Κρατιούνται: κάθε μέρα για 2 εβδομάδες, ένα την εβδομάδα για 3 μήνες, ένα τον μήνα για πάντα.</div>
      <div class="small" style="margin-bottom:8px">${bkInfo ? store.visibleSpaces().map((sp) => `${esc(sp.name)}: ${bkInfo[sp.id] ? 'τελευταίο ' + bkInfo[sp.id].split('-').reverse().join('/') : '<span class="muted">όχι ακόμα (μετά τον επόμενο συγχρονισμό)</span>'}`).join('<br>') : '…'}</div>
      <button class="btn" style="width:100%;margin-bottom:8px" data-restore>↺ Επαναφορά από αντίγραφο…</button>
      <div class="small muted" style="margin-bottom:8px">Και χειροκίνητα, σε αρχείο:</div>
      <div class="grid2"><button class="btn" data-xlsx>⬇ Excel</button><button class="btn" data-json>⬇ Πλήρες αντίγραφο</button></div></div>
    <h2>Εισαγωγή</h2>
    <div class="card"><div class="small muted" style="margin-bottom:8px">Αρχεία που φτιάχτηκαν από τα Excel (οικονομικά ή μαθήματα). Μετά ανεβαίνουν μόνα τους στο OneDrive.</div>
      <input type="file" accept=".json,application/json" multiple data-import></div>
    <h2>Εμφάνιση</h2>
    <div class="card"><div class="chips">${[['auto', 'Αυτόματο'], ['light', 'Φωτεινό'], ['dark', 'Σκούρο']].map(([v, l]) => `<button class="chip ${theme === v ? 'on' : ''}" data-theme="${v}">${l}</button>`).join('')}</div></div>
    <div class="small muted center" style="margin:16px 0">Συσκευή ${esc(S.device)} · <a href="#/changelog">έκδοση ${VERSION} (${LOG[0][1].slice(0, 5)}) · Τι άλλαξε ›</a></div>`;
  },
  mount(root, p, ui) {
    if (signed === null) sync.signedIn().then((s) => { signed = s; ui.render(); });
    if (!bkInfo || Date.now() - (bkInfo._at || 0) > 60000) Promise.all(store.visibleSpaces().map(async (sp) => [sp.id, await BK.lastBackup(sp.id)])).then((l) => { const n = { ...Object.fromEntries(l), _at: Date.now() }; const ch = JSON.stringify({ ...n, _at: 0 }) !== JSON.stringify({ ...(bkInfo || {}), _at: 0 }); bkInfo = n; if (ch) ui.render(); });
    root.querySelector('[data-restore]')?.addEventListener('click', () => restoreSheet(ui));
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

/** pick a backup (this device or OneDrive) → see what changes → restore (synced to every device) */
function restoreSheet(ui) {
  const sps = store.visibleSpaces();
  sheet(`<div class="mid">↺ Επαναφορά από αντίγραφο</div><div class="small muted">Διάλεξε χώρο και ημερομηνία. Πριν αλλάξει οτιδήποτε θα δεις τι θα αλλάξει. Η επαναφορά περνάει σε όλες τις συσκευές.</div>
    <div class="chips" style="margin:10px 0" data-sps>${sps.map((sp, i) => `<button class="chip ${i ? '' : 'on'}" data-sp="${esc(sp.id)}">${esc(sp.name)}</button>`).join('')}</div>
    <div data-bklist class="list" style="max-height:45vh;overflow:auto"><div class="item muted">…</div></div>
    <label class="small" style="display:block;margin:10px 2px">ή από αρχείο (Αντίγραφα/…json): <input type="file" accept=".json,application/json" data-bkfile></label>
    <button class="btn ghost" data-no>Κλείσιμο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    let cur = sps[0]?.id;
    const ask = async (snap, label) => {
      let x; try { x = BK.diff(snap); } catch (e) { ui.toast(e.message, 4000); return; }
      if (!x.ch.length) { ui.toast('Ίδιο με τώρα — τίποτα να αλλάξει'); return; }
      const ok = await ui.confirm(`Επαναφορά «${snap.space.name}» στο αντίγραφο ${label};\n${x.add} θα ξαναμπούν · ${x.upd} θα αλλάξουν · ${x.del} θα σβηστούν (όσα μπήκαν μετά).`, 'Επαναφορά', true);
      if (!ok) return;
      await BK.restore(snap); close(); ui.toast('Έγινε η επαναφορά ✓ — συγχρονίζεται', 4000); ui.syncNow?.(true);
    };
    const load = async () => {
      el.querySelectorAll('[data-sp]').forEach((b) => b.classList.toggle('on', b.dataset.sp === cur));
      const box = el.querySelector('[data-bklist]'); box.innerHTML = '<div class="item muted">…</div>';
      const sp = store.spaceById(cur); const loc = await BK.localBackups(cur);
      let drv = null; try { drv = await BK.driveBackups(sync.provider(), sp); } catch (e) { drv = { err: e.message }; }
      const fmt = (d) => d.split('-').reverse().join('/');
      box.innerHTML = loc.map((b, i) => `<div class="item" data-loc="${i}"><div class="dot">📱</div><div class="grow"><div class="t">${fmt(b.date)}</div><div class="s">σε αυτή τη συσκευή · ${b.n} εγγραφές</div></div><span class="muted">›</span></div>`).join('')
        + (drv.err ? `<div class="item muted small">OneDrive: ${esc(drv.err)}</div>` : drv.list.map((x) => `<div class="item" data-drv="${esc(x.name)}"><div class="dot">☁️</div><div class="grow"><div class="t">${fmt(x.name.slice(0, 10))}</div><div class="s">OneDrive · ${Math.round((x.size || 0) / 1024)} KB</div></div><span class="muted">›</span></div>`).join(''))
        || '<div class="item muted">Κανένα αντίγραφο ακόμα</div>';
      box.querySelectorAll('[data-loc]').forEach((b) => b.addEventListener('click', () => { const x = loc[Number(b.dataset.loc)]; ask(x.snap, fmt(x.date)); }));
      box.querySelectorAll('[data-drv]').forEach((b) => b.addEventListener('click', async () => { const snap = await sync.provider().get(drv.f, b.dataset.drv); if (snap) ask(snap, fmt(b.dataset.drv.slice(0, 10))); }));
    };
    el.querySelectorAll('[data-sp]').forEach((b) => b.addEventListener('click', () => { cur = b.dataset.sp; load(); }));
    el.querySelector('[data-bkfile]').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const snap = JSON.parse(await f.text()); if (snap.format !== 1 || !snap.records) throw new Error('δεν είναι αντίγραφο'); ask(snap, f.name); } catch (err) { ui.toast(err.message, 4000); }
    });
    load();
  });
}
