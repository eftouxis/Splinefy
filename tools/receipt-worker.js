// Cloudflare Worker για τη σάρωση αποδείξεων του Splinefy.
// Η εφαρμογή στέλνει ΜΟΝΟ το link του QR της απόδειξης· ο Worker φέρνει τη σελίδα (ΑΑΔΕ / πάροχος) και την επιστρέφει,
// γιατί ο browser δεν επιτρέπει σε μια σελίδα να διαβάσει απευθείας σελίδα άλλου site.
// Ρυθμίσεις στο Cloudflare (Settings → Variables and Secrets):
//   KEY    (Secret) = ένα μυστικό κλειδί της επιλογής σου — το ίδιο γράφεις στην εφαρμογή
//   ORIGIN (Text, προαιρετικό) = https://eftouxis.github.io
export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ORIGIN || 'https://eftouxis.github.io',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const u = new URL(req.url);
    if (!env.KEY || u.searchParams.get('k') !== env.KEY) return new Response('forbidden', { status: 403, headers: cors });
    let target;
    try { target = new URL(u.searchParams.get('u') || ''); } catch { return new Response('bad url', { status: 400, headers: cors }); }
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return new Response('bad url', { status: 400, headers: cors });
    try {
      const r = await fetch(target.toString(), { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) Splinefy receipt reader', 'Accept-Language': 'el-GR,el;q=0.9' } });
      // pass the bytes through as they are (some providers answer with a PDF of the receipt, not a web page)
      const type = r.headers.get('content-type') || 'application/octet-stream';
      return new Response(r.body, { status: r.ok ? 200 : 502, headers: { ...cors, 'Content-Type': type, 'X-Final-Url': r.url, 'Access-Control-Expose-Headers': 'X-Final-Url' } });
    } catch (e) {
      return new Response('fetch failed: ' + e.message, { status: 502, headers: cors });
    }
  },
};
