-- Accesos que se entran con Google, Meta o Apple y no necesitan contraseña propia.
alter table credentials add column if not exists login_with text[] not null default '{}';
alter table vault_tools add column if not exists login_with text[] not null default '{}';
