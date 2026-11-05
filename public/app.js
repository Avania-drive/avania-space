import { DATE_ATTRS, el, api, toast, renderSection, renderCredentials, helpBlock, helpButton, toUrl, appIcon, appName, openModal, askText, askConfirm, askPhrase, notice, fmtDate } from './fields.js';
import { embedUrl } from './preview.js';
import { homeNodes, docsNodes, areasNodes, taskColumns, timelineNode, phasesNode, bar, driveFilesNode } from './clientview.js';
import { kpisNode, scopeForm, partOf, panelView, configView, notesTab, linksCard, docsTab, lastChange, avatar, logoButton, clientUsersTab, vaultView, resultsTab, pipelineTools, agencyOnly, zonaCard } from './extra.js';

const app = document.getElementById('app');
let me = null, formDef = null, ayuda = {};
const ROLE = { super_admin: 'Superadministrador', admin: 'Administrador', member: 'Miembro' };
const STATUS = { onboarding: 'Onboarding', montaje: 'Montaje', rodaje: 'Rodaje', formacion: 'Formación', activa: 'Campaña activa', pausada: 'Pausada' };

// ───────── Entrada ─────────
// Preferencias personales: tema (auto/claro/oscuro) y color de acento. Se guardan en la cuenta y, para pintar antes, en el navegador.
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
function applyPrefs(p = {}) {
  const root = document.documentElement;
  if (p.theme === 'light' || p.theme === 'dark') root.dataset.theme = p.theme; else delete root.dataset.theme;
  for (const k of ['--accent', '--accent-ink', '--soft']) root.style.removeProperty(k);
  if (/^#[0-9a-f]{6}$/i.test(p.accent || '')) {
    root.style.setProperty('--accent', p.accent);
    root.style.setProperty('--accent-ink', lum(p.accent) > 0.5 ? '#101828' : '#ffffff');
    root.style.setProperty('--soft', `color-mix(in srgb, ${p.accent} 10%, var(--panel))`);
  }
  try { localStorage.setItem('avania-space-prefs', JSON.stringify(p)); } catch { /* sin almacenamiento */ }
}
try { applyPrefs(JSON.parse(localStorage.getItem('avania-space-prefs') || '{}')); } catch { /* sin preferencias guardadas */ }

async function boot() {
  try { me = (await api('GET', '/api/me')).user; } catch { return loginView(); }
  if (me.must_change_password) return passwordView(true);
  applyPrefs(me.prefs);
  [formDef, ayuda] = await Promise.all([api('GET', '/api/formdef'), fetch('/ayuda.json').then((r) => r.json()).catch(() => ({}))]);
  shell();
  if (!location.hash || location.hash === '#/') location.replace('#/panel');
  route();
}
window.addEventListener('hashchange', () => me && !me.must_change_password && route());

function brand() {
  return el('span', { class: 'brand' }, el('img', { class: 'logo-light', src: '/brand/avania-light.png', alt: 'Avania', width: 67, height: 24 }),
    el('img', { class: 'logo-dark', src: '/brand/avania-dark.png', alt: 'Avania', width: 67, height: 24 }), el('b', {}, 'SPACE'));
}

function loginView() {
  const err = el('div', { class: 'err', role: 'alert' });
  const email = el('input', { id: 'login-email', name: 'email', type: 'email', autocomplete: 'username', spellcheck: false, required: true });
  const pw = el('input', { id: 'login-pw', name: 'password', type: 'password', autocomplete: 'current-password', required: true });
  const go = async (e) => {
    e.preventDefault(); err.textContent = '';
    try { await api('POST', '/api/login', { email: email.value, password: pw.value }); boot(); } catch (er) { err.textContent = er.message; }
  };
  app.replaceChildren(el('div', { class: 'center' }, el('form', { class: 'card', onsubmit: go },
    brand(), el('h1', { style: 'margin-top:14px' }, 'Acceso del equipo'),
    el('label', { for: 'login-email' }, 'Correo'), email, el('label', { for: 'login-pw' }, 'Contraseña'), pw, err,
    el('button', { class: 'btn', style: 'width:100%;margin-top:12px' }, 'Entrar'))));
}

function passwordView(forced) {
  const err = el('div', { class: 'err', role: 'alert' });
  const cur = el('input', { id: 'pw-cur', name: 'current', type: 'password', autocomplete: 'current-password', required: true });
  const n1 = el('input', { id: 'pw-new', name: 'new', type: 'password', autocomplete: 'new-password', required: true, minlength: 12 });
  const n2 = el('input', { id: 'pw-new2', name: 'new2', type: 'password', autocomplete: 'new-password', required: true, minlength: 12 });
  const go = async (e) => {
    e.preventDefault(); err.textContent = '';
    if (n1.value !== n2.value) { err.textContent = 'Las contraseñas no coinciden'; return; }
    try { await api('POST', '/api/password', { current: cur.value, next: n1.value }); toast('Contraseña cambiada'); forced ? boot() : (location.hash = '#/'); }
    catch (er) { err.textContent = er.message; }
  };
  const fld = (label, input, hint) => el('div', { class: 'pwfield' }, el('label', { for: input.id }, label), input, hint ? el('div', { class: 'muted pwhint' }, hint) : '');
  const card = el('form', { class: 'card pwform', onsubmit: go },
    forced ? brand() : '', el('h2', { style: forced ? 'margin-top:14px' : 'margin-top:0' }, forced ? 'Elige tu contraseña' : 'Cambiar contraseña'),
    forced ? el('p', { class: 'muted' }, 'La que te dimos era temporal. Usa al menos 12 caracteres.') : '',
    fld(forced ? 'Contraseña temporal' : 'Contraseña actual', cur),
    fld('Nueva contraseña', n1, 'Mínimo 12 caracteres.'),
    fld('Repite la nueva contraseña', n2),
    err,
    el('button', { class: 'btn', style: 'margin-top:6px' }, 'Guardar contraseña'));
  if (forced) app.replaceChildren(el('div', { class: 'center' }, card));
  else return card;
}

// ───────── Mi perfil (ventana en el centro) ─────────
const PALETA_ACENTO = ['#0f766e', '#1d4ed8', '#6d28d9', '#be185d', '#b42318', '#b45309', '#4d7c0f', '#0e7490', '#344054'];
function openProfile() {
  if (document.querySelector('.profile-modal')) return;
  const save = async (body) => { try { const r = await api('PUT', '/api/me/prefs', body); me.prefs = r.prefs; applyPrefs(me.prefs); } catch (e) { toast(e.message); } };
  let dlg;
  const close = () => dlg.close();
  const mfaBits = [me.has_totp ? 'App de códigos' : '', me.n_passkeys ? `${me.n_passkeys} llave${me.n_passkeys > 1 ? 's' : ''} de acceso` : ''].filter(Boolean);
  const nameIn = el('input', { id: 'perfil-nombre', name: 'name', autocomplete: 'name', value: me.name || '', placeholder: 'Tu nombre…', onchange: async (e) => { const n = e.target.value.trim(); if (!n) return; await save({ name: n }); me.name = n; shell(); route(); toast('Nombre guardado'); } });
  const theme = me.prefs?.theme || 'auto';
  const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Apariencia' }, [['light', 'Claro'], ['dark', 'Oscuro'], ['auto', 'Automático']].map(([v, t]) => el('button', { type: 'button', 'aria-pressed': String(theme === v), class: theme === v ? 'on' : '', onclick: async (e) => { seg.querySelectorAll('button').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); e.currentTarget.classList.add('on'); e.currentTarget.setAttribute('aria-pressed', 'true'); await save({ theme: v }); } }, t)));
  const custom = el('input', { type: 'color', class: 'catcolor', title: 'Otro color', 'aria-label': 'Otro color', value: me.prefs?.accent || '#0f766e', onchange: async (e) => { await save({ accent: e.target.value }); mark(); } });
  const sw = PALETA_ACENTO.map((c) => el('button', { type: 'button', class: 'swatch', style: `--c:${c}`, title: c, 'aria-label': `Color ${c}`, onclick: async () => { custom.value = c; await save({ accent: c }); mark(); } }));
  const mark = () => sw.forEach((b, i) => b.classList.toggle('on', (me.prefs?.accent || '#0f766e').toLowerCase() === PALETA_ACENTO[i]));
  mark();
  const card = el('div', { class: 'card profile' },
    el('div', { class: 'row', style: 'align-items:center;margin-bottom:6px' }, el('span', { class: 'av avbig' }, (me.name || me.email)[0].toUpperCase()), el('div', { class: 'grow' }, el('h2', { style: 'margin:0' }, me.name || me.email), el('span', { class: 'muted' }, ROLE[me.role])),
      el('button', { type: 'button', class: 'btn ghost small', onclick: close, 'aria-label': 'Cerrar' }, '✕')),
    el('div', { class: 'pfield' }, el('label', { for: 'perfil-nombre' }, 'Nombre'), nameIn),
    el('div', { class: 'pfield' }, el('label', {}, 'Correo electrónico'), el('div', { class: 'ro' }, me.email)),
    el('h3', {}, 'Doble verificación'),
    el('div', { class: 'row' }, mfaBits.length ? [el('span', { class: 'pill ok' }, 'Activa'), el('span', { class: 'muted grow' }, mfaBits.join(' · ')), el('a', { class: 'btn ghost small', href: '#/seguridad', onclick: close }, 'Gestionar')]
      : [el('span', { class: 'pill warn' }, 'Sin activar'), el('span', { class: 'muted grow' }, 'Sin ella no puedes ver ni copiar contraseñas.'), el('a', { class: 'btn small', href: '#/seguridad', onclick: close }, 'Activar doble verificación')]),
    el('h3', {}, 'Apariencia'), seg,
    el('h3', {}, 'Color'), el('div', { class: 'row swatches' }, sw, custom, el('button', { type: 'button', class: 'btn ghost small', onclick: async () => { await save({ accent: null }); custom.value = '#0f766e'; mark(); } }, 'Restablecer')),
    el('div', { class: 'row end', style: 'margin-top:16px' }, el('a', { class: 'btn ghost small', href: '#/seguridad', onclick: close }, 'Cambiar contraseña'), el('button', { type: 'button', class: 'btn', onclick: close }, 'Listo')));
  dlg = openModal(card, { label: 'Mi perfil', cls: 'profile-modal' });
}

// ───────── Estructura ─────────
const view = el('main', { id: 'main', tabindex: '-1' });

