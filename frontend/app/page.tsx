'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtDistUnit, fmtPaceUnit } from '@/lib/format';
import { useUnit } from './useUnit';
import { M_PER_KM, unitLabel } from '@/lib/units';

export default function Home() {
  const [stats, setStats] = useState<any>(null);
  const [unit] = useUnit();
  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);

  return (
    <div className="wrap">
      <div className="brand"><span className="dot" /> RunTwi</div>
      <p className="muted" style={{ marginTop: 6 }}>
        Your running coach — speaking Twi, Ga &amp; Ewe.
      </p>

      <div className="card">
        <div className="grid3">
          <div className="metric">
            <div className="v">{stats ? stats.total_runs : '—'}</div>
            <div className="l">Runs</div>
          </div>
          <div className="metric">
            <div className="v">{stats ? fmtDistUnit(stats.total_km * M_PER_KM, unit) : '—'}</div>
            <div className="l">Total {unitLabel(unit)}</div>
          </div>
          <div className="metric">
            <div className="v">{stats ? fmtPaceUnit(stats.best_pace_s_per_km, unit) : '—'}</div>
            <div className="l">Best pace</div>
          </div>
        </div>
      </div>

      <Link href="/run"><button className="btn gold" style={{ marginTop: 8 }}>Start a run</button></Link>
      <Link href="/plan"><button className="btn ghost" style={{ marginTop: 12 }}>Training plan</button></Link>
      <Link href="/history"><button className="btn ghost" style={{ marginTop: 12 }}>History</button></Link>
      <Link href="/settings"><button className="btn ghost" style={{ marginTop: 12 }}>Settings</button></Link>

      <p className="muted" style={{ marginTop: 24, fontSize: 13, textAlign: 'center' }}>
        Install to your home screen for offline runs.
      </p>
    </div>
  );
}
