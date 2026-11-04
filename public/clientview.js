// Piezas del espacio del cliente que comparten el portal y la «Vista de cliente» de la agencia, para que la vista previa sea idéntica a la real.
import { el, fmtDate, toUrl, DATE_ATTRS, okDate, openModal, toast } from './fields.js';

export const bar = (pct, cls = '') => el('div', { class: `bar ${cls}`.trim(), role: 'img', 'aria-label': `${pct}%` }, el('i', { style: `width:${Math.max(0, Math.min(100, pct))}%` }));
const PRIO = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const dateText = (iso) => (iso ? fmtDate(iso + 'T12:00:00', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha');

/** Las áreas del alta, en orden, cada una con su barra de avance. `href(area)` = a dónde lleva; `team` = enseñar también el avance de AVANIA. */
export function areasNodes(areas, { href, team = false } = {}) {
  return el('ol', { class: 'areas' }, areas.map((a, i) => {
    const head = [el('span', { class: 'anum', 'aria-hidden': 'true' }, String(i + 1)), el('span', { class: 'atitle' }, a.title)];
    const side = (label, p, cls) => (p.total ? el('div', { class: 'aside' }, el('span', { class: 'muted' }, `${label} ${p.pct}%`), bar(p.pct, cls)) : el('div', { class: 'aside' }, el('span', { class: 'muted' }, `${label}: nada que rellenar`)));
    return el('li', {}, el(href ? 'a' : 'div', { class: 'area', ...(href ? { href: href(a) } : {}) }, ...head,
      el('div', { class: 'abars' }, side('Cliente', a.client, 'client'), team && a.team ? side('AVANIA', a.team, 'agency') : '')));
  }));
}

/** Lista de tareas con su prioridad. `href(task)` lleva a la sección; `who` marca de quién es cada una cuando se mezclan. */
export function taskList(tasks, { href, empty = 'Nada pendiente.', limit = 8 } = {}) {
  if (!tasks.length) return el('p', { class: 'muted', style: 'margin:0;padding:12px 16px' }, empty);
  const shown = tasks.slice(0, limit);
  return el('div', { class: 'clist tasks' }, [...shown.map((t) => el(href ? 'a' : 'div', { class: 'srow task', ...(href ? { href: href(t) } : {}) },
    el('span', { class: `prio ${t.priority}` }, PRIO[t.priority]),
    el('span', {}, el('b', {}, t.title), t.detail ? el('small', {}, t.detail) : '', t.due ? el('small', { class: t.overdue ? 'late' : '' }, `${t.overdue ? 'Vencida · ' : 'Para el '}${dateText(t.due)}`) : ''),
    el('span', {}))),
  tasks.length > shown.length ? el('div', { class: 'srow more muted' }, `y ${tasks.length - shown.length} más`) : '']);
}

/** Las fases del proceso, de los documentos de investigación al lanzamiento. Con `edit.save(cambios)` la agencia cambia estado, fecha, quién y el orden. */
export function phasesNode(fases, { edit = null, viewer = 'agencia' } = {}) {
  const box = el('div', { class: 'phases' });
  let rows = fases.map((f) => ({ ...f }));
  const label = (e, q) => (viewer === 'cliente' && e === 'Esperando cliente' ? 'Os toca a vosotros' : e);
  const persist = async (body) => { try { const r = await edit.save(body); rows = r.fases.map((f) => ({ ...f })); draw(); } catch (e) { edit.error(e); } };
  const set = (i, patch) => { Object.assign(rows[i], patch); persist({ fases: rows }); };
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= rows.length) return; [rows[i], rows[j]] = [rows[j], rows[i]]; persist({ fases: rows }); };
  const draw = () => {
    const done = rows.filter((f) => f.estado === 'Hecho').length, pct = rows.length ? Math.round((done / rows.length) * 100) : 0;
    const now = rows.findIndex((f) => f.estado !== 'Hecho');
    const item = (f, i) => el('li', { class: `ph st-${f.estado === 'Hecho' ? 'hecho' : f.estado === 'En curso' ? 'curso' : f.estado === 'Esperando cliente' ? 'espera' : 'pend'}${i === now ? ' now' : ''}` },
      el('span', { class: 'phn', 'aria-hidden': 'true' }, f.estado === 'Hecho' ? '✓' : String(i + 1)),
      edit ? el('input', { class: 'phname', value: f.fase, 'aria-label': 'Fase', onchange: (e) => set(i, { fase: e.target.value }) }) : el('span', { class: 'phname' }, f.fase, f.nota ? el('small', {}, f.nota) : ''),
      edit ? el('select', { 'aria-label': 'Quién', onchange: (e) => set(i, { quien: e.target.value }) }, ['AVANIA', 'Cliente', 'Ambos'].map((o) => el('option', { value: o, selected: f.quien === o }, o)))
        : el('span', { class: 'twho', 'data-who': { AVANIA: 'avania', Cliente: 'cliente', Ambos: 'ambos' }[f.quien] }, viewer === 'cliente' && f.quien === 'Cliente' ? 'Vosotros' : f.quien),
      edit ? el('select', { 'aria-label': 'Estado', onchange: (e) => set(i, { estado: e.target.value }) }, ['Pendiente', 'En curso', 'Esperando cliente', 'Hecho'].map((o) => el('option', { value: o, selected: f.estado === o }, o)))
        : el('span', { class: 'phst' }, label(f.estado)),
      edit ? el('input', { type: 'date', ...DATE_ATTRS, value: f.fecha || '', 'aria-label': 'Fecha prevista', onchange: (e) => { if (okDate(e.target.value)) set(i, { fecha: e.target.value }); } }) : el('span', { class: 'phdate' }, f.fecha ? dateText(f.fecha) : ''),
      edit ? el('span', { class: 'phtools' }, el('button', { type: 'button', class: 'btn ghost small', title: 'Subir', 'aria-label': 'Subir fase', onclick: () => move(i, -1) }, '↑'), el('button', { type: 'button', class: 'btn ghost small', title: 'Bajar', 'aria-label': 'Bajar fase', onclick: () => move(i, 1) }, '↓'),
        el('button', { type: 'button', class: 'btn ghost small', title: 'Quitar', 'aria-label': 'Quitar fase', onclick: () => { rows.splice(i, 1); persist({ fases: rows }); } }, '✕')) : '');
    const newName = edit ? el('input', { placeholder: 'Añadir una fase…', 'aria-label': 'Nueva fase', style: 'flex:1;min-width:200px' }) : null;
    box.replaceChildren(
      el('div', { class: 'row', style: 'margin-bottom:8px' }, el('strong', { class: 'grow' }, `${done} de ${rows.length} fases hechas`), el('span', { class: 'num' }, `${pct}%`)), bar(pct, 'client'),
      el('ol', { class: 'phases-list' }, rows.map(item)),
      edit ? el('form', { class: 'row', style: 'margin-top:10px;gap:8px;flex-wrap:wrap', onsubmit: (e) => { e.preventDefault(); if (!newName.value.trim()) return; rows.push({ fase: newName.value.trim(), quien: 'AVANIA', estado: 'Pendiente', fecha: '', nota: '' }); persist({ fases: rows }); } },
        newName, el('button', { class: 'btn small' }, '+ Añadir fase'), el('button', { type: 'button', class: 'btn ghost small', onclick: () => persist({ reset: true }) }, 'Volver a la lista estándar')) : '');
  };
  draw();
  return box;
}