// Iconos de línea (24×24) para el menú lateral.
const ICONS = {
  clientes: '<path d="M3 21V8l6-4v17M9 21V10l6 3v8M15 21h6V12l-6-3M6 11v.01M6 15v.01M12 14v.01M12 18v.01M18 15v.01M18 18v.01"/>',
  equipo: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
  seguridad: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  salir: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  proyecto: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  clinica: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>',
  oferta: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
  rodaje: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  materiales: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  fechas: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  accesos: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  meta: '<path d="M3 11v3l12 5V6zM15 8c3 .5 5 2 5 4s-2 3.500-5 4M7 16l1.500 4h3L10 17"/>',
  zona: '<path d="M12 21s7-6.500 7-12a7 7 0 0 0-14 0c0 5.500 7 12 7 12z"/><circle cx="12" cy="9" r="2.500"/>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 16l2 2 4-4"/>',
  whatsapp: '<path d="M21 11.500a8.400 8.400 0 0 1-12.300 7.400L3 20.500l1.700-5.500A8.400 8.400 0 1 1 21 11.500z"/>',
  formacion: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.500 9 2.500 12 0v-5"/>',
  cierre: '<circle cx="12" cy="12" r="9"/><path d="M8 12.500l3 3 5-6"/>',
  credenciales: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>',
  registro: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  refrescar: '<path d="M20 12a8 8 0 1 1-2.500-5.800M20 4v5h-5"/>',
  archivo: '<path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4"/>',
  externo: '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>',
  doc: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>',
};
ICONS.enlaces = ICONS.enlace;
ICONS.pixel = '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>';
ICONS.resumen = '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>';
ICONS.b_proyecto = '<path d="M3 21V8l6-4v17M9 21V10l6 3v8M15 21h6V12l-6-3M6 11v.01M6 15v.01M12 14v.01M12 18v.01M18 15v.01M18 18v.01"/>';
ICONS.b_contenido = '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>';
ICONS.b_publicidad = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>';
ICONS.b_atencion = '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 20.5l1.7-5.5A8.4 8.4 0 1 1 21 11.5z"/>';
ICONS.b_cierre = '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>';
ICONS.b_empresa = ICONS.b_proyecto; ICONS.b_mercado = '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.300 2.700-6 6-6s6 2.700 6 6M16 5.500a3 3 0 0 1 0 5.500M18 14.500c2 .700 3.500 2.600 3.500 5.500"/>'; ICONS.b_tecnico = ICONS.b_publicidad; ICONS.b_cronograma = '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 15h3"/>'; ICONS.b_nosotros = ICONS.b_atencion; ICONS.b_gestion = ICONS.config;
ICONS.plan = ICONS.b_cronograma; ICONS.avania = ICONS.equipo; ICONS.mercado = ICONS.b_mercado; ICONS.cronograma = ICONS.b_cronograma;
ICONS.b_accesos = '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>';
ICONS.boveda = '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.500V7M12 17v-1.500M15.500 12H17M7 12h1.500"/>';
ICONS.negocio = '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>';
ICONS.resultados = '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>';
ICONS.ojo = '<path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
ICONS.panel = '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>';
ICONS.config = '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.700 17.700l2.100 2.100M2 12h3M19 12h3M4.200 19.800l2.100-2.100M17.700 6.300l2.100-2.100"/>';
ICONS.personas = ICONS.equipo; ICONS.horarios = ICONS.fechas; ICONS.notas = '<path d="M5 3h14v14l-4 4H5zM15 21v-4h4M8 8h8M8 12h6"/>'; ICONS.documentos = ICONS.materiales;
ICONS.embudo = '<path d="M3 4h18l-7 8.500V19l-4 2v-8.500z"/>';
ICONS.chevd = '<path d="M6 9l6 6 6-6"/>'; ICONS.chevu = '<path d="M6 15l6-6 6 6"/>';
function icon(k) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[k] || ICONS.doc;
  return s;
}
// Botón cuadrado pequeño con icono para la cabecera de la ficha. `href` = enlace (`external` abre otra pestaña); `onclick` = botón.
function iconBtn(ic, label, { href, external = false, onclick, cls = '' } = {}) {
  const attrs = { class: `appbtn ibtn ${cls}`.trim(), title: label, 'aria-label': label };
  return href
    ? el('a', { ...attrs, href, ...(external ? { target: '_blank', rel: 'noopener' } : {}) }, icon(ic))
    : el('button', { ...attrs, type: 'button', onclick }, icon(ic));
}
const hue = (t) => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const sideCtx = el('div', { class: 'sidectx' });
// Leyenda de colores (quién ve cada cosa): vive abajo, en Administración, y solo se enseña dentro de la ficha de un cliente.
const legend = el('div', { class: 'av-legend', hidden: true, 'aria-label': 'Quién ve cada cosa' }, el('span', { 'data-scope': 'agency' }, 'Solo agencia'), el('span', { 'data-scope': 'client' }, 'Lo ve el cliente'));

// Menú lateral (como el de Holded): la persona, lo principal con iconos y, dentro de un cliente, el menú de ese cliente debajo.
function shell() {
  const link = (h, k, t) => el('a', { class: 'av-nav', href: h, 'data-h': h }, icon(k), el('span', {}, t));
  const side = el('aside', { class: 'av-side' },
    brand(),
    el('button', { type: 'button', class: 'av-acct', title: 'Mi perfil', 'aria-haspopup': 'dialog', onclick: openProfile }, el('span', { class: 'av' }, (me.name || me.email)[0].toUpperCase()), el('span', { class: 'txt' }, el('b', {}, me.name || me.email), el('span', {}, ROLE[me.role]))),
    el('nav', { class: 'main-nav', 'aria-label': 'Trabajo' }, link('#/panel', 'panel', 'Panel'), link('#/', 'clientes', 'Clientes')),
    sideCtx,
    el('span', { class: 'av-grow' }),
    // Administración interna de la agencia, siempre abajo (junto a «Salir»), aparte del trabajo con clientes.
    el('div', { class: 'av-foot' },
      el('nav', { class: 'main-nav', 'aria-label': 'Administración de la agencia' }, el('div', { class: 'av-cap' }, 'Administración'), legend,
        me.role === 'super_admin' || me.role === 'admin' ? [link('#/boveda', 'boveda', 'Bóveda'), link('#/config', 'config', 'Configuración')] : '',
        me.role === 'super_admin' ? link('#/equipo', 'equipo', 'Equipo agencia') : '', link('#/seguridad', 'seguridad', 'Seguridad')),
      el('a', { class: 'av-nav out', href: '#/', onclick: async (e) => { e.preventDefault(); await api('POST', '/api/logout'); me = null; document.body.classList.remove('av-open'); loginView(); } }, icon('salir'), el('span', {}, 'Salir'))));
  const skip = el('a', { class: 'skip', href: '#main', onclick: (e) => { e.preventDefault(); view.focus(); } }, 'Saltar al contenido');
  app.replaceChildren(skip, el('div', { class: 'av-app' }, side, el('div', { class: 'av-content' },
    el('header', { class: 'av-top' }, el('button', { class: 'btn ghost small', 'aria-label': 'Menú', onclick: () => document.body.classList.toggle('av-open') }, '☰'), brand()), view),
  el('div', { class: 'av-scrim', 'aria-hidden': 'true', onclick: () => document.body.classList.remove('av-open') })));
}
// Menú del cliente: el nombre arriba, «Resumen» y un acordeón por bloque (al abrir uno se cierra el otro).
// ctx = { title, top: [items], groups: [{ key, title, badge, items }] } · el bloque de la página actual se abre al llegar a ella.
let openGrp = null, lastCur = null;
function setSide(ctx) {
  legend.hidden = !ctx || !!ctx.noLegend;
  if (!ctx) { lastCur = null; return sideCtx.replaceChildren(); }
  const row = (x) => el('a', { class: 'av-nav' + (x.on ? ' on' : ''), 'data-scope': x.scope, href: x.href, title: x.label, 'aria-current': x.on ? 'page' : null, ...(x.ext ? { target: '_blank', rel: 'noopener' } : {}) },
    el('span', { class: 'av-ti' }, icon(x.key)), el('span', {}, x.label), x.small ? el('small', {}, x.small) : '');
  const cur = ctx.groups.find((g) => g.items.some((x) => x.on));
  if (cur && cur.key !== lastCur) openGrp = cur.key;
  lastCur = cur ? cur.key : null;
  const accs = ctx.groups.map((g) => {
    const body = el('div', { class: 'av-acc-body', id: `acc-${g.key}` }, el('div', { class: 'av-acc-in' }, g.items.map(row)));
    const head = el('button', { type: 'button', class: 'av-acc-head', 'data-scope': g.scope, 'aria-controls': `acc-${g.key}` },
      el('span', { class: 'av-acc-ic' }, icon(`b_${g.key}`)), el('span', { class: 'av-acc-t' }, g.title),
      g.badge ? el('small', { class: 'av-acc-n' }, g.badge) : '', icon('chevd'));
    const wrap = el('div', { class: 'av-acc' }, head, body);
    const paint = () => { const o = openGrp === g.key; wrap.classList.toggle('open', o); head.setAttribute('aria-expanded', String(o)); body.toggleAttribute('inert', !o); };
    head.addEventListener('click', () => { openGrp = openGrp === g.key ? null : g.key; accs.forEach((a) => a.paint()); });
    paint();
    return { wrap, paint };
  });
  sideCtx.replaceChildren(el('div', { class: 'av-sep' }), el('div', { class: 'av-ctxtitle', title: ctx.title }, el('small', {}, 'Cliente'), el('b', {}, ctx.title)),
    ...(ctx.top || []).map(row), el('div', { class: 'av-accs' }, accs.map((a) => a.wrap)));
}

let lastHash = null;
function route() {
  const h = (location.hash || '#/').split('?')[0];
  document.body.classList.remove('av-open');
  document.removeEventListener('keydown', clientsView.key);
  if (!h.startsWith('#/c/')) setSide(null);
  document.querySelectorAll('.main-nav a').forEach((a) => a.classList.toggle('on', a.dataset.h === h || (a.dataset.h === '#/' && h.startsWith('#/c/'))));
  const [, a, b, c] = h.split('/');
  const run = a === 'panel' ? panelView(view) : a === 'config' ? configView(view, formDef, me) : a === 'boveda' ? vaultView(view, { askCode }) : !a ? clientsView() : a === 'c' ? clientView(b, c || 'resumen') : a === 'equipo' ? teamView() : a === 'seguridad' ? securityView() : clientsView();
  const moved = lastHash !== null && lastHash !== h; lastHash = h;
  Promise.resolve(run).then(() => {
    // Al cambiar de página el foco pasa al título, para que el lector de pantalla lo anuncie.
    const t = moved && view.querySelector('h1'); if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); }
  }).catch((e) => view.replaceChildren(el('div', { class: 'banner', role: 'alert' }, e.message)));
}

// ───────── Llaves de acceso (WebAuthn) ─────────
const bufOf = (b64u) => Uint8Array.from(atob(b64u.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64u.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const b64uOf = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const passkeysOk = () => !!(window.PublicKeyCredential && navigator.credentials);
async function createPasskey(options) {
  options.challenge = bufOf(options.challenge); options.user.id = bufOf(options.user.id);
  (options.excludeCredentials || []).forEach((c) => { c.id = bufOf(c.id); });
  const c = await navigator.credentials.create({ publicKey: options });
  return { id: c.id, rawId: b64uOf(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment, clientExtensionResults: c.getClientExtensionResults(),
    response: { clientDataJSON: b64uOf(c.response.clientDataJSON), attestationObject: b64uOf(c.response.attestationObject), transports: c.response.getTransports ? c.response.getTransports() : [] } };
}
async function getPasskey(options) {
  options.challenge = bufOf(options.challenge);
  (options.allowCredentials || []).forEach((c) => { c.id = bufOf(c.id); });
  const c = await navigator.credentials.get({ publicKey: options });
  return { id: c.id, rawId: b64uOf(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment, clientExtensionResults: c.getClientExtensionResults(),
    response: { clientDataJSON: b64uOf(c.response.clientDataJSON), authenticatorData: b64uOf(c.response.authenticatorData), signature: b64uOf(c.response.signature), userHandle: c.response.userHandle ? b64uOf(c.response.userHandle) : undefined } };
}
// Pide la contraseña de la cuenta; resuelve con ella o con null si se cancela.
function askPassword(text) {
  return new Promise((resolve) => {
    const pw = el('input', { id: 'ask-pw', name: 'password', type: 'password', autocomplete: 'current-password', required: true, placeholder: 'Tu contraseña de Avania Space…', 'data-autofocus': '' });
    const card = el('form', { class: 'card', onsubmit: (e) => { e.preventDefault(); d.close(pw.value); } },
      el('h2', {}, 'Confirma tu contraseña'), el('p', { class: 'muted' }, text), el('label', { for: 'ask-pw' }, 'Contraseña'), pw,
      el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => d.close(null) }, 'Cancelar'), el('button', { class: 'btn' }, 'Continuar')));
    const d = openModal(card, { label: 'Confirma tu contraseña', onClose: (v) => resolve(v ?? null) });
  });
}

// Pide el código de 6 cifras (o la llave de acceso); resuelve true si queda verificado.
function askCode() {
  return new Promise((resolve) => {
    const err = el('div', { class: 'err', role: 'alert' });
    const inp = el('input', { id: 'ask-code', name: 'code', inputmode: 'numeric', autocomplete: 'one-time-code', spellcheck: false, maxlength: 6, placeholder: '000000', 'data-autofocus': '', style: 'width:100%;font-size:20px;letter-spacing:6px;text-align:center' });
    const card = el('form', { class: 'card', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      try { await api('POST', '/api/mfa/verify', { code: inp.value }); d.close(true); } catch (er) { err.textContent = er.message; if (er.code === 'no_mfa') { d.close(false); location.hash = '#/seguridad'; } }
    } }, el('h2', {}, 'Verificación en dos pasos'), el('p', { class: 'muted' }, me.has_totp ? 'Introduce el código de tu app de autenticación o usa tu llave de acceso. Será válido 10 minutos.' : 'Usa tu llave de acceso. Será válido 10 minutos.'),
    me.has_totp ? el('label', { for: 'ask-code' }, 'Código de 6 cifras') : '', inp, err, el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => d.close(false) }, 'Cancelar'), me.has_totp ? el('button', { class: 'btn' }, 'Verificar') : ''),
    me.n_passkeys && passkeysOk() ? el('button', { type: 'button', class: 'btn' + (me.has_totp ? ' ghost' : ''), style: 'width:100%;margin-top:10px', onclick: async () => {
      err.textContent = '';
      try { const { options } = await api('POST', '/api/mfa/passkey/options'); await api('POST', '/api/mfa/passkey/verify', { response: await getPasskey(options) }); d.close(true); }
      catch (er) { err.textContent = er.name === 'NotAllowedError' ? 'Cancelado o no se pudo usar la llave.' : er.message; }
    } }, 'Usar llave de acceso') : '');
    if (!me.has_totp) inp.remove();
    const d = openModal(card, { label: 'Verificación en dos pasos', onClose: (v) => resolve(v === true) });
  });
}

