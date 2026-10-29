-- Categoría de cada cliente (clínica dental, industrial, seguros…) con su color.
create table if not exists categories (
  name text primary key,
  color text not null default '#0f766e'
);
alter table categories enable row level security;
alter table clients add column if not exists category text;
insert into categories (name, color) values ('Clínica dental', '#0f766e'), ('Industrial', '#b45309'), ('Seguros', '#1d4ed8') on conflict do nothing;
update clients set category = 'Clínica dental' where category is null;
