// #/apps — Εφαρμογές: the small apps in one place (Φάρμακα, Εργασίες, Αυτοκίνητα, Ταξίδια, Φίλιππος, Υγεία Φιλίππου, Εργασίες γραφείου)
import { esc } from '../util.js';
import * as store from '../store.js';
import * as M from '../meds.js';
import * as C from '../chores.js';
import { hasOffice } from '../office.js';
import { healthBadge } from './health.js';
import { petTitle, petBadge } from './pet.js';

const tile = (href, ic, t, s, badge = '', tone = '') => `<a class="card" href="${href}" style="display:block;margin:0;padding:16px;text-decoration:none;color:inherit;${tone ? `border-left:4px solid ${tone}` : ''}">
  <div style="font-size:30px;line-height:1">${ic}</div><div style="font-weight:700;font-size:17px;margin-top:10px">${t}</div>
  <div class="small muted" style="margin-top:4px">${s}</div>${badge ? `<div class="small" style="margin-top:6px;font-weight:700;color:${tone}">${esc(badge)}</div>` : ''}</a>`;
export default {
  live: true,
  html() {
    const me = store.state.user;
    const meds = M.active(); const nx = meds.map((m) => M.status(m).next).filter(Boolean).sort((a, b) => a.at - b.at)[0];
    const due = C.dueNow(); const odue = due.filter((c) => c.office); const hdue = due.filter((c) => !c.office);
    return `<div class="top"><h1>Εφαρμογές</h1></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${tile('#/meds', '💊', 'Φάρμακα', 'Ώρες, συνταγές, ειδοποίηση στην ώρα τους', nx ? `Επόμενη δόση ${M.when(nx.at)}` : '', nx ? '#5b8def' : '')}
      ${tile('#/chores', '✅', 'Εργασίες', 'Καθαρισμοί, εμβόλια, ανανεώσεις', hdue.length ? `${hdue.length} ${hdue.length === 1 ? 'έληξε' : 'έληξαν'}` : '', hdue.length ? '#e05a4f' : '')}
      ${hasOffice() ? tile('#/office/tasks', '🗂️', 'Εργασίες γραφείου', 'Ό,τι επαναλαμβάνεται στο γραφείο', odue.length ? `${odue.length} ${odue.length === 1 ? 'έληξε' : 'έληξαν'}` : '', odue.length ? '#e05a4f' : '') : ''}
      ${tile('#/cars', '🚗', 'Αυτοκίνητα', 'Καύσιμα, χιλιόμετρα, service')}
      ${tile('#/trips', '✈️', 'Ταξίδια', 'Έξοδα ανά ταξίδι')}
      ${tile('#/goals', '🎯', 'Στόχοι', 'Ξεχρέωμα, αποταμίευση')}
      ${tile('#/health', '🩺', 'Υγεία Φιλίππου', 'Βιβλιάριο: επισκέψεις, εξετάσεις, εμβόλια', healthBadge(), healthBadge() ? '#e9a23b' : '')}
      ${tile('#/pet', '🐕', esc(petTitle()), 'Βιβλιάριο: εμβόλια, βάρος, περιστατικά', petBadge(), petBadge() ? '#e9a23b' : '')}
      ${me === 'Άλκης' ? tile('#/philippos', '👶', 'Φίλιππος', 'Πορτοφόλι Φιλίππου') : ''}
    </div>`;
  },
};
