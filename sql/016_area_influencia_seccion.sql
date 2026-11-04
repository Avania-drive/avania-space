-- «Área de influencia» pasa de ser un grupo de La empresa (clinica) a su propia sección (zona), junto a Datos, Horarios y Marca.
-- Se copian los tres campos y sus marcas «lo hará Avania»; el resto de datos del cliente no se toca.
insert into client_sections (client_id, section, data)
select client_id, 'zona',
       (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(data) as e(k, v) where k in ('radio', 'localidades', 'zonas_excluir'))
       || case when data ? '_avania' then jsonb_build_object('_avania', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(data->'_avania') x where x #>> '{}' in ('radio', 'localidades', 'zonas_excluir'))) else '{}'::jsonb end
  from client_sections
 where section = 'clinica' and (data ?| array['radio', 'localidades', 'zonas_excluir'])
on conflict (client_id, section) do update set data = client_sections.data || excluded.data;
update client_sections
   set data = (data - 'radio' - 'localidades' - 'zonas_excluir')
              || case when data ? '_avania' then jsonb_build_object('_avania', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(data->'_avania') x where x #>> '{}' not in ('radio', 'localidades', 'zonas_excluir'))) else '{}'::jsonb end
 where section = 'clinica';
-- Las categorías con plantilla propia que llevaban Datos llevan también el Área de influencia.
update categories set sections = (select array_agg(distinct x) from unnest(sections || array['zona']) x) where sections is not null and 'clinica' = any(sections);
