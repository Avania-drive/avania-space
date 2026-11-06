import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import QRCode from 'qrcode';
import { fileURLToPath } from 'node:url';
import { q } from './db.js';
import { ssoList } from './sso.js';
import { encrypt, decrypt, hashPassword, verifyPassword, randomToken, sha256 } from './crypto.js';
import {
  COOKIE, parseCookies, createSession, clearCookie, loadSession, requireUser, requireReady,
  requireRole, canSeePasswords, totp, publicUser, tooMany, requirePasswordRecent, REAUTH_MINUTES,
} from './auth.js';
import { FORM, BLOCKS, SERVICES, SUGGESTED, progress, gates, sanitizeSection } from './formdef.js';
import { ID_RE, variantFor } from './funnels.js';
import { sendInvite } from './invite.js';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { PUBLIC_URL, sendHtml, sendMail } from './mailer.js';
import crypto from 'node:crypto';
import { driveListing, folderIdOf, createFolder, readClientFile, rootId as driveRootId } from './drive.js';
import { summarize, conclude } from './ai.js';
import { syncClickup, clickupEnabled } from './clickup.js';
import { viewOn, viewMap, VIEW_KEYS, denyView } from './visibility.js';
import { tasksOf, timelineOf, fasesOf, cleanFases, fasesBase } from './plan.js';
import { buildReport, REPORT_TO } from './report.js';
import { zonaStudy } from './zona.js';
import { loadClientSession, portalGate, mountPortal } from './portal.js';
import { mountVault } from './vault.js';
import { scopeMiddleware, allowedClients, assignCreator, mountPeople } from './people.js';
import { audit } from './audit.js';
import { mountKpis, syncStages, forget as forgetKpis } from './kpis.js';

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
  // El formulario del cliente se abre dentro de Avania Funnels (enlace del submenú); el resto de la app no se puede enmarcar.
  if (req.path.startsWith('/f/') || req.path.startsWith('/c/')) res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.avania.marketing https://*.leadconnectorhq.com https://*.gohighlevel.com");
  else if (/^\/api\/clients\/[^/]+\/files\/[^/]+$/.test(req.path)) res.setHeader('X-Frame-Options', 'SAMEORIGIN');   // la vista previa de un documento subido se abre en un visor dentro de Space
  else res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  // Las escrituras solo se aceptan como JSON (junto con SameSite=Strict, frena el CSRF).
  if (req.method !== 'GET' && req.path.startsWith('/api/') && !req.is('application/json') && !(req.method === 'POST' && /^\/api\/clients\/[^/]+\/files$/.test(req.path) && req.get('x-space-upload') === '1') && Number(req.headers['content-length'] || 0) > 0)   // la subida de archivos va en binario con una cabecera propia (una web ajena no puede enviarla sin permiso)
    return res.status(415).json({ error: 'Solo JSON' });
  next();
});
app.use(wrap(loadSession));
app.use(wrap(loadClientSession));
// Los miembros del equipo solo trabajan con los clientes que tienen asignados.
app.use('/api', scopeMiddleware(wrap));

const ip = (req) => req.ip || 'x';
const tempPassword = () => randomToken(9);
// Invitación por correo (enlace de un solo uso, 48 h): src/invite.js
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

