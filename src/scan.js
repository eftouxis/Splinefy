// Receipt scanning: the photo is read ON THE DEVICE (tesseract.js, Greek + English) — it is never uploaded anywhere.
// From the text we take the total, the date and the shop name; the user checks them before saving.
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('δεν φορτώθηκε ο αναγνώστης (χρειάζεται ίντερνετ την πρώτη φορά)')); document.head.appendChild(s); });

/** smaller grey image → faster and better reading */
async function prepare(file, grey = true) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d', { willReadFrequently: true }); if (grey) g.filter = 'grayscale(1) contrast(1.4)'; g.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}
const JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
/** the QR of the receipt (link to the AADE / provider page) — native detector if the phone has one, else jsQR */
async function readQR(canvas) {
  try {
    if ('BarcodeDetector' in window) { const r = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(canvas); if (r[0]?.rawValue) return r[0].rawValue; }
  } catch (_) { /* not supported */ }
  try {
    if (!window.jsQR) await load(JSQR);
    const g = canvas.getContext('2d'); const im = g.getImageData(0, 0, canvas.width, canvas.height);
    const r = window.jsQR(im.data, im.width, im.height); return r?.data || null;
  } catch (_) { return null; }
}
/** try to read the receipt page the QR points to (works only if that site allows it — otherwise we read the photo) */
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
/** the text of a PDF receipt, line by line (pdf.js, on the device) */
async function pdfText(buf) {
  if (!window.pdfjsLib) { await load(PDFJS); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS.replace('pdf.min.js', 'pdf.worker.min.js'); }
  const doc = await window.pdfjsLib.getDocument({ data: buf }).promise; const out = [];
  for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items; const rows = new Map();
    for (const it of items) { const y = Math.round(it.transform[5]); const k = [...rows.keys()].find((x) => Math.abs(x - y) <= 2) ?? y; rows.set(k, [...(rows.get(k) || []), [it.transform[4], it.str]]); }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) out.push(rows.get(y).sort((a, b) => a[0] - b[0]).map((x) => x[1]).join(' ').replace(/\s+/g, ' ').trim());
  }
  return out.filter(Boolean).join('\n');
}
async function fromQR(url, cfg) {
  if (!/^https?:\/\//.test(url)) return null;
  try {
    const via = cfg?.worker ? `${cfg.worker.replace(/\/$/, '')}/?k=${encodeURIComponent(cfg.key || '')}&u=${encodeURIComponent(url)}` : url;
    const r = await fetch(via, { mode: 'cors' }); if (!r.ok) return null;
    const buf = await r.arrayBuffer(); const head = new TextDecoder('latin1').decode(buf.slice(0, 5));
    if (head === '%PDF-' || /pdf/i.test(r.headers.get('content-type') || '')) { const txt = await pdfText(buf); const p = parseReceipt(txt); return p.a ? { ...p, text: txt } : null; }
    const html = new TextDecoder('utf-8').decode(buf); const txt = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
    const p = parseReceipt(txt); return p.a ? { ...p, text: txt.slice(0, 3000) } : null;
  } catch (_) { return null; }
}
export async function scanReceipt(file, onProgress = () => {}, cfg = null) {
  // a PDF of the receipt (e.g. saved from the page the QR opens): exact text, no camera reading needed
  if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name || '')) {
    onProgress(0.3); const txt = await pdfText(await file.arrayBuffer()); onProgress(1);
    return { ...parseReceipt(txt), text: txt.slice(0, 3000), via: 'pdf' };
  }
  const canvas = await prepare(file, false);
  onProgress(0.01);
  const qr = await readQR(canvas);
  if (qr) { const p = await fromQR(qr, cfg); if (p) return { ...p, qr, via: 'qr' }; }
  if (!window.Tesseract) await load(TESS);
  onProgress(0.02);
  const worker = await window.Tesseract.createWorker(['ell', 'eng'], 1, { logger: (m) => { if (m.status === 'recognizing text') onProgress(0.1 + m.progress * 0.9); } });
  try { const { data } = await worker.recognize(await prepare(file)); return { ...parseReceipt(data.text), text: data.text, qr, via: 'ocr' }; }
  finally { await worker.terminate(); }
}

