-- Preferencias de cada persona del equipo: tema (auto/claro/oscuro) y color de acento.
alter table team_users add column if not exists prefs jsonb not null default '{}'::jsonb;
