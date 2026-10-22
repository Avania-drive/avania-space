import crypto from 'node:crypto';

// Clave de 32 bytes (hex) en .env. Vive solo en el servidor: la base de datos guarda texto cifrado.
function key() {
  const hex = process.env.CREDENTIALS_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('CREDENTIALS_KEY debe ser 32 bytes en hexadecimal');
  return Buffer.from(hex, 'hex');
}

// Formato: iv.tag.cifrado (base64)
export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload) {
  const [iv, tag, ct] = payload.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, s, h] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const got = crypto.scryptSync(pw, Buffer.from(s, 'base64'), 64);
  const want = Buffer.from(h, 'base64');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
