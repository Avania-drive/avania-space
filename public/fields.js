// Piezas compartidas por el panel del equipo y la página pública del cliente.
export const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'value') n.value = v;
    else if (k === 'checked') n.checked = !!v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};

export const toast = (msg) => {
  const t = el('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2400);
};

export async function api(method, url, body) {
  const r = await fetch(url, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
  });
  let j = {};
  try { j = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) throw Object.assign(new Error(j.error || 'Error'), { status: r.status, code: j.code });
  return j;
}

const TRI = ['Sí', 'No', 'No lo sé'];

// Pinta una sección del formulario. `save(partial)` guarda solo lo que cambia.
export function renderSection(sec, data, { team, save }) {
  const wrap = el('div');
  const status = el('div', { class: 'saved' });
  let pending = {}, timer = null;
  const flush = async () => {
    const body = pending; pending = {}; timer = null;
    if (!Object.keys(body).length) return;
    status.className = 'saved'; status.textContent = 'Guardando…';
    try { await save(body); status.className = 'saved ok'; status.textContent = 'Guardado ✓'; }
    catch (e) { status.className = 'saved bad'; status.textContent = 'No se pudo guardar: ' + e.message; Object.assign(pending, body); }
  };
  const change = (k, v) => { data[k] = v; pending[k] = v; clearTimeout(timer); timer = setTimeout(flush, 700); status.className = 'saved'; status.textContent = 'Sin guardar…'; };

  if (sec.intro) wrap.append(el('div', { class: 'intro' }, sec.intro));
  for (const g of sec.groups) {
    wrap.append(el('h3', {}, g.title));
    if (g.intro) wrap.append(el('div', { class: 'intro' }, g.intro));
    for (const f of g.fields) wrap.append(field(f, data, change, team));
  }
  wrap.append(status);
  window.addEventListener('beforeunload', () => { if (Object.keys(pending).length) flush(); }, { once: true });
  return wrap;
}

function field(f, data, change, team) {
  const readonly = f.owner === 'team' && !team;
  const label = el('label', {}, f.label);
  const hint = f.hint ? el('div', { class: 'hint' }, f.hint) : null;
  const v = data[f.k];
  let input;
  if (readonly) {
    return el('div', { class: 'field' }, label, el('div', { class: 'ro' }, v || 'Lo rellenamos nosotros'));
  }
  if (f.type === 'table') {
    const rows = Array.isArray(v) && v.length ? v : [{}, {}, {}].map(() => ({}));
    data[f.k] = rows;
    const body = el('tbody');
    const draw = () => {
      body.replaceChildren(...rows.map((r, i) => el('tr', {},
        f.cols.map((c) => el('td', {}, el('input', { value: r[c.k] || '', 'aria-label': c.label, oninput: (e) => { r[c.k] = e.target.value; change(f.k, rows); } }))),
        el('td', {}, el('button', { class: 'btn ghost small', title: 'Quitar fila', onclick: () => { rows.splice(i, 1); change(f.k, rows); draw(); } }, '✕')))));
    };
    draw();
    input = el('div', { class: 'scroll' },
      el('table', { class: 'grid-in' }, el('thead', {}, el('tr', {}, f.cols.map((c) => el('th', {}, c.label)), el('th'))), body),
      el('button', { class: 'btn ghost small', onclick: () => { rows.push({}); draw(); } }, '+ Añadir fila'));
    return el('div', { class: 'field' }, label, hint, input);
  }
  if (f.type === 'check') {
    return el('div', { class: 'field check' }, el('label', {},
      el('input', { type: 'checkbox', checked: v === true, onchange: (e) => change(f.k, e.target.checked) }), f.label));
  }
  if (f.type === 'textarea') input = el('textarea', { oninput: (e) => change(f.k, e.target.value) }, v || '');
  else if (f.type === 'select' || f.type === 'tri') {
    const opts = f.type === 'tri' ? TRI : f.options;
    input = el('select', { onchange: (e) => change(f.k, e.target.value) },
      el('option', { value: '' }, '—'), opts.map((o) => el('option', { value: o, selected: v === o }, o)));
  } else input = el('input', { type: { number: 'number', date: 'date', url: 'url', email: 'email', tel: 'tel' }[f.type] || 'text', value: v || '', oninput: (e) => change(f.k, e.target.value) });
  return el('div', { class: 'field' }, label, hint, input);
}

// Guía de ayuda con vídeo por sección. Se rellena en HELP (public/ayuda.json).
export function helpBlock(help) {
  if (!help || (!help.text && !help.video)) return null;
  const body = el('div', { class: 'body' });
  if (help.text) body.append(el('p', {}, help.text));
  if (help.video) {
    const u = help.video;
    const yt = u.match(/(?:youtu\.be\/|v=)([\w-]{11})/), vm = u.match(/vimeo\.com\/(\d+)/);
    if (yt) body.append(el('iframe', { src: `https://www.youtube-nocookie.com/embed/${yt[1]}`, allowfullscreen: true, loading: 'lazy' }));
    else if (vm) body.append(el('iframe', { src: `https://player.vimeo.com/video/${vm[1]}`, allowfullscreen: true, loading: 'lazy' }));
    else body.append(el('a', { href: u, target: '_blank', rel: 'noopener' }, 'Ver el vídeo'));
  }
  return el('details', { class: 'help' }, el('summary', {}, '¿Cómo se hace? Ayuda y vídeo'), body);
}

