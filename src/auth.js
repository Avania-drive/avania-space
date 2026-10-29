import { authenticator } from 'otplib';
import { q } from './db.js';
import { randomToken, sha256 } from './crypto.js';

export const COOKIE = 'sp_session';
const DAYS = 14;

export function parseCookies(req) {
  const out = {};
  for (const p of String(req.headers.cookie || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}

export async function createSession(req, res, userId) {
  const token = randomToken();
  const exp = new Date(Date.now() + DAYS * 864e5);
  await q('insert into sessions (token_hash, user_id, expires_at) values ($1,$2,$3)', [sha256(token), userId, exp]);
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.secure;
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DAYS * 86400}${secure ? '; Secure' : ''}`);
}

export function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

// Rellena req.user y req.session si hay sesión válida.
export async function loadSession(req, _res, next) {
  const token = parseCookies(req)[COOKIE];
  if (token) {
    const r = await q(
      `select s.id sid, s.mfa_until, s.reauth_until, (select count(*)::int from passkeys p where p.user_id = u.id) n_passkeys, u.* from sessions s join team_users u on u.id = s.user_id
       where s.token_hash = $1 and s.expires_at > now() and u.active`, [sha256(token)]);
    if (r.rows[0]) {
      const { sid, mfa_until, reauth_until, ...user } = r.rows[0];
      req.user = user;
      req.session = { id: sid, mfa_until, reauth_until };
    }
  }
  next();
}

export const requireUser = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'No has iniciado sesión' });

// Obliga a haber cambiado la contraseña temporal antes de usar nada más.
export const requireReady = (req, res, next) =>
  req.user.must_change_password ? res.status(403).json({ error: 'Cambia primero la contraseña', code: 'must_change' }) : next();

// Zona de credenciales: hay que haber vuelto a escribir la contraseña de la cuenta hace poco (POST /api/reauth). Mientras se usa, la
// comprobación se renueva; tras REAUTH_MINUTES sin tocar las credenciales hay que volver a escribirla.
export const REAUTH_MINUTES = 10;
export const requirePasswordRecent = async (req, res, next) => {
  const until = req.session?.reauth_until;
  if (!until || new Date(until) <= new Date()) return res.status(403).json({ error: 'Escribe tu contraseña para abrir las credenciales', code: 'password_required' });
  await q('update sessions set reauth_until = now() + ($1 || \' minutes\')::interval where id = $2', [REAUTH_MINUTES, req.session.id]);
  next();
};

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'No tienes permiso para esto' });

export const canSeePasswords = (u) => u.role === 'super_admin' || u.role === 'admin';

export const totp = authenticator;
authenticator.options = { window: 1 };

export function publicUser(u) {
  return {
    id: u.id, email: u.email, name: u.name, role: u.role,
    must_change_password: u.must_change_password, mfa_enabled: !!u.totp_enabled || (u.n_passkeys || 0) > 0,
    has_totp: !!u.totp_enabled, n_passkeys: u.n_passkeys || 0, prefs: u.prefs || {},
    can_see_passwords: canSeePasswords(u),
  };
}

// Limitador sencillo en memoria para el login y los códigos.
const hits = new Map();
export function tooMany(key, max = 8, windowMs = 15 * 60e3) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > max;
}
