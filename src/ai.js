// Resumen de documentos con Claude (API de Anthropic). Necesita ANTHROPIC_API_KEY en el .env de Space (clave propia de Space).
const GUIA = {
  avatar: 'un análisis de AVATAR (el cliente ideal). Resume: quién es, qué le preocupa u objeta, qué le hace decidir y qué ángulos o canales recomienda.',
  competencia: 'un análisis de la COMPETENCIA. Resume: quiénes son los competidores, en qué son fuertes, dónde son débiles y cómo se puede diferenciar el cliente.',
  oferta: 'un análisis de la OFERTA. Resume: qué se ofrece, precio y condiciones, por qué funciona y qué falta por definir.',
};
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Formato de los textos: Markdown muy simple (negritas y viñetas). Los pinta la ficha, así que no hay que escribir asteriscos sueltos.
const FORMATO = 'FORMATO (Markdown simple): empieza con UNA frase corta en negrita (**así**) que resuma la idea principal; después una lista de viñetas, cada una con "- " y una etiqueta corta en negrita seguida de dos puntos y la explicación, por ejemplo "- **Objeción principal:** teme que no le salga rentable". '
  + 'Usa negritas solo para esas etiquetas y la frase inicial; no uses encabezados (#), tablas, cursivas ni otros asteriscos.';

const clip = (x, n) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// Este modelo escribe «pensamientos» que gastan el límite de palabras y dejaban la respuesta vacía o cortada: se desactivan y se deja margen. Si aun así llega vacía, se reintenta una vez.
async function ask(content, { max = 1600, fail = 'La IA no ha podido responder' } = {}) {
  for (let intento = 0; intento < 2; intento += 1) {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(120_000),
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: Math.max(max, 4000), thinking: { type: 'between_tools' }, messages: [{ role: 'user', content }] }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(`${fail} (${r.status}${j.error?.message ? `: ${j.error.message}` : ''}).`), { status: 502 });
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    if (text) return text;
    console.error(`[ai] respuesta vacía (stop_reason=${j.stop_reason}, tipos=${(j.content || []).map((c) => c.type).join(',')})`);
  }
  return '';
}

/** Resumen de un documento. Para la competencia devuelve también los competidores que aparecen (para la tabla de «Sus clientes, competencia y ofertas»). */
export async function summarize({ kind, clientName, file }) {
  if (!aiEnabled()) throw Object.assign(new Error('Falta la clave de IA de Space (ANTHROPIC_API_KEY en el .env del servidor): sin ella no puedo escribir el resumen.'), { status: 409 });
  const guia = GUIA[kind] || 'un documento de análisis. Resume lo más importante.';
  const comp = kind === 'competencia';
  const instr = `Eres analista de marketing de AVANIA. Cliente: ${clientName}. El documento «${file.name}» es ${guia}\n`
    + `Escribe en español de España un resumen de entre 4 y 7 viñetas cortas (máximo 1.000 caracteres en total), con datos concretos del documento. No inventes: si algo no aparece, no lo menciones. ${FORMATO}\n`
    + (comp
      ? 'Además, saca los competidores concretos que aparezcan en el documento (hasta 10, los más relevantes) con: nombre, web o redes, zona, qué hacen mejor que el cliente y qué hace mejor el cliente que ellos (frases cortas, máximo 140 caracteres). Si un dato no aparece en el documento, deja ese campo vacío: no lo inventes.\n'
        + 'Responde SOLO con un JSON válido, sin texto alrededor ni bloques de código, con esta forma: {"resumen": "…el resumen en Markdown, con \\n entre líneas…", "competidores": [{"nombre": "", "web": "", "zona": "", "mejor": "", "peor": ""}]}'
      : 'Responde solo con el resumen, sin introducción.');
  const content = file.kind === 'pdf'
    ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.base64 } }, { type: 'text', text: instr }]
    : [{ type: 'text', text: `${instr}\n\n--- DOCUMENTO ---\n${file.text}` }];
  const text = await ask(content, { max: comp ? 2400 : 1200 });
  if (!text) throw Object.assign(new Error('La IA no ha devuelto ningún resumen.'), { status: 502 });
  if (!comp) return { resumen: text.slice(0, 3000), competidores: [] };
  let j = null;
  try { j = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { const m = /\{[\s\S]*\}/.exec(text); if (m) { try { j = JSON.parse(m[0]); } catch { /* sin JSON */ } } }
  if (!j || typeof j.resumen !== 'string') return { resumen: text.slice(0, 3000), competidores: [] };
  const competidores = (Array.isArray(j.competidores) ? j.competidores : []).map((x) => ({ nombre: clip(x?.nombre, 120), web: clip(x?.web, 200), zona: clip(x?.zona, 120), mejor: clip(x?.mejor, 300), peor: clip(x?.peor, 300) })).filter((x) => x.nombre).slice(0, 10);
  return { resumen: j.resumen.trim().slice(0, 3000), competidores };
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
    + 'Usa SOLO los resúmenes de los documentos y lo que el cliente ha contado. Español de España, de 4 a 8 viñetas cortas con datos concretos (máximo 1.500 caracteres). Si los documentos se contradicen, dilo. No inventes nada. ' + FORMATO + ' Responde solo con ese texto.\n\n'
    + `--- RESÚMENES DE LOS DOCUMENTOS ---\n${docs}${contexto ? `\n\n--- LO QUE CUENTA EL CLIENTE ---\n${contexto}` : ''}`;
  const text = await ask(instr, { fail: 'La IA no ha podido escribir las conclusiones' });
  if (!text) throw Object.assign(new Error('La IA no ha devuelto ninguna conclusión.'), { status: 502 });
  return text.slice(0, 3000);
}

const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
/** Suma los competidores del análisis a la tabla del cliente (máx. 12 filas): lo ya escrito se respeta, solo se rellenan huecos y se añaden los que faltan. */
export function mergeCompetidores(cur, nuevos) {
  const rows = (Array.isArray(cur) ? cur : []).filter((r) => Object.values(r || {}).some((v) => String(v || '').trim())).map((r) => ({ ...r }));
  let added = 0, updated = 0;
  for (const n of nuevos) {
    const k = norm(n.nombre);
    const hit = rows.find((r) => norm(r.nombre) && k && (norm(r.nombre) === k || norm(r.nombre).includes(k) || k.includes(norm(r.nombre))));
    if (hit) { let ch = false; for (const c of ['web', 'zona', 'mejor', 'peor']) if (!String(hit[c] || '').trim() && n[c]) { hit[c] = n[c]; ch = true; } if (ch) updated += 1; }
    else if (rows.length < 12) { rows.push({ nombre: n.nombre, web: n.web, zona: n.zona, mejor: n.mejor, peor: n.peor }); added += 1; }
  }
  return { rows, added, updated };
}
