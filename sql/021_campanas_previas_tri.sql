-- «¿Habéis hecho campañas antes?» pasa de texto libre a selector Sí / No / No lo sé.
-- Valores que había (5-nov-2026): SEDI «Sí», Duesthetic «Si» y la clínica de Paula Fernández Riveiro «ALGUN ANUNCIO » (texto libre → «Sí»).
update client_sections set data = jsonb_set(data, '{campanas_previas}', '"Sí"')
 where section = 'meta' and lower(btrim(data->>'campanas_previas')) in ('si', 'sí', 'algun anuncio', 'algún anuncio');
