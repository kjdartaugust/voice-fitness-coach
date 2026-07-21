'use client';
import { useSyncExternalStore } from 'react';
import {
  getUnit,
  setUnit,
  subscribeUnit,
  type Unit,
} from '@/lib/units';

/**
 * App-wide distance/pace unit. Backed by the localStorage store in lib/units,
 * so every component using this hook re-renders the instant the unit flips.
 * Returns [unit, setUnit] like useState.
 */
export function useUnit(): [Unit, (u: Unit) => void] {
  const unit = useSyncExternalStore(subscribeUnit, getUnit, () => 'km' as Unit);
  return [unit, setUnit];
}

/** km | mi segmented toggle, reusable on any screen. */
export function UnitToggle() {
  const [unit, set] = useUnit();
  return (
    <div className="seg" role="group" aria-label="Distance units">
      {(['km', 'mi'] as Unit[]).map((u) => (
        <button
          key={u}
          type="button"
          className={`seg-btn ${unit === u ? 'on' : ''}`}
          aria-pressed={unit === u}
          onClick={() => set(u)}
        >
          {u === 'km' ? 'Kilometres' : 'Miles'}
        </button>
      ))}
    </div>
  );
}
