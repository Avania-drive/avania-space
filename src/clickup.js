// Sincronización de las tareas del cliente (fases y subtareas de «Tareas») con un espacio de ClickUp.
// Necesita en el .env: CLICKUP_API_TOKEN (token personal de ClickUp: Ajustes › Apps) y, si la cuenta tiene varios espacios de trabajo,
// CLICKUP_TEAM_ID. Se puede probar contra un servidor de pruebas con CLICKUP_API_BASE.
const BASE = () => process.env.CLICKUP_API_BASE || 'https://api.clickup.com/api/v2';
export const clickupEnabled = () => Boolean(process.env.CLICKUP_API_TOKEN);
const fail = (msg, status = 502) => Object.assign(new Error(msg), { status });

async function cu(method, path, body) {
  if (!clickupEnabled()) throw fail('Falta la clave de ClickUp: pon CLICKUP_API_TOKEN en el .env del servidor (token personal de ClickUp, Ajustes › Apps).', 409);
  const r = await fetch(BASE() + path, { method, signal: AbortSignal.timeout(30_000), headers: { Authorization: process.env.CLICKUP_API_TOKEN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(`ClickUp ${method} ${path.split('?')[0]}: ${r.status} ${j.err || j.ECODE || ''}`.trim(), r.status === 401 ? 409 : 502);
  return j;
}

/** De una URL de ClickUp saca el espacio de trabajo y, si la hay, el espacio (…/v/o/s/<id>) o la lista (…/v/li/<id>). */
export function parseClickupUrl(url) {
  const t = String(url || '').trim();
  if (!/^https?:\/\/([\w-]+\.)?clickup\.com\//i.test(t)) return null;
  const path = new URL(t).pathname;
  return { team: (/^\/(\d{4,})\b/.exec(path) || [])[1] || null, space: (/\/s\/(\d{4,})/.exec(path) || [])[1] || null, list: (/\/li\/(\d{4,})/.exec(path) || [])[1] || null };
}

async function teamId(hint) {
  const wanted = process.env.CLICKUP_TEAM_ID || hint;
  const { teams = [] } = await cu('GET', '/team');
  const t = teams.find((x) => String(x.id) === String(wanted)) || (teams.length === 1 ? teams[0] : null);
  if (!t) throw fail(teams.length ? 'Hay varios espacios de trabajo en ClickUp: pon CLICKUP_TEAM_ID en el .env.' : 'ClickUp no devuelve ningún espacio de trabajo con esa clave.', 409);
  return t;
}
const spaceUrl = (team, space) => `https://app.clickup.com/${team}/v/o/s/${space}`;
const ms = (iso, end = false) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? Date.parse(`${iso}T${end ? '18:00' : '09:00'}:00Z`) : undefined);
const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/**
 * Sincroniza. `link` = lo que haya en «Enlace de ClickUp» del proyecto; `clientName`; `fases` = las tareas de Space; `state` = { list_id } guardado de otras veces.
 * Devuelve { link, spaceCreated, listId, fases (con `cu` y estados al día), created, updated, pulled, notified, unassigned }.
 * Cada tarea con responsable se asigna a esa persona de ClickUp (por nombre), con su fecha de inicio (o la de hoy si no tiene) y la de fin, y se le avisa.
 */
export async function syncClickup({ link, clientName, fases, state = {} }) {
  const parsed = parseClickupUrl(link);
  const team = await teamId(parsed?.team);
  // 1) El espacio: el del enlace si existe y responde; si no, se crea uno con el nombre del cliente.
  let space = null, spaceCreated = false;
  if (parsed?.space) { try { space = await cu('GET', `/space/${parsed.space}`); } catch (e) { if (e.status === 409) throw e; space = null; } }
  if (!space) {
    space = await cu('POST', `/team/${team.id}/space`, { name: String(clientName).slice(0, 100), multiple_assignees: true, features: { due_dates: { enabled: true, start_date: true }, time_tracking: { enabled: false }, tags: { enabled: true }, checklists: { enabled: true } } });
    spaceCreated = true;
  }
  // 2) La lista «Tareas del proyecto» dentro del espacio.
  let listId = state.list_id && !spaceCreated ? String(state.list_id) : null;
  if (parsed?.list && !spaceCreated) listId = parsed.list;
  if (listId) { try { await cu('GET', `/list/${listId}`); } catch (e) { if (e.status === 409) throw e; listId = null; } }
  if (!listId) {
    const { lists = [] } = await cu('GET', `/space/${space.id}/list`);
    listId = (lists.find((l) => norm(l.name) === norm('Tareas del proyecto')) || {}).id || (await cu('POST', `/space/${space.id}/list`, { name: 'Tareas del proyecto' })).id;
  }
  // 3) Personas del equipo de ClickUp para asignar por nombre (usuario, correo o nombre de pila).
  const members = (team.members || []).map((m) => m.user).filter(Boolean);
  const person = (name) => {
    const n = norm(name); if (n.length < 3) return null;
    const keys = (m) => [norm(m.username), norm(String(m.email || '').split('@')[0])].filter((k) => k.length >= 3);
    return members.find((m) => keys(m).includes(n)) || members.find((m) => keys(m).some((k) => k.includes(n) || n.includes(k))) || null;
  };
  // 4) Estado actual en ClickUp (para traer lo que ya se cerró allí).
  const remote = new Map();
  for (let page = 0; page < 10; page += 1) {
    const { tasks = [] } = await cu('GET', `/list/${listId}/task?include_closed=true&subtasks=true&page=${page}`);
    tasks.forEach((t) => remote.set(String(t.id), t));
    if (tasks.length < 100) break;
  }
  let created = 0, updated = 0, pulled = 0;
  const notified = [], unassigned = [];
  const today = new Date().toISOString().slice(0, 10);
  const closedStatus = (t) => t.status?.type === 'closed';
  const dateText = (iso) => (iso ? iso.split('-').reverse().join('/') : 'sin fecha');
  // Fechas: la de inicio de la tarea (si no la tiene, hoy, que es cuando se le asigna) y la de fin de la tarea.
  const dates = (f) => ({ start_date: ms(f.inicio || today), start_date_time: false, ...(ms(f.fecha, true) ? { due_date: ms(f.fecha, true), due_date_time: false } : {}) });
  async function one(f, parent) {
    const r = f.cu ? remote.get(String(f.cu)) : null;
    if (r && closedStatus(r) && f.estado !== 'Hecho') { f.estado = 'Hecho'; pulled += 1; }   // lo cerrado en ClickUp se trae a Space
    const p = person(f.responsable);
    if (f.responsable && !p) unassigned.push(f.responsable);
    let id = r ? String(r.id) : null, isNew = false;
    if (id) {
      const had = (r.assignees || []).some((a) => p && String(a.id) === String(p.id));
      await cu('PUT', `/task/${id}`, { name: f.fase, ...(f.nota ? { description: f.nota } : {}), ...dates(f), ...(p && !had ? { assignees: { add: [p.id], rem: [] } } : {}) });
      updated += 1; isNew = !!(p && !had);
    } else {
      id = String((await cu('POST', `/list/${listId}/task`, { name: f.fase, ...(f.nota ? { description: f.nota } : {}), ...dates(f), ...(p ? { assignees: [p.id], notify_all: true } : {}), ...(parent ? { parent } : {}) })).id);
      created += 1; isNew = !!p;
    }
    f.cu = id;
    // Aviso: ClickUp avisa a quien se asigna; además se deja un comentario con las fechas, que también le llega como notificación.
    if (isNew && p) {
      await cu('POST', `/task/${id}/comment`, { comment_text: `Nueva tarea para ti (${clientName}): «${f.fase}». Asignada el ${dateText(today)} · inicio ${dateText(f.inicio || today)} · fin ${dateText(f.fecha)}.`, assignee: p.id, notify_all: true }).catch(() => {});
      notified.push(p.username);
    }
    const wantDone = f.estado === 'Hecho';
    if (wantDone && !(r && closedStatus(r))) await cu('PUT', `/task/${id}`, { status: 'complete' }).catch(() => cu('PUT', `/task/${id}`, { status: 'closed' }).catch(() => {}));
    if (!wantDone && r && closedStatus(r)) await cu('PUT', `/task/${id}`, { status: 'to do' }).catch(() => {});
    return id;
  }
  for (const f of fases) {
    const parentId = await one(f, null);
    for (const s of f.sub || []) await one(s, parentId);
  }
  return { link: spaceCreated || !parsed?.space ? spaceUrl(team.id, space.id) : link, spaceCreated, spaceId: String(space.id), listId: String(listId), fases, created, updated, pulled, notified: [...new Set(notified)], unassigned: [...new Set(unassigned)] };
}
