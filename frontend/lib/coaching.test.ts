import { describe, it, expect } from 'vitest';
import { evaluate, newMemory, CueId } from './coaching';
import { haversine, CadenceDetector, PaceSmoother } from './tracking';
import { numberSegments } from './audioCue';
import type { RunnerState } from './types';

const base = (o: Partial<RunnerState> = {}): RunnerState => ({
  elapsed_s: 100, distance_m: 500, pace_s_per_km: 330, cadence_spm: 175, mode: 'free', ...o,
});

describe('coaching engine (mirror of python)', () => {
  it('says speed up when too slow', () => {
    const c = evaluate(base({ pace_s_per_km: 380, target_pace_s_per_km: 330 }), newMemory());
    expect(c?.id).toBe(CueId.SPEED_UP);
  });
  it('says slow down when too fast', () => {
    const c = evaluate(base({ pace_s_per_km: 290, target_pace_s_per_km: 330 }), newMemory());
    expect(c?.id).toBe(CueId.SLOW_DOWN);
  });
  it('respects cooldown', () => {
    const m = newMemory();
    evaluate(base({ pace_s_per_km: 380, target_pace_s_per_km: 330 }), m);
    const c2 = evaluate(base({ elapsed_s: 101, pace_s_per_km: 380, target_pace_s_per_km: 330 }), m);
    expect(c2).toBeNull();
  });
  it('finish beats pace correction', () => {
    const c = evaluate(base({ distance_m: 5000, target_distance_m: 5000, pace_s_per_km: 400, target_pace_s_per_km: 330 }), newMemory());
    expect(c?.id).toBe(CueId.FINISH);
  });
  it('announces km split once', () => {
    const m = newMemory();
    const c1 = evaluate(base({ distance_m: 1000 }), m);
    const c2 = evaluate(base({ elapsed_s: 110, distance_m: 1050 }), m);
    expect(c1?.id).toBe(CueId.KM_SPLIT);
    expect(c2?.id).not.toBe(CueId.KM_SPLIT);
  });
});

describe('tracking math', () => {
  it('haversine ~ known distance', () => {
    // Accra to Kumasi ~ 200km; here a small delta
    const d = haversine({ lat: 5.6037, lon: -0.187 }, { lat: 5.6127, lon: -0.187 });
    expect(d).toBeGreaterThan(950);
    expect(d).toBeLessThan(1050);
  });
  it('cadence detector counts steps', () => {
    const cd = new CadenceDetector(11);
    let spm = 0;
    // simulate 3 steps/sec for 3s => 180 spm
    for (let i = 0; i < 30; i++) {
      const t = i * 100;
      const mag = i % 3 === 0 ? 13 : 9; // peak every 300ms
      spm = cd.push(0, 0, mag, t);
    }
    expect(spm).toBeGreaterThan(120);
  });
  it('pace smoother ignores garbage', () => {
    const s = new PaceSmoother();
    s.update(300);
    s.update(0);
    s.update(Infinity);
    expect(s.get()).toBeCloseTo(300, 0);
  });
});

describe('number stitching', () => {
  const manifest = { numbers: { '1': 1, '2': 1, '5': 1, '10': 1, '200': 1, '500': 1, '1000': 1 } } as any;
  it('uses whole-number recording', () => {
    expect(numberSegments(500, manifest)).toEqual(['500']);
  });
  it('composes when missing', () => {
    expect(numberSegments(1200, manifest)).toEqual(['1000', '200']);
  });
});
