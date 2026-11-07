// #/cards — Κάρτες (QR / barcodes) · #/cards/<id> ανοίγει μία · #/cards/pin/<N> η «📌 N» του καθενός (συντόμευση στο κινητό)
import { esc } from '../util.js';
import * as store from '../store.js';
import * as K from '../cards.js';
import * as B from '../barcode.js';
import { sheet } from './lessons/ui.js';

let ui = null, q = '', show = '', showArch = false;
const me = () => store.state.user;
const ownerTxt = (c) => (!c.who ? '👥 Κοινή' : c.who === me() ? (K.isPrivate(c) ? '👤 Δική μου · μόνο εγώ' : '👤 Δική μου') : `🧑 ${c.who}`);
let lock = null;
const wake = async (on) => { try { if (on && !lock && navigator.wakeLock) lock = await navigator.wakeLock.request('screen'); if (!on && lock) { await lock.release(); lock = null; } } catch (_) { lock = null; } };

const tile = (c) => { const bg = c.color || '#5b6b7a', fg = K.ink(bg);
  return `<button type="button" class="card" data-c="${esc(c.id)}" style="margin:0;padding:0;overflow:hidden;border:0;text-align:left;cursor:pointer;${c.arch ? 'opacity:.55' : ''}">
    <div style="background:${esc(bg)};color:${fg};padding:12px 12px 10px;min-height:64px;display:flex;align-items:center;gap:10px">
      ${c.icon ? `<img src="${esc(c.icon)}" alt="" style="width:40px;height:40px;object-fit:contain;border-radius:8px;background:#fff">` : `<div style="width:40px;height:40px;border-radius:8px;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px">${esc((c.name || '?').trim()[0] || '?')}</div>`}
      <div style="font-weight:700;font-size:15px;line-height:1.2;word-break:break-word">${esc(c.name)}</div></div>
    <div class="small muted" style="padding:6px 12px 8px;display:flex;gap:6px">${c.star ? '⭐' : ''}${K.pinOf(c) ? `📌${K.pinOf(c)}` : ''}<span class="grow">${esc(ownerTxt(c))}</span><span>${c.fmt === 'QR_CODE' ? '▦' : '║▌'}</span></div></button>`; };

