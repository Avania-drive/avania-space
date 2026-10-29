-- El píxel de seguimiento pasa de «Accesos» a «Meta»: se mueven las respuestas ya guardadas.
insert into client_sections (client_id, section, data)
select client_id, 'meta', jsonb_strip_nulls(jsonb_build_object('pixel', data->'pixel', 'privacidad', data->'privacidad', 'cookies', data->'cookies'))
from client_sections
where section = 'accesos' and (data ? 'pixel' or data ? 'privacidad' or data ? 'cookies')
on conflict (client_id, section) do update set data = client_sections.data || excluded.data;
update client_sections set data = data - 'pixel' - 'privacidad' - 'cookies' where section = 'accesos';
