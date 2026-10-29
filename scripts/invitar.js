// Crea un usuario del equipo (si no existe) y le manda el correo con el enlace para elegir su contraseña.
//   node scripts/invitar.js correo@avania.es "Nombre Apellido" member|admin
import 'dotenv/config';
import { q } from '../src/db.js';
import { hashPassword, randomToken } from '../src/crypto.js';
import { sendInvite } from '../src/invite.js';

const [email0, name = '', role = 'member'] = process.argv.slice(2);
const email = String(email0 ?? '').trim().toLowerCase();
if (!/^\S+@\S+\.\S+$/.test(email) || !['admin', 'member'].includes(role)) { console.error('Uso: node scripts/invitar.js correo "Nombre" member|admin'); process.exit(1); }
let u = (await q('select id, email, name, role from team_users where email = $1', [email])).rows[0];
if (u) console.log(`Ya existe ${email} (${u.role}): solo se le reenvía el enlace.`);
else {
  await q('insert into team_users (email, name, role, password_hash) values ($1,$2,$3,$4)', [email, name.slice(0, 120), role, hashPassword(randomToken(9))]);
  u = (await q('select id, email, name, role from team_users where email = $1', [email])).rows[0];
  console.log(`Creado ${email} como ${role}.`);
}
await sendInvite(u, { reminder: false });
console.log(`Correo enviado a ${email}.`);
process.exit(0);
