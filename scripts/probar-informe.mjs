// Envía a REPORT_TO el informe de onboarding de un cliente como prueba. No marca report_sent_at. Uso: node scripts/probar-informe.mjs [nombre]
import 'dotenv/config';
import { q } from '../src/db.js';
import { progress, gates } from '../src/formdef.js';
import { tasksOf, timelineOf } from '../src/plan.js';
import { buildReport, REPORT_TO } from '../src/report.js';
import { sendHtml } from '../src/mailer.js';
const c = (await q('select * from clients where not archived and ($1::text is null or name ilike $1) order by created_at limit 1', [process.argv[2] ? `%${process.argv[2]}%` : null])).rows[0];
if (!c) throw new Error('Sin cliente');
const sections = Object.fromEntries((await q('select section, data from client_sections where client_id = $1', [c.id])).rows.map((x) => [x.section, x.data]));
const creds = (await q('select service, status, (password_enc is not null) has_password from credentials where client_id = $1', [c.id])).rows;
const cr = {}; for (const r of creds) cr[r.status] = (cr[r.status] || 0) + 1;
const p = progress(sections);
const r = buildReport({ client: c, sections, creds, progress: p, gates: gates(sections, cr, null), tasks: tasksOf(sections, cr, { allowed: null, dental: true }), timeline: timelineOf(sections),
  onboarding: { client_done: false, team_done_at: c.team_done_at, report_sent_at: c.report_sent_at, report_to: REPORT_TO() } });
await sendHtml({ to: REPORT_TO(), ...r, subject: `[PRUEBA] ${r.subject}` });
console.log('Enviado a', REPORT_TO(), '·', c.name, '·', r.subject);
process.exit(0);
