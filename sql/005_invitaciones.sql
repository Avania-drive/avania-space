-- Alta de usuarios del equipo por correo: enlace de un solo uso para elegir contraseña (se guarda solo el hash, caduca a las 48 h).
alter table team_users add column if not exists invite_hash text;
alter table team_users add column if not exists invite_expires_at timestamptz;
create index if not exists team_users_invite_hash_idx on team_users (invite_hash) where invite_hash is not null;
