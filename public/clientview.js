// Piezas del espacio del cliente que comparten el portal y la «Vista de cliente» de la agencia, para que la vista previa sea idéntica a la real.
import { el, fmtDate, toUrl, DATE_ATTRS, okDate, openModal, toast, askConfirm } from './fields.js';

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

// Papelera pequeña (SVG en línea) para eliminar.
const detIcon = () => { const i = el('span', { class: 'deticon', 'aria-hidden': 'true' }); i.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16M17 9h1M17 13h1"/></svg>'; return i; };
const trash = () => { const i = el('span', { class: 'trash', 'aria-hidden': 'true' }); i.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg>'; return i; };

/** Las tareas del proyecto (antes «fases»): cada una con su responsable del equipo, inicio, fin y subtareas. Con `edit.save(cambios)` la agencia las cambia; `team` = personas a las que asignarlas. */
/**
 * Reordenar una lista arrastrando la barra del lado izquierdo de cada elemento (ratón o dedo), o con las flechas ↑ ↓ del teclado cuando la barra tiene el foco.
 * `list` = el <ul>/<ol> cuyos hijos directos llevan un `.draghandle`; `onMove(desde, hasta)` recibe las posiciones.
 */
function sortable(list, onMove, refocus) {
  list.addEventListener('keydown', (e) => {
    const h = e.target.closest?.('.draghandle'); if (!h || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const items = [...list.children], from = items.indexOf(h.closest('li')), to = from + (e.key === 'ArrowUp' ? -1 : 1);
    e.preventDefault(); if (to < 0 || to >= items.length) return;
    refocus(to); onMove(from, to);
  });
  list.addEventListener('pointerdown', (e) => {
    const h = e.target.closest?.('.draghandle'); if (!h || e.button) return;
    const item = h.closest('li'); if (!item || item.parentElement !== list) return;
    e.preventDefault();
    const items = [...list.children], from = items.indexOf(item), others = items.filter((x) => x !== item), y0 = e.clientY;
    let to = from;
    item.classList.add('dragging'); list.classList.add('sorting');
    try { h.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    const move = (ev) => {
      item.style.transform = `translateY(${ev.clientY - y0}px)`;
      to = others.filter((x) => { const r = x.getBoundingClientRect(); return ev.clientY > r.top + r.height / 2; }).length;
      others.forEach((x, i) => { x.classList.toggle('drop-above', i === to); x.classList.toggle('drop-below', to === others.length && i === others.length - 1); });
    };
    const end = (ev) => {
      h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', end); h.removeEventListener('pointercancel', end);
      item.classList.remove('dragging'); item.style.transform = ''; list.classList.remove('sorting');
      others.forEach((x) => x.classList.remove('drop-above', 'drop-below'));
      if (ev.type === 'pointerup' && to !== from) onMove(from, to);
    };
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  });
}

export function phasesNode(fases, { edit = null, viewer = 'agencia', team = [], clientPeople = [] } = {}) {
  const box = el('div', { class: 'phases' });
  let rows = fases.map((f) => ({ ...f, sub: (f.sub || []).map((x) => ({ ...x })) }));
  const open = new Set();   // posiciones de las tareas con las subtareas desplegadas
  const label = (e) => (viewer === 'cliente' && e === 'Esperando cliente' ? 'Os toca a vosotros' : e);
  const persist = async (body) => { try { const r = await edit.save(body); rows = r.fases.map((f) => ({ ...f, sub: (f.sub || []).map((x) => ({ ...x })) })); draw(); } catch (e) { edit.error(e); } };
  const save = () => persist({ fases: rows });
  const reorder = (arr, from, to) => { arr.splice(to, 0, arr.splice(from, 1)[0]); save(); };
  let focusAt = null;   // tras mover con el teclado, el foco vuelve a la barra de la tarea movida
  // ───── Panel de detalle (solo agencia): descripción, enlaces, «depende de» y comentarios ─────
  const flat = () => rows.flatMap((f, i) => [{ t: f, label: f.fase, path: [i] }, ...(f.sub || []).map((x, j) => ({ t: x, label: `${f.fase} › ${x.fase}`, path: [i, j] }))]);
  const byId = (id) => flat().find((x) => x.t.id === id)?.t;
  const waiting = (t) => (t.dep || []).map(byId).filter((x) => x && x.estado !== 'Hecho');
  const dependsOn = (t, targetId, seen = new Set()) => (t.dep || []).some((d) => d === targetId || (!seen.has(d) && seen.add(d) && byId(d) && dependsOn(byId(d), targetId, seen)));
  let panelId = null, panelOpener = null;
  const panel = { root: null };
  const closePanel = () => { panelId = null; if (panel.root) panel.root.remove(); panel.root = null; document.removeEventListener('keydown', onEsc); panelOpener?.focus?.(); panelOpener = null; };
  const onEsc = (e) => { if (e.key === 'Escape') closePanel(); };
  const openPanel = async (t, opener) => {
    if (flat().some((x) => !x.t.id)) {   // las tareas antiguas aún no tienen id: se guardan una vez para dárselo
      const path = flat().find((x) => x.t === t)?.path; await persistWait({ fases: rows });
      const again = path && (path.length === 1 ? rows[path[0]] : rows[path[0]]?.sub?.[path[1]]); if (!again) return; t = again;
    }
    panelId = t.id; panelOpener = opener || null;
    if (panel.root) panel.root.remove();
    buildPanel(); draw();
    document.addEventListener('keydown', onEsc);
    panel.root.querySelector('.tp-close')?.focus();
  };
  const persistWait = async (body) => { const r = await edit.save(body); rows = r.fases.map((f) => ({ ...f, sub: (f.sub || []).map((x) => ({ ...x })) })); };
  const buildPanel = () => {
    const cur = () => byId(panelId);
    const headBox = el('div', { class: 'tp-head' }), depBox = el('div'), comBox = el('div');
    const descTa = el('textarea', { rows: 5, class: 'tp-desc', placeholder: 'Qué hay que hacer, cómo, criterios de «hecho», notas…', 'aria-label': 'Descripción' });
    const linksBox = el('div', { class: 'tp-links' });
    const saveField = (fn) => { const t = cur(); if (!t) return; fn(t); save(); };
    descTa.value = (cur() || {}).desc || '';
    descTa.addEventListener('change', () => saveField((t) => { if (descTa.value.trim()) t.desc = descTa.value; else delete t.desc; }));
    const drawLinks = () => {
      const t = cur(); const ls = (t && t.links) || [];
      linksBox.replaceChildren(...ls.map((l, i) => el('div', { class: 'tp-link' },
        el('input', { value: l.titulo || '', placeholder: 'Título (p. ej. Guion en Drive)', 'aria-label': 'Título del enlace', onchange: (e) => saveField((x) => { x.links[i].titulo = e.target.value; }) }),
        el('input', { type: 'url', value: l.url || '', placeholder: 'https://…', 'aria-label': 'Dirección del enlace', onchange: (e) => saveField((x) => { x.links[i].url = e.target.value; }) }),
        l.url ? el('a', { class: 'btn ghost small', href: l.url, target: '_blank', rel: 'noopener', 'aria-label': 'Abrir enlace' }, '↗') : '',
        el('button', { type: 'button', class: 'phdel', 'aria-label': 'Quitar enlace', onclick: () => { saveField((x) => { x.links.splice(i, 1); if (!x.links.length) delete x.links; }); drawLinks(); } }, trash()))),
      el('button', { type: 'button', class: 'btn ghost small', onclick: () => { const t2 = cur(); if (!t2) return; (t2.links ||= []).push({ titulo: '', url: 'https://' }); drawLinks(); linksBox.querySelectorAll('.tp-link')[t2.links.length - 1]?.querySelector('input')?.focus(); } }, '+ Añadir enlace'));
    };
    const drawDeps = () => {
      const t = cur(); if (!t) return;
      const mine = (t.dep || []).map(byId).filter(Boolean), blockedBy = waiting(t);
      const opts = flat().filter((x) => x.t.id !== t.id && !(t.dep || []).includes(x.t.id) && !dependsOn(x.t, t.id));
      const blocks = flat().filter((x) => (x.t.dep || []).includes(t.id));
      const add = el('select', { 'aria-label': 'Añadir dependencia', onchange: (e) => { if (!e.target.value) return; const id = e.target.value; saveField((x) => { x.dep = [...(x.dep || []), id]; }); } },
        el('option', { value: '' }, 'Esta tarea depende de…'), opts.map((x) => el('option', { value: x.t.id }, x.label)));
      depBox.replaceChildren(
        blockedBy.length ? el('p', { class: 'tp-block' }, `Bloqueada: espera a ${blockedBy.map((x) => `«${x.fase}»`).join(', ')}`) : (mine.length ? el('p', { class: 'tp-ok' }, 'Sin bloqueos: todo lo que necesita está hecho.') : ''),
        mine.length ? el('ul', { class: 'tp-deps' }, mine.map((x) => el('li', {}, el('span', { class: `tp-dot ${x.estado === 'Hecho' ? 'ok' : ''}` }), el('span', { class: 'grow' }, x.fase), el('small', {}, x.estado),
          el('button', { type: 'button', class: 'phdel', 'aria-label': `Quitar dependencia: ${x.fase}`, onclick: () => saveField((y) => { y.dep = y.dep.filter((d) => d !== x.id); if (!y.dep.length) delete y.dep; }) }, trash())))) : '',
        opts.length ? add : el('p', { class: 'muted', style: 'margin:0' }, mine.length ? '' : 'No hay otras tareas de las que pueda depender.'),
        blocks.length ? el('p', { class: 'muted', style: 'margin:8px 0 0;font-size:13px' }, `Bloquea a: ${blocks.map((x) => x.label).join(', ')}`) : '');
    };
    const drawComments = () => {
      const t = cur(); if (!t) return;
      const ta = el('textarea', { rows: 3, placeholder: 'Escribe un comentario…', 'aria-label': 'Nuevo comentario' });
      const send = el('button', { type: 'button', class: 'btn small', onclick: async () => {
        if (!ta.value.trim()) return ta.focus();
        send.disabled = true;
        try { const r = await edit.comment(t.id, ta.value); rows = r.fases.map((f) => ({ ...f, sub: (f.sub || []).map((x) => ({ ...x })) })); draw(); drawComments(); }
        catch (e) { edit.error(e); send.disabled = false; }
      } }, 'Comentar');
      comBox.replaceChildren(...(t.coment || []).slice().reverse().map((c) => el('article', { class: 'tp-com' }, el('div', { class: 'tp-comh' }, el('strong', {}, c.autor || 'Alguien'), c.fecha ? el('time', { class: 'muted' }, fmtDate(c.fecha, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : ''), el('p', {}, c.texto))),
        ...((t.coment || []).length ? [] : [el('p', { class: 'muted', style: 'margin:0 0 8px' }, 'Todavía no hay comentarios.')]));
      comBox.prepend(ta, el('div', { class: 'row end', style: 'margin:6px 0 12px' }, send));
    };
    const drawHead = () => {
      const t = cur(); if (!t) return closePanel();
      headBox.replaceChildren(
        el('div', { class: 'row', style: 'gap:8px;align-items:flex-start' }, el('input', { class: 'tp-title', value: t.fase, 'aria-label': 'Nombre de la tarea', onchange: (e) => { if (e.target.value.trim()) saveField((x) => { x.fase = e.target.value; }); } }),
          el('button', { type: 'button', class: 'btn ghost small tp-close', 'aria-label': 'Cerrar', onclick: closePanel }, '✕')),
        el('div', { class: 'tp-meta' }, estadoSel(t), respSel(t), el('label', { class: 'phd' }, el('small', {}, 'Inicio'), dateIn(t, 'inicio', 'Fecha de inicio')), el('label', { class: 'phd' }, el('small', {}, 'Fin'), dateIn(t, 'fecha', 'Fecha de finalización'))));
    };
    panel.sync = () => { drawHead(); drawDeps(); };
    drawHead(); drawLinks(); drawDeps(); drawComments();
    const sec = (title, ...kids) => el('section', { class: 'tp-sec' }, el('h3', {}, title), ...kids);
    const root = el('div', { class: 'tp-wrap' }, el('div', { class: 'tp-scrim', onclick: closePanel }),
      el('aside', { class: 'taskpanel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Detalle de la tarea' }, headBox,
        sec('Descripción', descTa), sec('Enlaces', linksBox), sec('Depende de', depBox), sec('Comentarios', comBox)));
    panel.root = root;
  };
  const estadoSel = (f) => { const x = sel(['Pendiente', 'En curso', 'Esperando cliente', 'Hecho'].map((o) => [o, o]), f.estado, 'Estado', (v) => { f.estado = v; save(); }); x.className = `stsel st-${{ Hecho: 'hecho', 'En curso': 'curso', 'Esperando cliente': 'espera' }[f.estado] || 'pend'}`; return x; };
  const grip = (f) => el('button', { type: 'button', class: 'draghandle', title: 'Arrastra para mover', 'aria-label': `Mover: ${f.fase}. Arrastra, o usa las flechas arriba y abajo` });
  const span = (f) => (f.inicio && f.fecha ? `${dateText(f.inicio)} → ${dateText(f.fecha)}` : f.fecha ? `Hasta el ${dateText(f.fecha)}` : f.inicio ? `Desde el ${dateText(f.inicio)}` : '');
  const sel = (opts, cur, label, on) => el('select', { 'aria-label': label, onchange: (e) => on(e.target.value) }, opts.map(([v, t]) => el('option', { value: v, selected: cur === v }, t)));
  // Responsables: el equipo de AVANIA y, aparte, las personas del cliente (con su correo, para avisarles). El valor de las del cliente lleva «cli:» delante.
  const people = (f) => {
    const mine = f.resp_correo ? clientPeople.find((p) => p.correo === f.resp_correo || p.nombre === f.responsable) : null;
    const cur = f.responsable && !f.resp_correo ? f.responsable : '';
    const l = [...new Set([...team, cur].filter(Boolean))];
    const cli = clientPeople.map((p) => [`cli:${p.nombre}`, p.nombre]);
    if (f.resp_correo && !mine && f.responsable) cli.push([`cli:${f.responsable}`, f.responsable]);
    return { cur: f.resp_correo ? `cli:${f.responsable}` : (f.responsable || ''), list: [['', 'Sin asignar'], ...l.map((n) => [n, n])], cli };
  };
  const setResp = (f, v) => {
    if (v.startsWith('cli:')) { const nombre = v.slice(4), p = clientPeople.find((x) => x.nombre === nombre); f.responsable = nombre; if (p && p.correo) f.resp_correo = p.correo; else delete f.resp_correo; }
    else { f.responsable = v; delete f.resp_correo; }
    save();
  };
  const respSel = (f) => {
    const o = people(f);
    const s = el('select', { 'aria-label': 'Responsable', title: f.resp_correo ? `${f.responsable} · ${f.resp_correo}` : '', onchange: (e) => setResp(f, e.target.value) },
      el('optgroup', { label: 'Equipo de AVANIA' }, o.list.map(([v, t]) => el('option', { value: v, selected: o.cur === v }, t))),
      o.cli.length ? el('optgroup', { label: 'Del cliente' }, o.cli.map(([v, t]) => el('option', { value: v, selected: o.cur === v }, t))) : '');
    return s;
  };
  const dateIn = (f, k, label) => el('input', { type: 'date', ...DATE_ATTRS, value: f[k] || '', 'aria-label': label, onchange: (e) => { if (!e.target.value || okDate(e.target.value)) { f[k] = e.target.value; save(); } } });
  // Una tarea o subtarea editable: nombre, responsable, estado, inicio y fin.
  const editRow = (f, { remove, extra }) => [
    el('input', { class: 'phname', value: f.fase, 'aria-label': 'Nombre', onchange: (e) => { f.fase = e.target.value; save(); } }),
    el('div', { class: 'phctl' },
      respSel(f),
      estadoSel(f),
      el('label', { class: 'phd' }, el('small', {}, 'Inicio'), dateIn(f, 'inicio', 'Fecha de inicio')),
      el('label', { class: 'phd' }, el('small', {}, 'Fin'), dateIn(f, 'fecha', 'Fecha de finalización'))),
    el('span', { class: 'phtools' }, ...(extra || []), el('button', { type: 'button', class: `btn ghost small detbtn${waiting(f).length ? ' blocked' : ''}`, title: waiting(f).length ? `Bloqueada: espera a ${waiting(f).map((x) => x.fase).join(', ')}` : 'Abrir el detalle de la tarea', 'aria-label': `Detalle: ${f.fase}`, onclick: (e) => openPanel(f, e.currentTarget) },
      detIcon(), (f.links || []).length + (f.coment || []).length + (f.desc ? 1 : 0) ? el('span', { class: 'cnt' }, String((f.links || []).length + (f.coment || []).length + (f.desc ? 1 : 0))) : ''),
      el('button', { type: 'button', class: 'phdel', title: 'Eliminar', 'aria-label': `Eliminar: ${f.fase}`, onclick: async () => {
      if (await askConfirm({ title: 'Eliminar', text: `¿Eliminar «${f.fase}»${(f.sub || []).length ? ` y sus ${f.sub.length} subtareas` : ''}? No se puede deshacer.`, ok: 'Eliminar', danger: true })) remove();
    } }, trash()))];
  const addSub = (f, i) => {
    const name = el('input', { placeholder: 'Nueva subtarea…', 'aria-label': 'Nueva subtarea', style: 'flex:1;min-width:160px' });
    return el('form', { class: 'row phsubadd', onsubmit: (e) => { e.preventDefault(); if (!name.value.trim()) return; (f.sub ||= []).push({ fase: name.value.trim(), quien: f.quien, estado: 'Pendiente', responsable: f.responsable || '', inicio: '', fecha: '', nota: '' }); open.add(i); save(); } }, name, el('button', { class: 'btn small' }, '+ Subtarea'));
  };
  let draw = () => {
    const done = rows.filter((f) => f.estado === 'Hecho').length, pct = rows.length ? Math.round((done / rows.length) * 100) : 0;
    const now = rows.findIndex((f) => f.estado !== 'Hecho');
    const cls = (f) => (f.estado === 'Hecho' ? 'hecho' : f.estado === 'En curso' ? 'curso' : f.estado === 'Esperando cliente' ? 'espera' : 'pend');
    const subView = (x) => el('li', { class: `phsub st-${cls(x)}` }, el('span', { class: 'phsn', 'aria-hidden': 'true' }, x.estado === 'Hecho' ? '✓' : '·'), el('span', { class: 'phname' }, x.fase),
      x.responsable ? el('span', { class: 'phwho' }, x.responsable) : '', el('span', { class: 'phdate' }, span(x)), el('span', { class: 'phst' }, label(x.estado)));
    const item = (f, i) => {
      const subs = f.sub || [], sdone = subs.filter((x) => x.estado === 'Hecho').length, shown = open.has(i) || (!edit && subs.length);
      const head = el('div', { class: `ph st-${cls(f)}${i === now ? ' now' : ''}` },
        el('span', { class: 'phn', 'aria-hidden': 'true' }, f.estado === 'Hecho' ? '✓' : String(i + 1)),
        ...(edit ? editRow(f, { remove: () => { rows.splice(i, 1); save(); }, extra: [
          el('button', { type: 'button', class: `btn ghost small${subs.length ? ' has' : ''}`, title: subs.length ? `Subtareas: ${sdone} de ${subs.length} hechas` : 'Añadir subtareas', 'aria-label': 'Subtareas', 'aria-expanded': String(open.has(i)), onclick: () => { open.has(i) ? open.delete(i) : open.add(i); draw(); } }, subs.length ? `↳ ${sdone}/${subs.length}` : '↳ +')] })
          : [el('span', { class: 'phname' }, f.fase, f.nota ? el('small', {}, f.nota) : '', subs.length ? el('small', {}, `${sdone} de ${subs.length} subtareas hechas`) : ''),
            f.responsable ? el('span', { class: 'phwho' }, f.responsable) : el('span', { class: 'twho', 'data-who': { AVANIA: 'avania', Cliente: 'cliente', Ambos: 'ambos' }[f.quien] }, viewer === 'cliente' && f.quien === 'Cliente' ? 'Vosotros' : f.quien),
            el('span', { class: 'phdate' }, span(f)), el('span', { class: 'phst' }, label(f.estado))]));
      return el('li', { class: `phitem${edit ? ' sortable' : ''}` }, edit ? grip(f) : '', head, shown ? el('div', { class: 'phsubs' },
        edit ? (() => { const ul = el('ul', { class: 'phsub-list' }, subs.map((x, j) => el('li', { class: `ph phsub-edit sortable st-${cls(x)}` }, grip(x), el('span', { class: 'phsn', 'aria-hidden': 'true' }, '·'),
          ...editRow(x, { remove: () => { subs.splice(j, 1); save(); } })))); sortable(ul, (a, b) => { open.add(i); reorder(subs, a, b); }, (n) => { focusAt = { sub: i, n }; }); return ul; })() : el('ul', { class: 'phsub-list' }, subs.map(subView)),
        edit ? addSub(f, i) : '') : '');
    };
    const newName = edit ? el('input', { placeholder: 'Añadir una tarea…', 'aria-label': 'Nueva tarea', style: 'flex:1;min-width:200px' }) : null;
    box.replaceChildren(
      el('div', { class: 'row', style: 'margin-bottom:8px' }, el('strong', { class: 'grow' }, `${done} de ${rows.length} tareas hechas`), el('span', { class: 'num' }, `${pct}%`)), bar(pct, 'client'),
      (() => { const ol = el('ol', { class: 'phases-list' }, rows.map(item)); if (edit) sortable(ol, (a, b) => reorder(rows, a, b), (n) => { focusAt = { top: n }; }); return ol; })(),
      edit ? el('form', { class: 'row', style: 'margin-top:10px;gap:8px;flex-wrap:wrap', onsubmit: (e) => { e.preventDefault(); if (!newName.value.trim()) return; rows.push({ fase: newName.value.trim(), quien: 'AVANIA', estado: 'Pendiente', responsable: '', inicio: '', fecha: '', nota: '', sub: [] }); save(); } },
        newName, el('button', { class: 'btn small' }, '+ Añadir tarea')) : '');
  };
  const draw0 = draw;
  draw = () => { draw0(); if (edit && panel.root) { box.append(panel.root); panel.sync?.(); } if (focusAt) { const f = focusAt; focusAt = null; const t = f.top != null ? box.querySelectorAll('.phases-list > .phitem > .draghandle')[f.top] : box.querySelectorAll('.phases-list > .phitem')[f.sub]?.querySelectorAll('.phsub-edit > .draghandle')[f.n]; t?.focus(); } };
  draw();
  return box;
}

/** Las dos listas de tareas, una al lado de la otra: las del cliente y las de AVANIA. */
export function taskColumns(tasks, { href, mine = 'Del cliente', ours = 'De AVANIA', limit = 8 } = {}) {
  const col = (title, list, empty) => el('section', { class: 'cgroup' }, el('h3', {}, `${title} (${list.length})`), taskList(list, { href, empty, limit }));
  return el('div', { class: 'cols2' }, col(mine, tasks.filter((t) => t.who === 'cliente'), 'Nada pendiente por esta parte.'), col(ours, tasks.filter((t) => t.who === 'avania'), 'Nada pendiente por esta parte.'));
}

/** Cronograma: fechas por orden, con quién actúa. Con `edit({section, key}, valor)` los hitos llevan un selector de fecha para cambiarla en el sitio. */
export function timelineNode(items, { limit = 14, who = { cliente: 'Cliente', avania: 'AVANIA', ambos: 'Ambos' }, edit = null, remove = null, toggle = null } = {}) {
  const list = items.filter((t) => (!t.done || toggle) && (edit || t.date || !t.edit));   // con `toggle` (agencia) también se ven las hechas, para poder desmarcarlas
  if (!list.length) return el('p', { class: 'muted', style: 'margin:0' }, 'Todavía no hay fechas clave. Se irán sumando con el rodaje, la formación y las acciones que se acuerden.');
  return el('ol', { class: 'timeline' + (edit ? ' editable' : '') }, list.slice(0, limit).map((t) => el('li', { class: (t.past ? 'past ' : '') + (t.hito ? 'hito ' : '') + (t.done ? 'done' : '') },
    edit && t.edit
      ? el('span', { class: 'tdate' }, el('input', { type: 'date', ...DATE_ATTRS, value: t.date || '', 'aria-label': `Fecha: ${t.label}`, onchange: (e) => { if (okDate(e.target.value)) edit(t.edit, e.target.value); } }))
      : el('time', {}, dateText(t.date)),
    el('span', { class: 'twho', 'data-who': t.who }, who[t.who] || t.who),
    el('span', { class: 'tlabel' }, t.label, t.auto ? el('small', {}, 'Fecha calculada desde el inicio (sin contar fines de semana). Cámbiala si hace falta.') : '', t.note ? el('small', {}, String(t.note).slice(0, 140)) : ''),
    toggle && t.del ? el('label', { class: 'tdone', title: t.done ? 'Marcada como hecha: pulsa para volver a ponerla pendiente' : 'Marcar como hecha' }, el('input', { type: 'checkbox', checked: t.done, 'aria-label': `Hecha: ${t.label}`, onchange: (e) => toggle(t, e.target.checked) }), 'Hecha') : '',
    remove && t.del ? el('button', { type: 'button', class: 'btn ghost small tdel', title: 'Eliminar esta acción', 'aria-label': `Eliminar: ${t.label}`, onclick: () => remove(t) }, '✕') : '')));
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
    h.fases ? el('section', { class: 'cgroup' }, el('h2', {}, 'Fechas clave'), el('div', { class: 'card' }, timelineNode(h.timeline || []))) : '',
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
