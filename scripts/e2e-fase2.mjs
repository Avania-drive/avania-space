// Prueba de la fase 2: portal del cliente (cuentas, aislamiento, solicitudes de acceso, logo) y Bóveda.
// Arrancar antes un servidor SIN correo para que no salgan invitaciones reales:
//   PORT=3013 SMTP_HOST= node src/index.js &    y luego    B=http://127.0.0.1:3013 node scripts/e2e-fase2.mjs
import 'dotenv/config';
import { authenticator } from 'otplib';
import { q, pool } from '../src/db.js';
import { hashPassword, sha256 } from '../src/crypto.js';
const B = process.env.B || 'http://127.0.0.1:3013';
const mk = () => { let c = ''; return async (m, u, b) => { const r = await fetch(B + u, { method: m, headers: { 'Content-Type': 'application/json', cookie: c }, body: b ? JSON.stringify(b) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) c = sc.split(';')[0]; let j = {}; const ct = r.headers.get('content-type') || ''; try { j = ct.includes('json') ? await r.json() : { type: ct, len: (await r.arrayBuffer()).byteLength }; } catch {} return { s: r.status, j }; }; };
const ok = (n, c, extra = '') => console.log((c ? 'OK  ' : 'FALLA ') + n + (c ? '' : ' ' + extra));
const PW = 'contraseña-de-prueba-1';
await q("delete from team_users where email like 'test-%@example.invalid'");
await q("delete from client_users where email like 'test-%@example.invalid'");
for (const [e, r] of [['test-admin@example.invalid', 'admin'], ['test-member@example.invalid', 'member']])
  await q('insert into team_users (email,name,role,password_hash,must_change_password) values ($1,$1,$2,$3,false)', [e, r, hashPassword(PW)]);
const A = mk(), M = mk(), R = mk(), Mb = mk(), R2 = mk(), anon = mk();
await A('POST', '/api/login', { email: 'test-admin@example.invalid', password: PW });
await M('POST', '/api/login', { email: 'test-member@example.invalid', password: PW });
const c1 = (await A('POST', '/api/clients', { name: 'Cliente Portal A' })).j.client;
const c2 = (await A('POST', '/api/clients', { name: 'Cliente Portal B' })).j.client;
// ── usuarios del cliente
ok('crear usuario con correo malo → 400', (await A('POST', `/api/clients/${c1.id}/users`, { email: 'x', role: 'responsable' })).s === 400);
ok('crear usuario con rol malo → 400', (await A('POST', `/api/clients/${c1.id}/users`, { email: 'test-r1@example.invalid', role: 'jefe' })).s === 400);
const cr = await A('POST', `/api/clients/${c1.id}/users`, { email: 'test-r1@example.invalid', name: 'Resp Uno', role: 'responsable' });
ok('crear responsable (sin SMTP: avisa de que no salió el correo)', cr.s === 200 && cr.j.user?.pending === true && cr.j.email_sent === false, JSON.stringify(cr.j));
ok('correo repetido → 409', (await A('POST', `/api/clients/${c1.id}/users`, { email: 'test-r1@example.invalid', role: 'miembro' })).s === 409);
const r1 = cr.j.user;
// invitación (el enlace se guarda hasheado: lo fijamos a mano)
await q("update client_users set invite_hash=$1, invite_expires_at = now() + interval '1 hour' where id=$2", [sha256('tok-prueba-1'), r1.id]);
ok('invitación válida', (await anon('GET', '/api/p/invitacion/tok-prueba-1')).j.email === 'test-r1@example.invalid');
ok('contraseña corta → 400', (await anon('POST', '/api/p/invitacion/tok-prueba-1', { password: 'corta' })).s === 400);
ok('elige contraseña', (await anon('POST', '/api/p/invitacion/tok-prueba-1', { password: PW })).s === 200);
ok('el enlace ya no vale', (await anon('GET', '/api/p/invitacion/tok-prueba-1')).s === 404);
ok('login mal → 401', (await R('POST', '/api/p/login', { email: 'test-r1@example.invalid', password: 'x' })).s === 401);
ok('login responsable', (await R('POST', '/api/p/login', { email: 'test-r1@example.invalid', password: PW })).s === 200);
ok('portal /me', (await R('GET', '/api/p/me')).j.client?.name === 'Cliente Portal A');
// aislamiento entre sesiones de equipo y de cliente
ok('sesión de cliente NO abre el panel del equipo', (await R('GET', '/api/clients')).s === 401);
ok('sesión de equipo NO abre el portal', (await A('GET', '/api/p/me')).s === 401);
ok('sin sesión → portal 401', (await anon('GET', '/api/p/home')).s === 401);
// enlaces, notas
const lv = (await A('POST', `/api/clients/${c1.id}/links`, { type: 'ClickUp', url: 'https://app.clickup.com/x', has_access: 'no', visible: true })).j.link;
await A('POST', `/api/clients/${c1.id}/links`, { type: 'Slack', url: 'https://slack.com/x', visible: false });
await A('POST', `/api/clients/${c1.id}/notes`, { body: 'Nota interna secreta', visible: false });
await A('POST', `/api/clients/${c1.id}/notes`, { body: 'Aviso para el cliente', visible: true });
const home = (await R('GET', '/api/p/home')).j;
ok('home: solo enlaces visibles', home.links.length === 1 && home.links[0].type === 'ClickUp' && home.links[0].has_access === 'no', JSON.stringify(home.links));
ok('home: solo notas visibles', home.notes.length === 1 && home.notes[0].body === 'Aviso para el cliente' && !JSON.stringify(home).includes('secreta'));
ok('home: trae el siguiente paso', Array.isArray(home.next) && home.next.length > 0);
// solicitar acceso
ok('solicitar acceso a un enlace ajeno → 404', (await R('POST', `/api/p/links/00000000-0000-4000-8000-000000000000/request`)).s === 404);
ok('solicitar acceso', (await R('POST', `/api/p/links/${lv.id}/request`)).s === 200);
await R('POST', `/api/p/links/${lv.id}/request`);
const reqs = (await A('GET', '/api/access-requests')).j.requests.filter((x) => x.client_id === c1.id);
ok('la solicitud llega al equipo (sin duplicar)', reqs.length === 1 && reqs[0].link_type === 'ClickUp', JSON.stringify(reqs));
ok('el home marca la solicitud', (await R('GET', '/api/p/home')).j.links[0].requested === true);
ok('el equipo la atiende', (await M('PATCH', `/api/access-requests/${reqs[0].id}`)).s === 200 && (await A('GET', '/api/access-requests')).j.requests.every((x) => x.client_id !== c1.id));
// formulario por el portal
const f = await R('GET', '/api/p/form');
ok('formulario por el portal', f.s === 200 && f.j.client.name === 'Cliente Portal A' && f.j.role === 'responsable');
ok('guarda una sección', (await R('PUT', '/api/p/form/sections/clinica', { telefono: '600000000' })).s === 200);
await R('PUT', '/api/p/form/sections/proyecto', { responsable_cuenta: 'HACK' });
ok('NO guarda campos del equipo', ((await A('GET', `/api/clients/${c1.id}`)).j.sections.proyecto || {}).responsable_cuenta === undefined);
ok('responsable crea credencial', (await R('POST', '/api/p/form/credentials', { service: 'Hosting', password: 'S3cr3t-Portal!' })).s === 200);
ok('el portal NO devuelve contraseñas', !JSON.stringify((await R('GET', '/api/p/form')).j).includes('S3cr3t'));
// Mi equipo
const inv = await R('POST', '/api/p/team', { email: 'test-m1@example.invalid', name: 'Miembro Uno' });
ok('responsable invita a un miembro', inv.s === 200 && inv.j.user.role === 'miembro', JSON.stringify(inv.j));
await q("update client_users set password_hash=$1 where email='test-m1@example.invalid'", [hashPassword(PW)]);
ok('login miembro', (await Mb('POST', '/api/p/login', { email: 'test-m1@example.invalid', password: PW })).s === 200);
ok('miembro NO ve Mi equipo', (await Mb('GET', '/api/p/team')).s === 403);
ok('miembro NO invita', (await Mb('POST', '/api/p/team', { email: 'test-m2@example.invalid' })).s === 403);
ok('miembro NO crea credenciales', (await Mb('POST', '/api/p/form/credentials', { service: 'X' })).s === 403);
ok('miembro NO recibe la lista de credenciales', (await Mb('GET', '/api/p/form')).j.credentials.length === 0);
ok('miembro rellena el alta', (await Mb('PUT', '/api/p/form/sections/clinica', { web: 'https://x.test' })).s === 200);
ok('el miembro no ve el paso de credenciales', !(await Mb('GET', '/api/p/home')).j.next.some((g) => g.key === 'credenciales'));
// otro cliente: aislamiento
const r2 = (await A('POST', `/api/clients/${c2.id}/users`, { email: 'test-r2@example.invalid', role: 'responsable' })).j.user;
await q("update client_users set password_hash=$1 where id=$2", [hashPassword(PW), r2.id]);
await R2('POST', '/api/p/login', { email: 'test-r2@example.invalid', password: PW });
ok('el responsable de A NO toca usuarios de B', (await R('PATCH', `/api/p/team/${r2.id}`, { active: false })).s === 404);
ok('el responsable de A NO ve las notas ni enlaces de B', (await R2('GET', '/api/p/home')).j.notes.length === 0);
ok('responsable NO toca a otro responsable', (await R('PATCH', `/api/p/team/${r1.id}`, { active: false })).s === 403);
ok('responsable desactiva a su miembro', (await R('PATCH', `/api/p/team/${inv.j.user.id}`, { active: false })).j.user.active === false);
ok('el miembro desactivado pierde la sesión', (await Mb('GET', '/api/p/me')).s === 401);
ok('cambiar contraseña con la actual mal → 400', (await R('POST', '/api/p/password', { current: 'x', password: 'otra-contraseña-larga' })).s === 400);
// equipo: roles
ok('member del equipo puede listar usuarios del cliente', (await M('GET', `/api/clients/${c1.id}/users`)).j.users.length === 2);
// vista de cliente (solo administradores): lo mismo que ve el cliente en su inicio
const pvR = await A('GET', `/api/clients/${c1.id}/preview/home?role=responsable`), pvM = await A('GET', `/api/clients/${c1.id}/preview/home?role=miembro`);
ok('administrador abre la vista de cliente', pvR.s === 200 && pvR.j.role === 'responsable' && pvR.j.client.name === 'Cliente Portal A');
ok('coincide con el inicio real del portal', JSON.stringify(pvR.j.next) === JSON.stringify((await R('GET', '/api/p/home')).j.next) && pvR.j.links.length === 1);
ok('como miembro no sale el paso de credenciales', pvR.j.next.some((g) => g.key === 'credenciales') && !pvM.j.next.some((g) => g.key === 'credenciales'));
ok('la vista de cliente no enseña notas internas', !JSON.stringify(pvR.j).includes('secreta') && pvR.j.notes.length === 1);
ok('member de la agencia NO abre la vista de cliente', (await M('GET', `/api/clients/${c1.id}/preview/home`)).s === 403);
ok('un usuario del cliente NO abre la vista de cliente', (await R('GET', `/api/clients/${c1.id}/preview/home`)).s === 401);
// logo
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
ok('logo SVG rechazado', (await A('PUT', `/api/clients/${c1.id}/logo`, { data: 'data:image/svg+xml;base64,PHN2Zz4=' })).s === 400);
ok('logo texto rechazado', (await A('PUT', `/api/clients/${c1.id}/logo`, { data: 'hola' })).s === 400);
ok('logo PNG', (await A('PUT', `/api/clients/${c1.id}/logo`, { data: PNG })).s === 200);
const lg = await A('GET', `/api/clients/${c1.id}/logo`);
ok('el equipo recibe el logo como imagen', lg.j.type === 'image/png' && lg.j.len > 50, JSON.stringify(lg.j));
ok('el portal recibe SU logo', (await R('GET', '/api/p/logo')).j.type === 'image/png' && (await R2('GET', '/api/p/logo')).s === 404);
ok('la lista de clientes marca el logo', (await A('GET', '/api/clients')).j.clients.find((c) => c.id === c1.id).logo_v > 0);
// ── Bóveda
ok('member NO entra en la Bóveda', (await M('GET', '/api/vault')).s === 403);
ok('Bóveda sin contraseña reciente → password_required', (await A('GET', '/api/vault')).j.code === 'password_required');
await A('POST', '/api/reauth', { password: PW });
ok('Bóveda abierta', (await A('GET', '/api/vault')).s === 200);
ok('herramienta sin nombre → 400', (await A('POST', '/api/vault', { url: 'https://x.test' })).s === 400);
const t = (await A('POST', '/api/vault', { name: 'Herramienta Prueba', url: 'https://example.com', password: 'Boveda-Secreta-1', api_key: 'sk-test-12345', cost: '10 €/mes', renewal: '2027-01-15' })).j.tool;
ok('crea herramienta; no devuelve secretos', t?.has_password && t.has_api_key && !JSON.stringify(t).includes('Secreta') && t.renewal === '2027-01-15', JSON.stringify(t));
const raw = (await q('select password_enc, api_key_enc from vault_tools where id=$1', [t.id])).rows[0];
ok('en la base van cifrados', !raw.password_enc.includes('Secreta') && !raw.api_key_enc.includes('sk-test'));
ok('la lista no trae secretos', !JSON.stringify((await A('GET', '/api/vault')).j).includes('Secreta'));
ok('revelar sin 2FA → no_mfa', (await A('POST', `/api/vault/${t.id}/reveal`, {})).j.code === 'no_mfa');
const setup = (await A('POST', '/api/mfa/setup')).j;
await A('POST', '/api/mfa/enable', { code: authenticator.generate(setup.secret) });
const A2 = mk(); await A2('POST', '/api/login', { email: 'test-admin@example.invalid', password: PW }); await A2('POST', '/api/reauth', { password: PW });
ok('revelar sin código → mfa_required', (await A2('POST', `/api/vault/${t.id}/reveal`, {})).j.code === 'mfa_required');
await A2('POST', '/api/mfa/verify', { code: authenticator.generate(setup.secret) });
ok('revelar contraseña', (await A2('POST', `/api/vault/${t.id}/reveal`, {})).j.secret === 'Boveda-Secreta-1');
ok('revelar clave API', (await A2('POST', `/api/vault/${t.id}/reveal`, { field: 'api_key', copy: true })).j.secret === 'sk-test-12345');
const lgv = (await A2('GET', `/api/vault/${t.id}/log`)).j.log.map((x) => x.action);
ok('queda registrado quién la vio', lgv.includes('bóveda: ver contraseña') && lgv.includes('bóveda: copiar clave API'), lgv.join());
ok('editar sin tocar secretos los conserva', (await A2('PUT', `/api/vault/${t.id}`, { cost: '12 €/mes' })).j.tool.has_password === true);
ok('borrar', (await A2('DELETE', `/api/vault/${t.id}`)).s === 200);
// limpieza
await q('delete from clients where id in ($1,$2)', [c1.id, c2.id]);
await q("delete from credential_log where actor like 'test-%@example.invalid'");
await q("delete from team_users where email like 'test-%@example.invalid'");
await pool.end();
