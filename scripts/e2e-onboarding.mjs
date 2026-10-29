// Prueba del onboarding en cinco áreas: avance por áreas, tareas, cronograma, lo que ve el cliente y el cierre con informe.
// Crea un cliente de prueba y usuarios de prueba (todo se borra al final). No envía correos ni toca datos de clientes reales.
import 'dotenv/config';
import { q, pool } from '../src/db.js';
import { hashPassword } from '../src/crypto.js';
const B = 'http://127.0.0.1:3003';
const mk = () => { let c = ''; return async (m, u, b) => { const r = await fetch(B + u, { method: m, headers: { 'Content-Type': 'application/json', cookie: c }, body: b ? JSON.stringify(b) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) c = sc.split(';')[0]; let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; }; };
let bad = 0;
const ok = (n, c, extra = '') => { if (!c) bad++; console.log((c ? 'OK  ' : 'FALLA ') + n + (c ? '' : ' ' + extra)); };
const EMAIL = 'test-onboarding@example.invalid';
await q('delete from team_users where email = $1', [EMAIL]);
await q("insert into team_users (email,name,role,password_hash,must_change_password) values ($1,'Prueba onboarding','admin',$2,false)", [EMAIL, hashPassword('contraseña-de-prueba-1')]);
const A = mk(), C = mk();
await A('POST', '/api/login', { email: EMAIL, password: 'contraseña-de-prueba-1' });
let cl;
try {
  cl = (await A('POST', '/api/clients', { name: 'Empresa Prueba Onboarding' })).j.client;
  const d = (await A('GET', `/api/clients/${cl.id}`)).j;
  ok('cinco áreas en orden', d.progress.areas.map((a) => a.key).join() === 'empresa,mercado,tecnico,cronograma,nosotros', d.progress.areas.map((a) => a.key).join());
  ok('avance del cliente y de AVANIA por separado', typeof d.progress.pct === 'number' && typeof d.progress.team.pct === 'number');
  ok('secciones numeradas por área', d.progress.areas.length === 5);
  ok('hay tareas del cliente y de AVANIA, con prioridad', d.tasks.some((t) => t.who === 'cliente') && d.tasks.some((t) => t.who === 'avania') && d.tasks.every((t) => ['alta', 'media', 'baja'].includes(t.priority)));
  ok('orden: alta antes que media', d.tasks.findIndex((t) => t.priority === 'media') === -1 || d.tasks.findIndex((t) => t.priority === 'alta') < d.tasks.findIndex((t) => t.priority === 'media'));
  ok('estado de cierre presente', d.onboarding && d.onboarding.client_done === false && d.onboarding.team_done_at === null && d.onboarding.report_to);

  // La agencia rellena sus partes
  await A('PUT', `/api/clients/${cl.id}/sections/proyecto`, { fecha_inicio: '2026-10-20', enlace_drive: 'https://drive.google.com/drive/folders/abc' });
  await A('PUT', `/api/clients/${cl.id}/sections/avania`, { personas: [{ nombre: 'Persona AVANIA', rol: 'Cuentas', responsabilidades: 'Reunión de onboarding', correo: 'a@example.invalid', telefono: '600000000' }], como_contactar: 'Por WhatsApp' });
  await A('PUT', `/api/clients/${cl.id}/sections/cronograma`, {
    acciones_avania: [{ accion: 'Enviar propuesta de anuncios', fecha: '2026-11-03', prioridad: 'Alta', estado: 'Pendiente' }, { accion: 'Crear carpeta', fecha: '2026-10-21', prioridad: 'Baja', estado: 'Hecha' }],
    acciones_cliente: [{ accion: 'Enviar fotos del equipo', fecha: '2020-01-01', prioridad: 'Media', estado: 'Pendiente' }] });
  const d2 = (await A('GET', `/api/clients/${cl.id}`)).j;
  ok('tarea manual con fecha aparece', d2.tasks.some((t) => t.title === 'Enviar propuesta de anuncios' && t.due === '2026-11-03'));
  ok('tarea hecha no aparece', !d2.tasks.some((t) => t.title === 'Crear carpeta'));
  ok('tarea vencida sube a prioridad alta', d2.tasks.some((t) => t.title === 'Enviar fotos del equipo' && t.overdue && t.priority === 'alta'));
  const dates = d2.timeline.map((t) => t.date).filter(Boolean);
  ok('cronograma ordenado por fecha, con inicio y objetivo de 20 días', dates.join() === [...dates].sort().join() && d2.timeline.some((t) => t.label === 'Inicio del proyecto') && d2.timeline.some((t) => t.date === '2026-11-17' && /laborables/.test(t.label)));
  ok('cronograma marca lo pasado', d2.timeline.find((t) => t.label === 'Enviar fotos del equipo').past === true);

  await A('PUT', `/api/clients/${cl.id}/sections/oferta`, { avatar_resumen: 'Familias jóvenes' });
  await A('PUT', `/api/clients/${cl.id}/sections/negocio`, { valor_medio: '500', pipeline_id: 'p-interno', etapas: [{ etapa: 'Nuevo', paso: 'Nuevo lead' }] });
  // Lo que ve el cliente (enlace sin cuenta)
  const f = (await C('GET', `/api/f/${cl.token}`)).j;
  ok('cliente: no recibe el avance interno de AVANIA', f.progress.team === undefined && f.progress.sectionsTeam === undefined);
  ok('cliente: ve las cinco áreas', f.progress.areas.length === 5 && f.progress.areas.every((a) => a.team === undefined));
  ok('cliente: no ve la sección interna de proyecto', !('proyecto' in f.sections));
  ok('cliente: ve análisis y objetivos, pero no el pipeline', 'oferta' in f.sections && 'negocio' in f.sections && !('pipeline_id' in f.sections.negocio) && !('etapas' in f.sections.negocio));
  ok('cliente: ve quién es quién (solo lectura)', f.sections.avania?.personas?.[0]?.nombre === 'Persona AVANIA' && f.sections.avania.como_contactar === 'Por WhatsApp');
  ok('cliente: ve las acciones de AVANIA', f.sections.cronograma?.acciones_avania?.length === 2);
  ok('cliente: sus tareas y las de AVANIA visibles, sin lo interno', f.tasks.every((t) => t.client_visible && t.kind === undefined) && !f.tasks.some((t) => /Proyecto y enlaces/.test(t.title)));
  ok('cliente: cronograma incluido', f.timeline.length >= 3);
  const w1 = await C('PUT', `/api/f/${cl.token}/sections/avania`, { personas: [{ nombre: 'Intruso' }] });
  const w2 = await C('PUT', `/api/f/${cl.token}/sections/cronograma`, { acciones_avania: [{ accion: 'Manipulada' }], acciones_cliente: [{ accion: 'Mandar el logo', fecha: '2026-11-05', prioridad: 'Alta', estado: 'En curso' }] });
  const after = (await A('GET', `/api/clients/${cl.id}`)).j.sections;
  ok('cliente no puede cambiar el equipo de AVANIA', after.avania.personas[0].nombre === 'Persona AVANIA');
  ok('cliente no puede cambiar las acciones de AVANIA', after.cronograma.acciones_avania.length === 2 && after.cronograma.acciones_avania[0].accion !== 'Manipulada');
  ok('cliente sí guarda sus propias acciones', after.cronograma.acciones_cliente[0].accion === 'Mandar el logo');
  await C('PUT', `/api/f/${cl.token}/sections/oferta`, { avatar_resumen: 'x' });
  await C('PUT', `/api/f/${cl.token}/sections/negocio`, { valor_medio: '999', pipeline_id: 'x' });
  const w4 = (await A('GET', `/api/clients/${cl.id}`)).j.sections;
  ok('cliente no puede escribir en análisis ni objetivos', w4.oferta.avatar_resumen === 'Familias jóvenes' && w4.negocio.valor_medio === '500' && w4.negocio.pipeline_id === 'p-interno');
  const w3 = await C('PUT', `/api/f/${cl.token}/sections/proyecto`, { responsable_cuenta: 'x' });
  ok('cliente no puede escribir en lo interno', w3.s === 404);

  // Mercado y marca
  await C('PUT', `/api/f/${cl.token}/sections/mercado`, { clientes_tipo: [{ tipo: 'Familias', quien: '30-45', busca: 'Revisión', gasto: '300' }], competidores: [{ nombre: 'Competidor X' }], ofertas: [{ oferta: 'Primera visita', precio: '0 €' }] });
  await C('PUT', `/api/f/${cl.token}/sections/materiales`, { logos: [{ nombre: 'Logo principal', url: 'https://drive.google.com/file/d/1' }], tipografias: 'Inter' });
  await C('PUT', `/api/f/${cl.token}/sections/clinica`, { fecha_apertura: '2012-05-14', responsables: [{ nombre: 'Titular', telefono: '600111222' }] });
  const m = (await A('GET', `/api/clients/${cl.id}`)).j;
  ok('mercado, marca y fecha de apertura se guardan', m.sections.mercado.competidores[0].nombre === 'Competidor X' && m.sections.materiales.logos[0].url && m.sections.clinica.fecha_apertura === '2012-05-14');
  ok('el avance sube al rellenar', m.progress.areas.find((a) => a.key === 'mercado').client.pct > 0);

  // Equipo de AVANIA
  const ppl = (await A('GET', '/api/agency-people')).j.people;
  ok('directorio del equipo AVANIA sembrado', ppl.length >= 1);
  const added = (await A('POST', `/api/clients/${cl.id}/load-agency-people`)).j;
  const again = (await A('POST', `/api/clients/${cl.id}/load-agency-people`)).j;
  ok('cargar el equipo añade sin duplicar ni borrar', added.added >= 0 && again.added === 0 && added.data.personas.some((p) => p.nombre === 'Persona AVANIA'));

  // Informe: vista previa (no envía) y sin secretos
  await A('POST', '/api/reauth', { password: 'contraseña-de-prueba-1' });
  const cr = await A('POST', `/api/clients/${cl.id}/credentials`, { service: 'Hosting', password: 'SECRETO-DE-PRUEBA-123' });
  ok('credencial de prueba creada', cr.s === 200, cr.s);
  const rep = await A('GET', `/api/clients/${cl.id}/report`);
  ok('informe: se genera', rep.s === 200 && /Informe de onboarding/.test(rep.j.html) && /Para la reunión de onboarding/.test(rep.j.html), rep.s);
  ok('informe: incluye datos del cliente, tareas y cronograma', /Competidor X/.test(rep.j.html) && /Mandar el logo/.test(rep.j.html) && /Enviar propuesta de anuncios/.test(rep.j.html));
  ok('informe: no contiene contraseñas', !/SECRETO-DE-PRUEBA/.test(rep.j.html));

  // Cierre: no se envía nada hasta que terminan los dos (el correo real no se prueba aquí)
  const nodone = await A('GET', `/api/clients/${cl.id}`);
  ok('no hay informe enviado todavía', nodone.j.onboarding.report_sent_at === null);
} finally {
  if (cl) await q('delete from clients where id = $1', [cl.id]);
  await q('delete from team_users where email = $1', [EMAIL]);
  await pool.end();
}
console.log(bad ? `\n${bad} FALLO(S)` : '\nTodo en verde');
process.exit(bad ? 1 : 0);
