// Piezas compartidas por el panel del equipo y la página pública del cliente.
export const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'value') n.value = v;
    else if (k === 'checked') n.checked = !!v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};

const DIAS = [['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'], ['jueves', 'Jueves'], ['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo']];

// Enlaces: se aceptan "https://…" y "www.…". Junto al campo sale un botón "Abrir" que sigue lo que se escribe.
export const toUrl = (v) => { const t = String(v || '').trim(); return /^https?:\/\/\S+$/i.test(t) ? t : /^www\.\S+\.\S+$/i.test(t) ? 'https://' + t : null; };
function urlRow(input) {
  const a = el('a', { class: 'btn ghost small', target: '_blank', rel: 'noopener' }, 'Abrir ↗');
  const sync = () => { const u = toUrl(input.value); a.href = u || '#'; a.style.display = u ? '' : 'none'; };
  input.addEventListener('input', sync); sync();
  return el('div', { class: 'urlrow' }, input, a);
}

// Correos: junto al campo (o la fila) sale un icono de sobre que abre el programa de correo con un mensaje nuevo para esa dirección.
const MAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function mailLink(email, who) {
  const a = el('a', { class: 'mailbtn', title: 'Enviar correo' + (who ? ` a ${who}` : ''), 'aria-label': 'Enviar correo' + (who ? ` a ${who}` : '') });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.innerHTML = '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.500 7l8.500 6 8.500-6"/>';
  a.append(svg);
  const set = (v) => { const t = String(v || '').trim(); a.hidden = !MAIL_OK.test(t); if (!a.hidden) a.href = `mailto:${t}`; };
  set(email);
  return Object.assign(a, { set });
}
// Caja de texto con su icono «enviar correo», que sigue lo que se escribe.
function mailRow(input, who) {
  const m = mailLink(input.value, who);
  input.addEventListener('input', () => m.set(input.value));
  return el('div', { class: 'urlrow' }, input, m);
}
const isMailCol = (c) => c.type === 'email' || /^(correo|email)$/i.test(c.k);

let uid = 0;
// Los avisos salen en una región viva para que el lector de pantalla los lea.
const toasts = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
document.body.append(toasts);
export const toast = (msg) => {
  const t = el('div', { class: 'toast' }, msg);
  toasts.append(t);
  setTimeout(() => t.remove(), 2400);
};

// Fechas según el idioma de la página (no un formato fijo).
export const fmtDate = (d, opts = { dateStyle: 'medium' }) => new Intl.DateTimeFormat(document.documentElement.lang || undefined, opts).format(new Date(d));

