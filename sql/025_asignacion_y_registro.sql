-- Clientes asignados a cada miembro del equipo y registro de actividad de usuarios.
create table if not exists client_assignments (
  client_id uuid not null references clients(id) on delete cascade,
  user_id uuid not null references team_users(id) on delete cascade,
  assigned_by text,
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index if not exists client_assignments_user_idx on client_assignments(user_id);

create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text,
  actor_kind text not null default 'equipo' check (actor_kind in ('equipo', 'cliente', 'sistema')),
  action text not null,
  client_id uuid references clients(id) on delete set null,
  client_name text,
  target text,
  detail text
);
create index if not exists audit_log_at_idx on audit_log(at desc);
create index if not exists audit_log_client_idx on audit_log(client_id);

alter table client_assignments enable row level security;
alter table audit_log enable row level security;

-- Para no cambiar nada de golpe: cada miembro actual conserva los clientes que ya veía. Después se ajusta desde «Usuarios».
insert into client_assignments (client_id, user_id, assigned_by)
select c.id, u.id, 'migración' from clients c cross join team_users u where u.role = 'member'
on conflict do nothing;
