// Definición del documento de onboarding de AVANIA Clinical.
// Tipos de campo: text, textarea, number, url, email, tel, date, select, tri (Sí/No/No lo sé),
// table (filas repetibles). `owner: 'team'` = solo lo edita el equipo; el cliente lo ve en lectura.
const TRI = ['Sí', 'No', 'No lo sé'];

export const FORM = [
  {
    key: 'proyecto', num: '0', title: 'Antes de empezar',
    intro: 'Ningún dato es obligatorio de entrada. Si no sabéis o no encontráis alguno, dejadlo en blanco y en la reunión de onboarding lo activamos nosotros. El montaje completo son 20 días naturales desde que confirmamos el pago; el contador se pausa si no recibimos los materiales o los accesos.',
    groups: [{
      title: 'Vuestro proyecto',
      fields: [
        { k: 'fecha_inicio', label: 'Fecha de inicio del proyecto', type: 'date', owner: 'team' },
        { k: 'responsable_cuenta', label: 'Responsable de cuenta en AVANIA', type: 'text', owner: 'team' },
        { k: 'enlace_clickup', label: 'Enlace a vuestro espacio de proyecto', type: 'url', owner: 'team' },
        { k: 'enlace_drive', label: 'Enlace a la carpeta compartida de Drive', type: 'url', owner: 'team' },
      ],
    }],
  },
  {
    key: 'clinica', num: '1', title: 'Vuestra clínica y vuestros contactos',
    groups: [
      { title: '1.1 Datos de la clínica', fields: [
        { k: 'nombre_comercial', label: 'Nombre comercial', hint: 'Tal y como queréis que aparezca en los anuncios', type: 'text' },
        { k: 'razon_social', label: 'Razón social', type: 'text' },
        { k: 'cif', label: 'CIF', type: 'text' },
        { k: 'direccion', label: 'Dirección completa', type: 'text' },
        { k: 'ciudad', label: 'Ciudad y provincia', type: 'text' },
        { k: 'telefono', label: 'Teléfono principal de la clínica', type: 'tel' },
        { k: 'web', label: 'Web', type: 'url' },
        { k: 'instagram', label: 'Instagram', type: 'text' },
        { k: 'facebook', label: 'Facebook', type: 'text' },
        { k: 'gabinetes', label: 'Número de gabinetes o sillones', type: 'number' },
        { k: 'profesionales', label: 'Número de profesionales en plantilla', type: 'number' },
      ] },
      { title: '1.2 Área de influencia', intro: 'Hasta dónde queréis atraer pacientes, para configurar la segmentación geográfica de los anuncios.', fields: [
        { k: 'radio', label: 'Radio de captación', hint: '¿Cuántos kilómetros alrededor de la clínica?', type: 'text' },
        { k: 'localidades', label: 'Localidades concretas', hint: 'Pueblos o barrios que os interesan especialmente', type: 'textarea' },
        { k: 'zonas_excluir', label: 'Zonas a excluir', hint: 'Zonas de las que NO queréis pacientes', type: 'textarea' },
      ] },
      { title: '1.3 Responsables del proyecto por vuestra parte', intro: 'Personas de vuestro equipo con las que nos comunicaremos durante el proyecto.', fields: [
        { k: 'responsables', label: 'Responsables', type: 'table', cols: [
          { k: 'nombre', label: 'Nombre' }, { k: 'cargo', label: 'Cargo' }, { k: 'correo', label: 'Correo' }, { k: 'telefono', label: 'Teléfono' },
        ] },
      ] },
    ],
  },
  {
    key: 'oferta', num: '2', title: 'Vuestra oferta y vuestro paciente ideal',
    intro: 'Este bloque es el más importante: de aquí salen los anuncios, los textos de la web de captación y los guiones de los vídeos. Dedicadle tiempo aunque las preguntas parezcan obvias.',
    groups: [
      { title: '2.1 Tratamiento que queréis potenciar', fields: [
        { k: 'tratamiento', label: 'Tratamiento principal', hint: 'El que queréis llenar de pacientes: implantología, ortodoncia, estética dental...', type: 'text' },
        { k: 'precio', label: 'Precio orientativo del tratamiento', hint: 'Nos ayuda a calcular cuántos pacientes necesitáis para rentabilizar la inversión', type: 'text' },
        { k: 'ticket', label: 'Ticket medio de la clínica', hint: 'Media de lo que gasta un paciente', type: 'text' },
        { k: 'secundarios', label: 'Tratamientos secundarios', hint: 'Por orden de prioridad', type: 'textarea' },
        { k: 'no_promocionar', label: 'Tratamientos que NO queréis promocionar', hint: 'Evitaremos atraer este tipo de paciente', type: 'textarea' },
      ] },
      { title: '2.2 Vuestro paciente ideal', fields: [
        { k: 'edad', label: 'Edad aproximada', type: 'text' },
        { k: 'perfil', label: 'Perfil', hint: 'Hombre, mujer, ambos. Situación laboral o familiar si es relevante', type: 'textarea' },
        { k: 'preocupa', label: 'Qué le preocupa', hint: '¿Qué problema real le lleva a buscar este tratamiento?', type: 'textarea' },
        { k: 'frena', label: 'Qué le frena', hint: 'Miedo, precio, tiempo, desconfianza...', type: 'textarea' },
        { k: 'objeciones', label: 'Qué objeciones os ponen', hint: 'Las frases que más oís cuando se lo explicáis en consulta', type: 'textarea' },
        { k: 'por_que_eligen', label: 'Por qué os eligen a vosotros', hint: 'Lo que os dicen los pacientes que ya han pasado por la clínica', type: 'textarea' },
      ] },
      { title: '2.3 Vuestras ventajas diferenciales', fields: [
        { k: 'diferentes', label: 'Qué os hace diferentes', hint: 'Tecnología, experiencia, financiación, garantía, trato...', type: 'textarea' },
        { k: 'anos', label: 'Años de experiencia', type: 'text' },
        { k: 'certificaciones', label: 'Certificaciones o acreditaciones', type: 'textarea' },
        { k: 'financiacion', label: 'Financiación', hint: '¿Ofrecéis financiación? ¿En cuántos meses? ¿Con qué entidad?', type: 'textarea' },
        { k: 'primera_visita', label: 'Primera visita', hint: '¿Es gratuita? ¿Incluye radiografía o estudio?', type: 'textarea' },
        { k: 'garantia', label: 'Garantía', hint: '¿Ofrecéis alguna garantía sobre el tratamiento?', type: 'textarea' },
      ] },
      { title: '2.4 Vuestra competencia local', intro: 'Las clínicas que más os afectan. Nosotros ya hemos hecho un pequeño estudio y queremos ampliarlo.', fields: [
        { k: 'competencia', label: 'Competidores', type: 'table', cols: [
          { k: 'clinica', label: 'Clínica competidora' }, { k: 'web', label: 'Web o Instagram' }, { k: 'notas', label: 'Qué hacen bien / qué os preocupa' },
        ] },
      ] },
    ],
  },
  {
    key: 'agenda', num: '3', title: 'Agenda y equipo de atención',
    intro: 'Antes de llegar a vosotros, nuestro equipo ya ha hablado con cada paciente potencial y ha confirmado su interés. Vuestra parte es llamarle para darle hora, como máximo en 24 horas laborables, porque el interés se enfría en uno o dos días. Necesitamos saber quién lo va a hacer y cuándo.',
    groups: [
      { title: '3.1 Quién atiende a los pacientes potenciales', intro: 'Recibirán aviso en cuanto os pasemos uno.', fields: [
        { k: 'atienden', label: 'Personas', type: 'table', cols: [
          { k: 'nombre', label: 'Nombre' }, { k: 'cargo', label: 'Cargo' }, { k: 'whatsapp', label: 'WhatsApp' }, { k: 'horario', label: 'Horario de disponibilidad' },
        ] },
      ] },
      { title: '3.2 Horarios de la clínica', fields: [
        { k: 'h_manana', label: 'Horario de mañana', hint: 'Días y franja horaria', type: 'text' },
        { k: 'h_tarde', label: 'Horario de tarde', hint: 'Días y franja horaria', type: 'text' },
        { k: 'sabados', label: '¿Abrís sábados?', hint: 'Si es así, indicad horario', type: 'text' },
        { k: 'cierres', label: 'Días de cierre', hint: 'Vacaciones, festivos locales, cierres previstos', type: 'textarea' },
      ] },
      { title: '3.3 Vuestra agenda de primeras visitas', intro: 'AVANIA no gestiona vuestra agenda. Vosotros dais las citas porque solo vosotros conocéis vuestros huecos reales.', fields: [
        { k: 'huecos', label: 'Huecos de primera visita al día', hint: '¿Cuántas primeras visitas nuevas podéis asumir al día?', type: 'text' },
        { k: 'duracion', label: 'Duración de una primera visita', type: 'text' },
        { k: 'antelacion', label: 'Antelación mínima para dar cita', hint: '¿Con cuánto tiempo necesitáis avisar?', type: 'text' },
        { k: 'software_citas', label: 'Software de gestión de citas', hint: 'Gesden, Odontonet, Clinic Cloud, agenda propia...', type: 'text' },
      ] },
    ],
  },
  {
    key: 'rodaje', num: '4', title: 'Rodaje de vídeos',
    intro: 'El contrato incluye media jornada de rodaje en la clínica con un equipo profesional, de la que salen entre 15 y 20 vídeos. El paciente quiere ver la cara del doctor antes de pedir cita.',
    groups: [
      { title: '4.1 Quién graba', fields: [
        { k: 'doctor', label: 'Doctor o doctora que grabará', type: 'text' },
        { k: 'cargo_doctor', label: 'Cargo y especialidad', type: 'text' },
        { k: 'ha_grabado', label: '¿Ha grabado vídeo antes?', hint: 'Si no, no hay problema: le preparamos antes del rodaje', type: 'tri' },
        { k: 'otros', label: '¿Grabará alguien más?', hint: 'Higienista, coordinadora, otro profesional', type: 'text' },
      ] },
      { title: '4.2 Cuándo y dónde', fields: [
        { k: 'fechas_rodaje', label: 'Fechas posibles para el rodaje', hint: 'Dos o tres opciones de media jornada', type: 'textarea' },
        { k: 'franja', label: 'Franja preferida', type: 'select', options: ['Mañana', 'Tarde'] },
        { k: 'sala', label: 'Sala disponible para grabar', hint: 'Gabinete, sala de espera, despacho...', type: 'text' },
        { k: 'ruido', label: '¿Hay ruido o interferencias previsibles?', hint: 'Obras cercanas, aparatos, tránsito de pacientes', type: 'text' },
      ] },
      { title: '4.3 Temas que queréis tratar', intro: 'Las preguntas que más os hacen los pacientes en consulta. Cada una puede ser un vídeo.', fields: [
        { k: 'temas', label: 'Temas', type: 'table', cols: [{ k: 'tema', label: 'Pregunta o tema' }, { k: 'porque', label: 'Por qué es importante para vuestros pacientes' }] },
      ] },
    ],
  },
  {
    key: 'accesos', num: '5', title: 'Accesos técnicos',
    intro: 'Algunos accesos no los conoceréis de primera mano. No pasa nada: dadnos el contacto de quien lleva vuestra web o vuestro marketing y lo hablamos con esa persona. Las contraseñas, si hacen falta, van en la pestaña Credenciales.',
    groups: [
      { title: '5.1 Web, dominio y hosting', intro: 'Si tenéis WordPress: dad de alta como administrador a marketing@avania.es. Con eso nos basta.', fields: [
        { k: 'dominio', label: 'Dominio principal', type: 'text' },
        { k: 'hosting', label: 'Proveedor de hosting', type: 'text' },
        { k: 'cms', label: 'Gestor de contenidos', hint: 'WordPress, Wix, Squarespace, desarrollo a medida...', type: 'text' },
        { k: 'resp_web', label: 'Responsable de la web', hint: 'Empresa o persona que la mantiene', type: 'text' },
        { k: 'resp_web_contacto', label: 'Correo y teléfono de esa persona', type: 'text' },
      ] },
      { title: '5.2 Píxel de seguimiento', intro: 'Sin este código instalado no podemos lanzar la campaña. Es lo primero que revisamos.', fields: [
        { k: 'pixel', label: '¿Tenéis ya píxel de Meta instalado?', type: 'tri' },
        { k: 'privacidad', label: '¿Tenéis política de privacidad publicada?', hint: 'Necesitamos el enlace exacto', type: 'text' },
        { k: 'cookies', label: '¿Tenéis banner de cookies?', type: 'tri' },
      ] },
      { title: '5.3 Google', intro: 'Dad acceso de administrador a marketing@avania.es en Google Analytics, Google Tag Manager y Google My Business (como gestor).', fields: [
        { k: 'google_alta', label: '¿Los tenéis dados de alta?', type: 'tri' },
        { k: 'google_quien', label: 'Si no, ¿quién los gestiona?', type: 'text' },
      ] },
    ],
  },
  {
    key: 'meta', num: '6', title: 'Meta y redes sociales',
    groups: [
      { title: '6.1 Business Manager de Meta', intro: 'Es el acceso más importante: sin él no podemos crear ni gestionar vuestros anuncios. Nunca os pediremos vuestra contraseña de Facebook ni de Instagram: el acceso se concede como socio desde vuestro Business Manager y podéis retirarlo cuando queráis. Cómo: Configuración del negocio → Socios → Añadir → Dar acceso a un socio. Nuestro identificador es 7853166714786634.', fields: [
        { k: 'bm_creado', label: '¿Tenéis Business Manager creado?', type: 'tri' },
        { k: 'bm_id', label: 'ID de vuestro Business Manager', hint: 'Si ya lo tenéis', type: 'text' },
        { k: 'bm_acceso', label: '¿Habéis concedido ya el acceso?', type: 'select', options: ['Sí', 'No'] },
      ] },
      { title: '6.2 Cuenta publicitaria e inversión', intro: 'La inversión en publicidad la pagáis vosotros directamente a Meta. AVANIA la gestiona, pero nunca cobra ni adelanta ese dinero.', fields: [
        { k: 'cuenta_pub', label: '¿Tenéis cuenta publicitaria activa?', type: 'tri' },
        { k: 'metodo_pago', label: 'Método de pago dado de alta en Meta', hint: 'Tarjeta, domiciliación...', type: 'text' },
        { k: 'presupuesto', label: 'Presupuesto mensual previsto para anuncios', hint: 'Una idea inicial; lo hablaremos juntos', type: 'text' },
        { k: 'campanas_previas', label: '¿Habéis hecho campañas antes?', hint: 'Contadnos brevemente qué tal fue', type: 'textarea' },
      ] },
      { title: '6.3 Páginas y perfiles', fields: [
        { k: 'pagina_fb', label: 'Página de Facebook', hint: 'Enlace', type: 'url' },
        { k: 'perfil_ig', label: 'Perfil de Instagram', hint: 'Usuario', type: 'text' },
        { k: 'ig_profesional', label: '¿La cuenta de Instagram es profesional?', type: 'tri' },
        { k: 'ig_vinculado', label: '¿Instagram está vinculado a la página de Facebook?', type: 'tri' },
      ] },
    ],
  },
  {
    key: 'whatsapp', num: '7', title: 'WhatsApp y comunicación',
    groups: [
      { title: '7.1 Número de WhatsApp para pacientes', intro: 'Los pacientes potenciales reciben mensajes automáticos por WhatsApp. Recomendamos un número dedicado, separado del teléfono de la clínica. Si preferís que os lo gestionemos, lo contratamos nosotros con la tarifa mínima (unos 2,50 €/mes a vuestro cargo) y os lo facturamos aparte.', fields: [
        { k: 'wa_business', label: '¿Tenéis WhatsApp Business?', type: 'select', options: ['Sí', 'No'] },
        { k: 'wa_numero', label: 'Número actual', hint: 'Si ya tenéis uno para pacientes', type: 'tel' },
        { k: 'wa_nuevo', label: '¿Preferís que os gestionemos un número nuevo?', type: 'select', options: ['Sí', 'No'] },
      ] },
      { title: '7.2 Grupo de WhatsApp del proyecto', intro: 'Crearemos un grupo con vuestro equipo y el nuestro para el día a día y los avisos de pacientes.', fields: [
        { k: 'grupo1', label: 'Teléfono 1 para el grupo', type: 'tel' },
        { k: 'grupo2', label: 'Teléfono 2 para el grupo', type: 'tel' },
        { k: 'grupo3', label: 'Teléfono 3 para el grupo', type: 'tel' },
      ] },
    ],
  },
  {
    key: 'materiales', num: '8', title: 'Materiales gráficos',
    intro: 'Subid todo a la carpeta de Drive que os hemos compartido: logo (PNG o SVG con fondo transparente), mínimo 10 fotos de la clínica, fotos del equipo, antes y después (si disponéis), colores corporativos y vídeos existentes. Sobre las fotos de antes y después: consultad el consentimiento firmado de los pacientes; no publicamos ninguna imagen sin vuestra confirmación.',
    groups: [{ title: 'Estado de los materiales', fields: [
      { k: 'subidos', label: '¿Habéis subido ya los materiales?', type: 'select', options: ['Sí', 'Parcialmente', 'Todavía no'] },
      { k: 'colores', label: 'Colores corporativos', hint: 'Códigos de color si los tenéis', type: 'text' },
      { k: 'faltan', label: 'Si falta algo, ¿para cuándo lo tendréis?', type: 'text' },
    ] }],
  },
  {
    key: 'fechas', num: '9', title: 'Fechas señaladas',
    intro: 'Fechas en las que queráis hacer un esfuerzo especial de comunicación: aniversario de la clínica, llegada de un equipo nuevo, incorporación de un especialista, campañas de temporada...',
    groups: [{ title: 'Calendario', fields: [
      { k: 'fechas', label: 'Fechas', type: 'table', cols: [{ k: 'fecha', label: 'Fecha' }, { k: 'motivo', label: 'Motivo' }, { k: 'comunicar', label: 'Qué queréis comunicar' }] },
    ] }],
  },
  {
    key: 'formacion', num: '10', title: 'Formación de vuestro equipo · CLOSE CARE',
    intro: 'Antes de lanzar la campaña haremos una sesión de formación de dos horas con las personas que vayan a atender a los pacientes. Es obligatoria: sin ella no activamos la campaña.',
    groups: [{ title: 'Sesión de formación', fields: [
      { k: 'asistentes', label: 'Quién asistirá', hint: 'Nombres y cargos. Deben venir todos los que vayan a atender pacientes', type: 'textarea' },
      { k: 'fechas_formacion', label: 'Fechas y horas posibles', hint: 'Dos o tres opciones', type: 'textarea' },
    ] }],
  },
  {
    key: 'cierre', num: '11-12', title: 'Confidencialidad y revisión final',
    intro: 'Todos los accesos y datos se tratan con absoluta confidencialidad y se usan únicamente para la ejecución de vuestro proyecto. Los datos de vuestros pacientes son datos de salud, con protección reforzada por el RGPD: actuamos como encargados del tratamiento. Podéis retirar cualquier acceso cuando queráis.',
    groups: [{ title: 'Antes de devolvernos el documento', fields: [
      { k: 'ok_clinica', label: 'Datos de la clínica completos (bloque 1)', type: 'check' },
      { k: 'ok_oferta', label: 'Tratamiento a potenciar y perfil de paciente definidos (bloque 2)', type: 'check' },
      { k: 'ok_atencion', label: 'Personas que atenderán a los pacientes, con teléfono y horario (bloque 3)', type: 'check' },
      { k: 'ok_rodaje', label: 'Fechas propuestas para el rodaje de vídeos (bloque 4)', type: 'check' },
      { k: 'ok_google', label: 'Acceso concedido a marketing@avania.es en Google (bloque 5)', type: 'check' },
      { k: 'ok_meta', label: 'Acceso de socio concedido en el Business Manager de Meta (bloque 6)', type: 'check' },
      { k: 'ok_whatsapp', label: 'Decisión sobre el número de WhatsApp (bloque 7)', type: 'check' },
      { k: 'ok_materiales', label: 'Logo y mínimo 10 fotos subidas a la carpeta de Drive (bloque 8)', type: 'check' },
      { k: 'ok_formacion', label: 'Asistentes y fechas para la formación (bloque 10)', type: 'check' },
    ] }],
  },
];

