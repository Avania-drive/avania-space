-- Onboarding en cinco áreas: cierre de la parte de AVANIA, informe por correo y equipo de AVANIA (quién es quién).
-- No toca ningún dato de cliente: las secciones nuevas (mercado, cronograma, avania) nacen vacías y las existentes conservan sus claves.
alter table clients add column if not exists team_done_at timestamptz;     -- la agencia da por terminada su parte
alter table clients add column if not exists report_sent_at timestamptz;   -- ya se envió el informe de onboarding

-- Las categorías con plantilla propia incorporan las secciones nuevas (las dentales llevan todas, porque su plantilla es null).
update categories
   set sections = (select array_agg(distinct x) from unnest(sections || array['mercado','cronograma','avania']) x)
 where sections is not null;

-- Directorio del equipo de AVANIA: de aquí se rellena la ficha «quién es quién» de cada cliente.
create table if not exists agency_people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  responsibilities text,
  email text unique,
  phone text,
  position int not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table agency_people enable row level security;
insert into agency_people (name, email, position)
  select coalesce(nullif(name, ''), email), email, (row_number() over (order by created_at))::int
    from team_users where active
  on conflict (email) do nothing;
