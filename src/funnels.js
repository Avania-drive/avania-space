// Lectura de un contacto (el cliente) en el CRM de Avania Funnels de AVANIA, solo para precargar su ficha (solo GET).
// El token de la integración privada de la subcuenta de AVANIA va en FUNNELS_TOKEN (.env del servidor).
const BASE = process.env.FUNNELS_BASE_URL || 'https://services.leadconnectorhq.com';
export const ID_RE = /^[A-Za-z0-9]{15,32}$/;

// Las dos subcuentas de Avania Funnels donde están los clientes. Cada una tiene su propio token (integración privada).
// Clínicas dentales → Clinical Dental; industriales, seguros y el resto → Agencia de Marketing Digital.
export const VARIANTS = {
  dental: { label: 'AVANIA Clinical Dental', env: 'FUNNELS_TOKEN', location: 'rNLWECMnIwJnuk8CEyiQ' },
  marketing: { label: 'AVANIA | Agencia de Marketing Digital', env: 'FUNNELS_TOKEN_MARKETING', location: 'MOnEOxHI7wZrEuevmAp0' },
};
export const variantFor = (category) => (/dental|cl[ií]nica/i.test(String(category || '')) ? 'dental' : 'marketing');
export const funnelsEnabled = (variant = 'dental') => Boolean(process.env[VARIANTS[variant].env]);

async function get(path, variant) {
  const v = VARIANTS[variant];
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${process.env[v.env]}`, Version: '2021-07-28', Accept: 'application/json' }, signal: AbortSignal.timeout(15_000),
    });
  } catch { throw Object.assign(new Error('No se pudo contactar con Avania Funnels. Inténtalo de nuevo.'), { status: 502 }); }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error(`No encuentro ese contacto en la subcuenta «${v.label}» (o Space no tiene permiso en ella). Comprueba que la categoría elegida es la de la subcuenta donde está el cliente.`), { status: 502 });
  if (res.status === 404 || res.status === 400 || res.status === 422) throw Object.assign(new Error(`La subcuenta «${v.label}» no tiene ese contacto. Revisa el ID y la categoría.`), { status: 400 });
  if (!res.ok) throw Object.assign(new Error(`Avania Funnels respondió ${res.status}.`), { status: 502 });
  return json;
}

export async function fetchContact(id, variant = 'dental') {
  if (!funnelsEnabled(variant)) throw Object.assign(new Error(`Space todavía no está conectado a la subcuenta «${VARIANTS[variant].label}» de Avania Funnels (falta ${VARIANTS[variant].env} en el servidor).`), { status: 503 });
  const c = (await get(`/contacts/${encodeURIComponent(id)}`, variant)).contact;
  if (!c?.id) throw Object.assign(new Error('Avania Funnels no encuentra ese contacto. Revisa el ID.'), { status: 400 });
  // Nombres de los campos personalizados (solo se usan los que tengan valor).
  let defs = {};
  try {
    const list = (await get(`/locations/${encodeURIComponent(c.locationId)}/customFields?model=contact`, variant)).customFields ?? [];
    defs = Object.fromEntries(list.map((f) => [f.id, f.name]));
  } catch { /* sin nombres de campos: se precarga lo básico */ }
  c.custom = Object.fromEntries((c.customFields ?? []).filter((x) => x.value !== '' && x.value != null).map((x) => [defs[x.id] ?? x.id, x.value]));
  return c;
}

const clean = (v) => String(v ?? '').trim();
const withScheme = (u) => { const s = clean(u); return !s || /^https?:\/\//i.test(s) ? s : `https://${s}`; };
const uniq = (list) => [...new Set(list.map(clean).filter(Boolean))];

/** Contacto → campos de «Vuestra empresa» y primera fila de responsables (solo lo que Funnels tiene relleno). */
export function prefillClinica(c) {
  const full = uniq([c.firstName, c.lastName]).join(' ') || clean(c.name);
  const clinica = {
    nombre_comercial: clean(c.companyName),
    direccion: uniq([c.address1, c.postalCode, c.city]).join(', '),
    ciudad: uniq([c.city, c.state]).join(', '),
    telefono: clean(c.phone),
    web: withScheme(c.website),
  };
  const rol = c.custom?.['¿Cuál es tu rol en la clínica?'];
  const resp = full || c.email || c.phone ? [{ nombre: full, cargo: clean(rol), correo: clean(c.email), telefono: clean(c.phone) }] : [];
  return { full, clinica: Object.fromEntries(Object.entries(clinica).filter(([, v]) => v)), responsables: resp };
}
