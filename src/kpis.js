// KPIs de captación de un cliente, leídos (solo GET) de SU subcuenta de Avania Funnels con un token de solo lectura propio.
// Se trabaja con las oportunidades creadas en los últimos 60 días (30 actuales y 30 anteriores) agrupadas como cohorte:
// de los leads que entraron en el periodo, hasta dónde han llegado hoy. No se guarda ni se devuelve ningún nombre, teléfono ni correo.
import { q } from './db.js';
import { encrypt, decrypt } from './crypto.js';
import { requireRole, requirePasswordRecent } from './auth.js';

const BASE = process.env.FUNNELS_BASE_URL || 'https://services.leadconnectorhq.com';
const DAY = 864e5;
export const PASOS = ['Nuevo lead', 'Contactado', 'Cita agendada', 'No asistió', 'Asistió', 'Ganado', 'Perdido'];
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const RANK = { nuevo: 0, intento: 0, contactado: 1, cita: 2, noasistio: 2, asistio: 3, ganado: 4, perdido: -1 };

// Paso canónico de una etapa: primero lo que el equipo haya indicado en «Objetivos y datos para medir»; si no, por el nombre.
const PASO_KEY = { 'nuevo lead': 'nuevo', contactado: 'contactado', 'cita agendada': 'cita', 'no asistio': 'noasistio', asistio: 'asistio', ganado: 'ganado', perdido: 'perdido' };
export function pasoOf(stageName, mapa = {}) {
  const n = norm(stageName);
  if (mapa[n]) return mapa[n];
  if (/no contesta|no localiz/.test(n)) return 'intento';
  if (/anula|cancel/.test(n)) return 'intento';
  if (/no asist/.test(n)) return 'noasistio';
  if (/asist/.test(n)) return 'asistio';
  if (/no interes|perdid|no cualifica|descart|no responde|error|rechaz/.test(n)) return 'perdido';
  if (/ganad|acept|cerrad|reservado|vendid/.test(n)) return 'ganado';
  if (/agenda enviada|llamada pedida/.test(n)) return 'contactado';
  if (/\bcita\b|\bvisita\b|\bagenda\b|\breunion\b/.test(n)) return 'cita';
  if (/contact|llamada|gesti|activad|enviado|seguimiento|propuesta|presupuesto|informacion|caliente/.test(n)) return 'contactado';
  if (/nuevo|entra/.test(n)) return 'nuevo';
  return 'intento';   // «No contesta», «No localizable», «Reactivación»…: se ha intentado, pero todavía no es un contacto real
}
const mapaOf = (negocio) => Object.fromEntries((negocio?.etapas || []).filter((r) => r?.etapa && r?.paso).map((r) => [norm(r.etapa), PASO_KEY[norm(r.paso)]]).filter(([, v]) => v));

async function get(token, path) {
  let res;
  try { res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) }); }
  catch { throw Object.assign(new Error('No se pudo contactar con Avania Funnels. Inténtalo de nuevo.'), { status: 502 }); }
  const j = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('El token no tiene acceso a esa subcuenta (o ha caducado). Genera uno nuevo con permiso de lectura de oportunidades.'), { status: 400, auth: true });
  if (!res.ok) throw Object.assign(new Error(`Avania Funnels respondió ${res.status}.`), { status: 502 });
  return j;
}

/** Comprueba el token contra la subcuenta (pipelines y una oportunidad). Devuelve cuántas oportunidades tiene. */
export async function probe(token, location) {
  await get(token, `/opportunities/pipelines?locationId=${encodeURIComponent(location)}`);
  const r = await get(token, `/opportunities/search?location_id=${encodeURIComponent(location)}&limit=1`);
  return r.meta?.total ?? 0;
}