// Perfil y preferencias de la persona que ha entrado (nombre, tema y color de acento).
app.put('/api/me/prefs', requireUser, requireReady, wrap(async (req, res) => {
  const b = req.body || {};
  const cur = req.user.prefs || {};
  const prefs = { ...cur };
  if ('theme' in b) { if (!['auto', 'light', 'dark'].includes(b.theme)) return res.status(400).json({ error: 'Tema no válido' }); prefs.theme = b.theme; }
  if ('accent' in b) { if (b.accent !== null && !/^#[0-9a-f]{6}$/i.test(String(b.accent))) return res.status(400).json({ error: 'Color no válido' }); if (b.accent) prefs.accent = b.accent; else delete prefs.accent; }
  await q('update team_users set prefs = $1 where id = $2', [prefs, req.user.id]);
  if ('name' in b) {
    const name = String(b.name || '').trim().slice(0, 120);
    if (!name) return res.status(400).json({ error: 'Escribe tu nombre' });
    await q('update team_users set name = $1 where id = $2', [name, req.user.id]);
  }
  res.json({ ok: true, prefs });
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

// ───────── Contraseña para abrir las credenciales ─────────
app.get('/api/reauth', requireUser, requireReady, (req, res) => {
  const until = req.session.reauth_until ? new Date(req.session.reauth_until) : null;
  res.json({ active: !!until && until > new Date(), minutes: REAUTH_MINUTES });
});
app.post('/api/reauth', requireUser, requireReady, wrap(async (req, res) => {
  if (tooMany(`reauth:${req.user.id}`, 8)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  if (!verifyPassword(String(req.body.password || ''), req.user.password_hash)) return res.status(400).json({ error: 'La contraseña no es correcta' });
  await q('update sessions set reauth_until = now() + ($1 || \' minutes\')::interval where id = $2', [REAUTH_MINUTES, req.session.id]);
  res.json({ ok: true, minutes: REAUTH_MINUTES });
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
  if (!req.user.totp_enabled && req.user.n_passkeys) return res.status(400).json({ error: 'Tienes una llave de acceso: usa el botón «Usar llave de acceso».' });
  if (!req.user.totp_enabled) return res.status(400).json({ error: 'Activa primero la doble verificación', code: 'no_mfa' });
  if (tooMany(`mfa:${req.user.id}`, 10)) return res.status(429).json({ error: 'Demasiados intentos' });
  if (!totp.check(String(req.body.code || '').trim(), decrypt(req.user.totp_secret_enc))) return res.status(400).json({ error: 'Código incorrecto' });
  await q('update sessions set mfa_until = now() + ($1 || \' minutes\')::interval where id = $2', [MFA_MINUTES, req.session.id]);
  res.json({ ok: true, minutes: MFA_MINUTES });
}));

// ───────── Equipo (solo superadministrador) ─────────
const staff = [requireUser, requireReady];
// ───────── Llaves de acceso (WebAuthn) como segunda verificación ─────────
const RP = () => { const u = new URL(PUBLIC_URL); return { rpID: u.hostname, origin: u.origin }; };
const b64 = (buf) => Buffer.from(buf).toString('base64url');
const setChallenge = (sid, c) => q('update sessions set wa_challenge = $1 where id = $2', [c, sid]);
const takeChallenge = async (sid) => { const c = (await q('select wa_challenge from sessions where id = $1', [sid])).rows[0]?.wa_challenge || null; await q('update sessions set wa_challenge = null where id = $1', [sid]); return c; };
const pkRow = (r) => ({ id: r.id, name: r.name, created_at: r.created_at, last_used_at: r.last_used_at });
const needPassword = (req, res) => {
  if (!verifyPassword(String(req.body.password || ''), req.user.password_hash)) { res.status(400).json({ error: 'La contraseña no es correcta' }); return false; }
  return true;
};

app.get('/api/passkeys', requireUser, requireReady, wrap(async (req, res) => {
  const r = await q('select id, name, created_at, last_used_at from passkeys where user_id = $1 order by created_at', [req.user.id]);
  res.json({ passkeys: r.rows.map(pkRow) });
}));

app.post('/api/passkeys/options', requireUser, requireReady, wrap(async (req, res) => {
  if (tooMany(`pk:${req.user.id}`, 10)) return res.status(429).json({ error: 'Demasiados intentos' });
  if (!needPassword(req, res)) return;
  const have = (await q('select credential_id, transports from passkeys where user_id = $1', [req.user.id])).rows;
  const { rpID } = RP();
  const options = await generateRegistrationOptions({
    rpName: 'Avania Space', rpID, userName: req.user.email, userDisplayName: req.user.name || req.user.email,
    userID: new TextEncoder().encode(req.user.id), attestationType: 'none',
    excludeCredentials: have.map((c) => ({ id: c.credential_id, transports: c.transports || undefined })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  await setChallenge(req.session.id, options.challenge);
  res.json({ options });
}));

app.post('/api/passkeys', requireUser, requireReady, wrap(async (req, res) => {
  const expectedChallenge = await takeChallenge(req.session.id);
  if (!expectedChallenge) return res.status(400).json({ error: 'La petición caducó, vuelve a intentarlo' });
  const { rpID, origin } = RP();
  let v;
  try { v = await verifyRegistrationResponse({ response: req.body.response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false }); }
  catch (e) { return res.status(400).json({ error: 'No se pudo verificar la llave: ' + e.message }); }
  if (!v.verified) return res.status(400).json({ error: 'No se pudo verificar la llave' });
  const c = v.registrationInfo.credential;
  const name = String(req.body.name || '').trim().slice(0, 60) || 'Llave de acceso';
  const r = await q('insert into passkeys (user_id, credential_id, public_key, counter, transports, name) values ($1,$2,$3,$4,$5,$6) returning id, name, created_at, last_used_at',
    [req.user.id, c.id, b64(c.publicKey), c.counter, c.transports || null, name]);
  await q('update sessions set mfa_until = now() + ($1 || \' minutes\')::interval where id = $2', [MFA_MINUTES, req.session.id]);
  res.json({ passkey: pkRow(r.rows[0]) });
}));

app.delete('/api/passkeys/:id', requireUser, requireReady, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  if (!needPassword(req, res)) return;
  await q('delete from passkeys where id = $1 and user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

app.post('/api/mfa/passkey/options', requireUser, requireReady, wrap(async (req, res) => {
  if (tooMany(`mfa:${req.user.id}`, 10)) return res.status(429).json({ error: 'Demasiados intentos' });
  const have = (await q('select credential_id, transports from passkeys where user_id = $1', [req.user.id])).rows;
  if (!have.length) return res.status(400).json({ error: 'No tienes ninguna llave de acceso' });
  const options = await generateAuthenticationOptions({ rpID: RP().rpID, userVerification: 'preferred',
    allowCredentials: have.map((c) => ({ id: c.credential_id, transports: c.transports || undefined })) });
  await setChallenge(req.session.id, options.challenge);
  res.json({ options });
}));

app.post('/api/mfa/passkey/verify', requireUser, requireReady, wrap(async (req, res) => {
  if (tooMany(`mfa:${req.user.id}`, 10)) return res.status(429).json({ error: 'Demasiados intentos' });
  const expectedChallenge = await takeChallenge(req.session.id);
  if (!expectedChallenge) return res.status(400).json({ error: 'La petición caducó, vuelve a intentarlo' });
  const cred = (await q('select * from passkeys where user_id = $1 and credential_id = $2', [req.user.id, String(req.body.response?.id || '')])).rows[0];
  if (!cred) return res.status(400).json({ error: 'Esa llave no está registrada en tu cuenta' });
  const { rpID, origin } = RP();
  let v;
  try {
    v = await verifyAuthenticationResponse({ response: req.body.response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false,
      credential: { id: cred.credential_id, publicKey: Buffer.from(cred.public_key, 'base64url'), counter: Number(cred.counter), transports: cred.transports || undefined } });
  } catch (e) { return res.status(400).json({ error: 'No se pudo verificar la llave: ' + e.message }); }
  if (!v.verified) return res.status(400).json({ error: 'Llave no válida' });
  await q('update passkeys set counter = $1, last_used_at = now() where id = $2', [v.authenticationInfo.newCounter, cred.id]);
  await q('update sessions set mfa_until = now() + ($1 || \' minutes\')::interval where id = $2', [MFA_MINUTES, req.session.id]);
  res.json({ ok: true, minutes: MFA_MINUTES });
}));

app.get('/api/users', ...staff, requireRole('super_admin'), wrap(async (_req, res) => {
  const r = await q('select id, email, name, role, active, totp_enabled, (select count(*)::int from passkeys p where p.user_id = team_users.id) n_passkeys, (select count(*)::int from client_assignments a where a.user_id = team_users.id) n_clients, must_change_password, created_at from team_users order by created_at');
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
  // Correo de alta con el enlace para elegir contraseña. Si no sale, se devuelve la contraseña temporal para dársela a mano.
  const created = (await q('select id, email, name from team_users where email = $1', [email])).rows[0];
  await audit(req.user.email, 'crear usuario del equipo', { target: email, detail: role });
  let emailError = null;
  try { await sendInvite(created); } catch (e) { emailError = e.message; console.error(`[email] alta de ${email}: ${e.message}`); }
  res.json(emailError ? { ok: true, email_sent: false, email_error: emailError, temp_password: temp } : { ok: true, email_sent: true });
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
  let invite = null;
  if (req.body.resend_invite) {
    try { await sendInvite(t, { reminder: true }); invite = 'sent'; } catch (e) { invite = `error: ${e.message}`; }
  }
  if (req.body.reset_mfa) {
    await q('update team_users set totp_secret_enc = null, totp_enabled = false where id = $1', [t.id]);
    await q('delete from passkeys where user_id = $1', [t.id]);
    await q('update sessions set mfa_until = null where user_id = $1', [t.id]);
  }
  const did = [req.body.role && t.role !== 'super_admin' && req.body.role !== t.role ? `rol ${t.role} → ${req.body.role}` : '', typeof req.body.active === 'boolean' && req.body.active !== t.active ? (req.body.active ? 'activado' : 'desactivado') : '', req.body.reset_password ? 'nueva contraseña' : '', req.body.reset_mfa ? 'reinicio de 2FA' : '', req.body.resend_invite ? 'reenvío de acceso' : ''].filter(Boolean).join(', ');
  if (did) await audit(req.user.email, 'modificar usuario del equipo', { target: t.email, detail: did });
  res.json({ ok: true, temp_password: temp, invite });
}));

// Página pública del enlace de invitación (no necesita sesión): comprueba el enlace y deja elegir la contraseña.
app.get('/api/invitacion/:token', wrap(async (req, res) => {
  if (tooMany(`inv:${ip(req)}`, 30)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  const u = (await q('select email, name from team_users where invite_hash = $1 and invite_expires_at > now() and active', [sha256(String(req.params.token))])).rows[0];
  if (!u) return res.status(404).json({ error: 'Este enlace no es válido o ha caducado. Pide que te envíen otro.' });
  res.json({ email: u.email, name: u.name });
}));
app.post('/api/invitacion/:token', wrap(async (req, res) => {
  if (tooMany(`inv:${ip(req)}`, 30)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  const pw = String(req.body.password || '');
  if (pw.length < 12) return res.status(400).json({ error: 'La contraseña debe tener al menos 12 caracteres' });
  const u = (await q('select id from team_users where invite_hash = $1 and invite_expires_at > now() and active', [sha256(String(req.params.token))])).rows[0];
  if (!u) return res.status(404).json({ error: 'Este enlace no es válido o ha caducado. Pide que te envíen otro.' });
  await q('update team_users set password_hash = $1, must_change_password = false, invite_hash = null, invite_expires_at = null where id = $2', [hashPassword(pw), u.id]);
  await q('delete from sessions where user_id = $1', [u.id]);
  res.json({ ok: true });
}));

// ───────── Formulario y clientes ─────────
// El equipo recibe el formulario entero; el cliente, sin las secciones ni los campos que son solo de la agencia (ni su título ni su texto).
app.get('/api/formdef', (req, res) => {
  if (req.user) return res.json({ form: FORM, blocks: BLOCKS, services: SERVICES, suggested: SUGGESTED });
  const form = FORM.filter((x) => !TEAM_ONLY.has(x.key)).map((x) => ({ ...x, groups: x.groups.map((g) => ({ ...g, fields: g.fields.filter((f) => !agencyField(f)) })) }));
  const blocks = BLOCKS.map((b) => ({ ...b, sections: b.sections.filter((k) => !TEAM_ONLY.has(k)) })).filter((b) => b.sections.length);
  res.json({ form, blocks, services: SERVICES, suggested: SUGGESTED });
});

async function sectionsOf(clientId) {
  const r = await q('select section, data from client_sections where client_id = $1', [clientId]);
  return Object.fromEntries(r.rows.map((x) => [x.section, x.data]));
}

async function saveSection(client, key, data, actor) {
  // Cada cliente, su carpeta de Drive: la misma carpeta no puede estar enlazada en dos clientes (cada uno vería lo del otro).
  const fid = key === 'proyecto' ? folderIdOf(data.enlace_drive) : null;
  if (fid && fid === driveRootId()) throw Object.assign(new Error('Esa es la carpeta de todos los clientes: pon la carpeta MARKETING de este cliente.'), { status: 400 });
  if (fid) {
    const dup = (await q("select c.name from client_sections s join clients c on c.id = s.client_id where s.section = 'proyecto' and s.client_id <> $1 and s.data->>'enlace_drive' like $2 limit 1", [client.id, `%${fid}%`])).rows[0];
    if (dup) throw Object.assign(new Error(`Esa carpeta de Drive ya está asignada a otro cliente (${dup.name}). Cada cliente necesita la suya.`), { status: 400 });
  }
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
    const cat = String(merged.categoria || '').trim().slice(0, 60) || null;
    if (cat) await q('insert into categories (name) values ($1) on conflict do nothing', [cat]);
    await q('update clients set category = $1 where id = $2', [cat, client.id]);
    // Si el estado actual no existe en la categoría nueva, pasa al primero que sí (para no dejar al cliente en un estado que no le corresponde).
    const st = cat ? (await q('select statuses from categories where name = $1', [cat])).rows[0] : null;
    const valid = statusesOf(st?.statuses);
    if (st && valid.length && !valid.includes(client.status)) await q('update clients set status = $1 where id = $2', [valid[0], client.id]);
  } else await q('update clients set updated_at = now() where id = $1', [client.id]);
  return merged;
}

// Plantilla de alta por categoría: qué secciones del documento lleva (null = todas, como la clínica dental).
// Pasos del cliente: los de su categoría (null = los de la clínica, con rodaje y formación).
const ALL_STATUS = ['onboarding', 'montaje', 'rodaje', 'formacion', 'activa', 'pausada'];
const DEFAULT_STATUS = ['onboarding', 'rodaje', 'formacion', 'activa', 'pausada'];
const statusesOf = (list) => (Array.isArray(list) && list.length ? list : DEFAULT_STATUS);
const allowedSet = (sections) => (Array.isArray(sections) ? new Set(sections) : null);
// `own` = las secciones elegidas para ese cliente (clients.sections); si no hay, las de su categoría.
async function templateOf(category, own = null) {
  const r = category ? (await q('select sections from categories where name = $1', [category])).rows[0] : null;
  return { allowed: allowedSet(Array.isArray(own) ? own : r?.sections), dental: variantFor(category) === 'dental' };
}
const CLIENT_LOCKED = ['proyecto', 'clinica'];   // siempre van: guardan la categoría, el nombre y los enlaces del cliente
/** Lista de secciones elegida a mano: solo claves que existen, con las imprescindibles dentro. null = las de la categoría. */
function cleanSections(list) {
  if (!Array.isArray(list)) return null;
  const valid = new Set(FORM.map((x) => x.key));
  return [...new Set([...CLIENT_LOCKED, ...list.map(String).filter((k) => valid.has(k))])];
}

// ───────── Categorías de cliente (el desplegable se alimenta de aquí) ─────────
const HEX = /^#[0-9a-f]{6}$/i;
app.get('/api/categories', ...staff, wrap(async (_req, res) => {
  res.json({ categories: (await q('select name, color, sections, statuses from categories order by name')).rows });
}));
app.post('/api/categories', ...staff, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'Escribe el nombre de la categoría' });
  const color = HEX.test(req.body.color || '') ? req.body.color : '#0f766e';
  const r = await q('insert into categories (name, color) values ($1, $2) on conflict (name) do update set color = $2 returning name, color, sections, statuses', [name, color]);
  res.json({ category: r.rows[0] });
}));


app.get('/api/clients', ...staff, wrap(async (req, res) => {
  const mine = await allowedClients(req.user);
  const [cl, secs, creds] = await Promise.all([
    q('select c.*, (select extract(epoch from l.updated_at)::bigint from client_logos l where l.client_id = c.id) logo_v, cat.color category_color, cat.sections category_sections, cat.statuses category_statuses from clients c left join categories cat on cat.name = c.category where ($1::uuid[] is null or c.id = any($1::uuid[])) order by c.archived, c.name', [mine]),
    q('select client_id, section, data, updated_at from client_sections'),
    q('select client_id, status, count(*)::int n from credentials group by 1, 2'),
  ]);
  const by = {}, last = {};
  for (const s of secs.rows) { (by[s.client_id] ||= {})[s.section] = s.data; if (!last[s.client_id] || s.updated_at > last[s.client_id]) last[s.client_id] = s.updated_at; }
  const cr = {};
  for (const c of creds.rows) (cr[c.client_id] ||= { pendiente: 0, recibida: 0, verificada: 0 })[c.status] = c.n;
  res.json({
    clients: cl.rows.map(({ category_sections, category_statuses, ...c }) => ({
      ...c, statuses: statusesOf(category_statuses), ...(({ pct, team }) => ({ progress: pct, team_progress: team.pct }))(progress(by[c.id] || {}, allowedSet(c.sections ?? category_sections), variantFor(c.category) === 'dental')),
      credentials: cr[c.id] || { pendiente: 0, recibida: 0, verificada: 0 },
      gates: gates(by[c.id] || {}, cr[c.id], allowedSet(c.sections ?? category_sections)),
      last_activity: last[c.id] && last[c.id] > c.updated_at ? last[c.id] : c.updated_at,
    })),
  });
}));

app.post('/api/clients', ...staff, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 200);
  if (!name) return res.status(400).json({ error: 'Pon el nombre de la empresa' });
  const r = await q('insert into clients (name, token, city, sections) values ($1,$2,$3,$4) returning *',
    [name, randomToken(24), String(req.body.city || '').slice(0, 120) || null, cleanSections(req.body.sections)]);
  const c = r.rows[0];
  await assignCreator(req.user, c.id);
  await saveSection(c, 'clinica', { nombre_comercial: name, ...(c.city ? { ciudad: c.city } : {}) }, req.user.email);
  const cat0 = String(req.body.category || '').trim().slice(0, 60);
  if (cat0) { await q('insert into categories (name) values ($1) on conflict do nothing', [cat0]); await saveSection(c, 'proyecto', { categoria: cat0 }, req.user.email); }
  // Filas de credenciales sugeridas, vacías, para que el cliente solo tenga que rellenarlas.
  for (const s of SUGGESTED) await q('insert into credentials (client_id, service, updated_by) values ($1,$2,$3)', [c.id, s, req.user.email]);
  res.json({ client: c });
}));

// Alta por ID del contacto en Avania Funnels (el cliente en el CRM de AVANIA): lee sus datos y precarga la ficha.
// Crea el cliente a partir del ID de su subcuenta de Avania Funnels (lo usan el botón «desde Funnels» y el webhook de «cliente ganado»).
const bad = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });
async function createFromFunnels({ location, name, category, city, sections, by }) {
  location = String(location || '').trim();
  if (!ID_RE.test(location)) throw bad(400, 'El ID de la subcuenta no parece válido (letras y números, sin espacios).');
  const dup = (await q('select id, name, token from clients where funnels_contact_id = $1', [location])).rows[0];
  if (dup) throw bad(409, `Esa subcuenta ya está dada de alta como «${dup.name}».`, { id: dup.id, token: dup.token, name: dup.name });
  name = String(name || '').trim().slice(0, 200);
  if (!name) throw bad(400, 'Escribe el nombre de la empresa.');
  category = String(category || '').trim().slice(0, 60);
  city = String(city || '').trim().slice(0, 120) || null;
  // El ID de la subcuenta hace de identificador del cliente en Funnels (enlace del submenú /c/{{location.id}}).
  const c = (await q('insert into clients (name, token, city, funnels_contact_id, sections) values ($1,$2,$3,$4,$5) returning *',
    [name, randomToken(24), city, location, cleanSections(sections)])).rows[0];
  if (category) await q('insert into categories (name) values ($1) on conflict do nothing', [category]);
  await saveSection(c, 'proyecto', { ...(category ? { categoria: category } : {}), funnels_location: location }, by);
  await saveSection(c, 'clinica', sanitizeSection('clinica', { nombre_comercial: name, ...(city ? { ciudad: city } : {}) }, { team: true }) || {}, by);
  for (const s of SUGGESTED) await q('insert into credentials (client_id, service, updated_by) values ($1,$2,$3)', [c.id, s, by]);
  return c;
}
app.post('/api/clients/from-funnels', ...staff, wrap(async (req, res) => {
  const category = String(req.body.category || '').trim();
  if (!category) return res.status(400).json({ error: 'Elige la categoría.' });
  try { const cf = await createFromFunnels({ location: req.body.locationId, name: req.body.name, category, city: req.body.city, sections: req.body.sections, by: req.user.email }); if (cf?.id) await assignCreator(req.user, cf.id); res.json({ client: cf }); }
  catch (e) { if (e.status === 400 || e.status === 409) return res.status(e.status).json({ error: e.message, ...(e.id ? { id: e.id } : {}) }); throw e; }
}));

// Webhook «cliente ganado» (lo llama n8n cuando el cliente pasa a Ganado en el pipeline de Funnels): crea el espacio y avisa por correo al equipo.
// Protegido con una clave (HOOK_SECRET en .env) en la cabecera Authorization: Bearer … ; si el cliente ya existe no lo duplica.
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
app.post('/api/hooks/cliente-ganado', wrap(async (req, res) => {
  const secret = process.env.HOOK_SECRET || '';
  if (tooMany(`hook:${ip(req)}`, 60, 15 * 60e3)) return res.status(429).json({ error: 'Demasiadas peticiones' });
  const given = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (secret.length < 24 || !given || !safeEq(given, secret)) return res.status(401).json({ error: 'No autorizado' });
  const b = req.body || {};
  const publicUrl = (path) => `${PUBLIC_URL}${path}`;
  const answer = (c, created, emailed) => ({ ok: true, created, client: { id: c.id, name: c.name }, form_url: publicUrl(`/f/${c.token}`), space_url: publicUrl(`/#/c/${c.id}`), emailed });
  let c, created = true;
  try { c = await createFromFunnels({ location: b.locationId, name: b.name, category: b.category, city: b.city, by: 'webhook (cliente ganado)' }); }
  catch (e) {
    if (e.status === 409) { c = { id: e.id, name: e.name, token: e.token }; created = false; }
    else if (e.status === 400) return res.status(400).json({ error: e.message });
    else throw e;
  }
  if (!created) return res.json(answer(c, false, false));
  const to = String(process.env.HOOK_NOTIFY || '').split(',').map((x) => x.trim()).filter(Boolean);
  let emailed = false;
  if (to.length) {
    try {
      await sendMail({ to: to.join(', '), subject: `Cliente ganado: ${c.name}`, title: `Cliente ganado: ${c.name}`,
        paragraphs: ['El cliente ha pasado a «Ganado» y Space ya le ha creado su espacio.', `Subcuenta de Avania Funnels: ${b.locationId}${b.category ? ` · Categoría: ${b.category}` : ''}${b.city ? ` · ${b.city}` : ''}.`,
          'Por hacer: revisar la ficha, mandarle el formulario de onboarding y comprobar que la subcuenta de Funnels está lista.'],
        button: { label: 'Abrir la ficha en Space', url: publicUrl(`/#/c/${c.id}`) } });
      emailed = true;
    } catch (e) { console.error(`[hook] aviso por correo de ${c.name}: ${e.message}`); }
  }
  res.status(201).json(answer(c, true, emailed));
}));

// Zona restringida (Web, Google, Meta, credenciales): el equipo solo recibe esos datos tras volver a escribir la contraseña de su cuenta.
const RESTRICTED = new Set(['accesos', 'google', 'meta']);
const recent = (req) => !!req.session?.reauth_until && new Date(req.session.reauth_until) > new Date();
const restrictedGuard = wrap((req, res, next) => (RESTRICTED.has(req.params.key) ? requirePasswordRecent(req, res, next) : next()));

app.get('/api/clients/:id/restricted', ...staff, wrap(requirePasswordRecent), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const all = await sectionsOf(req.params.id);
  res.json({ sections: Object.fromEntries([...RESTRICTED].map((k) => [k, all[k] || {}])) });
}));

app.get('/api/clients/:id', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const c = (await q('select c.*, (select extract(epoch from l.updated_at)::bigint from client_logos l where l.client_id = c.id) logo_v, cat.color category_color from clients c left join categories cat on cat.name = c.category where c.id = $1', [req.params.id])).rows[0];
  if (!c) return res.status(404).json({ error: 'No existe' });
  const sections = await sectionsOf(c.id);
  const meta = Object.fromEntries((await q('select section, updated_at, updated_by from client_sections where client_id = $1', [c.id])).rows.map((x) => [x.section, { at: x.updated_at, by: x.updated_by }]));
  const cr = {};
  for (const r of (await q('select status, count(*)::int n from credentials where client_id = $1 group by 1', [c.id])).rows) cr[r.status] = r.n;
  const tpl = await templateOf(c.category, c.sections);
  const stRow = c.category ? (await q('select statuses from categories where name = $1', [c.category])).rows[0] : null;
  // Sin contraseña reciente solo salen las marcas «lo hará Avania» de esas secciones (sin ningún valor).
  const open = recent(req);
  const shown = open ? sections : Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, RESTRICTED.has(k) ? { _avania: v._avania || [] } : v]));
  res.json({ client: c, views: viewMap(c), statuses: statusesOf(stRow?.statuses), restricted: !open, sections: shown, meta, progress: progress(sections, tpl.allowed, tpl.dental), gates: gates(sections, cr, tpl.allowed), allowed: tpl.allowed ? [...tpl.allowed] : null, dental: tpl.dental,
    tasks: tasksOf(sections, cr, { allowed: tpl.allowed, dental: tpl.dental }), timeline: timelineOf(sections, { includeEmpty: true }), fases: fasesOf(sections), team: await teamNames(sections), onboarding: onboardingState(c, sections) });
}));

