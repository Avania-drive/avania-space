// Pantallas del esquema (fase 1): panel general, configuración, notas, enlaces y documentos del cliente.
import { el, api, toast, askText, askConfirm, fmtDate, toUrl, appIcon, openModal, notice, mailLink, ssoPicker, ssoPills } from './fields.js';

const catPill = (name, color) => el('span', { class: 'catpill', style: `--c:${color || '#667085'}` }, name);
const ago = (iso) => { const d = Math.floor((Date.now() - new Date(iso)) / 864e5); return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`; };

// La plantilla de alta de la categoría decide qué secciones lleva el documento; lo dental solo sale en las categorías dentales.
export function scopeForm(fd, allowed, dental) {
  const ok = (k) => !allowed || allowed.includes(k);
  const form = fd.form.filter((s) => ok(s.key)).map((s) => ({ ...s, groups: s.groups.map((g) => ({ ...g, fields: g.fields.filter((f) => dental || !f.dental) })) }));
  const blocks = fd.blocks.map((b) => ({ ...b, sections: b.sections.filter(ok) })).filter((b) => b.sections.length);
  return { ...fd, form, blocks };
}

// ¿Es una sección solo de la agencia (el cliente no la ve)? Lo es si está marcada así o si todos sus campos son de equipo.
export const agencyOnly = (sec) => (sec.owner === 'team' && !sec.shared) || sec.groups.every((g) => g.fields.every((f) => f.owner === 'team' && !f.shared && !f.clientEdit));

// Los grupos de una sección que contienen ciertos campos, para pestañas que enseñan solo una parte (Personas, Horarios).
export const partOf = (fd, secKey, fieldKeys, title, dental = true) => {
  const sec = fd.form.find((s) => s.key === secKey);
  return { ...sec, title, intro: undefined, groups: sec.groups.filter((g) => g.fields.some((f) => fieldKeys.includes(f.k))).map((g) => ({ ...g, fields: g.fields.filter((f) => dental || !f.dental) })) };
};


// Lista en dos columnas con TODAS las secciones de la ficha (agrupadas por área) para marcar cuáles lleva un cliente.
// `defaults` = las de su categoría (null = todas). `initial` = las ya elegidas para ese cliente (null = las de la categoría).
// value() devuelve la lista elegida, o null si no se ha tocado nada (se queda lo de la categoría).
export function sectionPicker(fd, { defaults = null, initial = null } = {}) {
  const LOCKED = new Set(['proyecto', 'clinica']);
  const all = fd.form.map((x) => x.key);
  let def = defaults, touched = !!initial;
  const on = new Set(initial || def || all);
  const boxes = new Map();
  const wrap = el('div', { class: 'secpick' });
  const paint = () => boxes.forEach((cb, k) => { cb.checked = LOCKED.has(k) || on.has(k); });
  const count = el('span', { class: 'muted secpick-n' });
  const upd = () => { count.textContent = `${[...boxes.keys()].filter((k) => boxes.get(k).checked).length} de ${all.length} secciones`; };
  const set = (keys) => { on.clear(); keys.forEach((k) => on.add(k)); paint(); upd(); };
  const tool = (txt, fn) => el('button', { type: 'button', class: 'btn ghost small', onclick: () => { touched = true; fn(); } }, txt);
  const group = (b) => el('section', { class: 'secpick-g' }, el('h4', {}, b.title),
    el('div', { class: 'secpick-cols' }, b.sections.map((k) => {
      const sec = fd.form.find((x) => x.key === k); if (!sec) return '';
      const cb = el('input', { type: 'checkbox', checked: LOCKED.has(k) || on.has(k), disabled: LOCKED.has(k), onchange: (e) => { touched = true; e.target.checked ? on.add(k) : on.delete(k); upd(); } });
      boxes.set(k, cb);
      return el('label', { class: 'secpick-row' + (LOCKED.has(k) ? ' locked' : '') }, cb, el('span', {}, `${sec.num} ${sec.title}`, LOCKED.has(k) ? el('small', { class: 'muted' }, ' · siempre') : ''));
    })));
  wrap.append(el('div', { class: 'row secpick-tools' }, tool('Marcar todo', () => set(all)), tool('Quitar todo', () => set([])), tool('Las de la categoría', () => set(def || all)), el('span', { class: 'grow' }), count),
    ...fd.blocks.map(group));
  upd();
  return { node: wrap,
    value: () => (touched ? [...boxes.keys()].filter((k) => boxes.get(k).checked) : null),
    setDefaults: (d) => { def = d; if (!touched) set(d || all); },
    reset: (d) => { touched = false; def = d; set(d || all); } };
}


// Acceso a la cuenta personal de Facebook (usuario y contraseña) en lo alto de Meta. No se guarda en la ficha: va a la Bóveda
// como credencial «Facebook personal», con la contraseña cifrada (la misma que se ve y se gestiona en Contraseñas).
export function fbPersonalCard({ list, create, update }) {
  const SERVICE = 'Facebook personal';
  const user = el('input', { type: 'text', autocomplete: 'off', 'aria-label': 'Usuario de Facebook personal', placeholder: 'Correo o teléfono con el que entra a Facebook' });
  const pass = el('input', { type: 'password', autocomplete: 'new-password', 'aria-label': 'Contraseña de Facebook personal', placeholder: 'Contraseña' });
  const msg = el('span', { class: 'muted', role: 'status' });
  let row = null, timer = null, loaded = false;
  const save = async () => {
    if (!loaded) return;
    const u = user.value.trim(), p = pass.value;
    if (!u && !p) return;
    msg.className = 'muted'; msg.textContent = 'Guardando…';
    try {
      if (!row) { const r = await create({ service: SERVICE, username: u, password: p || undefined }); row = r.credential; }
      else { const r = await update(row.id, { username: u, ...(p ? { password: p } : {}) }); row = r.credential || { ...row, username: u, has_password: row.has_password || !!p }; }
      if (p) { pass.value = ''; pass.placeholder = 'Contraseña guardada (escribe otra para cambiarla)'; }
      msg.className = 'saved ok'; msg.textContent = 'Guardado ✓ (cifrado en la Bóveda)';
    } catch (e) { msg.className = 'err'; msg.textContent = e.message; }
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(save, 900); };
  user.addEventListener('input', later); pass.addEventListener('input', later);
  Promise.resolve(list()).then((r) => {
    row = (r.credentials || []).find((c) => c.service === SERVICE) || null;
    if (row) { user.value = row.username || ''; if (row.has_password) pass.placeholder = 'Contraseña guardada (escribe otra para cambiarla)'; }
    loaded = true;
  }).catch((e) => { msg.className = 'err'; msg.textContent = e.message; });
  return el('section', { class: 'card fbcard' }, el('h3', { style: 'margin:0;font-size:15px' }, 'Acceso a Facebook personal'),
    el('p', { class: 'muted', style: 'margin:2px 0 10px;font-size:13px' }, 'El usuario y la contraseña de la cuenta personal de Facebook que administra la página y los anuncios. Se guardan cifrados en la Bóveda, no en la ficha.'),
    el('div', { class: 'fbgrid' }, el('label', {}, 'Usuario', user), el('label', {}, 'Contraseña', pass)), el('div', { style: 'margin-top:6px' }, msg));
}

// ───────── Panel general ─────────
export async function panelView(view, go) {
  const [d, { requests }] = await Promise.all([api('GET', '/api/dashboard'), api('GET', '/api/access-requests')]);
  const stat = (n, t) => el('div', { class: 'stat' }, el('b', {}, String(n)), el('span', {}, t));
  const empty = (t) => el('p', { class: 'empty' }, t);
  const card = (title, count, body, cls = '') => el('section', { class: `card pcard ${cls}` }, el('div', { class: 'phead' }, el('h2', {}, title), count != null ? el('span', { class: 'pill' }, String(count)) : ''), body);
  const pending = d.pending.reduce((n, p) => n + p.n, 0);
  view.replaceChildren(
    el('div', { class: 'row', style: 'margin-bottom:4px' }, el('h1', { class: 'grow' }, 'Panel general'), el('a', { class: 'btn ghost small', href: '#/' }, 'Ver todos los clientes →')),
    el('div', { class: 'stats five' }, stat(d.totals.clients, 'Clientes'), stat(d.totals.active, 'En campaña'), stat(d.totals.onboarding, 'En onboarding'), stat(pending, 'Accesos por recibir'), stat(requests.length, 'Solicitudes de acceso')),
    el('div', { class: 'pgrid' },
      card('Altas incompletas', d.incomplete.length, d.incomplete.length ? el('div', { class: 'plist' }, d.incomplete.slice(0, 12).map((c) => el('a', { class: 'prow', href: `#/c/${c.id}` },
        el('span', { class: 'grow' }, el('strong', {}, c.name), el('small', { class: 'muted', style: 'display:block' }, c.days ? `${c.days} ${c.days === 1 ? 'día' : 'días'} desde el inicio` : 'Empieza hoy')),
        el('div', { class: 'bar', style: 'width:90px' }, el('i', { style: `width:${c.pct}%` })), el('span', { class: 'num pctn' }, `${c.pct}%`)))) : empty('No hay altas por completar.'), 'tall'),
      card('Solicitudes de acceso', requests.length, requests.length ? el('div', { class: 'plist' }, requests.map((r) => el('div', { class: 'prow' },
        el('a', { class: 'grow', href: `#/c/${r.client_id}/enlaces` }, el('strong', {}, r.client_name), el('small', { class: 'muted', style: 'display:block' }, `${r.link_type} · ${r.requested_by || 'cliente'} · ${ago(r.created_at)}`)),
        el('button', { class: 'btn ghost small', onclick: async (e) => { e.currentTarget.disabled = true; await api('PATCH', `/api/access-requests/${r.id}`); panelView(view, go); } }, 'Atendida')))) : empty('Nadie ha pedido acceso a nada.')),
      card('Accesos pendientes de recibir', pending, d.pending.length ? el('div', { class: 'plist' }, d.pending.map((c) => el('a', { class: 'prow', href: `#/c/${c.id}/credenciales` }, el('strong', { class: 'grow' }, c.name), el('span', { class: 'pill warn' }, `${c.n} pendiente${c.n > 1 ? 's' : ''}`)))) : empty('No falta ningún acceso.')),
      card('Clientes por categoría', null, d.by_category.length ? el('div', { class: 'catgrid' }, d.by_category.map((c) => el('a', { class: 'catbox', href: `#/?categoria=${encodeURIComponent(c.name)}` }, catPill(c.name, c.color),
        el('b', { class: 'num' }, `${c.total} ${c.total === 1 ? 'cliente' : 'clientes'}`), el('small', { class: 'muted' }, c.active ? `${c.active} en campaña` : 'ninguno en campaña')))) : empty('Todavía no hay clientes.'), 'full')));
}

