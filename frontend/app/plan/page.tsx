'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtDistUnit, fmtPaceUnit } from '@/lib/format';
import { useUnit } from '../useUnit';
import { toUnit, toMetres, M_PER_KM, unitLabel, paceLabel } from '@/lib/units';

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
        <label className="l muted">Goal</label>
        <select value={goal} onChange={(e) => setGoal(e.target.value)} style={{ marginTop: 8 }}>
          <option value="5k">5K</option>
          <option value="10k">10K</option>
          <option value="half">Half marathon</option>
          <option value="base">Base fitness</option>
        </select>
        <label className="l muted" style={{ display: 'block', marginTop: 14 }}>Current weekly {unitLabel(unit)}</label>
        <input type="number" value={weekly} onChange={(e) => setWeekly(e.target.value)} style={{ marginTop: 8 }} />
        <button className="btn" style={{ marginTop: 14 }} onClick={generate} disabled={busy}>
          {busy ? 'Generating…' : 'Generate plan'}
        </button>
      </div>

      {active && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{active.name}</div>
          {active.sessions.slice(0, 9).map((s: any, i: number) => (
            <div className="list-item" key={i}>
              <div>
                <div style={{ textTransform: 'capitalize', fontWeight: 600 }}>{s.type}</div>
                <div className="muted" style={{ fontSize: 12 }}>{s.notes}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>{fmtDistUnit(s.distance_km * M_PER_KM, unit)} {unitLabel(unit)}</div>
                {s.target_pace_s_per_km && <div className="muted" style={{ fontSize: 12 }}>@ {fmtPaceUnit(s.target_pace_s_per_km, unit)}{paceLabel(unit)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/"><button className="btn ghost" style={{ marginTop: 16 }}>Home</button></Link>
    </div>
  );
}
