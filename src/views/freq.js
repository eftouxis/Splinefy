// Repeat frequency picker shared by «Νέα κίνηση → Επαναλαμβάνεται» and Πάγια: presets + «Άλλο…» (κάθε Ν μέρες/εβδομάδες/μήνες/χρόνια)
import { esc } from '../util.js';

export const PRESETS = [['m1', 'κάθε μήνα', 'm', 1], ['m2', 'κάθε 2 μήνες', 'm', 2], ['m3', 'κάθε 3 μήνες', 'm', 3], ['m6', 'κάθε 6 μήνες', 'm', 6],
  ['m12', 'κάθε χρόνο', 'm', 12], ['d7', 'κάθε εβδομάδα', 'd', 7], ['d14', 'κάθε 2 εβδομάδες', 'd', 14]];
const UNITS = [['d', 'μέρες', 'd', 1], ['w', 'εβδομάδες', 'd', 7], ['m', 'μήνες', 'm', 1], ['y', 'χρόνια', 'm', 12]];
/** state {fq, cn, cu} from a stored {unit, every} */
export function fromRec(unit = 'm', every = 1) {
  const k = `${unit}${every}`; if (PRESETS.some((p) => p[0] === k)) return { fq: k };
  if (unit === 'd') return every % 7 ? { fq: 'c', cn: every, cu: 'd' } : { fq: 'c', cn: every / 7, cu: 'w' };
  return every % 12 ? { fq: 'c', cn: every, cu: 'm' } : { fq: 'c', cn: every / 12, cu: 'y' };
}
/** {unit, every} from the state, or null when the custom number is missing */
export function toRec(s) {
  if (s.fq !== 'c') { const p = PRESETS.find((x) => x[0] === (s.fq || 'm1')) || PRESETS[0]; return { unit: p[2], every: p[3] }; }
  const n = Math.round(Number(String(s.cn || '').replace(',', '.'))); if (!(n > 0)) return null;
  const u = UNITS.find((x) => x[0] === (s.cu || 'd')); return { unit: u[2], every: n * u[3] };
}
export const label = (unit, every) => { const s = fromRec(unit, every); if (s.fq !== 'c') return PRESETS.find((p) => p[0] === s.fq)[1]; return `κάθε ${s.cn} ${UNITS.find((u) => u[0] === s.cu)[1]}`; };
/** select (+ number and unit when «Άλλο…»); names: <p>, <p>n, <p>u */
export function freqHtml(p, s, style = '') {
  return `<select name="${p}" data-freq style="${style}">${PRESETS.map(([k, l]) => `<option value="${k}" ${k === s.fq ? 'selected' : ''}>${l}</option>`).join('')}<option value="c" ${s.fq === 'c' ? 'selected' : ''}>άλλο διάστημα…</option></select>
    ${s.fq === 'c' ? `<span class="row" style="gap:6px;margin-top:6px"><span class="small">κάθε</span><input name="${p}n" inputmode="numeric" value="${esc(s.cn ?? '')}" style="width:70px;padding:6px 8px" placeholder="π.χ. 10">
      <select name="${p}u" style="width:auto;padding:6px 8px">${UNITS.map(([k, l]) => `<option value="${k}" ${k === (s.cu || 'd') ? 'selected' : ''}>${l}</option>`).join('')}</select></span>` : ''}`;
}
