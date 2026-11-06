// #/trash — «Πρόσφατα διαγραμμένα»: 30 days, who deleted it, «Επαναφορά»
import { esc } from '../util.js';
import * as store from '../store.js';
import * as TR from '../trash.js';

const when = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const left = (ms) => Math.max(0, Math.ceil((ms + TR.DAYS * 864e5 - Date.now()) / 864e5));

export default {
  live: true,
  html() {
    const list = TR.recent();
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Πρόσφατα διαγραμμένα</h1></div>
    ${list.length ? `<div class="list">${list.map((t) => {
      const n = (t.items || []).length;
      return `<div class="item" style="display:block"><div class="row"><div class="grow"><b>${esc(TR.title(t))}</b>
        <div class="small muted">${when(t.at)} · ${esc(t.by || '')}${n > 1 ? ` · ${n} εγγραφές` : ''} · μένει ${left(t.at)} μέρες</div></div>
        <button class="btn sm" data-restore="${esc(t._sp)}|${esc(t.id)}">Επαναφορά</button></div></div>`;
    }).join('')}</div>` : `<div class="card muted">Δεν έχει διαγραφεί τίποτα τις τελευταίες ${TR.DAYS} μέρες.</div>`}
    <div class="note small" style="margin-top:12px">Ό,τι σβήνεις μένει εδώ ${TR.DAYS} μέρες. Τα κοινά τα βλέπετε και οι δύο, τα προσωπικά μόνο όποιος τα έχει.</div>`;
  },
  mount(root, p, ui) {
    root.querySelector('[data-back]').addEventListener('click', () => ui.back());
    root.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
      const [sp, id] = b.dataset.restore.split('|'); const t = store.anyRecord(sp, id); if (!t) return;
      t._sp = sp; b.disabled = true;
      if (await store.restore(t)) ui.toast('Επανήλθε ✓');
    }));
  },
};