// ───────── Clientes ─────────
const ago = (iso) => { const d = Math.floor((Date.now() - new Date(iso)) / 864e5); return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`; };
const missingOf = (c) => c.gates.filter((g) => !g.done);
const gatesBar = (gates) => el('span', { class: 'gates', role: 'img', 'aria-label': gates.map((g) => `${g.label}: ${g.done ? 'hecho' : 'pendiente'}`).join(', ') },
  gates.map((g) => el('span', { class: 'gate ' + (g.done ? 'ok' : 'todo'), title: `${g.label}: ${g.done ? 'hecho' : g.delegated ? 'pendiente (lo hará Avania)' : 'pendiente'}` }, icon(g.key))));
const launching = (c) => c.status !== 'activa' && c.status !== 'pausada';
const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } return null; };

async function clientsView() {
  const { clients } = await api('GET', '/api/clients');
  // Búsqueda, filtros y vista viven en la URL (#/?q=…&estado=…): se pueden compartir y sobreviven a recargar.
  const q0 = new URLSearchParams(location.hash.split('?')[1] || '');
  let filter = q0.get('q') || '', st = q0.get('estado') || '', cat = q0.get('categoria') || '', showArch = q0.get('archivados') === '1';
  let mode = ['tabla', 'estado', 'fichas'].includes(q0.get('vista')) ? q0.get('vista') : ['tabla', 'fichas'].includes(pref('avania-space-vista')) ? pref('avania-space-vista') : 'estado';
  const sync = () => {
    const p = new URLSearchParams();
    if (filter) p.set('q', filter); if (st) p.set('estado', st); if (cat) p.set('categoria', cat); if (showArch) p.set('archivados', '1'); if (mode !== 'estado') p.set('vista', mode);
    const qs = p.toString();
    history.replaceState(null, '', `${location.pathname}${location.search}#/${qs ? '?' + qs : ''}`);
  };
  const cats = [...new Map(clients.filter((c) => c.category).map((c) => [c.category, c.category_color])).entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  const tbody = el('tbody'), board = el('div', { class: 'board' });
  const tableWrap = el('div', { class: 'scroll' }, el('table', { class: 't click' },
    el('thead', {}, el('tr', {}, ['Cliente', 'Categoría', 'Ciudad', 'Responsable', 'Estado', 'Onboarding', 'Credenciales', 'Inicio', ''].map((h) => el('th', { class: h === 'Categoría' ? 'r' : '' }, h)))), tbody));
  const nWaiting = clients.filter((c) => !c.archived && launching(c) && missingOf(c).length).length;
  const lead = el('p', { class: 'lead' }, nWaiting ? `Hoy hay ${nWaiting} cliente${nWaiting > 1 ? 's' : ''} esperando datos suyos.` : 'No hay clientes esperando datos.');
  const canBaja = me.role === 'super_admin' || me.role === 'admin';
  // Baja del cliente (solo en el panel de clientes): pide escribir «dar de baja». Archiva; no borra nada y se puede reactivar.
  const bajaBtn = (c, cls = 'btn ghost small') => el('button', { type: 'button', class: cls, title: c.archived ? 'Volver a dar de alta' : 'Dar de baja a este cliente', 'aria-label': c.archived ? `Reactivar a ${c.name}` : `Dar de baja a ${c.name}`,
    onclick: async (e) => {
      e.preventDefault(); e.stopPropagation();
      const a = !c.archived;
      const okk = a ? await askPhrase({ title: `Dar de baja a «${c.name}»`, text: 'Dejará de salir en la lista y su enlace dejará de funcionar. No se borra nada: podrás reactivarlo marcando «Archivados».', phrase: 'dar de baja', ok: 'Dar de baja' })
        : await askConfirm({ title: `Reactivar a «${c.name}»`, ok: 'Reactivar' });
      if (!okk) return;
      await api('PATCH', `/api/clients/${c.id}`, { archived: a }); toast(a ? 'Cliente dado de baja' : 'Cliente reactivado'); route();
    } }, c.archived ? 'Reactivar' : trashIcon());
  const trashIcon = () => { const i = el('span', { class: 'trash', 'aria-hidden': 'true' }); i.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg>'; return i; };
  const crow = (c) => el('a', { class: 'crow', href: `#/c/${c.id}` },
    el('span', { class: 'name' }, el('strong', {}, c.name), c.archived ? el('span', { class: 'pill' }, 'archivado') : '', c.status === 'activa' ? el('small', { class: 'muted' }, 'Campaña activa') : c.status === 'pausada' ? el('small', { class: 'muted' }, 'Pausada') : ''),
    gatesBar(c.gates),
    el('span', { class: 'when', title: 'Última actividad en la ficha' }, ago(c.last_activity)),
    el('span', { class: 'who' }, c.account_manager || '—'),
    el('span', { class: 'cat' }, catPill(c.category, c.category_color)),
    canBaja ? bajaBtn(c) : '');
  const folds = { 'En campaña': true };   // los grupos plegables: «En campaña» sale desplegado y se recuerda lo que se abra o cierre
  const group = (title, list, fold) => !list.length ? '' : fold
    ? el('details', { class: 'cgroup', open: folds[title] === true, ontoggle: (e) => { folds[title] = e.target.open; } }, el('summary', {}, `${title} (${list.length})`), el('div', { class: 'clist' }, list.map(crow)))
    : el('section', { class: 'cgroup' }, el('h2', {}, `${title} (${list.length})`), el('div', { class: 'clist' }, list.map(crow)));
  const ficha = (c) => el('a', { class: 'ficha', href: `#/c/${c.id}` },
    el('div', { class: 'top' }, avatar(c),
      el('div', {}, el('h3', {}, c.name), el('small', {}, c.city || 'Sin ciudad'))),
    el('div', { class: 'row' }, catPill(c.category, c.category_color), el('span', { class: 'pill' }, STATUS[c.status]), c.archived ? el('span', { class: 'pill' }, 'archivado') : ''),
    el('div', { class: 'foot' }, el('div', { class: 'bar', style: 'flex:1' }, el('i', { style: `width:${c.progress}%` })), el('span', { class: 'num' }, `${c.progress}% alta`)),
    canBaja ? el('div', { class: 'row end' }, bajaBtn(c)) : '');
  const draw = () => {
    sync();
    const rows = clients.filter((c) => (showArch || !c.archived) && (!st || c.status === st) && (!cat || c.category === cat)
      && `${c.name} ${c.city || ''} ${c.account_manager || ''}`.toLowerCase().includes(filter.toLowerCase()));
    board.hidden = mode === 'tabla'; tableWrap.hidden = mode !== 'tabla'; lead.hidden = mode === 'tabla';
    if (mode === 'fichas') {
      board.replaceChildren(rows.length ? el('div', { class: 'fichas' }, rows.map(ficha)) : el('p', { class: 'muted' }, 'No hay clientes con ese filtro.'));
      return;
    }
    if (mode === 'tabla') {
      tbody.replaceChildren(...rows.map((c) => el('tr', { onclick: () => (location.hash = `#/c/${c.id}`) },
        el('td', {}, el('a', { href: `#/c/${c.id}`, class: 'tlink', onclick: (e) => e.stopPropagation() }, el('strong', {}, c.name)), c.archived ? el('span', { class: 'pill', style: 'margin-left:6px' }, 'archivado') : ''),
        el('td', { class: 'r' }, catPill(c.category, c.category_color)), el('td', {}, c.city || '—'), el('td', {}, c.account_manager || '—'),
        el('td', {}, el('span', { class: 'pill' }, STATUS[c.status])),
        el('td', {}, el('div', { class: 'row' }, el('div', { class: 'bar', style: 'width:90px' }, el('i', { style: `width:${c.progress}%` })), el('span', { class: 'num' }, `${c.progress}%`))),
        el('td', {}, credPills(c.credentials)),
        el('td', {}, c.start_date ? fmtDate(c.start_date.slice(0, 10) + 'T12:00:00') : '—'),
        el('td', {}, canBaja ? bajaBtn(c) : ''))));
      if (!rows.length) tbody.append(el('tr', {}, el('td', { colspan: 9, class: 'muted' }, 'No hay clientes con ese filtro.')));
      return;
    }
    const byStale = (a, b) => new Date(a.last_activity) - new Date(b.last_activity);
    const waiting = rows.filter((c) => launching(c) && missingOf(c).length).sort(byStale);
    board.replaceChildren(
      group('Esperando al cliente', waiting),
      group('Listos para lanzar', rows.filter((c) => launching(c) && !missingOf(c).length)),
      group('En campaña', rows.filter((c) => c.status === 'activa'), true),
      group('Pausados', rows.filter((c) => c.status === 'pausada'), true),
      rows.length ? '' : el('p', { class: 'muted' }, 'No hay clientes con ese filtro.'));
  };
  const search = el('input', { type: 'search', name: 'q', value: filter, autocomplete: 'off', spellcheck: false, placeholder: 'Buscar… (pulsa /)', style: 'width:190px', 'aria-label': 'Buscar cliente', oninput: (e) => { filter = e.target.value; draw(); } });
  const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Vista' }, [['estado', 'Por estado'], ['fichas', 'Fichas'], ['tabla', 'Tabla']].map(([v, t]) => el('button', { type: 'button', class: mode === v ? 'on' : '', 'aria-pressed': String(mode === v),
    onclick: (e) => { mode = v; pref('avania-space-vista', v); seg.querySelectorAll('button').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); e.currentTarget.classList.add('on'); e.currentTarget.setAttribute('aria-pressed', 'true'); draw(); } }, t)));
  clientsView.key = (e) => { if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) { e.preventDefault(); search.focus(); } };
  document.addEventListener('keydown', clientsView.key);
  view.replaceChildren(
    el('div', { class: 'row', style: 'margin-bottom:4px' }, el('h1', { class: 'grow' }, `Clientes (${clients.filter((c) => !c.archived).length})`),
      search,
      el('select', { name: 'categoria', 'aria-label': 'Categoría', onchange: (e) => { cat = e.target.value; draw(); } }, el('option', { value: '' }, 'Todas las categorías'), cats.map(([n]) => el('option', { value: n, selected: n === cat }, n))),
      el('select', { name: 'estado', 'aria-label': 'Estado', onchange: (e) => { st = e.target.value; draw(); } }, el('option', { value: '' }, 'Todos los estados'), Object.entries(STATUS).map(([k, v]) => el('option', { value: k, selected: k === st }, v))),
      el('label', { class: 'row muted' }, el('input', { type: 'checkbox', name: 'archivados', checked: showArch, onchange: (e) => { showArch = e.target.checked; draw(); } }), 'Archivados'),
      seg,
      el('button', { class: 'btn ghost', onclick: newFromFunnels }, '+ Desde Avania Funnels'),
      el('button', { class: 'btn', onclick: newClient }, '+ Nuevo cliente')),
    lead, board, tableWrap);
  draw();
}

// Etiqueta de categoría con el color elegido.
const catPill = (name, color) => name ? el('span', { class: 'catpill', style: `--c:${color || '#667085'}` }, name) : el('span', { class: 'muted' }, '—');

function credPills(c) {
  const total = c.pendiente + c.recibida + c.verificada;
  if (!total) return el('span', { class: 'muted' }, '—');
  return el('span', { title: `${c.verificada} verificadas · ${c.recibida} recibidas (con contraseña, sin comprobar) · ${c.pendiente} pendientes (aún sin contraseña)` },
    el('span', { class: 'pill ok' }, `${c.verificada} ✓`), ' ', el('span', { class: 'pill' }, `${c.recibida} rec.`), ' ', el('span', { class: 'pill warn' }, `${c.pendiente} pend.`));
}

function newClient() {
  const err = el('div', { class: 'err', role: 'alert' });
  const name = el('input', { id: 'nc-nombre', name: 'name', autocomplete: 'off', required: true, 'data-autofocus': '' });
  const city = el('input', { id: 'nc-ciudad', name: 'city', autocomplete: 'off' });
  const card = el('form', { class: 'card', onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    try { const { client } = await api('POST', '/api/clients', { name: name.value.trim(), city: city.value.trim() }); d.close(); location.hash = `#/c/${client.id}`; } catch (er) { err.textContent = er.message; }
  } }, el('h2', {}, 'Nuevo cliente'),
  el('label', { for: 'nc-nombre' }, 'Nombre de la empresa'), name, el('label', { for: 'nc-ciudad', style: 'margin-top:10px' }, 'Ciudad (opcional)'), city, err,
  el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => d.close() }, 'Cancelar'), el('button', { class: 'btn' }, 'Crear cliente')));
  const d = openModal(card, { label: 'Nuevo cliente' });
}

