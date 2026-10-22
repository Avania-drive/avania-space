import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import QRCode from 'qrcode';
import { fileURLToPath } from 'node:url';
import { q } from './db.js';
import { encrypt, decrypt, hashPassword, verifyPassword, randomToken, sha256 } from './crypto.js';
import {
  COOKIE, parseCookies, createSession, clearCookie, loadSession, requireUser, requireReady,
  requireRole, canSeePasswords, totp, publicUser, tooMany,
} from './auth.js';
import { FORM, SERVICES, SUGGESTED, progress, sanitizeSection } from './formdef.js';

const app = express();
const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s));
const MFA_MINUTES = 10;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  // Las escrituras solo se aceptan como JSON (junto con SameSite=Strict, frena el CSRF).
  if (req.method !== 'GET' && req.path.startsWith('/api/') && !req.is('application/json') && Number(req.headers['content-length'] || 0) > 0)
    return res.status(415).json({ error: 'Solo JSON' });
  next();
});
app.use(wrap(loadSession));

const ip = (req) => req.ip || 'x';
const tempPassword = () => randomToken(9);
const log = (credId, clientId, userId, actor, action) =>
  q('insert into credential_log (credential_id, client_id, user_id, actor, action) values ($1,$2,$3,$4,$5)',
    [credId, clientId, userId, actor, action]);

// ───────── Sesión y cuenta ─────────
app.post('/api/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (tooMany(`login:${ip(req)}:${email}`)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  const r = await q('select * from team_users where email = $1 and active', [email]);
  const u = r.rows[0];
  // Se verifica siempre algo para no delatar si el correo existe por el tiempo de respuesta.
  const ok = u ? verifyPassword(String(req.body.password || ''), u.password_hash) : (verifyPassword('x', 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'), false);
  if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  await createSession(req, res, u.id);
  res.json({ user: publicUser(u) });
}));

app.post('/api/logout', wrap(async (req, res) => {
  const t = parseCookies(req)[COOKIE];
  if (t) await q('delete from sessions where token_hash = $1', [sha256(t)]);
  clearCookie(res);
  res.json({ ok: true });
}));

app.get('/api/me', requireUser, (req, res) => res.json({
  user: publicUser(req.user),
  mfa_active: !!(req.session.mfa_until && new Date(req.session.mfa_until) > new Date()),
}));

app.post('/api/password', requireUser, wrap(async (req, res) => {
  const { current, next } = req.body;
  if (!verifyPassword(String(current || ''), req.user.password_hash)) return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  if (String(next || '').length < 12) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 12 caracteres' });
  await q('update team_users set password_hash = $1, must_change_password = false where id = $2', [hashPassword(next), req.user.id]);
  // Cierra el resto de sesiones de este usuario.
  await q('delete from sessions where user_id = $1 and id <> $2', [req.user.id, req.session.id]);
  res.json({ ok: true });
}));

// ───────── Doble verificación (TOTP) ─────────
app.post('/api/mfa/setup', requireUser, requireReady, wrap(async (req, res) => {
  if (req.user.totp_enabled) return res.status(400).json({ error: 'La doble verificación ya está activa' });
  const secret = totp.generateSecret();
  await q('update team_users set totp_secret_enc = $1 where id = $2', [encrypt(secret), req.user.id]);
  const uri = totp.keyuri(req.user.email, 'Avania Space', secret);
  res.json({ secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) });
}));

app.post('/api/mfa/enable', requireUser, requireReady, wrap(async (req, res) => {
  if (tooMany(`mfa:${req.user.id}`, 10)) return res.status(429).json({ error: 'Demasiados intentos' });
  if (!req.user.totp_secret_enc) return res.status(400).json({ error: 'Primero genera el código QR' });
  if (!totp.check(String(req.body.code || '').trim(), decrypt(req.user.totp_secret_enc))) return res.status(400).json({ error: 'Código incorrecto' });
  await q('update team_users set totp_enabled = true where id = $1', [req.user.id]);
  await q('update sessions set mfa_until = now() + ($1 || \' minutes\')::interval where id = $2', [MFA_MINUTES, req.session.id]);
  res.json({ ok: true });
}));

