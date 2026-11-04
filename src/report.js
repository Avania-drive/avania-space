// Informe de onboarding para el responsable de AVANIA: todo lo que hay en la ficha, lo que falta y los siguientes pasos,
// para llegar preparado a la reunión de onboarding. Nunca incluye contraseñas ni claves: solo cuántas credenciales hay y de qué servicios.
import { PUBLIC_URL } from './mailer.js';
import { fasesOf } from './plan.js';

export const REPORT_TO = () => process.env.REPORT_TO || 'pascual.vila@avania.es';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const has = (v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== '');
const fecha = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'sin fecha');
const PRIO = { alta: '#b42318', media: '#b45309', baja: '#667085' };
const rowsOf = (v, cols) => (Array.isArray(v) ? v : []).filter((r) => cols.some((c) => has(r?.[c])));

/** Lo que hay en la ficha, por áreas, en frases cortas. */
function highlights(S, creds) {
  const g = (sec, k) => (S[sec] || {})[k];
  const line = (label, v) => (has(v) ? `${label}: ${Array.isArray(v) ? v.join(', ') : v}` : null);
  const people = (list) => rowsOf(list, ['nombre']).map((r) => [r.nombre, r.cargo || r.rol, r.telefono || r.whatsapp].filter(has).join(' · '));
  const pend = creds.filter((c) => !c.has_password).map((c) => c.service);
  return {
    empresa: [
      line('Empresa', [g('clinica', 'nombre_comercial'), g('clinica', 'ciudad')].filter(has).join(' · ')),
      line('Apertura', g('clinica', 'fecha_apertura') && fecha(g('clinica', 'fecha_apertura'))),
      line('Teléfono', g('clinica', 'telefono')), line('Web', g('clinica', 'web')),
      people(g('clinica', 'responsables')).length ? `Equipo: ${people(g('clinica', 'responsables')).join(' | ')}` : null,
      line('Horario', Object.values(g('agenda', 'horario') || {}).some((d) => d?.abre) ? 'indicado' : null),
      line('Logotipos', rowsOf(g('materiales', 'logos'), ['url']).length ? `${rowsOf(g('materiales', 'logos'), ['url']).length} enlace(s)` : null),
    ],
    mercado: [
      line('Tipos de cliente', rowsOf(g('mercado', 'clientes_tipo'), ['tipo']).map((r) => r.tipo)),
      line('Competidores', rowsOf(g('mercado', 'competidores'), ['nombre']).map((r) => r.nombre)),
      line('Ofertas', rowsOf(g('mercado', 'ofertas'), ['oferta']).map((r) => `${r.oferta}${has(r.precio) ? ` (${r.precio})` : ''}`)),
      line('Servicio estrella', g('mercado', 'estrella')), line('Diferencial', g('mercado', 'diferencial')),
      line('Análisis de AVANIA', ['avatar_docs', 'competencia_docs', 'oferta_docs'].filter((k) => rowsOf(g('oferta', k), ['url']).length).length ? `${['avatar_docs', 'competencia_docs', 'oferta_docs'].filter((k) => rowsOf(g('oferta', k), ['url']).length).length} de 3 con documento` : null),
      line('Valor medio de un cliente', g('negocio', 'valor_medio') && `${g('negocio', 'valor_medio')} €`),
    ],
    tecnico: [
      line('Dominio', g('accesos', 'dominio')), line('Google', g('accesos', 'google_alta')),
      line('Business Manager', g('meta', 'bm_acceso') ? `acceso concedido: ${g('meta', 'bm_acceso')}` : null), line('Píxel', g('meta', 'pixel')),
      line('Instagram', g('meta', 'perfil_ig')), line('WhatsApp de clientes', g('whatsapp', 'wa_numero') || (g('whatsapp', 'wa_nuevo') === 'Sí' ? 'número nuevo gestionado por AVANIA' : null)),
      line('Avania Setex', g('whatsapp', 'setex_numero')),
      creds.length ? `Bóveda: ${creds.length} servicio(s), ${creds.length - pend.length} con contraseña recibida${pend.length ? `; sin contraseña: ${pend.join(', ')}` : ''}` : 'Bóveda: ningún servicio todavía',
    ],
    cronograma: [
      (() => { const f = fasesOf(S), hechas = f.filter((x) => x.estado === 'Hecho').length, ahora = f.filter((x) => x.estado === 'En curso' || x.estado === 'Esperando cliente'); return `Proceso: ${hechas} de ${f.length} fases hechas${ahora.length ? `; ahora: ${ahora.map((x) => `${x.fase} (${x.estado.toLowerCase()})`).join(', ')}` : ''}`; })(),
      line('Rodaje (fechas propuestas)', (g('rodaje', 'dias_rodaje') || []).map(fecha)), line('Quién graba', g('rodaje', 'doctor')),
      line('Formación', g('formacion', 'fechas_formacion')), line('Asistentes a la formación', g('formacion', 'asistentes')),
    ],
    nosotros: [
      line('Responsable de cuenta', g('proyecto', 'responsable_cuenta')), line('Inicio del proyecto', g('proyecto', 'fecha_inicio') && fecha(g('proyecto', 'fecha_inicio'))),
      line('Drive', g('proyecto', 'enlace_drive')), line('ClickUp', g('proyecto', 'enlace_clickup')),
      line('Avania Funnels (ID subcuenta)', g('proyecto', 'funnels_location')), line('Avania Setex', g('whatsapp', 'setex_enlace')),
      people(g('avania', 'personas')).length ? `Equipo AVANIA: ${people(g('avania', 'personas')).join(' | ')}` : null,
    ],
  };
}