// Alta con el ID de la subcuenta del cliente en Avania Funnels (la que ya se ha creado para él).
function newFromFunnels() {
  const err = el('div', { class: 'err', role: 'alert' });
  const nameIn = el('input', { id: 'nf-nombre', autocomplete: 'off', required: true, 'data-autofocus': '' });
  const cityIn = el('input', { id: 'nf-ciudad', autocomplete: 'off' });
  const idIn = el('input', { id: 'nf-id', placeholder: 'ID de la subcuenta', autocomplete: 'off', spellcheck: false, required: true });
  const catSel = el('select', { required: true, 'aria-label': 'Categoría' });
  let cats = [];
  const fill = (sel) => catSel.replaceChildren(el('option', { value: '' }, '— Elige categoría —'), ...cats.map((c) => el('option', { value: c.name, selected: c.name === sel }, c.name)), el('option', { value: '__nueva' }, '＋ Nueva categoría…'));
  catSel.addEventListener('change', async () => {
    if (catSel.value === '__nueva') {
      const name = await askText({ title: 'Nueva categoría', label: 'Nombre de la categoría', ok: 'Crear categoría' });
      if (name) { try { const { category } = await api('POST', '/api/categories', { name, color: '#6d28d9' }); cats = [...cats.filter((c) => c.name !== category.name), category]; fill(category.name); return; } catch (e) { err.textContent = e.message; } }
      fill('');
    }
  });
  api('GET', '/api/categories').then((r) => { cats = r.categories; fill(''); }).catch(() => fill(''));
  const close = () => dlg.close();
  const go = async (e) => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true;
    try {
      const r = await api('POST', '/api/clients/from-funnels', { locationId: idIn.value.trim(), name: nameIn.value.trim(), city: cityIn.value.trim(), category: catSel.value });
      close(); toast('Cliente creado'); location.hash = `#/c/${r.client.id}`;
    } catch (er) { err.textContent = er.message; btn.disabled = false; }
  };
  const btn = el('button', { class: 'btn', type: 'submit' }, 'Crear cliente');
  const card = el('form', { class: 'card', onsubmit: go },
    el('h2', {}, 'Nuevo cliente desde Avania Funnels'),
    el('p', { class: 'muted' }, 'Escribe el nombre de la empresa y pega el ID de su subcuenta en Avania Funnels (la que ya has creado para este cliente). Lo encuentras en la subcuenta: Ajustes › Información del negocio › ID de la ubicación.'),
    el('label', { for: 'nf-nombre' }, 'Nombre de la empresa'), nameIn,
    el('label', { for: 'nf-id', style: 'margin-top:10px' }, 'ID de la subcuenta'), idIn,
    el('label', { for: 'nf-ciudad', style: 'margin-top:10px' }, 'Ciudad (opcional)'), cityIn,
    el('label', { style: 'margin-top:10px' }, 'Categoría', catSel), err,
    el('div', { class: 'row', style: 'margin-top:12px' }, btn, el('button', { class: 'btn ghost', type: 'button', onclick: close }, 'Cancelar')));
  const dlg = openModal(card, { label: 'Nuevo cliente desde Avania Funnels' });
}

// Panel lateral con la vista previa de un documento de Google Drive (DOCX, PDF, Docs…).
// Vista previa de un documento en una ventana emergente (con la X para cerrarla). `el` queda vacío: las pantallas ya no reservan un panel al lado.
function previewPane() {
  const show = (r) => {
    const e = r.embed || embedUrl(r.url);
    const open = el('a', { class: 'btn ghost small', target: '_blank', rel: 'noopener', ...(r.url ? { href: r.url } : { hidden: '' }) }, r.embed || r.local ? 'Descargar' : 'Abrir en Drive');
    const close = el('button', { class: 'pvx', type: 'button', 'aria-label': 'Cerrar la vista previa', title: 'Cerrar', onclick: () => d.close(), 'data-autofocus': '' }, '×');
    const body = el('div', { class: 'pvmbody' }, e
      ? [el('iframe', { src: e.src, referrerpolicy: 'no-referrer', allow: '', title: r.nombre || 'Vista previa' }), el('p', { class: 'muted small' }, 'Si ves una pantalla de Google pidiendo acceso, inicia sesión con la cuenta que tiene permiso sobre el documento.')]
      : el('p', { class: 'muted' }, r.local ? 'Este tipo de archivo no se puede previsualizar en Space. Descárgalo para abrirlo.' : r.url ? 'Este enlace no es de Google Drive o Docs, así que no se puede previsualizar. Ábrelo con el botón.' : 'Pega un enlace de Google Drive para ver el documento.'));
    const card = el('div', { class: 'card pvmodal' }, el('div', { class: 'pvmhead' }, el('strong', { class: 'pvt' }, r.nombre || 'Documento'), e ? el('span', { class: 'muted pvk' }, e.kind) : '', el('span', { class: 'grow' }), open, close), body);
    const d = openModal(card, { label: `Vista previa: ${r.nombre || 'documento'}`, cls: 'pvwrap' });
  };
  return { el: document.createComment('vista previa'), show };
}