app.post('/api/mfa/verify', requireUser, requireReady, wrap(async (req, res) => {
  if (!req.user.totp_enabled) return res.status(400).json({ error: 'Activa primero la doble verificación', code: 'no_mfa' });
  if (tooMany(`mfa:${req.user.id}`, 10)) return res.status(429).json({ error: 'Demasiados intentos' });
  if (!totp.check(String(req.body.code || '').trim(), decrypt(req.user.totp_secret_enc))) return res.status(400).json({ error: 'Código incorrecto' });
  await q('update sessions set mfa_until = now() + ($1 || \' minutes\')::interval where id = $2', [MFA_MINUTES, req.session.id]);
  res.json({ ok: true, minutes: MFA_MINUTES });
}));

// ───────── Equipo (solo superadministrador) ─────────
const staff = [requireUser, requireReady];
app.get('/api/users', ...staff, requireRole('super_admin'), wrap(async (_req, res) => {
  const r = await q('select id, email, name, role, active, totp_enabled, must_change_password, created_at from team_users order by created_at');
  res.json({ users: r.rows });
}));

app.post('/api/users', ...staff, requireRole('super_admin'), wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = req.body.role;
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Correo no válido' });
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Rol no válido' });
  const temp = tempPassword();
  try {
    await q('insert into team_users (email, name, role, password_hash) values ($1,$2,$3,$4)',
      [email, String(req.body.name || '').slice(0, 120), role, hashPassword(temp)]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    throw e;
  }
  res.json({ ok: true, temp_password: temp });
}));

app.patch('/api/users/:id', ...staff, requireRole('super_admin'), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const t = (await q('select * from team_users where id = $1', [req.params.id])).rows[0];
  if (!t) return res.status(404).json({ error: 'No existe' });
  if (t.role === 'super_admin' && t.id !== req.user.id) return res.status(403).json({ error: 'No se puede modificar a otro superadministrador' });
  if (t.id === req.user.id && (req.body.active === false || (req.body.role && req.body.role !== 'super_admin')))
    return res.status(400).json({ error: 'No puedes quitarte tu propio acceso' });
  let temp = null;
  if (req.body.role && ['admin', 'member'].includes(req.body.role) && t.role !== 'super_admin')
    await q('update team_users set role = $1 where id = $2', [req.body.role, t.id]);
  if (typeof req.body.active === 'boolean') {
    await q('update team_users set active = $1 where id = $2', [req.body.active, t.id]);
    if (!req.body.active) await q('delete from sessions where user_id = $1', [t.id]);
  }
  if (req.body.reset_password) {
    temp = tempPassword();
    await q('update team_users set password_hash = $1, must_change_password = true where id = $2', [hashPassword(temp), t.id]);
    await q('delete from sessions where user_id = $1', [t.id]);
  }
  if (req.body.reset_mfa) {
    await q('update team_users set totp_secret_enc = null, totp_enabled = false where id = $1', [t.id]);
    await q('update sessions set mfa_until = null where user_id = $1', [t.id]);
  }
  res.json({ ok: true, temp_password: temp });
}));

// ───────── Formulario y clientes ─────────
app.get('/api/formdef', (_req, res) => res.json({ form: FORM, services: SERVICES, suggested: SUGGESTED }));

async function sectionsOf(clientId) {
  const r = await q('select section, data from client_sections where client_id = $1', [clientId]);
  return Object.fromEntries(r.rows.map((x) => [x.section, x.data]));
}