const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
// OCR mixes look-alike Latin letters into Greek words (ΑΠΟΔΕΙΞΗ read as «AΠOΔEIΞH»): turn them Greek before matching Greek words
const LAT = { A: 'Α', B: 'Β', E: 'Ε', H: 'Η', I: 'Ι', K: 'Κ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Ρ', T: 'Τ', X: 'Χ', Y: 'Υ', Z: 'Ζ' };
const gr = (s) => strip(s).replace(/[ABEHIKMNOPTXYZ]/g, (c) => LAT[c]);
/** lines that are never the shop name: document type, tax ids, address, phone… */
const NOT_SHOP = /ΕΡSΙLΟΝ|ΕΨΙΛΟΝ|SΟFΤΟΝΕ|ΕΝΤΕRSΟFΤ|ΙΜΡΑCΤ|ΡRΟSVΑSΙS|ΙLΥDΑ|ΡRΙΜΕR|DΙGΙΤΑL|ΠΑΡΟΧΟΣ|ΥΠΑΗΕΣ|ΑUΤΗΕΝΤΙCΑΤ|ΚΑΥΣΙΜΟ|ΠΟΣΟΤΗΤ|ΤΙΜΗ ΜΟΝΑΔ|ΚΩΔΙΚΟΣ|ΑΝΤΛΙΑ|ΑΚΡ\/?ΝΙΟ|ΑΠΟΔΕΙΞ|ΦΟΡΟΛΟΓ|ΤΙΜΟΛΟΓ|ΠΑΡΑΣΤΑΤ|ΛΙΑΝΙΚ|ΠΩΛΗΣ|ΠΑΡΟΧ|ΥΠΗΡΕΣ|ΣΤΟΙΧΕΙ|ΑΡΙΘΜ|ΗΜΕΡΟΜ|ΗΜ\/?ΝΙΑ|ΩΡΑ|ΑΦΜ|Α\.?Φ\.?Μ|Δ\.?Ο\.?Υ|ΔΟΥ|ΤΗΛ|ΦΑΞ|ΟΔΟΣ|ΛΕΩΦ|ΠΛΑΤΕΙΑ|Τ\.?Κ\.?\s?\d|ΑΡ\.|ΣΕΙΡΑ|ΤΑΜΕΙΟ|ΤΑΜΙΑΣ|ΑΑΔΕ|ΜΥDΑΤΑ|ΜΑΡΚ|UΙD|WWW|ΗΤΤΡ|@/;
const SHOPS = [[/SKLAVENIT|ΣΚΛΑΒΕΝΙΤ/, 'Σκλαβενίτης'], [/VASILOPOUL|ΒΑΣΙΛΟΠΟΥΛ|\bAB\b/, 'Βασιλόπουλος'], [/LIDL/, 'Lidl'], [/MASOUT|ΜΑΣΟΥΤ/, 'Μασούτης'], [/MY ?MARKET/, 'My market'],
  [/GALAXIAS|ΓΑΛΑΞΙΑΣ/, 'Γαλαξίας'], [/KRITIKOS|ΚΡΗΤΙΚΟΣ/, 'Κρητικός'], [/JUMBO/, 'Jumbo'], [/IKEA/, 'IKEA'], [/PUBLIC/, 'Public'], [/KOTSOVOLOS|ΚΩΤΣΟΒΟΛΟΣ/, 'Κωτσόβολος'],
  [/SHELL/, 'Βενζίνη Shell'], [/\bEKO\b/, 'Βενζίνη ΕΚΟ'], [/\bBP\b/, 'Βενζίνη BP'], [/AVIN/, 'Βενζίνη Avin'], [/ΦΑΡΜΑΚ|PHARMAC/, 'Φαρμακείο'], [/ΑΡΤΟΠΟΙ|ΦΟΥΡΝΟΣ|BAKERY/, 'Φούρνος'], [/ΚΡΕΟΠΩΛ/, 'Κρεοπωλείο']];
