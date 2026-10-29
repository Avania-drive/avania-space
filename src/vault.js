// Bóveda de herramientas de AVANIA: las cuentas de las herramientas que usa la agencia (no las de los clientes).
// Solo administradores. Contraseña y clave API cifradas como las credenciales; ver o copiar exige contraseña reciente y doble verificación,
// y queda registrado quién lo hizo (credential_log, con client_id vacío).
import { q } from './db.js';
import { encrypt, decrypt } from './crypto.js';
import { requireRole, requirePasswordRecent } from './auth.js';

const clip = (v, n = 500) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, n));
const url = (v) => { const t = clip(v, 1000); return t && /^https?:\/\//i.test(t) ? t : null; };
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
const out = (r) => ({
  id: r.id, name: r.name, category: r.category, purpose: r.purpose, url: r.url, username: r.username, used_by: r.used_by, cost: r.cost,
  renewal: r.renewal ? String(r.renewal.toISOString?.() ?? r.renewal).slice(0, 10) : null, notes: r.notes,
  has_password: !!r.password_enc, has_api_key: !!r.api_key_enc, updated_at: r.updated_at, updated_by: r.updated_by,
});

export function mountVault(app, { wrap, isUuid, staff, log }) {
  const guard = [...staff, requireRole('super_admin', 'admin'), wrap(requirePasswordRecent)];
  const bad = (res) => res.status(400).json({ error: 'Id no válido' });

  app.get('/api/vault', ...guard, wrap(async (_req, res) => {
    res.json({ tools: (await q('select * from vault_tools order by lower(name)')).rows.map(out) });
  }));

  const fields = (b, cur = {}) => ({
    name: clip(b.name, 120) ?? cur.name, category: 'category' in b ? clip(b.category, 60) : cur.category, purpose: 'purpose' in b ? clip(b.purpose, 300) : cur.purpose,
    url: 'url' in b ? url(b.url) : cur.url, username: 'username' in b ? clip(b.username, 200) : cur.username, used_by: 'used_by' in b ? clip(b.used_by, 200) : cur.used_by,
    cost: 'cost' in b ? clip(b.cost, 80) : cur.cost, renewal: 'renewal' in b ? date(b.renewal) : cur.renewal, notes: 'notes' in b ? clip(b.notes, 3000) : cur.notes,
    password_enc: b.password ? encrypt(String(b.password).slice(0, 500)) : cur.password_enc, api_key_enc: b.api_key ? encrypt(String(b.api_key).slice(0, 2000)) : cur.api_key_enc,
  });
  app.post('/api/vault', ...guard, wrap(async (req, res) => {
    const f = fields(req.body);
    if (!f.name) return res.status(400).json({ error: 'Pon el nombre de la herramienta' });
    const r = await q(`insert into vault_tools (name, category, purpose, url, username, used_by, cost, renewal, notes, password_enc, api_key_enc, updated_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`, [f.name, f.category, f.purpose, f.url, f.username, f.used_by, f.cost, f.renewal, f.notes, f.password_enc, f.api_key_enc, req.user.email]);
    await log(r.rows[0].id, null, req.user.id, req.user.email, 'bóveda: crear');
    res.json({ tool: out(r.rows[0]) });
  }));
  app.put('/api/vault/:id', ...guard, wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res);
    const cur = (await q('select * from vault_tools where id = $1', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'No existe' });
    const f = fields(req.body, cur);
    const r = await q(`update vault_tools set name=$1, category=$2, purpose=$3, url=$4, username=$5, used_by=$6, cost=$7, renewal=$8, notes=$9, password_enc=$10, api_key_enc=$11, updated_at=now(), updated_by=$12
      where id=$13 returning *`, [f.name, f.category, f.purpose, f.url, f.username, f.used_by, f.cost, f.renewal, f.notes, f.password_enc, f.api_key_enc, req.user.email, cur.id]);
    await log(cur.id, null, req.user.id, req.user.email, req.body.password || req.body.api_key ? 'bóveda: cambiar secreto' : 'bóveda: editar');
    res.json({ tool: out(r.rows[0]) });
  }));
  app.delete('/api/vault/:id', ...guard, wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res);
    await q('delete from vault_tools where id = $1', [req.params.id]);
    await log(null, null, req.user.id, req.user.email, `bóveda: borrar ${req.params.id}`);
    res.json({ ok: true });
  }));

  // Ver o copiar un secreto: contraseña reciente (ya en `guard`) + doble verificación vigente.
  app.post('/api/vault/:id/reveal', ...guard, wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res);
    const field = req.body.field === 'api_key' ? 'api_key' : 'password';
    if (!req.user.totp_enabled && !req.user.n_passkeys) return res.status(403).json({ error: 'Activa la doble verificación para ver contraseñas', code: 'no_mfa' });
    if (!req.session.mfa_until || new Date(req.session.mfa_until) <= new Date()) return res.status(403).json({ error: 'Introduce tu código de verificación', code: 'mfa_required' });
    const cur = (await q('select * from vault_tools where id = $1', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'No existe' });
    const enc = field === 'api_key' ? cur.api_key_enc : cur.password_enc;
    if (!enc) return res.status(404).json({ error: field === 'api_key' ? 'No tiene clave API' : 'No tiene contraseña' });
    await log(cur.id, null, req.user.id, req.user.email, `bóveda: ${req.body.copy ? 'copiar' : 'ver'} ${field === 'api_key' ? 'clave API' : 'contraseña'}`);
    res.json({ secret: decrypt(enc) });
  }));

  app.get('/api/vault/:id/log', ...guard, wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return bad(res);
    res.json({ log: (await q('select actor, action, at from credential_log where credential_id = $1 order by at desc limit 30', [req.params.id])).rows });
  }));
}
