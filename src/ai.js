// Resumen de documentos con Claude (API de Anthropic). Necesita ANTHROPIC_API_KEY en el .env de Space (clave propia de Space).
const GUIA = {
  avatar: 'un análisis de AVATAR (el cliente ideal). Resume: quién es, qué le preocupa u objeta, qué le hace decidir y qué ángulos o canales recomienda.',
  competencia: 'un análisis de la COMPETENCIA. Resume: quiénes son los competidores, en qué son fuertes, dónde son débiles y cómo se puede diferenciar el cliente.',
  oferta: 'un análisis de la OFERTA. Resume: qué se ofrece, precio y condiciones, por qué funciona y qué falta por definir.',
};
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function summarize({ kind, clientName, file }) {
  if (!aiEnabled()) throw Object.assign(new Error('Falta la clave de IA de Space (ANTHROPIC_API_KEY en el .env del servidor): sin ella no puedo escribir el resumen.'), { status: 409 });
  const guia = GUIA[kind] || 'un documento de análisis. Resume lo más importante.';
  const instr = `Eres analista de marketing de AVANIA. Cliente: ${clientName}. El documento «${file.name}» es ${guia}\n`
    + 'Escribe en español de España un resumen de entre 4 y 7 viñetas cortas (máximo 1.000 caracteres en total), con datos concretos del documento. No inventes: si algo no aparece, no lo menciones. Responde solo con el resumen, sin introducción.';
  const content = file.kind === 'pdf'
    ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.base64 } }, { type: 'text', text: instr }]
    : [{ type: 'text', text: `${instr}\n\n--- DOCUMENTO ---\n${file.text}` }];
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(120_000),
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: 1200, messages: [{ role: 'user', content }] }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`La IA no ha podido leer el documento (${r.status}${j.error?.message ? `: ${j.error.message}` : ''}).`), { status: 502 });
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  if (!text) throw Object.assign(new Error('La IA no ha devuelto ningún resumen.'), { status: 502 });
  return text.slice(0, 3000);
}

const CONCL = {
  avatar: 'las CONCLUSIONES DEL AVATAR: a quién nos dirigimos, quién es, qué le preocupa u objeta y qué le hace decidir.',
  competencia: 'las CONCLUSIONES SOBRE LA COMPETENCIA: qué hace la competencia, dónde es fuerte y dónde puede diferenciarse el cliente.',
  oferta: 'las CONCLUSIONES SOBRE LA OFERTA: la oferta que vamos a comunicar y por qué funciona.',
};
/** Conclusiones de una pestaña a partir de los resúmenes de sus fichas (y de lo que el propio cliente contó). */
export async function conclude({ kind, clientName, fichas, contexto }) {
  if (!aiEnabled()) throw Object.assign(new Error('Falta la clave de IA de Space (ANTHROPIC_API_KEY en el .env del servidor).'), { status: 409 });
  const docs = fichas.map((f, i) => `### ${f.nombre || `Documento ${i + 1}`}\n${f.resumen}`).join('\n\n');
  const instr = `Eres analista de marketing de AVANIA. Cliente: ${clientName}. Redacta ${CONCL[kind] || 'las conclusiones.'}\n`
    + 'Usa SOLO los resúmenes de los documentos y lo que el cliente ha contado. Español de España, de 4 a 8 viñetas cortas con datos concretos (máximo 1.500 caracteres). Si los documentos se contradicen, dilo. No inventes nada. Responde solo con las viñetas.\n\n'
    + `--- RESÚMENES DE LOS DOCUMENTOS ---\n${docs}${contexto ? `\n\n--- LO QUE CUENTA EL CLIENTE ---\n${contexto}` : ''}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(120_000),
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: 1200, messages: [{ role: 'user', content: instr }] }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`La IA no ha podido escribir las conclusiones (${r.status}${j.error?.message ? `: ${j.error.message}` : ''}).`), { status: 502 });
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  if (!text) throw Object.assign(new Error('La IA no ha devuelto ninguna conclusión.'), { status: 502 });
  return text.slice(0, 3000);
}
