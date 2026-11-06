import * as store from '../store.js';

export default {
  html() {
    return `<div style="max-width:420px;margin:40px auto;text-align:center">
      <div style="font-size:54px">💶</div><h1 style="font-size:26px">Οικονομικά</h1>
      <p class="muted">Ποιος χρησιμοποιεί αυτή τη συσκευή;</p>
      <div class="grid2" style="margin-top:18px"><button class="btn primary" data-u="Άλκης" style="padding:18px">Άλκης</button>
      <button class="btn primary" data-u="Χαρά" style="padding:18px">Χαρά</button></div>
      <p class="small muted" style="margin-top:22px">Αλλάζει από τις Ρυθμίσεις. Ο καθένας βλέπει τα κοινά και μόνο τα δικά του προσωπικά.</p></div>`;
  },
  mount(root, p, ui) {
    root.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', async () => { await store.setUser(b.dataset.u); ui.go('#/settings'); }));
  },
};