const AMT = /(\d{1,3}(?:[.\s]\d{3})*,\d{2,3}|\d+,\d{2,3}|\d+\.\d{2})(?!\d)/g;
const num = (s) => { s = s.replace(/\s/g, ''); if (/,\d{2,3}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); return Math.round(parseFloat(s) * 100) / 100; };
export function parseReceipt(text) {
  const lines = String(text || '').split(/\n/).map((l) => l.trim()).filter(Boolean); const L = lines.map(gr), S = lines.map(strip);
  // total: the amount on a «ΣΥΝΟΛΟ / ΠΛΗΡΩΤΕΟ / TOTAL» line (not «ΦΠΑ» or «ΚΑΘΑΡΗ» lines), else the largest amount
  let a = null;
  const amountsOf = (l) => [...l.matchAll(AMT)].map((m) => num(m[1])).filter((x) => x > 0 && x < 100000);
  for (const re of [/ΠΛΗΡΩΤΕ|ΠΛΗΡΩΜ[ΗΕ]|ΓΕΝΙΚΟ ΣΥΝΟΛΟ|ΣΥΝΟΛΟ ΠΛΗΡ/, /ΣΥΝΟΛ|TOTAL|SUMA|ΣΥΝ\./, /ΚΑΡΤΑ|CARD|ΜΕΤΡΗΤΑ|CASH|VISA|MASTERCARD/]) {
    for (let i = L.length - 1; i >= 0; i--) {
      const T = `${L[i]} ${S[i]}`;
      if (!re.test(T) || /Φ\.?Π\.?Α|ΚΑΘΑΡ|ΠΟΣΟΤ|ΕΚΠΤ|ΡΕΣΤΑ|CHANGE|ΠΟΝΤΟΙ|VAT|NET/.test(T)) continue;
      const v = amountsOf(L[i]).concat(L[i + 1] && !amountsOf(L[i]).length ? amountsOf(L[i + 1]) : []);
      if (v.length) { a = v[v.length - 1]; break; }
    }
    if (a != null) break;
  }
  if (a == null) { const all = L.flatMap(amountsOf); if (all.length) a = Math.max(...all); }
  // date
  let d = null;
  const fixD = (l) => l.replace(/(?<=\d)[OΟ]|[OΟ](?=\d)/g, '0').replace(/(?<=\d)[lIΙ|]|(?<=[/.\-])[lIΙ|]/g, '1');
  const isD = (l) => /ΗΜΕΡ|ΗΜ\/?ΝΙΑ|DΑΤΕ|DATE/.test(l);
  const byLabel = L.filter(isD).concat(L.filter((l) => !isD(l))).map(fixD);
  for (const l of byLabel) {
    const m = l.match(/(\d{1,2})\s?[/.\-]\s?(\d{1,2})\s?[/.\-]\s?(\d{4}|\d{2})(?!\d)/); if (!m) continue;
    let [, dd, mm, yy] = m; dd = Number(dd); mm = Number(mm); yy = Number(yy.length === 2 ? '20' + yy : yy);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 2015 && yy <= 2100) { d = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`; break; }
  }
  // shop: a known name, else the first «word» line near the top that is not address / tax number
  let shop = null; const all = `${L.join(' ')} ${S.join(' ')}`;
  for (const [re, n] of SHOPS) if (re.test(all)) { shop = n; break; }
  if (!shop) {
    const l = lines.slice(0, 8).find((x) => /[A-Za-zΑ-Ωα-ωά-ώ]{3,}/.test(x) && !NOT_SHOP.test(gr(x)) && !/TEL|FAX|VAT|RECEIPT|INVOICE/.test(strip(x)) && (x.match(/\d/g) || []).length < 4);
    if (l) shop = l.replace(/[^\p{L}\p{N}&.\- ]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()).slice(0, 40) || null;
  }
  // fuel receipts: «ΚΑΥΣΙΜΟ : CNG», «ΠΟΣΟΤΗΤΑ : 9,770 KG»
  let fuel = null, q = null;
  for (let i = 0; i < L.length; i++) {
    const g = L[i];
    if (/ΚΑΥΣΙΜΟ\s*[:.]/.test(g) || /^ΚΑΥΣΙΜΟ\b/.test(g)) { const v = S[i].split(/[:.]/).slice(1).join(' ').trim(); if (/CNG|ΦΥΣΙΚΟ/.test(v + g)) fuel = 'CNG'; else if (/LPG|ΥΓΡΑΕΡ|AUTOGAS/.test(v + g)) fuel = 'Υγραέριο'; else if (/DIESEL|ΠΕΤΡΕΛ/.test(v + g)) fuel = 'Diesel'; else if (v) fuel = 'Βενζίνη'; }
    if (/ΠΟΣΟΤΗΤ/.test(g)) { const m = S[i].match(/(\d+[.,]\d{1,3})/); if (m) q = parseFloat(m[1].replace(',', '.')); }
  }
  if (!fuel && /CNG|ΦΥΣΙΚΟ ΑΕΡΙΟ/.test(L.join(' ') + S.join(' ')) && /KG|ΚG/.test(S.join(' '))) fuel = 'CNG';
  // a fuel receipt is described by the fuel (so the car picks it up); the station name goes to the note
  let merchant = null; if (fuel) { merchant = shop && !/^(Epsilon|Εψιλον)/i.test(shop) ? shop : null; shop = fuel; }
  return { a, d, shop, fuel, q, merchant };
}
