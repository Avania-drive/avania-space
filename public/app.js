import { el, api, toast, renderSection, renderCredentials, helpBlock } from './fields.js';

const app = document.getElementById('app');
let me = null, formDef = null, ayuda = {};
const ROLE = { super_admin: 'Superadministrador', admin: 'Administrador', member: 'Miembro' };
const STATUS = { onboarding: 'Onboarding', rodaje: 'Rodaje', formacion: 'Formación', activa: 'Campaña activa', pausada: 'Pausada' };

// ───────── Entrada ─────────
async function boot() {
  try { me = (await api('GET', '/api/me')).user; } catch { return loginView(); }
  if (me.must_change_password) return passwordView(true);
  [formDef, ayuda] = await Promise.all([api('GET', '/api/formdef'), fetch('/ayuda.json').then((r) => r.json()).catch(() => ({}))]);
  shell();
  route();
}
window.addEventListener('hashchange', () => me && !me.must_change_password && route());

function brand() {
  return el('span', { class: 'brandline' }, el('img', { class: 'logo-light', src: '/brand/avania-light.png', alt: 'Avania' }),
    el('img', { class: 'logo-dark', src: '/brand/avania-dark.png', alt: 'Avania' }), el('b', {}, 'SPACE'));
}

function loginView() {
  const err = el('div', { class: 'err' });
  const email = el('input', { type: 'email', autocomplete: 'username', required: true });
  const pw = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const go = async (e) => {
    e.preventDefault(); err.textContent = '';
    try { await api('POST', '/api/login', { email: email.value, password: pw.value }); boot(); } catch (er) { err.textContent = er.message; }
  };
  app.replaceChildren(el('div', { class: 'center' }, el('form', { class: 'card', onsubmit: go },
    brand(), el('h1', { style: 'margin-top:14px' }, 'Acceso del equipo'),
    el('label', {}, 'Correo'), email, el('label', {}, 'Contraseña'), pw, err,
    el('button', { class: 'btn', style: 'width:100%;margin-top:12px' }, 'Entrar'))));
}

function passwordView(forced) {
  const err = el('div', { class: 'err' });
  const cur = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const n1 = el('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: 12 });
  const n2 = el('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: 12 });
  const go = async (e) => {
    e.preventDefault(); err.textContent = '';
    if (n1.value !== n2.value) { err.textContent = 'Las contraseñas no coinciden'; return; }
    try { await api('POST', '/api/password', { current: cur.value, next: n1.value }); toast('Contraseña cambiada'); forced ? boot() : (location.hash = '#/'); }
    catch (er) { err.textContent = er.message; }
  };
  const card = el('form', { class: 'card', onsubmit: go },
    brand(), el('h1', { style: 'margin-top:14px' }, forced ? 'Elige tu contraseña' : 'Cambiar contraseña'),
    forced ? el('p', { class: 'muted' }, 'La que te dimos era temporal. Usa al menos 12 caracteres.') : '',
    el('label', {}, forced ? 'Contraseña temporal' : 'Contraseña actual'), cur,
    el('label', {}, 'Nueva contraseña (mínimo 12 caracteres)'), n1, el('label', {}, 'Repite la nueva'), n2, err,
    el('button', { class: 'btn', style: 'width:100%;margin-top:12px' }, 'Guardar'));
  if (forced) app.replaceChildren(el('div', { class: 'center' }, card));
  else return card;
}

// ───────── Estructura ─────────
const view = el('main');
function shell() {
  const link = (h, t) => el('a', { href: h, 'data-h': h }, t);
  app.replaceChildren(
    el('header', { class: 'top' }, el('div', { class: 'in' }, brand(),
      el('nav', {}, link('#/', 'Clientes'), me.role === 'super_admin' ? link('#/equipo', 'Equipo') : '', link('#/seguridad', 'Seguridad')),
      el('span', { class: 'sp' }), el('span', { class: 'muted' }, `${me.name || me.email} · ${ROLE[me.role]}`),
      el('button', { class: 'btn ghost small', onclick: async () => { await api('POST', '/api/logout'); me = null; loginView(); } }, 'Salir'))),
    view);
}

function route() {
  const h = location.hash || '#/';
  document.querySelectorAll('.top nav a').forEach((a) => a.classList.toggle('on', a.dataset.h === h || (a.dataset.h === '#/' && h.startsWith('#/c/'))));
  const [, a, b, c] = h.split('/');
  const run = !a ? clientsView() : a === 'c' ? clientView(b, c || 'proyecto') : a === 'equipo' ? teamView() : a === 'seguridad' ? securityView() : clientsView();
  Promise.resolve(run).catch((e) => view.replaceChildren(el('div', { class: 'banner' }, e.message)));
}

// Pide el código de 6 cifras; resuelve true si queda verificado.
function askCode() {
  return new Promise((resolve) => {
    const err = el('div', { class: 'err' });
    const inp = el('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, placeholder: '000000', style: 'width:100%;font-size:20px;letter-spacing:6px;text-align:center' });
    const close = (v) => { m.remove(); resolve(v); };
    const m = el('div', { class: 'modal' }, el('form', { class: 'card', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      try { await api('POST', '/api/mfa/verify', { code: inp.value }); close(true); } catch (er) { err.textContent = er.message; if (er.code === 'no_mfa') { close(false); location.hash = '#/seguridad'; } }
    } }, el('h2', {}, 'Verificación en dos pasos'), el('p', { class: 'muted' }, 'Introduce el código de tu app de autenticación. Será válido 10 minutos.'),
    inp, err, el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => close(false) }, 'Cancelar'), el('button', { class: 'btn' }, 'Verificar'))));
    document.body.append(m); inp.focus();
  });
}

