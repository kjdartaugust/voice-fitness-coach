'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DIALECT_LABELS } from '@/lib/format';
import { useUnit, UnitToggle } from '../useUnit';
import { toUnit, toMetres, M_PER_KM, unitLabel } from '@/lib/units';

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
        <label className="l muted">Name</label>
        <input value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} style={{ marginTop: 8 }} />

        <label className="l muted" style={{ display: 'block', marginTop: 14 }}>Default coaching language</label>
        <select value={p.dialect} onChange={(e) => setP({ ...p, dialect: e.target.value })} style={{ marginTop: 8 }}>
          {Object.entries(DIALECT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <label className="l muted" style={{ display: 'block', marginTop: 14 }}>Distance units</label>
        <div style={{ marginTop: 8 }}><UnitToggle /></div>

        <label className="l muted" style={{ display: 'block', marginTop: 14 }}>Weekly target ({unitLabel(unit)})</label>
        <input type="number" value={weekly} onChange={(e) => setWeekly(e.target.value)} style={{ marginTop: 8 }} />

        <button className="btn" style={{ marginTop: 16 }} onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
      </div>
      <Link href="/"><button className="btn ghost">Home</button></Link>
    </div>
  );
}