// ───────── Configuración ─────────
const STEP_LABEL = { onboarding: 'Onboarding', montaje: 'Montaje', rodaje: 'Rodaje', formacion: 'Formación', activa: 'Campaña activa', pausada: 'Pausada' };
const DEFAULT_STEPS = ['onboarding', 'rodaje', 'formacion', 'activa', 'pausada'];

export async function configView(view, formDef, me) {
  const [{ categories }, { types }, { people }] = await Promise.all([api('GET', '/api/categories'), api('GET', '/api/link-types'), api('GET', '/api/agency-people')]);
  const edit = me.role === 'super_admin' || me.role === 'admin';
  const secs = formDef.form;

  const catCard = (c) => {
    let all = !c.sections, picked = new Set(c.sections || secs.map((s) => s.key));
    const color = el('input', { type: 'color', name: 'color', value: c.color, 'aria-label': `Color de ${c.name}`, disabled: !edit });
    const boxes = secs.map((s) => el('label', { class: 'check' + (s.key === 'proyecto' ? ' locked' : '') },
      el('input', { type: 'checkbox', name: 'sec', checked: picked.has(s.key), disabled: !edit || all || s.key === 'proyecto', onchange: (e) => (e.target.checked ? picked.add(s.key) : picked.delete(s.key)) }),
      el('span', {}, `${s.num} ${s.title}`)));
    const allBox = el('input', { type: 'checkbox', name: 'todas', checked: all, disabled: !edit, onchange: (e) => { all = e.target.checked; boxes.forEach((b, i) => { const i0 = b.querySelector('input'); i0.disabled = all || secs[i].key === 'proyecto'; }); } });
    let steps = new Set(c.statuses || DEFAULT_STEPS);
    const stepBoxes = Object.entries(STEP_LABEL).map(([k, t]) => el('label', { class: 'check' + (k === 'activa' ? ' locked' : '') },
      el('input', { type: 'checkbox', name: 'paso', checked: steps.has(k), disabled: !edit || k === 'activa', onchange: (e) => (e.target.checked ? steps.add(k) : steps.delete(k)) }), el('span', {}, t)));
    const save = async () => {
      try { await api('PUT', `/api/categories/${encodeURIComponent(c.name)}`, { color: color.value, sections: all ? null : [...picked], statuses: [...steps] }); toast(`Plantilla de «${c.name}» guardada`); }
      catch (e) { toast(e.message); }
    };
    return el('details', { class: 'cfgcat' }, el('summary', {}, catPill(c.name, c.color), el('span', { class: 'muted' }, c.sections ? `${c.sections.length} secciones` : 'Alta completa')),
      el('div', { class: 'cfgbody' },
        el('div', { class: 'row' }, el('label', { class: 'check' }, allBox, el('span', {}, 'Todas las secciones (alta completa)')), el('span', { class: 'grow' }), el('label', { class: 'row muted' }, 'Color', color)),
        el('div', { class: 'checks' }, boxes),
        el('div', {}, el('strong', {}, 'Pasos del cliente'), el('p', { class: 'muted', style: 'margin:2px 0 8px' }, 'Por los que pasa un cliente de esta categoría hasta lanzar la campaña. La clínica incluye rodaje y formación; el resto, montaje.'), el('div', { class: 'checks' }, stepBoxes)),
        edit ? el('div', { class: 'row end' }, el('button', { class: 'btn small', onclick: save }, 'Guardar plantilla')) : ''));
  };

  // Una persona del equipo de AVANIA: nombre, rol, responsabilidades y contacto. Se guarda con su botón.
  const personRow = (p, isNew = false) => {
    const f = (name, label, v, tag = 'input') => el('label', { class: 'pf' }, el('span', { class: 'muted' }, label), el(tag, { name, value: tag === 'input' ? v || '' : undefined, disabled: !edit, ...(tag === 'textarea' ? { rows: 2 } : {}) }, tag === 'textarea' ? v || '' : []));
    const form = el('form', { class: 'prow personrow', onsubmit: async (e) => {
      e.preventDefault();
      const g = (n) => form.elements[n].value;
      try { const r = await api('PUT', '/api/agency-people', { id: p.id, name: g('name'), role: g('role'), responsibilities: g('responsibilities'), email: g('email'), phone: g('phone'), active: form.elements.active.checked }); p.id = r.person.id; toast(`${r.person.name} guardado`); }
      catch (er) { toast(er.message); }
    } }, f('name', 'Nombre', p.name), f('role', 'Rol', p.role), f('email', 'Correo', p.email), f('phone', 'Teléfono', p.phone), f('responsibilities', 'Responsabilidades', p.responsibilities, 'textarea'),
    el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'active', checked: p.active !== false, disabled: !edit }), el('span', {}, 'Sale en las fichas')),
    edit ? el('div', { class: 'row' }, el('button', { class: 'btn small' }, 'Guardar'),
      el('button', { type: 'button', class: 'btn ghost small danger', onclick: async () => { if (!p.id) return form.remove(); if (await askConfirm({ title: 'Quitar persona', text: `${p.name} dejará de estar en el directorio. Las fichas que ya la tienen copiada no cambian.`, ok: 'Quitar', danger: true })) { await api('DELETE', `/api/agency-people/${p.id}`); form.remove(); } } }, 'Quitar')) : '');
    return form;
  };
  const typeRow = (t) => el('div', { class: 'prow' },
    el('span', { class: 'grow' }, el('strong', {}, t.name), el('small', { class: 'muted', style: 'display:block' }, t.login_url || 'Sin dirección de inicio de sesión')),
    edit ? [el('button', { class: 'btn ghost small', onclick: () => saveType(t) }, 'Editar'),
      el('button', { class: 'btn ghost small danger', onclick: async () => { if (await askConfirm({ title: 'Quitar tipo de enlace', text: `«${t.name}» dejará de ofrecerse al añadir enlaces. Los ya creados se conservan.`, ok: 'Quitar', danger: true })) { await api('DELETE', `/api/link-types/${encodeURIComponent(t.name)}`); configView(view, formDef, me); } } }, 'Quitar')] : '');
  async function saveType(t) {
    const name = t ? t.name : await askText({ title: 'Nuevo tipo de enlace', label: 'Nombre (Avania Funnels, ClickUp…)', ok: 'Siguiente' });
    if (!name) return;
    const login = await askText({ title: name, label: 'Dirección de inicio de sesión (opcional)', value: t?.login_url || '', placeholder: 'https://…', ok: 'Guardar' });
    if (login === null) return;
    try { await api('PUT', '/api/link-types', { name, login_url: login, icon: t?.icon }); configView(view, formDef, me); } catch (e) { toast(e.message); }
  }

  view.replaceChildren(
    el('h1', {}, 'Configuración'),
    !edit ? el('div', { class: 'banner' }, 'Solo los administradores pueden cambiar la configuración.') : '',
    el('section', { class: 'card' }, el('h2', {}, 'Categorías y plantillas de alta'),
      el('p', { class: 'muted' }, 'Cada categoría lleva su propio alta: marca las secciones del documento que se piden a sus clientes. Las dentales conservan el alta completa.'),
      el('div', { class: 'cfglist' }, categories.map(catCard)),
      edit ? el('div', { class: 'row', style: 'margin-top:12px' }, el('button', { class: 'btn ghost small', onclick: async () => {
        const name = await askText({ title: 'Nueva categoría', label: 'Nombre', ok: 'Crear' }); if (!name) return;
        try { await api('POST', '/api/categories', { name }); configView(view, formDef, me); } catch (e) { toast(e.message); }
      } }, '+ Nueva categoría')) : ''),
    el('section', { class: 'card' }, el('h2', {}, 'Tipos de enlace'),
      el('p', { class: 'muted' }, 'Las herramientas que se pueden enlazar a un cliente, con su dirección de inicio de sesión.'),
      el('div', { class: 'plist' }, types.map(typeRow)), edit ? el('div', { class: 'row', style: 'margin-top:12px' }, el('button', { class: 'btn ghost small', onclick: () => saveType(null) }, '+ Nuevo tipo')) : ''),
    el('section', { class: 'card' }, el('h2', {}, 'Equipo de AVANIA: quién es quién'),
      el('p', { class: 'muted' }, 'Las personas de la agencia, su rol y sus responsabilidades. En la ficha de cada cliente, «Nosotros › Cargar el equipo de AVANIA» copia esta lista a su tabla de «quién es quién», que el cliente ve.'),
      el('div', { class: 'plist' }, people.map((p) => personRow(p))), edit ? el('div', { class: 'row', style: 'margin-top:12px' }, el('button', { class: 'btn ghost small', onclick: (e) => e.currentTarget.parentElement.previousElementSibling.append(personRow({ active: true }, true)) }, '+ Añadir persona')) : ''),
    el('section', { class: 'card' }, el('h2', {}, 'Administradores'),
      el('p', { class: 'muted', style: 'margin:0' }, me.role === 'super_admin' ? ['Las altas, roles y accesos del equipo de la agencia se gestionan en ', el('a', { href: '#/equipo' }, 'Equipo agencia'), '.'] : 'Los gestiona el superadministrador.')));
}

