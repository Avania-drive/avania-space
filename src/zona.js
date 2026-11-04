// Mapa y estudio sociodemográfico de la zona de captación de un cliente.
// Sitúa en el mapa la dirección y las localidades (Nominatim / OpenStreetMap) y trae, de cada municipio, los datos oficiales
// del Atlas de distribución de renta de los hogares del INE (población, edad, hogares y renta). Nada se inventa: si un dato no existe, se dice.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cache');
const UA = 'AvaniaSpace/1.0 (pascual.vila@avania.es)';
const INE = 'https://servicios.ine.es/wstempus/js/ES';
const MAX_PLACES = 15;
const DAY = 24 * 3600 * 1000;

// Tabla de «Indicadores de renta media y mediana» del Atlas (operación 353) de cada provincia, por código de provincia del INE.
// La de indicadores demográficos ocupa la misma posición en su lista (se resuelve al vuelo).
const RENTA_TABLE = { '02': 30656, '03': 30833, '04': 30842, '01': 30851, '33': 30860, '05': 30869, '06': 30878, '07': 30887, '08': 30896, '48': 30917, '09': 30926, '10': 30935, '11': 30944, '39': 30953, '12': 30962, '13': 30971, '14': 30980, '15': 30989, '16': 30998, '20': 31007, '17': 31016, '18': 31025, '19': 31034, '21': 31043, '22': 31052, '23': 31061, '24': 31070, '25': 31079, '27': 31088, '28': 31097, '29': 31106, '30': 31115, '31': 31124, '32': 31133, '34': 31142, '35': 31151, '36': 31160, '26': 31169, '37': 31178, '38': 31187, '40': 31196, '41': 31205, '42': 31214, '43': 31223, '44': 31232, '45': 31241, '46': 31250, '47': 31259, '49': 31268, '50': 31277, '51': 31286, '52': 31295 };