/** Las dos listas de tareas, una al lado de la otra: las del cliente y las de AVANIA. */
export function taskColumns(tasks, { href, mine = 'Del cliente', ours = 'De AVANIA', limit = 8 } = {}) {
  const col = (title, list, empty) => el('section', { class: 'cgroup' }, el('h3', {}, `${title} (${list.length})`), taskList(list, { href, empty, limit }));
  return el('div', { class: 'cols2' }, col(mine, tasks.filter((t) => t.who === 'cliente'), 'Nada pendiente por esta parte.'), col(ours, tasks.filter((t) => t.who === 'avania'), 'Nada pendiente por esta parte.'));
}

/** Cronograma: fechas por orden, con quién actúa. Con `edit({section, key}, valor)` los hitos llevan un selector de fecha para cambiarla en el sitio. */
export function timelineNode(items, { limit = 14, who = { cliente: 'Cliente', avania: 'AVANIA', ambos: 'Ambos' }, edit = null } = {}) {
  const list = items.filter((t) => !t.done && (edit || t.date || !t.edit));
  if (!list.length) return el('p', { class: 'muted', style: 'margin:0' }, 'Todavía no hay fechas en el cronograma. Se irán sumando con el rodaje, la formación y las acciones que se acuerden.');
  return el('ol', { class: 'timeline' + (edit ? ' editable' : '') }, list.slice(0, limit).map((t) => el('li', { class: (t.past ? 'past ' : '') + (t.hito ? 'hito' : '') },
    edit && t.edit
      ? el('span', { class: 'tdate' }, el('input', { type: 'date', ...DATE_ATTRS, value: t.date || '', 'aria-label': `Fecha: ${t.label}`, onchange: (e) => { if (okDate(e.target.value)) edit(t.edit, e.target.value); } }))
      : el('time', {}, dateText(t.date)),
    el('span', { class: 'twho', 'data-who': t.who }, who[t.who] || t.who),
    el('span', { class: 'tlabel' }, t.label, t.auto ? el('small', {}, 'Fecha calculada desde el inicio (sin contar fines de semana). Cámbiala si hace falta.') : '', t.note ? el('small', {}, String(t.note).slice(0, 140)) : ''))));
}