const bar = (pct, color) => `<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="background:#e5e7eb;border-radius:6px;height:8px;padding:0"><div style="width:${Math.max(2, pct)}%;background:${color};height:8px;border-radius:6px"></div></td></tr></table>`;
const taskTable = (list, empty) => (list.length ? `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${list.map((t) => `<tr><td style="padding:6px 8px 6px 0;vertical-align:top;white-space:nowrap"><b style="color:${PRIO[t.priority]};text-transform:uppercase;font-size:11px">${esc(t.priority)}</b></td><td style="padding:6px 0;border-bottom:1px solid #f0f1f3"><b>${esc(t.title)}</b>${t.detail ? `<br><span style="color:#667085">${esc(t.detail)}</span>` : ''}${t.due ? `<br><span style="color:${t.overdue ? '#b42318' : '#667085'}">Para el ${esc(fecha(t.due))}${t.overdue ? ' · vencida' : ''}</span>` : ''}</td></tr>`).join('')}</table>` : `<p style="color:#667085;margin:0">${esc(empty)}</p>`);

/** Monta el informe. Todo lo que recibe ya está calculado: la ficha, el avance, las tareas y el cronograma. */
export function buildReport({ client, sections, creds, progress, tasks, timeline, gates, onboarding }) {
  const hi = highlights(sections, creds);
  const mine = tasks.filter((t) => t.who === 'cliente'), ours = tasks.filter((t) => t.who === 'avania');
  const missingGates = gates.filter((g) => !g.done);
  const agenda = [
    ...missingGates.map((g) => `${g.delegated ? 'Lo hará AVANIA' : 'Pedir al cliente'}: ${g.ask}`),
    ...tasks.filter((t) => t.kind === 'delegado').map((t) => `Acordar cómo hacemos: ${t.title.replace('Hacer por el cliente en ', '')}`),
    ...tasks.filter((t) => t.overdue).map((t) => `Replanificar (vencida): ${t.title}`),
    ...progress.areas.filter((a) => a.client.total && a.client.pct < 100).map((a) => `Repasar con el cliente «${a.title}» (${a.client.pct}% completado)`),
  ];
  const state = onboarding.client_done && onboarding.team_done ? 'Cliente y AVANIA han terminado su parte.' : onboarding.client_done ? 'El cliente ha terminado; falta cerrar la parte de AVANIA.' : onboarding.team_done ? 'AVANIA ha terminado; falta el cliente.' : 'Informe pedido antes de que terminen las dos partes.';
  const link = `${PUBLIC_URL}/#/c/${client.id}`;
  const subject = `Onboarding · ${client.name}: informe para la reunión (cliente ${progress.pct}% · AVANIA ${progress.team.pct}%)`;

  const area = (a, i) => {
    const lines = (hi[a.key] || []).filter(Boolean);
    return `<h3 style="font-size:16px;margin:22px 0 4px">${i + 1}. ${esc(a.title)}</h3>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:12px;color:#667085"><tr>
        <td style="width:50%;padding-right:10px">Cliente · ${a.client.total ? `${a.client.pct}%` : 'nada que rellenar'}${bar(a.client.pct, '#16a34a')}</td>
        <td style="width:50%">AVANIA · ${a.team.total ? `${a.team.pct}%` : 'nada que rellenar'}${bar(a.team.pct, '#14284b')}</td></tr></table>
      ${lines.length ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:14px">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p style="margin:8px 0 0;color:#b45309;font-size:14px">Todavía no hay datos en esta área.</p>'}`;
  };
  const tl = timeline.filter((t) => !t.done);

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f3f4f6;font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111827">
  <div style="max-width:680px;margin:0 auto;padding:24px 14px">
    <p style="margin:0 0 14px"><img src="${PUBLIC_URL}/brand/avania-light.png" alt="avania" height="26" style="height:26px;vertical-align:bottom;border:0"> <span style="font-weight:800;font-size:13px;letter-spacing:.06em;color:#8a8a8a">SPACE</span></p>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:24px">
      <h1 style="font-size:21px;margin:0 0 4px">Informe de onboarding · ${esc(client.name)}</h1>
      <p style="margin:0 0 14px;color:#667085">${esc([client.category, client.city].filter(Boolean).join(' · '))} · ${esc(state)}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
        <td style="width:50%;padding-right:12px"><b style="font-size:26px">${progress.pct}%</b> <span style="color:#667085">cliente</span>${bar(progress.pct, '#16a34a')}</td>
        <td style="width:50%"><b style="font-size:26px">${progress.team.pct}%</b> <span style="color:#667085">AVANIA</span>${bar(progress.team.pct, '#14284b')}</td></tr></table>
      <p style="margin:16px 0 0"><a href="${esc(link)}" style="background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:9px;font-weight:700;display:inline-block">Abrir la ficha</a></p>

      <h2 style="font-size:18px;margin:26px 0 0;border-top:1px solid #e5e7eb;padding-top:18px">Para la reunión de onboarding</h2>
      ${agenda.length ? `<ol style="margin:8px 0 0;padding-left:20px">${agenda.map((a) => `<li>${esc(a)}</li>`).join('')}</ol>` : '<p style="margin:8px 0 0">No queda nada bloqueante: la reunión puede dedicarse a confirmar fechas y expectativas.</p>'}

      <h2 style="font-size:18px;margin:26px 0 6px;border-top:1px solid #e5e7eb;padding-top:18px">Siguientes pasos</h2>
      <h3 style="font-size:15px;margin:10px 0 4px">Del cliente (${mine.length})</h3>${taskTable(mine.slice(0, 12), 'Nada pendiente por su parte.')}
      <h3 style="font-size:15px;margin:16px 0 4px">Nuestras (${ours.length})</h3>${taskTable(ours.slice(0, 12), 'Nada pendiente por nuestra parte.')}

      <h2 style="font-size:18px;margin:26px 0 0;border-top:1px solid #e5e7eb;padding-top:18px">Cronograma</h2>
      ${tl.length ? `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin-top:6px">${tl.map((t) => `<tr><td style="padding:5px 10px 5px 0;white-space:nowrap;color:${t.past ? '#b42318' : '#667085'}">${esc(fecha(t.date))}</td><td style="padding:5px 0;border-bottom:1px solid #f0f1f3">${esc(t.label)}${t.note ? ` <span style="color:#667085">· ${esc(String(t.note).slice(0, 120))}</span>` : ''} <span style="color:#98a2b3">(${esc(t.who)})</span></td></tr>`).join('')}</table>` : '<p style="color:#667085;margin:6px 0 0">Todavía no hay fechas en el cronograma.</p>'}

      <h2 style="font-size:18px;margin:26px 0 0;border-top:1px solid #e5e7eb;padding-top:18px">Lo que hay en la ficha, por áreas</h2>
      ${progress.areas.map(area).join('')}
    </div>
    <p style="font-size:12px;color:#6b7280;margin:14px 0 0">Avania Space · No incluye contraseñas ni claves: solo cuántas hay y de qué servicios.</p>
  </div></body></html>`;

  const text = [`Informe de onboarding · ${client.name}`, state, `Cliente ${progress.pct}% · AVANIA ${progress.team.pct}%`, link, '',
    'PARA LA REUNIÓN', ...agenda.map((a) => `- ${a}`), '',
    `SIGUIENTES PASOS DEL CLIENTE (${mine.length})`, ...mine.slice(0, 12).map((t) => `- [${t.priority}] ${t.title}${t.due ? ` (${t.due})` : ''}`), '',
    `NUESTROS (${ours.length})`, ...ours.slice(0, 12).map((t) => `- [${t.priority}] ${t.title}${t.due ? ` (${t.due})` : ''}`), '',
    'CRONOGRAMA', ...tl.map((t) => `- ${t.date || 'sin fecha'} · ${t.label} (${t.who})`)].join('\n');
  return { subject, html, text };
}
