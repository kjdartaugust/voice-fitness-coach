import type { Dialect } from './types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function req<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const api = {
  base: API,
  manifest: () => req<any>('/phrases/manifest'),
  profile: (token?: string) => req<any>('/profiles/me', {}, token),
  updateProfile: (body: any, token?: string) =>
    req<any>('/profiles/me', { method: 'PUT', body: JSON.stringify(body) }, token),
  runs: (token?: string) => req<any[]>('/runs', {}, token),
  stats: (token?: string) => req<any>('/runs/stats', {}, token),
  plans: (token?: string) => req<any[]>('/plans', {}, token),
  generatePlan: (goal: string, weekly_km: number, token?: string) =>
    req<any>(`/plans/generate?goal=${goal}&weekly_km=${weekly_km}`, { method: 'POST' }, token),
};

export type { Dialect };
