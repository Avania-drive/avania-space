-- Fase 2 del esquema: usuarios del cliente (portal), solicitudes de acceso, logo del cliente y Bóveda de herramientas.

-- Usuarios del cliente: responsable (ve todo lo suyo, invita a su equipo, ve accesos) o miembro (rellena y consulta, no ve accesos).
create table if not exists client_users (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  email text not null unique,
  name text,
  role text not null check (role in ('responsable', 'miembro')),
  password_hash text,
  invite_hash text,
  invite_expires_at timestamptz,
  active boolean not null default true,
  last_login timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists client_users_client_idx on client_users(client_id);

create table if not exists client_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references client_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- «Solicitar acceso» desde la barra de enlaces del cliente.
create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  link_id uuid references client_links(id) on delete set null,
  link_type text not null,
  requested_by text,
  status text not null default 'pendiente' check (status in ('pendiente', 'atendida')),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by text
);
create index if not exists access_requests_status_idx on access_requests(status, created_at desc);

create table if not exists client_logos (
  client_id uuid primary key references clients(id) on delete cascade,
  type text not null,
  data bytea not null,
  updated_at timestamptz not null default now()
);

-- Bóveda de herramientas de AVANIA (solo administradores). Contraseña y clave API van cifradas (AES-256-GCM, como las credenciales).
create table if not exists vault_tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  category text,
  purpose text,
  url text,
  username text,
  password_enc text,
  api_key_enc text,
  used_by text,
  cost text,
  renewal date,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table client_users enable row level security;
alter table client_sessions enable row level security;
alter table access_requests enable row level security;
alter table client_logos enable row level security;
alter table vault_tools enable row level security;
