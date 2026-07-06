'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DIALECT_LABELS } from '@/lib/format';

export default function Settings() {
  const [p, setP] = useState<any>({ display_name: '', dialect: 'twi', weekly_target_km: 20 });
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.profile().then(setP).catch(() => {}); }, []);

  const save = async () => {
    await api.updateProfile({
      display_name: p.display_name, dialect: p.dialect,
      weekly_target_km: Number(p.weekly_target_km),
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

        <label className="l muted" style={{ display: 'block', marginTop: 14 }}>Weekly target (km)</label>
        <input type="number" value={p.weekly_target_km} onChange={(e) => setP({ ...p, weekly_target_km: e.target.value })} style={{ marginTop: 8 }} />

        <button className="btn" style={{ marginTop: 16 }} onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
      </div>
      <Link href="/"><button className="btn ghost">Home</button></Link>
    </div>
  );
}
