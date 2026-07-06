/**
 * Live tracking: GPS distance/pace (Haversine + smoothing) and accelerometer
 * cadence detection (peak counting on the vertical acceleration signal).
 *
 * Framework-agnostic: no React, no DOM beyond the Web sensor APIs. Ports directly
 * to Expo (expo-location / expo-sensors) by swapping the two `start*` sources.
 */
import type { RoutePoint, RunnerState } from './types';

const EARTH_R = 6371000; // metres

export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cadence estimator: counts vertical-acceleration peaks in a sliding window. */
export class CadenceDetector {
  private peaks: number[] = []; // timestamps (ms) of detected steps
  private lastMag = 0;
  private rising = false;
  private readonly threshold: number;

  constructor(threshold = 11.5) {
    // ~gravity(9.8) + bounce. Tunable per device.
    this.threshold = threshold;
  }

  /** Feed a device-motion sample; returns current cadence in steps/min. */
  push(ax: number, ay: number, az: number, tMs: number): number {
    const mag = Math.sqrt(ax * ax + ay * ay + az * az);
    if (mag > this.threshold && mag > this.lastMag) {
      this.rising = true;
    } else if (this.rising && mag < this.lastMag) {
      // local maximum crossed => one step
      this.peaks.push(tMs);
      this.rising = false;
    }
    this.lastMag = mag;
    // keep last 5s of peaks
    const cutoff = tMs - 5000;
    this.peaks = this.peaks.filter((p) => p >= cutoff);
    if (this.peaks.length < 2) return 0;
    const windowS = (this.peaks[this.peaks.length - 1] - this.peaks[0]) / 1000;
    return windowS > 0 ? (this.peaks.length - 1) / windowS * 60 : 0;
  }
}

/** Exponential-moving-average pace smoother to kill GPS jitter. */
export class PaceSmoother {
  private value = 0;
  constructor(private readonly alpha = 0.3) {}
  update(instantPace: number): number {
    if (instantPace <= 0 || !isFinite(instantPace)) return this.value;
    this.value = this.value === 0 ? instantPace : this.alpha * instantPace + (1 - this.alpha) * this.value;
    return this.value;
  }
  get(): number {
    return this.value;
  }
}

export interface TrackerOptions {
  minMoveM?: number; // ignore GPS deltas smaller than this (noise floor)
  maxAccuracyM?: number; // discard fixes worse than this
}

/**
 * Aggregates GPS + cadence into a RunnerState stream. Callers pull `.snapshot()`
 * once per tick and feed it to the coaching engine.
 */
export class RunTracker {
  distance_m = 0;
  private startMs = 0;
  private lastFix: { lat: number; lon: number; t: number } | null = null;
  private smoother = new PaceSmoother();
  private cadence = new CadenceDetector();
  private cadenceSpm = 0;
  route: RoutePoint[] = [];
  private readonly minMove: number;
  private readonly maxAcc: number;

  constructor(opts: TrackerOptions = {}) {
    this.minMove = opts.minMoveM ?? 3;
    this.maxAcc = opts.maxAccuracyM ?? 30;
  }

  start(nowMs = Date.now()): void {
    this.startMs = nowMs;
  }

  onMotion(ax: number, ay: number, az: number, tMs = Date.now()): void {
    this.cadenceSpm = this.cadence.push(ax, ay, az, tMs);
  }

  onPosition(lat: number, lon: number, accuracy: number, tMs = Date.now()): void {
    if (accuracy > this.maxAcc) return; // too noisy
    const tSec = (tMs - this.startMs) / 1000;
    if (this.lastFix) {
      const d = haversine(this.lastFix, { lat, lon });
      if (d >= this.minMove) {
        const dt = (tMs - this.lastFix.t) / 1000;
        this.distance_m += d;
        if (dt > 0) this.smoother.update((dt / d) * 1000); // s per km
        this.lastFix = { lat, lon, t: tMs };
      }
    } else {
      this.lastFix = { lat, lon, t: tMs };
    }
    this.route.push({
      t: tSec,
      lat,
      lon,
      distance_m: this.distance_m,
      pace: this.smoother.get(),
      cad: this.cadenceSpm,
    });
  }

  snapshot(mode: RunnerState['mode'], nowMs = Date.now()): RunnerState {
    return {
      elapsed_s: (nowMs - this.startMs) / 1000,
      distance_m: this.distance_m,
      pace_s_per_km: this.smoother.get(),
      cadence_spm: this.cadenceSpm,
      mode,
    };
  }
}
