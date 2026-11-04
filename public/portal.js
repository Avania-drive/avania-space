// Portal del cliente: su espacio con cuenta propia (responsable o miembro). Inicio, alta, datos, documentos y equipo.
import { el, api, toast, renderSection, openModal, askConfirm, toUrl, fmtDate } from './fields.js';
import { partOf, kpisNode, zonaCard } from './extra.js';
import { homeNodes, docsNodes, phasesNode, timelineNode, taskColumns } from './clientview.js';

const app = document.getElementById('app');
document.body.classList.add('cform', 'portal');
let me = null, formDef = null;
const main = el('main', { id: 'main', tabindex: '-1' });
const brand = () => el('span', { class: 'brandline' }, el('img', { class: 'logo-light', src: '/brand/avania-light.png', alt: 'avania', height: 24 }), el('img', { class: 'logo-dark', src: '/brand/avania-dark.png', alt: '', height: 24 }), el('b', {}, 'ESPACIO'));

function loginView(msg) {
  const err = el('div', { class: 'err', role: 'alert' }, msg || '');
  const email = el('input', { id: 'pe', name: 'email', type: 'email', autocomplete: 'username', required: true });
  const pw = el('input', { id: 'pp', name: 'password', type: 'password', autocomplete: 'current-password', required: true });
  app.replaceChildren(el('div', { class: 'center' }, el('form', { class: 'card', onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    try { await api('POST', '/api/p/login', { email: email.value, password: pw.value }); boot(); } catch (er) { err.textContent = er.message; pw.value = ''; }
  } }, brand(), el('h1', { style: 'margin-top:14px' }, 'Entra a tu espacio'),
  el('p', { class: 'muted' }, 'Con el correo y la contraseña que elegiste al recibir la invitación. Si no la tienes, pídenos que te la enviemos.'),
  el('label', { for: 'pe' }, 'Correo'), email, el('label', { for: 'pp' }, 'Contraseña'), pw, err, el('button', { class: 'btn', style: 'width:100%;margin-top:12px' }, 'Entrar'))));
  email.focus();
}

async function boot() {
  try { me = await api('GET', '/api/p/me'); } catch { return loginView(); }
  formDef ||= await api('GET', '/api/formdef');
  shell();
  route();
}

// Las páginas que ve el cliente las decide el superadministrador («Ver cliente» en la ficha); el servidor lo vuelve a comprobar en cada petición.
const pagesOf = () => { const v = me.views || {}; return [['inicio', 'Inicio'], ...(v.plan ? [['cronograma', 'Cronograma']] : []), ...(v.resultados ? [['resultados', 'Resultados']] : []), ...(v.personas ? [['datos', 'Mis datos']] : []),
  ...(v.zona ? [['zona', 'Área de influencia']] : []), ...(me.info?.length ? [['info', 'Información']] : []), ...(v.documentos ? [['documentos', 'Documentos']] : [])]; };
function shell() {
  const isResp = me.user.role === 'responsable';
  const nav = el('nav', { 'aria-label': 'Principal' }, [...pagesOf(), ['alta', 'Mi alta'], ...(isResp ? [['equipo', 'Mi equipo']] : [])].map(([k, t]) =>
    el('a', { href: k === 'alta' ? '/portal/alta' : `#/${k === 'inicio' ? '' : k}`, 'data-k': k }, t)));
  app.replaceChildren(
    el('a', { class: 'skip', href: '#main', onclick: (e) => { e.preventDefault(); main.focus(); } }, 'Saltar al contenido'),
    el('header', { class: 'top' }, el('div', { class: 'in' }, brand(),
      me.client.logo ? el('img', { src: `/api/p/logo?v=${me.client.logo}`, alt: '', height: 28, style: 'height:28px;border-radius:6px' }) : '', el('span', { class: 'cname' }, el('strong', {}, me.client.name)),
      el('span', { class: 'sp' }), nav,
      el('button', { class: 'btn ghost small', onclick: changePassword }, 'Contraseña'),
      el('button', { class: 'btn ghost small', onclick: async () => { await api('POST', '/api/p/logout'); me = null; loginView(); } }, 'Salir'))),
    main);
}
window.addEventListener('hashchange', () => me && route());