/** Inicio del cliente: saludo, avance por áreas, tareas por prioridad, cronograma, herramientas, avisos y contacto. `request(link)` se llama al pedir acceso. */
export function homeNodes(h, { firstName = '', request = null, preview = false } = {}) {
  const goSection = (t) => `/portal/alta#${t.section}`;
  const tasks = h.tasks || [];
  const first = tasks.some((t) => t.who === 'cliente')
    ? el('section', { class: 'cgroup' }, el('h2', {}, 'Lo siguiente, por prioridad'),
      el('p', { class: 'muted' }, 'Esto es lo que necesitamos de vosotros, empezando por lo que más urgencia tiene. Si algo no sabéis cómo hacerlo, decídnoslo y lo vemos juntos.'),
      taskList(tasks.filter((t) => t.who === 'cliente'), { href: goSection, limit: 10 }))
    : el('section', { class: 'cgroup' }, el('h2', {}, 'Por vuestra parte, todo listo'), el('p', { class: 'muted' }, 'Gracias. Si queréis, podéis seguir completando vuestra ficha.'));
  const ours = tasks.filter((t) => t.who === 'avania');
  const oursNode = ours.length ? el('section', { class: 'cgroup' }, el('h3', {}, `Lo que estamos haciendo nosotros (${ours.length})`), taskList(ours, { href: goSection, limit: 6 })) : '';
  const tools = h.links.length ? el('section', { class: 'cgroup' }, el('h2', {}, 'Vuestras herramientas'),
    el('div', { class: 'clist' }, h.links.map((l) => el('div', { class: 'srow' }, el('span', {}, el('b', {}, l.type)),
      l.has_access === 'si' && l.open ? el('a', { class: 'btn small', href: l.open, target: '_blank', rel: 'noopener' }, 'Abrir ↗')
        : l.requested ? el('span', { class: 'pill' }, 'Acceso solicitado')
          : el('button', { class: 'btn ghost small', onclick: (e) => request && request(l, e.currentTarget) }, 'Solicitar acceso'))))) : '';
  const notes = h.notes.length ? el('section', { class: 'cgroup' }, el('h2', {}, 'Avisos de AVANIA'),
    el('div', { class: 'plist' }, h.notes.map((n) => el('article', { class: 'note' }, el('p', {}, n.body), el('small', { class: 'muted' }, `${n.author || 'AVANIA'} · ${fmtDate(n.created_at)}`))))) : '';
  return [
    el('h1', {}, `Hola${firstName ? ', ' + firstName : ''}`),
    el('div', { class: 'cols' }, el('div', {},
    el('div', { class: 'card', style: 'margin:14px 0' }, el('div', { class: 'row' }, el('strong', { class: 'grow' }, 'Avance de vuestra alta'), el('span', { class: 'num' }, `${h.progress}%`)),
      el('div', { class: 'bar', style: 'margin:8px 0 12px' }, el('i', { style: `width:${h.progress}%` })),
      h.areas ? areasNodes(h.areas, { href: (a) => `/portal/alta#${a.sections[0]}` }) : '', el('a', { class: 'btn small', href: '/portal/alta' }, 'Completar mi alta')),
    first, oursNode),
    el('div', {},
    h.fases ? el('section', { class: 'cgroup' }, el('h2', {}, 'Cómo avanza vuestro proyecto'), el('div', { class: 'card' }, phasesNode(h.fases, { viewer: 'cliente' }))) : '',
    h.fases ? el('section', { class: 'cgroup' }, el('h2', {}, 'Fechas'), el('div', { class: 'card' }, timelineNode(h.timeline || []))) : '',
    tools, notes)),
    el('p', { class: 'muted contact' }, `${h.client.manager ? `Vuestra persona de contacto es ${h.client.manager}. ` : ''}¿Dudas? `, h.contact ? ['Escribidnos a ', el('a', { href: `mailto:${h.contact}` }, h.contact), '.'] : 'Decídnoslo y lo vemos juntos.'),
  ];
}

