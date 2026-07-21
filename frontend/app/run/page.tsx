'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRun } from '../useRun';
import { useUnit, UnitToggle } from '../useUnit';
import { fmtTime, fmtPace, fmtDistUnit, fmtPaceUnit, DIALECT_LABELS } from '@/lib/format';
import {
  toUnit, toMetres, paceToUnit, paceToSPerKm,
  unitLabel, unitLabelLong, paceLabel, type Unit,
} from '@/lib/units';
import type { Dialect, RunMode } from '@/lib/types';

const MODES: { id: RunMode; label: string; blurb: string }[] = [
  { id: 'free', label: 'Free', blurb: 'Just run — no targets' },
  { id: 'tempo', label: 'Tempo', blurb: 'Hold a steady goal pace' },
  { id: 'interval', label: 'Interval', blurb: 'Work / rest repeats' },
  { id: 'long', label: 'Long', blurb: 'Easy distance day' },
];

// Common race targets, defined in metres so the chips are exact in either unit.
const RACES: { label: string; m: number }[] = [
  { label: '5K', m: 5000 },
  { label: '10K', m: 10000 },
  { label: 'Half', m: 21097.5 },
];

const PACE_MIN = 120;  // 2:00
const PACE_MAX = 1200; // 20:00

export default function RunPage() {
  const router = useRouter();
  const { running, metrics, start, stop } = useRun();
  const [unit] = useUnit();
  const [dialect, setDialect] = useState<Dialect>('twi');
  const [mode, setMode] = useState<RunMode>('tempo');
  const [paceSec, setPaceSec] = useState(330);   // seconds per current unit (5:30)
  const [targetDist, setTargetDist] = useState('5'); // in current unit

  // Flip km <-> mi: convert what's typed so the physical target is unchanged.
  const prevUnit = useRef(unit);
  useEffect(() => {
    const from = prevUnit.current;
    if (from === unit) return;
    prevUnit.current = unit;
    setPaceSec((s) => Math.round(paceToUnit(paceToSPerKm(s, from), unit)));
    const d = Number(targetDist);
    if (d > 0) setTargetDist(toUnit(toMetres(d, from), unit).toFixed(2));
  }, [unit, targetDist]);

  const distNum = Number(targetDist) || 0;
  const otherUnit: Unit = unit === 'km' ? 'mi' : 'km';
  const modeLabel = MODES.find((m) => m.id === mode)!.label;

  const onStart = () => {
    start({
      mode, dialect,
      targetPace: mode === 'free' ? null : paceToSPerKm(paceSec, unit),
      targetDistanceM: distNum > 0 ? toMetres(distNum, unit) : null,
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
          {/* Language */}
          <label className="field-label" htmlFor="lang">Coaching language</label>
          <select id="lang" value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)} style={{ marginTop: 8 }}>
            {Object.entries(DIALECT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          {/* Units */}
          <div className="stack">
            <span className="field-label">Units</span>
            <p className="hint">Switch anytime — your targets convert automatically.</p>
            <div style={{ marginTop: 8 }}><UnitToggle /></div>
          </div>

          {/* Workout type */}
          <div className="stack">
            <span className="field-label">Workout</span>
            <p className="hint">{MODES.find((m) => m.id === mode)!.blurb}.</p>
            <div className="chip-row" style={{ marginTop: 8 }}>
              {MODES.map((m) => (
                <button key={m.id} type="button"
                  className={`chip ${mode === m.id ? 'on' : ''}`}
                  style={{ flex: '1 0 46%' }}
                  aria-pressed={mode === m.id}
                  onClick={() => setMode(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target pace — only when a pace goal makes sense */}
          {mode !== 'free' && (
            <div className="stack">
              <label className="field-label">Target pace</label>
              <p className="hint">How fast per {unitLabelLong(unit).toLowerCase().slice(0, -1)}. Tap − faster · + slower.</p>
              <div className="stepper" style={{ marginTop: 8 }}>
                <button type="button" className="step-btn" aria-label="Faster (subtract 5 seconds)"
                  onClick={() => setPaceSec((s) => Math.max(PACE_MIN, s - 5))}>−</button>
                <div className="step-val">
                  <div className="n">{fmtPace(paceSec)}</div>
                  <div className="u">min : sec {paceLabel(unit)}</div>
                </div>
                <button type="button" className="step-btn" aria-label="Slower (add 5 seconds)"
                  onClick={() => setPaceSec((s) => Math.min(PACE_MAX, s + 5))}>+</button>
              </div>
            </div>
          )}

          {/* Target distance — presets + free entry */}
          <div className="stack">
            <label className="field-label" htmlFor="dist">Target distance</label>
            <p className="hint">Pick a race or type your own. Leave it open to just run.</p>
            <div className="chip-row" style={{ marginTop: 8 }}>
              {RACES.map((r) => {
                const val = toUnit(r.m, unit);
                const on = Math.abs(distNum - val) < 0.05;
                return (
                  <button key={r.label} type="button"
                    className={`chip ${on ? 'on' : ''}`}
                    onClick={() => setTargetDist(val.toFixed(2))}>
                    {r.label}
                  </button>
                );
              })}
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <input id="dist" type="number" inputMode="decimal" value={targetDist}
                onChange={(e) => setTargetDist(e.target.value)} />
              <span className="suffix">{unitLabel(unit)}</span>
            </div>
            {distNum > 0 && (
              <p className="hint">≈ {fmtDistUnit(toMetres(distNum, unit), otherUnit)} {otherUnit}</p>
            )}
          </div>
        </div>

        {/* Plain-language recap of exactly what you're about to do */}
        <div className="summary">
          <div className="s-line">
            {modeLabel} run
            {distNum > 0
              ? <> · <span className="s-em">{targetDist} {unitLabel(unit)}</span></>
              : <> · <span className="s-em">open distance</span></>}
            {mode !== 'free' && <> @ <span className="s-em">{fmtPace(paceSec)} {paceLabel(unit)}</span></>}
          </div>
          <div className="s-sub">Coaching in {DIALECT_LABELS[dialect]}.</div>
        </div>

        <button className="btn gold" onClick={onStart} style={{ marginTop: 14 }}>Start</button>
        <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>
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
        <div className="v">{fmtDistUnit(metrics.distance_m, unit)}</div>
        <div className="l">{unitLabelLong(unit)}</div>
      </div>

      <div className="row">
        <div className="card metric">
          <div className="v">{fmtPaceUnit(metrics.pace_s_per_km, unit)}</div>
          <div className="l">Pace {paceLabel(unit)}</div>
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