// ───────── Notas del cliente ─────────
export async function notesTab(main, clientId) {
  const box = el('div', { class: 'plist notes' });
  const draw = async () => {
    const { notes } = await api('GET', `/api/clients/${clientId}/notes`);
    box.replaceChildren(...(notes.length ? notes.map((n) => el('article', { class: 'note' },
      el('p', {}, n.body),
      el('div', { class: 'row' }, el('small', { class: 'muted grow' }, `${n.author || '—'} · ${fmtDate(n.created_at, { dateStyle: 'medium', timeStyle: 'short' })}`),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'visible', checked: n.visible, onchange: async (e) => { await api('PATCH', `/api/notes/${n.id}`, { visible: e.target.checked }); toast(e.target.checked ? 'La nota la verá el cliente' : 'Nota interna'); } }), el('span', {}, 'Visible para el cliente')),
        el('button', { class: 'btn ghost small danger', onclick: async () => { if (await askConfirm({ title: 'Borrar nota', text: 'No se puede deshacer.', ok: 'Borrar', danger: true })) { await api('DELETE', `/api/notes/${n.id}`); draw(); } } }, 'Borrar'))))
      : [el('p', { class: 'muted' }, 'Todavía no hay notas.')]));
  };
  const ta = el('textarea', { name: 'nota', rows: 3, placeholder: 'Escribe una nota…', 'aria-label': 'Nueva nota', maxlength: 4000 });
  const vis = el('input', { type: 'checkbox', name: 'visible' });
  main.append(el('p', { class: 'muted' }, 'Las notas son internas. Marca «Visible para el cliente» solo en las que quieras que vea en su espacio.'),
    el('form', { class: 'card', onsubmit: async (e) => { e.preventDefault(); if (!ta.value.trim()) return; try { await api('POST', `/api/clients/${clientId}/notes`, { body: ta.value, visible: vis.checked }); ta.value = ''; vis.checked = false; draw(); } catch (er) { toast(er.message); } } },
      ta, el('div', { class: 'row', style: 'margin-top:8px' }, el('label', { class: 'check' }, vis, el('span', {}, 'Visible para el cliente')), el('span', { class: 'grow' }), el('button', { class: 'btn small' }, 'Añadir nota'))),
    box);
  await draw();
}

// ───────── Enlaces del cliente ─────────
export async function linksCard(clientId) {
  const [{ links }, { types }] = await Promise.all([api('GET', `/api/clients/${clientId}/links`), api('GET', '/api/link-types')]);
  const loginOf = (l) => l.login_url || types.find((t) => t.name === l.type)?.login_url || null;
  const ACC = { si: 'Con acceso', no: 'Sin acceso', pendiente: 'Pendiente' };
  const root = el('section', { class: 'card', style: 'margin-bottom:14px' });
  const draw = (rows) => {
    const sel = el('select', { name: 'tipo', 'aria-label': 'Tipo de enlace' }, types.map((t) => el('option', { value: t.name }, t.name)));
    root.replaceChildren(el('strong', {}, 'Herramientas del cliente'),
      el('p', { class: 'muted', style: 'margin:2px 0 10px' }, 'Cada herramienta con el enlace directo, el de inicio de sesión y si el cliente tiene acceso propio.'),
      rows.length ? el('div', { class: 'plist' }, rows.map((l) => {
        const login = loginOf(l);
        return el('div', { class: 'prow linkrow' },
          el('span', { class: 'grow' }, el('strong', {}, l.type), el('small', { class: 'muted', style: 'display:block' }, l.url || 'Sin enlace directo')),
          l.url ? el('a', { class: 'btn small', href: l.url, target: '_blank', rel: 'noopener' }, 'Abrir ↗') : '',
          login ? el('a', { class: 'btn ghost small', href: login, target: '_blank', rel: 'noopener' }, 'Iniciar sesión ↗') : '',
          el('select', { name: 'acceso', 'aria-label': `Acceso del cliente a ${l.type}`, onchange: async (e) => { Object.assign(l, (await api('PUT', `/api/links/${l.id}`, { has_access: e.target.value })).link); toast('Guardado'); } },
            Object.entries(ACC).map(([v, t]) => el('option', { value: v, selected: v === l.has_access }, t))),
          el('label', { class: 'check', title: 'El cliente ve este enlace en su barra' }, el('input', { type: 'checkbox', name: 'visible', checked: l.visible, onchange: async (e) => { Object.assign(l, (await api('PUT', `/api/links/${l.id}`, { visible: e.target.checked })).link); toast('Guardado'); } }), el('span', {}, 'Visible')),
          el('button', { class: 'btn ghost small', onclick: async () => {
            const u = await askText({ title: l.type, label: 'Enlace directo del cliente', value: l.url || '', placeholder: 'https://…', ok: 'Guardar' }); if (u === null) return;
            try { Object.assign(l, (await api('PUT', `/api/links/${l.id}`, { url: u })).link); draw(rows); } catch (e) { toast(e.message); }
          } }, 'Editar'),
          el('button', { class: 'btn ghost small danger', onclick: async () => { if (await askConfirm({ title: 'Quitar enlace', text: `Se quita «${l.type}» de este cliente.`, ok: 'Quitar', danger: true })) { await api('DELETE', `/api/links/${l.id}`); draw(rows.filter((x) => x !== l)); } } }, 'Quitar'));
      })) : el('p', { class: 'muted' }, 'Aún no hay herramientas enlazadas.'),
      el('div', { class: 'row', style: 'margin-top:12px' }, sel, el('button', { class: 'btn small', onclick: async () => {
        try { const { link } = await api('POST', `/api/clients/${clientId}/links`, { type: sel.value }); rows.push(link); draw(rows); toast('Añadido: ahora pon su enlace con «Editar»'); } catch (e) { toast(e.message); }
      } }, '+ Añadir herramienta')));
  };
  draw(links);
  return root;
}

