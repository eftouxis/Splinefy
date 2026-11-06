// Υγεία Φιλίππου: ηλεκτρονικό βιβλιάριο — επισκέψεις (hvisit), εξετάσεις (hlab), εμβόλια (hvac), έγγραφα (hdoc), στοιχεία (hprofile). Όλα στον κοινό χώρο.
// Τα αρχεία (PDF, φωτογραφίες) πάνε στο OneDrive, στον φάκελο «<κοινός φάκελος>/Υγεία Φιλίππου» — όχι μέσα στον συγχρονισμό.
import * as store from './store.js';
import { provider } from './sync.js';
import { parseISO, today } from './util.js';

export const SP = 'shared';
export const DOC_DIR = 'Υγεία Φιλίππου';
export const KINDS = ['Νόσος', 'Εμβολιασμός', 'Έλεγχος', 'Συνταγή', 'Παραπεμπτικό', 'Βεβαίωση', 'Νοσηλεία'];
export const ANALYTES = {"rbc":["Ερυθρά αιμοσφαίρια (RBC)","Γενική αίματος","ερυθρα rbc"],
  "hgb":["Αιμοσφαιρίνη (HGB)","Γενική αίματος","hb hgb αιμοσφαιρινη αναιμια"],
  "hct":["Αιματοκρίτης (HCT)","Γενική αίματος","ht hct αιματοκριτης"],
  "mcv":["Μέσος όγκος ερυθρών (MCV)","Γενική αίματος","mcv"],
  "mch":["Μέση περιεκτικότητα HGB (MCH)","Γενική αίματος","mch"],
  "mchc":["Μέση πυκνότητα HGB (MCHC)","Γενική αίματος","mchc"],
  "rdw":["Εύρος κατανομής ερυθρών (RDW)","Γενική αίματος","rdw"],
  "dek":["Δικτυοερυθροκύτταρα (ΔΕΚ)","Γενική αίματος","δεκ δικτυοερυθροκυτταρα reticulocytes"],
  "wbc":["Λευκά αιμοσφαίρια (WBC)","Γενική αίματος","λευκα wbc"],
  "neut":["Ουδετερόφιλα %","Γενική αίματος","neut ουδετεροφιλα πολυμορφοπυρηνα"],
  "lym":["Λεμφοκύτταρα %","Γενική αίματος","lym λεμφοκυτταρα"],
  "mono":["Μονοκύτταρα %","Γενική αίματος","mono mon μονοκυτταρα"],
  "eos":["Ηωσινόφιλα %","Γενική αίματος","eos ηωσινοφιλα"],
  "baso":["Βασεόφιλα %","Γενική αίματος","baso βασεοφιλα"],
  "luc":["Μεγάλα άχρωμα κύτταρα (LUC) %","Γενική αίματος","luc"],
  "plt":["Αιμοπετάλια (PLT)","Γενική αίματος","plt αιμοπεταλια"],
  "mpv":["Μέσος όγκος PLT (MPV)","Γενική αίματος","mpv"],
  "pct":["Αιμοπεταλιοκρίτης (PCT)","Γενική αίματος","pct"],
  "pdw":["Εύρος κατανομής PLT (PDW)","Γενική αίματος","pdw"],
  "fe":["Σίδηρος ορού (Fe)","Σίδηρος","σιδηρος fe iron σιδηροπενια"],
  "ferr":["Φερριτίνη","Σίδηρος","φερριτινη ferritin fer σιδηρος"],
  "urea":["Ουρία","Βιοχημικές","ουρια urea"],
  "crea":["Κρεατινίνη","Βιοχημικές","κρεατινινη creatinine crea νεφρα"],
  "na":["Νάτριο (Na)","Βιοχημικές","νατριο na"],
  "k":["Κάλιο (K)","Βιοχημικές","καλιο k"],
  "ca":["Ασβέστιο ολικό (Ca)","Βιοχημικές","ασβεστιο ca"],
  "p":["Φώσφορος (P)","Βιοχημικές","φωσφορος p"],
  "mg":["Μαγνήσιο (Mg)","Βιοχημικές","μαγνησιο mg"],
  "sgot":["SGOT (AST)","Ηπατικά","sgot ast τρανσαμινασες οξαλοξεικη ηπαρ"],
  "sgpt":["SGPT (ALT)","Ηπατικά","sgpt alt τρανσαμινασες πυροσταφυλικη ηπαρ"],
  "ggt":["γ-GT","Ηπατικά","γgt ggt γαμμα gt γλουταμυλοτρανσφερραση ηπαρ"],
  "alp":["Αλκαλική φωσφατάση (ALP)","Ηπατικά","alp αλκαλικη φωσφατασ"],
  "tbil":["Χολερυθρίνη ολική","Ηπατικά","χολερυθρινη tbil ικτερος bilirubin"],
  "dbil":["Χολερυθρίνη άμεση","Ηπατικά","χολερυθρινη αμεση dbil ικτερος"],
  "alb":["Αλβουμίνη","Ηπατικά","αλβουμινη alb λευκωματα"],
  "tp":["Ολικές πρωτεΐνες","Ηπατικά","πρωτεινες ολικα λευκωματα tp"],
  "crp":["CRP","Φλεγμονή","crp c αντιδρωσα πρωτεινη φλεγμονη"],
  "tsh":["TSH","Θυρεοειδής","tsh θυρεοειδης θυρεοτροπος"],
  "vitd":["Βιταμίνη D (25-OH)","Βιταμίνες","βιταμινη d vit d 25 oh"],
  "ige":["Ανοσοσφαιρίνη E (IgE) ολική","Αλλεργία","ige ανοσοσφαιρινη αλλεργια"],
  "a_g2":["g2 Bermuda grass (αγρωστώδη)","Αλλεργία","αλλεργια αλλεργιογονα γρασιδι grass bermuda"],
  "a_w19":["w19 Περιτάρια (Parietaria)","Αλλεργία","αλλεργια αλλεργιογονα περιταρια parietaria"],
  "a_f1":["f1 Ασπράδι αυγού","Αλλεργία","αλλεργια αλλεργιογονα αυγο egg τροφικη"],
  "a_g6":["g6 Timothy grass (φλεόχορτο)","Αλλεργία","αλλεργια αλλεργιογονα grass timothy"],
  "a_d1":["d1 Ακάρεα (D. pteronyssinus)","Αλλεργία","αλλεργια αλλεργιογονα ακαρεα σκονη dermatophagoides"],
  "a_t9":["t9 Ελιά (γύρη)","Αλλεργία","αλλεργια αλλεργιογονα ελια olive γυρη"],
  "a_m6":["m6 Alternaria (μύκητας)","Αλλεργία","αλλεργια αλλεργιογονα μυκητας μουχλα alternaria"],
  "a_t23":["t23 Κυπαρίσσι (γύρη)","Αλλεργία","αλλεργια αλλεργιογονα κυπαρισσι cypress γυρη"]};