// ───────── Ficha del cliente ─────────
async function clientView(id, tab) {
  if (tab === 'horarios') tab = 'agenda';   // los horarios y las fechas señaladas viven solo en Empresa › Horarios
  const { client, views = {}, statuses, sections, meta, progress, gates, allowed, dental, tasks, timeline, fases, team = [], onboarding } = await api('GET', `/api/clients/${id}`);
  const fd = scopeForm(formDef, allowed, dental);
  // Vista de cliente: solo administradores. Enseña cada página como la ve el cliente, en solo lectura.
  const canPreview = me.role === 'super_admin' || me.role === 'admin';
  const pvq = new URLSearchParams(location.hash.split('?')[1] || '');
  if (canPreview && pvq.get('vista') === 'cliente') return clientPreview({ id, tab, client, views, sections, fd, dental, role: pvq.get('rol') === 'miembro' ? 'miembro' : 'responsable' });
  const link = `${location.origin}/f/${client.token}`;
  const pages = [{ key: 'plan', title: 'Tareas y próximas acciones', short: 'Tareas' }, { key: 'resultados', title: 'Resultados' }, { key: 'personas', title: 'Personas y equipo del cliente', short: 'Personas' }, { key: 'documentos', title: 'Documentos y notas', short: 'Documentos' }];
  const topPages = pages.filter((x) => !['personas', 'documentos'].includes(x.key));   // Personas va en Empresa y Documentos en Enlaces
  const tabs = [{ key: 'resumen', title: 'Resumen' }, ...pages, ...fd.form.map((s) => ({ key: s.key, title: `${s.num} ${s.title}`, short: s.short, sec: s })), { key: 'credenciales', title: 'Credenciales', short: 'Bóveda' }, { key: 'enlaces', title: 'Enlace del cliente', short: 'Enlace cliente' }, ...(me.can_see_passwords ? [{ key: 'registro', title: 'Registro de accesos', short: 'Registro' }] : [])];
  const t = tabs.find((x) => x.key === ({ equipo: 'personas', notas: 'documentos' }[tab] || tab)) || tabs[0];   // los enlaces antiguos a Equipo del cliente y Notas caen en su nueva pestaña
  const loc = String((sections.proyecto || {}).funnels_location || '').trim();
  const funnelsUrl = /^[A-Za-z0-9]{8,40}$/.test(loc) ? `https://app.avania.marketing/v2/location/${loc}/dashboard` : null;
  // Quién ve cada cosa: navy = solo la agencia; gris = lo ve (y rellena) el cliente.
  const access = ['accesos', 'meta', 'credenciales', 'enlaces', 'registro'].map((k) => tabs.find((x) => x.key === k)).filter(Boolean);   // la zona restringida y la gestión del enlace
  const PAGE_SCOPE = { plan: 'client', resumen: 'agency', resultados: 'client', personas: 'client', horarios: 'client', equipo: 'agency', notas: 'agency', documentos: 'agency', credenciales: 'client', enlaces: 'agency', registro: 'agency' };
  const scopeOf = (x) => (x.key in views ? (views[x.key] ? 'client' : 'agency') : x.sec ? (agencyOnly(x.sec) ? 'agency' : 'client') : PAGE_SCOPE[x.key]);
  const uniform = (items) => (items.every((i) => i.scope === items[0].scope) ? items[0].scope : null);
  const navItem = (x) => { const p = progress.sections[x.key]; return { scope: scopeOf(x), href: `#/c/${id}/${x.key}`, key: x.key, label: x.short || x.title, on: x.key === t.key, small: p ? `${p.done}/${p.total}` : (progress.sectionsTeam || {})[x.key] ? `${progress.sectionsTeam[x.key].done}/${progress.sectionsTeam[x.key].total}` : x.sec && agencyOnly(x.sec) ? 'agencia' : '' }; };
  const count = (keys) => { const r = keys.map((k) => progress.sections[k]).filter(Boolean); return r.length ? `${r.reduce((n, p) => n + p.done, 0)}/${r.reduce((n, p) => n + p.total, 0)}` : ''; };
  const areaBadge = (a) => (a.client.total ? `${a.client.pct}%` : a.team.total ? `${a.team.pct}%` : '');
  const bloqueTecnico = (b) => [...b.sections.map((k) => tabs.find((x) => x.key === k)), ...(b.key === 'empresa' ? [tabs.find((x) => x.key === 'personas')] : []), ...(b.key === 'tecnico' ? [{ ...tabs.find((x) => x.key === 'credenciales') }, tabs.find((x) => x.key === 'documentos')] : [])];
  const manage = ['enlaces', 'registro'].map((k) => tabs.find((x) => x.key === k)).filter(Boolean);
  setSide({ title: client.name,
    top: [navItem(tabs[0]), ...topPages.map((x) => navItem(tabs.find((y) => y.key === x.key)))],
    groups: [...fd.blocks.map((b, i) => { const items = bloqueTecnico(b).map(navItem); const a = progress.areas.find((x) => x.key === b.key); return { key: b.key, title: b.short, badge: a ? areaBadge(a) : '', items, scope: uniform(items) }; }),
      (() => { const items = manage.map(navItem); return { key: 'gestion', title: 'Gestión', badge: '', items, scope: uniform(items) }; })()] });
  const main = el('div', {});
  // «Ver cliente»: el superadministrador decide si el cliente ve esta página; el resto del equipo solo ve el estado.
  const viewChip = () => {
    const on = scopeOf(t) === 'client';
    if (me.role !== 'super_admin' || !(t.key in views)) return el('span', { class: 'scope-chip', 'data-scope': scopeOf(t) }, on ? 'Lo ve el cliente' : 'Solo agencia');
    const cb = el('input', { type: 'checkbox', id: 'vercliente', checked: on, onchange: async (e) => {
      const v = e.target.checked;
      try { Object.assign(views, (await api('PUT', `/api/clients/${id}/client-view`, { key: t.key, on: v })).views); toast(v ? 'El cliente ya ve esta parte' : 'El cliente ya no ve esta parte'); route(); }
      catch (er) { e.target.checked = !v; toast(er.message); }
    } });
    return el('label', { class: 'scope-chip viewtick', for: 'vercliente', 'data-scope': on ? 'client' : 'agency', title: 'Marca para que el cliente vea esta parte en su espacio; desmárcala para ocultarla' }, cb, 'Ver cliente');
  };
  if (t.key !== 'resumen') main.append(el('h2', {}, t.title, viewChip()));
  if (t.key === 'resumen') {
    const miss = gates.filter((g) => !g.done);
    main.append(el('section', { class: 'launch' },
      el('h2', {}, miss.length ? (miss.length === 1 ? 'Falta una cosa para lanzar' : `Faltan ${miss.length} cosas para lanzar`) : 'Listo para lanzar la campaña'),
      el('p', { class: 'sub' }, `Última actividad: ${ago(client.updated_at)}.`),
      el('ul', { class: 'gatelist' }, gates.map((g) => el('li', { class: g.done ? 'ok' : 'todo' },
        el('a', { href: `#/c/${id}/${g.section}` }, el('span', { class: 'mk', 'aria-hidden': 'true' }, g.done ? '✓' : '!'), el('span', {}, g.done ? g.label : g.todo + (g.delegated ? ' (lo hará Avania)' : ''))))))));
    const pbar = (label, pct, cls) => el('div', { class: 'pbar' }, el('b', {}, `${pct}%`), el('span', { class: 'muted' }, ` ${label}`), bar(pct, cls));
    main.append(
      el('section', { class: 'card', style: 'margin-top:18px' }, el('h2', { style: 'margin:0 0 4px;font-size:16px' }, 'Avance del onboarding'),
        el('div', { class: 'pbars', style: 'margin:10px 0 4px' }, pbar('el cliente ha completado', progress.pct, 'client'), pbar('AVANIA ha completado', progress.team.pct, 'agency')),
        areasNodes(progress.areas, { team: true, href: (a) => `#/c/${id}/${a.sections[0]}` })),
      closingCard(),
      el('section', { class: 'cgroup' }, el('h2', {}, 'Tareas por prioridad'), taskColumns(tasks, { mine: 'Del cliente', ours: 'Nuestras', limit: 4, href: (tk) => `#/c/${id}/${tk.section}` }),
        el('p', { class: 'muted', style: 'margin:8px 0 0' }, el('a', { href: `#/c/${id}/plan` }, 'Ver todas las tareas, con responsables y fechas'))));
    const mine = fd.form.flatMap((sec) => { const dl = (sections[sec.key] || {})._avania || []; return sec.groups.flatMap((g) => g.fields.filter((f) => dl.includes(f.k)).map((f) => ({ sec, f }))); });
    if (mine.length) main.append(el('section', { class: 'cgroup' }, el('h2', {}, `Lo hará Avania (${mine.length})`), el('div', { class: 'clist' }, mine.map(({ sec, f }) =>
      el('a', { class: 'srow', href: `#/c/${id}/${sec.key}` }, el('span', {}, f.label), el('span', { class: 'state' }, sec.title), icon('chevd'))))));
    main.append(
    el('details', { class: 'cgroup contactcard' }, el('summary', {}, 'Datos fiscales, teléfonos, WhatsApp y correos'), renderSection(partOf(formDef, 'clinica', ['razon_social', 'telefonos'], 'Datos de la empresa', dental), sections.clinica || (sections.clinica = {}), { team: true, clientName: client.name, save: (p) => api('PUT', `/api/clients/${id}/sections/clinica`, p) })));
  } else if (t.key === 'personas') {
    const [skey, keys] = ['clinica', ['responsables']];
    const data = sections[skey] || (sections[skey] = {});
    main.append(el('p', { class: 'muted' }, t.key === 'personas' ? 'Las personas del cliente, el papel de cada una y si tienen acceso al portal. Es la misma información del alta.' : [lastChange(meta, 'agenda') || 'Sin modificaciones todavía.', ' Es la misma información del alta.']),
      renderSection(partOf(formDef, skey, keys, 'Personas'), data, { team: true, clientName: client.name, save: (p) => api('PUT', `/api/clients/${id}/sections/${skey}`, p) }));
    main.append(el('h2', { style: 'margin:22px 0 4px' }, 'Equipo del cliente'));
    await clientUsersTab(main, id);
  } else if (t.key === 'plan') {
    main.append(el('p', { class: 'muted' }, 'Todo lo que hacemos por el cliente, desde los documentos de investigación hasta el lanzamiento. Cada tarea tiene su responsable del equipo, fecha de inicio y de fin, y puede llevar subtareas. El cliente lo ve y sigue cada paso. Los cambios se guardan al momento.'),
      el('section', { class: 'card', style: 'margin:12px 0' }, phasesNode(fases, { team, edit: { save: (b) => api('PUT', `/api/clients/${id}/proceso`, b), error: (e) => toast(e.message) } })),
      el('section', { class: 'cgroup' }, el('h2', {}, 'Próximas acciones'), taskColumns(tasks, { mine: 'Del cliente', ours: 'Nuestras', limit: 5, href: (tk) => (tk.section === 'proceso' ? `#/c/${id}/plan` : `#/c/${id}/${tk.section}`) })),
      el('section', { class: 'cgroup' }, el('h2', {}, 'Fechas clave'), el('div', { class: 'card' }, liveTimeline(80))));
  } else if (t.key === 'resultados') {
    await resultsTab(main, { clientId: id, me, funnelsLocation: (sections.proyecto || {}).funnels_location });
  } else if (t.key === 'documentos') {
    const pvd = previewPane(), col = el('div');
    col.append(driveFilesNode((refresh) => api('GET', `/api/clients/${id}/drive${refresh ? '?refresh=1' : ''}`), { agency: true, onView: pvd.show,
      newFolder: ['super_admin', 'admin'].includes(me.role) ? (parent, name) => api('POST', `/api/clients/${id}/drive/folders`, { parent, name }) : null }));
    col.append(el('h2', { style: 'margin:22px 0 8px' }, 'Notas'));
    await notesTab(col, id);
    main.append(col);
  } else if (t.sec && !['accesos', 'meta'].includes(t.key)) {   // Web y Google y Meta se abren en la zona protegida
    const data = sections[t.key] || (sections[t.key] = {});
    const hasDocs = t.sec.groups.some((g) => g.fields.some((f) => f.type === 'docs' || f.type === 'fichas'));
    const pv = hasDocs ? previewPane() : null;
    // Con la subcuenta conectada el pipeline se detecta solo (o se elige de una lista si hay varios): el campo de ID sobra.
    let secDef = t.sec;
    if (t.key === 'negocio') {
      const tools = await pipelineTools(id, { pipelineId: data.pipeline_id, onLoaded: route });
      main.append(tools);
      if (tools.dataset?.connected) secDef = { ...t.sec, groups: t.sec.groups.map((g) => ({ ...g, fields: g.fields.filter((f) => f.k !== 'pipeline_id') })) };
    }
    if (t.key === 'cronograma') main.append(el('section', { class: 'card', style: 'margin-bottom:14px' }, el('h2', { style: 'margin:0 0 4px;font-size:16px' }, 'Fechas del proyecto'),
      el('p', { class: 'muted', style: 'margin:0 0 10px' }, 'Cambia cualquier fecha del cronograma aquí mismo: se guarda al momento. Se arma con la firma, el inicio, el rodaje, la formación y las acciones. Los horarios, festivos y fechas señaladas de la empresa no entran aquí: están en Empresa › Horarios.'), liveTimeline(80)));
    if (t.key === 'avania') main.append(avaniaExtras());
    const saveSec = async (p) => {
      const r = await api('PUT', `/api/clients/${id}/sections/${t.key}`, p);
      // Al indicar el pipeline de un cliente conectado se cargan solas todas sus etapas.
      if (t.key === 'negocio' && 'pipeline_id' in p) {
        if (r.stages_loaded) { toast(`Cargadas ${r.stages_loaded} etapas de «${r.pipeline}»`); setTimeout(route, 400); }
        else if (r.stages_error && String(p.pipeline_id).trim().length >= 15) toast(r.stages_error);
      }
      return r;
    };
    main.append(renderSection(secDef, data, { team: true, clientName: client.name, clientId: id, save: saveSec, preview: pv && pv.show }));
    if (t.key === 'zona') zonaCard(main, id);

  } else if (['accesos', 'meta', 'credenciales'].includes(t.key)) {
    // Zona restringida: Web y Google, Meta y las contraseñas. Se abre con la contraseña de la cuenta (10 minutos de uso).
    const nTab = (k) => { const p = progress.sections[k]; return p ? ` · ${p.done}/${p.total}` : ''; };
    main.prepend(el('div', { class: 'subtabs', role: 'group', 'aria-label': 'Zona restringida' }, [['accesos', 'Web y Google'], ['meta', 'Meta'], ['credenciales', 'Contraseñas']].map(([k, l]) =>
      el('a', { class: 'subtab' + (k === t.key ? ' on' : ''), href: `#/c/${id}/${k}`, 'aria-current': k === t.key ? 'page' : null }, l, k === 'credenciales' ? '' : nTab(k)))));
    const box = el('div'); main.append(box);
    if (me.can_see_passwords && !me.mfa_enabled) main.prepend(el('div', { class: 'banner' }, 'Para ver o copiar contraseñas activa la doble verificación en ', el('a', { href: '#/seguridad' }, 'Seguridad'), '.'));
    if (!me.can_see_passwords) main.prepend(el('div', { class: 'banner' }, 'Tu rol puede añadir y editar credenciales, pero no ver las contraseñas guardadas.'));
    // Las credenciales no se abren sin volver a escribir la contraseña de la cuenta (vale 10 minutos de uso).
    // Si caduca mientras se está dentro, la zona se vuelve a cerrar y pide la contraseña otra vez.
    const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { if (e.code === 'password_required') showLock(); throw e; } };
    const open = async () => {
      if (t.key !== 'credenciales') {
        const r = await guard(() => api('GET', `/api/clients/${id}/restricted`))();
        Object.assign(sections, r.sections);
        const data = sections[t.key] || (sections[t.key] = {});
        return box.replaceChildren(renderSection(t.sec, data, { team: true, clientName: client.name, save: guard((p) => api('PUT', `/api/clients/${id}/sections/${t.key}`, p)) }));
      }
      renderCredentials(box, {
      mode: 'team', services: formDef.services, canSee: me.can_see_passwords,
      list: guard(() => api('GET', `/api/clients/${id}/credentials`)),
      create: guard((b) => api('POST', `/api/clients/${id}/credentials`, b)),
      update: guard((cid, b) => api('PUT', `/api/credentials/${cid}`, b)),
      remove: me.can_see_passwords ? guard((cid) => api('DELETE', `/api/credentials/${cid}`)) : null,
      reveal: guard((cid, copy) => api('POST', `/api/credentials/${cid}/reveal`, { copy })),
      askCode,
      });
    };
    const showLock = () => {
      const err = el('div', { class: 'err', role: 'alert' });
      const pw = el('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: 'Tu contraseña de Avania Space…', id: 'lock-pw', name: 'password' });
      box.replaceChildren(el('form', { class: 'card', style: 'max-width:420px;margin:24px auto', onsubmit: async (e) => {
        e.preventDefault(); err.textContent = '';
        try { await api('POST', '/api/reauth', { password: pw.value }); open(); } catch (er) { err.textContent = er.message; pw.value = ''; pw.focus(); }
      } }, el('h2', { style: 'margin-top:0' }, 'Zona protegida'),
      el('p', { class: 'muted' }, 'Web y Google, Meta y las contraseñas de este cliente son de acceso restringido. Para abrirlas escribe de nuevo la contraseña de tu cuenta; quedan abiertas mientras las uses y se cierran tras 10 minutos sin tocarlas.'),
      el('label', { for: 'lock-pw' }, 'Contraseña'), pw, err, el('button', { class: 'btn', style: 'width:100%;margin-top:12px' }, 'Abrir zona protegida')));
      pw.focus();
    };
    api('GET', '/api/reauth').then((s) => (s.active ? open() : showLock())).catch(() => showLock());
  } else if (t.key === 'enlaces') {
    const fl = `${location.origin}/c/{{${client.funnels_contact_id && client.funnels_contact_id === (sections.proyecto || {}).funnels_location ? 'location' : 'contact'}.id}}`;
    const copy = (txt, msg) => navigator.clipboard.writeText(txt).then(() => toast(msg));
    const linkCard = (title, hint, url, btns) => el('div', { class: 'card', style: 'margin-bottom:14px' }, el('strong', {}, title), el('p', { class: 'muted', style: 'margin:2px 0 10px' }, hint),
      el('div', { class: 'row' }, el('code', { class: 'mono grow', style: 'overflow-wrap:anywhere' }, url), ...btns));
    main.append(await linksCard(id));
    main.append(
      linkCard('Enlace para el cliente', 'El formulario que rellena el cliente, sin cuenta. Se lo mandas o lo pones en su menú.', link, [
        el('button', { class: 'btn small', onclick: () => copy(link, 'Enlace del cliente copiado') }, 'Copiar'),
        el('a', { class: 'btn ghost small', href: link, target: '_blank', rel: 'noopener' }, 'Abrir')]),
      client.funnels_contact_id ? linkCard('Enlace para el submenú de Avania Funnels', 'Pégalo tal cual en el menú personalizado de Avania Funnels: cada cliente abre su propia ficha.', fl, [
        el('button', { class: 'btn small', onclick: () => copy(fl, 'Enlace para el submenú de Avania Funnels copiado') }, 'Copiar')]) : '',
      funnelsUrl
        ? linkCard('Subcuenta de Avania Funnels', 'Acceso directo a la subcuenta de este cliente.', funnelsUrl, [
          el('a', { class: 'btn small', href: funnelsUrl, target: '_blank', rel: 'noopener' }, 'Abrir subcuenta ↗'),
          el('button', { class: 'btn ghost small', onclick: () => copy(funnelsUrl, 'Enlace de la subcuenta copiado') }, 'Copiar')])
        : el('div', { class: 'card', style: 'margin-bottom:14px' }, el('strong', {}, 'Subcuenta de Avania Funnels'),
          el('p', { class: 'muted', style: 'margin:2px 0 10px' }, 'Falta el ID de la subcuenta de este cliente. Añádelo en Proyecto y empresa › Antes de empezar y aparecerá aquí el acceso directo.'),
          el('div', { class: 'row' }, el('a', { class: 'btn small', href: `#/c/${id}/proyecto` }, 'Añadir el ID de la subcuenta'), el('a', { class: 'btn ghost small', href: 'https://app.avania.marketing', target: '_blank', rel: 'noopener' }, 'Abrir AVANIA Funnels'))),
      el('div', { class: 'card', style: 'margin-bottom:14px' }, el('strong', {}, 'Otras plataformas'), el('p', { class: 'muted', style: 'margin:2px 0 10px' }, 'Accesos directos a las herramientas con las que se trabaja este cliente.'),
        el('div', { class: 'row' },
          el('a', { class: 'btn ghost small', href: 'https://zernio.com/dashboard/whatsapp-overview', target: '_blank', rel: 'noopener' }, 'Zernio · WhatsApp ↗'),
          el('a', { class: 'btn ghost small', href: 'https://setter.goavania.com/panel', target: '_blank', rel: 'noopener' }, 'Avania Setex ↗'))),
      el('div', { class: 'card' }, el('strong', {}, 'Gestión del enlace'), el('p', { class: 'muted', style: 'margin:2px 0 10px' }, 'Si el enlace se ha compartido por error, genera uno nuevo: el actual dejará de funcionar.'),
        el('div', { class: 'row' },
          el('button', { class: 'btn ghost small', onclick: async () => { if (await askConfirm({ title: 'Generar enlace nuevo', text: 'El enlace actual dejará de funcionar. ¿Generar uno nuevo?', ok: 'Generar enlace nuevo', danger: true })) { await api('PATCH', `/api/clients/${id}`, { rotate_token: true }); route(); } } }, 'Generar enlace nuevo'),
          el('button', { class: 'btn ghost small', onclick: async () => { const a = !client.archived; if (await askConfirm({ title: a ? 'Archivar cliente' : 'Reactivar cliente', text: a ? '¿Archivar este cliente? Su enlace dejará de funcionar.' : '¿Reactivar este cliente?', ok: a ? 'Archivar' : 'Reactivar', danger: a })) { await api('PATCH', `/api/clients/${id}`, { archived: a }); route(); } } }, client.archived ? 'Reactivar cliente' : 'Archivar cliente'))));
  } else {
    const { log } = await api('GET', `/api/clients/${id}/log`);
    main.append(el('div', { class: 'scroll' }, el('table', { class: 't' }, el('thead', {}, el('tr', {}, ['Cuándo', 'Quién', 'Acción', 'Servicio'].map((h) => el('th', {}, h)))),
      el('tbody', {}, log.length ? log.map((l) => el('tr', {}, el('td', {}, fmtDate(l.at, { dateStyle: 'short', timeStyle: 'short' })), el('td', {}, l.actor), el('td', {}, l.action), el('td', {}, l.service || '—'))) : el('tr', {}, el('td', { colspan: 4, class: 'muted' }, 'Sin movimientos.'))))));
  }

  // Datos básicos del cliente (nombre, ciudad, categoría, responsable, fechas y enlaces). Son los mismos campos de la ficha: se guardan al momento.
  const onlyFields = (skey, keys, title) => { const sec = partOf(formDef, skey, keys, title); return { ...sec, groups: sec.groups.map((g) => ({ ...g, title: '', intro: undefined, fields: g.fields.filter((f) => keys.includes(f.k)) })).filter((g) => g.fields.length) }; };
  function editClient() {
    const dataC = sections.clinica || (sections.clinica = {}), dataP = sections.proyecto || (sections.proyecto = {});
    if (!dataC.nombre_comercial) dataC.nombre_comercial = client.name;   // por si la ficha aún no los tiene: se ve lo que hay en el listado
    if (!dataP.categoria && client.category) dataP.categoria = client.category;
    if (!dataC.ciudad && client.city) dataC.ciudad = client.city;
    const note = el('p', { class: 'muted', style: 'margin:0 0 10px' }, `Dado de alta el ${fmtDate(client.created_at, { dateStyle: 'long' })}. Los cambios se guardan al momento y se ven en toda la ficha y en el listado de clientes.`);
    const warn = el('p', { class: 'muted', style: 'margin:0 0 6px;font-size:13px' }, 'Cambiar la categoría cambia las secciones y los estados que corresponden a este cliente; no se borra nada de lo ya rellenado.');
    const body = el('div', { class: 'card', style: 'width:min(820px,94vw)' }, el('h2', { style: 'margin-top:0' }, 'Datos del cliente'), note,
      renderSection(onlyFields('clinica', ['nombre_comercial', 'ciudad'], 'La empresa'), dataC, { team: true, clientName: client.name, save: (p) => api('PUT', `/api/clients/${id}/sections/clinica`, p) }),
      warn,
      renderSection(onlyFields('proyecto', ['categoria', 'responsable_cuenta', 'fecha_firma', 'fecha_inicio', 'enlace_clickup', 'enlace_drive', 'funnels_location'], 'El proyecto'), dataP, { team: true, clientName: client.name, save: (p) => api('PUT', `/api/clients/${id}/sections/proyecto`, p) }),
      el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Listo')));
    const m = openModal(body, { label: 'Datos del cliente', cls: 'client-modal', onClose: () => route() });
  }
  // Cronograma editable en el sitio: las fechas de los hitos se cambian aquí y se guardan al momento; abajo se añade una acción rápida.
  function liveTimeline(limit) {
    const box = el('div');
    let items = timeline;
    const refresh = async () => { items = (await api('GET', `/api/clients/${id}/timeline`)).timeline; draw(); };
    const edit = async ({ section, key }, value) => {
      try { await api('PUT', `/api/clients/${id}/sections/${section}`, { [key]: value }); (sections[section] ||= {})[key] = value; await refresh(); toast('Fecha guardada'); }
      catch (e) { toast(e.message); }
    };
    const what = el('input', { placeholder: 'Nueva acción…', 'aria-label': 'Nueva acción', style: 'flex:0 1 260px;min-width:160px' });
    const when = el('input', { type: 'date', ...DATE_ATTRS, 'aria-label': 'Fecha de la acción' });
    const who = el('select', { 'aria-label': 'Quién la hace' }, el('option', { value: 'acciones_avania' }, 'AVANIA'), el('option', { value: 'acciones_cliente' }, 'Cliente'));
    const add = async () => {
      if (!what.value.trim()) return what.focus();
      const key = who.value, cur = ((sections.cronograma || {})[key] || []).filter((r) => Object.values(r || {}).some((v) => String(v || '').trim()));
      try { await api('PUT', `/api/clients/${id}/sections/cronograma`, { [key]: [...cur, { accion: what.value.trim(), fecha: when.value, prioridad: 'Media', estado: 'Pendiente' }] }); toast('Acción añadida'); route(); }
      catch (e) { toast(e.message); }
    };
    const remove = async (t) => {
      if (!(await askConfirm({ title: 'Eliminar acción', text: `¿Eliminar «${t.label}» de las fechas del proyecto?`, ok: 'Eliminar', danger: true }))) return;
      const { key, i } = t.del, cur = ((sections.cronograma || {})[key] || []).filter((_, n) => n !== i);
      try { await api('PUT', `/api/clients/${id}/sections/cronograma`, { [key]: cur }); (sections.cronograma ||= {})[key] = cur; await refresh(); toast('Acción eliminada'); }
      catch (e) { toast(e.message); }
    };
    const toggle = async (t, done) => {
      const { key, i } = t.del, cur = ((sections.cronograma || {})[key] || []).map((r, n) => (n === i ? { ...r, estado: done ? 'Hecha' : 'Pendiente' } : r));
      try { await api('PUT', `/api/clients/${id}/sections/cronograma`, { [key]: cur }); (sections.cronograma ||= {})[key] = cur; await refresh(); toast(done ? 'Marcada como hecha' : 'Vuelve a estar pendiente'); }
      catch (e) { toast(e.message); }
    };
    const draw = () => box.replaceChildren(timelineNode(items, { limit, edit, remove, toggle }),
      el('form', { class: 'row', style: 'margin-top:12px;gap:8px;flex-wrap:wrap', onsubmit: (e) => { e.preventDefault(); add(); } }, what, when, who, el('button', { class: 'btn small' }, '+ Añadir a las tareas')));
    draw();
    return box;
  }
  // Cierre del onboarding: cuando el cliente y AVANIA terminan, sale solo el informe para la reunión (también se puede pedir a mano).
  function closingCard() {
    const ob = onboarding, sent = ob.report_sent_at;
    const act = async (fn) => { try { await fn(); } catch (e) { toast(e.message); } };
    const showReport = () => act(async () => {
      const r = await api('GET', `/api/clients/${id}/report`);
      const card = el('div', { class: 'card', style: 'width:min(760px,94vw)' }, el('h2', { style: 'margin-top:0' }, 'Informe de onboarding'), el('p', { class: 'muted' }, `Asunto: ${r.subject}`),
        el('iframe', { sandbox: '', srcdoc: r.html, title: 'Vista previa del informe', style: 'width:100%;height:60vh;border:1px solid var(--line);border-radius:8px;background:#fff' }),
        el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cerrar')));
      const m = openModal(card, { label: 'Vista previa del informe' });
    });
    const send = () => act(async () => {
      if (!(await askConfirm({ title: 'Enviar el informe', text: `Se enviará a ${ob.report_to} con todo lo que hay ahora en la ficha.`, ok: 'Enviar informe' }))) return;
      const r = await api('POST', `/api/clients/${id}/report`); toast(`Informe enviado a ${r.to}`); route();
    });
    const toggle = () => act(async () => {
      const done = !ob.team_done_at;
      const r = await api('POST', `/api/clients/${id}/team-done`, { done });
      toast(r.sent ? `Informe enviado a ${ob.report_to}` : r.error ? `Parte cerrada, pero el informe no salió: ${r.error}` : done ? (r.onboarding.client_done ? 'Parte de AVANIA cerrada' : 'Parte de AVANIA cerrada: el informe saldrá cuando el cliente termine') : 'Parte de AVANIA reabierta');
      route();
    });
    return el('section', { class: 'card closecard', style: 'margin-top:14px' },
      el('div', { class: 'grow' }, el('strong', {}, 'Cierre del onboarding'),
        el('p', { class: 'muted', style: 'margin:2px 0 0' }, `Cliente: ${ob.client_done ? 'ha terminado' : 'rellenando'} · AVANIA: ${ob.team_done_at ? 'terminada' : 'en curso'} · Informe a ${ob.report_to}: ${sent ? `enviado el ${fmtDate(sent)}` : 'se envía solo cuando terminan los dos'}.`)),
      el('button', { class: ob.team_done_at ? 'btn ghost small' : 'btn small', onclick: toggle }, ob.team_done_at ? 'Reabrir nuestra parte' : 'Nuestra parte está terminada'),
      el('button', { class: 'btn ghost small', onclick: showReport }, 'Ver informe'),
      el('button', { class: 'btn ghost small', onclick: send }, sent ? 'Reenviar informe' : 'Enviar informe ahora'));
  }
  // «Nosotros»: los enlaces de AVANIA para este cliente (Drive, Avania Funnels, Avania Setex y ClickUp) y el equipo, cargado desde el directorio.
  function avaniaExtras() {
    const pr = sections.proyecto || {}, wa = sections.whatsapp || {};
    // Logos de Drive y ClickUp; para Avania Funnels y Avania Setex, una pastilla con su inicial.
    const mark = (app, letter) => (app ? el('span', { class: 'tmark' }, appIcon(app)) : el('span', { class: 'tmark letter', 'aria-hidden': 'true' }, letter));
    const tile = (name, url, sub, add, app, letter) => url
      ? el('a', { class: 'linktile', href: url, target: '_blank', rel: 'noopener' }, mark(app, letter), el('span', { class: 'tname' }, el('b', {}, name), el('small', {}, sub)), el('span', { class: 'tgo', 'aria-hidden': 'true' }, '↗'))
      : el('a', { class: 'linktile off', href: add }, mark(app, letter), el('span', { class: 'tname' }, el('b', {}, name), el('small', {}, 'Falta el enlace · añadirlo')));
    const load = async () => {
      try { const r = await api('POST', `/api/clients/${id}/load-agency-people`); toast(r.added ? `Añadidas ${r.added} personas del equipo de AVANIA` : 'Ya están todas las personas del equipo'); route(); } catch (e) { toast(e.message); }
    };
    return el('section', { class: 'card', style: 'margin-bottom:14px' }, el('h2', { style: 'margin:0 0 4px;font-size:16px' }, 'Enlaces de AVANIA para este cliente'),
      el('p', { class: 'muted', style: 'margin:0' }, 'Su carpeta, su subcuenta, su asistente de WhatsApp y su espacio de trabajo. Se editan en «Proyecto y enlaces de AVANIA» y en «WhatsApp».'),
      el('div', { class: 'linkgrid' },
        tile('Google Drive', toUrl(pr.enlace_drive), 'Carpeta del cliente', `#/c/${id}/proyecto`, 'drive'),
        tile('Avania Funnels', funnelsUrl, 'Subcuenta del cliente', `#/c/${id}/proyecto`, null, 'F'),
        tile('Avania Setex', toUrl(wa.setex_enlace), wa.setex_numero ? `WhatsApp ${wa.setex_numero}` : 'Panel del asistente', `#/c/${id}/whatsapp`, null, 'S'),
        tile('ClickUp', toUrl(pr.enlace_clickup), 'Espacio del proyecto', `#/c/${id}/proyecto`, 'clickup')),
      el('div', { class: 'row', style: 'margin-top:12px' }, el('button', { class: 'btn small', onclick: load }, 'Cargar el equipo de AVANIA'),
        el('span', { class: 'muted' }, 'Añade a la tabla de abajo las personas del directorio (se editan en Configuración) sin tocar lo que ya hayas escrito.')));
  }

  const setStatus = (v) => api('PATCH', `/api/clients/${id}`, { status: v }).then(() => { toast('Estado actualizado'); route(); });
  const STEPS = Object.keys(STATUS).filter((k) => statuses.includes(k) || k === client.status);   // los pasos de su categoría (y el actual, por si viene de otra)
  const stepper = el('div', { class: 'steps', role: 'group', 'aria-label': 'Estado del cliente' }, STEPS.map((v, i) => el('button', { type: 'button',
    class: v === client.status ? 'on' : i < STEPS.indexOf(client.status) && client.status !== 'pausada' ? 'done' : '', 'aria-pressed': String(v === client.status),
    onclick: () => v !== client.status && setStatus(v) }, STATUS[v])));
  const pr = sections.proyecto || {};
  const appBtn = (app, url) => url
    ? el('a', { class: 'appbtn', href: url, target: '_blank', rel: 'noopener', title: `Abrir ${appName(app)}`, 'aria-label': `Abrir ${appName(app)}` }, appIcon(app))
    : el('a', { class: 'appbtn off', href: `#/c/${id}/proyecto`, title: `Añadir el enlace de ${appName(app)}`, 'aria-label': `Añadir el enlace de ${appName(app)}` }, appIcon(app));
  view.replaceChildren(
    el('div', { class: 'row', style: 'margin-bottom:12px' },
      el('a', { href: '#/', class: 'btn ghost small' }, '← Clientes'), logoButton(client, () => route()), el('h1', { class: 'editname', tabindex: 0, role: 'button', title: 'Modificar los datos del cliente', onclick: () => editClient(), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editClient(); } } }, client.name, el('span', { class: 'editpen', 'aria-hidden': 'true' }, '✎')),
      client.category ? catPill(client.category, client.category_color) : '', el('span', { class: 'grow' }),
      // Accesos rápidos: botones pequeños con icono (el nombre sale al pasar el ratón y lo lee el lector de pantalla).
      canPreview ? iconBtn('ojo', 'Vista de cliente: ver esta ficha tal como la ve el cliente', { href: `#/c/${id}/${t.key}?vista=cliente`, cls: 'primary' }) : '',
      iconBtn('enlace', 'Copiar enlace del cliente', { onclick: () => navigator.clipboard.writeText(link).then(() => toast('Enlace del cliente copiado')) }),
      funnelsUrl ? iconBtn('embudo', 'Abrir en Avania Funnels: la subcuenta de este cliente', { href: funnelsUrl, external: true }) : iconBtn('embudo', 'Falta el ID de la subcuenta de Avania Funnels: añadirlo', { href: `#/c/${id}/proyecto`, cls: 'off' }),
      appBtn('clickup', toUrl(pr.enlace_clickup)), appBtn('drive', toUrl(pr.enlace_drive)),
      helpButton(ayuda[t.key], t.title) || ''),
    el('div', { class: 'row', style: 'margin-bottom:18px' }, stepper, el('span', { class: 'grow' }),
      el('div', { class: 'row', title: 'Campos del cliente rellenados' }, el('span', { class: 'muted' }, 'Cliente'), bar(progress.pct, 'client'), el('span', { class: 'num' }, `${progress.pct}%`)),
      el('div', { class: 'row', title: 'Campos de la agencia rellenados', style: 'margin-left:14px' }, el('span', { class: 'muted' }, 'AVANIA'), bar(progress.team.pct, 'agency'), el('span', { class: 'num' }, `${progress.team.pct}%`))),
    main);
}

