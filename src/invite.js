// Invitación por correo a un usuario del equipo: enlace de un solo uso (48 h) para que elija su contraseña. Se guarda solo el hash del enlace.
import { q } from './db.js';
import { randomToken, sha256 } from './crypto.js';
import { sendMail, PUBLIC_URL } from './mailer.js';

const INVITE_HOURS = 48;
export async function sendInvite(user, { reminder = false } = {}) {
  const token = randomToken(32);
  await q('update team_users set invite_hash = $1, invite_expires_at = now() + ($2 || \' hours\')::interval where id = $3', [sha256(token), INVITE_HOURS, user.id]);
  const hi = user.name ? `Hola, ${String(user.name).split(' ')[0]}.` : 'Hola.';
  await sendMail({
    to: user.email,
    subject: reminder ? 'Tu acceso a Avania Space (enlace nuevo)' : 'Te hemos dado acceso a Avania Space',
    title: reminder ? 'Tu enlace de acceso a Avania Space' : 'Bienvenido a Avania Space',
    paragraphs: [
      `${hi} ${reminder ? 'Aquí tienes un enlace nuevo' : 'Te hemos creado un usuario'} en Avania Space, el panel de clientes de AVANIA. Pulsa el botón para elegir tu contraseña (mínimo 12 caracteres).`,
      `Tu usuario es ${user.email}. El enlace sirve una sola vez y caduca en ${INVITE_HOURS} horas; si caduca, pide que te envíen otro.`,
      'Después de entrar te pediremos activar la doble verificación con una app de códigos.',
    ],
    button: { label: 'Elegir mi contraseña', url: `${PUBLIC_URL}/invitacion?t=${token}` },
  });
}
