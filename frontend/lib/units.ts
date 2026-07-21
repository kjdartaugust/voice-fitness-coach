/**
 * Distance/pace units layer.
 *
 * The whole app stores distance canonically in **metres** and pace in
 * **seconds per kilometre** (that's what the tracker, coaching engine and API
 * all speak). This module is the only place that knows about user-facing units,
 * so switching km <-> mi never touches the physics — just the display and the
 * numbers a user types in.
 *
 * It's a tiny external store (localStorage-backed) so a single toggle anywhere
 * flips units everywhere instantly; read it in React via `useUnit()`.
 */
export type Unit = 'km' | 'mi';

export const M_PER_KM = 1000;
export const M_PER_MI = 1609.344;
const MI_PER_KM = M_PER_MI / M_PER_KM; // 1 mi is this many km

export function metresPerUnit(u: Unit): number {
  return u === 'mi' ? M_PER_MI : M_PER_KM;
}

// --- distance -------------------------------------------------------------
/** metres -> value in the given unit (e.g. 1609.344 m -> 1 mi) */
export function toUnit(metres: number, u: Unit): number {
  return metres / metresPerUnit(u);
}
/** value in the given unit -> metres (e.g. 1 mi -> 1609.344 m) */
export function toMetres(value: number, u: Unit): number {
  return value * metresPerUnit(u);
}

// --- pace -----------------------------------------------------------------
/** seconds/km -> seconds per the given unit (a mile takes ~1.609x longer) */
export function paceToUnit(sPerKm: number, u: Unit): number {
  return u === 'mi' ? sPerKm * MI_PER_KM : sPerKm;
}
/** seconds per the given unit -> seconds/km */
export function paceToSPerKm(secPerUnit: number, u: Unit): number {
  return u === 'mi' ? secPerUnit / MI_PER_KM : secPerUnit;
}

// --- labels ---------------------------------------------------------------
export const unitLabel = (u: Unit): string => u; // 'km' | 'mi'
export const unitLabelLong = (u: Unit): string =>
  u === 'mi' ? 'Miles' : 'Kilometres';
export const paceLabel = (u: Unit): string => `/${u}`;

// --- external store -------------------------------------------------------
const KEY = 'runtwi.unit';
let current: Unit = 'km';
const listeners = new Set<() => void>();

function isUnit(v: unknown): v is Unit {
  return v === 'km' || v === 'mi';
}

// Hydrate synchronously on the client so the first paint matches the choice.
if (typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (isUnit(saved)) current = saved;
  } catch {
    /* private mode / disabled storage: fall back to km */
  }
}

export function getUnit(): Unit {
  return current;
}

export function setUnit(u: Unit): void {
  if (u === current) return;
  current = u;
  try {
    window.localStorage.setItem(KEY, u);
  } catch {
    /* ignore persistence failures */
  }
  listeners.forEach((l) => l());
}

export function subscribeUnit(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
