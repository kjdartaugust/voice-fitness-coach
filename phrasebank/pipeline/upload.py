#!/usr/bin/env python3
"""Upload built phrase-bank segments to the Supabase Storage `phrasebank` bucket.

Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment. Idempotent —
re-uploads overwrite. Run after pipeline/segment.py.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dialect", required=True, choices=["twi", "ga", "ewe"])
    ap.add_argument("--bucket", default=os.getenv("PHRASEBANK_BUCKET", "phrasebank"))
    args = ap.parse_args()

    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    src = ROOT / "build" / args.dialect
    if not src.exists():
        raise SystemExit(f"No build output at {src}; run segment.py first.")

    with httpx.Client(timeout=30) as client:
        for f in sorted(src.glob("*.webm")):
            key_path = f"{args.dialect}/{f.name}"
            endpoint = f"{url}/storage/v1/object/{args.bucket}/{key_path}"
            r = client.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "audio/webm",
                    "x-upsert": "true",
                },
                content=f.read_bytes(),
            )
            status = "ok" if r.status_code in (200, 201) else f"ERR {r.status_code}"
            print(f"{key_path:32} {status}")

    print("Upload complete.")


if __name__ == "__main__":
    main()
