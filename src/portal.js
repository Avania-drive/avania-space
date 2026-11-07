// Portal del cliente (front office): usuarios del cliente con cuenta propia, su espacio, solicitudes de acceso y el logo.
// Los usuarios del cliente viven en otra tabla y otra cookie que el equipo: una sesión de cliente nunca abre nada del panel.
import { q } from './db.js';
import { hashPassword, verifyPassword, randomToken, sha256 } from './crypto.js';
import { parseCookies, tooMany, requireRole } from './auth.js';
import { sendMail, PUBLIC_URL } from './mailer.js';
import { driveListing } from './drive.js';
import { kpisFor } from './kpis.js';
import { viewOn, viewMap, denyView, TEAM_ONLY } from './visibility.js';
import { zonaStudy } from './zona.js';
import { FORM } from './formdef.js';
import { audit } from './audit.js';
import { allowedClients } from './people.js';
import { publicFases } from './plan.js';

export const CCOOKIE = 'sp_client';
const DAYS = 14;
const INVITE_HOURS = 48;
const MAX_USERS = 20;
const EMAIL = /^\S+@\S+\.\S+$/;

export async function loadClientSession(req, _res, next) {
  const token = parseCookies(req)[CCOOKIE];
  if (token) {
    const r = await q(
      `select s.id sid, u.id, u.client_id, u.email, u.name, u.role from client_sessions s
       join client_users u on u.id = s.user_id join clients c on c.id = u.client_id
       where s.token_hash = $1 and s.expires_at > now() and u.active and not c.archived`, [sha256(token)]);
    if (r.rows[0]) { const { sid, ...u } = r.rows[0]; req.cu = u; req.csid = sid; }
  }
  next();
}

// Deja en req.client el cliente de la sesión (las rutas del formulario lo comparten con el enlace por token).
export async function portalGate(req, res, next) {
  if (!req.cu) return res.status(401).json({ error: 'No has iniciado sesión' });
  const c = (await q('select * from clients where id = $1 and not archived', [req.cu.client_id])).rows[0];
  if (!c) return res.status(401).json({ error: 'No has iniciado sesión' });
  req.client = c; req.portal = true;
  next();
}

async function sendClientInvite(user, clientName, { reminder = false } = {}) {
  const token = randomToken(32);
  await q('update client_users set invite_hash = $1, invite_expires_at = now() + ($2 || \' hours\')::interval where id = $3', [sha256(token), INVITE_HOURS, user.id]);
  const hi = user.name ? `Hola, ${String(user.name).split(' ')[0]}.` : 'Hola.';
  await sendMail({
    to: user.email,
    subject: reminder ? 'Tu acceso a tu espacio de AVANIA (enlace nuevo)' : 'Te damos acceso a tu espacio de AVANIA',
    title: reminder ? 'Tu enlace de acceso' : `Bienvenido a tu espacio de ${clientName}`,
    paragraphs: [
      `${hi} ${reminder ? 'Aquí tienes un enlace nuevo' : 'Hemos creado tu acceso'} al espacio de ${clientName} en AVANIA, donde puedes completar el alta, ver tus herramientas y consultar los avisos de nuestro equipo. Pulsa el botón para elegir tu contraseña (mínimo 12 caracteres).`,
      `Tu usuario es ${user.email}. El enlace sirve una sola vez y caduca en ${INVITE_HOURS} horas; si caduca, pide que te envíen otro.`,
    ],
    button: { label: 'Elegir mi contraseña', url: `${PUBLIC_URL}/invitacion?t=${token}&c=1` },
  });
}

const userOut = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, pending: !u.password_hash, last_login: u.last_login });
const LOGO = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

