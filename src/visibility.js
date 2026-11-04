// «Ver cliente»: qué ve cada cliente en su espacio. Un superadministrador marca o desmarca cada página y cada sección de la ficha
// (guardado en clients.client_view); lo que no se ha tocado se rige por el valor de fábrica: lo que el cliente ya veía sigue viéndose y
// lo interno de la agencia sigue oculto.
import { FORM } from './formdef.js';

const fieldsOf = (s) => s.groups.flatMap((g) => g.fields);
const agencyField = (f) => f.owner === 'team' && !f.shared && !f.clientEdit;
export const TEAM_ONLY = new Set(FORM.filter((x) => (x.owner === 'team' && !x.shared) || fieldsOf(x).every(agencyField)).map((x) => x.key));
const PAGES = { resumen: false, plan: true, resultados: true, personas: true, documentos: true, credenciales: true, enlaces: false, registro: false };
export const VIEW_KEYS = [...Object.keys(PAGES), ...FORM.map((x) => x.key)];

/** ¿Ve el cliente esta página o sección? */
export function viewOn(client, key) {
  const v = client?.client_view?.[key];
  if (typeof v === 'boolean') return v;
  return key in PAGES ? PAGES[key] : !TEAM_ONLY.has(key);
}
export const viewMap = (client) => Object.fromEntries(VIEW_KEYS.map((k) => [k, viewOn(client, k)]));
/** Respuesta 403 cuando el cliente pide algo que no tiene activado. */
export const denyView = (res) => res.status(403).json({ error: 'Esta parte no está disponible en tu espacio.' });
