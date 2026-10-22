-- Avania Space: esquema inicial.
-- Toda la app habla con Postgres desde el servidor (DATABASE_URL). Las tablas tienen RLS activado
-- y sin políticas: las claves públicas de Supabase (anon/publishable) no pueden leer nada.

create extension if not exists pgcrypto;

create table if not exists team_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  role text not null check (role in ('super_admin', 'admin', 'member')),
  password_hash text not null,
  must_change_password boolean not null default true,
  totp_secret_enc text,
  totp_enabled boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references team_users(id) on delete cascade,
  mfa_until timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  status text not null default 'onboarding'
    check (status in ('onboarding', 'rodaje', 'formacion', 'activa', 'pausada')),
  account_manager text,
  start_date date,
  link_clickup text,
  link_drive text,
  token text not null unique,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Respuestas del documento de onboarding, una fila por sección (jsonb con los campos).
create table if not exists client_sections (
  client_id uuid not null references clients(id) on delete cascade,
  section text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (client_id, section)
);

-- Caja fuerte: la contraseña solo se guarda cifrada (AES-256-GCM, clave en el servidor).
create table if not exists credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service text not null,
  company text,
  username text,
  email text,
  password_enc text,
  url text,
  notes text,
  status text not null default 'pendiente' check (status in ('pendiente', 'recibida', 'verificada')),
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists credentials_client_idx on credentials(client_id);

create table if not exists credential_log (
  id bigserial primary key,
  credential_id uuid,
  client_id uuid,
  user_id uuid,
  actor text not null,
  action text not null,
  at timestamptz not null default now()
);
create index if not exists credential_log_client_idx on credential_log(client_id, at desc);

alter table team_users enable row level security;
alter table sessions enable row level security;
alter table clients enable row level security;
alter table client_sections enable row level security;
alter table credentials enable row level security;
alter table credential_log enable row level security;