// Personas del equipo de AVANIA a las que se puede asignar una tarea: las de la ficha del cliente y los usuarios activos del panel.
async function teamNames(sections) {
  const fromForm = (Array.isArray((sections.avania || {}).personas) ? sections.avania.personas : []).map((r) => String(r?.nombre || '').trim());
  const users = (await q('select name from team_users where active order by created_at')).rows.map((r) => String(r.name || '').trim());
  return [...new Set([...fromForm, ...users].filter(Boolean))];
}

// Secciones de la ficha que lleva este cliente. `sections: null` = vuelve a las de su categoría.
app.put('/api/clients/:id/modulos', ...staff, requireRole('super_admin', 'admin'), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const list = req.body.sections === null ? null : cleanSections(req.body.sections);
  if (req.body.sections !== null && !list) return res.status(400).json({ error: 'Indica las secciones' });
  const r = await q('update clients set sections = $1, updated_at = now() where id = $2 returning id', [list, req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'No existe' });
  res.json({ sections: list });
}));

app.patch('/api/clients/:id', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const b = req.body;
  if (typeof b.archived === 'boolean' && !['super_admin', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Solo un administrador puede dar de baja o reactivar clientes.' });
  if (b.status) {
    if (!ALL_STATUS.includes(b.status)) return res.status(400).json({ error: 'Estado no válido' });
    const cat = (await q('select cat.statuses from clients c left join categories cat on cat.name = c.category where c.id = $1', [req.params.id])).rows[0];
    if (cat && !statusesOf(cat.statuses).includes(b.status)) return res.status(400).json({ error: 'Esa categoría no pasa por ese estado' });
  }
  if (b.status) await q('update clients set status = $1, updated_at = now() where id = $2', [b.status, req.params.id]);
  if (typeof b.archived === 'boolean') await q('update clients set archived = $1, updated_at = now() where id = $2', [b.archived, req.params.id]);
  if (b.rotate_token) await q('update clients set token = $1 where id = $2', [randomToken(24), req.params.id]);
  res.json({ ok: true });
}));

