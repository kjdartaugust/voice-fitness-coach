import { type Unit, toUnit, paceToUnit, speedFromPace } from './units';

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

// --- unit-aware helpers (km/mi) -------------------------------------------
// Canonical inputs stay metres / seconds-per-km; these render in the user's unit.

/** metres -> "3.11" in the given unit (always 2dp so it reads like a distance). */
export function fmtDistUnit(m: number, u: Unit): string {
  return toUnit(m, u).toFixed(2);
}

/** seconds/km -> "8:03" clock in the given unit (min:sec per km or per mi). */
export function fmtPaceUnit(sPerKm: number, u: Unit): string {
  return fmtPace(paceToUnit(sPerKm, u));
}

/** seconds/km -> "24.0" speed in the given unit (km/h or mph), for cycling. */
export function fmtSpeedUnit(sPerKm: number, u: Unit): string {
  const s = speedFromPace(sPerKm, u);
  return isFinite(s) && s > 0 ? s.toFixed(1) : '0.0';
}

export const DIALECT_LABELS: Record<string, string> = {
  twi: 'Twi (Akan)',
  ga: 'Ga',
  ewe: 'Ewe',
};
