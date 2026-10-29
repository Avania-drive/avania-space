-- Estados del cliente por categoría y sección «Objetivos y datos para medir» (negocio).
-- Ese «montaje» es el de campaña, embudo y CRM que el documento de onboarding sitúa en los primeros 20 días.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'clients'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table clients drop constraint %I', c);
  end loop;
end $$;
alter table clients add constraint clients_status_check check (status in ('onboarding', 'montaje', 'rodaje', 'formacion', 'activa', 'pausada'));

-- categories.statuses: pasos por los que pasa un cliente de esa categoría (null = todos los de la clínica: rodaje y formación incluidos).
alter table categories add column if not exists statuses text[];
update categories set statuses = array['onboarding','montaje','activa','pausada'] where statuses is null and name not ilike '%dental%' and name not ilike '%cl_nica%';

-- Las plantillas que ya limitan secciones incorporan la nueva.
update categories set sections = array_append(sections, 'negocio') where sections is not null and not ('negocio' = any(sections));
