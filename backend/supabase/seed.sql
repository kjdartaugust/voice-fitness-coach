-- Seed data for local dev / demo. Matches auth.DEMO_USER_ID in the backend.
insert into profiles (id, display_name, dialect, weekly_target_km)
values ('00000000-0000-0000-0000-000000000001', 'Kwame', 'twi', 25)
on conflict (id) do nothing;

insert into plans (profile_id, name, goal, sessions, active) values
('00000000-0000-0000-0000-000000000001', '5K plan', '5k',
 '[{"day":2,"type":"interval","distance_km":5,"target_pace_s_per_km":310,"notes":"6x400m"},
   {"day":4,"type":"tempo","distance_km":6,"target_pace_s_per_km":345,"notes":"steady tempo"},
   {"day":6,"type":"long","distance_km":10,"target_pace_s_per_km":390,"notes":"easy long run"}]',
 true)
on conflict do nothing;

insert into runs (profile_id, mode, dialect, distance_m, duration_s,
                  avg_pace_s_per_km, avg_cadence_spm, target_pace_s_per_km,
                  splits, client_id)
values
('00000000-0000-0000-0000-000000000001', 'tempo', 'twi', 6000, 2100, 350, 172, 345,
 '[{"km":1,"duration_s":352,"pace_s_per_km":352},{"km":2,"duration_s":349,"pace_s_per_km":349}]',
 'seed-run-1'),
('00000000-0000-0000-0000-000000000001', 'long', 'twi', 10000, 3900, 390, 168, 390,
 '[{"km":1,"duration_s":388,"pace_s_per_km":388}]',
 'seed-run-2')
on conflict (client_id) do nothing;
