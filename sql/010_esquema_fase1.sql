-- Fase 1 del esquema: plantilla de alta por categoría, notas, enlaces con tipos configurables.
-- categories.sections: secciones del alta que lleva esa categoría (null = todas, como la clínica dental).
alter table categories add column if not exists sections text[];
update categories set sections = array['proyecto','clinica','accesos','meta','materiales','cierre'] where sections is null and name not ilike '%dental%' and name not ilike '%cl_nica%';

create table if not exists client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  body text not null,
  visible boolean not null default false,
  author text,
  created_at timestamptz not null default now()
);
create index if not exists client_notes_client_idx on client_notes(client_id, created_at desc);

-- Tipos de enlace configurables (nombre, icono y URL de inicio de sesión).
create table if not exists link_types (
  name text primary key,
  icon text not null default 'enlace',
  login_url text,
  position int not null default 0
);
insert into link_types (name, icon, login_url, position) values
  ('Avania Funnels', 'funnels', 'https://app.avania.marketing', 1),
  ('Avania Setex', 'setex', 'https://setter.goavania.com/panel', 2),
  ('ClickUp', 'clickup', 'https://app.clickup.com', 3),
  ('Google Drive', 'drive', 'https://drive.google.com', 4),
  ('Slack', 'slack', null, 5)
on conflict do nothing;

create table if not exists client_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  type text not null,
  url text,
  login_url text,
  has_access text not null default 'pendiente' check (has_access in ('si', 'no', 'pendiente')),
  visible boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists client_links_client_idx on client_links(client_id);

alter table client_notes enable row level security;
alter table link_types enable row level security;
alter table client_links enable row level security;