fs.mkdirSync(DIR, { recursive: true });
const readCache = (name, maxAge) => { try { const f = path.join(DIR, name); if (Date.now() - fs.statSync(f).mtimeMs < maxAge) return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* sin caché */ } return null; };
const writeCache = (name, v) => { try { fs.writeFileSync(path.join(DIR, name), JSON.stringify(v)); } catch { /* no es grave */ } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────── Geocodificación (Nominatim: máximo una petición por segundo) ─────────
let lastCall = 0;
async function nominatim(query) {
  const key = 'geo-' + Buffer.from(query.toLowerCase()).toString('base64url').slice(0, 120) + '.json';
  const hit = readCache(key, 90 * DAY);
  if (hit) return hit.r;
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&extratags=1&countrycodes=es&accept-language=es&q=${encodeURIComponent(query)}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const o = (await r.json())[0] || null;
  const out = o && { lat: +o.lat, lon: +o.lon, label: o.display_name, kind: o.addresstype || o.type, name: o.name, house: o.address?.house_number || null, road: o.address?.road || null, ine: o.extratags?.['ref:ine'] || null,
    town: o.address?.city || o.address?.town || o.address?.village || o.address?.municipality || null, province: o.address?.state_district || o.address?.province || o.address?.state || null };
  writeCache(key, { r: out });
  return out;
}

// CartoCiudad (Instituto Geográfico Nacional): callejero oficial con el número de portal. Es la fuente principal para la dirección de la empresa.
async function cartociudad(query) {
  const key = 'cc-' + Buffer.from(query.toLowerCase()).toString('base64url').slice(0, 120) + '.json';
  const hit = readCache(key, 90 * DAY);
  if (hit) return hit.r;
  const r = await fetch(`https://www.cartociudad.es/geocoder/api/geocoder/candidatesJsonp?limit=12&callback=cb&q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`CartoCiudad ${r.status}`);
  const t = await r.text();
  const out = JSON.parse(t.slice(t.indexOf('(') + 1, t.lastIndexOf(')')));
  writeCache(key, { r: out });
  return out;
}

// ───────── Datos del INE ─────────
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
// «Coruña, A» → «a coruna»; «Alicante/Alacant» → dos nombres.
function nameVariants(n) {
  const out = new Set();
  for (const part of String(n).split('/')) {
    const m = part.match(/^(.*), (El|La|Los|Las|A|O|As|Os|L'|Els|Les|Sa|Es)$/i);
    out.add(norm(part)); if (m) out.add(norm(`${m[2]} ${m[1]}`));
  }
  return [...out];
}
async function ineJson(p) {
  const r = await fetch(`${INE}/${p}`, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`INE ${r.status}`);
  return r.json();
}
let tablesList = null;
async function tableIds(rentaId) {
  tablesList = tablesList || readCache('ine-tablas.json', 30 * DAY) || (() => null)();
  if (!tablesList) { const t = await ineJson('TABLAS_OPERACION/353'); tablesList = { renta: t.filter((x) => x.Nombre === 'Indicadores de renta media y mediana').map((x) => x.Id), demo: t.filter((x) => x.Nombre === 'Indicadores demográficos').map((x) => x.Id) }; writeCache('ine-tablas.json', tablesList); }
  const k = tablesList.renta.indexOf(rentaId);
  return k < 0 ? null : { renta: rentaId, demo: tablesList.demo[k] };
}
const INDICATORS = [
  ['poblacion', /^Población\. Dato base/], ['edad_media', /^Edad media de la población\. Dato base/], ['menores18', /^Porcentaje de población menor de 18 años\. Dato base/],
  ['mayores65', /^Porcentaje de población de 65 y más años\. Dato base/], ['hogar', /^Tamaño medio del hogar\. Dato base/], ['unipersonales', /^Porcentaje de hogares unipersonales\. Dato base/],
  ['espanola', /^Porcentaje de población española\. Dato base/], ['renta_persona', /^Dato base\. Renta neta media por persona/], ['renta_hogar', /^Dato base\. Renta neta media por hogar/],
  ['renta_uc', /^Dato base\. Mediana de la renta por unidad de consumo/],
];
// Devuelve { municipio normalizado: { nombre, anyo, poblacion, … } } de toda una provincia; se guarda en disco un mes.
async function provinceData(code) {
  const cname = `ine-prov-${code}.json`;
  const hit = readCache(cname, 30 * DAY);
  if (hit) return hit;
  const ids = RENTA_TABLE[code] && await tableIds(RENTA_TABLE[code]);
  if (!ids) return null;
  const by = {};
  for (const id of [ids.renta, ids.demo]) {
    for (const s of await ineJson(`DATOS_TABLA/${id}?nult=1`)) {
      const m = s.Nombre.match(/^(.*?)\. (.*)$/s); if (!m || / distrito \d+$| sección \d+$/i.test(m[1])) continue;
      const ind = INDICATORS.find(([, re]) => re.test(m[2]) || re.test(s.Nombre.slice(m[1].length + 2)));
      const v = s.Data?.[0]; if (!ind || !v || v.Valor == null) continue;
      const e = (by[m[1]] = by[m[1]] || { nombre: m[1] });
      e[ind[0]] = v.Valor; e.anyo = Math.max(e.anyo || 0, v.Anyo);
    }
  }
  const out = {};
  for (const e of Object.values(by)) for (const v of nameVariants(e.nombre)) out[v] = e;
  writeCache(cname, out);
  return out;
}

// ───────── Entrada: lo que el cliente escribió ─────────
export function parsePlaces(text) {
  const seen = new Set();
  return String(text || '').split(/[\n;,•·|]+|\s+y\s+|\s+e\s+(?=[A-ZÁÉÍÓÚ])/)
    .map((x) => x.replace(/^[\s\-–*\d.)]+/, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/^(en|de|la zona de|pueblos? de|barrios? de)\s+/i, '').trim())
    .filter((x) => x.length > 1 && x.length < 60 && !seen.has(norm(x)) && seen.add(norm(x)));
}
export const parseRadius = (t) => { const n = parseFloat(String(t || '').replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0]); return Number.isFinite(n) && n > 0 && n < 500 ? n : null; };

// ───────── Dirección de la empresa: se limpia como la escribiría una persona y se va afinando hasta dar con el portal exacto ─────────
const ABBR = [[/\bC\/\s*/gi, 'Calle '], [/\bc\.\s+/gi, 'Calle '], [/\bAvda?\.?\s+/gi, 'Avenida '], [/\bPº\.?\s*/g, 'Paseo '], [/\bP\.º\s*/gi, 'Paseo '], [/\bPza\.?\s+/gi, 'Plaza '], [/\bCtra\.?\s+/gi, 'Carretera '], [/\bUrb\.?\s+/gi, 'Urbanización '], [/\bTrav\.?\s+/gi, 'Travesía ']];
export function cleanAddress(raw) {
  let s = String(raw || '').replace(/\b(españa|spain)\b/gi, '').replace(/\bn[ºo°]\.?\s*(?=\d)/gi, ' ');
  for (const [re, to] of ABBR) s = s.replace(re, to);
  s = s.replace(/\b(local|bajos?|bajo|entresuelo|entreplanta|planta|piso|puerta|portal|escalera|esc|oficina|ofic|of|edificio|edif|bloque|blq|centro comercial|c\.?c\.?)\.?\s*(\w{1,3}\b)?/gi, (m, w1, w2) => (/^(local|bajos?|bajo|entresuelo|entreplanta|planta|piso|puerta|portal|escalera|esc|oficina|ofic|of)$/i.test(w1) ? ' ' : m))
    .replace(/\b\d{1,2}\s*[ºª°]\s*[A-Za-z]?\b/g, ' ').replace(/\s*,\s*(,\s*)+/g, ', ').replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '');
  return s;
}
// Devuelve el centro con `precision`: «portal» (número exacto), «calle» (la calle, sin el número) o «ciudad» (solo el centro del municipio).
async function locateAddress(direccion, ciudad) {
  const dir = cleanAddress(direccion), city = cleanAddress(ciudad), cp = dir.match(/\b\d{5}\b/)?.[0];
  if (!dir && !city) return null;
  const cityName = norm(city.split(',')[0]);
  const sameTown = (g) => !cityName || [g.town, g.name].some((x) => x && (norm(x).includes(cityName) || cityName.includes(norm(x))));
  const hasNumber = /\b\d+\b/.test(dir.replace(/\b\d{5}\b/, ''));
  const street = dir.replace(/,?\s*\b\d{5}\b/, '').split(',')[0].trim();
  const streetNoNum = street.replace(/\s*,?\s*(n[ºo°]\.?\s*)?\d+\s*\w?$/i, '').trim();
  const core = norm(streetNoNum).replace(/^(calle|avenida|paseo|plaza|carretera|travesia|urbanizacion|camino|ronda)\s+(de\s+(la\s+|los\s+|las\s+|el\s+)?)?/, '');
  const sameStreet = (text) => !core || new RegExp(`(^|[^a-z])${core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(norm(text));
  // 1) Callejero oficial: calle y número dentro del municipio indicado.
  if (hasNumber && cityName) {
    const num = street.match(/(\d+)\s*\w?$/)?.[1];
    try {
      const lists = [[street, city.split(',')[0]], [street, cp, city.split(',')[0]]];
      let all = []; for (const l of lists) { all = (await cartociudad(l.filter(Boolean).join(', '))); if (all.some((c) => c.type === 'portal' && String(c.portalNumber) === num && sameStreet(c.address))) break; }
      const cands = all.filter((c) => c.type === 'portal' && c.lat && (norm(c.muni).includes(cityName) || cityName.includes(norm(c.muni))) && String(c.portalNumber) === num && sameStreet(c.address));
      const c = cands.find((x) => !cp || x.postalCode === cp) || cands[0];
      if (c) return { query: street, found: true, lat: c.lat, lng: c.lng, lon: c.lng, label: `${c.address}, ${c.postalCode} ${c.muni} (${c.province})`.replace(/\s+/g, ' '), kind: 'portal', municipio: c.muni, precision: 'portal', province_code: c.provinceCode, ref_catastral: c.refCatastral || null };
    } catch { /* si falla, sigue con OpenStreetMap */ }
  }
  const tries = [];
  if (dir) tries.push(['portal', [dir, city].filter(Boolean).join(', ')], ['portal', [street, cp, city].filter(Boolean).join(', ')]);
  if (streetNoNum && streetNoNum !== street) tries.push(['calle', [streetNoNum, cp, city].filter(Boolean).join(', ')]);
  else if (streetNoNum) tries.push(['calle', [streetNoNum, cp, city].filter(Boolean).join(', ')]);
  for (const [prec, q] of tries) {
    const g = await nominatim(q);
    if (!g || !sameTown(g)) continue;
    if (prec !== 'ciudad' && !sameStreet(g.label)) continue;   // OpenStreetMap devolvió otra calle
    if (prec === 'portal' && hasNumber && !g.house) continue;   // sin número de portal no es la dirección exacta: se sigue probando
    if (prec === 'calle' && g.kind && !/road|street|pedestrian|residential|highway|footway|tertiary|secondary|primary|living|service|unclassified|building|house|place/i.test(g.kind) && !g.road) continue;
    return { query: q, found: true, lat: g.lat, lon: g.lon, label: g.label, kind: g.kind, municipio: g.town || g.name, precision: hasNumber || prec === 'calle' ? (prec === 'portal' ? 'portal' : 'calle') : 'calle', province_code: g.ine ? String(g.ine).slice(0, 2) : null };
  }
  const c = city && await nominatim(`${city}, España`);
  if (c) return { query: city, found: true, lat: c.lat, lon: c.lon, label: c.label, kind: c.kind, municipio: c.town || c.name, precision: 'ciudad', province_code: c.ine ? String(c.ine).slice(0, 2) : null };
  return { query: dir || city, found: false };
}

async function resolvePlace(name, around) {
  const g = await nominatim(`${name}, ${around || ''}, España`.replace(/, ,/g, ',')) || await nominatim(`${name}, España`);
  if (!g) return { query: name, found: false };
  let code = g.ine && String(g.ine).slice(0, 2), town = g.town || g.name;
  if (!code) {   // un barrio o una pedanía no traen código INE: se busca su municipio
    const t = town && (await nominatim(`${town}, ${g.province || ''}, España`.replace(/, ,/g, ',')));
    code = t?.ine && String(t.ine).slice(0, 2); town = t?.name || town;
  }
  return { query: name, found: true, lat: g.lat, lon: g.lon, label: g.label, kind: g.kind, municipio: town, province_code: code };
}

const WEIGHTED = ['edad_media', 'menores18', 'mayores65', 'hogar', 'unipersonales', 'espanola', 'renta_persona', 'renta_hogar', 'renta_uc'];
export async function zonaStudy({ direccion, ciudad, radio, localidades }) {
  const around = String(ciudad || '').trim();
  const center = await locateAddress(direccion, ciudad);
  const names = parsePlaces(localidades);
  const extra = Math.max(0, names.length - MAX_PLACES);
  const places = [];
  for (const n of names.slice(0, MAX_PLACES)) places.push(await resolvePlace(n, around));
  const withMuni = async (p) => {
    if (!p.found || !p.province_code) return p;
    try {
      const data = await provinceData(p.province_code);
      const hit = data && nameVariants(p.municipio).map((v) => data[v]).find(Boolean);
      return { ...p, data: hit || null };
    } catch (e) { return { ...p, data_error: e.message }; }
  };
  const all = [];
  for (const p of [center, ...places].filter(Boolean)) all.push(await withMuni(p));
  const [c, ...rest] = center ? all : [null, ...all];
  // Un mismo municipio puede salir en varias localidades (barrios): sus datos cuentan una sola vez en el total.
  const munis = new Map();
  for (const p of rest) if (p.data) munis.set(norm(p.data.nombre), p.data);
  const list = [...munis.values()], pop = list.reduce((a, d) => a + (d.poblacion || 0), 0);
  const avg = (k) => { const xs = list.filter((d) => d[k] != null && d.poblacion); const w = xs.reduce((a, d) => a + d.poblacion, 0); return w ? xs.reduce((a, d) => a + d[k] * d.poblacion, 0) / w : null; };
  const total = list.length ? { municipios: list.length, poblacion: pop, ...Object.fromEntries(WEIGHTED.map((k) => [k, avg(k)])) } : null;
  return { center: c, radius_km: parseRadius(radio), places: rest, total, skipped: extra };
}
