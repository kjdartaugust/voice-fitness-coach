# TTS evaluation: why phrase-bank, and the Coqui path

## Decision
Ship a **native voice-actor phrase bank** (stitched segments) for launch. Neural TTS for
Twi, Ga and Ewe is not yet at the fidelity a coach app needs, and cues are a small,
closed vocabulary — perfect for a phrase bank. This gives natural prosody, works fully
offline (segments are cached), and is cheap to run (no inference server).

## What we evaluated
| Option | Verdict |
|---|---|
| Cloud TTS (Google/Azure/AWS) | No Twi/Ga/Ewe voices. Rejected. |
| English TTS reading Twi text | Wrong phonetics, sounds foreign, defeats the product. Rejected. |
| **Native phrase bank (chosen)** | Natural, offline, closed vocab fits cues. Chosen. |
| Coqui TTS fine-tuned per language | Promising for open-ended text; needs a data set + GPU. Future. |

## Coqui path (future, for open-ended coaching phrases)
When we want to speak arbitrary sentences (e.g. personalised summaries), fine-tune a
Coqui VITS model per language:
1. **Data**: 3–10h of clean, transcribed single-speaker audio per dialect. Partner with
   university linguistics departments (e.g. University of Ghana) for corpora + review.
2. **Train**: VITS recipe, phoneme front-end adapted to the language's orthography
   (tone marking matters for Twi/Ewe).
3. **Serve**: containerised Coqui behind a `/tts` endpoint; pre-render common phrases to
   the same phrase-bank cache so runtime stays offline-first.
4. **Evaluate**: MOS with native listeners; A/B against the phrase bank. Only promote a
   voice that beats the recordings on naturalness.

Until then the phrase bank is the production path; the coaching engine already emits
abstract cues, so swapping the audio backend later requires no logic changes.
