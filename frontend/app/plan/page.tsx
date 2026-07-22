'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtDistUnit, fmtPaceUnit } from '@/lib/format';
import { useUnit } from '../useUnit';
import { toUnit, toMetres, M_PER_KM, unitLabel, paceLabel } from '@/lib/units';

const GOALS: { id: string; label: string }[] = [
  { id: '5k', label: '5K' },
  { id: '10k', label: '10K' },
  { id: 'half', label: 'Half' },
  { id: 'base', label: 'Base' },
];

const SESSION_ICON: Record<string, string> = {
  interval: '⚡', tempo: '🔥', long: '🛣️', easy: '🌿', rest: '😴',
};

const WEEK_MIN = 5, WEEK_MAX = 200;

export default function PlanPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [goal, setGoal] = useState('5k');
  const [weekly, setWeekly] = useState('20'); // in the user's current unit
  const [busy, setBusy] = useState(false);
  const [unit] = useUnit();

  // Convert the typed weekly volume when the unit flips (plan math stays in km).
  const prevUnit = useRef(unit);
  useEffect(() => {
    const from = prevUnit.current;
    if (from === unit) return;
    prevUnit.current = unit;
    const v = Number(weekly);
    if (v > 0) setWeekly(toUnit(toMetres(v, from), unit).toFixed(1));
  }, [unit, weekly]);

  const load = () => api.plans().then(setPlans).catch(() => {});
  useEffect(() => { load(); }, []);

  const stepWeekly = (delta: number) =>
    setWeekly((w) => String(Math.min(WEEK_MAX, Math.max(WEEK_MIN, Math.round((Number(w) + delta) * 10) / 10))));

  const generate = async () => {
    setBusy(true);
    const weeklyKm = toMetres(Number(weekly), unit) / M_PER_KM;
    try { await api.generatePlan(goal, weeklyKm); await load(); }
    finally { setBusy(false); }
  };

  const active = plans.find((p) => p.active) ?? plans[0];

  return (
    <div className="wrap">
      <div className="brand"><span className="dot" /> Training plan</div>

      <div className="card">
        <span className="field-label">Goal</span>
        <div className="chip-row" style={{ marginTop: 8 }}>
          {GOALS.map((g) => (
            <button key={g.id} type="button"
              className={`chip ${goal === g.id ? 'on' : ''}`}
              aria-pressed={goal === g.id}
              onClick={() => setGoal(g.id)}>
              {g.label}
            </button>
          ))}
        </div>

        <div className="stack">
          <span className="field-label">Current weekly volume</span>
          <p className="hint">Your typical distance per week — the plan scales from here.</p>
          <div className="stepper" style={{ marginTop: 8 }}>
            <button type="button" className="step-btn" aria-label="Less" onClick={() => stepWeekly(-1)}>−</button>
            <div className="step-val">
              <div className="n">{Number(weekly).toFixed(Number.isInteger(Number(weekly)) ? 0 : 1)}</div>
              <div className="u">{unitLabel(unit)} / week</div>
            </div>
            <button type="button" className="step-btn" aria-label="More" onClick={() => stepWeekly(1)}>+</button>
          </div>
        </div>

        <button className="btn" style={{ marginTop: 16 }} onClick={generate} disabled={busy}>
          {busy ? 'Generating…' : active ? 'Regenerate plan' : 'Generate plan'}
        </button>
      </div>

      {active && (
        <div className="card">
          <div className="plan-name">{active.name}</div>
          {active.sessions.map((s: any, i: number) => (
            <div key={i}>
              {i % 3 === 0 && <div className="week-label">Week {Math.floor(i / 3) + 1}</div>}
              <div className="sess">
                <span className="sess-badge">{SESSION_ICON[s.type] ?? '🏃🏾'}</span>
                <div className="sess-body">
                  <div className="sess-type">{s.type}</div>
                  <div className="sess-notes">{String(s.notes ?? '').replace(/^W\d+:\s*/, '')}</div>
                </div>
                <div className="sess-right">
                  <div className="sess-dist">{fmtDistUnit(s.distance_km * M_PER_KM, unit)} {unitLabel(unit)}</div>
                  {s.target_pace_s_per_km && (
                    <div className="sess-pace">@ {fmtPaceUnit(s.target_pace_s_per_km, unit)}{paceLabel(unit)}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/"><button className="btn ghost" style={{ marginTop: 16 }}>Home</button></Link>
    </div>
  );
}