export const GROUPS = [...new Set(Object.values(ANALYTES).map((a) => a[1]))];
/** name of any result key (custom results: «c:Όνομα») */
export const aName = (k) => ANALYTES[k]?.[0] || String(k).replace(/^c:/, '');
export const aGroup = (k) => ANALYTES[k]?.[1] || 'Άλλες';
/** key for a name typed in the form: a known test by name, else a custom one */
export function aKey(name) {
  const n = norm(name); if (!n) return null;
  const k = Object.keys(ANALYTES).find((x) => norm(ANALYTES[x][0]) === n || x === n);
  return k || 'c:' + name.trim();
}

// ---- search helpers (no accents, ς = σ) ----
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ς/g, 'σ');
/** «20,1» / «10.300» / «4.98» → number */
export function num(v) {
  v = String(v ?? '').trim(); if (!v) return NaN;
  if (v.includes(',')) return parseFloat(v.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) return parseFloat(v.replace(/\./g, ''));
  return parseFloat(v);
}
export function parseRef(ref) {
  ref = String(ref || '').trim(); if (!ref || ref === '!') return {};
  if (ref.startsWith('<')) return { hi: num(ref.slice(1)) };
  if (ref.startsWith('>')) return { lo: num(ref.slice(1)) };
  const m = ref.split('-'); return m.length === 2 ? { lo: num(m[0]), hi: num(m[1]) } : {};
}
/** row [key, value, unit, ref] → flag 'hi' | 'lo' | '' (ref «!» = marked by the lab without limits) */
export function flag(row) {
  const [, v, , ref] = row; if (ref === '!') return 'hi';
  const n = num(v), r = parseRef(ref); if (isNaN(n)) return '';
  if (r.hi != null && n > r.hi) return 'hi'; if (r.lo != null && n < r.lo) return 'lo'; return '';
}

