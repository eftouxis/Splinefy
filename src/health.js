// Υγεία παιδιών: ηλεκτρονικό βιβλιάριο — επισκέψεις (hvisit), εξετάσεις (hlab), εμβόλια (hvac), έγγραφα (hdoc), ημερολόγιο (hlog: πυρετός, φάρμακα, συμπτώματα…), στοιχεία (hprofile: ένα ανά παιδί).
// Κάθε εγγραφή έχει child = το id του hprofile του παιδιού· χωρίς child = το πρώτο παιδί ('hprofile'). Όλα στον κοινό χώρο.
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
// ---- children ----
export const FIRST = 'hprofile';
export const childOf = (r) => r?.child || FIRST;
export const profiles = () => store.records('hprofile', [SP]).sort((a, b) => (a.id === FIRST ? -1 : b.id === FIRST ? 1 : String(a.birth || '') < String(b.birth || '') ? -1 : 1));
let curId = null;
try { curId = localStorage.getItem('health.child'); } catch {}
export function cur() { const ps = profiles(); return ps.some((p) => p.id === curId) ? curId : ps[0]?.id || FIRST; }
export function setCur(id) { curId = id; try { localStorage.setItem('health.child', id); } catch {} }
export const firstName = (p) => String(p?.name || '').trim().split(/\s+/)[0] || '';
const mine = (type, c = cur()) => store.records(type, [SP]).filter((r) => childOf(r) === c);
export const profile = (c = cur()) => profiles().find((p) => p.id === c) || {};
export const visits = (c) => mine('hvisit', c).sort(byD);
export const labs = (c) => mine('hlab', c).sort(byD);
export const vaccines = (c) => mine('hvac', c).sort((a, b) => (a.ord ?? 99) - (b.ord ?? 99) || String(a.disease).localeCompare(b.disease));
export const docs = (c) => mine('hdoc', c).sort(byD);
export const logs = (c) => mine('hlog', c).sort((a, b) => (a.t < b.t ? 1 : a.t > b.t ? -1 : 0));
export const hasData = () => profiles().length > 0 || store.records('hvisit', [SP]).length + store.records('hlab', [SP]).length + store.records('hvac', [SP]).length > 0;
/** title of the app: one child → «Υγεία · Φίλιππος», more → «Υγεία παιδιών» */
export const appTitle = () => (profiles().length > 1 ? 'Υγεία παιδιών' : firstName(profiles()[0]) ? `Υγεία · ${firstName(profiles()[0])}` : 'Υγεία παιδιών');

