import { el, api, renderSection, renderCredentials, helpBlock } from './fields.js';

const token = location.pathname.split('/').pop();
const app = document.getElementById('app');
const [{ form, services }, ayuda] = await Promise.all([api('GET', '/api/formdef'), fetch('/ayuda.json').then((r) => r.json()).catch(() => ({}))]);
let state;
try { state = await api('GET', `/api/f/${token}`); }
catch { app.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'card' }, el('h1', {}, 'Enlace no válido'), el('p', { class: 'muted' }, 'Este enlace no existe o ha caducado. Pídenos uno nuevo.')))); throw new Error('token'); }

const tabs = [...form.map((s) => ({ key: s.key, title: `${s.num}. ${s.title}`, sec: s })), { key: 'credenciales', title: 'Credenciales' }];
let cur = tabs[0].key;
const side = el('nav', { class: 'side' });
const main = el('div');
const pct = el('div', { class: 'bar' }, el('i'));
const pctTxt = el('span', { class: 'muted' });

function drawSide() {
  side.replaceChildren(...tabs.map((t) => {
    const p = state.progress.sections[t.key];
    return el('a', { class: cur === t.key ? 'on' : '', onclick: () => { cur = t.key; draw(); window.scrollTo(0, 0); } },
      t.title, p ? el('small', {}, `${p.done}/${p.total}`) : '');
  }));
  pct.firstChild.style.width = state.progress.pct + '%';
  pctTxt.textContent = `${state.progress.pct}% completado`;
}

function draw() {
  drawSide();
  const t = tabs.find((x) => x.key === cur);
  main.replaceChildren(el('h1', {}, t.title), helpBlock(ayuda[t.key]) || '');
  if (t.sec) {
    const data = state.sections[t.key] || (state.sections[t.key] = {});
    main.append(renderSection(t.sec, data, {
      team: false,
      save: async (partial) => { const r = await api('PUT', `/api/f/${token}/sections/${t.key}`, partial); state.progress = r.progress; drawSide(); },
    }));
  } else {
    const box = el('div'); main.append(box);
    renderCredentials(box, {
      mode: 'client', services,
      list: async () => ({ credentials: state.credentials }),
      create: async (b) => { const r = await api('POST', `/api/f/${token}/credentials`, b); state.credentials.push(r.credential); return r; },
      update: async (id, b) => api('PUT', `/api/f/${token}/credentials/${id}`, b),
    });
  }
}

app.replaceChildren(
  el('header', { class: 'top' }, el('div', { class: 'in' },
    el('span', { class: 'brandline' }, el('img', { class: 'logo-light', src: '/brand/avania-light.png', alt: 'Avania' }), el('img', { class: 'logo-dark', src: '/brand/avania-dark.png', alt: 'Avania' }), el('b', {}, 'SPACE')),
    el('span', { class: 'sp' }), el('strong', {}, state.client.name), el('div', { style: 'width:120px' }, pct), pctTxt)),
  el('main', {}, el('div', { class: 'layout' }, side, main)));
draw();