// ───────── Diálogos propios (sustituyen a prompt, confirm y alert) ─────────
// Con rol de diálogo, foco atrapado, Esc, clic fuera y devolución del foco al cerrar. `onClose(valor)` se llama una sola vez.
const modalStack = [];
export function openModal(card, { label, onClose, cls = '' } = {}) {
  const prev = document.activeElement;
  const m = el('div', { class: ('modal ' + cls).trim() }, card);
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.tabIndex = -1;
  if (label) card.setAttribute('aria-label', label);
  const tabbables = () => [...card.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  const token = {};
  const onKey = (e) => {
    if (modalStack[modalStack.length - 1] !== token) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = tabbables();
    if (!f.length) { e.preventDefault(); card.focus(); return; }
    const at = document.activeElement;
    if (e.shiftKey && (at === f[0] || at === card)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && at === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  };
  let done = false;
  function close(v) {
    if (done) return; done = true;
    document.removeEventListener('keydown', onKey, true);
    modalStack.splice(modalStack.indexOf(token), 1);
    m.remove();
    try { if (prev && prev.isConnected && prev.focus) prev.focus(); } catch { /* sin foco previo */ }
    if (onClose) onClose(v);
  }
  m.addEventListener('mousedown', (e) => { if (e.target === m) close(); });
  modalStack.push(token); document.addEventListener('keydown', onKey, true);
  document.body.append(m);
  (card.querySelector('[data-autofocus]') || tabbables()[0] || card).focus();
  return { close, el: m };
}
const tabMemo = {};
const ANALIZABLE = new Set(['documento', 'hoja', 'presentación', 'pdf']);
/** Explorador de la carpeta de Drive del cliente para elegir un archivo. Devuelve { id, name, kind, url, folder, modified } o null. */
function pickDriveFile(clientId) {
  return new Promise(async (resolve) => {
    const list = el('div', { class: 'pk-list' }, el('p', { class: 'muted' }, 'Leyendo la carpeta de Google Drive…'));
    const search = el('input', { type: 'search', class: 'dsearch', placeholder: 'Buscar archivo…', 'aria-label': 'Buscar archivo', autocomplete: 'off', 'data-autofocus': '' });
    const card = el('div', { class: 'card pk' }, el('h2', {}, 'Elegir archivo de Google Drive'),
      el('p', { class: 'muted' }, 'Archivos de la carpeta del cliente. Space puede leer Documentos, Hojas y Presentaciones de Google y PDF.'), search, list,
      el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => d.close(null) }, 'Cancelar')));
    const d = openModal(card, { label: 'Elegir archivo de Google Drive', onClose: (v) => resolve(v ?? null) });
    let all = [];
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const rows = all.filter((f) => !q || `${f.name} ${f.folder}`.toLowerCase().includes(q));
      list.replaceChildren(...(rows.length ? rows.map((f) => {
        const ok = ANALIZABLE.has(f.kind);
        return el('button', { type: 'button', class: 'pk-row', disabled: !ok, title: ok ? '' : 'Space no puede leer este tipo de archivo', onclick: () => d.close(f) },
          el('span', { class: 'pk-kind' }, f.kind), el('span', { class: 'grow' }, el('strong', {}, f.name), el('small', { class: 'muted', style: 'display:block' }, f.folder)),
          f.modified ? el('small', { class: 'muted' }, fmtDate(f.modified, { dateStyle: 'short' })) : '');
      }) : [el('p', { class: 'muted' }, all.length ? 'Ningún archivo coincide.' : 'No hay archivos en la carpeta.')]));
    };
    search.oninput = draw;
    try {
      const r = await api('GET', `/api/clients/${clientId}/drive`);
      if (r.state !== 'ok') { list.replaceChildren(el('p', { class: 'muted' }, r.state === 'sin_carpeta' ? 'Falta enlazar la carpeta de Drive del cliente (Nosotros › Proyecto).' : r.state === 'sin_google' ? 'Space aún no está conectado a Google Drive.' : (r.message || 'No se pudo leer la carpeta de Drive.'))); return; }
      const walk = (n, path) => { n.files.forEach((f) => all.push({ ...f, folder: path })); n.folders.forEach((c) => walk(c, `${path} › ${c.name}`)); };
      walk(r.tree, r.tree.name); all.sort((a, b) => String(b.modified || '').localeCompare(String(a.modified || ''))); draw();
    } catch (e) { list.replaceChildren(el('p', { class: 'muted' }, e.message)); }
  });
}
/** Ventana de confirmación: ¿es este el archivo que se quiere incluir? */
function confirmDriveFile(file) {
  return new Promise((resolve) => {
    const card = el('div', { class: 'card' }, el('h2', {}, '¿Es este el archivo?'),
      el('div', { class: 'pk-file' }, el('span', { class: 'pk-kind' }, file.kind), el('div', {}, el('strong', {}, file.name), el('small', { class: 'muted', style: 'display:block' }, file.folder), file.modified ? el('small', { class: 'muted', style: 'display:block' }, `Modificado ${fmtDate(file.modified, { dateStyle: 'medium' })}`) : '')),
      file.url ? el('p', {}, el('a', { href: file.url, target: '_blank', rel: 'noopener' }, 'Abrirlo en Drive para comprobarlo ↗')) : '',
      el('p', { class: 'muted' }, 'Si lo confirmas, Space leerá el archivo, escribirá un resumen y lo guardará en esta ficha. El resumen lo podrás corregir.'),
      el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => d.close(false) }, 'No, elegir otro'),
        el('button', { type: 'button', class: 'btn', 'data-autofocus': '', onclick: () => d.close(true) }, 'Sí, usar este archivo')));
    const d = openModal(card, { label: '¿Es este el archivo?', onClose: (v) => resolve(v === true) });
  });
}
let ctxClient = null;
const working = new WeakSet();
export function askText({ title, label, value = '', placeholder = '', hint = '', ok = 'Aceptar' }) {
  return new Promise((resolve) => {
    const id = `ask-${++uid}`;
    const inp = el('input', { id, name: 'valor', value, placeholder, autocomplete: 'off', 'data-autofocus': '' });
    const card = el('form', { class: 'card', onsubmit: (e) => { e.preventDefault(); d.close(inp.value.trim()); } },
      el('h2', {}, title), el('label', { for: id }, label), inp, hint ? el('div', { class: 'muted pwhint' }, hint) : '',
      el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => d.close(null) }, 'Cancelar'), el('button', { class: 'btn' }, ok)));
    const d = openModal(card, { label: title, onClose: (v) => resolve(v ?? null) });
  });
}
export function askConfirm({ title, text = '', ok = 'Aceptar', danger = false }) {
  return new Promise((resolve) => {
    const card = el('div', { class: 'card' }, el('h2', {}, title), text ? el('p', { class: 'muted' }, text) : '',
      el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', 'data-autofocus': '', onclick: () => d.close(false) }, 'Cancelar'),
        el('button', { type: 'button', class: 'btn' + (danger ? ' danger' : ''), onclick: () => d.close(true) }, ok)));
    const d = openModal(card, { label: title, onClose: (v) => resolve(v === true) });
  });
}
// Confirmación fuerte: hay que escribir la frase exacta (sin importar mayúsculas) para que se active el botón.
export function askPhrase({ title, text = '', phrase, ok = 'Confirmar', danger = true }) {
  return new Promise((resolve) => {
    const id = `ask-${++uid}`;
    const good = () => inp.value.trim().toLowerCase() === phrase.toLowerCase();
    const inp = el('input', { id, name: 'confirmacion', autocomplete: 'off', spellcheck: false, 'data-autofocus': '', oninput: () => { btn.disabled = !good(); } });
    const btn = el('button', { class: 'btn' + (danger ? ' danger' : ''), disabled: true }, ok);
    const card = el('form', { class: 'card', onsubmit: (e) => { e.preventDefault(); if (good()) d.close(true); } },
      el('h2', {}, title), text ? el('p', { class: 'muted' }, text) : '',
      el('label', { for: id }, ['Para confirmar, escribe ', el('strong', {}, phrase)]), inp,
      el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => d.close(false) }, 'Cancelar'), btn));
    const d = openModal(card, { label: title, onClose: (v) => resolve(v === true) });
  });
}
export function notice({ title, text = '', secret = '', ok = 'Entendido' }) {
  return new Promise((resolve) => {
    const copy = secret ? el('button', { type: 'button', class: 'btn ghost small', onclick: () => navigator.clipboard.writeText(secret).then(() => toast('Copiado'), () => toast('No se pudo copiar')) }, 'Copiar') : '';
    const card = el('div', { class: 'card' }, el('h2', {}, title), text ? el('p', { class: 'muted' }, text) : '',
      secret ? el('div', { class: 'row' }, el('code', { class: 'mono grow', style: 'overflow-wrap:anywhere' }, secret), copy) : '',
      el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn', 'data-autofocus': '', onclick: () => d.close() }, ok)));
    const d = openModal(card, { label: title, onClose: () => resolve() });
  });
}

// Une la etiqueta de un campo con su control y le pone nombre, sin autocompletado ni corrector donde no toca.
function bind(label, node, f) {
  const c = node.matches && node.matches('input,select,textarea') ? node : node.querySelector('input:not([type=checkbox]):not([type=color]),select,textarea');
  if (!c) return;
  if (!c.id) c.id = `fld-${++uid}`;
  label.setAttribute('for', c.id);
  if (!c.name) c.name = f.k;
  if (!c.getAttribute('autocomplete')) c.setAttribute('autocomplete', 'off');
  if (['url', 'email', 'tel'].includes(c.type) || f.k === 'bm_id') c.spellcheck = false;
}

export async function api(method, url, body) {
  const r = await fetch(url, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
  });
  let j = {};
  try { j = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) throw Object.assign(new Error(j.error || 'Error'), { status: r.status, code: j.code });
  return j;
}

const TRI = ['Sí', 'No', 'No lo sé'];

// Logos de las aplicaciones a las que enlazan algunos campos (dibujados en línea para no depender de nada externo).
const APPS = {
  clickup: { name: 'ClickUp', img: '/brand/clickup.png' },
  drive: { name: 'Google Drive', img: '/brand/google-drive.png' },
};
export function appIcon(app) {
  const a = APPS[app];
  if (a.img) return el('img', { class: 'appic', src: a.img, alt: '', width: 22, height: 22, 'aria-hidden': 'true', draggable: 'false' });
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', a.vb); s.setAttribute('class', 'appic'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = a.svg;
  return s;
}
export const appName = (app) => APPS[app].name;