async function saveSection(client, key, data, actor) {
  const cur = (await q('select data from client_sections where client_id = $1 and section = $2', [client.id, key])).rows[0]?.data || {};
  const merged = { ...cur, ...data };
  await q(`insert into client_sections (client_id, section, data, updated_by) values ($1,$2,$3,$4)
           on conflict (client_id, section) do update set data = $3, updated_at = now(), updated_by = $4`,
  [client.id, key, merged, actor]);
  // Espejo en la tabla de clientes para que el panel pueda listarlos y filtrarlos.
  if (key === 'clinica') {
    await q('update clients set name = coalesce(nullif($1, \'\'), name), city = $2, updated_at = now() where id = $3',
      [merged.nombre_comercial || '', merged.ciudad || null, client.id]);
  } else if (key === 'proyecto') {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(merged.fecha_inicio || '') ? merged.fecha_inicio : null;
    await q('update clients set start_date = $1, account_manager = $2, link_clickup = $3, link_drive = $4, updated_at = now() where id = $5',
      [d, merged.responsable_cuenta || null, merged.enlace_clickup || null, merged.enlace_drive || null, client.id]);
  } else await q('update clients set updated_at = now() where id = $1', [client.id]);
  return merged;
}

app.get('/api/clients', ...staff, wrap(async (_req, res) => {
  const [cl, secs, creds] = await Promise.all([
    q('select * from clients order by archived, name'),
    q('select client_id, section, data from client_sections'),
    q('select client_id, status, count(*)::int n from credentials group by 1, 2'),
  ]);
  const by = {};
  for (const s of secs.rows) (by[s.client_id] ||= {})[s.section] = s.data;
  const cr = {};
  for (const c of creds.rows) (cr[c.client_id] ||= { pendiente: 0, recibida: 0, verificada: 0 })[c.status] = c.n;
  res.json({
    clients: cl.rows.map((c) => ({
      ...c, progress: progress(by[c.id] || {}).pct,
      credentials: cr[c.id] || { pendiente: 0, recibida: 0, verificada: 0 },
    })),
  });
}));

app.post('/api/clients', ...staff, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 200);
  if (!name) return res.status(400).json({ error: 'Pon el nombre de la clínica' });
  const r = await q('insert into clients (name, token, city) values ($1,$2,$3) returning *',
    [name, randomToken(24), String(req.body.city || '').slice(0, 120) || null]);
  const c = r.rows[0];
  await saveSection(c, 'clinica', { nombre_comercial: name, ...(c.city ? { ciudad: c.city } : {}) }, req.user.email);
  // Filas de credenciales sugeridas, vacías, para que el cliente solo tenga que rellenarlas.
  for (const s of SUGGESTED) await q('insert into credentials (client_id, service, updated_by) values ($1,$2,$3)', [c.id, s, req.user.email]);
  res.json({ client: c });
}));

app.get('/api/clients/:id', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const c = (await q('select * from clients where id = $1', [req.params.id])).rows[0];
  if (!c) return res.status(404).json({ error: 'No existe' });
  const sections = await sectionsOf(c.id);
  res.json({ client: c, sections, progress: progress(sections) });
}));

app.patch('/api/clients/:id', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const b = req.body;
  if (b.status && !['onboarding', 'rodaje', 'formacion', 'activa', 'pausada'].includes(b.status)) return res.status(400).json({ error: 'Estado no válido' });
  if (b.status) await q('update clients set status = $1, updated_at = now() where id = $2', [b.status, req.params.id]);
  if (typeof b.archived === 'boolean') await q('update clients set archived = $1, updated_at = now() where id = $2', [b.archived, req.params.id]);
  if (b.rotate_token) await q('update clients set token = $1 where id = $2', [randomToken(24), req.params.id]);
  res.json({ ok: true });
}));

app.put('/api/clients/:id/sections/:key', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const c = (await q('select * from clients where id = $1', [req.params.id])).rows[0];
  if (!c) return res.status(404).json({ error: 'No existe' });
  const data = sanitizeSection(req.params.key, req.body || {}, { team: true });
  if (!data) return res.status(404).json({ error: 'Sección desconocida' });
  res.json({ data: await saveSection(c, req.params.key, data, req.user.email) });
}));

// ───────── Credenciales (equipo) ─────────
const credOut = (r) => ({
  id: r.id, service: r.service, company: r.company, username: r.username, email: r.email, url: r.url,
  notes: r.notes, status: r.status, has_password: !!r.password_enc, updated_at: r.updated_at, updated_by: r.updated_by,
});
const clip = (v, n = 500) => (v == null || v === '' ? null : String(v).slice(0, n));