// ───────── Clientes ─────────
async function clientsView() {
  const { clients } = await api('GET', '/api/clients');
  let filter = '', st = '', showArch = false;
  const tbody = el('tbody');
  const draw = () => {
    const rows = clients.filter((c) => (showArch || !c.archived) && (!st || c.status === st)
      && `${c.name} ${c.city || ''} ${c.account_manager || ''}`.toLowerCase().includes(filter.toLowerCase()));
    tbody.replaceChildren(...rows.map((c) => el('tr', { onclick: () => (location.hash = `#/c/${c.id}`) },
      el('td', {}, el('strong', {}, c.name), c.archived ? el('span', { class: 'pill', style: 'margin-left:6px' }, 'archivado') : ''),
      el('td', {}, c.city || '—'), el('td', {}, c.account_manager || '—'),
      el('td', {}, el('span', { class: 'pill' }, STATUS[c.status])),
      el('td', {}, el('div', { class: 'row' }, el('div', { class: 'bar', style: 'width:90px' }, el('i', { style: `width:${c.progress}%` })), `${c.progress}%`)),
      el('td', {}, credPills(c.credentials)),
      el('td', {}, c.start_date ? c.start_date.slice(0, 10) : '—'))));
    if (!rows.length) tbody.append(el('tr', {}, el('td', { colspan: 7, class: 'muted' }, 'No hay clientes con ese filtro.')));
  };
  view.replaceChildren(
    el('div', { class: 'row', style: 'margin-bottom:12px' }, el('h1', { class: 'grow' }, `Clientes (${clients.filter((c) => !c.archived).length})`),
      el('input', { placeholder: 'Buscar…', oninput: (e) => { filter = e.target.value; draw(); } }),
      el('select', { onchange: (e) => { st = e.target.value; draw(); } }, el('option', { value: '' }, 'Todos los estados'), Object.entries(STATUS).map(([k, v]) => el('option', { value: k }, v))),
      el('label', { class: 'row muted' }, el('input', { type: 'checkbox', onchange: (e) => { showArch = e.target.checked; draw(); } }), 'Archivados'),
      el('button', { class: 'btn', onclick: newClient }, '+ Nuevo cliente')),
    el('div', { class: 'scroll' }, el('table', { class: 't click' },
      el('thead', {}, el('tr', {}, ['Clínica', 'Ciudad', 'Responsable', 'Estado', 'Onboarding', 'Credenciales', 'Inicio'].map((h) => el('th', {}, h)))), tbody)));
  draw();
}

function credPills(c) {
  const total = c.pendiente + c.recibida + c.verificada;
  if (!total) return el('span', { class: 'muted' }, '—');
  return el('span', {}, el('span', { class: 'pill ok' }, `${c.verificada} ✓`), ' ', el('span', { class: 'pill' }, `${c.recibida} rec.`), ' ', el('span', { class: 'pill warn' }, `${c.pendiente} pend.`));
}

async function newClient() {
  const name = (prompt('Nombre de la clínica') || '').trim();
  if (!name) return;
  const city = (prompt('Ciudad (opcional)') || '').trim();
  try { const { client } = await api('POST', '/api/clients', { name, city }); location.hash = `#/c/${client.id}`; } catch (e) { toast(e.message); }
}

