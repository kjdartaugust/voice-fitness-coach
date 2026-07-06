'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRun } from '../useRun';
import { fmtTime, fmtPace, fmtDist, DIALECT_LABELS } from '@/lib/format';
import type { Dialect, RunMode } from '@/lib/types';

const MODES: { id: RunMode; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'tempo', label: 'Tempo' },
  { id: 'interval', label: 'Interval' },
  { id: 'long', label: 'Long' },
];

export default function RunPage() {
  const router = useRouter();
  const { running, metrics, start, stop } = useRun();
  const [dialect, setDialect] = useState<Dialect>('twi');
  const [mode, setMode] = useState<RunMode>('tempo');
  const [targetPaceMin, setTargetPaceMin] = useState('5');
  const [targetPaceSec, setTargetPaceSec] = useState('30');
  const [targetKm, setTargetKm] = useState('5');

  const onStart = () => {
    const tp = Number(targetPaceMin) * 60 + Number(targetPaceSec);
    start({
      mode, dialect,
      targetPace: mode === 'free' ? null : tp,
      targetDistanceM: Number(targetKm) > 0 ? Number(targetKm) * 1000 : null,
    });
  };

  const onStop = async () => {
    await stop();
    router.push('/history');
  };

  if (!running) {
    return (
      <div className="wrap">
        <div className="brand"><span className="dot" /> New run</div>

        <div className="card">
          <label className="l muted">Coaching language</label>
          <select value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)} style={{ marginTop: 8 }}>
            {Object.entries(DIALECT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          <label className="l muted" style={{ display: 'block', marginTop: 16 }}>Workout</label>
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {MODES.map((m) => (
              <button key={m.id}
                className={`pill ${mode === m.id ? 'on' : ''}`}
                onClick={() => setMode(m.id)}
                style={{ flex: '1 0 40%', cursor: 'pointer', border: 'none' }}>
                {m.label}
              </button>
            ))}
          </div>

          {mode !== 'free' && (
            <>
              <label className="l muted" style={{ display: 'block', marginTop: 16 }}>Target pace (min/km)</label>
              <div className="row" style={{ marginTop: 8 }}>
                <input type="number" value={targetPaceMin} onChange={(e) => setTargetPaceMin(e.target.value)} />
                <input type="number" value={targetPaceSec} onChange={(e) => setTargetPaceSec(e.target.value)} />
              </div>
            </>
          )}

          <label className="l muted" style={{ display: 'block', marginTop: 16 }}>Target distance (km)</label>
          <input type="number" value={targetKm} onChange={(e) => setTargetKm(e.target.value)} style={{ marginTop: 8 }} />
        </div>

        <button className="btn gold" onClick={onStart}>Start</button>
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          Grant location &amp; motion access when prompted. Keep the screen on for tracking.
        </p>
      </div>
    );
  }

  const cue = metrics.lastCue;
  const warn = cue && ['speed_up', 'slow_down', 'cadence_low', 'overstriding'].includes(cue.id);

  return (
    <div className="wrap">
      <div className="status">
        <span className="live" /> {metrics.online ? 'Tracking' : 'Offline — will sync later'} · {DIALECT_LABELS[dialect]}
      </div>

      <div className="card big metric" style={{ marginTop: 10 }}>
        <div className="v">{fmtDist(metrics.distance_m)}</div>
        <div className="l">Kilometres</div>
      </div>

      <div className="row">
        <div className="card metric">
          <div className="v">{fmtPace(metrics.pace_s_per_km)}</div>
          <div className="l">Pace /km</div>
        </div>
        <div className="card metric">
          <div className="v">{fmtTime(metrics.elapsed_s)}</div>
          <div className="l">Time</div>
        </div>
      </div>

      <div className="card metric">
        <div className="v">{Math.round(metrics.cadence_spm)}</div>
        <div className="l">Cadence spm</div>
      </div>

      <div className={`cue-banner ${warn ? 'warn' : ''}`}>
        {cue ? cueText(cue.id, dialect) : 'Kɔ so 🏃🏾'}
      </div>

      <button className="btn red" style={{ marginTop: 16 }} onClick={onStop}>Finish</button>
    </div>
  );
}

// Minimal on-screen captions (the audio is the real coaching channel).
const CAPTIONS: Record<string, Record<string, string>> = {
  speed_up: { twi: 'Yɛ ntɛm ⤴', ga: 'Fee oya ⤴', ewe: 'Ɖe abla ⤴' },
  slow_down: { twi: 'Brɛ ase ⤵', ga: 'Ba shi ⤵', ewe: 'Ɖe blewuu ⤵' },
  on_pace: { twi: 'Wo so bɔ yie ✓', ga: 'Oyɛ jogbaŋŋ ✓', ewe: 'Èle edzi nyuie ✓' },
  cadence_low: { twi: 'Bɔ nan ntɛm', ga: 'Kã onaji', ewe: 'Zɔ kaba' },
  overstriding: { twi: 'Anammɔn tia', ga: 'Onaji bibioo', ewe: 'Afɔɖeɖe kpui' },
  km_split: { twi: 'Kilomita awie ✓', ga: 'Kilomita egbe ✓', ewe: 'Kilomita wu ✓' },
  distance_remaining: { twi: 'Kakra aka!', ga: 'Fioo eshwɛ!', ewe: 'Vie susɔ!' },
  halfway: { twi: 'Mfimfini ✓', ga: 'Teŋgbɛ ✓', ewe: 'Titina ✓' },
  finish: { twi: 'Woawie! Ayekoo 🎉', ga: 'Ogbe naa! 🎉', ewe: 'Èwu enu! 🎉' },
};
function cueText(id: string, d: Dialect): string {
  return CAPTIONS[id]?.[d] ?? '🏃🏾';
}