export const SERVICES = [
  'Hosting', 'Web / CMS', 'Dominio', 'Meta Business Manager', 'Facebook', 'Instagram',
  'WhatsApp Business', 'Google Analytics', 'Google Tag Manager', 'Google My Business', 'Software de citas',
];
// Filas que se le sugieren al cliente en la pestaña de credenciales.
export const SUGGESTED = ['Hosting', 'Web / CMS', 'Meta Business Manager', 'Instagram', 'WhatsApp Business'];

const fieldsOf = (s) => s.groups.flatMap((g) => g.fields);

export function isFilled(f, v) {
  if (f.type === 'table') return Array.isArray(v) && v.some((r) => Object.values(r || {}).some((x) => String(x || '').trim()));
  if (f.type === 'check') return v === true;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

// Progreso por sección (campos del cliente; los del equipo no cuentan).
export function progress(sections) {
  const out = {};
  let done = 0, total = 0;
  for (const s of FORM) {
    const fs = fieldsOf(s).filter((f) => f.owner !== 'team');
    if (!fs.length) continue;
    const data = sections[s.key] || {};
    const d = fs.filter((f) => isFilled(f, data[f.k])).length;
    out[s.key] = { done: d, total: fs.length };
    done += d; total += fs.length;
  }
  return { sections: out, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function sanitizeSection(key, input, { team }) {
  const s = FORM.find((x) => x.key === key);
  if (!s) return null;
  const out = {};
  for (const f of fieldsOf(s)) {
    if (f.owner === 'team' && !team) continue;
    if (!(f.k in input)) continue;
    const v = input[f.k];
    if (f.type === 'table') {
      const cols = f.cols.map((c) => c.k);
      out[f.k] = (Array.isArray(v) ? v : []).slice(0, 50).map((r) =>
        Object.fromEntries(cols.map((c) => [c, String((r || {})[c] ?? '').slice(0, 2000)])));
    } else if (f.type === 'check') out[f.k] = v === true;
    else out[f.k] = String(v ?? '').slice(0, 5000);
  }
  return out;
}
