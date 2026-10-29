// Lectura (solo lectura) de la carpeta de Google Drive de cada cliente: los documentos con su nombre y la carpeta en la que están.
// Usa una cuenta de servicio de Google: en .env, GOOGLE_SA_FILE = ruta del JSON de la cuenta. Las carpetas de los clientes hay que
// compartirlas con el correo de esa cuenta (como lector). Space nunca modifica nada en Drive.
import fs from 'node:fs';
import crypto from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const API = 'https://www.googleapis.com/drive/v3';
const MAX_DEPTH = 3, MAX_FILES = 400;
const b64 = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');

let sa = null, tok = null;
function account() {
  if (sa !== null) return sa || null;
  try { const j = JSON.parse(fs.readFileSync(process.env.GOOGLE_SA_FILE, 'utf8')); sa = j.client_email && j.private_key ? { email: j.client_email, key: j.private_key } : false; }
  catch { sa = false; }
  return sa || null;
}
export const driveEnabled = () => Boolean(process.env.GOOGLE_SA_FILE && account());
export const driveAccountEmail = () => account()?.email || null;
export const folderIdOf = (url) => (/\/folders\/([\w-]{10,})/.exec(String(url || '')) || /[?&]id=([\w-]{10,})/.exec(String(url || '')) || [])[1] || null;

async function token() {
  if (tok && tok.exp > Date.now() + 60e3) return tok.value;
  const a = account(), now = Math.floor(Date.now() / 1000);
  const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: a.email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(head).sign(a.key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${sig}` }), signal: AbortSignal.timeout(15_000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw Object.assign(new Error('Google no ha aceptado la cuenta de servicio de Space.'), { status: 502 });
  tok = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return tok.value;
}
async function get(path, params) {
  const r = await fetch(`${API}${path}?${new URLSearchParams({ supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', ...params })}`, { headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(20_000) });
  if (r.status === 404 || r.status === 403) throw Object.assign(new Error(`Space no puede ver esa carpeta de Drive. Compártela (como lector) con ${account().email}.`), { status: 404, notShared: true });
  if (!r.ok) throw Object.assign(new Error(`Google Drive respondió ${r.status}.`), { status: 502 });
  return r.json();
}

const KIND = [[/folder/, 'carpeta'], [/document|msword|wordprocessing|opendocument\.text/, 'documento'], [/spreadsheet|excel/, 'hoja'], [/presentation|powerpoint/, 'presentación'], [/pdf/, 'pdf'], [/^image\//, 'imagen'], [/^video\//, 'vídeo'], [/^audio\//, 'audio']];
const kindOf = (mime) => (KIND.find(([re]) => re.test(mime)) || [0, 'archivo'])[1];

/** Todos los archivos de la carpeta y sus subcarpetas (hasta 3 niveles). Cada uno con el nombre de la carpeta en la que está. */
export async function listFolder(folderId) {
  const root = await get(`/files/${folderId}`, { fields: 'id,name,mimeType' });
  if (!/folder/.test(root.mimeType)) throw Object.assign(new Error('Ese enlace de Drive no es una carpeta.'), { status: 400 });
  const files = [];
  let truncated = false;
  const walk = async (id, trail, depth) => {
    let page = '';
    do {
      const r = await get('/files', { q: `'${id}' in parents and trashed = false`, pageSize: '200', pageToken: page, orderBy: 'name', fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)' });
      for (const f of r.files || []) {
        if (files.length >= MAX_FILES) { truncated = true; return; }
        if (/folder/.test(f.mimeType)) { if (depth < MAX_DEPTH) await walk(f.id, [...trail, f.name], depth + 1); }
        else files.push({ id: f.id, name: f.name, kind: kindOf(f.mimeType), url: f.webViewLink || null, modified: f.modifiedTime || null, folder: trail.join(' / ') });
      }
      page = r.nextPageToken || '';
    } while (page && !truncated);
  };
  await walk(folderId, [root.name], 1);
  files.sort((a, b) => a.folder.localeCompare(b.folder, 'es') || a.name.localeCompare(b.name, 'es'));
  return { folder: root.name, files, truncated };
}

const cache = new Map();   // folderId → { at, data }
export async function folderFiles(folderId, { refresh = false } = {}) {
  const hit = cache.get(folderId);
  if (hit && Date.now() - hit.at < (refresh ? 20e3 : 5 * 60e3)) return hit.data;
  const data = await listFolder(folderId);
  cache.set(folderId, { at: Date.now(), data });
  return data;
}

/** Respuesta para la pantalla: nunca lanza; dice si falta configurar Google, si la carpeta no está compartida o lista los archivos. */
export async function driveListing(driveUrl, opts) {
  if (!driveEnabled()) return { state: 'sin_google' };
  const id = folderIdOf(driveUrl);
  if (!id) return { state: 'sin_carpeta' };
  try { return { state: 'ok', ...(await folderFiles(id, opts)) }; }
  catch (e) { return { state: e.notShared ? 'sin_permiso' : 'error', message: e.message, account: driveAccountEmail() }; }
}