// Pantalla de bloqueo reutilizable (contraseña de la cuenta); al acertar llama a onOpen.
function lockCard(box, onOpen, text) {
  const err = el('div', { class: 'err', role: 'alert' });
  const pw = el('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: 'Tu contraseña de Avania Space…', id: 'lock-pw', name: 'password' });
  box.replaceChildren(el('form', { class: 'card', style: 'max-width:420px;margin:24px auto', onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    try { await api('POST', '/api/reauth', { password: pw.value }); onOpen(); } catch (er) { err.textContent = er.message; pw.value = ''; pw.focus(); }
  } }, el('h2', { style: 'margin-top:0' }, 'Zona protegida'),
  el('p', { class: 'muted' }, text || 'Para abrirla escribe de nuevo la contraseña de tu cuenta; queda abierta mientras la uses y se cierra tras 10 minutos sin tocarla.'),
  el('label', { for: 'lock-pw' }, 'Contraseña'), pw, err, el('button', { class: 'btn', style: 'width:100%;margin-top:12px' }, 'Abrir zona protegida')));
  pw.focus();
}

// ───────── Vista de cliente (solo administradores): cada página tal como la ve el cliente, sin guardar nada ─────────
async function clientPreview({ id, tab, client, views = {}, sections, fd, dental, role }) {
  const resp = role === 'responsable';
  const sfx = `?vista=cliente${resp ? '' : '&rol=miembro'}`;
  const info = fd.form.filter((x) => agencyOnly(x) && views[x.key]);
  const pages = [{ key: 'resumen', title: 'Inicio' }, ...(views.plan ? [{ key: 'plan', title: 'Tareas' }] : []), ...(views.resultados ? [{ key: 'resultados', title: 'Resultados' }] : []), ...(views.personas ? [{ key: 'personas', title: 'Mis datos · Personas y contactos' }] : []),
    ...(views.zona ? [{ key: 'zona', title: 'Área de influencia' }] : []), ...(info.length ? [{ key: 'info', title: 'Información' }] : []), ...(views.documentos ? [{ key: 'documentos', title: 'Documentos' }] : []), ...(resp ? [{ key: 'equipo', title: 'Mi equipo' }] : [])];
  const secTabs = fd.form.filter((x) => !agencyOnly(x) && views[x.key] !== false).map((x) => ({ key: x.key, title: x.title, short: x.short, sec: x }));
  const credTab = resp && views.credenciales !== false ? { key: 'credenciales', title: 'Credenciales' } : null;
  const all = [...pages, ...secTabs, ...(credTab ? [credTab] : [])];
  const t = all.find((x) => x.key === tab) || all[0];
  const item = (x) => ({ href: `#/c/${id}/${x.key}${sfx}`, key: x.key, label: x.short || x.title, on: x.key === t.key });
  setSide({ title: client.name, noLegend: true, top: pages.map(item), groups: fd.blocks.map((b) => ({ key: b.key, title: b.short, badge: '',
    items: [...b.sections.map((k) => secTabs.find((x) => x.key === k)).filter(Boolean), ...(b.key === 'tecnico' && credTab ? [credTab] : [])].map(item) })).filter((g) => g.items.length) });

  const roleLink = (r, label) => el('a', { class: 'btn small' + (r === role ? '' : ' ghost'), 'aria-current': r === role ? 'true' : null, href: `#/c/${id}/${t.key}?vista=cliente${r === 'miembro' ? '&rol=miembro' : ''}` }, label);
  const bar = el('div', { class: 'pvbar', role: 'region', 'aria-label': 'Vista de cliente' },
    el('span', { class: 'pvtag' }, icon('ojo'), 'Vista de cliente'), el('span', { class: 'grow pvtext' }, `Así lo ve ${client.name}. Aquí puedes cambiar sus datos igual que hace el cliente: se guardan en su ficha.`),
    el('span', { class: 'row', style: 'gap:6px' }, el('span', { class: 'muted' }, 'Ver como'), roleLink('responsable', 'Responsable'), roleLink('miembro', 'Miembro')),
    el('a', { class: 'btn small', href: `#/c/${id}/${t.key}` }, 'Salir de la vista de cliente'));

  const main = el('div', { class: 'pvpage' });
  const page = el('div', { class: 'pvbody' });
  const noSave = async () => ({});
  // Lectura y escritura, como en el portal: lo que se cambia aquí se guarda en la ficha del cliente. Solo los enlaces que llevan al portal del cliente quedan inactivos (aquí no hay sesión de cliente).
  const saveFor = (skey) => async (p) => { const r = await api('PUT', `/api/clients/${id}/sections/${skey}`, p); sections[skey] = { ...(sections[skey] || {}), ...p }; return r; };
  const freeze = (root = page) => {
    root.querySelectorAll('a').forEach((a) => { if (a.target !== '_blank') { a.tabIndex = -1; a.setAttribute('aria-disabled', 'true'); } });
  };
  const put = (...nodes) => { page.replaceChildren(...nodes); main.replaceChildren(page); freeze(); };
  const partial = (skey, keys, title) => put(el('h1', {}, title), renderSection(partOf(formDef, skey, keys, title, dental), sections[skey] || (sections[skey] = {}), { team: false, save: saveFor(skey) }));
  const unlocked = async (fn) => { try { await fn(); } catch (e) { if (e.code === 'password_required') lockCard(main, () => unlocked(fn), 'Esta parte del cliente es de acceso restringido. Escribe de nuevo la contraseña de tu cuenta para ver cómo la ve.'); else throw e; } };

  if (t.key === 'resumen' || t.key === 'documentos' || t.key === 'plan') {
    const h = await api('GET', `/api/clients/${id}/preview/home?role=${role}`);
    put(...(t.key === 'resumen' ? homeNodes(h, { preview: true }) : t.key === 'plan' ? [el('h1', {}, 'Tareas'), el('section', { class: 'card', style: 'margin:14px 0' }, phasesNode(h.fases, { viewer: 'cliente' })), el('section', { class: 'cgroup' }, el('h2', {}, 'Fechas clave'), el('div', { class: 'card' }, timelineNode(h.timeline || [])))] : docsNodes(h, { loadFiles: () => api('GET', `/api/clients/${id}/drive`).then((r) => (r.state === 'ok' || r.state === 'sin_carpeta' ? r : { state: 'no_disponible' })) })));
  } else if (t.key === 'personas') partial('clinica', ['responsables', 'telefonos'], 'Personas y contactos');
  else if (t.key === 'zona') { const box = el('div'); zonaCard(box, id); put(el('h1', {}, 'Área de influencia'), el('p', { class: 'muted' }, 'La zona en la que trabajamos para vuestra campaña, con sus localidades y los datos de población y renta.'), box); }
  else if (t.key === 'info') {
    const hide = (f) => /pass|secret|clave|token/i.test(`${f.type || ''} ${f.k || ''}`);
    put(el('h1', {}, 'Información'), el('p', { class: 'muted' }, 'Lo que AVANIA ha preparado para vosotros. El cliente solo puede leerlo; se cambia desde la ficha.'),
      ...info.map((def) => renderSection({ ...def, groups: def.groups.map((g) => ({ ...g, fields: g.fields.filter((f) => !hide(f)) })) }, sections[def.key] || {}, { team: false, save: noSave })));
    page.querySelectorAll('button, input, select, textarea').forEach((x) => { x.disabled = true; });
  }
  else if (t.key === 'resultados') {
    const r = await api('GET', `/api/clients/${id}/kpis`).catch(() => ({ connected: false }));
    put(el('h1', {}, 'Resultados'), r.connected ? kpisNode(r.kpis) : el('div', { class: 'card' }, el('p', { class: 'muted', style: 'margin:0' }, 'Todavía no hay resultados que enseñar. Aparecerán aquí en cuanto la campaña esté en marcha.')));
  }
  else if (t.key === 'equipo') {
    const { users } = await api('GET', `/api/clients/${id}/users`);
    put(el('h1', {}, 'Mi equipo'), el('p', { class: 'muted' }, 'Las personas de vuestra empresa con acceso a este espacio.'),
      el('div', { class: 'card', style: 'margin:14px 0' }, users.length ? el('div', { class: 'plist' }, users.map((u) => el('div', { class: 'prow' },
        el('span', { class: 'grow' }, el('strong', {}, u.name || u.email), el('small', { class: 'muted', style: 'display:block' }, `${u.email} · ${u.role === 'responsable' ? 'Responsable' : 'Miembro'}${u.pending ? ' · invitación pendiente' : ''}`))))) : el('p', { class: 'muted', style: 'margin:0' }, 'Todavía nadie.')));
  } else if (t.key === 'credenciales') {
    await unlocked(async () => {
      const { credentials } = await api('GET', `/api/clients/${id}/credentials`);
      const box = el('div'); put(el('h1', {}, 'Credenciales'), box);
      renderCredentials(box, { mode: 'client', services: formDef.services, list: () => api('GET', `/api/clients/${id}/credentials`), create: (b) => api('POST', `/api/clients/${id}/credentials`, b), update: (cid, b) => api('PUT', `/api/credentials/${cid}`, b) });
    });
  } else if (t.sec) {
    const secData = async () => (['accesos', 'meta'].includes(t.key) ? (await api('GET', `/api/clients/${id}/restricted`)).sections[t.key] : sections[t.key]) || {};
    await unlocked(async () => { const data = await secData(); put(el('h1', {}, `${t.sec.num} ${t.sec.title}`), renderSection(t.sec, data, { team: false, save: saveFor(t.key) })); });
  }
  view.replaceChildren(bar, main);
}

