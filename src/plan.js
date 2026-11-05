// Tareas priorizadas (de AVANIA y del cliente) y cronograma del proyecto, calculados a partir de lo que hay en la ficha.
// Lo usan el panel de la agencia, el espacio del cliente y el informe por correo.
import { FORM, BLOCKS, gates, isFilled } from './formdef.js';

const ORDER = { alta: 0, media: 1, baja: 2 };
const norm = (v) => ({ alta: 'alta', media: 'media', baja: 'baja' }[String(v || '').trim().toLowerCase()] || 'media');
// Prioridad por sección: lo que bloquea el lanzamiento, primero.
const PRIO_CLIENT = { meta: 'alta', accesos: 'alta', whatsapp: 'alta', rodaje: 'alta', formacion: 'alta', clinica: 'media', zona: 'media', agenda: 'media', materiales: 'media', mercado: 'media', cierre: 'baja' };
const PRIO_TEAM = { proyecto: 'alta', negocio: 'alta', oferta: 'alta', avania: 'media' };
const GATE_FIELDS = new Set(['meta.bm_acceso', 'meta.pixel', 'whatsapp.wa_numero', 'whatsapp.wa_nuevo', 'rodaje.dias_rodaje', 'formacion.fechas_formacion']);
const fieldsOf = (s) => s.groups.flatMap((g) => g.fields);
const hidden = (f) => f.owner === 'team' && !f.shared && !f.clientEdit;
const areaOf = (key) => BLOCKS.find((b) => b.sections.includes(key));

/** 'YYYY-MM-DD' desde un valor escrito a mano ('2026-11-05' o '5/11/2026'); null si no se entiende. */
export function isoDate(v) {
  const t = String(v || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) { const d = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t); if (d) m = [0, d[3], d[2].padStart(2, '0'), d[1].padStart(2, '0')]; }
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return Number.isNaN(Date.parse(iso)) || m[1] < '2000' || m[1] > '2100' ? null : iso;   // un año a medio teclear (0002) no es una fecha
}
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);

/**
 * Tareas pendientes, ordenadas por prioridad y fecha. `who` = 'cliente' | 'avania'.
 * `client_visible`: si el cliente puede verla (lo interno de la agencia no se le enseña).
 */
export function tasksOf(sections, creds = {}, { allowed = null, dental = true, now = today() } = {}) {
  const out = [];
  const add = (t) => out.push({ due: null, overdue: false, detail: '', ...t });
  const open = (s) => !allowed || allowed.has(s.key);
  for (const g of gates(sections, creds, allowed).filter((x) => !x.done)) {
    add({ who: g.delegated ? 'avania' : 'cliente', priority: 'alta', title: g.delegated ? g.todo : g.ask, detail: g.why, section: g.section, area: areaOf(g.section)?.key, client_visible: true, kind: 'lanzamiento' });
  }
  for (const s of FORM.filter(open)) {
    const data = sections[s.key] || {};
    const del = new Set(Array.isArray(data._avania) ? data._avania : []);
    const fs = fieldsOf(s).filter((f) => !f.optional && (dental || !f.dental) && !isFilled(f, data[f.k]) && !GATE_FIELDS.has(`${s.key}.${f.k}`));
    const mine = fs.filter((f) => f.owner !== 'team' && !del.has(f.k)), delegated = fs.filter((f) => f.owner !== 'team' && del.has(f.k)), theirs = fs.filter((f) => f.owner === 'team');
    const names = (l) => l.slice(0, 4).map((f) => f.label).join(', ') + (l.length > 4 ? `… (+${l.length - 4})` : '');
    if (mine.length) add({ who: 'cliente', priority: PRIO_CLIENT[s.key] || 'media', title: `Completar «${s.title}»`, detail: `Faltan ${mine.length}: ${names(mine)}`, section: s.key, area: areaOf(s.key)?.key, client_visible: true, kind: 'ficha' });
    if (delegated.length) add({ who: 'avania', priority: PRIO_CLIENT[s.key] || 'media', title: `Hacer por el cliente en «${s.title}»`, detail: names(delegated), section: s.key, area: areaOf(s.key)?.key, client_visible: true, kind: 'delegado' });
    if (theirs.length) add({ who: 'avania', priority: PRIO_TEAM[s.key] || 'media', title: `Completar «${s.title}»`, detail: `Faltan ${theirs.length}: ${names(theirs)}`, section: s.key, area: areaOf(s.key)?.key, client_visible: !hidden(theirs[0]), kind: 'ficha' });
  }
  for (const [key, who] of [['acciones_avania', 'avania'], ['acciones_cliente', 'cliente']]) {
    for (const r of (sections.cronograma || {})[key] || []) {
      if (!String(r?.accion || '').trim() || /^hecha$/i.test(r.estado || '')) continue;
      const due = isoDate(r.fecha), late = !!due && due < now;
      add({ who, priority: late ? 'alta' : norm(r.prioridad), title: String(r.accion).trim(), detail: late ? 'Vencida' : /curso/i.test(r.estado || '') ? 'En curso' : '', section: 'cronograma', area: 'cronograma', client_visible: true, kind: 'accion', due, overdue: late });
    }
  }
  for (const f of fasesFlat(sections)) {
    if (f.estado !== 'En curso' && f.estado !== 'Esperando cliente') continue;
    const due = isoDate(f.fecha), late = !!due && due < now, who = f.quien === 'Cliente' ? 'cliente' : 'avania';
    add({ who, priority: late || f.estado === 'Esperando cliente' ? 'alta' : 'media', title: f.fase, detail: [f.estado, late ? 'Vencida' : '', f.nota].filter(Boolean).join(' · '), section: 'proceso', area: null, client_visible: true, kind: 'fase', due, overdue: late });
  }
  return out.sort((a, b) => ORDER[a.priority] - ORDER[b.priority] || (a.due || '9999').localeCompare(b.due || '9999') || a.who.localeCompare(b.who));
}

