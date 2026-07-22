'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRun } from '../useRun';
import { useUnit, UnitToggle } from '../useUnit';
import { fmtTime, fmtPace, fmtDistUnit, fmtPaceUnit, fmtSpeedUnit, DIALECT_LABELS } from '@/lib/format';
import {
  toUnit, toMetres, paceToUnit, paceToSPerKm, speedFromPace,
  unitLabel, unitLabelLong, paceLabel, speedLabel, type Unit,
} from '@/lib/units';
import { ACTIVITIES, ACTIVITY_LIST } from '@/lib/activity';
import type { Activity, Dialect, RunMode } from '@/lib/types';

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

const PACE_MIN = 90;    // 1:30
const PACE_MAX = 1500;  // 25:00

export default function RunPage() {
  const router = useRouter();
  const { running, metrics, start, stop } = useRun();
  const [unit] = useUnit();
  const [activity, setActivity] = useState<Activity>('run');
  const [dialect, setDialect] = useState<Dialect>('twi');
  const [mode, setMode] = useState<RunMode>('tempo');
  const [paceSec, setPaceSec] = useState(330);   // seconds per current unit
  const [targetDist, setTargetDist] = useState('5'); // in current unit

  const meta = ACTIVITIES[activity];
  // A pace/speed goal applies when: running a structured workout, or any
  // non-running activity (walk/hike/ride are always target-based here).
  const hasTarget = meta.showModes ? mode !== 'free' : true;

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

  // Switching activity loads that activity's sensible defaults.
  const pickActivity = (a: Activity) => {
    const m = ACTIVITIES[a];
    setActivity(a);
    if (!m.showModes) setMode('free');
    else if (mode === 'free') setMode('tempo');
    setPaceSec(Math.round(paceToUnit(m.defaultPaceSPerKm, unit)));
    setTargetDist(toUnit(m.defaultDistM, unit).toFixed(2));
  };

  const distNum = Number(targetDist) || 0;
  const otherUnit: Unit = unit === 'km' ? 'mi' : 'km';

  const setSpeed = (delta: number) => setPaceSec((s) => {
    const sp = Math.min(80, Math.max(3, 3600 / s + delta));
    return Math.round(3600 / sp);
  });

  const onStart = () => {
    start({
      mode: meta.showModes ? mode : 'free',
      activity, dialect,
      targetPace: hasTarget ? paceToSPerKm(paceSec, unit) : null,
      targetDistanceM: distNum > 0 ? toMetres(distNum, unit) : null,
    });
  };

  const onStop = async () => {
    await stop();
    router.push('/history');
  };

  if (!running) {
    const targetLabel = meta.metric === 'speed'
      ? `${fmtSpeedUnit(paceToSPerKm(paceSec, unit), unit)} ${speedLabel(unit)}`
      : `${fmtPace(paceSec)} ${paceLabel(unit)}`;

    return (
      <div className="wrap">
        <div className="brand"><span className="dot" /> New {meta.label.toLowerCase()}</div>

        <div className="card">
          {/* Activity */}
          <span className="field-label">Activity</span>
          <div className="chip-row" style={{ marginTop: 8 }}>
            {ACTIVITY_LIST.map((a) => (
              <button key={a.id} type="button"
                className={`chip ${activity === a.id ? 'on' : ''}`}
                aria-pressed={activity === a.id}
                onClick={() => pickActivity(a.id)}>
                {a.icon} {a.label}
              </button>
            ))}
          </div>

          {/* Language */}
          <div className="stack">
            <label className="field-label" htmlFor="lang">Coaching language</label>
            <select id="lang" value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)} style={{ marginTop: 8 }}>
              {Object.entries(DIALECT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Units */}
          <div className="stack">
            <span className="field-label">Units</span>
            <p className="hint">Switch anytime — your targets convert automatically.</p>
            <div style={{ marginTop: 8 }}><UnitToggle /></div>
          </div>

          {/* Workout type (running only) */}
          {meta.showModes && (
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
          )}

          {/* Target pace OR speed */}
          {hasTarget && meta.metric === 'pace' && (
            <div className="stack">
              <label className="field-label">Target pace</label>
              <p className="hint">Time per {unitLabelLong(unit).toLowerCase().slice(0, -1)}. Tap − faster · + slower.</p>
              <div className="stepper" style={{ marginTop: 8 }}>
                <button type="button" className="step-btn" aria-label="Faster"
                  onClick={() => setPaceSec((s) => Math.max(PACE_MIN, s - 5))}>−</button>
                <div className="step-val">
                  <div className="n">{fmtPace(paceSec)}</div>
                  <div className="u">min : sec {paceLabel(unit)}</div>
                </div>
                <button type="button" className="step-btn" aria-label="Slower"
                  onClick={() => setPaceSec((s) => Math.min(PACE_MAX, s + 5))}>+</button>
              </div>
            </div>
          )}
          {hasTarget && meta.metric === 'speed' && (
            <div className="stack">
              <label className="field-label">Target speed</label>
              <p className="hint">How fast to ride. Tap − slower · + faster.</p>
              <div className="stepper" style={{ marginTop: 8 }}>
                <button type="button" className="step-btn" aria-label="Slower"
                  onClick={() => setSpeed(-0.5)}>−</button>
                <div className="step-val">
                  <div className="n">{fmtSpeedUnit(paceToSPerKm(paceSec, unit), unit)}</div>
                  <div className="u">{speedLabel(unit)}</div>
                </div>
                <button type="button" className="step-btn" aria-label="Faster"
                  onClick={() => setSpeed(0.5)}>+</button>
              </div>
            </div>
          )}

          {/* Target distance */}
          <div className="stack">
            <label className="field-label" htmlFor="dist">Target distance</label>
            <p className="hint">Pick a preset or type your own. Leave it open to just move.</p>
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

        {/* Plain-language recap */}
        <div className="summary">
          <div className="s-line">
            {meta.icon} {meta.showModes && mode !== 'free' ? `${MODES.find((m) => m.id === mode)!.label} ` : ''}{meta.label}
            {distNum > 0
              ? <> · <span className="s-em">{targetDist} {unitLabel(unit)}</span></>
              : <> · <span className="s-em">open distance</span></>}
            {hasTarget && <> @ <span className="s-em">{targetLabel}</span></>}
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

  // ── Live view ────────────────────────────────────────────────────────────
  const cue = metrics.lastCue;
  const warn = cue && ['speed_up', 'slow_down', 'cadence_low', 'overstriding'].includes(cue.id);

  const targetPaceSPerKm = hasTarget ? paceToSPerKm(paceSec, unit) : null;
  const live = metrics.pace_s_per_km;
  let paceState: keyof typeof PACE_STATE = 'idle';
  if (targetPaceSPerKm && live > 0) {
    const diff = live - targetPaceSPerKm; // +ve = slower than goal
    paceState = diff > 10 ? 'slow' : diff < -10 ? 'fast' : 'on';
  }
  // Cycling flips the verb: slower speed → still "speed up", label stays generic.
  const st = PACE_STATE[paceState];

  const targetM = distNum > 0 ? toMetres(distNum, unit) : null;
  const pct = targetM ? Math.min(1, metrics.distance_m / targetM) : null;

  const R = 96, C = 2 * Math.PI * R;
  const ringColor = targetPaceSPerKm ? st.color : 'var(--gold)';

  const primaryVal = meta.metric === 'speed'
    ? fmtSpeedUnit(live, unit) : fmtPaceUnit(live, unit);
  const primaryLbl = meta.metric === 'speed'
    ? `Speed ${speedLabel(unit)}` : `Pace ${paceLabel(unit)}`;
  const goalVal = meta.metric === 'speed'
    ? `${fmtSpeedUnit(paceToSPerKm(paceSec, unit), unit)} ${speedLabel(unit)}`
    : `${fmtPace(paceSec)} ${paceLabel(unit)}`;

  return (
    <div className="wrap">
      <div className="status">
        <span className="live" /> {metrics.online ? 'Tracking' : 'Offline — will sync later'} · {meta.icon} {meta.label} · {DIALECT_LABELS[dialect]}
      </div>

      <div className="run-ring">
        <svg viewBox="0 0 220 220" aria-hidden="true">
          <circle cx="110" cy="110" r={R} fill="none" stroke="#1c3327" strokeWidth="14" />
          <circle className="arc" cx="110" cy="110" r={R} fill="none"
            stroke={ringColor} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - (pct ?? 0))} />
        </svg>
        <div className="center">
          <div className="d">{fmtDistUnit(metrics.distance_m, unit)}</div>
          <div className="du">{unitLabelLong(unit)}</div>
          {targetM
            ? <div className="dpct" style={{ color: ringColor }}>{Math.round((pct ?? 0) * 100)}% of {targetDist} {unitLabel(unit)}</div>
            : <div className="dof">open {meta.label.toLowerCase()}</div>}
        </div>
      </div>

      <div className="row">
        <div className="card metric">
          <div className="v" style={{ color: targetPaceSPerKm ? st.color : undefined }}>{primaryVal}</div>
          <div className="l">{primaryLbl}</div>
          {targetPaceSPerKm
            ? <div className="pace-sub" style={{ color: st.color }}>{st.label}</div>
            : <div className="tile-target">free {meta.metric}</div>}
        </div>
        <div className="card metric">
          <div className="v">{fmtTime(metrics.elapsed_s)}</div>
          <div className="l">Time</div>
          {targetPaceSPerKm && <div className="tile-target">goal {goalVal}</div>}
        </div>
      </div>

      {meta.metric === 'pace' && (
        <div className="card metric">
          <div className="v">{Math.round(metrics.cadence_spm)}</div>
          <div className="l">Cadence {meta.cadenceLabel}</div>
        </div>
      )}

      <div className={`cue-banner ${warn ? 'warn' : ''}`}>
        {cue ? cueText(cue.id, dialect) : 'Kɔ so 🏃🏾'}
      </div>

      <button className="btn red" style={{ marginTop: 16 }} onClick={onStop}>Finish</button>
    </div>
  );
}

// Live pace-vs-goal states: colour + short caption for the ring and metric tile.
const PACE_STATE = {
  on:   { color: '#22c55e', label: 'On pace ✓' },
  slow: { color: '#f5b301', label: 'Push harder ⤴' },
  fast: { color: '#38bdf8', label: 'Ahead — ease ⤵' },
  idle: { color: '#8fb3a0', label: 'Find your rhythm' },
} as const;

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