app.put('/api/clients/:id/sections/:key', ...staff, restrictedGuard, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const c = (await q('select * from clients where id = $1', [req.params.id])).rows[0];
  if (!c) return res.status(404).json({ error: 'No existe' });
  const data = sanitizeSection(req.params.key, req.body || {}, { team: true });
  if (!data) return res.status(404).json({ error: 'Sección desconocida' });
  let merged = await saveSection(c, req.params.key, data, req.user.email);
  // Al indicar el pipeline de un cliente conectado a Avania Funnels se rellenan solas todas sus etapas.
  const extra = {};
  if (req.params.key === 'negocio' && 'pipeline_id' in data) {
    forgetKpis(c.id);
    const pid = String(data.pipeline_id || '').trim();
    if (pid) {
      try {
        const r = await syncStages(c.id, pid, merged.etapas);
        merged = await saveSection(c, 'negocio', { etapas: r.etapas }, req.user.email);
        Object.assign(extra, { stages_loaded: r.etapas.length, pipeline: r.name });
      } catch (e) { extra.stages_error = e.message; extra.not_connected = !!e.notConnected; }
    }
  }
  res.json({ data: merged, ...extra });
}));

// ───────── Configuración: plantilla de alta por categoría y tipos de enlace ─────────
const admin = [requireRole('super_admin', 'admin')];
app.put('/api/categories/:name', ...staff, ...admin, wrap(async (req, res) => {
  const name = String(req.params.name || '').trim().slice(0, 60);
  const cur = (await q('select * from categories where name = $1', [name])).rows[0];
  if (!cur) return res.status(404).json({ error: 'No existe esa categoría' });
  const b = req.body || {};
  const color = HEX.test(b.color || '') ? b.color : cur.color;
  let sections = cur.sections;
  if ('sections' in b) {
    const valid = new Set(FORM.map((x) => x.key));
    sections = b.sections === null ? null : [...new Set((Array.isArray(b.sections) ? b.sections : []).map(String).filter((k) => valid.has(k)))];
    if (sections && !sections.includes('proyecto')) sections.unshift('proyecto');   // «Antes de empezar» lo usa el equipo en todas
  }
  let statuses = cur.statuses;
  if ('statuses' in b) {
    const list = b.statuses === null ? null : ALL_STATUS.filter((k) => (Array.isArray(b.statuses) ? b.statuses : []).includes(k));
    statuses = list && list.length ? list : null;
    if (statuses && !statuses.includes('activa')) statuses.push('activa');   // sin «Campaña activa» nadie podría lanzar
  }
  const r = await q('update categories set color = $1, sections = $2, statuses = $3 where name = $4 returning name, color, sections, statuses', [color, sections, statuses, name]);
  res.json({ category: r.rows[0] });
}));

app.get('/api/link-types', ...staff, wrap(async (_req, res) => {
  res.json({ types: (await q('select name, icon, login_url from link_types order by position, name')).rows });
}));
app.put('/api/link-types', ...staff, ...admin, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'Escribe el nombre del tipo de enlace' });
  const login = String(req.body.login_url || '').trim();
  if (login && !/^https?:\/\//i.test(login)) return res.status(400).json({ error: 'La dirección de inicio de sesión debe empezar por https://' });
  const icon = /^[a-z]{2,20}$/.test(req.body.icon || '') ? req.body.icon : 'enlace';
  const n = (await q('select coalesce(max(position), 0) + 1 n from link_types')).rows[0].n;
  await q('insert into link_types (name, icon, login_url, position) values ($1,$2,$3,$4) on conflict (name) do update set icon = $2, login_url = $3', [name, icon, login || null, n]);
  res.json({ ok: true });
}));
app.delete('/api/link-types/:name', ...staff, ...admin, wrap(async (req, res) => {
  await q('delete from link_types where name = $1', [req.params.name]);
  res.json({ ok: true });
}));

