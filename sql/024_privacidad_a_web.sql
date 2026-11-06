-- La política de privacidad (¿la tenéis? + enlace) pasa de Meta (píxel) a Web: los datos se mueven de la sección «meta» a «accesos».
with moved as (
  select client_id, jsonb_strip_nulls(jsonb_build_object('privacidad', data->'privacidad', 'privacidad_url', data->'privacidad_url')) as g
  from client_sections where section = 'meta' and (data ? 'privacidad' or data ? 'privacidad_url')
)
insert into client_sections (client_id, section, data) select client_id, 'accesos', g from moved where g <> '{}'::jsonb
on conflict (client_id, section) do update set data = client_sections.data || excluded.data;
update client_sections set data = data - 'privacidad' - 'privacidad_url' where section = 'meta';
