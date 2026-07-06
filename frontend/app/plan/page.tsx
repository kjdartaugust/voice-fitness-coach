'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtPace } from '@/lib/format';

export default function PlanPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [goal, setGoal] = useState('5k');
  const [weekly, setWeekly] = useState('20');
  const [busy, setBusy] = useState(false);

  const load = () => api.plans().then(setPlans).catch(() => {});
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setBusy(true);
    try { await api.generatePlan(goal, Number(weekly)); await load(); }
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
        <label className="l muted" style={{ display: 'block', marginTop: 14 }}>Current weekly km</label>
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
                <div>{s.distance_km} km</div>
                {s.target_pace_s_per_km && <div className="muted" style={{ fontSize: 12 }}>@ {fmtPace(s.target_pace_s_per_km)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/"><button className="btn ghost" style={{ marginTop: 16 }}>Home</button></Link>
    </div>
  );
}
