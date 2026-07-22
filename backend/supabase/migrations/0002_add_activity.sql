-- Add activity type to runs (run | walk | hike | ride).
-- Backfills existing rows to 'run'. Safe to re-run.

alter table runs
    add column if not exists activity text not null default 'run'
    check (activity in ('run', 'walk', 'hike', 'ride'));