// ───────── Ficha del cliente ─────────
async function clientView(id, tab) {
  const { client, sections, progress } = await api('GET', `/api/clients/${id}`);
  const link = `${location.origin}/f/${client.token}`;
  const tabs = [...formDef.form.map((s) => ({ key: s.key, title: `${s.num}. ${s.title}`, sec: s })), { key: 'credenciales', title: '🔐 Credenciales' }, ...(me.can_see_passwords ? [{ key: 'registro', title: 'Registro de accesos' }] : [])];
  const t = tabs.find((x) => x.key === tab) || tabs[0];
  const main = el('div', {});
  main.append(el('h2', {}, t.title), helpBlock(ayuda[t.key]) || '');
  if (t.sec) {
    main.append(renderSection(t.sec, sections[t.key] || (sections[t.key] = {}), { team: true, save: (p) => api('PUT', `/api/clients/${id}/sections/${t.key}`, p) }));
  } else if (t.key === 'credenciales') {
    const box = el('div'); main.append(box);
    if (me.can_see_passwords && !me.mfa_enabled) main.prepend(el('div', { class: 'banner' }, 'Para ver o copiar contraseñas activa la doble verificación en ', el('a', { href: '#/seguridad' }, 'Seguridad'), '.'));
    if (!me.can_see_passwords) main.prepend(el('div', { class: 'banner' }, 'Tu rol puede añadir y editar credenciales, pero no ver las contraseñas guardadas.'));
    renderCredentials(box, {
      mode: 'team', services: formDef.services, canSee: me.can_see_passwords,
      list: () => api('GET', `/api/clients/${id}/credentials`),
      create: (b) => api('POST', `/api/clients/${id}/credentials`, b),
      update: (cid, b) => api('PUT', `/api/credentials/${cid}`, b),
      remove: me.can_see_passwords ? (cid) => api('DELETE', `/api/credentials/${cid}`) : null,
      reveal: (cid, copy) => api('POST', `/api/credentials/${cid}/reveal`, { copy }),
      askCode,
    });
  } else {
    const { log } = await api('GET', `/api/clients/${id}/log`);
    main.append(el('div', { class: 'scroll' }, el('table', { class: 't' }, el('thead', {}, el('tr', {}, ['Cuándo', 'Quién', 'Acción', 'Servicio'].map((h) => el('th', {}, h)))),
      el('tbody', {}, log.length ? log.map((l) => el('tr', {}, el('td', {}, new Date(l.at).toLocaleString('es-ES')), el('td', {}, l.actor), el('td', {}, l.action), el('td', {}, l.service || '—'))) : el('tr', {}, el('td', { colspan: 4, class: 'muted' }, 'Sin movimientos.'))))));
  }

  const statusSel = el('select', { onchange: (e) => api('PATCH', `/api/clients/${id}`, { status: e.target.value }).then(() => toast('Estado actualizado')) },
    Object.entries(STATUS).map(([k, v]) => el('option', { value: k, selected: client.status === k }, v)));
  view.replaceChildren(
    el('div', { class: 'row', style: 'margin-bottom:14px' },
      el('a', { href: '#/', class: 'btn ghost small' }, '← Clientes'), el('h1', { class: 'grow' }, client.name), statusSel,
      el('div', { class: 'row' }, el('div', { class: 'bar', style: 'width:110px' }, el('i', { style: `width:${progress.pct}%` })), `${progress.pct}%`)),
    el('div', { class: 'card', style: 'margin-bottom:14px' }, el('div', { class: 'row' },
      el('strong', {}, 'Enlace para el cliente:'), el('code', { class: 'mono grow', style: 'overflow-wrap:anywhere' }, link),
      el('button', { class: 'btn small', onclick: () => navigator.clipboard.writeText(link).then(() => toast('Enlace copiado')) }, 'Copiar'),
      el('button', { class: 'btn ghost small', onclick: async () => { if (confirm('El enlace actual dejará de funcionar. ¿Generar uno nuevo?')) { await api('PATCH', `/api/clients/${id}`, { rotate_token: true }); route(); } } }, 'Renovar'),
      el('button', { class: 'btn ghost small', onclick: async () => { const a = !client.archived; if (confirm(a ? '¿Archivar este cliente? Su enlace dejará de funcionar.' : '¿Reactivar este cliente?')) { await api('PATCH', `/api/clients/${id}`, { archived: a }); route(); } } }, client.archived ? 'Reactivar' : 'Archivar'))),
    el('div', { class: 'layout' }, el('nav', { class: 'side' }, tabs.map((x) => {
      const p = progress.sections[x.key];
      return el('a', { class: x.key === t.key ? 'on' : '', href: `#/c/${id}/${x.key}` }, x.title, p ? el('small', {}, `${p.done}/${p.total}`) : '');
    })), main));
}

