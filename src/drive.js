// Lectura (solo lectura) de la carpeta de Google Drive de cada cliente: los documentos con su nombre y la carpeta en la que están.
// Usa una cuenta de servicio de Google: en .env, GOOGLE_SA_FILE = ruta del JSON de la cuenta. Las carpetas de los clientes hay que
// compartirlas con el correo de esa cuenta (como lector). Space nunca modifica nada en Drive.
import fs from 'node:fs';
import crypto from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const SCOPE_WRITE = 'https://www.googleapis.com/auth/drive';   // solo para crear carpetas (createFolder); el resto de Space sigue siendo de lectura
const API = 'https://www.googleapis.com/drive/v3';
const MAX_DEPTH = 3, MAX_FILES = 400;
const b64 = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');

let sa = null; const toks = {};
function account() {
  if (sa !== null) return sa || null;
  try { const j = JSON.parse(fs.readFileSync(process.env.GOOGLE_SA_FILE, 'utf8')); sa = j.client_email && j.private_key ? { email: j.client_email, key: j.private_key } : false; }
  catch { sa = false; }
  return sa || null;
}
export const driveEnabled = () => Boolean(process.env.GOOGLE_SA_FILE && account());
export const driveAccountEmail = () => account()?.email || null;
export const folderIdOf = (url) => (/\/folders\/([\w-]{10,})/.exec(String(url || '')) || /[?&]id=([\w-]{10,})/.exec(String(url || '')) || [])[1] || null;

