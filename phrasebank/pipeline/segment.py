#!/usr/bin/env python3
"""Slice a master voice recording into per-segment audio files.

Two input modes:
  * one-file-per-segment: point --input at a directory of `<segment>.wav` files.
  * single master + marks: --input master.wav --marks marks.json where marks is
    {"segment_id": [start_s, end_s], ...}. Requires ffmpeg on PATH.

Output: build/<dialect>/<segment>.webm (Opus) — small, wide browser support.

This is intentionally ffmpeg-shelling (no heavy Python audio deps) so it runs in CI
and on a laptop. `--dry-run` prints the ffmpeg commands without executing.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def encode(src: str, dst: Path, start: float | None, end: float | None, dry: bool) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-i", src]
    if start is not None:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)]
    # normalise loudness so cues are consistent, encode to opus/webm
    cmd += ["-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "libopus", "-b:a", "48k", str(dst)]
    print(" ".join(cmd))
    if not dry:
        subprocess.run(cmd, check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dialect", required=True, choices=["twi", "ga", "ewe"])
    ap.add_argument("--input", required=True, help="master wav OR directory of segment wavs")
    ap.add_argument("--marks", help="marks json when using a single master file")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    out_dir = ROOT / "build" / args.dialect
    inp = Path(args.input)

    if args.marks:
        marks = json.loads(Path(args.marks).read_text(encoding="utf-8"))
        for seg, (start, end) in marks.items():
            encode(str(inp), out_dir / f"{seg}.webm", start, end, args.dry_run)
    elif inp.is_dir():
        for wav in sorted(inp.glob("*.wav")):
            encode(str(wav), out_dir / f"{wav.stem}.webm", None, None, args.dry_run)
    else:
        raise SystemExit("Provide --marks with a master file, or a directory of wavs.")

    print(f"\nDone -> {out_dir}")


if __name__ == "__main__":
    main()