// ---- diary (ημερολόγιο): kind → [icon, label, health?] ----
export const LOGK = {
  temp: ['🌡️', 'Θερμοκρασία', 1], med: ['💊', 'Φάρμακο', 1], sym: ['🤒', 'Σύμπτωμα', 1], visit: ['🩺', 'Γιατρός', 1], vacc: ['💉', 'Εμβόλιο', 1],
  exam: ['🧪', 'Εξετάσεις', 1], note: ['📝', 'Σημείωση', 1], growth: ['📏', 'Μέτρηση', 0], teeth: ['🦷', 'Δόντι', 0], moment: ['⭐', 'Στιγμή', 0],
  sleep: ['😴', 'Ύπνος', 0], breast: ['🤱', 'Θηλασμός', 0], bottle: ['🍼', 'Μπιμπερό', 0], food: ['🥣', 'Φαγητό', 0], diaper: ['🧷', 'Πάνα', 0],
  pump: ['🫙', 'Άντληση', 0], bath: ['🛁', 'Μπάνιο', 0],
};
export const UNITS = ['ml', 'σταγόνες', 'πατήματα', 'mg', 'δισκία', 'φακελάκια'];
/** the latest episode: last day with temperature ≥ 38 (and what was given that day) */
export function lastFever(c) {
  const L = logs(c); const f = L.find((x) => x.k === 'temp' && num(x.val) >= 38); if (!f) return null;
  const day = f.t.slice(0, 10), same = L.filter((x) => x.t.slice(0, 10) === day);
  const max = Math.max(...same.filter((x) => x.k === 'temp').map((x) => num(x.val)).filter((n) => !isNaN(n)));
  return { day, max, meds: [...new Set(same.filter((x) => x.k === 'med').map((x) => [x.title, x.val && `${x.val} ${x.unit || ''}`.trim()].filter(Boolean).join(' ')))] };
}
/** every single result: {key, value, unit, ref, flag, lab} */
export function results() {
  const out = [];
  for (const l of labs()) for (const r of l.rows || []) out.push({ key: r[0], value: r[1], unit: r[2] || '', ref: r[3] === '!' ? '' : r[3] || '', flag: flag(r), lab: l });
  return out;
}
/** growth points: visits + diary measurements (same day → the visit wins, the diary fills what is missing) */
export function growth(c) {
  const m = new Map();
  for (const x of logs(c).filter((l) => l.k === 'growth')) { const d = x.t.slice(0, 10); const o = m.get(d) || { d }; for (const f of ['w', 'h', 'hc']) if (x[f] != null && o[f] == null) o[f] = x[f]; m.set(d, o); }
  for (const v of visits(c)) { if (v.w == null && v.h == null && v.hc == null) continue; const o = m.get(v.d) || { d: v.d }; for (const f of ['w', 'h', 'hc']) if (v[f] != null) o[f] = v[f]; m.set(v.d, o); }
  return [...m.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
}

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
export const quick = (n) => quickFrom([...visits(), ...logs().filter((l) => ['med', 'sym'].includes(l.k) && l.title).map((l) => ({ d: l.t.slice(0, 10), kind: l.k === 'med' ? 'Έλεγχος' : 'Νόσος', title: l.title, meds: l.k === 'med' ? [l.title] : [] }))], labs(), n);

// ---- age ----
export const birth = (c) => profile(c).birth || null;                 // from «Στοιχεία» (or the imported history) — never in the code
export function ageAt(s, c) {
  if (!birth(c)) return '';
  const b = parseISO(birth(c)), d = typeof s === 'string' ? parseISO(s) : s;
  let m = (d.getFullYear() - b.getFullYear()) * 12 + d.getMonth() - b.getMonth(); let days = d.getDate() - b.getDate();
  if (days < 0) { m--; days += new Date(d.getFullYear(), d.getMonth(), 0).getDate(); }
  if (m < 0) return '';
  if (m === 0) return days === 0 ? 'γέννηση' : `${days} ημ.`;
  const y = Math.floor(m / 12), mm = m % 12;
  return y === 0 ? `${mm} μ.${days ? ` ${days} ημ.` : ''}` : `${y} ε.${mm ? ` ${mm} μ.` : ''}`;
}
export const monthsAt = (s) => (parseISO(s) - parseISO(birth() || '2000-01-01')) / (864e5 * 30.4375);   // charts: only the distances matter

// ---- vaccines: planned doses that are due / late ----
export function vacPending(c) {
  const t = today(), out = [];
  for (const v of vaccines(c)) (v.doses || []).forEach((d, i) => {
    if (d.d || !d.from) return;
    out.push({ v, d, i, st: d.to < t ? 'late' : d.from <= t ? 'due' : 'fut' });
  });
  return out.sort((a, b) => (a.d.from < b.d.from ? -1 : 1));
}

// ---- import of a history file (.json — never part of the app's code, so it stays private) ----
const TYPES = ['hvisit', 'hlab', 'hvac', 'hdoc', 'hprofile', 'hlog'];
export async function importFile(file) {
  const j = JSON.parse(await file.text());
  const recs = (j.records || []).filter((r) => r && r.id && TYPES.includes(r.type));
  if (j.splinefy !== 'health' || !recs.length) throw new Error('Δεν είναι αρχείο ιστορικού υγείας.');
  await store.putMany(SP, recs.map(({ id, ...set }) => ({ id, set })));        // fixed ids: importing twice does not duplicate
  return recs.length;
}

// ---- files on OneDrive ----
/** each child's documents folder: the first child's is «Υγεία Φιλίππου» (as it always was), the others «Υγεία <όνομα>» */
export const docDir = (c = cur()) => profile(c).docDir || (c === FIRST ? DOC_DIR : `Υγεία ${firstName(profile(c)) || c}`);
async function dir(c) { const P = provider(); return { P, f: await P.folder(store.spaceById(SP).folder + '/' + docDir(c)) }; }
const cache = new Map();
/** a Blob of the document's file (null if not on OneDrive yet) */
export async function fileOf(doc) {
  if (cache.has(doc.file)) return cache.get(doc.file);
  const { P, f } = await dir(childOf(doc)); const b = await P.getBin(f, doc.file);
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