const KIND_LABEL = { documento: 'Documento', hoja: 'Hoja de cálculo', presentación: 'Presentación', pdf: 'PDF', imagen: 'Imagen', vídeo: 'Vídeo', audio: 'Audio', archivo: 'Archivo' };
const KIND_TAG = { documento: 'DOC', hoja: 'XLS', presentación: 'PPT', pdf: 'PDF', imagen: 'IMG', vídeo: 'VID', audio: 'AUD', archivo: 'FILE' };
const FOLDER_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.6c.6 0 1.2.3 1.6.8L12 6.5h6.5A2.5 2.5 0 0 1 21 9v8.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>';
const SEARCH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>';
const icoHtml = (cls, html) => { const x = el('span', { class: cls, 'aria-hidden': 'true' }); x.innerHTML = html; return x; };
const fileIcon = (kind) => el('span', { class: `dico file k-${KIND_TAG[kind] || 'FILE'}`, 'aria-hidden': 'true' }, KIND_TAG[kind] || 'FILE');
const sizeText = (n) => (n == null ? '—' : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0).replace('.', ',')} MB` : `${(n / 1073741824).toFixed(1).replace('.', ',')} GB`);
const countFiles = (n) => n.files.length + n.folders.reduce((t, c) => t + countFiles(c), 0);
/**
 * Explorador de la carpeta de Drive del cliente: árbol de carpetas a la izquierda y, a la derecha, las subcarpetas y los archivos de la que
 * esté abierta (tipo, tamaño y fechas), con buscador. `load(refresh)` devuelve el listado leído de Google Drive; `agency` enseña también
 * los avisos técnicos y quién tocó cada archivo; `newFolder` activa el botón «Subir documentos» (crear carpetas y abrirlas en Drive).
 */
export function driveFilesNode(load, { agency = false, onView = null, newFolder = null, driveUrl = null } = {}) {
  const box = el('section', { class: 'card drivebox', style: 'margin-top:14px' });
  const ui = { sel: null, q: '', sort: 'name', dir: 1, closed: new Set() };
  const draw = async (refresh = false) => {
    box.replaceChildren(el('p', { class: 'muted', style: 'margin:0' }, 'Leyendo la carpeta de Google Drive…'));
    let r;
    try { r = await load(refresh); } catch (e) { r = { state: 'error', message: e.message }; }
    const openBtn = driveUrl ? el('a', { class: 'btn small', href: toUrl(driveUrl), target: '_blank', rel: 'noopener' }, 'Abrir en Google Drive ↗') : '';
    const note = (t) => box.replaceChildren(el('strong', {}, agency ? 'Documentos de la carpeta' : 'Vuestros documentos'), el('p', { class: 'muted', style: 'margin:4px 0 ' + (!agency && driveUrl ? '12px' : '0') }, t), agency ? '' : openBtn);
    if (r.state === 'sin_carpeta') return note(agency ? 'Falta enlazar la carpeta de Drive del cliente (en Nosotros › Proyecto).' : 'Todavía no tenemos preparada vuestra carpeta.');
    if (r.state !== 'ok') {
      if (!agency) return note('Ahora mismo no podemos enseñaros aquí la lista de documentos. Podéis abrir vuestra carpeta directamente en Google Drive.');
      return note(r.state === 'sin_google' ? 'Space aún no está conectado a Google Drive: falta indicar la cuenta de servicio de Google (GOOGLE_SA_FILE en el .env del servidor) y compartir con ella la carpeta MARKETING de cada cliente.'
        : r.state === 'sin_permiso' || r.state === 'fuera_de_raiz' ? r.message : `No se pudo leer la carpeta: ${r.message || 'error desconocido'}`);
    }
    const tree = r.tree;
    const byId = new Map(); const parentOf = new Map();
    const index = (n, par) => { byId.set(n.id, n); parentOf.set(n.id, par); n.folders.forEach((c) => index(c, n)); }; index(tree, null);
    if (!ui.sel || !byId.has(ui.sel)) ui.sel = tree.id;
    const nm = (n) => (!agency && n === tree ? 'Todos los documentos' : n.name);
    const pathOf = (n) => { const out = []; for (let x = n; x; x = parentOf.get(x.id)) out.unshift(x); return out; };

    const uploadDialog = () => {
      const flat = []; const walk = (n, d) => { flat.push({ id: n.id, label: `${'   '.repeat(d)}${n.name}` }); n.folders.forEach((c) => walk(c, d + 1)); }; walk(tree, 0);
      const sel = el('select', { id: 'dr-dest', name: 'destino' }, flat.map((f) => el('option', { value: f.id, ...(f.id === ui.sel ? { selected: '' } : {}) }, f.label)));
      const open = el('a', { class: 'btn', target: '_blank', rel: 'noopener' }, 'Abrir esta carpeta en Drive ↗');
      const sync = () => { open.href = `https://drive.google.com/drive/folders/${sel.value}`; }; sel.onchange = sync; sync();
      const name = el('input', { id: 'dr-new', name: 'carpeta', placeholder: 'Nombre de la nueva carpeta…', autocomplete: 'off', maxlength: 100 });
      const err = el('div', { class: 'err', role: 'alert' });
      const create = el('button', { class: 'btn ghost', type: 'submit' }, 'Crear carpeta');
      const card = el('form', { class: 'card', onsubmit: async (e) => {
        e.preventDefault(); err.textContent = ''; create.disabled = true;
        try { await newFolder(sel.value, name.value); toast('Carpeta creada'); d.close(); draw(true); } catch (er) { err.textContent = er.message; create.disabled = false; }
      } },
      el('h2', {}, 'Subir documentos'),
      el('p', { class: 'muted' }, 'Elige la carpeta de destino. Google no deja que Space suba archivos por su cuenta, así que se abre esa carpeta en Drive y arrastras ahí los documentos: aparecerán aquí solos.'),
      el('label', { for: 'dr-dest' }, 'Carpeta de destino'), sel, el('div', { style: 'margin:10px 0 16px' }, open),
      el('label', { for: 'dr-new' }, '¿Falta la carpeta? Créala dentro de la seleccionada'), el('div', { class: 'row', style: 'gap:8px' }, name, create), err,
      el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => d.close() }, 'Cerrar')));
      const d = openModal(card, { label: 'Subir documentos' });
    };

    const side = el('nav', { class: 'dtree', 'aria-label': 'Carpetas' });
    const main = el('div', { class: 'dmain' });
    const search = el('input', { class: 'dsearch', type: 'search', placeholder: agency ? 'Buscar documentos…' : 'Buscar en vuestros documentos…', 'aria-label': 'Buscar documentos', autocomplete: 'off', value: ui.q });
    const all = []; const flatten = (n) => { n.files.forEach((f) => all.push({ ...f, folderNode: n })); n.folders.forEach(flatten); }; flatten(tree);

    const treeNode = (n, depth) => {
      const open = !ui.closed.has(n.id), has = n.folders.length > 0;
      const row = el('div', { class: 'dtrow' + (n.id === ui.sel && !ui.q ? ' on' : ''), style: `padding-left:${8 + depth * 16}px` },
        has ? el('button', { class: 'dtcar' + (open ? ' open' : ''), type: 'button', 'aria-label': open ? 'Cerrar carpeta' : 'Abrir carpeta', 'aria-expanded': String(open), onclick: () => { open ? ui.closed.add(n.id) : ui.closed.delete(n.id); paint(); } }) : el('span', { class: 'dtcar none' }),
        el('button', { class: 'dtname', type: 'button', onclick: () => { ui.sel = n.id; ui.q = ''; search.value = ''; paint(); } }, icoHtml('dico folder', FOLDER_SVG), el('span', { class: 'dtl' }, nm(n)), el('small', { class: 'muted' }, String(countFiles(n)))));
      return el('div', { class: 'dtnode' }, row, has && open ? el('div', {}, n.folders.map((c) => treeNode(c, depth + 1))) : '');
    };

    const sortKey = (f) => (ui.sort === 'size' ? f.size ?? -1 : ui.sort === 'date' ? f.modified || '' : ui.sort === 'type' ? KIND_LABEL[f.kind] || '' : f.name.toLowerCase());
    const sortFiles = (list) => [...list].sort((x, y) => { const a = sortKey(x), b = sortKey(y); return (a < b ? -1 : a > b ? 1 : 0) * ui.dir || x.name.localeCompare(y.name, 'es'); });
    const th = (k, label, cls = '') => el('th', { class: cls, 'aria-sort': ui.sort === k ? (ui.dir > 0 ? 'ascending' : 'descending') : 'none' },
      el('button', { type: 'button', class: 'sortb', onclick: () => { ui.dir = ui.sort === k ? -ui.dir : 1; ui.sort = k; paint(); } }, label, ui.sort === k ? el('span', { class: 'arr' }, ui.dir > 0 ? '↑' : '↓') : ''));

    const fileTable = (files, withFolder) => (files.length ? el('div', { class: 'scroll' }, el('table', { class: 't dtable' },
      el('thead', {}, el('tr', {}, th('name', 'Nombre'), withFolder ? el('th', { class: 'dcol' }, 'Carpeta') : th('type', 'Tipo', 'dcol'), th('size', 'Tamaño', 'num dcol'), th('date', 'Modificado', 'num'), agency ? el('th', { class: 'dcol' }, 'Por') : '', el('th', {}, ''))),
      el('tbody', {}, sortFiles(files).map((f) => el('tr', {},
        el('td', { class: 'dname' }, fileIcon(f.kind), el('span', { class: 'dn' }, f.url ? el('a', { href: f.url, target: '_blank', rel: 'noopener', title: f.name }, f.name) : f.name, el('small', { class: 'muted dsub' }, `${KIND_LABEL[f.kind] || 'Archivo'}${f.size != null ? ` · ${sizeText(f.size)}` : ''}`))),
        withFolder ? el('td', { class: 'dcol muted' }, pathOf(f.folderNode).slice(1).map((x) => x.name).join(' › ') || 'Carpeta principal') : el('td', { class: 'dcol muted' }, KIND_LABEL[f.kind] || 'Archivo'),
        el('td', { class: 'num dcol' }, sizeText(f.size)),
        el('td', { class: 'num', title: f.created ? `Subido el ${fmtDate(f.created)}` : '' }, f.modified ? fmtDate(f.modified) : '—'),
        agency ? el('td', { class: 'dcol muted' }, f.by || '—') : '',
        el('td', { class: 'dact' }, onView && f.url ? el('a', { href: '#', class: 'btn ghost small', onclick: (e) => { e.preventDefault(); onView({ nombre: f.name, url: f.url }); } }, 'Ver') : '')))))) : el('p', { class: 'muted', style: 'margin:12px 4px' }, ui.q ? 'No hay documentos con ese nombre.' : agency ? 'Esta carpeta no tiene documentos.' : 'Esta carpeta todavía está vacía. Cuando AVANIA añada materiales o informes, los veréis aquí.'));

    const paint = () => {
      side.replaceChildren(treeNode(tree, 0));
      const q = ui.q.trim().toLowerCase();
      if (q) {
        const hits = all.filter((f) => f.name.toLowerCase().includes(q));
        return main.replaceChildren(el('div', { class: 'dcrumb' }, el('strong', {}, `${hits.length} resultado${hits.length === 1 ? '' : 's'} para «${ui.q.trim()}»`)), fileTable(hits, true));
      }
      const cur = byId.get(ui.sel);
      const crumbs = pathOf(cur);
      main.replaceChildren(
        el('div', { class: 'dcrumb' }, crumbs.flatMap((n, i) => [i ? el('span', { class: 'sep', 'aria-hidden': 'true' }, '›') : '', i === crumbs.length - 1 ? el('strong', {}, nm(n)) : el('button', { type: 'button', class: 'linkb', onclick: () => { ui.sel = n.id; paint(); } }, nm(n))])),
        cur.folders.length ? el('div', { class: 'dfgrid' }, cur.folders.map((c) => el('button', { type: 'button', class: 'dfcard', onclick: () => { ui.sel = c.id; ui.closed.delete(cur.id); paint(); } }, icoHtml('dico folder big', FOLDER_SVG),
          el('span', { class: 'dn' }, el('b', {}, c.name), el('small', { class: 'muted' }, `${countFiles(c)} documento${countFiles(c) === 1 ? '' : 's'}${c.modified ? ` · ${fmtDate(c.modified)}` : ''}`))))) : '',
        fileTable(cur.files, false));
    };
    let timer = 0;
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { ui.q = search.value; paint(); }, 120); });

    box.replaceChildren(
      el('div', { class: 'dhead' }, el('div', { class: 'dtitle' }, el('strong', {}, agency ? 'Documentos' : 'Vuestros documentos'), el('small', { class: 'muted' }, agency ? `${r.total} en «${r.folder}»` : `${r.total} documento${r.total === 1 ? '' : 's'} en vuestra carpeta`)),
        el('label', { class: 'dsearchw' }, icoHtml('dsi', SEARCH_SVG), search),
        newFolder ? el('button', { class: 'btn small', onclick: uploadDialog }, 'Subir documentos') : '', !agency ? openBtn : '', el('button', { class: 'btn ghost small', onclick: () => draw(true) }, 'Actualizar')),
      el('div', { class: 'dbrowser' }, side, main),
      r.truncated ? el('p', { class: 'muted', style: 'margin:8px 0 0' }, 'Se muestran los primeros documentos; la carpeta tiene más.') : '');
    paint();
  };
  draw();
  return box;
}

/** Documentos del cliente: su carpeta de Drive (solo consulta), contada en su voz y sin lo interno de la agencia. */
export function docsNodes(h, { loadFiles = null } = {}) {
  return [el('h1', {}, 'Documentos'),
    el('p', { class: 'muted', style: 'max-width:64ch' }, 'Aquí tenéis los materiales, informes y documentos de vuestro proyecto. Se actualizan solos cuando AVANIA añade algo. Podéis consultarlos y descargarlos; si necesitáis cambiar algo, decídnoslo.'),
    loadFiles ? driveFilesNode(loadFiles, { driveUrl: h.drive })
      : el('section', { class: 'card', style: 'margin-top:14px' }, h.drive ? el('a', { class: 'btn', href: toUrl(h.drive), target: '_blank', rel: 'noopener' }, 'Abrir carpeta ↗') : el('p', { class: 'muted', style: 'margin:0' }, 'Todavía no tenemos preparada vuestra carpeta.'))];
}
