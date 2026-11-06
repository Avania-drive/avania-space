import { el, api, renderSection, renderCredentials, helpButton } from './fields.js';
import { scopeForm, agencyOnly, fbPersonalCard } from './extra.js';
import { areasNodes, taskList, timelineNode, phasesNode, bar } from './clientview.js';

const portal = location.pathname.startsWith('/portal');   // dentro del portal el formulario usa la sesión; por enlace, el token
const token = location.pathname.split('/').pop();
const base = portal ? '/api/p/form' : `/api/f/${token}`;
const app = document.getElementById('app');
document.body.classList.add('cform');
const [formDef, ayuda] = await Promise.all([api('GET', '/api/formdef'), fetch('/ayuda.json').then((r) => r.json()).catch(() => ({}))]);
let state;
const load = () => api('GET', base);
try { state = await load(); }
catch { if (portal) { location.replace('/portal'); throw new Error('sin sesión'); } app.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'card' }, el('h1', {}, 'Enlace no válido'), el('p', { class: 'muted' }, 'Este enlace no existe o ha caducado. Pídenos uno nuevo.')))); throw new Error('token'); }

// La plantilla de la categoría decide qué secciones lleva el documento de este cliente.
const { form, blocks, services } = scopeForm(formDef, state.allowed, state.dental);

// Pantallas: «inicio» (lo primero que necesitamos y el resto del documento), cada sección y las credenciales.
const tabs = [...form.filter((s) => !agencyOnly(s)).map((s) => ({ key: s.key, title: s.title, sec: s })), ...(state.role === 'miembro' ? [] : [{ key: 'credenciales', title: 'Credenciales' }])];
const credTab = tabs.find((t) => t.key === 'credenciales');   // la bóveda de accesos va con los enlaces técnicos
const ordered = blocks.flatMap((b) => [...tabs.filter((t) => t.sec && t.sec.block === b.key), ...(b.key === 'tecnico' && credTab ? [credTab] : [])]);
const keyNow = () => decodeURIComponent(location.hash.slice(1)) || 'inicio';
const go = (k) => { location.hash = k === 'inicio' ? '' : k; };

const main = el('main', { id: 'main', tabindex: '-1' });
let firstDraw = true;
const pct = el('div', { class: 'bar' }, el('i'));
const pctTxt = el('span', { class: 'muted num' });
const paintProgress = () => { pct.firstChild.style.width = state.progress.pct + '%'; pctTxt.textContent = `${state.progress.pct}% completado`; };

function contactLine() {
  const who = state.client.manager ? `Vuestra persona de contacto es ${state.client.manager}. ` : '';
  return el('p', { class: 'muted contact' }, `${who}¿Dudas? `, state.contact ? ['Escribidnos a ', el('a', { href: `mailto:${state.contact}` }, state.contact), '.'] : 'Decídnoslo y lo vemos juntos.');
}

const helpSlot = el('span', { class: 'helpslot' });   // el botón de ayuda va arriba a la derecha, junto al avance
function homeView() {
  helpSlot.replaceChildren();
  const mine = (state.tasks || []).filter((t) => t.who === 'cliente'), ours = (state.tasks || []).filter((t) => t.who === 'avania');
  const first = mine.length
    ? el('section', { class: 'cgroup' }, el('h2', {}, 'Lo que necesitamos, por prioridad'),
      el('p', { class: 'muted' }, 'Empezad por arriba: lo que tiene prioridad alta es lo que nos permite lanzar la campaña. Si alguna no sabéis cómo hacerla, decídnoslo y la vemos juntos.'),
      taskList(mine, { href: (t) => `#${t.section}`, limit: 8 }))
    : el('section', { class: 'cgroup' }, el('h2', {}, 'Por vuestra parte, todo listo'), el('p', { class: 'muted' }, 'Gracias. Si queréis, podéis seguir completando el resto del documento.'));
  const doing = ours.length ? el('section', { class: 'cgroup' }, el('h3', {}, `Lo que estamos haciendo nosotros (${ours.length})`), taskList(ours, { href: (t) => `#${t.section}`, limit: 6 })) : '';
  const areas = blocks.map((b, i) => {
    const items = ordered.filter((t) => t.sec && t.sec.block === b.key);
    const cred = b.key === 'tecnico' ? tabs.find((t) => t.key === 'credenciales') : null;   // las contraseñas van con los enlaces técnicos
    const a = state.progress.areas.find((x) => x.key === b.key);
    return items.length || cred ? el('section', { class: 'cgroup' }, el('h3', {}, `${i + 1}. ${b.title}`, a && a.client.total ? el('span', { class: 'muted num', style: 'font-weight:400' }, ` · ${a.client.pct}%`) : ''),
      el('div', { class: 'clist' }, [...items, ...(cred ? [{ ...cred, title: 'Bóveda de accesos' }] : [])].map(row))) : '';
  });
  main.replaceChildren(
    portal ? el('a', { class: 'btn ghost small back', href: '/portal' }, '← Volver a mi espacio') : '',
    el('h1', {}, 'Preparemos el lanzamiento de vuestra campaña'),
    el('p', { class: 'lead' }, helpBlockText('proyecto')),
    el('div', { class: 'card', style: 'margin:14px 0' }, el('strong', {}, 'Vuestro avance, por áreas'), areasNodes(state.progress.areas, { href: (a) => `#${a.sections[0]}` })),
    first, doing,
    state.fases ? el('section', { class: 'cgroup' }, el('h2', {}, 'Cómo avanza vuestro proyecto'), el('div', { class: 'card' }, phasesNode(state.fases, { viewer: 'cliente' }))) : '',
    el('section', { class: 'cgroup' }, el('h2', {}, 'Fechas'), el('div', { class: 'card' }, timelineNode(state.timeline || []))),
    ...areas,
    contactLine());
}
const helpBlockText = (k) => (ayuda[k] && ayuda[k].text) || 'Todo se guarda solo y podéis volver a este mismo enlace cuando queráis.';
const chevron = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<path d="M6 9l6 6 6-6"/>'; return s; };
function row(t) {
  const p = state.progress.sections[t.key], full = p && p.done === p.total;
  return el('a', { class: 'srow', href: `#${t.key}` }, el('span', {}, t.title), el('span', { class: 'state' + (full ? ' ok' : '') }, p ? (full ? 'Completa' : `Faltan ${p.total - p.done} de ${p.total}`) : ''), chevron());
}

