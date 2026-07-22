/**
 * Activity types and their coaching profile.
 *
 * The tracker and coaching engine stay canonical in seconds-per-km — cycling
 * "speed" is just its inverse (km/h = 3600 / s-per-km) — so an activity is only
 * a *profile* of sensible defaults and which cues apply. Adding one is data, not
 * new plumbing.
 */
import type { Activity } from './types';

export interface ActivityMeta {
  id: Activity;
  label: string;
  icon: string;
  /** How the primary target/live figure reads. */
  metric: 'pace' | 'speed';
  /** Whether cadence/overstriding cues fire (foot-strike form is running-only). */
  coachCadence: boolean;
  /** Unit shown on the cadence tile. */
  cadenceLabel: string;
  /** Running-style workout modes (Tempo/Interval/Long) only apply to running. */
  showModes: boolean;
  /** Default coaching target, canonical s/km. */
  defaultPaceSPerKm: number;
  /** Default target distance, metres. */
  defaultDistM: number;
}

export const ACTIVITIES: Record<Activity, ActivityMeta> = {
  run:  { id: 'run',  label: 'Run',  icon: '🏃🏾', metric: 'pace',  coachCadence: true,  cadenceLabel: 'spm', showModes: true,  defaultPaceSPerKm: 330, defaultDistM: 5000 },
  walk: { id: 'walk', label: 'Walk', icon: '🚶🏾', metric: 'pace',  coachCadence: false, cadenceLabel: 'spm', showModes: false, defaultPaceSPerKm: 720, defaultDistM: 3000 },
  hike: { id: 'hike', label: 'Hike', icon: '🥾',   metric: 'pace',  coachCadence: false, cadenceLabel: 'spm', showModes: false, defaultPaceSPerKm: 900, defaultDistM: 8000 },
  ride: { id: 'ride', label: 'Ride', icon: '🚴🏾', metric: 'speed', coachCadence: false, cadenceLabel: 'rpm', showModes: false, defaultPaceSPerKm: 150, defaultDistM: 20000 },
};

export const ACTIVITY_LIST: ActivityMeta[] = [
  ACTIVITIES.run, ACTIVITIES.walk, ACTIVITIES.hike, ACTIVITIES.ride,
];
