'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtDistUnit, fmtPaceUnit, fmtTime } from '@/lib/format';
import { useUnit } from './useUnit';
import { M_PER_KM, unitLabel } from '@/lib/units';

const NAV = [
  { href: '/plan', ic: '📋', t: 'Training plan', d: 'Build a plan from your goal' },
  { href: '/history', ic: '🏁', t: 'History', d: 'Past runs, splits & pace' },
  { href: '/settings', ic: '⚙️', t: 'Settings', d: 'Language, units, weekly target' },
];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// Metres run since Monday 00:00 local.
function distanceThisWeek(runs: any[]): number {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return runs
    .filter((r) => new Date(r.started_at) >= monday)
    .reduce((s, r) => s + (r.distance_m || 0), 0);
}

export default function Home() {
  const [stats, setStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [unit] = useUnit();

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
    api.profile().then(setProfile).catch(() => {});
    api.runs().then(setRuns).catch(() => {});
  }, []);

  const name = profile?.display_name?.trim();
  const weekM = distanceThisWeek(runs);
  const targetM = (Number(profile?.weekly_target_km) || 0) * M_PER_KM;
  const pct = targetM > 0 ? Math.min(1, weekM / targetM) : 0;
  const remainingM = Math.max(0, targetM - weekM);

  return (
    <div className="wrap">
      <div className="brand"><span className="dot" /> RunTwi</div>

      <div className="greet">
        <div className="g1">{greeting()}{name ? `, ${name}` : ''} 🏃🏾</div>
        <div className="g2">Your coach speaks Twi, Ga &amp; Ewe.</div>
      </div>

      {/* Weekly goal hero */}
      <div className="hero-card">
        <div className="hero-top">
          <span className="ht-l">This week</span>
          <span className="ht-r">
            {targetM > 0 ? `goal ${fmtDistUnit(targetM, unit)} ${unitLabel(unit)}` : 'no weekly goal'}
          </span>
        </div>
        <div className="hero-val">
          {fmtDistUnit(weekM, unit)}<span className="unit">{unitLabel(unit)}</span>
        </div>
        <div className="meter"><span style={{ width: `${Math.round(pct * 100)}%` }} /></div>
        <div className="hero-foot">
          {targetM > 0
            ? (remainingM > 0
                ? `${fmtDistUnit(remainingM, unit)} ${unitLabel(unit)} to go — ${Math.round(pct * 100)}% there.`
                : `Goal smashed 🎉 ${fmtDistUnit(weekM, unit)} ${unitLabel(unit)} this week.`)
            : 'Set a weekly target in Settings to track progress.'}
        </div>
      </div>

      <Link href="/run"><button className="btn gold">Start a run</button></Link>

      {/* All-time stats */}
      <div className="stat-grid" style={{ marginTop: 14 }}>
        <div className="stat">
          <div className="sv">{stats ? fmtDistUnit(stats.total_km * M_PER_KM, unit) : '—'}</div>
          <div className="sl">Total {unitLabel(unit)}</div>
        </div>
        <div className="stat">
          <div className="sv">{stats ? stats.total_runs : '—'}</div>
          <div className="sl">Runs</div>
        </div>
        <div className="stat">
          <div className="sv">{stats ? fmtPaceUnit(stats.best_pace_s_per_km, unit) : '—'}</div>
          <div className="sl">Best pace {unit === 'mi' ? '/mi' : '/km'}</div>
        </div>
        <div className="stat">
          <div className="sv">{stats ? fmtTime(stats.total_time_s) : '—'}</div>
          <div className="sl">Total time</div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ marginTop: 14 }}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}>
            <div className="nav-row">
              <span className="ic">{n.ic}</span>
              <span className="nt">{n.t}<div className="nd">{n.d}</div></span>
              <span className="chev">›</span>
            </div>
          </Link>
        ))}
      </div>

      <p className="hint" style={{ marginTop: 20, textAlign: 'center' }}>
        Install to your home screen for offline runs.
      </p>
    </div>
  );
}