app.get('/api/clients/:id/credentials', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const r = await q('select * from credentials where client_id = $1 order by service, updated_at', [req.params.id]);
  res.json({ credentials: r.rows.map(credOut) });
}));

app.post('/api/clients/:id/credentials', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const b = req.body;
  if (!clip(b.service, 120)) return res.status(400).json({ error: 'Indica el servicio' });
  const r = await q(
    `insert into credentials (client_id, service, company, username, email, password_enc, url, notes, status, updated_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [req.params.id, clip(b.service, 120), clip(b.company), clip(b.username), clip(b.email), b.password ? encrypt(b.password) : null,
      clip(b.url, 500), clip(b.notes, 2000), b.password ? 'recibida' : 'pendiente', req.user.email]);
  await log(r.rows[0].id, req.params.id, req.user.id, req.user.email, 'crear');
  res.json({ credential: credOut(r.rows[0]) });
}));

app.put('/api/credentials/:id', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const cur = (await q('select * from credentials where id = $1', [req.params.id])).rows[0];
  if (!cur) return res.status(404).json({ error: 'No existe' });
  const b = req.body;
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const status = ['pendiente', 'recibida', 'verificada'].includes(b.status) ? b.status : cur.status;
  let pwd = cur.password_enc;
  let changedPwd = false;
  if (has('password') && b.password !== '') { pwd = encrypt(b.password); changedPwd = true; }
  const r = await q(
    `update credentials set service=$1, company=$2, username=$3, email=$4, password_enc=$5, url=$6, notes=$7, status=$8,
     updated_at=now(), updated_by=$9 where id=$10 returning *`,
    [clip(has('service') ? b.service : cur.service, 120) || cur.service,
      has('company') ? clip(b.company) : cur.company, has('username') ? clip(b.username) : cur.username,
      has('email') ? clip(b.email) : cur.email, pwd, has('url') ? clip(b.url) : cur.url,
      has('notes') ? clip(b.notes, 2000) : cur.notes,
      changedPwd && status === 'pendiente' ? 'recibida' : status, req.user.email, cur.id]);
  await log(cur.id, cur.client_id, req.user.id, req.user.email, changedPwd ? 'cambiar contraseña' : 'editar');
  res.json({ credential: credOut(r.rows[0]) });
}));

app.delete('/api/credentials/:id', ...staff, requireRole('super_admin', 'admin'), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const cur = (await q('delete from credentials where id = $1 returning client_id, service', [req.params.id])).rows[0];
  if (cur) await log(req.params.id, cur.client_id, req.user.id, req.user.email, `borrar (${cur.service})`);
  res.json({ ok: true });
}));

// Ver o copiar una contraseña: solo administradores, con doble verificación reciente.
app.post('/api/credentials/:id/reveal', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  if (!canSeePasswords(req.user)) return res.status(403).json({ error: 'Tu rol no permite ver contraseñas' });
  if (!req.user.totp_enabled) return res.status(403).json({ error: 'Activa la doble verificación para ver contraseñas', code: 'no_mfa' });
  if (!req.session.mfa_until || new Date(req.session.mfa_until) <= new Date())
    return res.status(403).json({ error: 'Introduce tu código de verificación', code: 'mfa_required' });
  const cur = (await q('select * from credentials where id = $1', [req.params.id])).rows[0];
  if (!cur) return res.status(404).json({ error: 'No existe' });
  if (!cur.password_enc) return res.status(404).json({ error: 'Esta fila no tiene contraseña' });
  await log(cur.id, cur.client_id, req.user.id, req.user.email, req.body.copy ? 'copiar' : 'ver');
  res.json({ password: decrypt(cur.password_enc) });
}));

app.get('/api/clients/:id/log', ...staff, requireRole('super_admin', 'admin'), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const r = await q(`select l.at, l.actor, l.action, c.service from credential_log l
    left join credentials c on c.id = l.credential_id where l.client_id = $1 order by l.at desc limit 100`, [req.params.id]);
  res.json({ log: r.rows });
}));

// ───────── Enlace del cliente (sin cuenta) ─────────
async function byToken(req, res, next) {
  const t = String(req.params.token || '');
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(t) || tooMany(`tok:${ip(req)}`, 300, 60 * 60e3)) return res.status(404).json({ error: 'Enlace no válido' });
  const c = (await q('select * from clients where token = $1 and not archived', [t])).rows[0];
  if (!c) return res.status(404).json({ error: 'Enlace no válido' });
  req.client = c;
  next();
}

app.get('/api/f/:token', wrap(byToken), wrap(async (req, res) => {
  const sections = await sectionsOf(req.client.id);
  const cr = await q('select * from credentials where client_id = $1 order by service, updated_at', [req.client.id]);
  res.json({
    client: { name: req.client.name }, sections, progress: progress(sections),
    credentials: cr.rows.map((r) => ({ ...credOut(r), updated_by: undefined })),
  });
}));

app.put('/api/f/:token/sections/:key', wrap(byToken), wrap(async (req, res) => {
  const data = sanitizeSection(req.params.key, req.body || {}, { team: false });
  if (!data) return res.status(404).json({ error: 'Sección desconocida' });
  const merged = await saveSection(req.client, req.params.key, data, 'cliente');
  res.json({ data: merged, progress: progress(await sectionsOf(req.client.id)) });
}));

// El cliente puede escribir contraseñas, pero nunca leerlas de vuelta.
app.post('/api/f/:token/credentials', wrap(byToken), wrap(async (req, res) => {
  const b = req.body;
  if (!clip(b.service, 120)) return res.status(400).json({ error: 'Indica el servicio' });
  const n = (await q('select count(*)::int n from credentials where client_id = $1', [req.client.id])).rows[0].n;
  if (n >= 60) return res.status(400).json({ error: 'Demasiadas filas' });
  const r = await q(
    `insert into credentials (client_id, service, company, username, email, password_enc, url, notes, status, updated_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'cliente') returning *`,
    [req.client.id, clip(b.service, 120), clip(b.company), clip(b.username), clip(b.email), b.password ? encrypt(b.password) : null,
      clip(b.url, 500), clip(b.notes, 2000), b.password ? 'recibida' : 'pendiente']);
  await log(r.rows[0].id, req.client.id, null, 'cliente', 'crear');
  res.json({ credential: { ...credOut(r.rows[0]), updated_by: undefined } });
}));

app.put('/api/f/:token/credentials/:id', wrap(byToken), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const cur = (await q('select * from credentials where id = $1 and client_id = $2', [req.params.id, req.client.id])).rows[0];
  if (!cur) return res.status(404).json({ error: 'No existe' });
  const b = req.body;
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const newPwd = has('password') && b.password !== '';
  const status = newPwd && cur.status !== 'verificada' ? 'recibida' : cur.status;
  const r = await q(
    `update credentials set company=$1, username=$2, email=$3, password_enc=$4, url=$5, notes=$6, status=$7,
     updated_at=now(), updated_by='cliente' where id=$8 returning *`,
    [has('company') ? clip(b.company) : cur.company, has('username') ? clip(b.username) : cur.username,
      has('email') ? clip(b.email) : cur.email, newPwd ? encrypt(b.password) : cur.password_enc,
      has('url') ? clip(b.url) : cur.url, has('notes') ? clip(b.notes, 2000) : cur.notes, newPwd ? 'recibida' : status, cur.id]);
  await log(cur.id, cur.client_id, null, 'cliente', newPwd ? 'cambiar contraseña' : 'editar');
  res.json({ credential: { ...credOut(r.rows[0]), updated_by: undefined } });
}));

// ───────── Páginas ─────────
app.get('/f/:token', (_req, res) => res.sendFile(path.join(PUBLIC, 'form.html')));
app.use(express.static(PUBLIC, { index: 'index.html', extensions: ['html'] }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'No existe' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

const port = Number(process.env.PORT || 3003);
app.listen(port, '127.0.0.1', () => console.log(`Avania Space en 127.0.0.1:${port}`));