/** η κάρτα σε όλη την οθόνη, λευκό φόντο, οθόνη ανοιχτή */
export function showCard(c, u = ui) {
  ui = u || ui; let code = ''; try { code = B.svg(c.code, c.fmt); } catch (e) { code = `<div class="card" style="color:var(--red)">Δεν ζωγραφίζεται: ${esc(e.message)}</div>`; }
  K.opened(c); wake(true);
  const bg = c.color || '#5b6b7a';
  sheet(`<div style="margin:-16px -16px 0;padding:14px 16px;background:${esc(bg)};color:${K.ink(bg)};border-radius:18px 18px 0 0;display:flex;align-items:center;gap:10px">
      ${c.icon ? `<img src="${esc(c.icon)}" alt="" style="width:36px;height:36px;object-fit:contain;border-radius:8px;background:#fff">` : ''}<b class="grow" style="font-size:19px">${esc(c.name)}</b><button class="btn sm ghost" data-x style="width:auto;color:inherit">✕</button></div>
    <div style="background:#fff;padding:${c.fmt === 'QR_CODE' ? '18px 12%' : '28px 4px'};margin:0 -16px">${code}</div>
    <div style="text-align:center;font:600 17px ui-monospace,monospace;letter-spacing:1px;word-break:break-all;margin:6px 0 4px;color:#111;background:#fff;margin:0 -16px;padding:0 16px 16px">${esc(c.code.length > 60 ? c.code.slice(0, 60) + '…' : c.code)}</div>
    ${c.note ? `<div class="small" style="margin-top:10px">📝 ${esc(c.note)}</div>` : ''}
    <div class="small muted" style="margin:10px 2px">Η οθόνη μένει ανοιχτή. Αν δεν διαβάζει, ανέβασε τη φωτεινότητα.</div>
    <button class="btn" data-edit>✏️ Αλλαγές</button>`, (el, close) => {
    const leave = () => { wake(false); if (/^#\/cards\/./.test(location.hash)) history.replaceState(null, '', '#/cards'); };   // να μην ξανανοίξει
    const done = () => { leave(); close(); };
    el.parentElement.addEventListener('click', (e) => { if (e.target === el.parentElement) leave(); });
    el.querySelector('[data-x]').onclick = done;
    el.querySelector('[data-edit]').onclick = () => { leave(); close(); editSheet(c); };
  });
}

function editSheet(c = null) {
  const people = K.people(); const mine = K.mySpace();
  let fmt = c?.fmt || 'QR_CODE', who = c ? c.who || '' : me(), priv = c ? K.isPrivate(c) : false, pin = c ? K.pinOf(c) || 0 : 0;
  sheet(`<div class="mid">${c ? 'Κάρτα' : 'Νέα κάρτα'}</div>
    <label class="f" style="margin-top:10px"><span>Όνομα</span><input name="name" value="${esc(c?.name || '')}" placeholder="π.χ. Γυμναστήριο, Βρεφικός, ΑΒ"></label>
    <label class="f"><span>Κωδικός (αυτό που κρύβει το QR / ο αριθμός κάτω από το barcode)</span><textarea name="code" rows="2">${esc(c?.code || '')}</textarea></label>
    ${'BarcodeDetector' in window ? '<button type="button" class="btn" data-scan style="margin:-4px 0 12px">📷 Σάρωση με την κάμερα</button>' : ''}
    <div class="grid2"><label class="f"><span>Τύπος</span><select name="fmt">${B.TYPES.map(([v, l]) => `<option value="${v}" ${v === fmt ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f"><span>Χρώμα</span><input type="color" name="color" value="${esc(c?.color || '#5b6b7a')}" style="height:44px;padding:4px"></label></div>
    <div data-prev style="background:#fff;padding:10px;border-radius:12px;margin-bottom:12px;max-width:260px"></div>
    <label class="f"><span>Ποιανού είναι</span><div class="chips" data-who>${people.map((p) => `<button type="button" class="chip ${p === who ? 'on' : ''}" data-val="${esc(p)}">${p === me() ? '👤' : '🧑'} ${esc(p)}</button>`).join('')}<button type="button" class="chip ${!who ? 'on' : ''}" data-val="">👥 Κοινή</button></div></label>
    ${mine ? `<label class="row small" data-privf style="margin:-4px 2px 12px;gap:6px"><input type="checkbox" name="priv" style="width:auto" ${priv ? 'checked' : ''}> <span>🔒 Μόνο εγώ (δεν φτάνει καθόλου στον άλλο)</span></label>` : ''}
    <label class="f"><span>📌 Συντόμευση στο κινητό</span><div class="seg" data-pin>${[0, 1, 2, 3, 4].map((n) => `<button type="button" data-val="${n}" class="${n === pin ? 'on' : ''}">${n ? `📌 ${n}` : '—'}</button>`).join('')}</div></label>
    <div class="small muted" style="margin:-6px 2px 12px">Πατάς παρατεταμένα το εικονίδιο του Splinefy → «Κάρτα ${pin || 'N'}» → σύρ' την στην οθόνη. Ανοίγει κατευθείαν αυτή η κάρτα. Κάθε άτομο έχει τις δικές του.</div>
    <label class="f"><span>Σημείωση</span><input name="note" value="${esc(c?.note || '')}" placeholder="π.χ. PIN, ισχύει ως…"></label>
    <div class="row small" style="gap:14px;margin:0 2px 12px"><label class="row" style="gap:6px"><input type="checkbox" name="star" style="width:auto" ${c?.star ? 'checked' : ''}> ⭐ Πάνω πάνω</label>
      <label class="row" style="gap:6px"><input type="checkbox" name="arch" style="width:auto" ${c?.arch ? 'checked' : ''}> 🗄 Στο αρχείο</label></div>
    <button class="btn primary" data-ok>Αποθήκευση</button>
    ${c ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const qq = (n) => el.querySelector(`[name=${n}]`);
    const prev = () => { fmt = qq('fmt').value; const v = qq('code').value.trim(); const box = el.querySelector('[data-prev]');
      if (!v) { box.innerHTML = '<div class="small muted">Εδώ θα δεις τον κωδικό</div>'; return; }
      try { box.innerHTML = B.svg(v, fmt); } catch (e) { box.innerHTML = `<div class="small" style="color:var(--red)">${esc(e.message)}</div>`; } };
    const privVis = () => { const f = el.querySelector('[data-privf]'); if (f) f.hidden = who !== me(); };
    qq('code').addEventListener('input', prev); qq('fmt').addEventListener('change', prev); prev(); privVis();
    el.querySelectorAll('[data-who] .chip').forEach((b) => b.addEventListener('click', () => { who = b.dataset.val; el.querySelectorAll('[data-who] .chip').forEach((x) => x.classList.toggle('on', x === b)); privVis(); }));
    el.querySelectorAll('[data-pin] button').forEach((b) => b.addEventListener('click', () => { pin = Number(b.dataset.val); el.querySelectorAll('[data-pin] button').forEach((x) => x.classList.toggle('on', x === b)); }));
    el.querySelector('[data-scan]')?.addEventListener('click', () => scan((code, f) => { qq('code').value = code; if (f) qq('fmt').value = f; prev(); }));
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { if (!(await ui.confirm(`Διαγραφή «${c.name}»;`, 'Διαγραφή'))) return; await store.del(c._sp, c.id); close(); });
    el.querySelector('[data-ok]').onclick = async () => {
      const v = { name: qq('name').value.trim(), code: qq('code').value.trim(), fmt: qq('fmt').value, color: qq('color').value, note: qq('note').value.trim() || null,
        who: who || null, star: qq('star').checked ? 1 : null, arch: qq('arch').checked ? 1 : null };
      if (!v.name) { ui.toast('Γράψε όνομα'); return; } if (!v.code) { ui.toast('Γράψε τον κωδικό'); return; }
      try { B.svg(v.code, v.fmt); } catch (e) { ui.toast(e.message, 4000); return; }
      const sp = who === me() && mine && qq('priv')?.checked ? mine : 'shared';
      let id = c?.id;
      if (c && sp !== c._sp) id = await store.move(c._sp, sp, { ...c, ...v }); else id = await store.put(c?._sp || sp, c?.id || null, { type: 'card', ...v }) || c?.id;
      const fresh = K.all().find((x) => x.id === id); if (fresh && (K.pinOf(fresh) || 0) !== pin) await K.setPin(fresh, pin);
      close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}
/** σάρωση με την κάμερα (BarcodeDetector: Chrome σε Android) */
function scan(done) {
  const MAP = { qr_code: 'QR_CODE', code_128: 'CODE_128', ean_13: 'EAN_13', upc_a: 'UPC_A', ean_8: 'EAN_8' };
  sheet(`<div class="mid">Σάρωση</div><video data-v playsinline muted style="width:100%;border-radius:12px;background:#000;margin:10px 0"></video><div class="small muted">Στόχευσε τον κωδικό.</div><button class="btn ghost" data-no>Άκυρο</button>`, async (el, close) => {
    let stream = null, on = true; const stop = () => { on = false; stream?.getTracks().forEach((t) => t.stop()); close(); };
    el.querySelector('[data-no]').onclick = stop; el.parentElement.addEventListener('click', (e) => { if (e.target === el.parentElement) stop(); });
    try {
      const det = new window.BarcodeDetector({ formats: Object.keys(MAP) });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); const v = el.querySelector('[data-v]'); v.srcObject = stream; await v.play();
      const loop = async () => { if (!on) return; try { const r = await det.detect(v); if (r[0]) { done(r[0].rawValue, MAP[r[0].format]); stop(); return; } } catch (_) { /* */ } setTimeout(loop, 200); }; loop();
    } catch (e) { ui.toast('Δεν άνοιξε η κάμερα: ' + e.message, 4000); stop(); }
  });
}
/** εισαγωγή από Catima: διαλέγεις ποιες και ποιανού είναι, πριν αποθηκευτούν */
function importSheet(list) {
  const people = K.people(); const mine = K.mySpace();
  list.forEach((c) => { c.keep = !c.arch; c.who = c.who ?? null; c.priv = false; });
  const row = (c, i) => `<div class="item" style="display:block;${c.keep ? '' : 'opacity:.5'}"><div class="row"><input type="checkbox" data-keep="${i}" ${c.keep ? 'checked' : ''} style="width:auto">
      <span style="width:14px;height:14px;border-radius:4px;background:${esc(c.color || '#888')};display:inline-block"></span><b class="grow">${esc(c.name)}</b><span class="small muted">${c.arch ? 'αρχείο' : ''}</span></div>
    <div class="chips" style="margin-top:6px">${people.map((p) => `<button type="button" class="chip ${c.who === p ? 'on' : ''}" data-iw="${i}|${esc(p)}">${esc(p)}</button>`).join('')}<button type="button" class="chip ${!c.who ? 'on' : ''}" data-iw="${i}|">👥 Κοινή</button>
    ${mine && c.who === me() ? `<button type="button" class="chip ${c.priv ? 'on' : ''}" data-ip="${i}">🔒 μόνο εγώ</button>` : ''}</div></div>`;
  sheet(`<div class="mid">Εισαγωγή από Catima</div><div class="small muted" style="margin:4px 2px 10px">Βρέθηκαν ${list.length}. Διάλεξε ποιες θέλεις και ποιανού είναι (αλλάζει και αργότερα).</div>
    <div class="list" data-ilist>${list.map(row).join('')}</div><button class="btn primary" data-ok style="margin-top:10px">Εισαγωγή</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const redraw = () => { el.querySelector('[data-ilist]').innerHTML = list.map(row).join(''); bind(); };
    const bind = () => {
      el.querySelectorAll('[data-keep]').forEach((b) => b.addEventListener('change', () => { list[b.dataset.keep].keep = b.checked; redraw(); }));
      el.querySelectorAll('[data-iw]').forEach((b) => b.addEventListener('click', () => { const [i, p] = b.dataset.iw.split('|'); list[i].who = p || null; if (p !== me()) list[i].priv = false; redraw(); }));
      el.querySelectorAll('[data-ip]').forEach((b) => b.addEventListener('click', () => { const c = list[b.dataset.ip]; c.priv = !c.priv; redraw(); }));
    }; bind();
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => { const n = await K.importCards(list); close(); ui.toast(`Μπήκαν ${n} κάρτες ✓`, 4000); };
  });
}

export default {
  live: true, keepScroll: true,
  html(p) {
    const all = K.sorted();
    const has = (c) => (show === 'mine' ? c.who === me() : show === 'shared' ? !c.who : show ? c.who === show : true);
    const tok = K.nrm(q).split(/\s+/).filter(Boolean);
    const l = all.filter((c) => has(c) && (!tok.length || tok.every((t) => K.nrm(`${c.name} ${c.note || ''} ${c.who || 'κοινη'}`).includes(t))));
    const act = l.filter((c) => !c.arch), arch = l.filter((c) => c.arch);
    const others = [...new Set(all.map((c) => c.who).filter((w) => w && w !== me()))];
    const chips = all.length ? `<div class="chips" style="margin-bottom:10px">${[['', 'Όλες'], ['mine', '👤 Δικές μου'], ...others.map((o) => [o, `🧑 ${o}`]), ['shared', '👥 Κοινές']].map(([v, t]) => `<button class="chip ${show === v ? 'on' : ''}" data-show="${esc(v)}">${esc(t)}</button>`).join('')}</div>` : '';
    const grid = (x) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${x.map(tile).join('')}</div>`;
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>💳 Κάρτες</h1><button class="btn sm primary" data-new style="width:auto">+ Κάρτα</button></div>
      ${all.length > 6 ? `<div class="h-search"><input data-q value="${esc(q)}" placeholder="Αναζήτηση κάρτας…" autocomplete="off">${q ? '<button data-qx>✕</button>' : ''}</div>` : ''}${chips}
      ${all.length ? (act.length ? grid(act) : `<div class="card muted center">Καμία κάρτα εδώ.</div>`) : `<div class="card"><b>QR και barcodes σε ένα σημείο</b><div class="small muted" style="margin:6px 0 10px">Κάρτες πόντων, γυμναστήριο, σταθμός, εισιτήρια — δικές σου, της Χαράς ή κοινές. Πρόσθεσε μία με «+ Κάρτα» ή φέρε όλες από το Catima.</div></div>`}
      ${arch.length ? `<button class="btn ghost" data-arch style="margin-top:10px">🗄 Αρχείο (${arch.length}) ${showArch ? '▴' : '▾'}</button>${showArch ? grid(arch) : ''}` : ''}
      <label class="btn" style="width:100%;margin-top:14px">📥 Εισαγωγή από Catima (.zip ή .csv)<input type="file" accept=".zip,.csv,application/zip,text/csv" data-imp hidden></label>`;
  },
  mount(root, p, u) {
    ui = u;
    root.querySelector('[data-back]').addEventListener('click', () => u.go('#/apps'));
    root.querySelector('[data-new]').addEventListener('click', () => editSheet());
    root.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { const c = K.all().find((x) => x.id === b.dataset.c); if (c) showCard(c); }));
    root.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => { show = b.dataset.show; u.render(); }));
    root.querySelector('[data-arch]')?.addEventListener('click', () => { showArch = !showArch; u.render(); });
    const inp = root.querySelector('[data-q]');
    if (inp) { let tm; inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { q = inp.value.trim(); const pos = inp.selectionStart; u.render(); const ni = document.querySelector('[data-q]'); ni?.focus(); ni?.setSelectionRange(pos, pos); }, 200); }); }
    root.querySelector('[data-qx]')?.addEventListener('click', () => { q = ''; u.render(); });
    root.querySelector('[data-imp]').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return; try { const l = await K.readFile(f); if (!l.length) throw new Error('Δεν βρέθηκαν κάρτες'); importSheet(l); } catch (er) { u.toast(er.message, 5000); } e.target.value = '';
    });
    // άνοιγμα κατευθείαν: #/cards/pin/N ή #/cards/<id>
    if (p[0] && !document.querySelector('.sheet-bg')) {
      const c = p[0] === 'pin' ? K.byPin(p[1]) : K.all().find((x) => x.id === p[0]);
      if (c) showCard(c, u); else if (p[0] === 'pin') u.toast(`Δεν έχεις ορίσει κάρτα για το 📌 ${p[1]} — άνοιξε μια κάρτα → Αλλαγές → Συντόμευση`, 6000);
    }
  },
};
