// Piezas del espacio del cliente que comparten el portal y la «Vista de cliente» de la agencia, para que la vista previa sea idéntica a la real.
import { el, fmtDate, toUrl, DATE_ATTRS, okDate } from './fields.js';

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
    el('div', { class: 'card', style: 'margin:14px 0' }, el('div', { class: 'row' }, el('strong', { class: 'grow' }, 'Avance de vuestra alta'), el('span', { class: 'num' }, `${h.progress}%`)),
      el('div', { class: 'bar', style: 'margin:8px 0 12px' }, el('i', { style: `width:${h.progress}%` })),
      h.areas ? areasNodes(h.areas, { href: (a) => `/portal/alta#${a.sections[0]}` }) : '', el('a', { class: 'btn small', href: '/portal/alta' }, 'Completar mi alta')),
    first, oursNode,
    h.fases ? el('section', { class: 'cgroup' }, el('h2', {}, 'Cómo avanza vuestro proyecto'), el('div', { class: 'card' }, phasesNode(h.fases, { viewer: 'cliente' }))) : '',
    el('section', { class: 'cgroup' }, el('h2', {}, 'Fechas'), el('div', { class: 'card' }, timelineNode(h.timeline || []))),
    tools, notes,
    el('p', { class: 'muted contact' }, `${h.client.manager ? `Vuestra persona de contacto es ${h.client.manager}. ` : ''}¿Dudas? `, h.contact ? ['Escribidnos a ', el('a', { href: `mailto:${h.contact}` }, h.contact), '.'] : 'Decídnoslo y lo vemos juntos.'),
  ];
}

const KIND_LABEL = { documento: 'Documento', hoja: 'Hoja de cálculo', presentación: 'Presentación', pdf: 'PDF', imagen: 'Imagen', vídeo: 'Vídeo', audio: 'Audio', archivo: 'Archivo' };
/**
 * Lista los documentos de la carpeta de Drive del cliente (nombre, tipo, carpeta en la que está y última modificación), leídos de Google Drive.
 * `load(refresh)` devuelve el listado; `agency` enseña también los avisos técnicos (falta conectar Google, carpeta sin compartir).
 */
export function driveFilesNode(load, { agency = false } = {}) {
  const box = el('section', { class: 'card', style: 'margin-top:14px' });
  const draw = async (refresh = false) => {
    box.replaceChildren(el('p', { class: 'muted', style: 'margin:0' }, 'Leyendo la carpeta de Google Drive…'));
    let r;
    try { r = await load(refresh); } catch (e) { r = { state: 'error', message: e.message }; }
    const note = (t) => box.replaceChildren(el('strong', {}, 'Documentos de la carpeta'), el('p', { class: 'muted', style: 'margin:4px 0 0' }, t));
    if (r.state === 'sin_carpeta') return note(agency ? 'Falta enlazar la carpeta de Drive del cliente (en Nosotros › Proyecto).' : 'Todavía no tenemos preparada vuestra carpeta.');
    if (r.state !== 'ok') {
      if (!agency) return box.remove();
      return note(r.state === 'sin_google' ? 'Space aún no está conectado a Google Drive: falta indicar la cuenta de servicio de Google (GOOGLE_SA_FILE en el .env del servidor) y compartir con ella la carpeta de marketing.'
        : r.state === 'sin_permiso' ? r.message : `No se pudo leer la carpeta: ${r.message || 'error desconocido'}`);
    }
    box.replaceChildren(
      el('div', { class: 'row' }, el('strong', { class: 'grow' }, `Documentos de la carpeta (${r.files.length})`), el('button', { class: 'btn ghost small', onclick: () => draw(true) }, 'Actualizar')),
      el('p', { class: 'muted', style: 'margin:2px 0 8px' }, `Se leen de Google Drive, de «${r.folder}» y sus subcarpetas, y se actualizan solos según se van subiendo.`),
      r.files.length ? el('div', { class: 'scroll' }, el('table', { class: 't driveT' }, el('thead', {}, el('tr', {}, ['Documento', 'Carpeta', 'Modificado'].map((h) => el('th', {}, h)))),
        el('tbody', {}, r.files.map((f) => el('tr', {},
          el('td', {}, f.url ? el('a', { href: f.url, target: '_blank', rel: 'noopener' }, f.name) : f.name, el('small', { class: 'muted', style: 'display:block' }, KIND_LABEL[f.kind] || 'Archivo')),
          el('td', {}, f.folder), el('td', { class: 'num' }, f.modified ? fmtDate(f.modified) : '—'))))))
        : el('p', { class: 'muted', style: 'margin:0' }, 'La carpeta aún no tiene documentos.'),
      r.truncated ? el('p', { class: 'muted', style: 'margin:8px 0 0' }, 'Se muestran los primeros documentos; la carpeta tiene más.') : '');
  };
  draw();
  return box;
}

/** Documentos del cliente: su carpeta de Drive (solo consulta). */
export function docsNodes(h, { loadFiles = null } = {}) {
  return [el('h1', {}, 'Documentos'),
    el('section', { class: 'card', style: 'margin-top:14px' }, el('strong', {}, 'Vuestra carpeta de Google Drive'),
      el('p', { class: 'muted', style: 'margin:2px 0 10px' }, 'Contrato, materiales e informes. Podéis consultarla; si necesitáis cambiar algo, decídnoslo.'),
      h.drive ? el('a', { class: 'btn', href: toUrl(h.drive), target: '_blank', rel: 'noopener' }, 'Abrir carpeta ↗') : el('p', { class: 'muted', style: 'margin:0' }, 'Todavía no tenemos preparada vuestra carpeta.')),
    ...(loadFiles ? [driveFilesNode(loadFiles)] : [])];
}