// Pinta una sección del formulario. `save(partial)` guarda solo lo que cambia.
// Icono de cada tarjeta: un cuadradito de color con un dibujo de línea, según de qué trate el grupo.
const GI = {
  clinica: '<path d="M4 21V8l6-4v17M10 21V10l6 3v8M16 21h5V12l-5-3"/>', pin: '<path d="M12 21s-6-5.500-6-11a6 6 0 0 1 12 0c0 5.500-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  user: '<circle cx="12" cy="8" r="3.500"/><path d="M5 20c.6-3.600 3.400-5.500 7-5.500s6.400 1.900 7 5.500"/>', users: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c.6-3.600 3.200-5.500 6.500-5.500s5.900 1.900 6.500 5.500M16 4.800a3.500 3.500 0 0 1 0 6.400M18 14.800c2 .6 3.200 2.300 3.500 5.200"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.500" cy="8.500" r="1"/>', video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', chat: '<path d="M21 11.500a8.400 8.400 0 0 1-12.300 7.400L3 20.500l1.700-5.500A8.400 8.400 0 1 1 21 11.500z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.500"/>',
  share: '<circle cx="6" cy="12" r="2.500"/><circle cx="18" cy="6" r="2.500"/><circle cx="18" cy="18" r="2.500"/><path d="M8.300 11l7.400-3.800M8.300 13l7.400 3.800"/>', cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.500 9 2.500 12 0v-5"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.500l3 3 5-6"/>', flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.600"/><path d="M21 16l-5-5-8 8"/>',
  doc: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>', mega: '<path d="M3 11v3l12 5V6zM15 8c3 .5 5 2 5 4s-2 3.500-5 4"/>', lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
};
const GI_RULES = [[/empresa|clínica|datos de la/i, 'clinica'], [/área|influencia/i, 'pin'], [/responsables/i, 'user'], [/quién atiende|asisten/i, 'users'], [/grupo/i, 'users'], [/avatar|paciente ideal/i, 'user'],
  [/competencia/i, 'target'], [/oferta/i, 'tag'], [/graba|rodaje/i, 'video'], [/cuándo|calendario|fechas|agenda/i, 'cal'], [/horario/i, 'clock'], [/temas|whatsapp|número/i, 'chat'],
  [/web|dominio|hosting|google/i, 'globe'], [/business|inversión|cuenta publicitaria/i, 'money'], [/píxel/i, 'target'], [/páginas|perfiles|redes/i, 'share'], [/formación|sesión/i, 'cap'],
  [/materiales|estado/i, 'img'], [/antes de|proyecto/i, 'flag'], [/confidencial|revisión/i, 'check']];
function groupIcon(title, i) {
  const key = (GI_RULES.find(([re]) => re.test(title)) || [0, 'doc'])[1];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.innerHTML = GI[key] || GI.doc;
  const t = el('span', { class: 'gicon' }); t.append(svg); return t;
}

let searchName = '';
let watchers = [];
export function renderSection(sec, data, { team, save, preview, clientName, clientId }) {
  searchName = clientName || ''; ctxClient = clientId || null; watchers = [];
  const wrap = el('div');
  const status = el('div', { class: 'saved', role: 'status', 'aria-live': 'polite' });
  let pending = {}, timer = null;
  const flush = async () => {
    const body = pending; pending = {}; timer = null;
    if (!Object.keys(body).length) return;
    status.className = 'saved'; status.textContent = 'Guardando…';
    try { await save(body); status.className = 'saved ok'; status.textContent = 'Guardado ✓'; }
    catch (e) { status.className = 'saved bad'; status.textContent = 'No se pudo guardar: ' + e.message; Object.assign(pending, body); }
  };
  const rawChange = (k, v) => { data[k] = v; pending[k] = v; watchers.forEach((w) => w()); clearTimeout(timer); timer = setTimeout(flush, 700); status.className = 'saved'; status.textContent = 'Sin guardar…'; };

  // «No lo sé, que lo haga Avania»: el campo queda como tarea del equipo (data._avania). Si alguien lo rellena, deja de estarlo.
  const repaints = {};
  const change = (k, v) => {
    rawChange(k, v);
    if (k !== '_avania' && String(v ?? '').trim() !== '' && Array.isArray(data._avania) && data._avania.includes(k)) { data._avania = data._avania.filter((x) => x !== k); rawChange('_avania', data._avania); }
    if (repaints[k]) repaints[k]();
  };
  const delegateControl = (f, node) => {
    const box = el('div', { class: 'delegate' });
    const on = () => Array.isArray(data._avania) && data._avania.includes(f.k);
    const toggle = () => { const set = new Set(Array.isArray(data._avania) ? data._avania : []); if (set.has(f.k)) set.delete(f.k); else set.add(f.k); data._avania = [...set]; rawChange('_avania', data._avania); paint(); };
    const paint = () => {
      node.classList.toggle('delegated', on());
      const filled = String(data[f.k] ?? '').trim() !== '';
      box.replaceChildren(...(on() ? [el('span', { class: 'tag' }, 'Lo hará Avania'), el('button', { type: 'button', class: 'linkbtn', onclick: toggle }, 'Deshacer')]
        : filled || team ? [] : [el('button', { type: 'button', class: 'linkbtn', onclick: toggle }, 'No lo sé, que lo haga Avania')]));
    };
    repaints[f.k] = paint; paint();
    return box;
  };

  if (sec.intro) wrap.append(el('div', { class: 'intro' }, sec.intro));
  // Cada grupo es una tarjeta con su icono; las tablas, el horario y los documentos ocupan todo el ancho.
  const grid = el('div', { class: 'gcards' });
  // Lo que es solo de la agencia no se enseña al cliente (ni los campos ni los grupos que se quedan vacíos).
  const hiddenFromClient = (f) => f.owner === 'team' && !f.shared && !f.clientEdit;
  const secAgency = sec.groups.flatMap((g) => g.fields).every((f) => f.owner === 'team');
  sec.groups.forEach((g, i) => {
    if (!team && g.fields.every(hiddenFromClient)) return;
    const wide = g.fields.some((f) => ['table', 'horario', 'docs', 'fichas', 'calendario'].includes(f.type)) || g.fields.length > 7;
    const body = el('div', { class: 'gfields' });
    for (const f of g.fields) {
      if (!team && hiddenFromClient(f)) continue;
      const node = field(f, data, change, team, preview);
      // Vista de la agencia: cada campo lleva el color de quién lo ve (navy = solo agencia, gris = lo ve el cliente).
      if (team) {
        const agency = f.owner === 'team' && !f.shared && !f.clientEdit;
        node.dataset.scope = agency ? 'agency' : 'client';
        if (f.owner === 'team' && !secAgency) node.querySelector('label')?.append(el('span', { class: 'scope-tag' }, f.clientEdit ? 'Lo ve y lo edita también el cliente' : f.shared ? 'Lo rellena la agencia · lo ve el cliente' : 'Solo agencia'));
      }
      const big = ['table', 'horario', 'docs', 'fichas', 'calendario'].includes(f.type);
      node.classList.add('w' + (f.w || (big || f.search ? 12 : 6)));
      if (f.calside) node.classList.add('calside'); if (f.side) node.classList.add('side');
      if (f.owner !== 'team' && !['table', 'horario', 'docs', 'fichas', 'calendario', 'check'].includes(f.type) && node.lastElementChild) {
        const ctl = node.lastElementChild, box = el('div', { class: 'fctl' });
        ctl.replaceWith(box); box.append(ctl, delegateControl(f, node));
      }
      body.append(node);
    }
    grid.append(el('section', { class: 'gcard' + (wide ? ' wide' : '') },
      el('header', { class: 'ghead' }, groupIcon(g.title, i), el('h2', {}, g.title.replace(/^\d+(\.\d+)?\s+/, ''))),
      g.intro ? el('div', { class: 'gintro' }, [].concat(g.intro).map((t) => el('p', {}, t))) : '', body));
  });
  // Secciones con pestañas (p. ej. Análisis de AVANIA): cada grupo es una pestaña y solo se ve una tarjeta a la vez.
  if (sec.tabs && grid.children.length > 1) {
    const cards = [...grid.children], names = sec.groups.filter((g) => team || !g.fields.every(hiddenFromClient)).map((g) => g.tab || g.title);
    let cur = Math.max(0, names.indexOf(tabMemo[sec.key]));
    const bar = el('div', { class: 'seg stabs', role: 'tablist' });
    const show = (n) => { cur = n; tabMemo[sec.key] = names[n]; cards.forEach((c, i) => { c.hidden = i !== n; c.classList.add('wide'); }); [...bar.children].forEach((b, i) => { b.classList.toggle('on', i === n); b.setAttribute('aria-selected', String(i === n)); }); };
    names.forEach((t, i) => bar.append(el('button', { type: 'button', role: 'tab', onclick: () => show(i) }, t)));
    wrap.append(bar); show(cur);
    wrap.append(grid); wrap.append(status);
    window.addEventListener('beforeunload', () => { if (Object.keys(pending).length) flush(); }, { once: true });
    return wrap;
  }
  // Si queda una tarjeta sola en su fila, ocupa todo el ancho.
  const half = [...grid.children].filter((c) => !c.classList.contains('wide'));
  if (half.length % 2) half[half.length - 1].classList.add('wide');
  wrap.append(grid);
  wrap.append(status);
  window.addEventListener('beforeunload', () => { if (Object.keys(pending).length) flush(); }, { once: true });
  return wrap;
}

