'use client';
/**
 * React hook wiring the browser sensors to the framework-agnostic engine.
 *
 * - Geolocation.watchPosition -> RunTracker.onPosition (GPS pace/distance/route)
 * - DeviceMotion -> RunTracker.onMotion (accelerometer cadence)
 * - Wake Lock keeps the screen on so the browser doesn't throttle sensors
 * - once/sec tick: evaluate coaching engine -> play dialect audio cue
 *
 * (Screen-off background GPS needs the native Expo shell; see docs/native-migration.md.)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { RunTracker } from '@/lib/tracking';
import { evaluate, newMemory, type CoachMemory } from '@/lib/coaching';
import { AudioCuePlayer } from '@/lib/audioCue';
import { api } from '@/lib/api';
import { queueRun, flush } from '@/lib/offlineSync';
import type { Cue, Dialect, RunMode, RunRecord } from '@/lib/types';

export interface RunConfig {
  mode: RunMode;
  dialect: Dialect;
  targetPace?: number | null;
  targetDistanceM?: number | null;
}

export interface LiveMetrics {
  elapsed_s: number;
  distance_m: number;
  pace_s_per_km: number;
  cadence_spm: number;
  lastCue: Cue | null;
  online: boolean;
}

export function useRun() {
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    elapsed_s: 0, distance_m: 0, pace_s_per_km: 0, cadence_spm: 0, lastCue: null,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  });

  const tracker = useRef<RunTracker | null>(null);
  const memory = useRef<CoachMemory>(newMemory());
  const player = useRef<AudioCuePlayer | null>(null);
  const cfg = useRef<RunConfig | null>(null);
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<any>(null);
  const tickTimer = useRef<any>(null);
  const cueLog = useRef<{ t: number; cue: string; reason: string }[]>([]);
  const motionHandler = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  const start = useCallback(async (config: RunConfig) => {
    cfg.current = config;
    tracker.current = new RunTracker();
    tracker.current.start();
    memory.current = newMemory();
    cueLog.current = [];

    // audio: unlock from the user gesture, then preload likely cues
    player.current = new AudioCuePlayer(
      process.env.NEXT_PUBLIC_PHRASEBANK_BASE_URL ||
        `${api.base}/static/phrasebank`,
      config.dialect,
    );
    try {
      const manifest = await api.manifest();
      await player.current.unlock(manifest);
      await player.current.preload(Object.keys(manifest.phrases));
    } catch { /* offline: cues degrade to captions */ }

    // permissions + sensor subscriptions
    await requestMotionPermission();
    motionHandler.current = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (a) tracker.current?.onMotion(a.x || 0, a.y || 0, a.z || 0);
    };
    window.addEventListener('devicemotion', motionHandler.current);

    if ('geolocation' in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (p) => tracker.current?.onPosition(
          p.coords.latitude, p.coords.longitude, p.coords.accuracy ?? 999,
        ),
        () => {},
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
      );
    }

    try { wakeLock.current = await (navigator as any).wakeLock?.request('screen'); } catch {}

    setRunning(true);
    tickTimer.current = setInterval(() => tick(), 1000);
  }, []);

  const tick = useCallback(() => {
    if (!tracker.current || !cfg.current) return;
    const snap = tracker.current.snapshot(cfg.current.mode);
    const state = {
      ...snap,
      target_pace_s_per_km: cfg.current.targetPace ?? null,
      target_distance_m: cfg.current.targetDistanceM ?? null,
    };
    const cue = evaluate(state, memory.current);
    if (cue) {
      cueLog.current.push({ t: snap.elapsed_s, cue: cue.id, reason: cue.reason });
      player.current?.play(cue);
    }
    setMetrics({
      elapsed_s: snap.elapsed_s,
      distance_m: snap.distance_m,
      pace_s_per_km: snap.pace_s_per_km,
      cadence_spm: snap.cadence_spm,
      lastCue: cue ?? null,
      online: navigator.onLine,
    });
  }, []);

  const stop = useCallback(async (): Promise<RunRecord | null> => {
    clearInterval(tickTimer.current);
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (motionHandler.current) window.removeEventListener('devicemotion', motionHandler.current);
    try { await wakeLock.current?.release(); } catch {}
    setRunning(false);

    if (!tracker.current || !cfg.current) return null;
    const startedMs = Date.now() - tracker.current.route.at(-1)?.t! * 1000 || Date.now();
    const record: RunRecord = {
      client_id: crypto.randomUUID(),
      mode: cfg.current.mode,
      dialect: cfg.current.dialect,
      target_pace_s_per_km: cfg.current.targetPace ?? null,
      started_at: new Date(startedMs).toISOString(),
      ended_at: new Date().toISOString(),
      route: tracker.current.route,
      cues: cueLog.current,
    };
    await queueRun(record);
    flush(api.base).catch(() => {}); // best-effort immediate sync
    return record;
  }, []);

  useEffect(() => {
    const on = () => setMetrics((m) => ({ ...m, online: true }));
    const off = () => setMetrics((m) => ({ ...m, online: false }));
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if (navigator.onLine) flush(api.base).catch(() => {});
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return { running, metrics, start, stop };
}

async function requestMotionPermission(): Promise<void> {
  const anyMotion = (window as any).DeviceMotionEvent;
  if (anyMotion && typeof anyMotion.requestPermission === 'function') {
    try { await anyMotion.requestPermission(); } catch {}
  }
}
