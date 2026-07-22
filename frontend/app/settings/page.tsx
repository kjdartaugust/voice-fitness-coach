'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DIALECT_LABELS } from '@/lib/format';
import { useUnit, UnitToggle } from '../useUnit';
import { toUnit, toMetres, M_PER_KM, unitLabel } from '@/lib/units';

const WEEK_MIN = 0, WEEK_MAX = 200;

export default function Settings() {
  const [p, setP] = useState<any>({ display_name: '', dialect: 'twi', weekly_target_km: 20 });
  const [unit] = useUnit();
  // Weekly target lives canonically in km on the profile; this field holds the
  // value in the user's current unit and is converted on load, on toggle, on save.
  const [weekly, setWeekly] = useState('20');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.profile().then((pr) => {
      setP(pr);
      setWeekly(toUnit((Number(pr.weekly_target_km) || 0) * M_PER_KM, unit).toFixed(1));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convert the typed value when the unit flips so the target stays the same.
  const prevUnit = useRef(unit);
  useEffect(() => {
    const from = prevUnit.current;
    if (from === unit) return;
    prevUnit.current = unit;
    const v = Number(weekly);
    if (v > 0) setWeekly(toUnit(toMetres(v, from), unit).toFixed(1));
  }, [unit, weekly]);

  const stepWeekly = (delta: number) =>
    setWeekly((w) => String(Math.min(WEEK_MAX, Math.max(WEEK_MIN, Math.round((Number(w) + delta) * 10) / 10))));

  const save = async () => {
    const km = toMetres(Number(weekly), unit) / M_PER_KM;
    await api.updateProfile({
      display_name: p.display_name, dialect: p.dialect,
      weekly_target_km: km,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="wrap">
      <div className="brand"><span className="dot" /> Settings</div>

      <div className="card">
        <label className="field-label" htmlFor="name">Name</label>
        <p className="hint">Shown in your greeting on the home screen.</p>
        <input id="name" value={p.display_name} placeholder="Your name"
          onChange={(e) => setP({ ...p, display_name: e.target.value })} style={{ marginTop: 8 }} />

        <div className="stack">
          <label className="field-label" htmlFor="lang">Default coaching language</label>
          <p className="hint">The dialect a new session starts in.</p>
          <select id="lang" value={p.dialect} onChange={(e) => setP({ ...p, dialect: e.target.value })} style={{ marginTop: 8 }}>
            {Object.entries(DIALECT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="stack">
          <span className="field-label">Distance units</span>
          <p className="hint">Applies everywhere — distances and paces convert instantly.</p>
          <div style={{ marginTop: 8 }}><UnitToggle /></div>
        </div>

        <div className="stack">
          <span className="field-label">Weekly target</span>
          <p className="hint">Drives the goal meter on your home screen.</p>
          <div className="stepper" style={{ marginTop: 8 }}>
            <button type="button" className="step-btn" aria-label="Less" onClick={() => stepWeekly(-1)}>−</button>
            <div className="step-val">
              <div className="n">{Number(weekly).toFixed(Number.isInteger(Number(weekly)) ? 0 : 1)}</div>
              <div className="u">{unitLabel(unit)} / week</div>
            </div>
            <button type="button" className="step-btn" aria-label="More" onClick={() => stepWeekly(1)}>+</button>
          </div>
        </div>

        <button className="btn" style={{ marginTop: 18 }} onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
      </div>

      <Link href="/"><button className="btn ghost">Home</button></Link>
    </div>
  );
}
