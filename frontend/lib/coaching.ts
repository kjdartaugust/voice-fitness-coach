/**
 * Client-side mirror of backend/app/services/coaching_engine.py.
 *
 * Runs the coaching rules locally so cues fire with zero latency and with no
 * network — essential for running with no signal. KEEP IN SYNC with the Python
 * engine (thresholds, cooldowns, priorities). Tested in lib/coaching.test.ts.
 */
import type { Cue, RunnerState } from './types';

export const CueId = {
  SPEED_UP: 'speed_up',
  SLOW_DOWN: 'slow_down',
  ON_PACE: 'on_pace',
  CADENCE_LOW: 'cadence_low',
  OVERSTRIDING: 'overstriding',
  DISTANCE_REMAINING: 'distance_remaining',
  KM_SPLIT: 'km_split',
  INTERVAL_WORK: 'interval_work',
  INTERVAL_REST: 'interval_rest',
  HALFWAY: 'halfway',
  FINISH: 'finish',
  ENCOURAGE: 'encourage',
} as const;

const PRIORITY: Record<string, number> = {
  finish: 100, interval_work: 90, interval_rest: 90,
  slow_down: 70, speed_up: 70, cadence_low: 60, overstriding: 55,
  km_split: 50, distance_remaining: 45, halfway: 40, on_pace: 30, encourage: 10,
};

const COOLDOWN_S: Record<string, number> = {
  speed_up: 25, slow_down: 25, on_pace: 45, cadence_low: 30, overstriding: 40,
  distance_remaining: 60, km_split: 0, interval_work: 0, interval_rest: 0,
  halfway: 9999, finish: 9999, encourage: 120,
};

export const PACE_TOLERANCE = 0.05;
const MIN_CADENCE_SPM = 165;
const OVERSTRIDE_CADENCE_SPM = 155;

export interface CoachMemory {
  last_fired_s: Record<string, number>;
  splits_announced: number;
  halfway_done: boolean;
}

export function newMemory(): CoachMemory {
  return { last_fired_s: {}, splits_announced: 0, halfway_done: false };
}

function canFire(mem: CoachMemory, cue: string, now: number): boolean {
  const last = mem.last_fired_s[cue];
  if (last === undefined) return true;
  return now - last >= COOLDOWN_S[cue];
}

function paceRatio(s: RunnerState): number | null {
  if (!s.target_pace_s_per_km || s.pace_s_per_km <= 0) return null;
  return s.pace_s_per_km / s.target_pace_s_per_km;
}

export function evaluate(s: RunnerState, mem: CoachMemory): Cue | null {
  const now = s.elapsed_s;
  const candidates: Cue[] = [];

  if (s.target_distance_m && s.distance_m >= s.target_distance_m && canFire(mem, CueId.FINISH, now)) {
    candidates.push({ id: CueId.FINISH, reason: 'reached target distance', params: {} });
  }

  if (s.mode === 'interval' && s.interval_phase_changed && s.interval_phase) {
    const id = s.interval_phase === 'work' ? CueId.INTERVAL_WORK : CueId.INTERVAL_REST;
    candidates.push({ id, reason: `interval -> ${s.interval_phase}`, params: {} });
  }

  const ratio = paceRatio(s);
  if (ratio !== null) {
    if (ratio > 1 + PACE_TOLERANCE && canFire(mem, CueId.SPEED_UP, now)) {
      candidates.push({ id: CueId.SPEED_UP, reason: 'too slow', params: {} });
    } else if (ratio < 1 - PACE_TOLERANCE && canFire(mem, CueId.SLOW_DOWN, now)) {
      candidates.push({ id: CueId.SLOW_DOWN, reason: 'too fast', params: {} });
    } else if (Math.abs(ratio - 1) <= PACE_TOLERANCE && canFire(mem, CueId.ON_PACE, now)) {
      candidates.push({ id: CueId.ON_PACE, reason: 'on pace', params: {} });
    }
  }

  if (s.cadence_spm > 0 && s.cadence_spm < OVERSTRIDE_CADENCE_SPM && s.pace_s_per_km < 360) {
    if (canFire(mem, CueId.OVERSTRIDING, now)) {
      candidates.push({ id: CueId.OVERSTRIDING, reason: 'overstriding', params: {} });
    }
  } else if (s.cadence_spm > 0 && s.cadence_spm < MIN_CADENCE_SPM && canFire(mem, CueId.CADENCE_LOW, now)) {
    candidates.push({ id: CueId.CADENCE_LOW, reason: 'cadence low', params: {} });
  }

  const completedKm = Math.floor(s.distance_m / 1000);
  if (completedKm > mem.splits_announced) {
    mem.splits_announced = completedKm;
    candidates.push({ id: CueId.KM_SPLIT, reason: `km ${completedKm}`, params: { km: completedKm } });
  }

  if (s.target_distance_m) {
    const remaining = s.target_distance_m - s.distance_m;
    for (const mark of [1000, 500, 200]) {
      if (remaining > 0 && remaining <= mark && canFire(mem, CueId.DISTANCE_REMAINING, now)) {
        const spoken = remaining > 700 ? 1000 : remaining > 350 ? 500 : 200;
        candidates.push({ id: CueId.DISTANCE_REMAINING, reason: `${Math.round(remaining)}m left`, params: { meters: spoken } });
        break;
      }
    }
    if (!mem.halfway_done && s.distance_m >= s.target_distance_m / 2) {
      mem.halfway_done = true;
      candidates.push({ id: CueId.HALFWAY, reason: 'halfway', params: {} });
    }
  }

  if (candidates.length === 0) return null;
  const winner = candidates.reduce((a, b) => (PRIORITY[b.id] > PRIORITY[a.id] ? b : a));
  mem.last_fired_s[winner.id] = now;
  return winner;
}