function sectionView(t) {
  const i = ordered.indexOf(t), next = ordered[i + 1];
  main.replaceChildren(
    el('a', { class: 'btn ghost small back', href: '#' }, '← Volver al inicio'),
    el('p', { class: 'muted step' }, `Sección ${i + 1} de ${ordered.length}`),
    el('h1', {}, t.sec ? `${t.sec.num} ${t.title}` : t.title));
  helpSlot.replaceChildren(helpButton(ayuda[t.key], t.title) || '');
  if (t.sec) {
    const data = state.sections[t.key] || (state.sections[t.key] = {});
    if (t.key === 'meta' && state.role !== 'miembro') main.append(fbPersonalCard({ list: async () => ({ credentials: state.credentials }), create: async (b) => { const r = await api('POST', `${base}/credentials`, b); state.credentials.push(r.credential); return r; }, update: async (id, b) => api('PUT', `${base}/credentials/${id}`, b) }));
    main.append(renderSection(t.sec, data, {
      team: false, refs: state.sections,
      save: async (partial) => { const r = await api('PUT', `${base}/sections/${t.key}`, partial); state.progress = r.progress; paintProgress(); },
    }));
  } else {
    const box = el('div'); main.append(box);
    renderCredentials(box, {
      mode: 'client', services,
      list: async () => ({ credentials: state.credentials }),
      create: async (b) => { const r = await api('POST', `${base}/credentials`, b); state.credentials.push(r.credential); return r; },
      update: async (id, b) => api('PUT', `${base}/credentials/${id}`, b),
    });
  }
  main.append(el('div', { class: 'stepnav' }, el('a', { class: 'btn ghost', href: '#' }, 'Volver al inicio'),
    next ? el('a', { class: 'btn', href: `#${next.key}` }, `Siguiente: ${next.title}`) : el('a', { class: 'btn', href: '#' }, 'Terminar')), contactLine());
}

async function draw() {
  const k = keyNow();
  if (k === 'inicio') { try { state = await load(); } catch { /* se mantiene el último estado */ } paintProgress(); homeView(); }
  else { const t = tabs.find((x) => x.key === k); if (!t) return go('inicio'); sectionView(t); }
  window.scrollTo(0, 0);
  // Al cambiar de pantalla el foco pasa al título, para que el lector de pantalla lo anuncie.
  const t = !firstDraw && main.querySelector('h1'); if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); }
  firstDraw = false;
}
window.addEventListener('hashchange', draw);

app.replaceChildren(
  el('a', { class: 'skip', href: '#main', onclick: (e) => { e.preventDefault(); main.focus(); } }, 'Saltar al contenido'),
  el('header', { class: 'top' }, el('div', { class: 'in' },
    el('span', { class: 'brandline' }, el('img', { class: 'logo-light', src: '/brand/avania-light.png', alt: 'Avania', width: 67, height: 24 }), el('img', { class: 'logo-dark', src: '/brand/avania-dark.png', alt: 'Avania', width: 67, height: 24 }), el('b', {}, 'SPACE')),
    el('span', { class: 'sp' }), el('strong', { class: 'cname' }, state.client.name), el('div', { style: 'width:110px' }, pct), pctTxt, helpSlot)),
  main);
paintProgress();
draw();
