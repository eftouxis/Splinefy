// Small helpers: formatting, dates, escaping
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nf = new Intl.NumberFormat('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const eur = (x) => (x == null || isNaN(x) ? '–' : nf.format(Math.round(x * 100) / 100) + ' €');
export const eur0 = (x) => new Intl.NumberFormat('el-GR', { maximumFractionDigits: 0 }).format(Math.round(x || 0)) + ' €';

export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
export const addMonths = (s, n) => {
  const d = parseISO(s); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last)); return iso(d);
};
export const monthKey = (s) => s.slice(0, 7);
export const MONTHS = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
export const MONTHS_GEN = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
export const MSHORT = ['Ιαν', 'Φεβ', 'Μάρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ'];
export const DAYS = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'];
export const monthLabel = (k) => { const [y, m] = k.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
export const dShort = (s) => { const d = parseISO(s); return `${DAYS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
export const dFull = (s) => { const d = parseISO(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 20);
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** ελληνικά και greeklish στην ίδια μορφή, για αναζήτηση («magk» ≈ «μαγκ») */
const GRL = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: '8', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'i', φ: 'f', χ: 'x', ψ: '4', ω: 'o' };
export const latin = (s) => norm(s).replace(/ου/g, 'u').replace(/[α-ω]/g, (c) => GRL[c] || c)
  .replace(/th/g, '8').replace(/ps/g, '4').replace(/ch/g, 'x').replace(/ks/g, 'x').replace(/ou/g, 'u').replace(/b/g, 'v').replace(/w/g, 'o').replace(/[yh]/g, 'i').replace(/[cq]/g, 'k');
export const round2 = (x) => Math.round((x || 0) * 100) / 100;
export function parseAmount(v) {
  if (v == null) return null;
  let s = String(v).trim().replace(/\s/g, '').replace(/€/g, '').replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/[+\-*/]+$/, '');
  if (!s) return null;
  if (/^[\d.,+\-*/()]+$/.test(s)) {
    s = s.replace(/,/g, '.');
    try { const r = Function(`"use strict";return (${s})`)(); if (isFinite(r)) return round2(r); } catch (e) { /* ignore */ }
  }
  return null;
}
