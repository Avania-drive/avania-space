// Registro de actividad de usuarios: quién creó, desactivó o cambió a quién, y qué clientes lleva cada miembro.
import { q } from './db.js';

export async function audit(actor, action, { kind = 'equipo', client = null, target = null, detail = null } = {}) {
  try {
    const c = client ? (typeof client === 'string' ? (await q('select id, name from clients where id = $1', [client])).rows[0] : client) : null;
    await q('insert into audit_log (actor, actor_kind, action, client_id, client_name, target, detail) values ($1,$2,$3,$4,$5,$6,$7)',
      [actor || null, kind, action, c?.id || null, c?.name || null, target, detail]);
  } catch (e) { console.error('[audit]', e.message); }
}