// Las fases por las que pasa un cliente desde que están hechos los documentos de investigación (avatar, competencia, sociodemográfico y oferta).
export const FASES_ESTADO = ['Pendiente', 'En curso', 'Esperando cliente', 'Hecho'];
export const FASES_QUIEN = ['AVANIA', 'Cliente', 'Ambos'];
const WHO = { AVANIA: 'avania', Cliente: 'cliente', Ambos: 'ambos' };
export const FASES_BASE = [
  ['Documentos de investigación (avatar, competencia, sociodemográfico y oferta)', 'AVANIA'], ['Preparación de los guiones', 'AVANIA'], ['Aprobación de los guiones', 'Cliente'],
  ['Preparación del diseño gráfico', 'AVANIA'], ['Fechas de grabación elegidas', 'Cliente'], ['Envío de guiones para la grabación', 'AVANIA'], ['Rodaje de los vídeos', 'Ambos'],
  ['Edición de los vídeos', 'AVANIA'], ['Copies de las campañas', 'AVANIA'], ['Montaje de las campañas (anuncios, píxel, Avania Funnels y Avania Setex)', 'AVANIA'],
  ['Aprobación de copies, gráficos y vídeos', 'Cliente'], ['Formación del equipo del cliente', 'Ambos'], ['Fecha de lanzamiento estimada', 'AVANIA'], ['Primera revisión de resultados', 'AVANIA'],
];
export const fasesBase = () => FASES_BASE.map(([fase, quien]) => ({ fase, quien, estado: 'Pendiente', responsable: '', inicio: '', fecha: '', nota: '', sub: [] }));
/** Las fases del cliente: las que haya guardado la agencia o, si aún no hay ninguna, la lista estándar. */
export const fasesOf = (sections) => (Array.isArray((sections.proceso || {}).fases) && sections.proceso.fases.length ? sections.proceso.fases : fasesBase());
// Tarea (antes «fase») y sus subtareas: quién la hace (AVANIA / Cliente / Ambos), la persona del equipo responsable, inicio y fin (`fecha`).
export function cleanFases(list) {
  const t = (v, n) => String(v ?? '').trim().slice(0, n);
  const one = (r) => {
    const inicio = isoDate(r.inicio) || '', fecha = isoDate(r.fecha) || '';
    return { fase: t(r.fase, 160), quien: FASES_QUIEN.includes(r.quien) ? r.quien : 'AVANIA', estado: FASES_ESTADO.includes(r.estado) ? r.estado : 'Pendiente',
      responsable: t(r.responsable, 80), inicio, fecha, nota: t(r.nota, 300) };
  };
  return (Array.isArray(list) ? list : []).slice(0, 60).filter((r) => t(r?.fase, 160)).map((r) => ({
    ...one(r), sub: (Array.isArray(r.sub) ? r.sub : []).slice(0, 40).filter((x) => t(x?.fase, 160)).map(one) }));
}
/** Tareas y subtareas en una sola lista (las subtareas llevan el nombre de su tarea delante). */
export const fasesFlat = (sections) => fasesOf(sections).flatMap((f) => [f, ...(f.sub || []).map((x) => ({ ...x, fase: `${f.fase} › ${x.fase}`, esSub: true }))]);