// ───────── Documentos ─────────
export function docsTab(main, { fd, sections, clientId, view }) {
  const bytes = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
  const PREV = /^(application\/pdf|image\/(png|jpeg|webp|gif)|text\/plain)$/;
  const fileUrl = (f, dl) => `/api/clients/${clientId}/files/${f.id}${dl ? '?download=1' : ''}`;
  const seeFile = (f) => view && view({ nombre: f.name, url: fileUrl(f, true), local: true, embed: PREV.test(f.mime) ? { src: fileUrl(f), kind: f.mime === 'application/pdf' ? 'PDF' : f.mime === 'text/plain' ? 'Texto' : 'Imagen' } : null });
  // ── Documentos subidos a Space ──
  const list = el('div', { class: 'plist', style: 'margin-top:10px' });
  const msg = el('span', { class: 'muted' });
  const draw = async () => {
    const { files } = await api('GET', `/api/clients/${clientId}/files`);
    list.replaceChildren(...(files.length ? files.map((f) => el('div', { class: 'prow' },
      el('span', { class: 'grow' }, el('strong', {}, f.name), el('small', { class: 'muted', style: 'display:block' }, `${bytes(f.size)} · ${f.uploaded_by || '—'} · ${fmtDate(f.created_at, { dateStyle: 'medium' })}`)),
      view ? el('button', { class: 'btn small', type: 'button', onclick: () => seeFile(f) }, 'Ver') : '',
      el('a', { class: 'btn ghost small', href: fileUrl(f, true), download: f.name }, 'Descargar'),
      el('button', { class: 'btn ghost small', type: 'button', title: 'Quitar', 'aria-label': `Quitar ${f.name}`, onclick: async () => { if (!(await askConfirm(`¿Quitar «${f.name}»?`))) return; await api('DELETE', `/api/clients/${clientId}/files/${f.id}`); draw(); } }, '✕')))
      : [el('p', { class: 'muted', style: 'margin:0' }, 'Todavía no se ha subido ningún documento.')]));
  };
  const upload = async (files) => {
    for (const f of files) {
      if (f.size > 15 * 1024 * 1024) { toast(`«${f.name}» pesa más de 15 MB`); continue; }
      msg.textContent = `Subiendo «${f.name}»…`;
      try {
        const r = await fetch(`/api/clients/${clientId}/files?name=${encodeURIComponent(f.name)}&type=${encodeURIComponent(f.type || '')}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Space-Upload': '1' }, body: f });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo subir');
      } catch (e) { toast(e.message); }
    }
    msg.textContent = ''; draw();
  };
  const input = el('input', { type: 'file', multiple: true, hidden: true, 'aria-label': 'Elegir documentos', onchange: () => { upload([...input.files]); input.value = ''; } });
  const drop = el('section', { class: 'card', style: 'margin-bottom:14px' }, el('strong', {}, 'Documentos del cliente'),
    el('p', { class: 'muted', style: 'margin:2px 0 10px' }, 'Sube aquí el contrato, los materiales o los informes (hasta 15 MB cada uno). Solo los ve el equipo de AVANIA.'),
    el('div', { class: 'row' }, input, el('button', { class: 'btn small', type: 'button', onclick: () => input.click() }, 'Subir documentos'), msg), list);
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.style.outline = '2px dashed var(--accent, #1d9a8a)'; }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.style.outline = ''; if (ev === 'drop') upload([...e.dataTransfer.files]); }));
  main.append(drop);
  draw().catch((e) => toast(e.message));
  const rows = fd.form.flatMap((s) => s.groups.flatMap((g) => g.fields.filter((f) => f.type === 'docs' || f.type === 'fichas').map((f) => ({ s, g, items: ((sections[s.key] || {})[f.k] || []).filter((r) => r.url) })))).filter((r) => r.items.length);
  main.append(el('section', { class: 'card' }, el('strong', {}, 'Documentos del alta'),
    rows.length ? el('div', { class: 'plist', style: 'margin-top:8px' }, rows.flatMap((r) => r.items.map((d) => el('div', { class: 'prow' },
      el('span', { class: 'grow' }, el('strong', {}, d.nombre || 'Documento'), el('small', { class: 'muted', style: 'display:block' }, r.g.title.replace(/^[\d.]+\s/, '') + ' · ' + r.s.title)),
      view ? el('button', { class: 'btn small', type: 'button', onclick: () => view(d) }, 'Ver') : '',
      el('a', { class: 'btn ghost small', href: d.url, target: '_blank', rel: 'noopener' }, 'Abrir ↗')))))
      : el('p', { class: 'muted', style: 'margin:6px 0 0' }, 'Aún no se ha subido ningún documento.')));
}

export const lastChange = (meta, key) => (meta?.[key] ? `Última modificación: ${ago(meta[key].at)} · ${meta[key].by || '—'}` : '');


// ───────── Logo del cliente ─────────
const hue = (t) => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
export const avatar = (c, size = 44) => c.logo_v
  ? el('img', { class: 'logo', src: `/api/clients/${c.id}/logo?v=${c.logo_v}`, alt: '', width: size, height: size, style: `width:${size}px;height:${size}px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:12px` })
  : el('span', { class: 'logo', 'aria-hidden': 'true', style: `width:${size}px;height:${size}px;background:hsl(${hue(c.name)} 45% 40%);font-size:${Math.round(size * 0.4)}px` }, (c.name.trim()[0] || '?').toUpperCase());

// Reduce la imagen a 256 px en el navegador para que el logo pese poco.
async function shrink(file) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 256 / Math.max(img.width, img.height));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  const png = cv.toDataURL('image/png');
  return png.length > 130000 ? cv.toDataURL('image/webp', 0.85) : png;
}
export function logoButton(c, after) {
  const inp = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, 'aria-label': 'Subir logo', onchange: async () => {
    const f = inp.files[0]; if (!f) return;
    try { await api('PUT', `/api/clients/${c.id}/logo`, { data: await shrink(f) }); toast('Logo guardado'); after(); } catch (e) { toast(e.name === 'InvalidStateError' || /decode|bitmap/i.test(e.message) ? 'Usa una imagen PNG, JPG o WebP' : e.message); }
    inp.value = '';
  } });
  return el('span', { class: 'row', style: 'gap:6px' }, inp,
    el('button', { type: 'button', class: 'logobtn', title: c.logo_v ? 'Cambiar el logo' : 'Subir el logo', 'aria-label': c.logo_v ? 'Cambiar el logo del cliente' : 'Subir el logo del cliente', onclick: () => inp.click() }, avatar(c, 40)),
    c.logo_v ? el('button', { type: 'button', class: 'btn ghost small', onclick: async () => { await api('DELETE', `/api/clients/${c.id}/logo`); after(); } }, 'Quitar logo') : '');
}

// ───────── Equipo del cliente (usuarios del portal) ─────────
export async function clientUsersTab(main, clientId) {
  const box = el('div');
  const draw = async () => {
    const { users } = await api('GET', `/api/clients/${clientId}/users`);
    const email = el('input', { id: 'cu-e', name: 'email', type: 'email', placeholder: 'correo@empresa.com', required: true });
    const name = el('input', { id: 'cu-n', name: 'nombre', placeholder: 'Nombre' });
    const role = el('select', { id: 'cu-r', name: 'rol' }, el('option', { value: 'responsable' }, 'Responsable'), el('option', { value: 'miembro' }, 'Miembro'));
    const err = el('div', { class: 'err', role: 'alert' });
    box.replaceChildren(
      el('div', { class: 'card', style: 'margin-bottom:14px' }, users.length ? el('div', { class: 'plist' }, users.map((u) => el('div', { class: 'prow' },
        el('span', { class: 'grow' }, el('strong', {}, u.name || u.email), el('small', { class: 'muted', style: 'display:block' }, `${u.email} · ${u.role === 'responsable' ? 'Responsable' : 'Miembro'}${u.pending ? ' · invitación pendiente' : u.last_login ? ` · último acceso ${ago(u.last_login)}` : ''}${u.active ? '' : ' · sin acceso'}`)),
        mailLink(u.email, u.name || u.email),
        u.pending && u.active ? el('button', { class: 'btn ghost small', onclick: async () => { const r = await api('PATCH', `/api/client-users/${u.id}`, { resend_invite: true }); toast(r.invite === 'sent' ? 'Invitación reenviada' : 'No se pudo enviar: ' + r.invite); } }, 'Reenviar') : '',
        el('button', { class: 'btn ghost small', onclick: async () => { await api('PATCH', `/api/client-users/${u.id}`, { role: u.role === 'responsable' ? 'miembro' : 'responsable' }); draw(); } }, u.role === 'responsable' ? 'Pasar a miembro' : 'Hacer responsable'),
        el('button', { class: 'btn ghost small', onclick: async () => { await api('PATCH', `/api/client-users/${u.id}`, { active: !u.active }); draw(); } }, u.active ? 'Quitar acceso' : 'Dar acceso'),
        el('button', { class: 'btn ghost small danger', onclick: async () => { if (await askConfirm({ title: 'Eliminar usuario', text: `Se elimina a ${u.name || u.email} del portal de este cliente.`, ok: 'Eliminar', danger: true })) { await api('DELETE', `/api/client-users/${u.id}`); draw(); } } }, 'Eliminar'))))
        : el('p', { class: 'muted', style: 'margin:0' }, 'Todavía nadie del cliente tiene acceso a su espacio.')),
      el('form', { class: 'card', onsubmit: async (e) => {
        e.preventDefault(); err.textContent = '';
        try {
          const r = await api('POST', `/api/clients/${clientId}/users`, { email: email.value, name: name.value, role: role.value });
          toast(r.email_sent ? 'Invitación enviada' : `Creado, pero no se pudo enviar el correo: ${r.email_error}`); draw();
        } catch (er) { err.textContent = er.message; }
      } }, el('h2', { style: 'margin-top:0' }, 'Dar acceso al portal'),
      el('div', { class: 'fgrid' }, el('div', {}, el('label', { for: 'cu-e' }, 'Correo'), email), el('div', {}, el('label', { for: 'cu-n' }, 'Nombre (opcional)'), name), el('div', {}, el('label', { for: 'cu-r' }, 'Rol'), role),
        el('button', { class: 'btn' }, 'Enviar invitación')),
      err));
  };
  main.append(el('p', { class: 'muted' }, 'Las personas del cliente con cuenta en su espacio. El responsable ve todo lo suyo, incluidos los accesos, e invita a su equipo; el miembro rellena y consulta, pero no ve accesos.'), box);
  await draw();
}

// ───────── Bóveda de herramientas (solo administradores) ─────────
// Alta mínima (16-nov-2026): arriba un buscador y una sola línea para dar de alta —aplicación o servicio, correo y contraseña escrita dos veces—;
// cada servicio es una fila que se despliega para poner el enlace de acceso, las notas, con qué se entra (Google, Meta, Apple…) y el resto de datos.
export async function vaultView(view, { askCode }) {
  const lock = () => {
    const err = el('div', { class: 'err', role: 'alert' });
    const pw = el('input', { id: 'vl-pw', name: 'password', type: 'password', autocomplete: 'current-password', required: true });
    view.replaceChildren(el('h1', {}, 'Bóveda de herramientas'), el('form', { class: 'card', style: 'max-width:420px;margin:24px 0', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      try { await api('POST', '/api/reauth', { password: pw.value }); draw(); } catch (er) { err.textContent = er.message; pw.value = ''; pw.focus(); }
    } }, el('h2', { style: 'margin-top:0' }, 'Zona protegida'), el('p', { class: 'muted' }, 'Para abrirla escribe de nuevo la contraseña de tu cuenta. Se cierra tras 10 minutos sin tocarla.'),
    el('label', { for: 'vl-pw' }, 'Contraseña'), pw, err, el('button', { class: 'btn', style: 'width:100%;margin-top:12px' }, 'Abrir la Bóveda')));
    pw.focus();
  };
  const guard = async (fn) => { try { return await fn(); } catch (e) { if (e.code === 'password_required') { lock(); } throw e; } };

  const reveal = async (t, field, copy) => {
    const go = () => api('POST', `/api/vault/${t.id}/reveal`, { field, copy });
    let r;
    try { r = await guard(go); } catch (e) {
      if (e.code === 'mfa_required') { if (!(await askCode())) return; r = await go(); }
      else if (e.code === 'no_mfa') { toast('Activa la doble verificación en Seguridad para ver contraseñas'); location.hash = '#/seguridad'; return; }
      else { toast(e.message); return; }
    }
    if (copy) { await navigator.clipboard.writeText(r.secret); toast('Copiado'); } else notice({ title: `${t.name} · ${field === 'api_key' ? 'clave API' : 'contraseña'}`, secret: r.secret, ok: 'Cerrar' });
  };


  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const fixUrl = (v) => { const t = String(v ?? '').trim(); return !t ? '' : /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`; };
  let tools = [], query = '';
  const openIds = new Set();
  const status = el('span', { class: 'saved', role: 'status', 'aria-live': 'polite' });
  const mark = (txt, cls = '') => { status.className = 'saved ' + cls; status.textContent = txt; };

  // Una fila: cerrada, el servicio, el correo y cómo se entra; abierta, todo lo demás. Cada campo se guarda al salir de él.
  const row = (t) => {
    const sumKids = () => [
      el('span', { class: 'logo vlogo', 'aria-hidden': 'true', style: `background:hsl(${hue(t.name)} 45% 40%)` }, t.name[0].toUpperCase()),
      el('strong', { class: 'svc' }, t.name),
      el('span', { class: 'muted sum' }, [t.username, t.category].filter(Boolean).join(' · ')),
      el('span', { class: 'grow' }),
      ssoPills(t.login_with),
      t.has_password || !(t.login_with || []).length ? el('span', { class: 'pill ' + (t.has_password ? 'ok' : 'warn') }, t.has_password ? 'contraseña guardada' : 'sin contraseña') : null,
      el('span', { class: 'chev' }, '›')];
    const sum = el('summary', {}, sumKids());
    const upd = async (patch) => {
      try { const r = await guard(() => api('PUT', `/api/vault/${t.id}`, patch)); Object.assign(t, r.tool); sum.replaceChildren(...sumKids().filter(Boolean)); mark('Guardado ✓', 'ok'); return true; }
      catch (e) { mark(e.message, 'bad'); return false; }
    };
    const txt = (k, label, ph = '', type = 'text', conv = (v) => v) => el('label', {}, label, el('input', { type, value: t[k] ?? '', placeholder: ph, autocomplete: 'off', onchange: (e) => { const v = conv(e.target.value); if (k === 'url') e.target.value = v; upd({ [k]: v }); } }));

    const p1 = el('input', { type: 'password', autocomplete: 'new-password', placeholder: t.has_password ? 'Nueva contraseña' : 'Contraseña', 'aria-label': 'Contraseña' });
    const p2 = el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Repetir contraseña', 'aria-label': 'Repetir contraseña' });
    const pwErr = el('div', { class: 'err', role: 'alert' });
    const setPw = async () => {
      pwErr.textContent = '';
      if (!p1.value) { pwErr.textContent = 'Escribe la contraseña.'; p1.focus(); return; }
      if (p1.value !== p2.value) { pwErr.textContent = 'Las contraseñas no coinciden.'; p2.focus(); return; }
      if (await upd({ password: p1.value, password2: p2.value })) { p1.value = p2.value = ''; p1.placeholder = 'Nueva contraseña'; }
    };
    const pwBox = el('div', { class: 'vpw' }, el('span', { class: 'ssol' }, 'Contraseña'),
      el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, p1, p2, el('button', { type: 'button', class: 'btn small', onclick: setPw }, t.has_password ? 'Cambiar' : 'Guardar'),
        t.has_password ? [el('button', { type: 'button', class: 'btn ghost small', onclick: () => reveal(t, 'password', false) }, 'Ver'), el('button', { type: 'button', class: 'btn ghost small', onclick: () => reveal(t, 'password', true) }, 'Copiar')] : ''),
      pwErr);

    const more = el('details', { class: 'vmore' }, el('summary', {}, 'Más datos (categoría, coste, renovación, clave API…)'),
      el('div', { class: 'credgrid' }, txt('category', 'Categoría'), txt('purpose', 'Para qué sirve'), txt('used_by', 'Quién la usa'), txt('cost', 'Coste (30 €/mes…)'),
        el('label', {}, 'Renovación', el('input', { type: 'date', value: t.renewal || '', onchange: (e) => upd({ renewal: e.target.value }) })),
        el('div', {}, el('label', {}, t.has_api_key ? 'Clave API (vacía = sin cambios)' : 'Clave API', el('input', { type: 'password', autocomplete: 'new-password', onchange: async (e) => { if (e.target.value && await upd({ api_key: e.target.value })) e.target.value = ''; } })),
          t.has_api_key ? el('div', { class: 'row', style: 'gap:6px;margin-top:6px' }, el('button', { type: 'button', class: 'btn ghost small', onclick: () => reveal(t, 'api_key', false) }, 'Ver clave'), el('button', { type: 'button', class: 'btn ghost small', onclick: () => reveal(t, 'api_key', true) }, 'Copiar clave')) : '')));

    const notes = el('textarea', { rows: 3, 'aria-label': 'Notas', onchange: (e) => upd({ notes: e.target.value }) }, t.notes || '');
    return el('details', { class: 'cred vrow', 'data-id': t.id, open: openIds.has(t.id), ontoggle: (e) => { if (e.target !== e.currentTarget) return; e.currentTarget.open ? openIds.add(t.id) : openIds.delete(t.id); } }, sum,
      el('div', { class: 'credgrid' },
        txt('username', 'Correo o usuario', 'correo@ejemplo.com'),
        txt('url', 'Enlace de acceso', 'https://…', 'text', fixUrl),
        el('div', { class: 'ssofield' }, el('span', { class: 'ssol' }, 'Se entra con (no hace falta contraseña)'), ssoPicker(t.login_with || [], (list) => upd({ login_with: list }))),
        pwBox,
        el('label', { class: 'vnotes' }, 'Notas', notes),
        el('div', { class: 'vwide' }, more),
        el('div', { class: 'credfoot vfoot' },
          t.url ? el('a', { class: 'btn small', href: t.url, target: '_blank', rel: 'noopener' }, 'Abrir ↗') : '', el('span', { class: 'grow' }),
          el('button', { type: 'button', class: 'btn ghost small', onclick: async () => {
            const { log } = await guard(() => api('GET', `/api/vault/${t.id}/log`));
            notice({ title: `Registro de ${t.name}`, text: log.length ? log.map((l) => `${fmtDate(l.at, { dateStyle: 'short', timeStyle: 'short' })} · ${l.actor} · ${l.action.replace('bóveda: ', '')}`).join('\n') : 'Sin movimientos.', ok: 'Cerrar' });
          } }, 'Registro'),
          el('button', { type: 'button', class: 'btn ghost small danger', onclick: async () => {
            if (await askConfirm({ title: 'Borrar', text: `Se borra «${t.name}» con sus contraseñas. No se puede deshacer.`, ok: 'Borrar', danger: true })) { await guard(() => api('DELETE', `/api/vault/${t.id}`)); tools = tools.filter((x) => x.id !== t.id); renderList(); }
          } }, 'Borrar'))));
  };

  // Estructura fija (el buscador y el alta no se repintan al guardar): título, buscador, alta, lista.
  const count = el('span', { class: 'muted' });
  const listBox = el('div', { class: 'credlist vlist' });
  const search = el('input', { type: 'search', class: 'vsearch', placeholder: 'Buscar por aplicación o servicio…', 'aria-label': 'Buscar por aplicación o servicio', autocomplete: 'off', spellcheck: false, oninput: (e) => { query = e.target.value; renderList(); } });

  const fName = el('input', { id: 'vq-name', name: 'name', type: 'text', required: true, autocomplete: 'off', placeholder: 'Ej.: Canva', 'data-autofocus': '' });
  const fMail = el('input', { id: 'vq-mail', name: 'username', type: 'text', inputmode: 'email', autocomplete: 'off', placeholder: 'correo@ejemplo.com' });
  const fP1 = el('input', { id: 'vq-p1', name: 'password', type: 'password', autocomplete: 'new-password' });
  const fP2 = el('input', { id: 'vq-p2', name: 'password2', type: 'password', autocomplete: 'new-password' });
  const addErr = el('div', { class: 'err', role: 'alert' });
  const lab = (id, t, input) => el('label', { for: id }, t, input);
  const add = el('form', { class: 'vq', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); addErr.textContent = ''; fP2.removeAttribute('aria-invalid');
    const name = fName.value.trim();
    if (!name) { addErr.textContent = 'Escribe la aplicación o el servicio.'; fName.focus(); return; }
    if ((fP1.value || fP2.value) && fP1.value !== fP2.value) { addErr.textContent = 'Las contraseñas no coinciden.'; fP2.setAttribute('aria-invalid', 'true'); fP2.focus(); return; }
    if (tools.some((t) => norm(t.name) === norm(name) && norm(t.username) === norm(fMail.value))) { addErr.textContent = `Ya tienes «${name}» con ese correo.`; return; }
    try {
      const body = { name, ...(fMail.value.trim() && { username: fMail.value.trim() }), ...(fP1.value && { password: fP1.value, password2: fP2.value }) };
      const { tool } = await guard(() => api('POST', '/api/vault', body));
      tools.push(tool); tools.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      add.reset(); query = ''; search.value = ''; renderList(); toast(`«${tool.name}» añadida`);
      const n = listBox.querySelector(`[data-id="${tool.id}"]`); if (n) { n.classList.add('flash'); n.scrollIntoView({ block: 'nearest' }); }
      fName.focus();
    } catch (er) { addErr.textContent = er.message; }
  } }, lab('vq-name', 'Aplicación o servicio', fName), lab('vq-mail', 'Correo electrónico', fMail), lab('vq-p1', 'Contraseña', fP1), lab('vq-p2', 'Repetir contraseña', fP2), el('button', { class: 'btn' }, 'Añadir'), addErr);

  function renderList() {
    const q = norm(query);
    const shown = q ? tools.filter((t) => norm([t.name, t.username, t.category, t.purpose, t.used_by, t.url].join(' ')).includes(q)) : tools;
    count.textContent = q ? `${shown.length} de ${tools.length}` : `${tools.length}`;
    listBox.replaceChildren(...(shown.length ? shown.map(row)
      : [el('div', { class: 'vempty' }, tools.length ? el('span', {}, `Nada con «${query.trim()}». `, el('button', { type: 'button', class: 'btn ghost small', onclick: () => { fName.value = query.trim(); fName.focus(); } }, `Añadir «${query.trim()}»`)) : 'Todavía no hay nada. Añade la primera arriba.')]));
  }

  async function draw() {
    try { ({ tools } = await api('GET', '/api/vault')); } catch (e) { if (e.code === 'password_required') return lock(); throw e; }
    view.replaceChildren(el('div', { class: 'row vhead' }, el('h1', { class: 'grow' }, 'Bóveda de herramientas ', count), status),
      el('p', { class: 'muted', style: 'margin:0 0 12px' }, 'Solo administradores. Ver o copiar una contraseña pide la doble verificación y queda registrado.'),
      search, add, listBox);
    renderList();
  }
  await draw();
}


