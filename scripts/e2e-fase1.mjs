// Prueba de la fase 1 del esquema: plantilla de alta por categoría, notas, enlaces, tipos de enlace y panel.
import 'dotenv/config';
import { q, pool } from '../src/db.js';
import { hashPassword } from '../src/crypto.js';
const B = 'http://127.0.0.1:3003';
const mk = () => { let c = ''; return async (m, u, b) => { const r = await fetch(B + u, { method: m, headers: { 'Content-Type': 'application/json', cookie: c }, body: b ? JSON.stringify(b) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) c = sc.split(';')[0]; let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; }; };
const ok = (n, c, extra = '') => console.log((c ? 'OK  ' : 'FALLA ') + n + (c ? '' : ' ' + extra));
await q("delete from team_users where email like 'test-%@example.invalid'");
for (const [e, r] of [['test-admin@example.invalid', 'admin'], ['test-member@example.invalid', 'member']])
  await q('insert into team_users (email,name,role,password_hash,must_change_password) values ($1,$1,$2,$3,false)', [e, r, hashPassword('contraseña-de-prueba-1')]);
const A = mk(), M = mk(), C = mk();
await A('POST', '/api/login', { email: 'test-admin@example.invalid', password: 'contraseña-de-prueba-1' });
await M('POST', '/api/login', { email: 'test-member@example.invalid', password: 'contraseña-de-prueba-1' });
await q("insert into categories (name, sections) values ('Prueba industrial', array['proyecto','clinica','meta','cierre']) on conflict (name) do update set sections = excluded.sections");
const cl = (await A('POST', '/api/clients', { name: 'Empresa Industrial Prueba' })).j.client;
await A('PUT', `/api/clients/${cl.id}/sections/proyecto`, { categoria: 'Prueba industrial' });
const d = (await A('GET', `/api/clients/${cl.id}`)).j;
ok('plantilla: la categoría limita las secciones', JSON.stringify(d.allowed) === JSON.stringify(['proyecto', 'clinica', 'meta', 'cierre']), JSON.stringify(d.allowed));
ok('plantilla: no es dental', d.dental === false);
ok('plantilla: puertas solo de lo que lleva (meta, píxel, credenciales)', d.gates.map((g) => g.key).join() === 'meta,pixel,credenciales', d.gates.map((g) => g.key).join());
ok('plantilla: el progreso no cuenta secciones ajenas', !Object.keys(d.progress.sections).includes('rodaje'));
const pub = (await C('GET', `/api/f/${cl.token}`)).j;
ok('enlace del cliente recibe su plantilla', Array.isArray(pub.allowed) && pub.dental === false);
ok('member NO cambia plantillas', (await M('PUT', '/api/categories/Prueba industrial', { sections: null })).s === 403);
ok('admin cambia plantilla (proyecto siempre incluido)', (await A('PUT', '/api/categories/Prueba industrial', { sections: ['meta'] })).j.category.sections.join() === 'proyecto,meta');
ok('secciones inventadas se descartan', (await A('PUT', '/api/categories/Prueba industrial', { sections: ['meta', 'nada'] })).j.category.sections.join() === 'proyecto,meta');
// pasos del cliente por categoría
await q("update categories set statuses = array['onboarding','montaje','activa','pausada'] where name = 'Prueba industrial'");
ok('el detalle trae los pasos de su categoría', (await A('GET', `/api/clients/${cl.id}`)).j.statuses.join() === 'onboarding,montaje,activa,pausada');
ok('paso que la categoría no tiene → 400', (await A('PATCH', `/api/clients/${cl.id}`, { status: 'rodaje' })).s === 400);
ok('paso de su categoría → 200', (await A('PATCH', `/api/clients/${cl.id}`, { status: 'montaje' })).s === 200);
ok('estado inventado → 400', (await A('PATCH', `/api/clients/${cl.id}`, { status: 'nada' })).s === 400);
ok('admin cambia los pasos (siempre incluye «activa»)', (await A('PUT', '/api/categories/Prueba industrial', { statuses: ['onboarding', 'rodaje'] })).j.category.statuses.join() === 'onboarding,rodaje,activa');
ok('member NO cambia los pasos', (await M('PUT', '/api/categories/Prueba industrial', { statuses: ['onboarding'] })).s === 403);
ok('sin categoría los pasos son los de la clínica', (await A('GET', '/api/clients')).j.clients.every((c) => c.statuses.length >= 3));
// objetivos y datos para medir (solo equipo)
await A('PUT', '/api/categories/Prueba industrial', { sections: ['proyecto', 'negocio'] });
ok('el equipo guarda objetivos y datos para medir', (await A('PUT', `/api/clients/${cl.id}/sections/negocio`, { valor_medio: '1200', etapas: [{ etapa: 'Nuevo Lead', paso: 'Nuevo lead' }] })).j.data.valor_medio === '1200');
await C('PUT', `/api/f/${cl.token}/sections/negocio`, { valor_medio: '1' });
const neg = (await C('GET', `/api/f/${cl.token}`)).j.sections.negocio || {};
ok('el cliente ve los objetivos pero no puede cambiarlos ni ve el pipeline', neg.valor_medio === '1200' && !('etapas' in neg) && !('pipeline_id' in neg), JSON.stringify(neg));
// privacidad: lo que es solo de la agencia no llega al cliente
await A('PUT', `/api/clients/${cl.id}/sections/whatsapp`, { setex_numero: '600111222', setex_enlace: 'https://setter.goavania.com/privado', wa_numero: '600999888' });
const pub2 = JSON.stringify((await C('GET', `/api/f/${cl.token}`)).j);
ok('el cliente NO recibe la sección «Antes de empezar»', !('proyecto' in JSON.parse(pub2).sections));
ok('el cliente NO recibe campos de agencia dentro de sus secciones', !pub2.includes('600111222') && !pub2.includes('privado') && pub2.includes('600999888'));
ok('al guardar, tampoco se los devolvemos', !JSON.stringify((await C('PUT', `/api/f/${cl.token}/sections/whatsapp`, { wa_numero: '600777666' })).j).includes('600111222'));
ok('el cliente no puede escribir en campos de agencia', (await C('PUT', `/api/f/${cl.token}/sections/whatsapp`, { setex_numero: 'HACK' }), ((await A('GET', `/api/clients/${cl.id}`)).j.sections.whatsapp || {}).setex_numero === '600111222'));
// zona restringida: Web y Google (accesos) y Meta solo con la contraseña de la cuenta recién escrita
await A('POST', '/api/reauth', { password: 'contraseña-de-prueba-1' });
ok('con contraseña reciente se guardan datos de Meta', (await A('PUT', `/api/clients/${cl.id}/sections/meta`, { presupuesto: '500 € al mes', bm_id: '999888777' })).s === 200);
ok('con contraseña reciente el detalle los trae', ((await A('GET', `/api/clients/${cl.id}`)).j.sections.meta || {}).bm_id === '999888777');
await q("update sessions set reauth_until = now() - interval '1 minute' where user_id = (select id from team_users where email='test-admin@example.invalid')");
const locked = (await A('GET', `/api/clients/${cl.id}`)).j;
ok('sin contraseña reciente el detalle NO trae valores de Meta ni de Web y Google', locked.restricted === true && !JSON.stringify(locked.sections).includes('999888777') && !JSON.stringify(locked.sections.meta).includes('presupuesto'), JSON.stringify(locked.sections.meta));
ok('las puertas de lanzamiento siguen calculándose', Array.isArray(locked.gates) && locked.gates.length > 0);
ok('/restricted → password_required', (await A('GET', `/api/clients/${cl.id}/restricted`)).j.code === 'password_required');
ok('guardar en Meta sin contraseña reciente → 403', (await A('PUT', `/api/clients/${cl.id}/sections/meta`, { bm_id: 'X' })).j.code === 'password_required');
ok('guardar en Web y Google sin contraseña reciente → 403', (await A('PUT', `/api/clients/${cl.id}/sections/accesos`, { dominio: 'x.es' })).j.code === 'password_required');
ok('el resto de secciones no pide contraseña', (await A('PUT', `/api/clients/${cl.id}/sections/clinica`, { web: 'https://x.test' })).s === 200);
await A('POST', '/api/reauth', { password: 'contraseña-de-prueba-1' });
ok('tras escribir la contraseña, /restricted devuelve los datos', ((await A('GET', `/api/clients/${cl.id}/restricted`)).j.sections.meta || {}).bm_id === '999888777');
// notas
const n = (await A('POST', `/api/clients/${cl.id}/notes`, { body: 'Prefieren WhatsApp', visible: false })).j.note;
ok('crea nota interna', n?.visible === false && n.author);
ok('nota vacía → 400', (await A('POST', `/api/clients/${cl.id}/notes`, { body: '  ' })).s === 400);
ok('marca la nota visible para el cliente', (await M('PATCH', `/api/notes/${n.id}`, { visible: true })).j.note.visible === true);
ok('lista notas', (await A('GET', `/api/clients/${cl.id}/notes`)).j.notes.length === 1);
ok('el enlace del cliente NO expone notas internas', !JSON.stringify(pub).includes('Prefieren'));
// enlaces
ok('tipo de enlace inexistente → 400', (await A('POST', `/api/clients/${cl.id}/links`, { type: 'Inventado' })).s === 400);
const l = (await A('POST', `/api/clients/${cl.id}/links`, { type: 'ClickUp', url: 'https://app.clickup.com/x', login_url: 'javascript:alert(1)', has_access: 'si' })).j.link;
ok('crea enlace; el login_url peligroso se descarta', l?.url === 'https://app.clickup.com/x' && l.login_url === null && l.has_access === 'si', JSON.stringify(l));
ok('edita enlace', (await M('PUT', `/api/links/${l.id}`, { visible: true, has_access: 'no' })).j.link.has_access === 'no');
ok('member NO crea tipos de enlace', (await M('PUT', '/api/link-types', { name: 'X' })).s === 403);
ok('admin crea tipo de enlace', (await A('PUT', '/api/link-types', { name: 'Prueba tipo', login_url: 'https://example.com' })).s === 200);
ok('tipo con login no https → 400', (await A('PUT', '/api/link-types', { name: 'Malo', login_url: 'ftp://x' })).s === 400);
await A('DELETE', '/api/link-types/Prueba%20tipo');
// panel
const dash = (await A('GET', '/api/dashboard')).j;
ok('panel devuelve totales, incompletas y pendientes', dash.totals?.clients >= 1 && dash.incomplete.some((x) => x.id === cl.id) && Array.isArray(dash.pending));
await q('delete from clients where id=$1', [cl.id]);
await q("delete from categories where name='Prueba industrial'");
await q("delete from team_users where email like 'test-%@example.invalid'");
await pool.end();
