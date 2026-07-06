/**
 * Low-latency dialect audio cue scheduler.
 *
 * Pre-fetches phrase-bank segments as decoded AudioBuffers and plays a cue's
 * segments gaplessly via the Web Audio API. A single cue queue prevents cues
 * from overlapping. Everything is cached so cues play instantly and offline.
 *
 * A cue resolves to an ordered list of segment ids (from the backend /phrases
 * manifest); we schedule them back-to-back to "stitch" a spoken sentence.
 */
import type { Cue, Dialect } from './types';

interface Manifest {
  audio_ext: string;
  phrases: Record<string, { segments: string[]; parametric?: string }>;
  numbers: Record<string, unknown>;
}

export class AudioCuePlayer {
  private ctx: AudioContext | null = null;
  private cache = new Map<string, AudioBuffer>();
  private manifest: Manifest | null = null;
  private playingUntil = 0; // ctx time the current cue queue finishes
  private lastCueByType = new Map<string, number>();

  constructor(
    private readonly baseUrl: string,
    private readonly dialect: Dialect,
  ) {}

  /** Must be called from a user gesture to satisfy autoplay policies. */
  async unlock(manifest: Manifest): Promise<void> {
    this.manifest = manifest;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  private segmentsFor(cue: Cue): string[] {
    if (!this.manifest) return [];
    const entry = this.manifest.phrases[cue.id];
    if (!entry) return [];
    const out: string[] = [];
    for (const seg of entry.segments) {
      if (seg === '_num') {
        const key = entry.parametric ?? '';
        out.push(...numberSegments(Number(cue.params[key] ?? 1), this.manifest));
      } else {
        out.push(seg);
      }
    }
    return out;
  }

  private urlFor(seg: string): string {
    const ext = this.manifest?.audio_ext ?? 'webm';
    return `${this.baseUrl.replace(/\/$/, '')}/${this.dialect}/${seg}.${ext}`;
  }

  private async buffer(seg: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    if (this.cache.has(seg)) return this.cache.get(seg)!;
    try {
      const res = await fetch(this.urlFor(seg));
      if (!res.ok) return null;
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.cache.set(seg, buf);
      return buf;
    } catch {
      return null; // missing segment: degrade silently (caption still shows)
    }
  }

  /** Warm the cache for the cues most likely to fire. */
  async preload(cueIds: string[]): Promise<void> {
    if (!this.manifest) return;
    const segs = new Set<string>();
    for (const id of cueIds) {
      const entry = this.manifest.phrases[id];
      entry?.segments.forEach((s) => s !== '_num' && segs.add(s));
    }
    ['200', '500', '1000', '1', '2', '3', '4', '5'].forEach((n) => segs.add(n));
    await Promise.all([...segs].map((s) => this.buffer(s)));
  }

  /** Play a cue. Returns false if suppressed (a cue is already playing). */
  async play(cue: Cue): Promise<boolean> {
    if (!this.ctx) return false;
    if (this.ctx.currentTime < this.playingUntil) return false; // don't overlap
    const segs = this.segmentsFor(cue);
    let when = this.ctx.currentTime + 0.02;
    for (const seg of segs) {
      const buf = await this.buffer(seg);
      if (!buf) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(when);
      when += buf.duration;
    }
    this.playingUntil = when;
    this.lastCueByType.set(cue.id, Date.now());
    return true;
  }
}

export function numberSegments(value: number, manifest: Manifest): string[] {
  const numbers = manifest.numbers;
  if (String(value) in numbers) return [String(value)];
  const segs: string[] = [];
  let rem = value;
  for (const atom of [1000, 500, 200, 10]) {
    while (rem >= atom && String(atom) in numbers) {
      segs.push(String(atom));
      rem -= atom;
    }
  }
  for (let u = rem; u > 0; u--) {
    if (String(u) in numbers) {
      segs.push(String(u));
      break;
    }
  }
  return segs.length ? segs : ['1'];
}