// ───────── Resultados del cliente (KPIs desde su subcuenta de Avania Funnels) ─────────
const nf = new Intl.NumberFormat('es-ES');
const eur = (n) => (n == null ? '—' : `${nf.format(n)} €`);
const pc = (n) => (n == null ? '—' : `${String(n).replace('.', ',')} %`);

// Pide la contraseña de la cuenta (la conexión con Funnels es una acción protegida); resuelve true si queda abierta.
function reauth() {
  return new Promise((resolve) => {
    const err = el('div', { class: 'err', role: 'alert' });
    const pw = el('input', { id: 'ra-pw', name: 'password', type: 'password', autocomplete: 'current-password', required: true, 'data-autofocus': '' });
    const card = el('form', { class: 'card', onsubmit: async (e) => { e.preventDefault(); err.textContent = ''; try { await api('POST', '/api/reauth', { password: pw.value }); d.close(true); } catch (er) { err.textContent = er.message; pw.value = ''; } } },
      el('h2', {}, 'Confirma tu contraseña'), el('p', { class: 'muted' }, 'Para conectar o desconectar una subcuenta escribe de nuevo la contraseña de tu cuenta.'), el('label', { for: 'ra-pw' }, 'Contraseña'), pw, err,
      el('div', { class: 'row end', style: 'margin-top:12px' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => d.close(false) }, 'Cancelar'), el('button', { class: 'btn' }, 'Continuar')));
    const d = openModal(card, { label: 'Confirma tu contraseña', onClose: (v) => resolve(v === true) });
  });
}