/** Suma días laborables (de lunes a viernes; los festivos no se conocen). */
export function addWorkdays(iso, n) {
  let d = new Date(iso + 'T12:00:00Z'), left = n;
  while (left > 0) { d = new Date(d.getTime() + 864e5); if (![0, 6].includes(d.getUTCDay())) left--; }
  return d.toISOString().slice(0, 10);
}

/**
 * Cronograma: hitos y fechas de todas las secciones, por orden de fecha (las que no tienen fecha, al final).
 * Los hitos llevan `edit: { section, key }` para cambiarles la fecha desde el propio cronograma; `auto` = calculada.
 * `includeEmpty`: enseñar también los hitos aún sin fecha (la agencia los rellena); el cliente solo ve los que la tienen.
 */
export function timelineOf(sections, { now = today(), includeEmpty = false } = {}) {
  const g = (sec) => sections[sec] || {};
  const items = [];
  const add = (date, label, who, extra = {}) => items.push({ date: date || null, label, who, done: false, ...extra });
  const hito = (date, label, who, section, key, extra = {}) => { if (date || includeEmpty) add(date, label, who, { section, hito: true, edit: { section, key }, ...extra }); };
  const start = isoDate(g('proyecto').fecha_inicio);
  hito(isoDate(g('proyecto').fecha_firma), 'Firma del contrato', 'ambos', 'proyecto', 'fecha_firma');
  hito(start, 'Inicio del proyecto', 'ambos', 'proyecto', 'fecha_inicio');
  const manual = isoDate(g('proyecto').fecha_montaje);
  const goal = manual || (start ? addWorkdays(start, 20) : null);
  hito(goal, 'Objetivo: montaje completo (20 días laborables)', 'avania', 'proyecto', 'fecha_montaje', { auto: !manual && !!goal });
  for (const d of g('rodaje').dias_rodaje || []) add(isoDate(d), 'Rodaje de vídeos (fecha propuesta por el cliente)', 'cliente', { section: 'rodaje' });
  const fTxt = String(g('formacion').fechas_formacion || '').trim();
  if (fTxt) add(null, 'Formación del equipo (fechas propuestas por el cliente)', 'cliente', { section: 'formacion', note: fTxt });
  for (const f of fasesFlat(sections)) { const d = isoDate(f.fecha); if (d) add(d, f.fase, WHO[f.quien] || 'ambos', { section: 'proceso', done: f.estado === 'Hecho', note: [f.estado, f.responsable].filter(Boolean).join(' · '), fase: true }); }
  for (const [key, who] of [['acciones_avania', 'avania'], ['acciones_cliente', 'cliente']])
    for (const r of g('cronograma')[key] || []) if (String(r?.accion || '').trim())
      add(isoDate(r.fecha), String(r.accion).trim(), who, { section: 'cronograma', priority: norm(r.prioridad), done: /^hecha$/i.test(r.estado || ''), note: r.estado || '' });
  for (const it of items) it.past = !!it.date && it.date < now && !it.done;
  items.forEach((it, i) => { it.ord = i; });   // sin fecha, o con la misma, se respeta el orden lógico del proyecto
  return items.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.ord - b.ord);
}
