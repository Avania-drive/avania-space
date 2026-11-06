-- «¿Tenéis política de privacidad publicada?» pasa a Sí / No / No lo sé, con el enlace en un campo aparte que sale al contestar Sí.
-- Antes era un texto con el enlace (5-nov-2026: solo SEDI tenía valor, una URL).
update client_sections
   set data = jsonb_set(jsonb_set(data, '{privacidad_url}', to_jsonb(btrim(data->>'privacidad'))), '{privacidad}', '"Sí"')
 where section = 'meta' and btrim(coalesce(data->>'privacidad', '')) ~* '^https?://';
update client_sections set data = jsonb_set(data, '{privacidad}', '"Sí"')
 where section = 'meta' and lower(btrim(coalesce(data->>'privacidad', ''))) in ('si', 'sí');