export function kpisNode(k, clientId = null) {
  const a = k.actual, p = k.anterior;
  const tile = (label, value, sub, cls = '') => el('div', { class: 'stat ' + cls }, el('span', { class: 'slabel' }, label), el('b', {}, value), sub ? (typeof sub === 'string' ? el('small', { class: 'muted' }, sub) : sub) : '');
  const dlt = k.delta.leads == null ? el('small', { class: 'muted' }, 'sin periodo anterior') : el('small', { class: 'delta ' + (k.delta.leads >= 0 ? 'up' : 'down') }, `${k.delta.leads > 0 ? '▲ +' : k.delta.leads < 0 ? '▼ ' : ''}${k.delta.leads} % vs 30 días previos`);
  const steps = [['Leads', a.leads], ['Contactados', a.contactado], ['Con cita', a.cita], ['Asistieron', a.asistio], ['Clientes', a.ganado]];
  const funnel = el('div', { class: 'funnel' }, steps.map(([n, v], i) => el('div', { class: 'frow f' + i }, el('span', { class: 'fl' }, n), el('div', { class: 'bar' }, el('i', { style: `width:${a.leads ? Math.max(2, Math.round((v / a.leads) * 100)) : 0}%` })),
    el('span', { class: 'num' }, nf.format(v)), el('small', { class: 'muted' }, i && steps[i - 1][1] ? pc(Math.round((v / steps[i - 1][1]) * 1000) / 10) : ''))));
  const table = (title, rows) => el('section', { class: 'card rcard' }, el('h2', {}, title), rows.length ? el('div', { class: 'scroll' }, el('table', { class: 't' },
    el('thead', {}, el('tr', {}, ['', 'Leads', 'Citas', 'Clientes'].map((h) => el('th', { class: h ? 'r' : '' }, h)))),
    el('tbody', {}, rows.map((r) => el('tr', {}, el('td', { style: 'max-width:300px;overflow-wrap:anywhere' }, r.name), ...[r.leads, r.citas, r.ganados].map((v) => el('td', { class: 'r num' }, nf.format(v)))))))) : el('p', { class: 'muted', style: 'margin:0' }, 'Sin datos.'));
  const tips = [];
  if (clientId && k.mapeo === 'automatico') tips.push(['Las etapas se interpretan por su nombre. Para más precisión, indica cada una en ', 'negocio', 'Objetivos y datos para medir']);
  if (clientId && !k.valor_medio) tips.push(['Añade el valor medio de un cliente nuevo para calcular facturación y retorno: ', 'negocio', 'Objetivos y datos para medir']);
  return el('div', {},
    tips.map(([t, sec, l]) => el('p', { class: 'banner' }, t, el('a', { href: `#/c/${clientId}/${sec}` }, l), '.')),
    el('div', { class: 'stats' },
      tile('Leads (30 días)', nf.format(a.leads), dlt, 'c-leads'), tile('Contactados', pc(a.tasas.contacto), `${nf.format(a.contactado)} de ${nf.format(a.leads)}`, 'c-contact'), tile('Con cita', pc(a.tasas.cita), `${nf.format(a.cita)} leads`, 'c-cita'),
      tile('Asistencia', pc(a.tasas.asistencia), `${nf.format(a.noshow)} no asistieron`, 'c-asist'), tile('Cierre', pc(a.tasas.cierre), 'de los que asisten', 'c-cierre'), tile('De lead a cliente', pc(a.tasas.lead_a_cliente), `${nf.format(a.ganado)} clientes`, 'c-cliente'),
      k.sin_anuncio != null ? tile('Leads sin anuncio asignado', nf.format(k.sin_anuncio), 'de los últimos 30 días') : '',
      tile('Sin atender hace +24 h', nf.format(k.sin_atender), 'leads nuevos abiertos', k.sin_atender ? 'warnstat' : ''),
      k.facturado ? tile(k.facturado.estimado ? 'Facturación estimada' : 'Facturación', eur(k.facturado.eur), k.facturado.estimado ? `${nf.format(a.ganado)} clientes × valor medio` : 'según Funnels', 'c-money') : '',
      k.coste ? [tile('Coste por lead', eur(k.coste.cpl), 'inversión prevista', 'c-cost'), tile('Coste por cita', eur(k.coste.por_cita), 'inversión prevista', 'c-cost'), tile('Coste por cliente', eur(k.coste.por_cliente), 'inversión prevista', 'c-cost'), k.coste.roas != null ? tile('Retorno', `${String(k.coste.roas).replace('.', ',')}×`, 'facturación ÷ inversión', 'c-roas') : ''] : ''),
    k.coste ? el('p', { class: 'muted' }, k.coste.nota) : '',
    (k.objetivos || []).length ? el('section', { class: 'card rcard', style: 'margin-bottom:14px' }, el('h2', {}, 'Objetivos (últimos 30 días)'), k.objetivos.map((o) => el('div', { class: 'frow goal ' + (o.pct >= 100 ? 'g-ok' : o.pct >= 50 ? 'g-mid' : 'g-low') }, el('span', { class: 'fl' }, o.name), el('div', { class: 'bar' }, el('i', { style: `width:${Math.min(100, o.pct)}%` })), el('span', { class: 'num' }, `${nf.format(o.value)} / ${nf.format(o.goal)}`), el('small', { class: 'muted' }, `${o.pct} %`)))) : '',
    el('section', { class: 'card rcard', style: 'margin-bottom:14px' }, el('h2', {}, 'Embudo (leads de los últimos 30 días)'), funnel),
    el('div', { class: 'panelgrid' }, table('Campañas', k.campanas), table('Creativos', k.creativos), table('Fuentes', k.fuentes),
      el('section', { class: 'card rcard' }, el('h2', {}, 'Abiertas por etapa'), k.abiertas_por_etapa.length ? el('div', { class: 'plist' }, k.abiertas_por_etapa.slice(0, 12).map((e) => el('div', { class: 'prow' }, el('span', { class: 'grow' }, e.name), el('b', { class: 'num' }, nf.format(e.n))))) : el('p', { class: 'muted', style: 'margin:0' }, 'Sin oportunidades abiertas.'))));
}

