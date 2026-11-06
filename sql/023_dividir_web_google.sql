-- «Web y Google» se divide en dos secciones: «accesos» (ahora Web) y «google» (nueva, con Google My Business).
-- Los datos de Google (google_alta, google_quien, ga_enlace, gtm_id, gmb_enlace, gsc_enlace, gads_id) pasan de accesos a google.
with moved as (
  select client_id,
    jsonb_strip_nulls(jsonb_build_object(
      'google_alta', data->'google_alta', 'google_quien', data->'google_quien', 'ga_enlace', data->'ga_enlace', 'gtm_id', data->'gtm_id',
      'gmb_enlace', data->'gmb_enlace', 'gsc_enlace', data->'gsc_enlace', 'gads_id', data->'gads_id',
      'gmb_estado', case when btrim(coalesce(data->>'gmb_enlace', '')) <> '' then to_jsonb('Sí'::text) end,
      '_avania', (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(data->'_avania') = 'array' then data->'_avania' else '[]'::jsonb end) v
                   where v #>> '{}' in ('google_alta','google_quien','ga_enlace','gtm_id','gmb_enlace','gsc_enlace','gads_id'))
    )) as g
  from client_sections where section = 'accesos'
)
insert into client_sections (client_id, section, data)
select client_id, 'google', g from moved
where g <> '{}'::jsonb and g <> '{"_avania": []}'::jsonb
on conflict (client_id, section) do update set data = client_sections.data || excluded.data;

update client_sections set data = (data - 'google_alta' - 'google_quien' - 'ga_enlace' - 'gtm_id' - 'gmb_enlace' - 'gsc_enlace' - 'gads_id')
  || case when jsonb_typeof(data->'_avania') = 'array' then jsonb_build_object('_avania', (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements(data->'_avania') v
        where v #>> '{}' not in ('google_alta','google_quien','ga_enlace','gtm_id','gmb_enlace','gsc_enlace','gads_id'))) else '{}'::jsonb end
 where section = 'accesos';

-- Las categorías y los clientes que llevaban «accesos» llevan también «google».
update categories set sections = array_append(sections, 'google') where sections is not null and 'accesos' = any(sections) and not ('google' = any(sections));
update clients set sections = array_append(sections, 'google') where sections is not null and 'accesos' = any(sections) and not ('google' = any(sections));