// Tabla de credenciales. mode 'team' (con ver/copiar) o 'client' (solo escribir).
export function renderCredentials(root, { mode, services, list, create, update, remove, reveal, askCode, canSee }) {
  const body = el('tbody');
  const status = el('div', { class: 'saved' });
  let rows = [];
  const mark = (txt, cls = '') => { status.className = 'saved ' + cls; status.textContent = txt; };
  const STATUS = { pendiente: 'warn', recibida: '', verificada: 'ok' };

  const cell = (r, k, ph, type = 'text') => el('input', { type, value: r[k] || '', placeholder: ph, 'aria-label': ph,
    onchange: async (e) => { try { Object.assign(r, (await update(r.id, { [k]: e.target.value })).credential); mark('Guardado ✓', 'ok'); } catch (er) { mark(er.message, 'bad'); } } });

  async function doReveal(r, copy, input) {
    const go = async () => {
      const { password } = await reveal(r.id, copy);
      if (copy) { await navigator.clipboard.writeText(password); toast('Copiada al portapapeles'); return; }
      input.type = 'text'; input.value = password;
      setTimeout(() => { input.type = 'password'; input.value = ''; input.placeholder = '••••••••'; }, 15000);
    };
    try { await go(); } catch (e) {
      if (e.code === 'mfa_required') { if (await askCode()) { try { await go(); } catch (e2) { mark(e2.message, 'bad'); } } }
      else mark(e.message, 'bad');
    }
  }

  const draw = () => body.replaceChildren(...rows.map((r) => {
    const pw = el('input', { type: 'password', autocomplete: 'new-password', placeholder: r.has_password ? '••••••••' : 'Sin contraseña',
      'aria-label': 'Contraseña',
      onchange: async (e) => { if (!e.target.value) return; try { Object.assign(r, (await update(r.id, { password: e.target.value })).credential); e.target.value = ''; e.target.placeholder = '••••••••'; mark('Guardada ✓ (cifrada)', 'ok'); draw(); } catch (er) { mark(er.message, 'bad'); } } });
    const pwCell = el('div', { class: 'pwcell' }, pw);
    if (mode === 'team' && r.has_password && canSee) {
      pwCell.append(el('button', { class: 'btn ghost small', onclick: () => doReveal(r, false, pw) }, 'Ver'),
        el('button', { class: 'btn ghost small', onclick: () => doReveal(r, true, pw) }, 'Copiar'));
    } else if (mode === 'client' && r.has_password) pwCell.append(el('span', { class: 'pill ok' }, 'guardada'));
    const st = mode === 'team'
      ? el('select', { onchange: async (e) => { try { Object.assign(r, (await update(r.id, { status: e.target.value })).credential); mark('Guardado ✓', 'ok'); draw(); } catch (er) { mark(er.message, 'bad'); } } },
        ['pendiente', 'recibida', 'verificada'].map((s) => el('option', { value: s, selected: r.status === s }, s)))
      : el('span', { class: 'pill ' + STATUS[r.status] }, r.status);
    return el('tr', {},
      el('td', {}, el('strong', {}, r.service)),
      el('td', {}, cell(r, 'company', 'Empresa')), el('td', {}, cell(r, 'username', 'Usuario')),
      el('td', {}, cell(r, 'email', 'Correo', 'email')), el('td', {}, pwCell),
      el('td', {}, cell(r, 'url', 'Enlace de acceso', 'url')), el('td', {}, cell(r, 'notes', 'Notas')),
      el('td', {}, st),
      el('td', {}, remove ? el('button', { class: 'btn ghost small', title: 'Borrar fila', onclick: async () => {
        if (!confirm(`¿Borrar la fila de ${r.service}?`)) return;
        try { await remove(r.id); rows = rows.filter((x) => x.id !== r.id); draw(); } catch (er) { mark(er.message, 'bad'); } } }, '🗑') : ''));
  }));

  const svc = el('select', {}, el('option', { value: '' }, 'Añadir servicio…'), services.map((s) => el('option', { value: s }, s)), el('option', { value: '__otro' }, 'Otro…'));
  svc.addEventListener('change', async () => {
    let name = svc.value; svc.value = '';
    if (name === '__otro') name = (prompt('Nombre del servicio') || '').trim();
    if (!name) return;
    try { rows.push((await create({ service: name })).credential); draw(); } catch (e) { mark(e.message, 'bad'); }
  });

  root.replaceChildren(
    mode === 'client' ? el('div', { class: 'intro' }, 'Preferimos acceso delegado (como socio o administrador) y nunca os pediremos la contraseña si existe esa opción. Si no es posible, podéis guardarla aquí: se cifra al instante y nadie del exterior puede leerla. Vosotros tampoco podréis verla de nuevo, solo cambiarla.') : '',
    el('div', { class: 'scroll' }, el('table', { class: 't' },
      el('thead', {}, el('tr', {}, ['Servicio', 'Empresa', 'Usuario', 'Correo', 'Contraseña', 'Acceso', 'Notas', 'Estado', ''].map((h) => el('th', {}, h)))), body)),
    el('div', { class: 'row', style: 'margin-top:10px' }, svc, status));
  list().then((r) => { rows = r.credentials; draw(); });
}