// ───────── Notas del cliente (internas salvo que se marquen como visibles para él) ─────────
const noteOwner = async (req, res) => {
  if (!isUuid(req.params.id)) { res.status(400).json({ error: 'Id no válido' }); return null; }
  const c = (await q('select id from clients where id = $1', [req.params.id])).rows[0];
  if (!c) { res.status(404).json({ error: 'No existe' }); return null; }
  return c;
};
app.get('/api/clients/:id/notes', ...staff, wrap(async (req, res) => {
  if (!(await noteOwner(req, res))) return;
  res.json({ notes: (await q('select id, body, visible, author, created_at from client_notes where client_id = $1 order by created_at desc', [req.params.id])).rows });
}));
app.post('/api/clients/:id/notes', ...staff, wrap(async (req, res) => {
  if (!(await noteOwner(req, res))) return;
  const body = String(req.body.body || '').trim().slice(0, 4000);
  if (!body) return res.status(400).json({ error: 'Escribe la nota' });
  const r = await q('insert into client_notes (client_id, body, visible, author) values ($1,$2,$3,$4) returning id, body, visible, author, created_at',
    [req.params.id, body, req.body.visible === true, req.user.name || req.user.email]);
  res.json({ note: r.rows[0] });
}));
// ───────── Documentos subidos a la ficha del cliente ─────────
const FILE_MAX = 15 * 1024 * 1024;
const INLINE_OK = /^(application\/pdf|image\/(png|jpeg|webp|gif)|text\/plain)$/;
const cleanName = (n) => String(n || 'documento').replace(/[\\/\u0000-\u001f"]/g, '_').trim().slice(0, 180) || 'documento';
app.get('/api/clients/:id/files', ...staff, wrap(async (req, res) => {
  if (!(await noteOwner(req, res))) return;
  res.json({ files: (await q('select id, name, mime, size, uploaded_by, created_at from client_files where client_id = $1 order by created_at desc', [req.params.id])).rows });
}));
app.post('/api/clients/:id/files', ...staff, express.raw({ type: () => true, limit: FILE_MAX }), wrap(async (req, res) => {
  if (!(await noteOwner(req, res))) return;
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: 'El archivo está vacío' });
  const mime = String(req.query.type || req.get('content-type') || '').split(';')[0].trim().toLowerCase().slice(0, 120) || 'application/octet-stream';
  const r = await q('insert into client_files (client_id, name, mime, size, data, uploaded_by) values ($1,$2,$3,$4,$5,$6) returning id, name, mime, size, uploaded_by, created_at',
    [req.params.id, cleanName(req.query.name), mime, buf.length, buf, req.user.name || req.user.email]);
  res.json({ file: r.rows[0] });
}));
app.get('/api/clients/:id/files/:fid', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id) || !isUuid(req.params.fid)) return res.status(400).json({ error: 'Id no válido' });
  const f = (await q('select name, mime, data from client_files where id = $1 and client_id = $2', [req.params.fid, req.params.id])).rows[0];
  if (!f) return res.status(404).json({ error: 'No existe' });
  const inline = INLINE_OK.test(f.mime) && req.query.download !== '1';
  res.set({ 'Content-Type': inline ? f.mime : 'application/octet-stream', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'", 'Cache-Control': 'private, max-age=300' });
  res.send(f.data);
}));
app.delete('/api/clients/:id/files/:fid', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id) || !isUuid(req.params.fid)) return res.status(400).json({ error: 'Id no válido' });
  await q('delete from client_files where id = $1 and client_id = $2', [req.params.fid, req.params.id]);
  res.json({ ok: true });
}));

