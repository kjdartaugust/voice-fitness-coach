export function fmtTime(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtPace(sPerKm: number): string {
  if (!sPerKm || !isFinite(sPerKm)) return '--:--';
  const m = Math.floor(sPerKm / 60);
  const s = Math.round(sPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)}` : `${Math.round(m)}`;
}

export const DIALECT_LABELS: Record<string, string> = {
  twi: 'Twi (Akan)',
  ga: 'Ga',
  ewe: 'Ewe',
};