// ───────── Equipo ─────────
async function teamView() {
  const { users } = await api('GET', '/api/users');
  const showTemp = (email, pw) => alert(`Contraseña temporal de ${email}:\n\n${pw}\n\nCópiala ahora: no se vuelve a mostrar. Tendrá que cambiarla al entrar.`);
  const act = async (u, body) => { const r = await api('PATCH', `/api/users/${u.id}`, body); if (r.temp_password) showTemp(u.email, r.temp_password); route(); };
  view.replaceChildren(
    el('div', { class: 'row', style: 'margin-bottom:12px' }, el('h1', { class: 'grow' }, 'Equipo'),
      el('button', { class: 'btn', onclick: async () => {
        const email = (prompt('Correo del nuevo usuario') || '').trim(); if (!email) return;
        const name = (prompt('Nombre') || '').trim();
        const role = (prompt('Rol: "admin" (ve contraseñas) o "member" (no las ve)', 'member') || '').trim();
        try { const r = await api('POST', '/api/users', { email, name, role }); showTemp(email, r.temp_password); route(); } catch (e) { toast(e.message); }
      } }, '+ Nuevo usuario')),
    el('div', { class: 'banner' }, el('strong', {}, 'Administrador'), ': ve y copia contraseñas (con doble verificación) y borra credenciales. ', el('strong', {}, 'Miembro'), ': trabaja con los clientes y puede añadir o editar credenciales, pero no ver las contraseñas.'),
    el('div', { class: 'scroll' }, el('table', { class: 't' },
      el('thead', {}, el('tr', {}, ['Usuario', 'Rol', 'Doble verif.', 'Estado', ''].map((h) => el('th', {}, h)))),
      el('tbody', {}, users.map((u) => el('tr', {},
        el('td', {}, el('strong', {}, u.name || u.email), el('div', { class: 'muted' }, u.email)),
        el('td', {}, u.role === 'super_admin' ? ROLE.super_admin : el('select', { onchange: (e) => act(u, { role: e.target.value }) }, ['admin', 'member'].map((r) => el('option', { value: r, selected: u.role === r }, ROLE[r])))),
        el('td', {}, u.totp_enabled ? el('span', { class: 'pill ok' }, 'activa') : el('span', { class: 'pill warn' }, 'sin activar')),
        el('td', {}, u.active ? el('span', { class: 'pill ok' }, 'activo') : el('span', { class: 'pill bad' }, 'desactivado')),
        el('td', { class: 'row' }, u.role === 'super_admin' ? '' : [
          el('button', { class: 'btn ghost small', onclick: () => confirm('¿Generar una contraseña temporal nueva?') && act(u, { reset_password: true }) }, 'Nueva contraseña'),
          u.totp_enabled ? el('button', { class: 'btn ghost small', onclick: () => confirm('¿Quitar su doble verificación? Tendrá que configurarla de nuevo.') && act(u, { reset_mfa: true }) }, 'Reiniciar 2FA') : '',
          el('button', { class: 'btn ghost small', onclick: () => act(u, { active: !u.active }) }, u.active ? 'Desactivar' : 'Activar')])))))));
}

// ───────── Seguridad ─────────
async function securityView() {
  const box = el('div', { class: 'card', style: 'max-width:480px' });
  const draw = async () => {
    me = (await api('GET', '/api/me')).user;
    box.replaceChildren(el('h2', {}, 'Doble verificación'));
    if (me.mfa_enabled) { box.append(el('p', {}, el('span', { class: 'pill ok' }, 'Activa'), ' Se te pedirá un código antes de ver o copiar cualquier contraseña.')); return; }
    box.append(el('p', { class: 'muted' }, 'Escanea el código con Google Authenticator, Authy o similar, y escribe el código de 6 cifras que muestre.'));
    const start = el('button', { class: 'btn', onclick: async () => {
      const r = await api('POST', '/api/mfa/setup'); const err = el('div', { class: 'err' });
      const inp = el('input', { inputmode: 'numeric', maxlength: 6, placeholder: '000000', style: 'width:140px' });
      box.append(el('div', {}, el('img', { src: r.qr, alt: 'QR', style: 'display:block;margin:10px 0' }), el('div', { class: 'muted' }, 'Si no puedes escanear, clave manual: ', el('code', { class: 'mono' }, r.secret)),
        el('div', { class: 'row', style: 'margin-top:10px' }, inp, el('button', { class: 'btn', onclick: async () => { try { await api('POST', '/api/mfa/enable', { code: inp.value }); toast('Doble verificación activada'); draw(); } catch (e) { err.textContent = e.message; } } }, 'Activar'), err)));
      start.remove();
    } }, 'Configurar');
    box.append(start);
  };
  view.replaceChildren(el('h1', { style: 'margin-bottom:12px' }, 'Seguridad'), box,
    el('div', { style: 'margin-top:16px;max-width:380px' }, passwordView(false)));
  await draw();
}

boot();
