-- Documentos subidos desde Space a la ficha de un cliente (contrato, materiales, informes…). Se guardan en la base de datos, hasta 15 MB cada uno.
create table if not exists client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  mime text not null default 'application/octet-stream',
  size integer not null,
  data bytea not null,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists client_files_client on client_files (client_id, created_at desc);
alter table client_files enable row level security;