// Etiquetas sin rellenar en el anuncio («{{campaign.id}}») no son un nombre de campaña.
const label = (v) => (v && !/\{\{/.test(v) ? String(v).slice(0, 120) : null);
const mmddyyyy = (d) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`;
async function fetchOpps(token, location, pipelineId, since) {
  const out = [];
  let after = '';
  const end = mmddyyyy(new Date(Date.now() + DAY));
  for (let page = 0; page < 40; page++) {
    const r = await get(token, `/opportunities/search?location_id=${encodeURIComponent(location)}&limit=100&date=${mmddyyyy(since)}&endDate=${end}${pipelineId ? `&pipeline_id=${encodeURIComponent(pipelineId)}` : ''}${after}`);
    for (const o of r.opportunities || []) {
      const at = o.attributions || [];
      const a = at.find((x) => x.isLast) || at.find((x) => x.isFirst) || at[0] || {};
      // Solo lo necesario para contar: nada de nombres ni datos de contacto.
      out.push({ id: o.id, stage: o.pipelineStageId, status: o.status, source: o.source || null, created: o.createdAt, changed: o.lastStageChangeAt, value: Number(o.monetaryValue) || 0,
        campaign: label(a.utmCampaign), creative: label(a.utmContent), adId: a.utmAdId || null });
    }
    const m = r.meta || {};
    if (!r.opportunities?.length || r.opportunities.length < 100 || !m.startAfterId) break;
    after = `&startAfter=${m.startAfter}&startAfterId=${m.startAfterId}`;
  }
  return out;
}

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
function cohort(list, rankOf) {
  const c = { leads: list.length, contactado: 0, cita: 0, asistio: 0, ganado: 0, noshow: 0, perdido: 0, valor: 0 };
  for (const o of list) {
    const r = rankOf(o);
    if (r >= 1) c.contactado++;
    if (r >= 2) c.cita++;
    if (r >= 3) c.asistio++;
    if (r >= 4) { c.ganado++; c.valor += o.value; }
    if (o.paso === 'noasistio') c.noshow++;
    if (r === -1) c.perdido++;
  }
  c.tasas = { contacto: pct(c.contactado, c.leads), cita: pct(c.cita, c.leads), asistencia: pct(c.asistio, c.asistio + c.noshow), cierre: pct(c.ganado, c.asistio), lead_a_cliente: pct(c.ganado, c.leads) };
  return c;
}
// Agrupa por el identificador del anuncio cuando Funnels lo trae (un mismo anuncio llega con nombres distintos según cuándo se renombró,
// p. ej. «…REGENERACION» y «…REGENERACION - off»); el nombre que se enseña es el del lead más reciente.
const top = (list, key, rankOf, n = 8, none = 'Sin dato', idKey = null) => {
  const g = new Map();
  for (const o of [...list].sort((a, b) => (b.t || 0) - (a.t || 0))) {
    const name = o[key] || none, k = (idKey && o[idKey]) || name;
    const e = g.get(k) || { name, leads: 0, citas: 0, ganados: 0 };
    e.leads++; if (rankOf(o) >= 2) e.citas++; if (rankOf(o) >= 4) e.ganados++; g.set(k, e);
  }
  return [...g.values()].sort((a, b) => b.leads - a.leads).slice(0, n);
};
const num = (v) => {
  let t = String(v ?? '').replace(/[^\d,.]/g, '');
  t = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(',', '.');   // «1.500» son mil quinientos, no 1,5
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Calcula los KPIs de un cliente a partir de sus oportunidades y de los datos de su ficha (negocio y presupuesto de Meta). */
export function compute(opps, stageNames, { negocio = {}, meta = {} } = {}, now = Date.now()) {
  const mapa = mapaOf(negocio);
  for (const o of opps) {
    o.paso = o.status === 'won' ? 'ganado' : (o.status === 'lost' || o.status === 'abandoned') ? 'perdido' : pasoOf(stageNames[o.stage], mapa);
    o.t = Date.parse(o.created);
  }
  const rankOf = (o) => RANK[o.paso];
  const cur = opps.filter((o) => o.t >= now - 30 * DAY), prev = opps.filter((o) => o.t >= now - 60 * DAY && o.t < now - 30 * DAY);
  const c = cohort(cur, rankOf), p = cohort(prev, rankOf);
  const valorMedio = num(negocio.valor_medio);
  const facturado = c.valor > 0 ? { eur: Math.round(c.valor), estimado: false } : valorMedio && c.ganado ? { eur: Math.round(valorMedio * c.ganado), estimado: true } : null;
  const presupuesto = num(meta.presupuesto);
  const open = cur.filter((o) => o.status === 'open');
  const sinAtender = open.filter((o) => o.paso === 'nuevo' && now - o.t > DAY).length;
  const objetivos = [['Leads', c.leads, num(negocio.objetivo_leads)], ['Citas', c.cita, num(negocio.objetivo_citas)], ['Clientes nuevos', c.ganado, num(negocio.objetivo_ventas)]]
    .filter(([, , goal]) => goal).map(([name, value, goal]) => ({ name, value, goal, pct: Math.round((value / goal) * 100) }));
  const etapas = {};
  for (const o of open) { const n = stageNames[o.stage] || 'Sin etapa'; etapas[n] = (etapas[n] || 0) + 1; }
  const sinMapa = !(negocio.etapas || []).some((r) => r?.etapa && r?.paso);
  return {
    generated_at: new Date(now).toISOString(), window_days: 30,
    actual: c, anterior: p,
    delta: { leads: p.leads ? Math.round(((c.leads - p.leads) / p.leads) * 100) : null },
    facturado, valor_medio: valorMedio,
    coste: presupuesto && c.leads ? { presupuesto, cpl: Math.round((presupuesto / c.leads) * 100) / 100, por_cita: c.cita ? Math.round(presupuesto / c.cita) : null, por_cliente: c.ganado ? Math.round(presupuesto / c.ganado) : null,
      roas: facturado ? Math.round((facturado.eur / presupuesto) * 10) / 10 : null, nota: 'Con la inversión mensual prevista en la ficha, no con el gasto real de Meta.' } : null,
    sin_atender: sinAtender, abiertas_por_etapa: Object.entries(etapas).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    campanas: top(cur, 'campaign', rankOf, 8, 'Sin campaña identificada en Funnels'), creativos: top(cur, 'creative', rankOf, 8, 'Sin anuncio identificado en Funnels', 'adId'), fuentes: top(cur, 'source', rankOf, 6, 'Sin fuente'),
    objetivos, mapeo: sinMapa ? 'automatico' : 'manual',
  };
}

const LABEL = { nuevo: 'Nuevo lead', contactado: 'Contactado', cita: 'Cita agendada', noasistio: 'No asistió', asistio: 'Asistió', ganado: 'Ganado', perdido: 'Perdido' };

async function clientToken(clientId) {
  const cf = (await q('select location_id, token_enc from client_funnels where client_id = $1', [clientId])).rows[0];
  if (!cf) throw Object.assign(new Error('Conecta primero la subcuenta de este cliente en la pestaña Resultados.'), { status: 400, notConnected: true });
  return { token: decrypt(cf.token_enc), location: cf.location_id };
}

/** Pipelines de la subcuenta del cliente (para elegir uno sin saber su ID). */
export async function pipelinesOf(clientId) {
  const { token, location } = await clientToken(clientId);
  const pipes = (await get(token, `/opportunities/pipelines?locationId=${encodeURIComponent(location)}`)).pipelines || [];
  return pipes.map((p) => ({ id: p.id, name: p.name, stages: (p.stages || []).length }));
}

/**
 * Todas las etapas de un pipeline, en su orden, con el paso del embudo que parece corresponderles.
 * Lo que el equipo ya hubiera indicado para una etapa (mismo nombre) se conserva; las «de intento» (No contesta…) quedan sin paso.
 */
export async function syncStages(clientId, pipelineId, current = []) {
  const { token, location } = await clientToken(clientId);
  const pipes = (await get(token, `/opportunities/pipelines?locationId=${encodeURIComponent(location)}`)).pipelines || [];
  const p = pipes.find((x) => x.id === pipelineId);
  if (!p) throw Object.assign(new Error('Ese pipeline no existe en la subcuenta de este cliente. Revisa el ID.'), { status: 400 });
  const kept = Object.fromEntries((current || []).filter((r) => r?.etapa && r?.paso).map((r) => [norm(r.etapa), r.paso]));
  const etapas = [...(p.stages || [])].sort((a, b) => a.position - b.position).map((st) => {
    const auto = pasoOf(st.name);
    return { etapa: st.name, paso: kept[norm(st.name)] ?? (auto === 'intento' ? '' : LABEL[auto]) };
  });
  return { name: p.name, etapas };
}

const cache = new Map();   // clientId → { at, data }
export async function kpisFor(clientId, { refresh = false, sections = {} } = {}) {
  const hit = cache.get(clientId);
  if (hit && Date.now() - hit.at < (refresh ? 60e3 : 15 * 60e3)) return hit.data;
  const cf = (await q('select * from client_funnels where client_id = $1', [clientId])).rows[0];
  if (!cf) return null;
  const token = decrypt(cf.token_enc), negocio = sections.negocio || {};
  try {
    const pipes = (await get(token, `/opportunities/pipelines?locationId=${encodeURIComponent(cf.location_id)}`)).pipelines || [];
    const stageNames = {};
    for (const p of pipes) if (!negocio.pipeline_id || p.id === negocio.pipeline_id) for (const s of p.stages || []) stageNames[s.id] = s.name;
    const opps = await fetchOpps(token, cf.location_id, String(negocio.pipeline_id || '').trim() || null, new Date(Date.now() - 61 * DAY));
    // Lo que la agencia haya asignado a mano a leads que Funnels guardó sin campaña o sin anuncio.
    const ov = new Map((await q('select opp_id, campaign, creative from lead_overrides where client_id = $1', [clientId])).rows.map((r) => [r.opp_id, r]));
    for (const o of opps) { const v = ov.get(o.id); if (v) { if (v.campaign) o.campaign = v.campaign; if (v.creative) o.creative = v.creative; } }
    const data = compute(opps, stageNames, { negocio, meta: sections.meta || {} });
    const now = Date.now();
    data.sin_anuncio = opps.filter((o) => o.t >= now - 30 * DAY && !o.creative).length;   // solo el número; ya no se listan
    await q('update client_funnels set last_ok = now(), last_error = null where client_id = $1', [clientId]);
    cache.set(clientId, { at: Date.now(), data });
    return data;
  } catch (e) {
    await q('update client_funnels set last_error = $1 where client_id = $2', [String(e.message).slice(0, 300), clientId]);
    throw e;
  }
}
export const forget = (clientId) => cache.delete(clientId);

const LOC = /^[A-Za-z0-9]{15,32}$/;
export function mountKpis(app, { wrap, isUuid, staff, log, sectionsOf, saveSection }) {
  const owner = async (req, res) => {
    if (!isUuid(req.params.id)) { res.status(400).json({ error: 'Id no válido' }); return null; }
    const c = (await q('select * from clients where id = $1', [req.params.id])).rows[0];
    if (!c) res.status(404).json({ error: 'No existe' });
    return c || null;
  };
  const admin = [requireRole('super_admin', 'admin'), wrap(requirePasswordRecent)];

  app.get('/api/clients/:id/funnels', ...staff, wrap(async (req, res) => {
    if (!(await owner(req, res))) return;
    const r = (await q('select location_id, connected_by, connected_at, last_ok, last_error from client_funnels where client_id = $1', [req.params.id])).rows[0];
    res.json(r ? { connected: true, ...r } : { connected: false });
  }));

  // El token se prueba contra la subcuenta antes de guardarlo, se cifra y no vuelve a salir.
  app.put('/api/clients/:id/funnels', ...staff, ...admin, wrap(async (req, res) => {
    const c = await owner(req, res); if (!c) return;
    const token = String(req.body.token || '').trim();
    if (token.length < 20 || token.length > 400 || /\s/.test(token)) return res.status(400).json({ error: 'Pega el token completo de la integración privada' });
    const sections = await sectionsOf(c.id);
    const location = String(req.body.location_id || (sections.proyecto || {}).funnels_location || '').trim();
    if (!LOC.test(location)) return res.status(400).json({ error: 'Falta el ID de la subcuenta de Avania Funnels de este cliente' });
    const total = await probe(token, location);
    await q(`insert into client_funnels (client_id, location_id, token_enc, connected_by, connected_at, last_ok, last_error) values ($1,$2,$3,$4,now(),now(),null)
      on conflict (client_id) do update set location_id = $2, token_enc = $3, connected_by = $4, connected_at = now(), last_ok = now(), last_error = null`,
    [c.id, location, encrypt(token), req.user.email]);
    if (!(sections.proyecto || {}).funnels_location) await saveSection(c, 'proyecto', { funnels_location: location }, req.user.email);
    forget(c.id);
    await log(null, c.id, req.user.id, req.user.email, 'funnels: conectar');
    res.json({ ok: true, opportunities: total });
  }));
  app.delete('/api/clients/:id/funnels', ...staff, ...admin, wrap(async (req, res) => {
    const c = await owner(req, res); if (!c) return;
    await q('delete from client_funnels where client_id = $1', [c.id]);
    forget(c.id);
    await log(null, c.id, req.user.id, req.user.email, 'funnels: desconectar');
    res.json({ ok: true });
  }));

  app.get('/api/clients/:id/funnels/pipelines', ...staff, wrap(async (req, res) => {
    const c = await owner(req, res); if (!c) return;
    res.json({ pipelines: await pipelinesOf(c.id) });
  }));
  // Botón «Cargar etapas»: vuelve a leer las etapas del pipeline indicado en la ficha.
  app.post('/api/clients/:id/funnels/stages', ...staff, wrap(async (req, res) => {
    const c = await owner(req, res); if (!c) return;
    const n = (await sectionsOf(c.id)).negocio || {};
    const pid = String(req.body.pipeline_id || n.pipeline_id || '').trim();
    if (!pid) return res.status(400).json({ error: 'Falta el ID del pipeline' });
    const r = await syncStages(c.id, pid, n.etapas);
    const data = await saveSection(c, 'negocio', { pipeline_id: pid, etapas: r.etapas }, req.user.email);
    forget(c.id);
    res.json({ data, pipeline: r.name, stages_loaded: r.etapas.length });
  }));

  // Asigna a mano campaña y anuncio a un lead sin atribución (solo su identificador, nunca sus datos personales).
  app.put('/api/clients/:id/lead-attribution', ...staff, wrap(async (req, res) => {
    const c = await owner(req, res); if (!c) return;
    const opp = String(req.body.opp_id || '').trim(), t = (v) => String(v ?? '').trim().slice(0, 160) || null;
    if (!/^[A-Za-z0-9]{10,40}$/.test(opp)) return res.status(400).json({ error: 'Id de lead no válido' });
    const campaign = t(req.body.campaign), creative = t(req.body.creative);
    if (!campaign && !creative) await q('delete from lead_overrides where client_id = $1 and opp_id = $2', [c.id, opp]);
    else await q(`insert into lead_overrides (client_id, opp_id, campaign, creative, updated_by) values ($1,$2,$3,$4,$5)
      on conflict (client_id, opp_id) do update set campaign = $3, creative = $4, updated_by = $5, updated_at = now()`, [c.id, opp, campaign, creative, req.user.email]);
    forget(c.id);
    res.json({ ok: true });
  }));

  app.get('/api/clients/:id/kpis', ...staff, wrap(async (req, res) => {
    const c = await owner(req, res); if (!c) return;
    const data = await kpisFor(c.id, { refresh: req.query.refresh === '1', sections: await sectionsOf(c.id) });
    res.json(data ? { connected: true, kpis: data } : { connected: false });
  }));
}
