'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { pendingRuns } from '@/lib/offlineSync';
import { fmtDistUnit, fmtPaceUnit, fmtSpeedUnit, fmtTime } from '@/lib/format';
import { useUnit } from '../useUnit';
import { unitLabel, paceLabel, speedLabel } from '@/lib/units';
import { ACTIVITIES } from '@/lib/activity';
import type { Activity } from '@/lib/types';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

      {runs.length === 0 && <p className="muted" style={{ marginTop: 20 }}>No sessions yet. Go for one!</p>}

      {runs.map((r) => {
        const act: Activity = (r.activity as Activity) || 'run';
        const meta = ACTIVITIES[act] ?? ACTIVITIES.run;
        const title = act === 'run'
          ? (r.mode && r.mode !== 'free' ? `${cap(r.mode)} run` : 'Run')
          : meta.label;
        const isRide = meta.metric === 'speed';
        return (
          <div className="card" key={r.id}>
            <div className="hist-head">
              <div className="hist-title">
                <span className="act-badge">{meta.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="hist-name">{title}</div>
                  <div className="hist-sub">
                    {new Date(r.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {r.dialect}
                  </div>
                </div>
              </div>
              <div className="pill on">{fmtDistUnit(r.distance_m, unit)} {unitLabel(unit)}</div>
            </div>

            <div className={isRide ? 'row' : 'grid3'} style={{ marginTop: 12 }}>
              {isRide ? (
                <>
                  <div className="metric"><div className="v" style={{ fontSize: 22 }}>{fmtSpeedUnit(r.avg_pace_s_per_km, unit)}</div><div className="l">Speed {speedLabel(unit)}</div></div>
                  <div className="metric"><div className="v" style={{ fontSize: 22 }}>{fmtTime(r.duration_s)}</div><div className="l">Time</div></div>
                </>
              ) : (
                <>
                  <div className="metric"><div className="v" style={{ fontSize: 22 }}>{fmtPaceUnit(r.avg_pace_s_per_km, unit)}</div><div className="l">Pace {paceLabel(unit)}</div></div>
                  <div className="metric"><div className="v" style={{ fontSize: 22 }}>{fmtTime(r.duration_s)}</div><div className="l">Time</div></div>
                  <div className="metric"><div className="v" style={{ fontSize: 22 }}>{Math.round(r.avg_cadence_spm)}</div><div className="l">Cadence</div></div>
                </>
              )}
            </div>
          </div>
        );
      })}

      <Link href="/"><button className="btn ghost" style={{ marginTop: 16 }}>Home</button></Link>
    </div>
  );
}
