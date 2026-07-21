'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { pendingRuns } from '@/lib/offlineSync';
import { fmtDistUnit, fmtPaceUnit, fmtTime } from '@/lib/format';
import { useUnit } from '../useUnit';
import { unitLabel, paceLabel } from '@/lib/units';

export default function History() {
  const [runs, setRuns] = useState<any[]>([]);
  const [pending, setPending] = useState<number>(0);
  const [unit] = useUnit();

  useEffect(() => {
    api.runs().then(setRuns).catch(() => {});
    pendingRuns().then((p) => setPending(p.length));
  }, []);

  return (
    <div className="wrap">
      <div className="brand"><span className="dot" /> History</div>
      {pending > 0 && (
        <div className="card muted" style={{ fontSize: 14 }}>
          {pending} run{pending > 1 ? 's' : ''} waiting to sync (offline).
        </div>
      )}

      {runs.length === 0 && <p className="muted" style={{ marginTop: 20 }}>No runs yet. Go for one!</p>}

      {runs.map((r) => (
        <div className="card" key={r.id}>
          <div className="list-item" style={{ borderTop: 'none' }}>
            <div>
              <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{r.mode} run</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {new Date(r.started_at).toLocaleDateString()} · {r.dialect}
              </div>
            </div>
            <div className="pill on">{fmtDistUnit(r.distance_m, unit)} {unitLabel(unit)}</div>
          </div>
          <div className="grid3" style={{ marginTop: 10 }}>
            <div className="metric"><div className="v" style={{ fontSize: 22 }}>{fmtPaceUnit(r.avg_pace_s_per_km, unit)}</div><div className="l">Pace {paceLabel(unit)}</div></div>
            <div className="metric"><div className="v" style={{ fontSize: 22 }}>{fmtTime(r.duration_s)}</div><div className="l">Time</div></div>
            <div className="metric"><div className="v" style={{ fontSize: 22 }}>{Math.round(r.avg_cadence_spm)}</div><div className="l">Cadence</div></div>
          </div>
        </div>
      ))}

      <Link href="/"><button className="btn ghost" style={{ marginTop: 16 }}>Home</button></Link>
    </div>
  );
}