app.patch('/api/notes/:id', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const cur = (await q('select * from client_notes where id = $1', [req.params.id])).rows[0];
  if (!cur) return res.status(404).json({ error: 'No existe' });
  const body = 'body' in req.body ? String(req.body.body || '').trim().slice(0, 4000) : cur.body;
  if (!body) return res.status(400).json({ error: 'La nota no puede quedar vacía' });
  const visible = typeof req.body.visible === 'boolean' ? req.body.visible : cur.visible;
  const r = await q('update client_notes set body = $1, visible = $2 where id = $3 returning id, body, visible, author, created_at', [body, visible, cur.id]);
  res.json({ note: r.rows[0] });
}));
app.delete('/api/notes/:id', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  await q('delete from client_notes where id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ───────── Enlaces del cliente (herramientas con las que se trabaja, de la lista configurable) ─────────
const linkOut = (r) => ({ id: r.id, type: r.type, url: r.url, login_url: r.login_url, has_access: r.has_access, visible: r.visible, updated_at: r.updated_at, updated_by: r.updated_by });
const url = (v) => { const t = String(v || '').trim().slice(0, 1000); return /^https?:\/\//i.test(t) ? t : null; };
app.get('/api/clients/:id/links', ...staff, wrap(async (req, res) => {
  if (!(await noteOwner(req, res))) return;
  res.json({ links: (await q('select * from client_links where client_id = $1 order by type, updated_at', [req.params.id])).rows.map(linkOut) });
}));
app.post('/api/clients/:id/links', ...staff, wrap(async (req, res) => {
  if (!(await noteOwner(req, res))) return;
  const type = String(req.body.type || '').trim().slice(0, 60);
  if (!(await q('select 1 from link_types where name = $1', [type])).rows[0]) return res.status(400).json({ error: 'Elige un tipo de enlace de la lista' });
  const r = await q('insert into client_links (client_id, type, url, login_url, has_access, visible, updated_by) values ($1,$2,$3,$4,$5,$6,$7) returning *',
    [req.params.id, type, url(req.body.url), url(req.body.login_url), ['si', 'no', 'pendiente'].includes(req.body.has_access) ? req.body.has_access : 'pendiente', req.body.visible === true, req.user.email]);
  res.json({ link: linkOut(r.rows[0]) });
}));
app.put('/api/links/:id', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const cur = (await q('select * from client_links where id = $1', [req.params.id])).rows[0];
  if (!cur) return res.status(404).json({ error: 'No existe' });
  const b = req.body, has = (k) => k in b;
  const r = await q('update client_links set url=$1, login_url=$2, has_access=$3, visible=$4, updated_at=now(), updated_by=$5 where id=$6 returning *',
    [has('url') ? url(b.url) : cur.url, has('login_url') ? url(b.login_url) : cur.login_url,
      ['si', 'no', 'pendiente'].includes(b.has_access) ? b.has_access : cur.has_access, typeof b.visible === 'boolean' ? b.visible : cur.visible, req.user.email, cur.id]);
  res.json({ link: linkOut(r.rows[0]) });
}));
app.delete('/api/links/:id', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  await q('delete from client_links where id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ───────── Panel general ─────────
app.get('/api/dashboard', ...staff, wrap(async (req, res) => {
  const mine = await allowedClients(req.user);
  const [cl, secs, creds, cats] = await Promise.all([
    q('select c.id, c.name, c.category, c.sections, c.status, c.start_date, c.created_at from clients c where not c.archived and ($1::uuid[] is null or c.id = any($1::uuid[]))', [mine]),
    q('select client_id, section, data from client_sections'),
    q("select client_id, count(*)::int n from credentials where status = 'pendiente' group by 1"),
    q('select name, color, sections from categories'),
  ]);
  const by = {};
  for (const s of secs.rows) (by[s.client_id] ||= {})[s.section] = s.data;
  const pend = Object.fromEntries(creds.rows.map((r) => [r.client_id, r.n]));
  const cat = Object.fromEntries(cats.rows.map((c) => [c.name, c]));
  const day = 864e5;
  const incomplete = [], pending = [];
  const active = {}, total = {};
  for (const c of cl.rows) {
    const key = c.category || 'Sin categoría';
    total[key] = (total[key] || 0) + 1;
    if (c.status === 'activa') active[key] = (active[key] || 0) + 1;
    if (c.status === 'activa' || c.status === 'pausada') continue;
    const pct = progress(by[c.id] || {}, allowedSet(c.sections ?? cat[c.category]?.sections), variantFor(c.category) === 'dental').pct;
    const since = new Date(c.start_date || c.created_at);
    if (pct < 100) incomplete.push({ id: c.id, name: c.name, category: c.category, pct, days: Math.max(0, Math.floor((Date.now() - since) / day)) });
    if (pend[c.id]) pending.push({ id: c.id, name: c.name, n: pend[c.id] });
  }
  incomplete.sort((a, b) => b.days - a.days);
  res.json({
    totals: { clients: cl.rows.length, active: cl.rows.filter((c) => c.status === 'activa').length, onboarding: cl.rows.filter((c) => !['activa', 'pausada'].includes(c.status)).length },
    active: Object.entries(active).map(([name, n]) => ({ name, n, color: cat[name]?.color || '#667085' })).sort((a, b) => b.n - a.n),
    by_category: Object.entries(total).map(([name, n]) => ({ name, total: n, active: active[name] || 0, color: cat[name]?.color || '#667085' })).sort((a, b) => b.total - a.total),
    incomplete, pending,
  });
}));

// ───────── Credenciales (equipo) ─────────
const credOut = (r) => ({
  login_with: r.login_with || [], id: r.id, service: r.service, company: r.company, username: r.username, email: r.email, url: r.url,
  notes: r.notes, status: r.status, has_password: !!r.password_enc, updated_at: r.updated_at, updated_by: r.updated_by,
});
const clip = (v, n = 500) => (v == null || v === '' ? null : String(v).slice(0, n));

app.get('/api/clients/:id/credentials', ...staff, requirePasswordRecent, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const r = await q('select * from credentials where client_id = $1 order by service, updated_at', [req.params.id]);
  res.json({ credentials: r.rows.map(credOut) });
}));

app.post('/api/clients/:id/credentials', ...staff, requirePasswordRecent, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const b = req.body;
  if (!clip(b.service, 120)) return res.status(400).json({ error: 'Indica el servicio' });
  const r = await q(
    `insert into credentials (client_id, service, company, username, email, password_enc, url, notes, status, updated_by, login_with)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
    [req.params.id, clip(b.service, 120), clip(b.company), clip(b.username), clip(b.email), b.password ? encrypt(b.password) : null,
      clip(b.url, 500), clip(b.notes, 2000), b.password || ssoList(b.login_with).length ? 'recibida' : 'pendiente', req.user.email, ssoList(b.login_with)]);
  await log(r.rows[0].id, req.params.id, req.user.id, req.user.email, 'crear');
  res.json({ credential: credOut(r.rows[0]) });
}));

app.put('/api/credentials/:id', ...staff, requirePasswordRecent, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const cur = (await q('select * from credentials where id = $1', [req.params.id])).rows[0];
  if (!cur) return res.status(404).json({ error: 'No existe' });
  const b = req.body;
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const status = ['pendiente', 'recibida', 'verificada'].includes(b.status) ? b.status : cur.status;
  let pwd = cur.password_enc;
  let changedPwd = false;
  if (has('password') && b.password !== '') { pwd = encrypt(b.password); changedPwd = true; }
  const sso = has('login_with') ? ssoList(b.login_with) : cur.login_with || [];
  const r = await q(
    `update credentials set service=$1, company=$2, username=$3, email=$4, password_enc=$5, url=$6, notes=$7, status=$8,
     updated_at=now(), updated_by=$9, login_with=$11 where id=$10 returning *`,
    [clip(has('service') ? b.service : cur.service, 120) || cur.service,
      has('company') ? clip(b.company) : cur.company, has('username') ? clip(b.username) : cur.username,
      has('email') ? clip(b.email) : cur.email, pwd, has('url') ? clip(b.url) : cur.url,
      has('notes') ? clip(b.notes, 2000) : cur.notes,
      (changedPwd || sso.length) && status === 'pendiente' ? 'recibida' : status, req.user.email, cur.id, sso]);
  await log(cur.id, cur.client_id, req.user.id, req.user.email, changedPwd ? 'cambiar contraseña' : 'editar');
  res.json({ credential: credOut(r.rows[0]) });
}));

app.delete('/api/credentials/:id', ...staff, requireRole('super_admin', 'admin'), requirePasswordRecent, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const cur = (await q('delete from credentials where id = $1 returning client_id, service', [req.params.id])).rows[0];
  if (cur) await log(req.params.id, cur.client_id, req.user.id, req.user.email, `borrar (${cur.service})`);
  res.json({ ok: true });
}));

// Ver o copiar una contraseña: solo administradores, con doble verificación reciente.
app.post('/api/credentials/:id/reveal', ...staff, requirePasswordRecent, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  if (!canSeePasswords(req.user)) return res.status(403).json({ error: 'Tu rol no permite ver contraseñas' });
  if (!req.user.totp_enabled && !req.user.n_passkeys) return res.status(403).json({ error: 'Activa la doble verificación para ver contraseñas', code: 'no_mfa' });
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

// Lo que es solo de la agencia no llega nunca al cliente: ni las secciones enteras de equipo (o con todos sus campos de equipo) ni los campos de equipo
// que viven dentro de una sección del cliente. Se filtra aquí, en el servidor, no solo en la pantalla.
const fieldsOfSec = (s) => s.groups.flatMap((g) => g.fields);
// Un campo con `shared: true` lo rellena la agencia pero el cliente lo ve en solo lectura (quién es quién, acciones de AVANIA).
const agencyField = (f) => f.owner === 'team' && !f.shared && !f.clientEdit;
const TEAM_ONLY = new Set(FORM.filter((x) => (x.owner === 'team' && !x.shared) || fieldsOfSec(x).every(agencyField)).map((x) => x.key));
const TEAM_KEYS = Object.fromEntries(FORM.map((x) => [x.key, new Set(fieldsOfSec(x).filter(agencyField).map((f) => f.k))]));
// Al cliente se le enseña su avance y el de las áreas, pero no el de la parte interna de la agencia.
const forClientProgress = (p) => ({ sections: p.sections, done: p.done, total: p.total, pct: p.pct, areas: p.areas.map(({ team, ...a }) => a) });
// Tareas y cronograma tal como los ve el cliente: las suyas y las de AVANIA que le afectan (lo interno no sale).
const forClientTasks = (tasks) => tasks.filter((t) => t.client_visible).map(({ kind, ...t }) => t);
const forClient = (key, data) => Object.fromEntries(Object.entries(data || {}).filter(([k]) => !TEAM_KEYS[key]?.has(k)));
// El mismo formulario sirve al enlace por token (/api/f/:token) y al portal con sesión (/api/p/form); en el portal los miembros no tocan credenciales.
const byClient = wrap((req, res, next) => (req.params.token ? byToken(req, res, next) : portalGate(req, res, next)));
const noMember = (req, res, next) => (req.portal && req.cu.role !== 'responsable' ? res.status(403).json({ error: 'Los accesos solo los gestiona el responsable' }) : next());
app.get(['/api/f/:token', '/api/p/form'], byClient, wrap(async (req, res) => {
  const all = await sectionsOf(req.client.id);
  const sections = Object.fromEntries(Object.entries(all).filter(([k]) => !TEAM_ONLY.has(k) && viewOn(req.client, k)).map(([k, v]) => [k, forClient(k, v)]));
  const cr = await q('select * from credentials where client_id = $1 order by service, updated_at', [req.client.id]);
  const crn = {};
  for (const r of cr.rows) crn[r.status] = (crn[r.status] || 0) + 1;
  const tpl = await templateOf(req.client.category, req.client.sections);
  res.json({
    client: { name: req.client.name, manager: req.client.account_manager || null }, sections, progress: forClientProgress(progress(all, tpl.allowed, tpl.dental)),
    tasks: forClientTasks(tasksOf(all, crn, { allowed: tpl.allowed, dental: tpl.dental })), timeline: timelineOf(all), fases: fasesOf(all),
    allowed: tpl.allowed ? [...tpl.allowed] : null, dental: tpl.dental,
    gates: gates(sections, crn, tpl.allowed), contact: process.env.MAIL_REPLY_TO || null,
    role: req.portal ? req.cu.role : null, views: viewMap(req.client),
    credentials: !viewOn(req.client, 'credenciales') || (req.portal && req.cu.role !== 'responsable') ? [] : cr.rows.map((r) => ({ ...credOut(r), updated_by: undefined })),
  });
}));

app.put(['/api/f/:token/sections/:key', '/api/p/form/sections/:key'], byClient, wrap(async (req, res) => {
  if (TEAM_ONLY.has(req.params.key)) return res.status(404).json({ error: 'Sección desconocida' });
  if (!viewOn(req.client, req.params.key)) return denyView(res);
  const data = sanitizeSection(req.params.key, req.body || {}, { team: false });
  if (!data) return res.status(404).json({ error: 'Sección desconocida' });
  const merged = await saveSection(req.client, req.params.key, data, 'cliente');
  const tpl = await templateOf(req.client.category, req.client.sections);
  res.json({ data: forClient(req.params.key, merged), progress: forClientProgress(progress(await sectionsOf(req.client.id), tpl.allowed, tpl.dental)) });
  if (req.params.key === 'cierre') maybeSendReport(req.client.id).catch((e) => console.error(`[informe] ${e.message}`));
}));

// El cliente puede escribir contraseñas, pero nunca leerlas de vuelta.
app.post(['/api/f/:token/credentials', '/api/p/form/credentials'], byClient, noMember, wrap(async (req, res) => {
  if (!viewOn(req.client, 'credenciales')) return denyView(res);
  const b = req.body;
  if (!clip(b.service, 120)) return res.status(400).json({ error: 'Indica el servicio' });
  const n = (await q('select count(*)::int n from credentials where client_id = $1', [req.client.id])).rows[0].n;
  if (n >= 60) return res.status(400).json({ error: 'Demasiadas filas' });
  const r = await q(
    `insert into credentials (client_id, service, company, username, email, password_enc, url, notes, status, updated_by, login_with)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'cliente',$10) returning *`,
    [req.client.id, clip(b.service, 120), clip(b.company), clip(b.username), clip(b.email), b.password ? encrypt(b.password) : null,
      clip(b.url, 500), clip(b.notes, 2000), b.password || ssoList(b.login_with).length ? 'recibida' : 'pendiente', ssoList(b.login_with)]);
  await log(r.rows[0].id, req.client.id, null, 'cliente', 'crear');
  res.json({ credential: { ...credOut(r.rows[0]), updated_by: undefined } });
}));

app.put(['/api/f/:token/credentials/:id', '/api/p/form/credentials/:id'], byClient, noMember, wrap(async (req, res) => {
  if (!viewOn(req.client, 'credenciales')) return denyView(res);
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  const cur = (await q('select * from credentials where id = $1 and client_id = $2', [req.params.id, req.client.id])).rows[0];
  if (!cur) return res.status(404).json({ error: 'No existe' });
  const b = req.body;
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const newPwd = has('password') && b.password !== '';
  const sso = has('login_with') ? ssoList(b.login_with) : cur.login_with || [];
  const status = (newPwd || sso.length) && cur.status === 'pendiente' ? 'recibida' : cur.status;
  const r = await q(
    `update credentials set company=$1, username=$2, email=$3, password_enc=$4, url=$5, notes=$6, status=$7,
     updated_at=now(), updated_by='cliente', login_with=$9 where id=$8 returning *`,
    [has('company') ? clip(b.company) : cur.company, has('username') ? clip(b.username) : cur.username,
      has('email') ? clip(b.email) : cur.email, newPwd ? encrypt(b.password) : cur.password_enc,
      has('url') ? clip(b.url) : cur.url, has('notes') ? clip(b.notes, 2000) : cur.notes, newPwd && cur.status !== 'verificada' ? 'recibida' : status, cur.id, sso]);
  await log(cur.id, cur.client_id, null, 'cliente', newPwd ? 'cambiar contraseña' : 'editar');
  res.json({ credential: { ...credOut(r.rows[0]), updated_by: undefined } });
}));

// Fases del proceso (de los documentos de investigación al lanzamiento): las edita la agencia y el cliente las ve. `reset` vuelve a la lista estándar.
app.put('/api/clients/:id/proceso', ...staff, wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  const fases = req.body.reset ? fasesBase() : cleanFases(req.body.fases);
  if (!fases.length) return res.status(400).json({ error: 'Debe quedar al menos una fase' });
  await saveSection(c, 'proceso', { fases }, req.user.email);
  const all = await sectionsOf(c.id);
  res.json({ fases: fasesOf(all), timeline: timelineOf(all, { includeEmpty: true }) });
}));

// Sincroniza las tareas con ClickUp: si «Enlace de ClickUp» apunta a un espacio que responde, se usa; si no, se crea uno con el nombre del cliente
// y su enlace se guarda en el proyecto. Cada tarea con responsable se asigna a esa persona (con sus fechas) y se le avisa desde ClickUp.
const syncing = new Set();
app.get('/api/clickup/status', ...staff, (_req, res) => res.json({ enabled: clickupEnabled() }));
app.post('/api/clients/:id/clickup/sync', ...staff, requireRole('super_admin', 'admin'), wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  if (syncing.has(c.id)) return res.status(409).json({ error: 'Ya se está sincronizando este cliente.' });
  syncing.add(c.id);
  try {
    const all = await sectionsOf(c.id);
    const fases = JSON.parse(JSON.stringify(fasesOf(all)));
    const r = await syncClickup({ link: (all.proyecto || {}).enlace_clickup, clientName: c.name, fases, state: (all.proceso || {}).clickup || {} });
    await saveSection(c, 'proceso', { fases: cleanFases(r.fases), clickup: { list_id: r.listId, space_id: r.spaceId, synced_at: new Date().toISOString() } }, req.user.email);
    if (r.link && r.link !== (all.proyecto || {}).enlace_clickup) await saveSection(c, 'proyecto', { enlace_clickup: r.link }, req.user.email);
    const now = await sectionsOf(c.id);
    res.json({ ok: true, link: r.link, spaceCreated: r.spaceCreated, created: r.created, updated: r.updated, pulled: r.pulled, notified: r.notified, unassigned: r.unassigned, fases: fasesOf(now), timeline: timelineOf(now, { includeEmpty: true }) });
  } finally { syncing.delete(c.id); }
}));

// «Ver cliente»: solo un superadministrador decide qué ve el cliente en su espacio.
app.put('/api/clients/:id/client-view', ...staff, requireRole('super_admin'), wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  const { key, on } = req.body || {};
  if (!VIEW_KEYS.includes(key) || typeof on !== 'boolean') return res.status(400).json({ error: 'Dato no válido' });
  const r = await q("update clients set client_view = client_view || jsonb_build_object($1::text, $2::boolean), updated_at = now() where id = $3 returning client_view", [key, on, c.id]);
  res.json({ views: viewMap({ client_view: r.rows[0].client_view }) });
}));

// Archivos de la carpeta de Drive del cliente (leídos de Google Drive; solo lectura).
app.get('/api/clients/:id/drive', ...staff, wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  res.json(await driveListing((await sectionsOf(c.id)).proyecto?.enlace_drive, { refresh: req.query.refresh === '1' }));
}));

// Analiza un archivo de la carpeta de Drive del cliente y devuelve su resumen (no guarda nada: la ficha lo guarda al aceptar).
app.post('/api/clients/:id/analisis', ...staff, wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  const b = req.body || {};
  const file = await readClientFile((await sectionsOf(c.id)).proyecto?.enlace_drive, String(b.fileId || ''));
  const resumen = await summarize({ kind: String(b.kind || ''), clientName: c.name, file });
  res.json({ nombre: file.name, url: file.url, resumen });
}));

// Conclusiones de una pestaña de «Nuestros análisis» a partir de los resúmenes de sus fichas (no guarda: la ficha lo guarda al aceptar).
const CONCL_FICHAS = { avatar: 'avatares', competencia: 'competencia_fichas', oferta: 'oferta_fichas' };
app.post('/api/clients/:id/conclusiones', ...staff, wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  const kind = String((req.body || {}).kind || '');
  if (!CONCL_FICHAS[kind]) return res.status(400).json({ error: 'Pestaña no válida' });
  const all = await sectionsOf(c.id);
  const sent = Array.isArray(req.body.fichas) ? req.body.fichas : (all.oferta || {})[CONCL_FICHAS[kind]];
  const fichas = (Array.isArray(sent) ? sent : []).map((f) => ({ nombre: String(f?.nombre || '').slice(0, 120), resumen: String(f?.resumen || '').trim().slice(0, 3000) })).filter((f) => f.resumen).slice(0, 12);
  if (!fichas.length) return res.status(400).json({ error: 'Primero hace falta al menos una ficha con su resumen.' });
  const m = all.mercado || {};
  const tabla = (rows, cols) => (Array.isArray(rows) ? rows : []).map((r) => cols.map((k) => String(r?.[k] || '').trim()).filter(Boolean).join(' · ')).filter(Boolean).slice(0, 12).join('\n');
  const contexto = { avatar: [m.clientes_mejores, m.clientes_no, tabla(m.clientes_tipo, ['tipo', 'quien', 'busca'])], competencia: [tabla(m.competidores, ['nombre', 'mejor', 'peor'])], oferta: [tabla(m.ofertas, ['oferta', 'precio', 'condiciones']), m.estrella, m.diferencial] }[kind]
    .map((x) => String(x || '').trim()).filter(Boolean).join('\n').slice(0, 3000);
  res.json({ conclusiones: await conclude({ kind, clientName: c.name, fichas, contexto }) });
}));

// Nueva carpeta dentro de la carpeta de Drive del cliente (lo único que Space crea en Drive).
app.post('/api/clients/:id/drive/folders', ...staff, requireRole('super_admin', 'admin'), wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  const link = (await sectionsOf(c.id)).proyecto?.enlace_drive;
  const b = req.body || {};
  res.json(await createFolder(link, String(b.parent || ''), b.name));
}));

// Cronograma al día (se pide de nuevo tras cambiar una fecha desde el propio cronograma).
app.get('/api/clients/:id/timeline', ...staff, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  res.json({ timeline: timelineOf(await sectionsOf(req.params.id), { includeEmpty: true }) });
}));

// ───────── Cierre del onboarding e informe por correo ─────────
// El cliente ha terminado cuando marca todas las casillas de «Revisión final» (o completa todo su avance); la agencia, cuando pulsa «Nuestra parte está terminada».
// En cuanto ocurren las dos cosas se envía solo un informe al responsable (REPORT_TO); una sola vez. Se puede pedir a mano cuando se quiera.
const clientDone = (sections, p) => {
  const checks = fieldsOfSec(FORM.find((x) => x.key === 'cierre')).filter((f) => f.type === 'check');
  return (checks.length && checks.every((f) => (sections.cierre || {})[f.k] === true)) || (p.total > 0 && p.pct === 100);
};
function onboardingState(c, sections) {
  const p = progress(sections);
  return { client_done: clientDone(sections, p), team_done_at: c.team_done_at, report_sent_at: c.report_sent_at, report_to: REPORT_TO() };
}
async function reportFor(c) {
  const sections = await sectionsOf(c.id);
  const tpl = await templateOf(c.category, c.sections);
  const credRows = (await q('select service, status, (password_enc is not null) has_password from credentials where client_id = $1 order by service', [c.id])).rows;
  const cr = {};
  for (const r of credRows) cr[r.status] = (cr[r.status] || 0) + 1;
  const p = progress(sections, tpl.allowed, tpl.dental);
  const fresh = (await q('select * from clients where id = $1', [c.id])).rows[0];
  return buildReport({ client: fresh, sections, creds: credRows, progress: p, gates: gates(sections, cr, tpl.allowed),
    tasks: tasksOf(sections, cr, { allowed: tpl.allowed, dental: tpl.dental }), timeline: timelineOf(sections), onboarding: onboardingState(fresh, sections) });
}
async function sendReport(c) {
  const r = await reportFor(c);
  await sendHtml({ to: REPORT_TO(), ...r });
  await q('update clients set report_sent_at = now() where id = $1', [c.id]);
  return REPORT_TO();
}
async function maybeSendReport(clientId) {
  const c = (await q('select * from clients where id = $1 and not archived', [clientId])).rows[0];
  if (!c || c.report_sent_at || !c.team_done_at) return false;
  if (!onboardingState(c, await sectionsOf(c.id)).client_done) return false;
  await sendReport(c);
  return true;
}
const clientOf = async (req, res) => {
  if (!isUuid(req.params.id)) { res.status(400).json({ error: 'Id no válido' }); return null; }
  const c = (await q('select * from clients where id = $1', [req.params.id])).rows[0];
  if (!c) res.status(404).json({ error: 'No existe' });
  return c || null;
};
// La agencia da por terminada (o reabre) su parte. Si el cliente también ha terminado, sale el informe.
app.post('/api/clients/:id/team-done', ...staff, wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  const done = req.body.done !== false;
  await q('update clients set team_done_at = $1, updated_at = now() where id = $2', [done ? new Date() : null, c.id]);
  let sent = false, error = null;
  if (done) { try { sent = await maybeSendReport(c.id); } catch (e) { error = e.message; } }
  const fresh = (await q('select * from clients where id = $1', [c.id])).rows[0];
  res.json({ onboarding: onboardingState(fresh, await sectionsOf(c.id)), sent, error });
}));
// Mapa y estudio sociodemográfico de la zona (dirección y ciudad de Datos; radio y localidades de Área de influencia).
app.get('/api/clients/:id/zona', ...staff, wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  const all = await sectionsOf(c.id), cl = all.clinica || {}, zn = all.zona || {};
  if (!String(zn.localidades || '').trim() && !String(cl.direccion || cl.ciudad || '').trim()) return res.json({ empty: true });
  try { res.json(await zonaStudy({ direccion: cl.direccion, ciudad: cl.ciudad, radio: zn.radio, localidades: zn.localidades })); }
  catch (e) { res.status(502).json({ error: `No se pudo preparar el estudio de la zona: ${e.message}` }); }
}));
// Vista previa del informe (no envía nada) y envío manual.
app.get('/api/clients/:id/report', ...staff, wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  const { subject, html } = await reportFor(c);
  res.json({ subject, html, to: REPORT_TO() });
}));
app.post('/api/clients/:id/report', ...staff, wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  try { res.json({ ok: true, to: await sendReport(c) }); } catch (e) { res.status(502).json({ error: `No se pudo enviar el informe: ${e.message}` }); }
}));

// ───────── Equipo de AVANIA (quién es quién): se escribe una vez aquí y se copia a la ficha de cada cliente ─────────
const personOut = (r) => ({ id: r.id, name: r.name, role: r.role, responsibilities: r.responsibilities, email: r.email, phone: r.phone, active: r.active });
app.get('/api/agency-people', ...staff, wrap(async (_req, res) => {
  res.json({ people: (await q('select * from agency_people order by position, name')).rows.map(personOut) });
}));
app.put('/api/agency-people', ...staff, ...admin, wrap(async (req, res) => {
  const b = req.body || {}, t = (v, n = 300) => String(v ?? '').trim().slice(0, n) || null;
  const name = t(b.name, 120);
  if (!name) return res.status(400).json({ error: 'Escribe el nombre' });
  const email = t(b.email, 200)?.toLowerCase() || null;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Correo no válido' });
  const vals = [name, t(b.role, 120), t(b.responsibilities, 1500), email, t(b.phone, 40), b.active !== false];
  try {
    const r = isUuid(b.id)
      ? await q('update agency_people set name=$1, role=$2, responsibilities=$3, email=$4, phone=$5, active=$6, updated_at=now() where id=$7 returning *', [...vals, b.id])
      : await q('insert into agency_people (name, role, responsibilities, email, phone, active, position) values ($1,$2,$3,$4,$5,$6,(select coalesce(max(position),0)+1 from agency_people)) returning *', vals);
    if (!r.rows[0]) return res.status(404).json({ error: 'No existe' });
    res.json({ person: personOut(r.rows[0]) });
  } catch (e) { if (e.code === '23505') return res.status(409).json({ error: 'Ya hay alguien con ese correo' }); throw e; }
}));
app.delete('/api/agency-people/:id', ...staff, ...admin, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
  await q('delete from agency_people where id = $1', [req.params.id]);
  res.json({ ok: true });
}));
// Copia el equipo activo a la ficha «Nosotros» de un cliente, sin repetir a quien ya está (por correo o nombre) ni tocar lo que haya escrito.
app.post('/api/clients/:id/load-agency-people', ...staff, wrap(async (req, res) => {
  const c = await clientOf(req, res); if (!c) return;
  const cur = (await sectionsOf(c.id)).avania || {};
  const rows = Array.isArray(cur.personas) ? cur.personas.filter((r) => Object.values(r || {}).some((v) => String(v || '').trim())) : [];
  const seen = new Set(rows.flatMap((r) => [String(r.correo || '').toLowerCase(), String(r.nombre || '').toLowerCase()]).filter(Boolean));
  const add = (await q('select * from agency_people where active order by position, name')).rows
    .filter((p) => !seen.has(String(p.email || '').toLowerCase()) && !seen.has(p.name.toLowerCase()))
    .map((p) => ({ nombre: p.name, rol: p.role || '', responsabilidades: p.responsibilities || '', correo: p.email || '', telefono: p.phone || '' }));
  const data = await saveSection(c, 'avania', { personas: [...rows, ...add] }, req.user.email);
  res.json({ data, added: add.length });
}));

// ───────── Portal del cliente y Bóveda ─────────
mountPeople(app, { wrap, staff });
mountPortal(app, { wrap, isUuid, ip, staff, sectionsOf, progress, gates, templateOf, tasksOf, timelineOf, fasesOf, forClientProgress, forClientTasks });
mountVault(app, { wrap, isUuid, staff, log });
mountKpis(app, { wrap, isUuid, staff, log, sectionsOf, saveSection });

// ───────── Páginas ─────────
app.get('/f/:token', (_req, res) => res.sendFile(path.join(PUBLIC, 'form.html')));
app.get('/portal/alta', (_req, res) => res.sendFile(path.join(PUBLIC, 'form.html')));

// Enlace directo del submenú de Avania Funnels: /c/{{contact.id}} → el formulario de ese cliente.
const NOT_READY = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avania Space</title><body style="font:16px system-ui;max-width:460px;margin:15vh auto;padding:0 16px;text-align:center;color:#222"><h2>Tu espacio aún no está preparado</h2><p>Escríbenos y lo activamos enseguida.</p></body>';
app.get('/c/:loc', wrap(async (req, res) => {
  const l = req.params.loc;
  if (!ID_RE.test(l) || tooMany(`loc:${ip(req)}`, 300, 60 * 60e3)) return res.status(404).type('html').send(NOT_READY);
  const c = (await q('select token from clients where funnels_contact_id = $1 and not archived', [l])).rows[0];
  if (!c) return res.status(404).type('html').send(NOT_READY);
  res.redirect(302, `/f/${c.token}`);
}));
app.use(express.static(PUBLIC, { index: 'index.html', extensions: ['html'] }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'No existe' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  // Los errores con estado propio (p. ej. los de Avania Funnels) llevan un mensaje pensado para mostrarse.
  const st = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(st).json({ error: st === 500 ? 'Error del servidor' : err.message });
});

const port = Number(process.env.PORT || 3003);
app.listen(port, '127.0.0.1', () => console.log(`Avania Space en 127.0.0.1:${port}`));
