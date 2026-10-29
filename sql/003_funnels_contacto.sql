-- El cliente es un contacto del CRM de Avania Funnels de AVANIA: se identifica por el ID del contacto, no de una subcuenta.
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'funnels_location_id') then
    alter table clients rename column funnels_location_id to funnels_contact_id;
  end if;
end $$;
alter table clients add column if not exists funnels_contact_id text;
drop index if exists clients_funnels_location_uidx;
create unique index if not exists clients_funnels_contact_uidx on clients(funnels_contact_id) where funnels_contact_id is not null;
