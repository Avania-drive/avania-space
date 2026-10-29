-- Llaves de acceso (passkeys, WebAuthn) como segunda verificación, además del código de la app.
create table if not exists passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references team_users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[],
  name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkeys_user on passkeys(user_id);
alter table passkeys enable row level security;
alter table sessions add column if not exists wa_challenge text;