export function mountPortal(app, d) {
  const { wrap, isUuid, ip, staff, sectionsOf, progress, gates, templateOf, tasksOf, timelineOf, fasesOf, forClientProgress, forClientTasks } = d;
  const portal = [wrap(portalGate)];
  const responsable = (req, res, next) => (req.cu.role === 'responsable' ? next() : res.status(403).json({ error: 'Solo el responsable puede hacer esto' }));

  // ───────── Entrada del cliente ─────────
  app.post('/api/p/login', wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (tooMany(`plogin:${ip(req)}:${email}`)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    const u = (await q('select u.* from client_users u join clients c on c.id = u.client_id where u.email = $1 and u.active and not c.archived', [email])).rows[0];
    const ok = u && u.password_hash ? verifyPassword(String(req.body.password || ''), u.password_hash) : (verifyPassword('x', 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'), false);
    if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    const token = randomToken();
    await q('insert into client_sessions (token_hash, user_id, expires_at) values ($1,$2,$3)', [sha256(token), u.id, new Date(Date.now() + DAYS * 864e5)]);
    await q('update client_users set last_login = now() where id = $1', [u.id]);
    const secure = req.headers['x-forwarded-proto'] === 'https' || req.secure;
    res.setHeader('Set-Cookie', `${CCOOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DAYS * 86400}${secure ? '; Secure' : ''}`);
    res.json({ ok: true });
  }));
  app.post('/api/p/logout', wrap(async (req, res) => {
    const t = parseCookies(req)[CCOOKIE];
    if (t) await q('delete from client_sessions where token_hash = $1', [sha256(t)]);
    res.setHeader('Set-Cookie', `${CCOOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    res.json({ ok: true });
  }));
  app.get('/api/p/invitacion/:token', wrap(async (req, res) => {
    if (tooMany(`pinv:${ip(req)}`, 30)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    const u = (await q('select email, name from client_users where invite_hash = $1 and invite_expires_at > now() and active', [sha256(String(req.params.token))])).rows[0];
    if (!u) return res.status(404).json({ error: 'Este enlace no es válido o ha caducado. Pide que te envíen otro.' });
    res.json(u);
  }));
  app.post('/api/p/invitacion/:token', wrap(async (req, res) => {
    if (tooMany(`pinv:${ip(req)}`, 30)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    const pw = String(req.body.password || '');
    if (pw.length < 12) return res.status(400).json({ error: 'La contraseña debe tener al menos 12 caracteres' });
    const u = (await q('select id from client_users where invite_hash = $1 and invite_expires_at > now() and active', [sha256(String(req.params.token))])).rows[0];
    if (!u) return res.status(404).json({ error: 'Este enlace no es válido o ha caducado. Pide que te envíen otro.' });
    await q('update client_users set password_hash = $1, invite_hash = null, invite_expires_at = null where id = $2', [hashPassword(pw), u.id]);
    await q('delete from client_sessions where user_id = $1', [u.id]);
    res.json({ ok: true });
  }));

  // ───────── Su espacio ─────────
  app.get('/api/p/me', ...portal, wrap(async (req, res) => {
    const logo = (await q('select extract(epoch from updated_at)::bigint v from client_logos where client_id = $1', [req.client.id])).rows[0];
    res.json({ user: { name: req.cu.name, email: req.cu.email, role: req.cu.role }, client: { name: req.client.name, logo: logo ? logo.v : null }, views: viewMap(req.client), info: FORM.filter((x) => TEAM_ONLY.has(x.key) && viewOn(req.client, x.key)).map((x) => x.key) });
  }));

  app.post('/api/p/password', ...portal, wrap(async (req, res) => {
    if (tooMany(`ppw:${req.cu.id}`, 8)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    const u = (await q('select password_hash from client_users where id = $1', [req.cu.id])).rows[0];
    if (!verifyPassword(String(req.body.current || ''), u.password_hash)) return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    const pw = String(req.body.password || '');
    if (pw.length < 12) return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 12 caracteres' });
    await q('update client_users set password_hash = $1 where id = $2', [hashPassword(pw), req.cu.id]);
    await q('delete from client_sessions where user_id = $1 and id <> $2', [req.cu.id, req.csid]);
    res.json({ ok: true });
  }));

  // Inicio: progreso, siguiente paso, herramientas, avisos y carpeta de Drive.
  // Lo que ve el cliente en su inicio. Lo usan el portal y la «Vista de cliente» de los administradores.
  async function homeFor(c, role) {
    const sections = await sectionsOf(c.id);
    const tpl = await templateOf(c.category, c.sections);
    const cr = {};
    for (const r of (await q('select status, count(*)::int n from credentials where client_id = $1 group by 1', [c.id])).rows) cr[r.status] = r.n;
    const isResp = role === 'responsable';
    const todo = gates(sections, cr, tpl.allowed).filter((g) => !g.done && !g.delegated && (isResp || g.key !== 'credenciales'));
    const links = (await q('select id, type, url, login_url, has_access from client_links where client_id = $1 and visible order by type', [c.id])).rows;
    const reqs = new Set((await q("select link_id from access_requests where client_id = $1 and status = 'pendiente'", [c.id])).rows.map((r) => r.link_id));
    const types = Object.fromEntries((await q('select name, login_url from link_types')).rows.map((t) => [t.name, t.login_url]));
    const drive = String((sections.proyecto || {}).enlace_drive || '').trim();
    return {
      client: { name: c.name, manager: c.account_manager || null },
      role, dental: tpl.dental, ...(({ pct, areas }) => ({ progress: pct, areas }))(forClientProgress(progress(sections, tpl.allowed, tpl.dental))),
      next: todo.map((g) => ({ key: g.key, ask: g.ask, why: g.why, section: g.section })),
      tasks: forClientTasks(tasksOf(sections, cr, { allowed: tpl.allowed, dental: tpl.dental })).filter((t) => (isResp || t.section !== 'credenciales') && viewOn(c, t.section === 'proceso' ? 'plan' : t.section)),
      timeline: viewOn(c, 'plan') ? timelineOf(sections) : [], fases: viewOn(c, 'plan') ? publicFases(fasesOf(sections)) : null,
      links: links.map((l) => ({ id: l.id, type: l.type, has_access: l.has_access, open: l.url || l.login_url || types[l.type] || null, requested: reqs.has(l.id) })),
      notes: (await q('select id, body, author, created_at from client_notes where client_id = $1 and visible order by created_at desc limit 20', [c.id])).rows,
      drive: viewOn(c, 'documentos') && /^https?:\/\//i.test(drive) ? drive : null, views: viewMap(c),
      contact: process.env.MAIL_REPLY_TO || null,
    };
  }
  app.get('/api/p/home', ...portal, wrap(async (req, res) => res.json(await homeFor(req.client, req.cu.role))));
  // Vista de cliente: solo administradores. Devuelve exactamente lo que vería el cliente (como responsable o como miembro). No toca nada.
  app.get('/api/clients/:id/preview/home', ...staff, requireRole('super_admin', 'admin'), wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const c = (await q('select * from clients where id = $1', [req.params.id])).rows[0];
    if (!c) return res.status(404).json({ error: 'No existe' });
    res.json(await homeFor(c, req.query.role === 'miembro' ? 'miembro' : 'responsable'));
  }));

  // Mapa y estudio de la zona (solo si el superadministrador activó «Ver cliente» en Área de influencia).
  app.get('/api/p/zona', ...portal, wrap(async (req, res) => {
    if (!viewOn(req.client, 'zona')) return denyView(res);
    const all = await sectionsOf(req.client.id), cl = all.clinica || {}, zn = all.zona || {};
    if (!String(zn.localidades || '').trim() && !String(cl.direccion || cl.ciudad || '').trim()) return res.json({ empty: true });
    try { res.json(await zonaStudy({ direccion: cl.direccion, ciudad: cl.ciudad, radio: zn.radio, localidades: zn.localidades })); }
    catch (e) { res.status(502).json({ error: `No se pudo preparar el estudio de la zona: ${e.message}` }); }
  }));

  // Secciones internas de la agencia que el superadministrador ha decidido enseñar al cliente (solo lectura, sin contraseñas).
  app.get('/api/p/shared', ...portal, wrap(async (req, res) => {
    const all = await sectionsOf(req.client.id);
    const keys = FORM.filter((x) => TEAM_ONLY.has(x.key) && viewOn(req.client, x.key)).map((x) => x.key);
    const hide = (f) => /pass|secret|clave|token/i.test(f.type || '') || /pass|secret|clave|token/i.test(f.k || '');
    res.json({ sections: keys.map((k) => {
      const def = FORM.find((x) => x.key === k);
      const fields = new Set(def.groups.flatMap((g) => g.fields).filter(hide).map((f) => f.k));
      return { def: { ...def, groups: def.groups.map((g) => ({ ...g, fields: g.fields.filter((f) => !hide(f)) })) }, data: Object.fromEntries(Object.entries(all[k] || {}).filter(([f]) => !fields.has(f))) };
    }) });
  }));

  // Archivos de su carpeta de Drive (nombre y carpeta); sin avisos técnicos, que son cosa de la agencia.
  app.get('/api/p/drive', ...portal, wrap(async (req, res) => {
    if (!viewOn(req.client, 'documentos')) return denyView(res);
    const r = await driveListing((await sectionsOf(req.client.id)).proyecto?.enlace_drive);
    res.json(r.state === 'ok' ? r : { state: r.state === 'sin_carpeta' ? 'sin_carpeta' : 'no_disponible' });
  }));

  // Resultados del cliente (los mismos KPIs que ve la agencia, sin nombres ni datos de contacto de los leads).
  app.get('/api/p/kpis', ...portal, wrap(async (req, res) => {
    if (!viewOn(req.client, 'resultados')) return denyView(res);
    try {
      const k = await kpisFor(req.client.id, { sections: await sectionsOf(req.client.id) });
      if (k) {
        // Objetivos, valor medio y etapas vienen de «Objetivos y datos para medir», que es solo del equipo: el cliente no ve nada que salga de ahí
        // (ni los objetivos, ni la facturación estimada con el valor medio, ni el retorno que se calcula con ella).
        const { sin_anuncio, objetivos, valor_medio, mapeo, ...pub } = k;
        if (pub.facturado?.estimado) { pub.facturado = null; if (pub.coste) pub.coste = { ...pub.coste, roas: null }; }
        return res.json({ connected: true, kpis: { ...pub, objetivos: [] } });
      }
      res.json({ connected: false });
    } catch { res.json({ connected: false, unavailable: true }); }
  }));

  app.post('/api/p/links/:id/request', ...portal, wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const l = (await q('select * from client_links where id = $1 and client_id = $2 and visible', [req.params.id, req.client.id])).rows[0];
    if (!l) return res.status(404).json({ error: 'No existe' });
    const dup = (await q("select 1 from access_requests where link_id = $1 and status = 'pendiente'", [l.id])).rows[0];
    if (!dup) await q('insert into access_requests (client_id, link_id, link_type, requested_by) values ($1,$2,$3,$4)', [req.client.id, l.id, l.type, req.cu.name || req.cu.email]);
    res.json({ ok: true });
  }));

  app.get('/api/p/logo', ...portal, wrap(async (req, res) => sendLogo(res, req.client.id)));

  // Mi equipo: solo el responsable. Puede invitar y quitar miembros (los responsables los da de alta AVANIA).
  app.get('/api/p/team', ...portal, responsable, wrap(async (req, res) => {
    res.json({ users: (await q('select * from client_users where client_id = $1 order by role, created_at', [req.client.id])).rows.map(userOut) });
  }));
  app.post('/api/p/team', ...portal, responsable, wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL.test(email)) return res.status(400).json({ error: 'Correo no válido' });
    res.json(await createClientUser(req.client, email, req.body.name, 'miembro', req.cu.email, 'cliente'));
  }));
  app.patch('/api/p/team/:id', ...portal, responsable, wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const u = (await q('select * from client_users where id = $1 and client_id = $2', [req.params.id, req.client.id])).rows[0];
    if (!u) return res.status(404).json({ error: 'No existe' });
    if (u.role !== 'miembro') return res.status(403).json({ error: 'Los responsables los gestiona AVANIA' });
    res.json(await updateClientUser(u, req.body, req.client.name, req.cu.email, 'cliente'));
  }));
  app.delete('/api/p/team/:id', ...portal, responsable, wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const gone = (await q("delete from client_users where id = $1 and client_id = $2 and role = 'miembro' returning email", [req.params.id, req.client.id])).rows[0];
    if (gone) await audit(req.cu.email, 'eliminar usuario de cliente', { kind: 'cliente', client: req.client, target: gone.email });
    res.json({ ok: true });
  }));

  async function createClientUser(client, email, name, role, by, kind = 'equipo') {
    if ((await q('select count(*)::int n from client_users where client_id = $1', [client.id])).rows[0].n >= MAX_USERS) return { error: 'Demasiados usuarios en este cliente', status: 400 };
    let u;
    try {
      u = (await q('insert into client_users (client_id, email, name, role, created_by) values ($1,$2,$3,$4,$5) returning *', [client.id, email, String(name || '').slice(0, 120) || null, role, by])).rows[0];
    } catch (e) {
      if (e.code === '23505') return { error: 'Ese correo ya tiene un acceso al portal', status: 409 };
      throw e;
    }
    await audit(by, 'crear usuario de cliente', { kind, client, target: email, detail: role });
    let emailError = null;
    try { await sendClientInvite(u, client.name); } catch (e) { emailError = e.message; console.error(`[email] alta de cliente ${email}: ${e.message}`); }
    return { user: userOut(u), email_sent: !emailError, email_error: emailError };
  }
  async function updateClientUser(u, b, clientName, by, kind = 'equipo') {
    const did = [typeof b.active === 'boolean' && b.active !== u.active ? (b.active ? 'activado' : 'desactivado') : '', b.resend_invite ? 'reenvío de acceso' : ''].filter(Boolean).join(', ');
    if (did) await audit(by, 'modificar usuario de cliente', { kind, client: u.client_id, target: u.email, detail: did });
    if (typeof b.active === 'boolean') {
      await q('update client_users set active = $1 where id = $2', [b.active, u.id]);
      if (!b.active) await q('delete from client_sessions where user_id = $1', [u.id]);
    }
    let invite = null;
    if (b.resend_invite) { try { await sendClientInvite(u, clientName, { reminder: true }); invite = 'sent'; } catch (e) { invite = `error: ${e.message}`; } }
    return { ok: true, invite, user: userOut((await q('select * from client_users where id = $1', [u.id])).rows[0]) };
  }
  const answer = (res, r) => (r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r));

  // ───────── Lado del equipo ─────────
  const owner = async (req, res) => {
    if (!isUuid(req.params.id)) { res.status(400).json({ error: 'Id no válido' }); return null; }
    const c = (await q('select * from clients where id = $1', [req.params.id])).rows[0];
    if (!c) res.status(404).json({ error: 'No existe' });
    return c || null;
  };
  app.get('/api/clients/:id/users', ...staff, wrap(async (req, res) => {
    if (!(await owner(req, res))) return;
    res.json({ users: (await q('select * from client_users where client_id = $1 order by role, created_at', [req.params.id])).rows.map(userOut) });
  }));
  app.post('/api/clients/:id/users', ...staff, wrap(async (req, res) => {
    const c = await owner(req, res); if (!c) return;
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL.test(email)) return res.status(400).json({ error: 'Correo no válido' });
    if (!['responsable', 'miembro'].includes(req.body.role)) return res.status(400).json({ error: 'Rol no válido' });
    answer(res, await createClientUser(c, email, req.body.name, req.body.role, req.user.email, 'equipo'));
  }));
  app.patch('/api/client-users/:id', ...staff, wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const u = (await q('select u.*, c.name client_name from client_users u join clients c on c.id = u.client_id where u.id = $1', [req.params.id])).rows[0];
    if (!u) return res.status(404).json({ error: 'No existe' });
    if (['responsable', 'miembro'].includes(req.body.role) && req.body.role !== u.role) { await q('update client_users set role = $1 where id = $2', [req.body.role, u.id]); await audit(req.user.email, 'modificar usuario de cliente', { client: u.client_id, target: u.email, detail: `rol ${u.role} → ${req.body.role}` }); }
    answer(res, await updateClientUser(u, req.body, u.client_name, req.user.email, 'equipo'));
  }));
  app.delete('/api/client-users/:id', ...staff, wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const gone = (await q('delete from client_users where id = $1 returning email, client_id', [req.params.id])).rows[0];
    if (gone) await audit(req.user.email, 'eliminar usuario de cliente', { client: gone.client_id, target: gone.email });
    res.json({ ok: true });
  }));

  app.get('/api/access-requests', ...staff, wrap(async (req, res) => {
    const mine = await allowedClients(req.user);
    res.json({ requests: (await q(`select r.id, r.client_id, c.name client_name, r.link_type, r.requested_by, r.created_at from access_requests r
      join clients c on c.id = r.client_id where r.status = 'pendiente' and not c.archived and ($1::uuid[] is null or c.id = any($1::uuid[])) order by r.created_at`, [mine])).rows });
  }));
  app.patch('/api/access-requests/:id', ...staff, wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    await q("update access_requests set status = 'atendida', done_at = now(), done_by = $1 where id = $2", [req.user.email, req.params.id]);
    res.json({ ok: true });
  }));

  // Logo del cliente: imagen pequeña (el navegador la reduce antes de subirla). No se admite SVG: puede llevar código.
  async function sendLogo(res, clientId) {
    const l = (await q('select type, data from client_logos where client_id = $1', [clientId])).rows[0];
    if (!l) return res.status(404).json({ error: 'Sin logo' });
    res.setHeader('Content-Type', l.type);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(l.data);
  }
  app.get('/api/clients/:id/logo', ...staff, wrap(async (req, res) => { if (isUuid(req.params.id)) return sendLogo(res, req.params.id); res.status(400).json({ error: 'Id no válido' }); }));
  app.put('/api/clients/:id/logo', ...staff, wrap(async (req, res) => {
    if (!(await owner(req, res))) return;
    const m = LOGO.exec(String(req.body.data || ''));
    if (!m) return res.status(400).json({ error: 'El logo debe ser una imagen PNG, JPG o WebP' });
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length || buf.length > 150 * 1024) return res.status(400).json({ error: 'El logo es demasiado grande (máximo 150 KB)' });
    await q(`insert into client_logos (client_id, type, data) values ($1,$2,$3) on conflict (client_id) do update set type = $2, data = $3, updated_at = now()`, [req.params.id, `image/${m[1]}`, buf]);
    res.json({ ok: true });
  }));
  app.delete('/api/clients/:id/logo', ...staff, wrap(async (req, res) => {
    if (!(await owner(req, res))) return;
    await q('delete from client_logos where client_id = $1', [req.params.id]);
    res.json({ ok: true });
  }));
}
