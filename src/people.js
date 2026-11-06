// Gestión de usuarios: clientes asignados al equipo (los miembros solo ven los suyos), vista general de personas y registro.
import { q } from './db.js';
import { requireUser, requireRole } from './auth.js';
import { audit } from './audit.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER = { notes: 'client_notes', links: 'client_links', credentials: 'credentials', 'client-users': 'client_users', 'access-requests': 'access_requests' };

// Ids de clientes que puede ver el usuario: null = todos (superadmin y administradores).
export async function allowedClients(user) {
  if (!user || user.role !== 'member') return null;
  return (await q('select client_id from client_assignments where user_id = $1', [user.id])).rows.map((r) => r.client_id);
}

// Un miembro que crea un cliente lo lleva él.
export async function assignCreator(user, clientId) {
  if (user?.role === 'member') await q('insert into client_assignments (client_id, user_id, assigned_by) values ($1,$2,$3) on conflict do nothing', [clientId, user.id, user.email]);
}

// Antes de cualquier ruta: un miembro no puede tocar un cliente que no tiene asignado (ni sus notas, enlaces, credenciales o usuarios).
export function scopeMiddleware(wrap) {
  return wrap(async (req, res, next) => {
    if (!req.user || req.user.role !== 'member') return next();
    req.allowed = await allowedClients(req.user);
    const parts = req.path.split('/').filter(Boolean);   // /clients/:id/..., /notes/:id, ...
    let clientId = null;
    if (parts[0] === 'clients' && UUID.test(parts[1] || '')) clientId = parts[1];
    else if (OWNER[parts[0]] && UUID.test(parts[1] || '')) {
      const r = await q(`select client_id from ${OWNER[parts[0]]} where id = $1`, [parts[1]]);
      if (!r.rows[0]) return next();   // la ruta responderá «no existe»
      clientId = r.rows[0].client_id;
    }
    if (clientId && !req.allowed.includes(clientId)) return res.status(404).json({ error: 'No existe' });
    next();
  });
}

export function mountPeople(app, { wrap, staff }) {
  const sa = requireRole('super_admin');
  const lead = requireRole('super_admin', 'admin');

  // Vista general: todas las personas de todos los clientes.
  app.get('/api/people', ...staff, lead, wrap(async (_req, res) => {
    const r = await q(`select u.id, u.client_id, c.name client_name, c.archived client_archived, u.email, u.name, u.role, u.active, u.last_login, u.created_at, u.created_by,
        (u.password_hash is null) pending
      from client_users u join clients c on c.id = u.client_id order by c.name, u.role, u.created_at`);
    res.json({ people: r.rows });
  }));

  // Clientes de un miembro del equipo.
  app.get('/api/users/:id/clients', ...staff, sa, wrap(async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const r = await q(`select c.id, c.name, c.archived, c.category, exists(select 1 from client_assignments a where a.client_id = c.id and a.user_id = $1) assigned from clients c order by c.archived, c.name`, [req.params.id]);
    res.json({ clients: r.rows });
  }));
  app.put('/api/users/:id/clients', ...staff, sa, wrap(async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const u = (await q('select id, email, name, role from team_users where id = $1', [req.params.id])).rows[0];
    if (!u) return res.status(404).json({ error: 'No existe' });
    const ids = [...new Set((Array.isArray(req.body.client_ids) ? req.body.client_ids : []).filter((x) => UUID.test(String(x))))];
    const before = new Set((await q('select client_id from client_assignments where user_id = $1', [u.id])).rows.map((x) => x.client_id));
    await q('delete from client_assignments where user_id = $1', [u.id]);
    if (ids.length) await q('insert into client_assignments (client_id, user_id, assigned_by) select c.id, $1, $2 from clients c where c.id = any($3::uuid[])', [u.id, req.user.email, ids]);
    const added = ids.filter((x) => !before.has(x)).length, removed = [...before].filter((x) => !ids.includes(x)).length;
    if (added || removed) await audit(req.user.email, 'asignar clientes', { target: u.email, detail: `${added} añadidos, ${removed} quitados · ahora ${ids.length}` });
    res.json({ ok: true, count: ids.length });
  }));

  // Equipo de un cliente (desde la ficha del cliente).
  app.get('/api/clients/:id/assignees', ...staff, lead, wrap(async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const r = await q(`select u.id, u.email, u.name, u.role, exists(select 1 from client_assignments a where a.client_id = $1 and a.user_id = u.id) assigned
      from team_users u where u.active and u.role <> 'super_admin' order by u.role, u.name, u.email`, [req.params.id]);
    res.json({ users: r.rows });
  }));
  app.put('/api/clients/:id/assignees', ...staff, lead, wrap(async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const c = (await q('select id, name from clients where id = $1', [req.params.id])).rows[0];
    if (!c) return res.status(404).json({ error: 'No existe' });
    const ids = [...new Set((Array.isArray(req.body.user_ids) ? req.body.user_ids : []).filter((x) => UUID.test(String(x))))];
    const before = new Set((await q('select user_id from client_assignments where client_id = $1', [c.id])).rows.map((x) => x.user_id));
    await q('delete from client_assignments where client_id = $1', [c.id]);
    if (ids.length) await q("insert into client_assignments (client_id, user_id, assigned_by) select $1, u.id, $2 from team_users u where u.id = any($3::uuid[]) and u.role <> 'super_admin'", [c.id, req.user.email, ids]);
    const added = ids.filter((x) => !before.has(x)).length, removed = [...before].filter((x) => !ids.includes(x)).length;
    if (added || removed) await audit(req.user.email, 'asignar equipo', { client: c, detail: `${added} añadidos, ${removed} quitados` });
    res.json({ ok: true });
  }));

  // Registro de actividad.
  app.get('/api/audit', ...staff, sa, wrap(async (req, res) => {
    const lim = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
    const r = await q('select id, at, actor, actor_kind, action, client_id, client_name, target, detail from audit_log order by at desc, id desc limit $1', [lim]);
    res.json({ log: r.rows });
  }));
}
