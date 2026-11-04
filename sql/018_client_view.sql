-- «Ver cliente»: qué páginas y secciones ve cada cliente en su espacio. Solo se guardan los cambios hechos a mano ({clave: true|false});
-- lo que no está aquí se rige por el valor de fábrica (src/visibility.js).
alter table clients add column if not exists client_view jsonb not null default '{}'::jsonb;