export async function resultsTab(main, { clientId, me, funnelsLocation }) {
  const box = el('div'); main.append(box);
  const admin = me.role === 'super_admin' || me.role === 'admin';
  const st = await api('GET', `/api/clients/${clientId}/funnels`);

  const connect = () => {
    const token = el('input', { id: 'fn-t', name: 'token', type: 'password', autocomplete: 'off', spellcheck: false, placeholder: 'pit-…' });
    const loc = el('input', { id: 'fn-l', name: 'location', value: funnelsLocation || '', autocomplete: 'off', spellcheck: false, placeholder: 'ID de la subcuenta' });
    const err = el('div', { class: 'err', role: 'alert' });
    const send = async () => api('PUT', `/api/clients/${clientId}/funnels`, { token: token.value.trim(), location_id: loc.value.trim() });
    box.replaceChildren(el('form', { class: 'card', style: 'max-width:680px', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      try { try { await send(); } catch (er) { if (er.code === 'password_required' && await reauth()) await send(); else throw er; } toast('Conectado'); draw(); }
      catch (er) { err.textContent = er.message; }
    } },
    el('h2', { style: 'margin-top:0' }, 'Conectar con Avania Funnels'),
    el('p', { class: 'muted' }, 'Para medir leads, citas y ventas de este cliente Space lee su subcuenta de Avania Funnels, solo lectura. Hace falta un token propio de esa subcuenta, así nada de este cliente se mezcla con el de otro.'),
    el('ol', { class: 'steps-help' }, el('li', {}, 'En la subcuenta del cliente: Ajustes › Integración privada › Crear nueva integración.'),
      el('li', {}, 'Marca solo permisos de lectura: oportunidades, contactos y calendarios.'), el('li', {}, 'Copia el token y pégalo aquí. No se vuelve a mostrar.')),
    admin ? [el('label', { for: 'fn-l' }, 'ID de la subcuenta'), loc, el('label', { for: 'fn-t' }, 'Token'), token, err, el('button', { class: 'btn', style: 'margin-top:12px' }, 'Conectar y comprobar')]
      : el('p', { class: 'banner' }, 'Solo un administrador puede conectar la subcuenta.')));
  };

  async function draw(refresh = false) {
    const s = await api('GET', `/api/clients/${clientId}/funnels`);
    if (!s.connected) return connect();
    box.replaceChildren(el('p', { class: 'muted' }, 'Leyendo Avania Funnels…'));
    let r;
    try { r = await api('GET', `/api/clients/${clientId}/kpis${refresh ? '?refresh=1' : ''}`); }
    catch (e) { box.replaceChildren(el('div', { class: 'banner', role: 'alert' }, e.message), admin ? el('button', { class: 'btn ghost small', onclick: connect }, 'Cambiar el token') : ''); return; }
    box.replaceChildren(
      el('div', { class: 'row', style: 'margin-bottom:10px' }, el('span', { class: 'muted grow' }, `Actualizado ${fmtDate(r.kpis.generated_at, { dateStyle: 'short', timeStyle: 'short' })} · se refresca solo cada 15 minutos`),
        el('button', { class: 'btn ghost small', onclick: () => draw(true) }, 'Actualizar'), admin ? el('button', { class: 'btn ghost small', onclick: connect }, 'Cambiar el token') : '',
        admin ? el('button', { class: 'btn ghost small danger', onclick: async () => { if (!(await askConfirm({ title: 'Desconectar Avania Funnels', text: 'Se borra el token guardado. Los KPIs dejarán de verse hasta volver a conectar.', ok: 'Desconectar', danger: true }))) return; try { try { await api('DELETE', `/api/clients/${clientId}/funnels`); } catch (e) { if (e.code === 'password_required' && await reauth()) await api('DELETE', `/api/clients/${clientId}/funnels`); else throw e; } draw(); } catch (e) { toast(e.message); } } }, 'Desconectar') : ''),
      kpisNode(r.kpis, clientId));
  }
  await draw();
}


// Herramientas del pipeline en «Objetivos y datos para medir»: elegir el pipeline de la subcuenta y cargar todas sus etapas.
export async function pipelineTools(clientId, { pipelineId, onLoaded }) {
  const st = await api('GET', `/api/clients/${clientId}/funnels`);
  if (!st.connected) {
    return el('div', { class: 'banner' }, 'Conecta la subcuenta de este cliente en ', el('a', { href: `#/c/${clientId}/resultados` }, 'Resultados'), ' y el pipeline y sus etapas se leerán solos; mientras, puedes escribir el ID del pipeline a mano.');
  }
  let pipes = [];
  try { ({ pipelines: pipes } = await api('GET', `/api/clients/${clientId}/funnels/pipelines`)); } catch (e) { return el('div', { class: 'banner', role: 'alert' }, e.message); }
  const box = el('div', { class: 'card', style: 'margin-bottom:14px' });
  box.dataset.connected = '1';   // la ficha oculta entonces el campo de ID: ya no hace falta escribirlo
  const load = async (id, quiet = false) => {
    try { const r = await api('POST', `/api/clients/${clientId}/funnels/stages`, { pipeline_id: id }); toast(`${quiet ? 'Pipeline detectado: ' : ''}cargadas ${r.stages_loaded} etapas de «${r.pipeline}»`); onLoaded(); } catch (e) { toast(e.message); }
  };
  if (!pipes.length) { box.append(el('strong', {}, 'Etapas desde Avania Funnels'), el('p', { class: 'muted', style: 'margin:2px 0 0' }, 'Esta subcuenta no tiene ningún pipeline todavía.')); return box; }
  // Con un solo pipeline se elige solo; con varios, se elige de una lista (y se cargan sus etapas al instante).
  const known = pipes.find((p) => p.id === pipelineId);
  if (pipes.length === 1) {
    box.append(el('strong', {}, 'Pipeline de la subcuenta'), el('p', { class: 'muted', style: 'margin:2px 0 10px' }, `«${pipes[0].name}» (${pipes[0].stages} etapas), el único de la subcuenta: se usa automáticamente. Revisa abajo a qué paso del embudo equivale cada etapa.`),
      el('div', { class: 'row' }, el('button', { class: 'btn ghost small', onclick: () => load(pipes[0].id) }, 'Recargar etapas')));
    if (!known) load(pipes[0].id, true);
    return box;
  }
  const sel = el('select', { id: 'pl-sel', name: 'pipeline', 'aria-label': 'Pipeline de la subcuenta', onchange: () => sel.value && load(sel.value) },
    el('option', { value: '' }, 'Elige el pipeline principal…'), pipes.map((p) => el('option', { value: p.id, selected: p.id === pipelineId }, `${p.name} (${p.stages} etapas)`)));
  box.append(el('strong', {}, 'Pipeline principal'), el('p', { class: 'muted', style: 'margin:2px 0 10px' }, `Esta subcuenta tiene ${pipes.length} pipelines: elige el que usa la campaña y se cargan sus etapas al momento. Lo que ya hubieras indicado de cada etapa se conserva.`),
    el('div', { class: 'row' }, sel, known ? el('button', { class: 'btn ghost small', onclick: () => load(pipelineId) }, 'Recargar etapas') : ''));
  return box;
}

