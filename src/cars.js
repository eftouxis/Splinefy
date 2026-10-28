// Cars: fill-ups (Fuelio history + expenses tagged with a car), services, km, consumption, reminders
import { records, state } from './store.js';
import { today, addMonths, addDays, norm } from './util.js';

const SP = ['shared'];
export const cars = () => records('car', SP).sort((a, b) => (a.sold ? 1 : 0) - (b.sold ? 1 : 0) || a.name.localeCompare(b.name));
export const car = (id) => cars().find((c) => c.id === id);
const FUELW = /(cng|αεριο|βενζιν|καυσιμ|diesel|πετρελ|fuel)/;
export const isFuelText = (desc) => FUELW.test(norm(desc));
/** which car an expense is about, from its description (name in text, else the car that usually takes that fuel) */
export function carFromText(desc, cat) {
  const t = norm(desc); const list = cars().filter((c) => !c.sold); if (!list.length || !t) return null;
  const byName = list.find((c) => t.includes(norm(c.name)) || (c.plate && t.includes(norm(c.plate))));
  if (byName) return byName.id;
  if (/(cng|αεριο)/.test(t)) return list.find((c) => c.fuel === 'Αέριο')?.id || null;
  if (/(βενζιν|καυσιμ)/.test(t)) return list.find((c) => c.fuel === 'Βενζίνη')?.id || null;
  return cat === 'Αυτοκίνητο' && list.length === 1 ? list[0].id : null;
}
export function fuelFromText(desc, carId) {
  const t = norm(desc);
  if (/(cng|αεριο)/.test(t)) return 'Αέριο';
  if (/βενζιν/.test(t)) return 'Βενζίνη';
  if (/(diesel|πετρελ)/.test(t)) return 'Diesel';
  return car(carId)?.fuel || 'Βενζίνη';
}

let C = { v: -1 };
function build() {
  if (C.v === state.version) return C;
  const fills = [], events = [], kms = [];
  for (const f of records('fuel', SP)) { fills.push({ ...f, src: 'Fuelio' }); if (f.km) kms.push({ car: f.car, d: f.d, km: f.km }); }
  for (const e of records('cev', SP)) { events.push({ ...e, src: 'Fuelio' }); if (e.km) kms.push({ car: e.car, d: e.d, km: e.km }); }
  for (const o of records('odo', SP)) kms.push({ car: o.car, d: o.d, km: o.km });
  const t = today();
  for (const r of records('tx')) {                      // expenses tagged with a car (from now on)
    if (!r.car || r.kind !== 'Έξοδο' || r.d > t) continue;
    const fuel = r.ft || (isFuelText(r.desc) ? fuelFromText(r.desc, r.car) : null);
    if (fuel && r.cat !== 'Αυτοκίνητο') fills.push({ id: r.id, car: r.car, d: r.d, km: r.km, q: r.q, a: r.a, ft: fuel, full: true, note: r.desc, tx: r, _sp: r._sp });
    else events.push({ id: r.id, car: r.car, d: r.d, km: r.km, typ: '', title: r.desc, a: r.a, note: r.note, tx: r, _sp: r._sp });
    if (r.km) kms.push({ car: r.car, d: r.d, km: r.km });
  }
  const by = (a, b) => (a.d < b.d ? -1 : 1);
  fills.sort(by); events.sort(by); kms.sort(by);
  C = { v: state.version, fills, events, kms };
  return C;
}
export const fills = (carId) => build().fills.filter((f) => f.car === carId);
export const events = (carId) => build().events.filter((e) => e.car === carId);
export function lastKm(carId, upTo = '9999') {
  let m = 0; for (const k of build().kms) if (k.car === carId && k.d <= upTo && k.km > m) m = k.km; return m || null;
}
/** km driven between two dates (inclusive) */
export function kmIn(carId, from, to) {
  const ks = build().kms.filter((k) => k.car === carId);
  const before = Math.max(0, ...ks.filter((k) => k.d < from).map((k) => k.km));
  const inside = ks.filter((k) => k.d >= from && k.d <= to).map((k) => k.km);
  if (!inside.length) return 0;
  const hi = Math.max(...inside), lo = before || Math.min(...inside);
  return Math.max(0, hi - lo);
}
/** fuel used per 100 km of driving (all fuels share the same km): fills after the first km reading up to the last one.
 *  Works for bi-fuel cars too (e.g. 5 kg gas + 1 l petrol per 100 km) and needs km only now and then, not at every fill. */
