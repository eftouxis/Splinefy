// Money with other people (sister, mother, friends): who owes whom.
// Two sources: shares of expenses you paid (oth on a movement / recurring item) and direct entries (pmov).
import { records, state } from './store.js';
import { movements, othSum } from './ledger.js';
import { today } from './util.js';

export const KINDS = {                      // sign: + they owe me · − I owe them
  owesme: { s: +1, label: 'Μου χρωστάει', hint: 'νέο χρέος: π.χ. πλήρωσα κάτι για αυτόν/ή' },
  iowe: { s: -1, label: 'Του/της χρωστάω', hint: 'νέο χρέος: π.χ. πλήρωσε κάτι για μένα' },
  got: { s: -1, label: 'Μου έδωσε', hint: 'μου έδωσε χρήματα — ξεχρεώνει ό,τι μου χρωστούσε (ή του/της χρωστάω εγώ)' },
  gave: { s: +1, label: 'Του/της έδωσα', hint: 'έδωσα χρήματα — ξεχρεώνω ό,τι του/της χρωστούσα' },
  set: { s: 0, label: 'Υπόλοιπο από λογαριασμό', hint: 'γράφεις το υπόλοιπο όπως το λέει ο λογαριασμός (π.χ. κοινοχρήστων) και η εφαρμογή βάζει τη διαφορά' },
};
const mySpace = () => state.spaces.find((s) => s.owner === state.user && s.members.length === 1 && s.members.includes(state.user));
export const peopleSpace = () => mySpace()?.id || 'shared';
export const people = () => records('person').sort((a, b) => a.name.localeCompare(b.name, 'el'));
export const person = (id) => people().find((p) => p.id === id);
/** all entries for one person: {d, a(signed), what, src} newest first */
export function entries(pid) {
  const t = today(); const out = [];
  for (const r of movements()) {
    // an expense paid from the credit we have with them (e.g. common charges from the building's credit)
    if (r.cred === pid && r.credA && r.d <= t && !r.skipped) out.push({ d: r.d, a: -r.credA, what: `${r.desc || r.cat} (από το πιστωτικό)`, tx: r });
    if (!r.oth || r.d > t || r.skipped) continue;
    for (const o of r.oth) {
      if (o.p !== pid) continue;
      const share = o.a != null ? o.a : (o.f || 0) * (r.a || 0);
      const sign = r.payer === state.user ? +1 : 0;            // owes the one who paid
      if (sign) out.push({ d: r.d, a: share * sign, what: `${r.desc || r.cat} (${fmtShare(o, r)})`, tx: r });
    }
  }
  for (const m of records('pmov')) if (m.p === pid) out.push({ d: m.d, a: (KINDS[m.k]?.s || 0) * (m.a || 0), what: m.note || KINDS[m.k]?.label || '', m });
  // «Υπόλοιπο από λογαριασμό»: the balance becomes exactly that amount (+ they owe us · − we owe them) → its entry is the difference
  out.sort((a, b) => (a.d !== b.d ? (a.d < b.d ? -1 : 1) : (a.m?.k === 'set') - (b.m?.k === 'set')));
  let run = 0; for (const e of out) { if (e.m?.k === 'set') { e.a = Math.round(((e.m.a || 0) * (e.m.sign || 1) - run) * 100) / 100; e.setTo = (e.m.a || 0) * (e.m.sign || 1); } run += e.a; }
  return out.reverse();
}
const fmtShare = (o, r) => (o.a != null ? `μερίδιο ${String(Math.round(o.a * 100) / 100).replace('.', ',')} €` : o.f === 0.5 ? 'μισό' : `${Math.round(o.f * 100)}%`);
export const balance = (pid) => entries(pid).reduce((s, e) => s + e.a, 0);
/** people who owe us money that can pay an expense («πιστωτικό»), with what is available (not counting the movement being edited) */
export function credits(exceptTx = null, keep = null) {
  return people().map((p) => ({ id: p.id, name: p.name, avail: Math.round(entries(p.id).filter((e) => !(exceptTx && e.tx?.id === exceptTx)).reduce((s, e) => s + e.a, 0) * 100) / 100 }))
    .filter((c) => c.avail > 0.004 || c.id === keep);
}
export { othSum };