// ---- data ----
const byD = (a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
export const profile = () => store.records('hprofile', [SP])[0] || {};
export const visits = () => store.records('hvisit', [SP]).sort(byD);
export const labs = () => store.records('hlab', [SP]).sort(byD);
export const vaccines = () => store.records('hvac', [SP]).sort((a, b) => (a.ord ?? 99) - (b.ord ?? 99) || String(a.disease).localeCompare(b.disease));
export const docs = () => store.records('hdoc', [SP]).sort(byD);
export const hasData = () => visits().length + labs().length + vaccines().length > 0;
/** every single result: {key, value, unit, ref, flag, lab} */
export function results() {
  const out = [];
  for (const l of labs()) for (const r of l.rows || []) out.push({ key: r[0], value: r[1], unit: r[2] || '', ref: r[3] === '!' ? '' : r[3] || '', flag: flag(r), lab: l });
  return out;
}
/** growth points from visits */
export const growth = () => visits().filter((v) => v.w != null || v.h != null || v.hc != null).map((v) => ({ d: v.d, w: v.w, h: v.h, hc: v.hc })).sort((a, b) => (a.d < b.d ? -1 : 1));

// ---- quick-search chips: built from the data (never written in the code) ----
const shortName = (k) => H_short(aName(k));
function H_short(n) { return String(n).replace(/\s*\([^)]*\)\s*/g, ' ').trim(); }
/** pure: what is worth one tap — tests that were ever out of range, diagnoses, medicines (most frequent first, mixed) */
export function quickFrom(vis, lb, n = 14) {
  const cnt = (m, label, d) => { label = String(label || '').trim(); const k = norm(label); if (!k || k.length < 3) return; const x = m.get(k) || { label, c: 0, d: '' }; x.c++; if (d > x.d) x.d = d; m.set(k, x); };
  const tests = new Map(), dx = new Map(), meds = new Map();
  for (const l of lb) for (const r of l.rows || []) if (flag(r)) cnt(tests, shortName(r[0]), l.d);
  for (const v of vis) {
    if (!['Έλεγχος', 'Εμβολιασμός'].includes(v.kind) && v.title && v.title.length <= 30) cnt(dx, v.title, v.d);
    for (const m of v.meds || []) { const w = String(m).trim().split(/[\s,(]+/)[0]; if (/^[\p{L}-]{3,}$/u.test(w)) cnt(meds, w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(), v.d); }
  }
  const lists = [tests, dx, meds].map((m) => [...m.values()].sort((a, b) => b.c - a.c || (a.d < b.d ? 1 : -1)));
  const out = [], seen = new Set();
  for (let i = 0; out.length < n && lists.some((l) => l.length > i); i++) for (const l of lists) { const x = l[i]; if (x && !seen.has(norm(x.label)) && out.length < n) { seen.add(norm(x.label)); out.push(x.label); } }
  return out;
}
export const quick = (n) => quickFrom(visits(), labs(), n);

// ---- age ----
export const birth = () => profile().birth || null;                 // from «Στοιχεία» (or the imported history) — never in the code
export function ageAt(s) {
  if (!birth()) return '';
  const b = parseISO(birth()), d = typeof s === 'string' ? parseISO(s) : s;
  let m = (d.getFullYear() - b.getFullYear()) * 12 + d.getMonth() - b.getMonth(); let days = d.getDate() - b.getDate();
  if (days < 0) { m--; days += new Date(d.getFullYear(), d.getMonth(), 0).getDate(); }
  if (m < 0) return '';
  if (m === 0) return days === 0 ? 'γέννηση' : `${days} ημ.`;
  const y = Math.floor(m / 12), mm = m % 12;
  return y === 0 ? `${mm} μ.${days ? ` ${days} ημ.` : ''}` : `${y} ε.${mm ? ` ${mm} μ.` : ''}`;
}
export const monthsAt = (s) => (parseISO(s) - parseISO(birth() || '2000-01-01')) / (864e5 * 30.4375);   // charts: only the distances matter

// ---- vaccines: planned doses that are due / late ----
export function vacPending() {
  const t = today(), out = [];
  for (const v of vaccines()) (v.doses || []).forEach((d, i) => {
    if (d.d || !d.from) return;
    out.push({ v, d, i, st: d.to < t ? 'late' : d.from <= t ? 'due' : 'fut' });
  });
  return out.sort((a, b) => (a.d.from < b.d.from ? -1 : 1));
}

// ---- import of a history file (.json — never part of the app's code, so it stays private) ----
const TYPES = ['hvisit', 'hlab', 'hvac', 'hdoc', 'hprofile'];
export async function importFile(file) {
  const j = JSON.parse(await file.text());
  const recs = (j.records || []).filter((r) => r && r.id && TYPES.includes(r.type));
  if (j.splinefy !== 'health' || !recs.length) throw new Error('Δεν είναι αρχείο ιστορικού υγείας.');
  await store.putMany(SP, recs.map(({ id, ...set }) => ({ id, set })));        // fixed ids: importing twice does not duplicate
  return recs.length;
}

// ---- files on OneDrive ----
async function dir() { const P = provider(); return { P, f: await P.folder(store.spaceById(SP).folder + '/' + DOC_DIR) }; }
const cache = new Map();
/** a Blob of the document's file (null if not on OneDrive yet) */
export async function fileOf(doc) {
  if (cache.has(doc.file)) return cache.get(doc.file);
  const { P, f } = await dir(); const b = await P.getBin(f, doc.file);
  if (b) cache.set(doc.file, b.type ? b : new Blob([b], { type: doc.mime || 'application/pdf' }));
  return cache.get(doc.file) || null;
}
/** upload a file; returns the name it got in the folder */
export async function upload(file, d, title, keep = null) {
  const ext = (file.name.match(/\.\w+$/) || [''])[0].toLowerCase();
  if (keep && keep.toLowerCase().endsWith(ext)) { const { P, f } = await dir(); await P.putBin(f, keep, file); cache.set(keep, file); return keep; }   // same name: replace the file
  const safe = String(title || file.name).replace(/[\\/:*?"<>|#%]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const name = `${d} ${safe}${ext && !safe.toLowerCase().endsWith(ext) ? ext : ''}`;
  const { P, f } = await dir(); await P.putBin(f, name, file); cache.set(name, file);
  return name;
}
