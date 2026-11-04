// Prueba de los documentos subidos a la ficha del cliente. Crea un cliente y un usuario de prueba y los borra al final.
import 'dotenv/config';
import { q, pool } from '../src/db.js';
import { hashPassword } from '../src/crypto.js';
const B = 'http://127.0.0.1:3003';
let cookie = '';
const call = async (m, u, body, headers = {}) => { const r = await fetch(B + u, { method: m, headers: { cookie, ...headers }, body }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return r; };
let bad = 0; const ok = (n, c, x = '') => { if (!c) bad++; console.log((c ? 'OK  ' : 'FALLA ') + n + (c ? '' : ' ' + x)); };
const EMAIL = 'test-archivos@example.invalid';
await q('delete from team_users where email = $1', [EMAIL]);
await q("insert into team_users (email,name,role,password_hash,must_change_password) values ($1,'Prueba archivos','admin',$2,false)", [EMAIL, hashPassword('contraseña-de-prueba-1')]);
let id;
try {
  await call('POST', '/api/login', JSON.stringify({ email: EMAIL, password: 'contraseña-de-prueba-1' }), { 'Content-Type': 'application/json' });
  id = (await (await call('POST', '/api/clients', JSON.stringify({ name: 'Empresa Prueba Archivos' }), { 'Content-Type': 'application/json' })).json()).client.id;
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  let r = await call('POST', `/api/clients/${id}/files?name=${encodeURIComponent('Contrato ñ.pdf')}&type=application%2Fpdf`, pdf, { 'Content-Type': 'application/octet-stream', 'X-Space-Upload': '1' });
  const f = (await r.json()).file; ok('subir un PDF', r.status === 200 && f.size === pdf.length && f.name === 'Contrato ñ.pdf', JSON.stringify(f));
  r = await call('GET', `/api/clients/${id}/files`); ok('lista el archivo', (await r.json()).files.length === 1);
  r = await call('GET', `/api/clients/${id}/files/${f.id}`); const buf = Buffer.from(await r.arrayBuffer());
  ok('el PDF se ve dentro (inline) y se puede enmarcar', r.headers.get('content-type') === 'application/pdf' && /^inline/.test(r.headers.get('content-disposition')) && r.headers.get('x-frame-options') === 'SAMEORIGIN' && buf.equals(pdf), `${r.headers.get('content-type')} ${r.headers.get('content-disposition')} ${r.headers.get('x-frame-options')}`);
  r = await call('GET', `/api/clients/${id}/files/${f.id}?download=1`); ok('descarga como adjunto', /^attachment/.test(r.headers.get('content-disposition')));
  r = await call('POST', `/api/clients/${id}/files?name=evil.html&type=text%2Fhtml`, Buffer.from('<script>alert(1)</script>'), { 'Content-Type': 'application/octet-stream', 'X-Space-Upload': '1' });
  const h = (await r.json()).file; r = await call('GET', `/api/clients/${id}/files/${h.id}`);
  ok('un HTML nunca se muestra dentro: se descarga', r.headers.get('content-type') === 'application/octet-stream' && /^attachment/.test(r.headers.get('content-disposition')));
  r = await call('POST', `/api/clients/${id}/files?name=grande.bin`, Buffer.alloc(16 * 1024 * 1024 + 10), { 'Content-Type': 'application/octet-stream', 'X-Space-Upload': '1' }); ok('rechaza más de 15 MB', r.status === 413, String(r.status));
  r = await call('POST', `/api/clients/${id}/files?name=vacio`, Buffer.alloc(0), { 'Content-Type': 'application/octet-stream', 'X-Space-Upload': '1' }); ok('rechaza un archivo vacío', r.status === 400, String(r.status));
  r = await call('POST', `/api/clients/${id}/files?name=x`, Buffer.from('x'), { 'Content-Type': 'application/octet-stream' }); ok('sin la cabecera propia se rechaza (CSRF)', r.status === 415, String(r.status));
  const out = await fetch(`${B}/api/clients/${id}/files`); ok('sin sesión no se ve nada', out.status === 401 || out.status === 403, String(out.status));
  r = await call('DELETE', `/api/clients/${id}/files/${f.id}`); r = await call('GET', `/api/clients/${id}/files`); ok('se puede quitar', (await r.json()).files.length === 1);
} finally {
  if (id) await q('delete from clients where id = $1', [id]);
  await q('delete from team_users where email = $1', [EMAIL]);
  await pool.end();
}
console.log(bad ? `${bad} fallos` : 'Todo bien'); process.exit(bad ? 1 : 0);
