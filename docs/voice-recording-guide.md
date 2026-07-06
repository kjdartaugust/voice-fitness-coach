# Voice recording guide

How to add or improve a dialect voice for RunTwi. Target: natural, energetic coach
phrases that stitch together cleanly.

## 1. Cast a native speaker
Work with a first-language speaker of the target dialect (Twi/Akan, Ga, or Ewe). They
are the authority on wording — the strings in `phrasebank/manifest.json` and
`recording-script.md` are only a starting point and must be confirmed by the actor.

## 2. Record
- Environment: quiet room, phone or USB mic 15–20cm away, pop filter if possible.
- Format: mono, 48kHz, WAV. One clean take per line in `recording-script.md`.
- Delivery: coach energy — imagine running next to the athlete. Numbers spoken crisply
  and consistently (they are reused across many cues).
- Leave ~0.5s of silence before/after each phrase to make segmentation forgiving.

Two acceptable deliverables:
1. **One file per segment** — name each `<segment_id>.wav` (e.g. `speed_up.wav`, `500.wav`).
2. **One master file** + a `marks.json` of `{ "segment_id": [start_s, end_s] }`.

## 3. Segment + encode
```bash
cd phrasebank
# option 1: a directory of per-segment wavs
python pipeline/segment.py --dialect twi --input masters/twi_wavs/
# option 2: single master + marks
python pipeline/segment.py --dialect twi --input masters/twi.wav --marks masters/twi.marks.json
```
This normalises loudness (EBU R128) and encodes to `build/twi/<segment>.webm` (Opus).

## 4. Review
Play the stitched cues locally: `docker compose up`, open the app, start a run. Cues
should sound like one sentence, not chopped words. Re-record any segment that clicks or
sounds clipped, especially the number + unit joins ("500 … metres … remaining").

## 5. Publish
```bash
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
python pipeline/upload.py --dialect twi
```
Segments become available at `${PHRASEBANK_BASE_URL}/twi/<segment>.webm` and the app
caches them (service worker `runtwi-audio-v1`) so they work offline thereafter.

## Adding a brand-new cue
1. Add the cue to `manifest.json` (`phrases`) with its ordered `segments`.
2. Mirror the emit rule in **both** `coaching_engine.py` and `frontend/lib/coaching.ts`.
3. Add the line to `recording-script.md`, record, segment, upload.