// Fechas: el navegador da por buena «0002-11-02» al teclear el primer dígito del año. Solo se acepta con año de cuatro cifras (2000-2100).
export const DATE_ATTRS = { min: '2000-01-01', max: '2100-12-31' };
export const okDate = (v) => v === '' || /^20\d\d-\d\d-\d\d$/.test(v);

// Texto de una celda de tabla en solo lectura: las fechas con formato legible y los correos/enlaces pulsables.
const cellText = (v, c) => {
  const t = String(v ?? '').trim();
  if (!t) return '—';
  if (c.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(t)) return fmtDate(t + 'T12:00:00');
  if (/^\S+@\S+\.\S+$/.test(t)) return el('a', { href: `mailto:${t}` }, t);
  return toUrl(t) ? el('a', { href: toUrl(t), target: '_blank', rel: 'noopener' }, t) : t;
};

function field(f, data, change, team, preview) {
  const readonly = f.owner === 'team' && !f.clientEdit && !team;
  const label = el('label', {}, f.label);
  const hint = null;   // sin subetiquetas bajo el nombre del campo
  const v = data[f.k];
  let input;
  if (f.type === 'fichas') {
    const items = (data[f.k] = Array.isArray(v) ? v : []);
    const noun = f.item || 'ficha', max = f.max || 12;
    const grid = el('div', { class: 'fichas-q' });
    const actions = (r) => [
      preview && r.url ? el('button', { class: 'btn small', type: 'button', onclick: () => preview(r) }, 'Ver') : '',
      r.url ? el('a', { class: 'btn ghost small', href: r.url, target: '_blank', rel: 'noopener' }, 'Abrir en Drive ↗') : ''];
    const draw = () => {
      const cards = items.map((r, i) => {
        if (readonly) return el('article', { class: 'fq' }, el('h3', {}, r.nombre || `${noun[0].toUpperCase()}${noun.slice(1)} ${i + 1}`),
          el('p', { class: 'fq-sum' }, r.resumen || 'Resumen pendiente'), el('div', { class: 'row fq-act' }, actions(r)));
        const clientId = ctxClient;
        const txt = el('textarea', { rows: 6, class: 'fq-text', disabled: working.has(r), placeholder: working.has(r) ? 'Leyendo el archivo y escribiendo el resumen…' : 'Aquí aparecerá el resumen del archivo. Puedes corregirlo.', 'aria-label': 'Resumen', oninput: (e) => { r.resumen = e.target.value; change(f.k, items); } }, r.resumen || '');
        const analyze = async (fileId) => {
          working.add(r); draw();
          try {
            const a = await api('POST', `/api/clients/${clientId}/analisis`, { fileId, kind: f.ai });
            r.url = a.url; r.resumen = a.resumen; if (!r.nombre) r.nombre = a.nombre; toast('Resumen escrito: revísalo');
          } catch (e) { toast(e.message); }
          working.delete(r); change(f.k, items); draw();
        };
        const choose = async () => {
          let file;
          for (;;) { file = await pickDriveFile(clientId); if (!file) return; if (await confirmDriveFile(file)) break; }
          r.url = file.url || ''; r.fileId = file.id; if (!r.nombre) r.nombre = file.name; change(f.k, items);
          await analyze(file.id);
        };
        const act = el('div', { class: 'row fq-act' }, actions(r), clientId && !working.has(r) ? [el('button', { class: 'btn ghost small', type: 'button', onclick: choose }, r.url ? 'Cambiar archivo' : 'Elegir archivo de Drive'), r.fileId ? el('button', { class: 'btn ghost small', type: 'button', title: 'Volver a leer el archivo y escribir otro resumen', onclick: () => analyze(r.fileId) }, 'Resumir de nuevo') : ''] : '');
        return el('article', { class: 'fq' },
          el('div', { class: 'row fq-head' }, el('span', { class: 'fq-n' }, i + 1),
            el('input', { class: 'grow', value: r.nombre || '', placeholder: `Nombre del ${noun}`, 'aria-label': `Nombre del ${noun}`, oninput: (e) => { r.nombre = e.target.value; change(f.k, items); } }),
            el('button', { class: 'btn ghost small', type: 'button', title: 'Quitar', 'aria-label': `Quitar ${noun}`, onclick: () => { items.splice(i, 1); change(f.k, items); draw(); } }, '✕')),
          r.url ? '' : (clientId ? el('button', { class: 'btn fq-pick', type: 'button', onclick: choose }, 'Elegir archivo de Google Drive') : el('p', { class: 'muted' }, 'Sin archivo todavía.')),
          txt, act);
      });
      if (!readonly && items.length < max) cards.push(el('button', { type: 'button', class: 'fq fq-add', onclick: () => { items.push({ nombre: '', url: '', resumen: '' }); draw(); grid.querySelectorAll('.fq')[items.length - 1]?.querySelector('input')?.focus(); } }, el('span', {}, '+'), `Añadir ${noun}`));
      grid.replaceChildren(...(cards.length ? cards : [el('div', { class: 'ro' }, 'Lo rellenamos nosotros')]));
    };
    draw();
    return el('div', { class: 'field' }, grid);
  }
  if (readonly) {
    if (f.type === 'table') {
      const rows = (Array.isArray(v) ? v : []).filter((r) => f.cols.some((c) => String(r?.[c.k] ?? '').trim()));
      return el('div', { class: 'field' }, label, hint, rows.length
        ? el('div', { class: 'scroll' }, el('table', { class: 'grid-in ro-table' }, el('thead', {}, el('tr', {}, f.cols.map((c) => el('th', {}, c.label)))),
          el('tbody', {}, rows.map((r) => el('tr', {}, f.cols.map((c) => el('td', {}, cellText(r[c.k], c))))))))
        : el('div', { class: 'ro' }, 'Lo rellenamos nosotros'));
    }
    if (f.type === 'docs') {
      const list = (Array.isArray(v) ? v : []).filter((r) => r?.url);
      return el('div', { class: 'field' }, label, list.length ? el('div', { class: 'plist' }, list.map((r) => el('div', { class: 'prow' }, el('span', { class: 'grow' }, r.nombre || 'Documento'), el('a', { class: 'btn ghost small', href: r.url, target: '_blank', rel: 'noopener' }, 'Abrir ↗')))) : el('div', { class: 'ro' }, 'Lo rellenamos nosotros'));
    }
    return el('div', { class: 'field' }, label, el('div', { class: 'ro', style: 'white-space:pre-line' }, toUrl(v) ? el('a', { href: toUrl(v), target: '_blank', rel: 'noopener' }, v) : (v || 'Lo rellenamos nosotros')));
  }
  if (f.type === 'docs') {
    const rows = Array.isArray(v) ? v : [];
    data[f.k] = rows;
    const body = el('tbody');
    const draw = () => body.replaceChildren(...rows.map((r, i) => el('tr', {},
      el('td', {}, el('input', { value: r.nombre || '', placeholder: 'Nombre (p. ej. Análisis de competencia)', 'aria-label': 'Nombre', oninput: (e) => { r.nombre = e.target.value; change(f.k, rows); } })),
      el('td', {}, el('input', { type: 'url', value: r.url || '', placeholder: 'Pega el enlace de Google Drive…', 'aria-label': 'Enlace', oninput: (e) => { r.url = e.target.value; change(f.k, rows); }, onchange: () => preview && r.url && preview(r) })),
      el('td', { class: 'row' },
        preview ? el('button', { class: 'btn small', type: 'button', onclick: () => preview(r) }, 'Ver') : '',
        r.url ? el('a', { class: 'btn ghost small', href: r.url, target: '_blank', rel: 'noopener' }, 'Abrir') : '',
        el('button', { class: 'btn ghost small', type: 'button', title: 'Quitar', 'aria-label': 'Quitar enlace', onclick: () => { rows.splice(i, 1); change(f.k, rows); draw(); } }, '✕')))));
    draw();
    return el('div', { class: 'field' }, hint, el('div', { class: 'scroll' }, el('table', { class: 'grid-in docs' }, body)),
      el('button', { class: 'btn ghost small', type: 'button', onclick: () => { rows.push({ nombre: '', url: '' }); draw(); } }, '+ Añadir enlace'));
  }
  if (f.type === 'calendario') {
    const sel = (data[f.k] = Array.isArray(v) ? [...v] : []);
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const today = new Date(); const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
    const first = sel.slice().sort()[0];
    let y = first ? +first.slice(0, 4) : today.getFullYear(), m = first ? +first.slice(5, 7) - 1 : today.getMonth();
    const box = el('div', { class: 'cal' });
    const long = (d) => fmtDate(d + 'T12:00:00', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const toggle = (d) => { const i = sel.indexOf(d); if (i >= 0) sel.splice(i, 1); else sel.push(d); sel.sort(); change(f.k, sel); draw(); };
    const draw = () => {
      const lead = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
      const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
      const nav = (dm) => () => { m += dm; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } draw(); };
      box.replaceChildren(
        el('div', { class: 'cal-card' },
          el('div', { class: 'cal-head' }, el('button', { type: 'button', class: 'cal-nav', 'aria-label': 'Mes anterior', onclick: nav(-1) }, '‹'), el('strong', {}, `${MESES[m][0].toUpperCase()}${MESES[m].slice(1)} ${y}`), el('button', { type: 'button', class: 'cal-nav', 'aria-label': 'Mes siguiente', onclick: nav(1) }, '›')),
          el('div', { class: 'cal-grid' }, ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => el('span', { class: 'cal-dow' }, d)),
            cells.map((d) => { if (!d) return el('span'); const k = iso(y, m, d); return el('button', { type: 'button', class: 'cal-day' + (sel.includes(k) ? ' on' : '') + (k === todayIso ? ' today' : ''), 'aria-pressed': String(sel.includes(k)), 'aria-label': long(k), onclick: () => toggle(k) }, d); }))),
        el('div', { class: 'cal-list' },
          sel.length ? [el('div', { class: 'muted', style: 'margin-bottom:6px' }, sel.length === 1 ? 'Fecha señalada' : 'Fechas señaladas'),
            ...sel.map((k) => el('div', { class: 'cal-chip' }, el('i'), el('span', {}, long(k).replace(/^./, (c) => c.toUpperCase())), el('button', { type: 'button', class: 'cal-x', title: 'Quitar', 'aria-label': 'Quitar ' + long(k), onclick: () => toggle(k) }, '✕')))]
            : el('div', { class: 'muted' }, 'Todavía no hay ninguna fecha señalada. Pulsa un día del calendario.')));
    };
    draw();
    return el('div', { class: 'field' }, label, hint, box);
  }
  if (f.type === 'categoria') {
    const PALETA = ['#0f766e', '#b45309', '#1d4ed8', '#b42318', '#6d28d9', '#0e7490', '#4d7c0f', '#be185d'];
    let cats = [];
    const sel = el('select', { 'aria-label': 'Categoría' });
    const colorIn = el('input', { type: 'color', title: 'Color de la categoría', 'aria-label': 'Color de la categoría', class: 'catcolor' });
    const fill = () => {
      const cur = data[f.k] || '';
      sel.replaceChildren(el('option', { value: '' }, '— Sin categoría —'), ...cats.map((c) => el('option', { value: c.name, selected: c.name === cur }, c.name)), el('option', { value: '__nueva' }, '＋ Nueva categoría…'));
      const c = cats.find((x) => x.name === cur); colorIn.value = c ? c.color : '#d0d5dd'; colorIn.disabled = !c;
    };
    const upsert = async (name, color) => { const { category } = await api('POST', '/api/categories', { name, color }); cats = [...cats.filter((c) => c.name !== category.name), category].sort((a, b) => a.name.localeCompare(b.name, 'es')); return category; };
    sel.addEventListener('change', async () => {
      if (sel.value !== '__nueva') { change(f.k, sel.value); fill(); return; }
      const name = await askText({ title: 'Nueva categoría', label: 'Nombre de la categoría', hint: 'Por ejemplo: Industrial, Seguros…', ok: 'Crear categoría' });
      if (!name) { fill(); return; }
      try { const c = await upsert(name, (cats.find((x) => x.name === name) || {}).color || PALETA[cats.length % PALETA.length]); change(f.k, c.name); } catch (e) { toast(e.message); }
      fill();
    });
    colorIn.addEventListener('change', async () => { const cur = data[f.k]; if (!cur) return; try { await upsert(cur, colorIn.value); } catch (e) { toast(e.message); } fill(); });
    api('GET', '/api/categories').then((r) => { cats = r.categories; fill(); }).catch(() => fill());
    fill();
    bind(label, sel, f);
    return el('div', { class: 'field' }, label, hint, el('div', { class: 'catrow' }, sel, colorIn));
  }
  if (f.type === 'horario') {
    const h = (data[f.k] = v && typeof v === 'object' ? v : {});
    const hrs = ['m1', 'm2', 't1', 't2'];
    // Día abierto: el interruptor guardado o, en datos antiguos, si tiene alguna hora.
    for (const [d] of DIAS) { const x = (h[d] = h[d] || {}); if (typeof x.abre !== 'boolean') x.abre = hrs.some((c) => x[c]); }
    const ins = {}, sw = {};
    const apply = (d) => hrs.forEach((c) => { ins[d + c].classList.toggle('dim', !h[d].abre); });   // un día cerrado se atenúa, pero se puede escribir siempre: al poner una hora, el día pasa a abierto
    const t = (d, c, ph) => (ins[d + c] = el('input', { type: 'time', value: h[d][c] || '', 'aria-label': ph, class: h[d].abre ? '' : 'dim', oninput: (e) => { h[d][c] = e.target.value; if (e.target.value && !h[d].abre) { h[d].abre = true; sw[d].checked = true; apply(d); } change(f.k, h); } }));
    // Copia el día de arriba (lunes) al resto: abierto o cerrado y sus horas.
    const copiar = () => {
      const [first, ...rest] = DIAS.map(([d]) => d);
      for (const d of rest) { h[d].abre = h[first].abre; sw[d].checked = h[d].abre; for (const c of hrs) { h[d][c] = h[first][c] || ''; ins[d + c].value = h[d][c]; } apply(d); }
      change(f.k, h);
    };
    const copyBtn = el('button', { type: 'button', class: 'btn ghost small', title: 'Copiar este horario a todos los demás días', 'aria-label': 'Copiar el horario del lunes a todos los demás días', onclick: copiar }, 'Copiar a todos');
    const toggle = (d, n) => el('label', { class: 'av-switch', title: `${n}: ${h[d].abre ? 'día de trabajo' : 'cerrado'}` },
      (sw[d] = el('input', { type: 'checkbox', checked: h[d].abre, 'aria-label': `${n} abierto`, onchange: (e) => { h[d].abre = e.target.checked; apply(d); change(f.k, h); } })), el('i'), el('strong', {}, n));
    input = el('div', { class: 'scroll' }, el('table', { class: 'grid-in horario' },
      el('thead', {}, el('tr', {}, el('th', { rowspan: 2 }, 'Día'), el('th', { colspan: 2, class: 'ctr' }, 'Mañana'), el('th', { colspan: 2, class: 'ctr' }, 'Tarde'), el('th', { rowspan: 2 })),
        el('tr', {}, ['De', 'A', 'De', 'A'].map((x) => el('th', { class: 'ctr' }, x)))),
      el('tbody', {}, DIAS.map(([d, n], i) => el('tr', {}, el('td', {}, toggle(d, n)), el('td', {}, t(d, 'm1', `${n} mañana de`)), el('td', {}, t(d, 'm2', `${n} mañana a`)), el('td', {}, t(d, 't1', `${n} tarde de`)), el('td', {}, t(d, 't2', `${n} tarde a`)), el('td', {}, i === 0 ? copyBtn : ''))))));
    return el('div', { class: 'field' }, label, hint, input);
  }
  if (f.type === 'table') {
    const rows = Array.isArray(v) && v.length ? v : [{}];   // una sola fila de salida: con «+ Añadir fila» se suman y con ✕ se quitan (también la última)
    data[f.k] = rows;
    const body = el('tbody');
    const draw = () => {
      if (!rows.length) return body.replaceChildren(el('tr', {}, el('td', { colspan: f.cols.length + 1, class: 'muted' }, 'Nada añadido todavía. Pulsa «+ Añadir fila».')));
      body.replaceChildren(...rows.map((r, i) => el('tr', {},
        f.cols.map((c) => el('td', {}, c.type === 'select'
          ? el('select', { 'aria-label': c.label, onchange: (e) => { r[c.k] = e.target.value; change(f.k, rows); } }, el('option', { value: '' }, '—'), c.options.map((o) => el('option', { value: o, selected: r[c.k] === o }, o)))
          : (() => {
            const inp = el('input', { type: c.type === 'date' ? 'date' : 'text', ...(c.type === 'date' ? DATE_ATTRS : {}), value: r[c.k] || '', 'aria-label': c.label, oninput: (e) => { if (c.type === 'date' && !okDate(e.target.value)) return; r[c.k] = e.target.value; change(f.k, rows); } });
            return team && f.k !== 'personas' && isMailCol(c) ? mailRow(inp, r.nombre || r.etiqueta) : inp;   // los correos del equipo de AVANIA no llevan el icono
          })())),
        el('td', {}, el('button', { class: 'btn ghost small', title: 'Quitar fila', 'aria-label': 'Quitar fila', onclick: () => { rows.splice(i, 1); change(f.k, rows); draw(); } }, '✕')))));
    };
    draw();
    input = el('div', { class: 'scroll' },
      el('table', { class: 'grid-in' }, el('thead', {}, el('tr', {}, f.cols.map((c) => el('th', {}, c.label)), el('th', {}, el('span', { class: 'sr-only' }, 'Quitar fila')))), body),
      el('button', { class: 'btn ghost small', onclick: () => { rows.push({}); draw(); } }, '+ Añadir fila'));
    return el('div', { class: 'field' }, label, hint, input);
  }
  if (f.type === 'check') {
    return el('div', { class: 'field check' }, el('label', {},
      el('input', { type: 'checkbox', name: f.k, checked: v === true, onchange: (e) => change(f.k, e.target.checked) }), f.label));
  }
  if (f.type === 'textarea') input = el('textarea', { oninput: (e) => change(f.k, e.target.value) }, v || '');
  else if (f.type === 'tri' || (f.type === 'select' && f.options.length <= 3)) {
    const opts = f.type === 'tri' ? TRI : f.options;
    const box = el('div', { class: 'seg opt', role: 'group', 'aria-label': f.label });
    const paint = () => box.querySelectorAll('button').forEach((b) => { const on = data[f.k] === b.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    opts.forEach((o) => box.append(el('button', { type: 'button', 'data-v': o, onclick: () => { change(f.k, data[f.k] === o ? '' : o); paint(); } }, o)));
    paint();
    input = box;
  } else if (f.type === 'select') {
    const opts = f.options;
    input = el('select', { onchange: (e) => change(f.k, e.target.value) },
      el('option', { value: '' }, '—'), opts.map((o) => el('option', { value: o, selected: v === o }, o)));
  } else {
    input = el('input', { type: { number: 'number', date: 'date', url: 'url', email: 'email', tel: 'tel' }[f.type] || 'text', ...(f.type === 'date' ? DATE_ATTRS : {}), value: v || '', oninput: (e) => { if (f.type === 'date' && !okDate(e.target.value)) return; change(f.k, e.target.value); } });
    if (f.type === 'url' || f.type === 'text') input = urlRow(input);
    if (f.type === 'email' && team) input = mailRow(input);
    if (f.app) input = el('div', { class: 'applink' }, el('span', { class: 'apptile', title: appName(f.app) }, appIcon(f.app)), input);
    if (f.k === 'bm_id') {
      const raw = input.querySelector ? input.querySelector('input') : input;
      const btn = el('a', { class: 'btn small', target: '_blank', rel: 'noopener' }, 'Abrir Business Manager ↗');
      const note = el('div', { class: 'muted pwhint' });
      const upd = () => {
        const id = String(raw.value || '').replace(/\s/g, '');
        const ok = data.bm_acceso === 'Sí' && /^\d{5,20}$/.test(id);
        btn.classList.toggle('disabled', !ok);
        if (ok) { btn.href = `https://business.facebook.com/latest/settings/business_info?business_id=${id}`; btn.removeAttribute('aria-disabled'); btn.removeAttribute('tabindex'); }
        else { btn.removeAttribute('href'); btn.setAttribute('aria-disabled', 'true'); btn.setAttribute('tabindex', '-1'); }
        note.textContent = ok ? '' : (!/^\d{5,20}$/.test(id) ? 'Escribe el ID del Business Manager para activar el botón.' : 'Se activa cuando se marca «Sí» en «¿Habéis concedido ya el acceso?».');
      };
      watchers.push(upd); raw.addEventListener('input', upd); upd();
      input = el('div', {}, input, el('div', { style: 'margin-top:8px' }, btn), note);
    }
    if (f.search === 'drive') input.append(el('a', { class: 'btn ghost small', target: '_blank', rel: 'noopener', title: 'Abre Google Drive buscando; copia aquí el enlace del archivo', href: 'https://drive.google.com/drive/search?q=' + encodeURIComponent(('guiones ' + searchName).trim()) }, 'Buscar en Drive'));
  }
  bind(label, input, f);
  return el('div', { class: 'field' }, label, hint, input);
}

// Guía de ayuda con vídeo por sección. Se rellena en HELP (public/ayuda.json).
function helpBody(help) {
  const body = el('div', { class: 'body' });
  if (help.text) body.append(el('p', {}, help.text));
  if (help.video) {
    const u = help.video;
    const yt = u.match(/(?:youtu\.be\/|v=)([\w-]{11})/), vm = u.match(/vimeo\.com\/(\d+)/);
    if (yt) body.append(el('iframe', { src: `https://www.youtube-nocookie.com/embed/${yt[1]}`, allowfullscreen: true, loading: 'lazy' }));
    else if (vm) body.append(el('iframe', { src: `https://player.vimeo.com/video/${vm[1]}`, allowfullscreen: true, loading: 'lazy' }));
    else body.append(el('a', { href: u, target: '_blank', rel: 'noopener' }, 'Ver el vídeo'));
  }
  return body;
}
/** Botón de ayuda (icono «?») para la esquina superior derecha: abre la guía de la sección con su texto y vídeo. null si no hay guía. */
export function helpButton(help, title = 'Ayuda') {
  if (!help || (!help.text && !help.video)) return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'ic'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 .900-1 1.700M12 17v.01"/>';
  return el('button', { type: 'button', class: 'btn ghost small helpbtn', title: 'Cómo se hace: ayuda y vídeo', 'aria-label': 'Cómo se hace: ayuda y vídeo', onclick: () => {
    const card = el('div', { class: 'card helpcard' }, el('h2', { style: 'margin-top:0' }, title), helpBody(help), el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cerrar')));
    const m = openModal(card, { label: 'Ayuda' });
  } }, svg);
}
export function helpBlock(help) {
  if (!help || (!help.text && !help.video)) return null;
  return el('details', { class: 'help' }, el('summary', {}, '¿Cómo se hace? Ayuda y vídeo'), helpBody(help));
}

// «Se entra con» Google, Meta o Apple: accesos que no llevan contraseña propia, solo se verifican con uno de esos servicios.
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
export const SSO_LABEL = { google: 'Google', meta: 'Meta', apple: 'Apple' };
export function ssoIcon(k) {
  const svg = svgEl('svg', { viewBox: '0 0 24 24', class: 'ssoico', 'aria-hidden': 'true' });
  if (k === 'google') for (const [c, d] of [['#4285F4', 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'], ['#34A853', 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'], ['#FBBC05', 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'], ['#EA4335', 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z']]) svg.append(svgEl('path', { fill: c, d }));
  else if (k === 'meta') svg.append(svgEl('path', { fill: 'none', stroke: '#0866FF', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M2.6 12c0-2.4 1.4-4.5 3.3-4.5 3.2 0 6.2 9 10.2 9 1.9 0 3.3-2.1 3.3-4.5s-1.4-4.5-3.3-4.5c-4 0-7 9-10.2 9C4 16.5 2.6 14.4 2.6 12z' }));
  else svg.append(svgEl('path', { fill: 'currentColor', d: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701' }));
  return svg;
}
/** Tres casillas con su icono. `onChange(lista)` se llama al marcar o desmarcar; `.value()` devuelve lo marcado. */
export function ssoPicker(selected = [], onChange = () => {}) {
  const boxes = Object.keys(SSO_LABEL).map((k) => el('input', { type: 'checkbox', value: k, checked: selected.includes(k), 'aria-label': `Se entra con ${SSO_LABEL[k]}` }));
  const get = () => boxes.filter((b) => b.checked).map((b) => b.value);
  boxes.forEach((b) => b.addEventListener('change', () => onChange(get())));
  const w = el('div', { class: 'ssopick', role: 'group', 'aria-label': 'Se entra con' }, boxes.map((b) => el('label', { class: 'ssochip' }, b, ssoIcon(b.value), SSO_LABEL[b.value])));
  w.value = get; return w;
}
export const ssoPills = (list = []) => (list.length ? el('span', { class: 'pill ok ssopill', title: `Se entra con ${list.map((k) => SSO_LABEL[k]).join(', ')}` }, ...list.map(ssoIcon), `con ${list.map((k) => SSO_LABEL[k]).join(' · ')}`) : null);

// Tabla de credenciales. mode 'team' (con ver/copiar) o 'client' (solo escribir).
export function renderCredentials(root, { mode, services, list, create, update, remove, reveal, askCode, canSee }) {
  const body = el('div', { class: 'credlist' });
  const status = el('div', { class: 'saved', role: 'status', 'aria-live': 'polite' });
  let rows = [];
  const mark = (txt, cls = '') => { status.className = 'saved ' + cls; status.textContent = txt; };
  const STATUS = { pendiente: 'warn', recibida: '', verificada: 'ok' };

  const cell = (r, k, ph, type = 'text') => el('input', { type, value: r[k] || '', placeholder: ph, 'aria-label': ph,
    onchange: async (e) => { try { Object.assign(r, (await update(r.id, { [k]: e.target.value })).credential); mark('Guardado ✓', 'ok'); } catch (er) { mark(er.message, 'bad'); } } });

  async function doReveal(r, copy, input) {
    const go = async () => {
      const { password } = await reveal(r.id, copy);
      if (copy) { await navigator.clipboard.writeText(password); toast('Copiada al portapapeles'); return; }
      input.type = 'text'; input.value = password;
      setTimeout(() => { input.type = 'password'; input.value = ''; input.placeholder = '••••••••'; }, 15000);
    };
    try { await go(); } catch (e) {
      if (e.code === 'mfa_required') { if (await askCode()) { try { await go(); } catch (e2) { mark(e2.message, 'bad'); } } }
      else mark(e.message, 'bad');
    }
  }

  // Cada credencial es una fila desplegable: cerrada solo se ve el servicio, el estado y si tiene contraseña; abierta, sus datos
  // en una cuadrícula que se adapta al ancho (nada se sale por la derecha, ni en pantallas estrechas).
  const openIds = new Set();
  const draw = () => body.replaceChildren(...rows.map((r) => {
    const pw = el('input', { type: 'password', autocomplete: 'new-password', placeholder: r.has_password ? '••••••••' : 'Sin contraseña',
      'aria-label': 'Contraseña',
      onchange: async (e) => { if (!e.target.value) return; try { Object.assign(r, (await update(r.id, { password: e.target.value })).credential); e.target.value = ''; e.target.placeholder = '••••••••'; mark('Guardado ✓', 'ok'); draw(); } catch (er) { mark(er.message, 'bad'); } } });
    const pwCell = el('div', { class: 'pwcell' }, pw);
    if (mode === 'team' && r.has_password && canSee) {
      pwCell.append(el('button', { class: 'btn ghost small', onclick: () => doReveal(r, false, pw) }, 'Ver'),
        el('button', { class: 'btn ghost small', onclick: () => doReveal(r, true, pw) }, 'Copiar'));
    } else if (mode === 'client' && r.has_password) pwCell.append(el('span', { class: 'pill ok' }, 'guardada'));
    const st = mode === 'team'
      ? el('select', { onchange: async (e) => { try { Object.assign(r, (await update(r.id, { status: e.target.value })).credential); mark('Guardado ✓', 'ok'); draw(); } catch (er) { mark(er.message, 'bad'); } } },
        ['pendiente', 'recibida', 'verificada'].map((s) => el('option', { value: s, selected: r.status === s }, s)))
      : el('span', { class: 'pill ' + STATUS[r.status] }, r.status);
    const field = (label, control) => el('label', {}, label, control);
    return el('details', { class: 'cred', open: openIds.has(r.id), ontoggle: (e) => (e.target.open ? openIds.add(r.id) : openIds.delete(r.id)) },
      el('summary', {},
        el('strong', { class: 'svc' }, r.service),
        el('span', { class: 'muted sum' }, [r.company, r.username || r.email].filter(Boolean).join(' · ')),
        el('span', { class: 'grow' }),
        ssoPills(r.login_with),
        r.has_password || !(r.login_with || []).length ? el('span', { class: 'pill ' + (r.has_password ? 'ok' : 'warn') }, r.has_password ? 'contraseña guardada' : 'sin contraseña') : null,
        el('span', { class: 'pill ' + STATUS[r.status] }, r.status),
        el('span', { class: 'chev' }, '›')),
      el('div', { class: 'credgrid' },
        field('Empresa', cell(r, 'company', 'Empresa')), field('Usuario', cell(r, 'username', 'Usuario')),
        field('Correo', cell(r, 'email', 'Correo', 'email')),
        el('div', { class: 'ssofield' }, el('span', { class: 'ssol' }, 'Se entra con (sin contraseña)'), ssoPicker(r.login_with || [], async (list) => { try { Object.assign(r, (await update(r.id, { login_with: list })).credential); mark('Guardado ✓', 'ok'); draw(); } catch (er) { mark(er.message, 'bad'); } })),
        field('Contraseña', pwCell),
        field('Enlace de acceso', urlRow(cell(r, 'url', 'Enlace de acceso', 'url'))), field('Notas', cell(r, 'notes', 'Notas')),
        mode === 'team' ? field('Estado', st) : '',
        remove ? el('div', { class: 'credfoot' }, el('button', { class: 'btn ghost small', onclick: async () => {
          if (!(await askConfirm({ title: 'Borrar credencial', text: `¿Borrar la fila de ${r.service}? No se puede deshacer.`, ok: 'Borrar', danger: true }))) return;
          try { await remove(r.id); rows = rows.filter((x) => x.id !== r.id); draw(); } catch (er) { mark(er.message, 'bad'); } } }, 'Borrar esta credencial')) : ''));
  }));

  const svc = el('select', {}, el('option', { value: '' }, 'Añadir servicio…'), services.map((s) => el('option', { value: s }, s)), el('option', { value: '__otro' }, 'Otro…'));
  svc.addEventListener('change', async () => {
    let name = svc.value; svc.value = '';
    if (name === '__otro') name = (await askText({ title: 'Añadir servicio', label: 'Nombre del servicio', ok: 'Añadir' })) || '';
    if (!name) return;
    try { const c = (await create({ service: name })).credential; rows.push(c); openIds.add(c.id); draw(); } catch (e) { mark(e.message, 'bad'); }
  });

  root.replaceChildren(
    mode === 'client' ? el('div', { class: 'intro' }, 'Preferimos acceso delegado (como socio o administrador) y nunca os pediremos la contraseña si existe esa opción. Si no es posible, podéis guardarla aquí: se cifra al instante y nadie del exterior puede leerla. Vosotros tampoco podréis verla de nuevo, solo cambiarla.') : '',
    body,
    el('div', { class: 'row', style: 'margin-top:10px' }, svc, el('span', { class: 'grow' }), el('button', { class: 'btn ghost small', onclick: () => { rows.forEach((r) => openIds.add(r.id)); draw(); } }, 'Abrir todas'), el('button', { class: 'btn ghost small', onclick: () => { openIds.clear(); draw(); } }, 'Cerrar todas'), status));
  list().then((r) => { rows = r.credentials; draw(); });
}
