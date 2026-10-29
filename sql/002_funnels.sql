-- Alta por ID de la subcuenta de Avania Funnels. El token de la integración privada NO va aquí:
-- se guarda cifrado en la caja fuerte (credentials) del cliente.
alter table clients add column if not exists funnels_location_id text;
create unique index if not exists clients_funnels_location_uidx on clients(funnels_location_id) where funnels_location_id is not null;
