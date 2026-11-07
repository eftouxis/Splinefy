// QR και barcodes χωρίς βιβλιοθήκες: QR (byte, διόρθωση M, εκδόσεις 1–10), Code 128, EAN-13 / UPC-A / EAN-8.
// Επιστρέφει SVG (μαύρο σε λευκό, με περιθώριο) — μόνο ζωγραφίζει, δεν στέλνει τίποτα πουθενά.

// ---------- QR ----------
const EXP = new Array(512), LOG = new Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rs(data, n) {
  let g = [1]; for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); g.forEach((c, j) => { ng[j] ^= c; ng[j + 1] ^= gmul(c, EXP[i]); }); g = ng; }
  const r = new Array(n).fill(0);
  for (const d of data) { const f = d ^ r[0]; r.shift(); r.push(0); if (f) for (let j = 0; j < n; j++) r[j] ^= gmul(g[j + 1], f); }
  return r;
}
// διόρθωση M: [ec ανά μπλοκ, [πλήθος, data] ...]
const ECM = [null, [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]], [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]]];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const REM = [0, 0, 7, 7, 7, 7, 7, 0, 0, 0, 0];
const dataCap = (v) => ECM[v].slice(1).reduce((s, [n, d]) => s + n * d, 0);
const bch = (v, poly, bits) => { let r = v << bits; const deg = Math.floor(Math.log2(poly)); while (r && Math.floor(Math.log2(r)) >= deg) r ^= poly << (Math.floor(Math.log2(r)) - deg); return (v << bits) | r; };

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(String(text))];
  let v = 1; while (v <= 10 && 4 + (v < 10 ? 8 : 16) + bytes.length * 8 > dataCap(v) * 8) v++;
  if (v > 10) throw new Error('Πολύ μεγάλο για QR');
  const cap = dataCap(v) * 8; const bits = [];
  const put = (x, n) => { for (let i = n - 1; i >= 0; i--) bits.push((x >> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
  const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0; cw.length < cap / 8; p++) cw.push(p % 2 ? 0x11 : 0xec);
  // μπλοκ + διόρθωση, πλεγμένα
  const [ec, ...grp] = ECM[v]; const blocks = []; let k = 0;
  for (const [n, d] of grp) for (let i = 0; i < n; i++) { const dt = cw.slice(k, k + d); k += d; blocks.push({ dt, e: rs(dt, ec) }); }
  const out = []; const maxD = Math.max(...blocks.map((b) => b.dt.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.dt.length) out.push(b.dt[i]);
  for (let i = 0; i < ec; i++) for (const b of blocks) out.push(b.e[i]);
  const N = 17 + 4 * v; const M = Array.from({ length: N }, () => new Array(N).fill(null)); const F = Array.from({ length: N }, () => new Array(N).fill(false));
  const set = (r, c, val) => { M[r][c] = val ? 1 : 0; F[r][c] = true; };
  const finder = (r, c) => { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) { const y = r + i, x = c + j; if (y < 0 || x < 0 || y >= N || x >= N) continue;
    set(y, x, i >= 0 && i <= 6 && j >= 0 && j <= 6 && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4))); } };
  finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
  for (let i = 8; i < N - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALIGN[v], la = al[al.length - 1]; for (const r of al) for (const c of al) { if ((r === 6 && c === 6) || (r === 6 && c === la) || (r === la && c === 6)) continue; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) set(r + i, c + j, Math.max(Math.abs(i), Math.abs(j)) !== 1); }
  // κρατημένα: format (και version από 7)
  for (let i = 0; i < 9; i++) { if (!F[8][i]) set(8, i, 0); if (!F[i][8]) set(i, 8, 0); }
  for (let i = 0; i < 8; i++) { set(8, N - 1 - i, 0); set(N - 1 - i, 8, 0); }
  set(N - 8, 8, 1);                                                  // dark module
  if (v >= 7) { const vi = bch(v, 0x1f25, 12); for (let i = 0; i < 18; i++) { const b = (vi >> i) & 1; const a = Math.floor(i / 3), c = N - 11 + (i % 3); set(a, c, b); set(c, a, b); } }
  // δεδομένα, ζιγκ-ζαγκ
  const db = []; out.forEach((b) => { for (let i = 7; i >= 0; i--) db.push((b >> i) & 1); }); for (let i = 0; i < REM[v]; i++) db.push(0);
  let bi = 0;
  for (let c = N - 1; c > 0; c -= 2) { if (c === 6) c--; for (let t = 0; t < N; t++) { const up = ((N - 1 - c) >> 1) % 2 === 0; const r = up ? N - 1 - t : t;
    for (let j = 0; j < 2; j++) { const x = c - j; if (!F[r][x]) M[r][x] = db[bi++] || 0; } } }
  const MASK = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];
  const withMask = (m) => {
    const A = M.map((row, r) => row.map((x, c) => (F[r][c] ? x : x ^ (MASK[m](r, c) ? 1 : 0))));
    const fi = bch((0 << 3) | m, 0x537, 10) ^ 0x5412;                  // M = 00
    for (let i = 0; i < 15; i++) { const b = (fi >> i) & 1;
      if (i < 6) A[i][8] = b; else if (i < 8) A[i + 1][8] = b; else A[N - 15 + i][8] = b;
      if (i < 8) A[8][N - 1 - i] = b; else if (i < 9) A[8][7] = b; else A[8][14 - i] = b; }
    return A;
  };
  const penalty = (A) => {
    let p = 0;
    for (let r = 0; r < N; r++) for (const line of [A[r], A.map((row) => row[r])]) {
      let run = 1; for (let i = 1; i <= N; i++) { if (i < N && line[i] === line[i - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; } }
      const s = line.join(''); for (const pat of ['10111010000', '00001011101']) { let k2 = s.indexOf(pat); while (k2 >= 0) { p += 40; k2 = s.indexOf(pat, k2 + 1); } }
    }
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const x = A[r][c]; if (x === A[r][c + 1] && x === A[r + 1][c] && x === A[r + 1][c + 1]) p += 3; }
    const dark = A.flat().filter(Boolean).length; p += Math.floor(Math.abs(dark * 20 - N * N * 10) / (N * N)) * 10;
    return p;
  };
  let best = null; for (let m = 0; m < 8; m++) { const A = withMask(m); const s = penalty(A); if (!best || s < best.s) best = { A, s }; }
  return best.A;
}
export function qrSVG(text) {
  const A = qrMatrix(text); const N = A.length, q = 4; let d = '';
  A.forEach((row, r) => row.forEach((x, c) => { if (x) d += `M${c + q} ${r + q}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N + 2 * q} ${N + 2 * q}" shape-rendering="crispEdges" style="width:100%;height:auto;background:#fff;display:block"><path d="${d}" fill="#000"/></svg>`;
}

// ---------- 1D ----------
const C128 = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
/** Code 128 → λίστα πλατών (μπάρα, κενό, μπάρα…) */
function code128(s) {
  s = String(s); const codes = [];
  if (/^\d{2,}$/.test(s)) {                                            // μόνο ψηφία: Code C (ζευγάρια), το τελευταίο μονό σε B
    codes.push(105); const n = s.length - (s.length % 2);
    for (let i = 0; i < n; i += 2) codes.push(Number(s.substr(i, 2)));
    if (n < s.length) { codes.push(100); codes.push(s.charCodeAt(n) - 32); }
  } else {
    codes.push(104);
    for (const ch of s) { const c = ch.charCodeAt(0); if (c < 32 || c > 126) throw new Error('Μη έγκυρος χαρακτήρας για Code 128'); codes.push(c - 32); }
  }
  let sum = codes[0]; for (let j = 1; j < codes.length; j++) sum += codes[j] * j; codes.push(sum % 103); codes.push(106);
  return codes.map((c) => C128[c]).join('').split('').map(Number);
}
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const Gc = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const Rc = L.map((p) => p.replace(/./g, (b) => (b === '1' ? '0' : '1')));
const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const check = (d) => { let s = 0; [...d].reverse().forEach((c, i) => { s += Number(c) * (i % 2 ? 1 : 3); }); return String((10 - (s % 10)) % 10); };
/** EAN-13 / UPC-A / EAN-8 → μοτίβο 0/1 */
function ean(s, kind) {
  s = String(s).replace(/\s/g, ''); if (!/^\d+$/.test(s)) throw new Error('Μόνο ψηφία');
  if (kind === 'UPC_A') { if (s.length === 11) s += check(s); if (s.length !== 12) throw new Error('Το UPC-A θέλει 12 ψηφία'); s = '0' + s; kind = 'EAN_13'; }
  if (kind === 'EAN_8') { if (s.length === 7) s += check(s); if (s.length !== 8) throw new Error('Το EAN-8 θέλει 8 ψηφία'); if (check(s.slice(0, 7)) !== s[7]) throw new Error('Λάθος τελευταίο ψηφίο (έλεγχος)');
    return `101${[...s.slice(0, 4)].map((d) => L[d]).join('')}01010${[...s.slice(4)].map((d) => Rc[d]).join('')}101`; }
  if (s.length === 12) s += check(s); if (s.length !== 13) throw new Error('Το EAN-13 θέλει 13 ψηφία');
  if (check(s.slice(0, 12)) !== s[12]) throw new Error('Λάθος τελευταίο ψηφίο (έλεγχος) — ξανακοίτα τον αριθμό');
  const p = PAR[s[0]];
  return `101${[...s.slice(1, 7)].map((d, i) => (p[i] === 'L' ? L : Gc)[d]).join('')}01010${[...s.slice(7)].map((d) => Rc[d]).join('')}101`;
}
export function barSVG(text, kind) {
  let mods = '';
  if (kind === 'CODE_128') { code128(text).forEach((w, i) => { mods += (i % 2 ? '0' : '1').repeat(w); }); }
  else mods = ean(text, kind);
  const q = 10, W = mods.length + 2 * q, H = Math.round(W * 0.35); let d = '';
  for (let i = 0; i < mods.length;) { if (mods[i] === '1') { let n = 1; while (mods[i + n] === '1') n++; d += `M${i + q} 0h${n}v${H}h-${n}z`; i += n; } else i++; }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:100%;height:auto;aspect-ratio:${W}/${H};background:#fff;display:block"><path d="${d}" fill="#000"/></svg>`;
}
export const TYPES = [['QR_CODE', 'QR'], ['CODE_128', 'Code 128'], ['EAN_13', 'EAN-13'], ['UPC_A', 'UPC-A'], ['EAN_8', 'EAN-8']];
export function svg(text, kind) { return kind === 'QR_CODE' || !kind ? qrSVG(text) : barSVG(text, kind); }
