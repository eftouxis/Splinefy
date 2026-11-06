// Hybrid logical clock: sortable strings, unique per device, monotonic even if clocks drift.
let last = 0, counter = 0;
export function tick(dev) {
  const now = Date.now();
  if (now > last) { last = now; counter = 0; } else { counter++; }
  return `${last.toString(36).padStart(9, '0')}.${counter.toString(36).padStart(3, '0')}.${dev}`;
}
export function observe(t) {
  if (!t || t === '0') return;
  const ms = parseInt(t.split('.')[0], 36);
  if (ms > last) { last = ms; counter = 0; }
}
export const tsOf = (t) => (t && t !== '0' ? parseInt(t.split('.')[0], 36) : 0);