async function token(scope = SCOPE) {
  const tok = toks[scope];
  if (tok && tok.exp > Date.now() + 60e3) return tok.value;
  const a = account(), now = Math.floor(Date.now() / 1000);
  const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: a.email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(head).sign(a.key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${sig}` }), signal: AbortSignal.timeout(15_000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw Object.assign(new Error('Google no ha aceptado la cuenta de servicio de Space.'), { status: 502 });
  toks[scope] = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}
async function get(path, params) {
  const r = await fetch(`${API}${path}?${new URLSearchParams({ supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', ...params })}`, { headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(20_000) });
  if (r.status === 404 || r.status === 403) throw Object.assign(new Error(`Space no puede ver esa carpeta de Drive. Compártela (como lector) con ${account().email}.`), { status: 404, notShared: true });
  if (!r.ok) throw Object.assign(new Error(`Google Drive respondió ${r.status}.`), { status: 502 });
  return r.json();
}

const KIND = [[/folder/, 'carpeta'], [/document|msword|wordprocessing|opendocument\.text/, 'documento'], [/spreadsheet|excel/, 'hoja'], [/presentation|powerpoint/, 'presentación'], [/pdf/, 'pdf'], [/^image\//, 'imagen'], [/^video\//, 'vídeo'], [/^audio\//, 'audio']];
const kindOf = (mime) => (KIND.find(([re]) => re.test(mime)) || [0, 'archivo'])[1];

/** Árbol de la carpeta (hasta 3 niveles): { id, name, files: [...], folders: [{ id, name, files, folders }] }. Carpetas y archivos ordenados por nombre. */
export async function listFolder(folderId) {
  const root = await get(`/files/${folderId}`, { fields: 'id,name,mimeType' });
  if (!/folder/.test(root.mimeType)) throw Object.assign(new Error('Ese enlace de Drive no es una carpeta.'), { status: 400 });
  let count = 0, truncated = false;
  const walk = async (id, name, depth) => {
    const node = { id, name, files: [], folders: [] };
    let page = '';
    do {
      const r = await get('/files', { q: `'${id}' in parents and trashed = false`, pageSize: '200', pageToken: page, orderBy: 'name', fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,size,webViewLink,lastModifyingUser(displayName))' });
      for (const f of r.files || []) {
        if (count >= MAX_FILES) { truncated = true; return node; }
        if (/folder/.test(f.mimeType)) { if (depth < MAX_DEPTH) { const sub = await walk(f.id, f.name, depth + 1); sub.modified = f.modifiedTime || null; node.folders.push(sub); } }
        else { count++; node.files.push({ id: f.id, name: f.name, kind: kindOf(f.mimeType), url: f.webViewLink || null, modified: f.modifiedTime || null, created: f.createdTime || null, size: f.size ? Number(f.size) : null, by: f.lastModifyingUser?.displayName || null }); }
      }
      page = r.nextPageToken || '';
    } while (page && !truncated);
    return node;
  };
  const tree = await walk(folderId, root.name, 1);
  return { folder: root.name, tree, total: count, truncated };
}

/**
 * Estructura de Drive: [CLIENTES] / <cliente> / MARKETING / …  A un cliente solo se le enlaza su carpeta MARKETING, y la cuenta de servicio
 * solo tiene acceso a las MARKETING que se le comparten una a una: lo que no se comparte con ella, Space no puede leerlo.
 * Opcional: con DRIVE_ROOT_FOLDER (carpeta de todos los clientes) se exige además que la MARKETING cuelgue de ella; eso necesita que la
 * cuenta pueda ver la carpeta del cliente, así que sin esa variable solo se comprueba el nombre.
 */
export const rootId = () => { const v = String(process.env.DRIVE_ROOT_FOLDER || '').trim(); return v ? folderIdOf(v) || (/^[\w-]{10,}$/.test(v) ? v : null) : null; };
const okFolders = new Set();   // solo se guardan los aciertos
async function assertClientFolder(folderId) {
  if (okFolders.has(folderId)) return;
  const root = rootId();
  const bad = (m) => Object.assign(new Error(m), { status: 400, outsideRoot: true });
  if (root && folderId === root) throw bad('Ese enlace es la carpeta de todos los clientes: pon la carpeta MARKETING de este cliente.');
  const me = await get(`/files/${folderId}`, { fields: 'id,name,parents' });
  if (!/^[\s\d.\-–]*marketing\s*$/i.test(me.name))   // «MARKETING» o con numeración delante («2. MARKETING»)
    throw bad(`Esa carpeta se llama «${me.name}»: al cliente solo se le enlaza su carpeta MARKETING.`);
  if (root) {
    const mid = me.parents?.[0] ? await get(`/files/${me.parents[0]}`, { fields: 'id,parents' }) : null;
    if (!mid || mid.parents?.[0] !== root) throw bad('Esa carpeta MARKETING no cuelga de una carpeta de cliente dentro de [CLIENTES].');
  }
  okFolders.add(folderId);
}

const cache = new Map();   // folderId → { at, data }
export async function folderFiles(folderId, { refresh = false } = {}) {
  const hit = cache.get(folderId);
  if (hit && Date.now() - hit.at < (refresh ? 20e3 : 5 * 60e3)) return hit.data;
  await assertClientFolder(folderId);
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
  catch (e) { return { state: e.outsideRoot ? 'fuera_de_raiz' : e.notShared ? 'sin_permiso' : 'error', message: e.message, account: driveAccountEmail() }; }
}

/**
 * Crea una carpeta dentro de la carpeta del cliente (o de cualquiera de sus subcarpetas). Es lo único que Space escribe en Drive:
 * los archivos no se pueden subir desde aquí porque Google no da espacio de almacenamiento a las cuentas de servicio.
 */
export async function createFolder(clientFolderUrl, parentId, name) {
  if (!driveEnabled()) throw Object.assign(new Error('Space aún no está conectado a Google Drive.'), { status: 409 });
  const root = folderIdOf(clientFolderUrl);
  if (!root) throw Object.assign(new Error('Este cliente no tiene carpeta de Drive enlazada.'), { status: 409 });
  const clean = String(name || '').replace(/[\\/\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!clean) throw Object.assign(new Error('Escribe el nombre de la carpeta.'), { status: 400 });
  await assertClientFolder(root);
  // El destino tiene que ser la carpeta del cliente o colgar de ella.
  let id = parentId, inside = id === root;
  for (let i = 0; i < 8 && !inside && id; i++) { const f = await get(`/files/${id}`, { fields: 'id,parents' }); id = f.parents?.[0]; inside = id === root; }
  if (!inside) throw Object.assign(new Error('Esa carpeta no está dentro de la carpeta del cliente.'), { status: 400 });
  const r = await fetch(`${API}/files?supportsAllDrives=true&fields=id,name`, { method: 'POST', headers: { Authorization: `Bearer ${await token(SCOPE_WRITE)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: clean, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }), signal: AbortSignal.timeout(20_000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(r.status === 403 ? `Space no tiene permiso de edición en esa carpeta. Comparte la carpeta MARKETING como editor con ${account().email}.` : `Google Drive respondió ${r.status}.`), { status: r.status === 403 ? 403 : 502 });
  cache.delete(root);
  return { id: j.id, name: j.name };
}