function route() {
  const k = (location.hash.replace(/^#\/?/, '') || 'inicio');
  const draw = { inicio: homeView, cronograma: planView, resultados: resultsView, datos: datosView, zona: zonaView, info: infoView, documentos: docsView, equipo: teamView }[k] || homeView;
  document.querySelectorAll('header nav a').forEach((a) => a.classList.toggle('on', a.dataset.k === (draw === homeView ? 'inicio' : k)));
  Promise.resolve(draw()).then(() => { window.scrollTo(0, 0); const h = main.querySelector('h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } })
    .catch((e) => (e.status === 401 ? loginView('Tu sesión ha caducado. Entra de nuevo.') : main.replaceChildren(el('div', { class: 'banner', role: 'alert' }, e.message))));
}

async function homeView() {
  const h = await api('GET', '/api/p/home');
  main.replaceChildren(...homeNodes(h, { firstName: (me.user.name || '').split(' ')[0],
    request: async (l, btn) => { btn.disabled = true; try { await api('POST', `/api/p/links/${l.id}/request`); toast('Hemos avisado a AVANIA'); homeView(); } catch (er) { toast(er.message); btn.disabled = false; } } }));
}

// Datos que edita el cliente: personas y contactos, horarios y fechas (la misma información del alta).
async function datosView() {
  const f = await api('GET', '/api/p/form');
  const dental = f.dental;
  const save = (key) => (p) => api('PUT', `/api/p/form/sections/${key}`, p);
  const part = (skey, keys, title) => renderSection(partOf(formDef, skey, keys, title, dental), f.sections[skey] || (f.sections[skey] = {}), { team: false, save: save(skey) });
  main.replaceChildren(el('h1', {}, 'Mis datos'), el('p', { class: 'muted' }, 'Todo se guarda solo. Es la misma información de vuestra alta, para tenerla al día. Los horarios y las fechas señaladas están en «Mi alta › Horarios».'),
    part('clinica', ['responsables', 'telefonos'], 'Personas y contactos'));
}

// Cronograma: todo lo que hacemos y cuándo, y lo próximo de cada parte.
async function planView() {
  const h = await api('GET', '/api/p/home');
  const goSection = (t) => (t.section === 'proceso' ? '#/cronograma' : `/portal/alta#${t.section}`);
  main.replaceChildren(el('h1', {}, 'Cronograma'), el('p', { class: 'muted' }, 'Los pasos por los que vamos pasando, desde los documentos de investigación hasta el lanzamiento de vuestra campaña.'),
    el('section', { class: 'card', style: 'margin:14px 0' }, phasesNode(h.fases, { viewer: 'cliente' })),
    el('section', { class: 'cgroup' }, el('h2', {}, 'Próximas acciones'), taskColumns(h.tasks, { href: goSection, mine: 'Vuestras', ours: 'Nuestras', limit: 5 })),
    el('section', { class: 'cgroup' }, el('h2', {}, 'Fechas'), el('div', { class: 'card' }, timelineNode(h.timeline || []))));
}

// Resultados: leads, citas y clientes de su campaña, leídos de su subcuenta de Avania Funnels.
async function resultsView() {
  const r = await api('GET', '/api/p/kpis');
  main.replaceChildren(el('h1', {}, 'Resultados'), el('p', { class: 'muted' }, 'Cómo va vuestra campaña en los últimos 30 días: cuántas personas nos escriben, cuántas llegan a cita y cuántas se convierten en clientes.'),
    r.connected ? kpisNode(r.kpis) : el('div', { class: 'card' }, el('p', { class: 'muted', style: 'margin:0' }, 'Todavía no hay resultados que enseñar. Aparecerán aquí en cuanto la campaña esté en marcha.')));
}

// Área de influencia: el mismo mapa y estudio de la zona que ve el equipo.
async function zonaView() {
  main.replaceChildren(el('h1', {}, 'Área de influencia'), el('p', { class: 'muted' }, 'La zona en la que trabajamos para vuestra campaña, con sus localidades y los datos de población y renta.'));
  zonaCard(main, null, { url: '/api/p/zona', title: 'Mapa y estudio de la zona' });
}

// Información que AVANIA ha decidido enseñaros (solo lectura).
async function infoView() {
  const { sections } = await api('GET', '/api/p/shared');
  const noSave = async () => ({});
  main.replaceChildren(el('h1', {}, 'Información'), el('p', { class: 'muted' }, 'Lo que AVANIA ha preparado para vosotros. Es de solo lectura.'),
    ...sections.map(({ def, data }) => renderSection(def, data, { team: false, save: noSave })));
  main.querySelectorAll('button, input, select, textarea').forEach((x) => { x.disabled = true; });
}

async function docsView() {
  main.replaceChildren(...docsNodes(await api('GET', '/api/p/home'), { loadFiles: () => api('GET', '/api/p/drive') }));
}

async function teamView() {
  if (me.user.role !== 'responsable') return homeView();
  const draw = async () => {
    const { users } = await api('GET', '/api/p/team');
    const email = el('input', { id: 'te', name: 'email', type: 'email', placeholder: 'correo@empresa.com', required: true, 'aria-label': 'Correo' });
    const name = el('input', { id: 'tn', name: 'nombre', placeholder: 'Nombre', 'aria-label': 'Nombre' });
    const err = el('div', { class: 'err', role: 'alert' });
    main.replaceChildren(el('h1', {}, 'Mi equipo'),
      el('p', { class: 'muted' }, 'Las personas de vuestra empresa con acceso a este espacio. Los miembros rellenan y consultan, pero no ven los accesos. Les llegará un correo para elegir su contraseña.'),
      el('div', { class: 'card', style: 'margin:14px 0' }, el('div', { class: 'plist' }, users.map((u) => el('div', { class: 'prow' },
        el('span', { class: 'grow' }, el('strong', {}, u.name || u.email), el('small', { class: 'muted', style: 'display:block' }, `${u.email} · ${u.role === 'responsable' ? 'Responsable' : 'Miembro'}${u.pending ? ' · invitación pendiente' : ''}${u.active ? '' : ' · sin acceso'}`)),
        u.role === 'miembro' ? [
          u.pending && u.active ? el('button', { class: 'btn ghost small', onclick: async () => { const r = await api('PATCH', `/api/p/team/${u.id}`, { resend_invite: true }); toast(r.invite === 'sent' ? 'Invitación reenviada' : 'No se pudo enviar el correo'); } }, 'Reenviar') : '',
          el('button', { class: 'btn ghost small', onclick: async () => { await api('PATCH', `/api/p/team/${u.id}`, { active: !u.active }); draw(); } }, u.active ? 'Quitar acceso' : 'Dar acceso'),
          el('button', { class: 'btn ghost small danger', onclick: async () => { if (await askConfirm({ title: 'Eliminar usuario', text: `Se elimina a ${u.name || u.email} de vuestro equipo.`, ok: 'Eliminar', danger: true })) { await api('DELETE', `/api/p/team/${u.id}`); draw(); } } }, 'Eliminar')] : '')))),
      el('form', { class: 'card', onsubmit: async (e) => {
        e.preventDefault(); err.textContent = '';
        try { const r = await api('POST', '/api/p/team', { email: email.value, name: name.value }); toast(r.email_sent ? 'Invitación enviada' : 'Creado, pero no se pudo enviar el correo'); draw(); } catch (er) { err.textContent = er.message; }
      } }, el('h2', { style: 'margin-top:0' }, 'Invitar a alguien'), el('label', { for: 'te' }, 'Correo'), email, el('label', { for: 'tn' }, 'Nombre (opcional)'), name, err,
      el('button', { class: 'btn', style: 'margin-top:12px' }, 'Enviar invitación')));
  };
  await draw();
}

function changePassword() {
  const cur = el('input', { id: 'cp0', name: 'actual', type: 'password', autocomplete: 'current-password', required: true });
  const a = el('input', { id: 'cp1', name: 'nueva', type: 'password', autocomplete: 'new-password', required: true, minlength: 12 });
  const b = el('input', { id: 'cp2', name: 'repetir', type: 'password', autocomplete: 'new-password', required: true, minlength: 12 });
  const err = el('div', { class: 'err', role: 'alert' });
  const card = el('form', { class: 'card', onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    if (a.value !== b.value) return (err.textContent = 'Las dos contraseñas no coinciden');
    try { await api('POST', '/api/p/password', { current: cur.value, password: a.value }); d.close(true); toast('Contraseña cambiada'); } catch (er) { err.textContent = er.message; }
  } }, el('h2', {}, 'Cambiar contraseña'), el('label', { for: 'cp0' }, 'Contraseña actual'), cur, el('label', { for: 'cp1' }, 'Contraseña nueva (mínimo 12 caracteres)'), a, el('label', { for: 'cp2' }, 'Repítela'), b, err,
  el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => d.close(false) }, 'Cancelar'), el('button', { class: 'btn' }, 'Guardar')));
  const d = openModal(card, { label: 'Cambiar contraseña' });
}

boot();
