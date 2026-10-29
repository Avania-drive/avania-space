-- Conexión de solo lectura con la subcuenta de Avania Funnels de cada cliente, para los KPIs de la pestaña «Resultados».
-- El token (integración privada de esa subcuenta) va cifrado como las credenciales; nunca se devuelve por la API.
create table if not exists client_funnels (
  client_id uuid primary key references clients(id) on delete cascade,
  location_id text not null,
  token_enc text not null,
  connected_by text,
  connected_at timestamptz not null default now(),
  last_ok timestamptz,
  last_error text
);
alter table client_funnels enable row level security;