// ───────── Equipo ─────────
// Alta de usuario en un solo diálogo (correo, nombre y rol); resuelve con los datos o con null.
function newUserDialog() {
  return new Promise((resolve) => {
    const email = el('input', { id: 'nu-correo', name: 'email', type: 'email', autocomplete: 'off', spellcheck: false, required: true, 'data-autofocus': '' });
    const name = el('input', { id: 'nu-nombre', name: 'name', autocomplete: 'off' });
    const role = el('select', { id: 'nu-rol', name: 'role' }, el('option', { value: 'member' }, 'Miembro: no ve las contraseñas'), el('option', { value: 'admin' }, 'Administrador: ve contraseñas con doble verificación'));
    const card = el('form', { class: 'card', onsubmit: (e) => { e.preventDefault(); d.close({ email: email.value.trim(), name: name.value.trim(), role: role.value }); } },
      el('h2', {}, 'Nuevo usuario'), el('label', { for: 'nu-correo' }, 'Correo'), email, el('label', { for: 'nu-nombre', style: 'margin-top:10px' }, 'Nombre'), name,
      el('label', { for: 'nu-rol', style: 'margin-top:10px' }, 'Rol'), role,
      el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => d.close(null) }, 'Cancelar'), el('button', { class: 'btn' }, 'Crear usuario')));
    const d = openModal(card, { label: 'Nuevo usuario', onClose: (v) => resolve(v || null) });
  });
}
async function teamView() {
  const { users } = await api('GET', '/api/users');
  const showTemp = (email, pw) => notice({ title: `Contraseña temporal de ${email}`, text: 'Cópiala ahora: no se vuelve a mostrar. Tendrá que cambiarla al entrar.', secret: pw });
  const act = async (u, body) => { const r = await api('PATCH', `/api/users/${u.id}`, body); if (r.temp_password) await showTemp(u.email, r.temp_password); route(); };
  view.replaceChildren(
    el('div', { class: 'row', style: 'margin-bottom:12px' }, el('h1', { class: 'grow' }, 'Equipo agencia'),
      el('button', { class: 'btn', onclick: async () => {
        const nu = await newUserDialog(); if (!nu) return;
        try {
          const r = await api('POST', '/api/users', nu);
          if (r.email_sent) await notice({ title: 'Usuario creado', text: `Le hemos enviado un correo a ${nu.email} con el enlace para elegir su contraseña (caduca en 48 horas).` });
          else { await notice({ title: 'Usuario creado, pero el correo no ha salido', text: String(r.email_error || '') }); await showTemp(nu.email, r.temp_password); }
          route();
        } catch (e) { toast(e.message); }
      } }, '+ Nuevo usuario')),
    me.mfa_enabled ? '' : el('div', { class: 'banner row' }, el('span', { class: 'grow' }, el('strong', {}, 'Tu doble verificación no está activa. '), 'Sin ella no puedes ver ni copiar contraseñas.'), el('button', { class: 'btn small', onclick: goMfa }, 'Activar doble verificación')),
    el('p', { class: 'muted', style: 'margin:0 0 14px' }, el('strong', {}, 'Administrador'), ': ve y copia contraseñas (con doble verificación) y borra credenciales. ', el('strong', {}, 'Miembro'), ': trabaja con los clientes y puede añadir o editar credenciales, pero no ver las contraseñas.'),
    el('div', { class: 'card teamlist' },
      el('div', { class: 'trow thead', 'aria-hidden': 'true' }, ['Usuario', 'Rol', 'Doble verificación', 'Estado', ''].map((h) => el('span', {}, h))),
      users.map((u) => el('div', { class: 'trow' },
        el('div', { class: 'tuser' }, el('span', { class: 'uav', 'aria-hidden': 'true' }, (u.name || u.email)[0].toUpperCase()), el('div', {}, el('strong', {}, u.name || u.email), el('div', { class: 'muted' }, u.email))),
        el('div', { class: 'tcell', 'data-l': 'Rol' }, u.role === 'super_admin' ? ROLE.super_admin : el('select', { 'aria-label': `Rol de ${u.name || u.email}`, onchange: (e) => act(u, { role: e.target.value }) }, ['admin', 'member'].map((r) => el('option', { value: r, selected: u.role === r }, ROLE[r])))),
        el('div', { class: 'tcell', 'data-l': 'Doble verificación' }, u.totp_enabled || u.n_passkeys ? el('span', { class: 'pill ok' }, u.n_passkeys ? (u.totp_enabled ? 'app + llave' : 'llave') : 'activa') : el('span', { class: 'pill warn' }, 'sin activar')),
        el('div', { class: 'tcell', 'data-l': 'Estado' }, u.active ? el('span', { class: 'pill ok' }, 'activo') : el('span', { class: 'pill bad' }, 'desactivado')),
        el('div', { class: 'tacts' }, !u.totp_enabled && !u.n_passkeys && u.email === me.email ? el('button', { class: 'btn small', onclick: goMfa }, 'Activar doble verificación') : '', u.role === 'super_admin' ? '' : [
          u.must_change_password ? el('button', { class: 'btn ghost small', onclick: async () => { const r = await api('PATCH', `/api/users/${u.id}`, { resend_invite: true }); toast(r.invite === 'sent' ? `Correo enviado a ${u.email}` : `No se ha podido enviar: ${r.invite}`); } }, 'Reenviar acceso') : '',
          el('button', { class: 'btn ghost small', onclick: async () => (await askConfirm({ title: 'Nueva contraseña temporal', text: 'Se generará una contraseña temporal y se mostrará una sola vez.', ok: 'Generar contraseña' })) && act(u, { reset_password: true }) }, 'Nueva contraseña'),
          u.totp_enabled || u.n_passkeys ? el('button', { class: 'btn ghost small', onclick: async () => (await askConfirm({ title: 'Reiniciar doble verificación', text: '¿Quitar su doble verificación? Tendrá que configurarla de nuevo.', ok: 'Reiniciar', danger: true })) && act(u, { reset_mfa: true }) }, 'Reiniciar 2FA') : '',
          el('button', { class: 'btn ghost small', onclick: () => act(u, { active: !u.active }) }, u.active ? 'Desactivar' : 'Activar')])))));
}

