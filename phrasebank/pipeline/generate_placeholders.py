#!/usr/bin/env python3
"""Generate placeholder cue audio so the app is demoable before real recordings.

Creates a short distinct tone per segment per dialect at build/<dialect>/<seg>.webm,
using ffmpeg. Each segment gets a deterministic pitch so cues are audibly different.
Replace these with native voice-actor recordings via segment.py for production.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))


def all_segments() -> list[str]:
    segs: set[str] = set()
    for entry in MANIFEST["phrases"].values():
        for s in entry["segments"]:
            if s != "_num":
                segs.add(s)
    segs.update(MANIFEST["units"].keys())
    segs.update(MANIFEST["numbers"].keys())
    return sorted(segs)


def tone(freq: int, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", f"sine=frequency={freq}:duration=0.35",
         "-af", "afade=t=out:st=0.28:d=0.07", "-c:a", "libopus", "-b:a", "48k", str(dst)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def main() -> None:
    segs = all_segments()
    for dialect in MANIFEST["dialects"]:
        for i, seg in enumerate(segs):
            freq = 330 + (i * 37) % 500  # spread pitches
            tone(freq, ROOT / "build" / dialect / f"{seg}.webm")
        print(f"{dialect}: {len(segs)} placeholder segments")
    print("Placeholders generated. Replace with real recordings for production.")


if __name__ == "__main__":
    main()
