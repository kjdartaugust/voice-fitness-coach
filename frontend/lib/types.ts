export type Dialect = 'twi' | 'ga' | 'ewe';
export type RunMode = 'free' | 'interval' | 'tempo' | 'long';
export type Activity = 'run' | 'walk' | 'hike' | 'ride';

export interface RoutePoint {
  t: number; // seconds since run start
  lat: number | null;
  lon: number | null;
  distance_m: number;
  pace: number | null; // s/km smoothed
  cad: number | null; // cadence spm
}

export interface RunnerState {
  elapsed_s: number;
  distance_m: number;
  pace_s_per_km: number;
  cadence_spm: number;
  mode: RunMode;
  activity?: Activity; // defaults to 'run' when absent (keeps old callers valid)
  target_pace_s_per_km?: number | null;
  target_distance_m?: number | null;
  interval_phase?: 'work' | 'rest' | null;
  interval_phase_changed?: boolean;
}

export interface Cue {
  id: string;
  reason: string;
  params: Record<string, number>;
}

export interface RunRecord {
  client_id: string;
  mode: RunMode;
  activity: Activity;
  dialect: Dialect;
  plan_id?: string | null;
  target_pace_s_per_km?: number | null;
  started_at: string;
  ended_at?: string | null;
  route: RoutePoint[];
  cues: { t: number; cue: string; reason: string }[];
}