export function consumption(carId, ft, from, to) {
  const all = fills(carId).filter((f) => f.d >= from && f.d <= to);
  const wk = all.filter((f) => f.km).sort((a, b) => a.km - b.km || (a.d < b.d ? -1 : 1));
  if (wk.length < 2) return null;
  const first = wk[0], last = wk[wk.length - 1]; const dist = last.km - first.km; if (dist <= 0) return null;
  const q = all.filter((f) => f !== first && f.ft === ft && f.q && (f.km ? f.km > first.km && f.km <= last.km : f.d > first.d && f.d <= last.d)).reduce((s, f) => s + f.q, 0);
  return q ? (q / dist) * 100 : null;
}
/** car that runs on two fuels (CNG cars always have petrol too) */
export const isBi = (carId) => { const c = car(carId); if (!c) return false; const fs = new Set(fills(carId).map((f) => f.ft)); return c.fuel === 'Αέριο' || fs.size > 1; };
export function money(carId, from, to) {
  const fu = fills(carId).filter((f) => f.d >= from && f.d <= to).reduce((s, f) => s + (f.a || 0), 0);
  const sv = events(carId).filter((e) => e.d >= from && e.d <= to).reduce((s, e) => s + (e.a || 0), 0);
  return { fuel: fu, service: sv, total: fu + sv };
}
export function summary(carId) {
  const t = today(); const y0 = `${t.slice(0, 4)}-01-01`; const m12 = addMonths(t, -12);
  const km12 = kmIn(carId, m12, t); const mo12 = money(carId, m12, t); const yr = money(carId, y0, t);
  const fuelKm = (() => {
    const all = fills(carId).filter((f) => f.d >= m12); const wk = all.filter((f) => f.km).sort((a, b) => a.km - b.km); if (wk.length < 2) return null;
    const first = wk[0], last = wk[wk.length - 1], d = last.km - first.km; if (d <= 0) return null;
    return (all.filter((f) => f !== first && (f.km ? f.km > first.km && f.km <= last.km : f.d > first.d && f.d <= last.d)).reduce((s, f) => s + (f.a || 0), 0) / d) * 100;
  })();
  return { last: lastKm(carId), kmMonth: km12 / 12, km12, petrol: consumption(carId, 'Βενζίνη', m12, t), gas: consumption(carId, 'Αέριο', m12, t),
    eur100: fuelKm, year: yr, perKm: km12 ? mo12.total / km12 : null };
}
/** reminders with their next due date */
export function reminders(carId) {
  const t = today(); const s = carId ? summary(carId) : null;
  return records('crem', SP).filter((r) => !carId || r.car === carId).map((r) => {
    const c = [];
    if (r.until) c.push(r.until);
    if (r.last && r.months) c.push(addMonths(r.last, r.months));
    let kmLeft = null;
    if (r.lastKm && r.km) {
      const cs = summary(r.car); kmLeft = r.lastKm + r.km - (cs.last || r.lastKm);
      if (cs.kmMonth > 0) c.push(addDays(t, Math.round(kmLeft / (cs.kmMonth / 30.4))));
    }
    const next = c.sort()[0] || null;
    const days = next ? Math.round((new Date(next) - new Date(t)) / 864e5) : null;
    return { ...r, next, kmLeft, days, status: !next ? '' : days < 0 ? 'late' : days <= 30 ? 'soon' : 'ok' };
  }).sort((a, b) => (a.next || '9') < (b.next || '9') ? -1 : 1);
  void s;
}