// ───────── Mapa y estudio sociodemográfico de la zona (La empresa → Área de influencia) ─────────
const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
let leafletReady = null;
const loadLeaflet = () => leafletReady || (leafletReady = new Promise((ok, ko) => {
  const css = el('link', { rel: 'stylesheet', href: LEAFLET + 'leaflet.min.css' }), js = el('script', { src: LEAFLET + 'leaflet.min.js' });
  js.onload = () => ok(window.L); js.onerror = () => { leafletReady = null; ko(new Error('No se pudo cargar el mapa')); };
  document.head.append(css, js);
}));
const nfz = (n, d = 0) => (n == null ? '—' : Number(n).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' }));
const COLS = [['Población', 'poblacion', 0], ['Edad media', 'edad_media', 1], ['< 18 años (%)', 'menores18', 1], ['≥ 65 años (%)', 'mayores65', 1], ['Personas por hogar', 'hogar', 1], ['Hogares de 1 persona (%)', 'unipersonales', 1], ['Renta neta por persona (€)', 'renta_persona', 0], ['Renta neta por hogar (€)', 'renta_hogar', 0], ['Población española (%)', 'espanola', 1]];

function zonaReading(z) {
  const t = z.total; if (!t) return null;
  const ok = z.places.filter((p) => p.data);
  const best = [...ok].sort((a, b) => b.data.renta_persona - a.data.renta_persona);
  const big = [...ok].sort((a, b) => b.data.poblacion - a.data.poblacion);
  const young = [...ok].sort((a, b) => a.data.edad_media - b.data.edad_media)[0];
  const out = [`En total, ${nfz(t.poblacion)} habitantes en ${t.municipios} municipio${t.municipios === 1 ? '' : 's'}; edad media ${nfz(t.edad_media, 1)} años y renta neta media de ${nfz(t.renta_persona)} € por persona (${nfz(t.renta_hogar)} € por hogar).`];
  if (ok.length > 1) {
    out.push(`El mayor mercado es ${big[0].data.nombre} (${nfz(big[0].data.poblacion)} habitantes, un ${nfz(big[0].data.poblacion / t.poblacion * 100)} % de la zona). La renta más alta es la de ${best[0].data.nombre} (${nfz(best[0].data.renta_persona)} €) y la más baja la de ${best[best.length - 1].data.nombre} (${nfz(best[best.length - 1].data.renta_persona)} €).`);
    out.push(`La población más joven está en ${young.data.nombre} (${nfz(young.data.edad_media, 1)} años de media, ${nfz(young.data.menores18, 1)} % de menores de 18).`);
  }
  if (t.mayores65 != null) out.push(`El ${nfz(t.mayores65, 1)} % de la zona tiene 65 años o más y el ${nfz(t.menores18, 1)} % es menor de 18; el hogar medio es de ${nfz(t.hogar, 1)} personas.`);
  return out;
}

export function zonaCard(main, clientId, { url = null, title = 'Mapa y estudio de la zona' } = {}) {
  const body = el('div'), card = el('section', { class: 'cgroup', style: 'margin-top:18px' }, el('h2', { style: 'margin:0 0 10px;font-size:18px' }, title), body);
  const run = async () => {
    body.replaceChildren(el('p', { class: 'muted' }, 'Situando las localidades y consultando los datos del INE… la primera vez tarda unos segundos.'));
    try {
      const [z, L] = await Promise.all([api('GET', url || `/api/clients/${clientId}/zona`), loadLeaflet()]);
      if (z.empty) return body.replaceChildren(el('p', { class: 'muted' }, 'Rellena la dirección y la ciudad en Datos, y las localidades aquí arriba, para ver el mapa.'));
      const map = el('div', { style: 'height:380px;border-radius:12px;overflow:hidden;border:1px solid var(--line, #ddd)' });
      const reading = zonaReading(z), found = z.places.filter((p) => p.found), missing = z.places.filter((p) => !p.found);
      const note = (p) => (!p.found ? 'No encontrada' : p.data ? '' : 'Sin dato municipal del INE');
      const head = ['Localidad', ...COLS.map((c) => c[0])];
      const rows = found.map((p) => [p.query + (p.data && p.data.nombre !== p.query ? ` (${p.data.nombre})` : ''), ...COLS.map(([, k, d]) => (p.data ? nfz(p.data[k], d) : note(p)))]);
      if (z.total) rows.push(['Total / media ponderada', ...COLS.map(([, k, d]) => nfz(z.total[k], d))]);
      body.replaceChildren(map,
        el('p', { class: 'muted', style: 'margin:8px 0' }, 'Chincheta azul con edificio: la empresa. Puntos verdes: localidades. El círculo es el radio de captación' + (z.radius_km ? ` (${z.radius_km} km).` : ' (sin radio indicado).') + ''),
        ...(z.center ? [el('p', { style: 'margin:0 0 8px;font-size:13px;' + (z.center.precision === 'portal' ? '' : 'color:#b45309') },
          !z.center.found ? 'No se ha podido situar la dirección de la empresa: revisa la dirección y la ciudad en Datos.'
          : z.center.precision === 'portal' ? `Chincheta en el portal exacto: ${z.center.label}.`
          : z.center.precision === 'calle' ? `La dirección se ha situado en la calle, no en el número exacto (${z.center.label}). Revisa que esté bien escrita en Datos.`
          : 'No se ha localizado la calle y el número: la chincheta de la empresa está en el centro de la ciudad. Revisa la dirección en Datos.')] : []),
        ...(missing.length ? [el('p', { class: 'muted' }, `No se han podido situar: ${missing.map((p) => p.query).join(', ')}. Revisa cómo están escritas.`)] : []),
        ...(z.skipped ? [el('p', { class: 'muted' }, `Solo se estudian las ${z.places.length} primeras localidades (${z.skipped} más sin estudiar).`)] : []),
        reading ? el('section', { class: 'card', style: 'margin:12px 0' }, el('h3', { style: 'margin:0 0 6px' }, 'Lectura de la zona'), ...reading.map((t) => el('p', { style: 'margin:4px 0' }, t))) : '',
        rows.length ? el('div', { class: 'card', style: 'overflow-x:auto;padding:6px 10px;border-radius:14px;background:#fff' }, el('table', { class: 't', style: 'min-width:720px' }, el('thead', {}, el('tr', {}, head.map((h) => el('th', {}, h)))), el('tbody', {}, rows.map((r, i) => el('tr', { style: z.total && i === rows.length - 1 ? 'font-weight:600' : '' }, r.map((c, j) => el('td', { style: j ? 'text-align:right' : '' }, c))))))) : '',
        el('p', { class: 'muted', style: 'margin-top:8px;font-size:12px' }, `Fuente: INE, Atlas de distribución de renta de los hogares${z.total ? ` (datos de ${Math.max(...z.places.filter((p) => p.data).map((p) => p.data.anyo))}, del municipio entero; un barrio o pedanía se muestra con los datos de su municipio)` : ''}. Mapa: © OpenStreetMap.`));
      const m = L.map(map, { scrollWheelZoom: false }), pts = [];
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap', referrerPolicy: 'origin' }).addTo(m);
      const pin = (p, color, label) => { const mk = L.circleMarker([p.lat, p.lon], { radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(m); mk.bindTooltip(label, { permanent: found.length <= 4, direction: 'top' }); pts.push([p.lat, p.lon]); };
      if (z.center?.found) {
        const svg = '<svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg"><path d="M20 51C20 51 3 31 3 19a17 17 0 0 1 34 0c0 12-17 32-17 32z" fill="#1d4ed8" stroke="#fff" stroke-width="2.500"/><g fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M12 28V14h10v14M22 19h6v9M9 28h22"/></g><path d="M15 17.500h4M15 21.500h4M15 25h4M24.500 22.500h1.500M24.500 25.500h1.500" stroke="#fff" stroke-width="1.700"/></svg>';
        const mk = L.marker([z.center.lat, z.center.lon], { icon: L.divIcon({ html: svg, className: '', iconSize: [40, 52], iconAnchor: [20, 51], tooltipAnchor: [0, -46] }), zIndexOffset: 1000 }).addTo(m);
        mk.bindTooltip('La empresa', { direction: 'top' }); pts.push([z.center.lat, z.center.lon]); if (z.radius_km) { const c = L.circle([z.center.lat, z.center.lon], { radius: z.radius_km * 1000, color: '#2563eb', weight: 1, fillOpacity: .06 }).addTo(m); pts.push(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [z.center.lat + a * z.radius_km / 111, z.center.lon + b * z.radius_km / 85])); } }
      found.forEach((p) => pin(p, '#1d9a8a', p.query));
      pts.length ? m.fitBounds(pts, { padding: [30, 30], maxZoom: 13 }) : m.setView([40.4, -3.7], 6);
      setTimeout(() => m.invalidateSize(), 50);
    } catch (e) { body.replaceChildren(el('p', { class: 'muted' }, e.message), el('button', { class: 'btn ghost small', onclick: run }, 'Reintentar')); }
  };
  run();
  main.append(card);
}