// ───────── Seguridad ─────────
let autoMfa = false;
const goMfa = () => { if (location.hash === '#/seguridad') route(); else location.hash = '#/seguridad'; };
async function securityView() {
  const box = el('div', { class: 'card seccard' });
  const draw = async () => {
    me = (await api('GET', '/api/me')).user;
    box.replaceChildren(el('h2', {}, 'Código de una app'));
    if (me.has_totp) { box.append(el('p', {}, el('span', { class: 'pill ok' }, 'Activa'), ' Se te pedirá el código de tu app antes de ver o copiar cualquier contraseña.')); return; }
    box.append(el('p', { class: 'muted' }, 'Escanea el código con Google Authenticator, Authy o similar, y escribe el código de 6 cifras que muestre.'));
    const start = el('button', { class: 'btn', onclick: async () => {
      const r = await api('POST', '/api/mfa/setup'); const err = el('div', { class: 'err', role: 'alert' });
      const inp = el('input', { id: 'mfa-code', name: 'code', inputmode: 'numeric', autocomplete: 'one-time-code', spellcheck: false, maxlength: 6, placeholder: '000000', 'aria-label': 'Código de 6 cifras', style: 'width:140px' });
      box.append(el('div', {}, el('img', { src: r.qr, alt: 'Código QR para tu app de códigos', width: 220, height: 220, style: 'display:block;margin:10px 0' }), el('div', { class: 'muted' }, 'Si no puedes escanear, clave manual: ', el('code', { class: 'mono' }, r.secret)),
        el('div', { class: 'row', style: 'margin-top:10px' }, inp, el('button', { class: 'btn', onclick: async () => { try { await api('POST', '/api/mfa/enable', { code: inp.value }); toast('Doble verificación activada'); draw(); } catch (e) { err.textContent = e.message; } } }, 'Activar'), err)));
      start.remove();
    } }, 'Activar doble verificación');
    box.append(start);
    if (autoMfa) { autoMfa = false; start.click(); }
  };
  // Llaves de acceso: huella, cara, PIN o llave física (también las que guarda Google Password Manager).
  const pkBox = el('div', { class: 'card seccard' });
  const drawPk = async () => {
    pkBox.replaceChildren(el('h2', {}, 'Llave de acceso'));
    if (!passkeysOk()) { pkBox.append(el('p', { class: 'muted' }, 'Este navegador no admite llaves de acceso.')); return; }
    const { passkeys } = await api('GET', '/api/passkeys');
    pkBox.append(el('p', { class: 'muted' }, 'Confirma con tu huella, tu cara, el PIN del equipo o una llave física, sin escribir códigos. Sirve para ver y copiar contraseñas.'));
    if (passkeys.length) pkBox.append(el('div', { style: 'margin-bottom:10px' }, passkeys.map((k) => el('div', { class: 'row', style: 'padding:6px 0;border-bottom:1px solid var(--line)' },
      el('span', { class: 'grow' }, el('strong', {}, k.name), el('div', { class: 'muted' }, `Añadida el ${fmtDate(k.created_at)}` + (k.last_used_at ? ` · usada el ${fmtDate(k.last_used_at)}` : ''))),
      el('button', { class: 'btn ghost small', onclick: async () => {
        const pw = await askPassword('Para quitar esta llave de acceso, confirma tu contraseña.'); if (pw == null) return;
        try { await api('DELETE', `/api/passkeys/${k.id}`, { password: pw }); toast('Llave quitada'); me = (await api('GET', '/api/me')).user; await drawPk(); await draw(); } catch (e) { toast(e.message); }
      } }, 'Quitar')))));
    pkBox.append(el('button', { class: 'btn', onclick: async () => {
      const pw = await askPassword('Para añadir una llave de acceso, confirma tu contraseña.'); if (pw == null) return;
      try {
        const { options } = await api('POST', '/api/passkeys/options', { password: pw });
        const response = await createPasskey(options);
        const name = (await askText({ title: 'Nombre de la llave', label: 'Un nombre para reconocerla', value: 'Llave de acceso', hint: 'Por ejemplo, «Mi portátil» o «Móvil».', ok: 'Guardar' })) || 'Llave de acceso';
        await api('POST', '/api/passkeys', { response, name });
        toast('Llave de acceso añadida'); me = (await api('GET', '/api/me')).user; await drawPk(); await draw();
      } catch (e) { toast(e.name === 'NotAllowedError' ? 'Cancelado o no se pudo crear la llave' : e.message); }
    } }, passkeys.length ? '+ Añadir otra llave de acceso' : 'Añadir llave de acceso'));
  };
  view.replaceChildren(el('h1', { style: 'margin-bottom:4px' }, 'Seguridad'),
    el('p', { class: 'muted', style: 'margin:0 0 14px' }, 'Cómo entras y cómo confirmas las acciones delicadas, como ver una contraseña guardada.'),
    el('div', { class: 'secgrid' }, el('div', { class: 'seccol' }, pkBox, box), passwordView(false)));
  await Promise.all([draw(), drawPk()]);
}

boot();
