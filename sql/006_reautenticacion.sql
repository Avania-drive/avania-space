-- Credenciales: antes de abrirlas hay que volver a escribir la contraseña de la cuenta. La sesión recuerda hasta cuándo vale esa comprobación.
alter table sessions add column if not exists reauth_until timestamptz;
