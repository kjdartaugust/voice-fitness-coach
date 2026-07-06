# PWA → native (Expo) migration

**Why:** browsers throttle `geolocation.watchPosition` and `devicemotion` when the
screen is off or the tab is backgrounded. The Wake Lock keeps tracking alive while the
screen is on (fine for most runners), but true screen-off, battery-efficient background
GPS needs a native app.

**Why it's cheap for us:** all domain logic already lives in `frontend/lib/` with **no
DOM or React coupling** — `RunTracker`, `CadenceDetector`, `PaceSmoother`, the coaching
`evaluate()`, the phrase-bank number stitching, and `offlineSync`. Only the *sensor
sources* and *audio playback* are browser-specific, and both have direct Expo analogues.

## Swap table

| PWA (this repo) | Expo replacement |
|---|---|
| `navigator.geolocation.watchPosition` | `expo-location` `startLocationUpdatesAsync` + a `TaskManager` background task |
| `devicemotion` event | `expo-sensors` `Accelerometer.addListener` (with `Pedometer` as a higher-accuracy option) |
| `navigator.wakeLock` | `expo-keep-awake` + a foreground service (Android) so tracking survives screen-off |
| Web Audio `AudioCuePlayer` | `expo-av` `Audio.Sound` playing the same cached segment files |
| Service Worker + IndexedDB | `expo-file-system` cache + `expo-sqlite`/AsyncStorage queue (same `client_id` idempotency) |
| Background Sync | `expo-background-fetch` / `expo-task-manager` to flush queued runs |

## Steps
1. `npx create-expo-app runtwi-native` (Expo Router mirrors the App Router layout).
2. Copy `frontend/lib/*` **unchanged** (except imports). These carry the coaching rules,
   so the two clients stay behaviourally identical.
3. Implement `useRun` against `expo-location` + `expo-sensors`; register a background
   location task so GPS continues with the screen off.
4. Reuse the same FastAPI backend and phrase-bank URLs — no backend changes.
5. Ship via EAS Build to the Play Store (Android-first for the Ghana market).

Recommendation: keep the PWA as the zero-friction entry point (no install, works on any
phone), and offer the native app for serious training where screen-off battery life
matters.
