/**
 * Offline-first run sync. Completed runs are written to IndexedDB immediately,
 * then flushed to the API. Each run carries a client_id idempotency key so the
 * flush is safe to retry — the server upserts on it. Registers a Background Sync
 * so the browser retries after the app is closed when connectivity returns.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { RunRecord } from './types';

const DB_NAME = 'runtwi';
const STORE = 'pending_runs';

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'client_id' });
      }
    },
  });
}

export async function queueRun(run: RunRecord): Promise<void> {
  const d = await db();
  await d.put(STORE, run);
  // ask the SW to sync when back online; falls back to immediate flush
  try {
    const reg = await navigator.serviceWorker?.ready;
    // @ts-expect-error - sync is not in all lib.dom versions
    await reg?.sync?.register('sync-runs');
  } catch {
    /* Background Sync unsupported — flush() on next app open covers it */
  }
}

export async function pendingRuns(): Promise<RunRecord[]> {
  const d = await db();
  return d.getAll(STORE);
}

/** Flush all queued runs to the API. Returns the count successfully synced. */
export async function flush(apiUrl: string, token?: string): Promise<number> {
  const d = await db();
  const runs: RunRecord[] = await d.getAll(STORE);
  let synced = 0;
  for (const run of runs) {
    try {
      const res = await fetch(`${apiUrl}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(run),
      });
      if (res.ok) {
        await d.delete(STORE, run.client_id);
        synced++;
      }
    } catch {
      break; // still offline; leave the rest queued
    }
  }
  return synced;
}
