-- Asignación manual de campaña y anuncio a oportunidades que Avania Funnels guardó sin atribución.
-- Solo se guarda el identificador de la oportunidad: ningún nombre, teléfono ni correo del lead.
create table if not exists lead_overrides (
  client_id uuid not null references clients(id) on delete cascade,
  opp_id text not null,
  campaign text,
  creative text,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (client_id, opp_id)
);
alter table lead_overrides enable row level security;
