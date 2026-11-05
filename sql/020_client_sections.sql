-- Secciones de la ficha que lleva ESTE cliente (elegidas al darlo de alta o en «Datos del cliente»).
-- null = las de su categoría (o todas si la categoría no limita), como hasta ahora.
alter table clients add column if not exists sections text[];
