# Phrase Bank — native-voice cue system

Quality neural TTS for Twi, Ga and Ewe does not exist at production quality yet, so
RunTwi speaks by **stitching short phrases recorded by a native voice actor**. This
directory holds the manifest, the recording script, and the pipeline that turns raw
recordings into the per-segment audio files the app plays.

## How it works

1. `manifest.json` is the single source of truth. Each **cue** (e.g. `speed_up`) lists
   the ordered **segments** to play. Parametric cues (`km_split`, `distance_remaining`)
   contain a `_num` placeholder that expands into number segments at runtime.
2. A voice actor records the phrases in `recording-script.md` (one clean take per line).
3. `pipeline/segment.py` slices/normalises the master recording into one audio file per
   segment id, per dialect: `build/<dialect>/<segment>.webm`.
4. `pipeline/upload.py` pushes `build/` to the Supabase Storage `phrasebank` bucket.
   The app then fetches `{PHRASEBANK_BASE_URL}/<dialect>/<segment>.webm`.

## Segment inventory (per dialect)

Cue segments: `speed_up, slow_down, on_pace, cadence_low, overstriding, halfway,
finish, encourage, interval_work, interval_rest, split_done, remaining`
Unit segments: `unit_m, unit_km`
Number segments: `1 2 3 4 5 6 7 8 9 10 200 500 1000`

Record whole-number recordings (200, 500, 1000) for the common distance cues so they
sound natural; the composer only falls back to digit stitching for uncommon values.

## Quick pipeline run

```bash
cd phrasebank
python pipeline/segment.py --dialect twi --input masters/twi.wav --marks masters/twi.marks.json
python pipeline/upload.py --dialect twi   # needs SUPABASE_SERVICE_ROLE_KEY
```

See [`../docs/voice-recording-guide.md`](../docs/voice-recording-guide.md) for the full
recording + review workflow with native speakers.
