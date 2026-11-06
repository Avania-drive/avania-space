// Definición del documento de onboarding.
// Tipos de campo: text, textarea, number, url, email, tel, date, select, tri (Sí/No/No lo sé),
// table (filas repetibles; cada columna puede ser type 'date' o 'select' con options), docs (enlaces a documentos de Drive con vista previa).
// `owner: 'team'` = solo lo edita el equipo y el cliente no lo ve; con `shared: true` el cliente lo ve en solo lectura; con `clientEdit: true`
// el cliente también lo ve y lo edita (sigue contando en el avance de AVANIA, no en el suyo).
// `optional: true` = no cuenta para el avance (listas libres, como las acciones del cronograma).
const TRI = ['Sí', 'No', 'No lo sé'];
const ACCION_COLS = [
  { k: 'accion', label: 'Acción' }, { k: 'fecha', label: 'Fecha', type: 'date' },
  { k: 'prioridad', label: 'Prioridad', type: 'select', options: ['Alta', 'Media', 'Baja'] },
  { k: 'estado', label: 'Estado', type: 'select', options: ['Pendiente', 'En curso', 'Hecha'] },
];

export const FORM = [
  {
    key: 'proyecto', num: '0', title: 'Proyecto y enlaces de AVANIA',
    intro: 'Ningún dato es obligatorio de entrada. Si no sabéis o no encontráis alguno, dejadlo en blanco y en la reunión de onboarding lo activamos nosotros. El montaje completo son 20 días laborables desde que arrancamos el proyecto; el contador se pausa si no recibimos los materiales o los accesos.',
    groups: [{
      title: 'Vuestro proyecto',
      fields: [
        { k: 'categoria', label: 'Categoría del cliente', hint: 'Dental, industrial, seguros… Elige una o crea otra; el color es el de su etiqueta.', type: 'categoria', owner: 'team' },
        { k: 'fecha_firma', label: 'Firma del contrato', type: 'date', owner: 'team', clientEdit: true, optional: true },
        { k: 'fecha_inicio', label: 'Inicio real del proyecto', type: 'date', owner: 'team', clientEdit: true },
        { k: 'fecha_montaje', label: 'Objetivo de montaje completo', type: 'date', owner: 'team', clientEdit: true, optional: true },
        { k: 'responsable_cuenta', label: 'Responsable de cuenta en AVANIA', type: 'text', owner: 'team', clientEdit: true },
        { k: 'enlace_clickup', label: 'Espacio del proyecto en ClickUp', type: 'url', app: 'clickup', owner: 'team', clientEdit: true },
        { k: 'enlace_drive', label: 'Carpeta compartida en Google Drive', type: 'url', app: 'drive', owner: 'team' },
        { k: 'funnels_location', label: 'ID de la subcuenta de Avania Funnels', hint: 'En la subcuenta de Avania Funnels: Ajustes › Información del negocio › ID de la ubicación. Con él Space enlaza directo a su subcuenta.', type: 'text', owner: 'team' },
      ],
    }],
  },
  {
    key: 'clinica', num: '1', title: 'La empresa y quién la forma',
    groups: [
      { title: '1.1 Datos de la empresa', fields: [
        { k: 'nombre_comercial', label: 'Nombre comercial', hint: 'Como queréis que salga en los anuncios', type: 'text' },
        { k: 'razon_social', label: 'Razón social', type: 'text' },
        { k: 'cif', label: 'CIF', type: 'text' },
        { k: 'direccion', label: 'Dirección completa', type: 'text' },
        { k: 'ciudad', label: 'Ciudad y provincia', type: 'text' },
        { k: 'telefono', label: 'Teléfono principal de la empresa', type: 'tel' },
        { k: 'web', label: 'Web', type: 'url' },
        { k: 'instagram', label: 'Instagram', type: 'text' },
        { k: 'facebook', label: 'Facebook', type: 'text' },
        { k: 'fecha_apertura', label: 'Fecha de apertura de la empresa', type: 'date' },
        { k: 'gabinetes', label: 'Número de gabinetes o sillones', type: 'number', dental: true },
        { k: 'profesionales', label: 'Número de profesionales en plantilla', type: 'number' },
        { k: 'descripcion', label: '¿Quiénes sois?', hint: 'Vuestra historia en pocas líneas y lo que os hace especiales. Lo usamos para escribir los anuncios con vuestra voz.', type: 'textarea' },
      ] },
      { title: '1.3 Quién forma la empresa y a quién llamamos', intro: 'Las personas de vuestro equipo con las que nos comunicaremos durante el proyecto, con su teléfono y WhatsApp directos.', fields: [
        { k: 'responsables', label: 'Equipo', hint: 'Las personas con las que hablamos durante el proyecto. Si solo hay una, déjala sola; con «+ Añadir fila» sumas más y con ✕ quitas las que sobren.', type: 'table', cols: [
          { k: 'nombre', label: 'Nombre' }, { k: 'cargo', label: 'Papel que desempeña' }, { k: 'correo', label: 'Correo' }, { k: 'telefono', label: 'Teléfono' }, { k: 'whatsapp', label: 'WhatsApp' },
        ] },
        { k: 'plantilla', label: 'Resto de la plantilla', hint: 'Opcional: el resto de personas que forman la empresa y a qué se dedica cada una', type: 'table', optional: true, cols: [{ k: 'nombre', label: 'Nombre' }, { k: 'puesto', label: 'Puesto' }, { k: 'area', label: 'Área o especialidad' }] },
      ] },
      { title: '1.4 Teléfonos, WhatsApp y correos', intro: 'Los números y correos generales de la empresa, cada uno con su etiqueta (recepción, administración, urgencias…).', fields: [
        { k: 'telefonos', label: 'Teléfonos', type: 'table', cols: [{ k: 'etiqueta', label: 'Etiqueta' }, { k: 'numero', label: 'Número' }, { k: 'horario', label: 'Horario de atención' }] },
        { k: 'whatsapps', label: 'WhatsApp', type: 'table', cols: [{ k: 'etiqueta', label: 'Etiqueta' }, { k: 'numero', label: 'Número' }, { k: 'horario', label: 'Horario de atención' }] },
        { k: 'correos', label: 'Correos generales', type: 'table', cols: [{ k: 'etiqueta', label: 'Etiqueta' }, { k: 'correo', label: 'Correo' }] },
        { k: 'fuera_horario', label: '¿Qué pasa si escriben o llaman cuando nadie atiende?', hint: 'Por ejemplo, si un cliente escribe por la tarde y nadie contesta hasta el día siguiente. Contadnos quién responde y cuándo.', type: 'textarea' },
      ] },
      { title: '1.5 Tratamientos, precios y primera visita', intro: 'Lo que ofrecéis y lo que cuesta, para que el setter y los anuncios hablen con datos reales. Si no tenéis precios exactos, dadnos rangos.', fields: [
        { k: 'tratamientos', label: 'Tratamientos y precios', hint: 'Qué ofrecéis y cuánto cuesta cada uno. Por ejemplo, en ortodoncia: invisible (Invisalign u otra marca), brackets metálicos, estéticos o linguales, ortodoncia infantil o interceptiva y retenedores.', type: 'table', dental: true, cols: [{ k: 'tratamiento', label: 'Tratamiento' }, { k: 'precio', label: 'Precio o rango' }, { k: 'notas', label: 'Notas' }] },
        { k: 'financiacion', label: '¿Ofrecéis pago a plazos o cuota mensual?', hint: 'En ortodoncia suele ser lo que decide la compra', type: 'select', options: ['Sí', 'No', 'Solo en algunos tratamientos'], dental: true },
        { k: 'financiacion_detalle', label: 'Condiciones de la financiación', hint: 'Cuota aproximada, plazos, financiera, entrada…', type: 'textarea', dental: true, optional: true },
        { k: 'primera_visita', label: 'La primera visita, ¿es gratuita o de pago?', type: 'select', options: ['Gratuita', 'De pago', 'Depende'], dental: true },
        { k: 'primera_incluye', label: '¿Qué incluye la primera visita?', hint: 'Precio si es de pago; si incluye escáner 3D, simulación del resultado, radiografía, presupuesto…', type: 'textarea', dental: true },
        { k: 'referentes', label: 'Pruebas de que sois referentes', hint: 'Número de casos tratados, nivel de proveedor Invisalign, máster o título de especialista de quien atiende, número de reseñas y nota en Google…', type: 'textarea', dental: true },
      ] },
    ],
  },
  {
    key: 'negocio', num: '2', title: 'Objetivos y datos para medir', owner: 'team',
    intro: 'Lo que acordamos para medir si la campaña funciona: cuánto vale un cliente nuevo y qué objetivos se persiguen cada mes. Con estos datos calculamos el coste por cita, por cliente y el retorno, no solo los leads. Lo rellena y lo ve solo el equipo de AVANIA: el cliente no tiene acceso a esta sección.',
    groups: [
      { title: '0.0 Qué vale un cliente nuevo', fields: [
        { k: 'valor_medio', label: 'Valor medio de un cliente nuevo (€)', hint: 'Lo que factura de media un cliente nuevo: tratamiento, póliza, pedido, matrícula… Es la base para calcular el retorno de la inversión.', type: 'number', owner: 'team' },
        { k: 'tasa_cierre', label: 'Tasa de cierre habitual (%)', hint: 'De cada 100 personas atendidas, cuántas terminan comprando.', type: 'number', owner: 'team' },
        { k: 'ciclo_venta', label: 'Ciclo de venta (días)', hint: 'Desde el primer contacto hasta que compra. Suele ser corto en clínica y largo en industrial.', type: 'number', owner: 'team' },
        { k: 'margen', label: 'Margen aproximado (%)', hint: 'Opcional. Permite hablar de beneficio y no solo de facturación.', type: 'number', owner: 'team' },
      ] },
      { title: '0.0 Objetivos mensuales', fields: [
        { k: 'objetivo_leads', label: 'Leads cualificados al mes', type: 'number', owner: 'team' },
        { k: 'objetivo_citas', label: 'Citas o reuniones al mes', type: 'number', owner: 'team' },
        { k: 'objetivo_ventas', label: 'Clientes nuevos al mes', type: 'number', owner: 'team' },
        { k: 'cpl_objetivo', label: 'Coste máximo por lead (€)', hint: 'Por encima de este importe la campaña se revisa. La inversión mensual está en Meta › Cuenta publicitaria.', type: 'number', owner: 'team' },
        { k: 'respuesta_max', label: 'Tiempo máximo para atender un lead (minutos)', hint: 'Referencia: un lead atendido en menos de 5 minutos convierte varias veces más que a las 24 horas.', type: 'number', owner: 'team' },
        { k: 'fuentes', label: 'Fuentes de captación activas', hint: 'Meta, Google, orgánico, referidos, ferias…', type: 'text', owner: 'team' },
      ] },
      { title: '0.0 Cómo se mide en Avania Funnels', intro: 'Cada cliente tiene su propio pipeline. Para poder comparar y calcular tasas, indica a qué paso del embudo equivale cada etapa: Nuevo lead, Contactado, Cita agendada, Asistió, Ganado o Perdido.', fields: [
        { k: 'pipeline_id', label: 'ID del pipeline principal', hint: 'En Funnels: Oportunidades › Pipelines. Solo el que usa la campaña.', type: 'text', owner: 'team' },
        { k: 'etapas', label: 'Etapas del pipeline', type: 'table', cols: [{ k: 'etapa', label: 'Etapa en Avania Funnels' }, { k: 'paso', label: 'Equivale a (Nuevo lead · Contactado · Cita agendada · Asistió · Ganado · Perdido)' }], owner: 'team' },
      ] },
    ],
  },
  {
    key: 'oferta', num: '2', title: 'Nuestros análisis: avatar, competencia y oferta', owner: 'team', tabs: true,
    intro: 'Estos análisis los generamos nosotros a partir de lo que cuenta el cliente en «Sus clientes, competencia y ofertas». Tres pestañas (avatares, competencia y ofertas): en cada una, las conclusiones y una ficha por documento de Google Drive, con su resumen. Al pulsar «Ver» aparece una vista previa a la derecha. El cliente lo ve en solo lectura.',
    groups: [
      { title: 'Avatares', tab: 'Avatares', intro: 'Un archivo de Google Drive por avatar (el cliente ideal). Pega el enlace, y escribe el resumen de lo que dice el análisis.', fields: [{ k: 'avatar_resumen', label: 'Conclusiones del avatar', hint: 'A quién nos dirigimos: quién es, qué le preocupa y qué le hace decidir', concl: 'avatar', type: 'textarea', owner: 'team' }, { k: 'avatares', label: 'Avatares', type: 'fichas', item: 'avatar', ai: 'avatar', max: 12, owner: 'team' }] },
      { title: 'Competencia', tab: 'Competencia', intro: 'Un archivo de Google Drive por análisis de la competencia, con su resumen.', fields: [{ k: 'competencia_resumen', label: 'Conclusiones sobre la competencia', hint: 'Qué hace la competencia, dónde es fuerte y dónde nos podemos diferenciar', concl: 'competencia', type: 'textarea', owner: 'team' }, { k: 'competencia_fichas', label: 'Análisis de la competencia', type: 'fichas', item: 'análisis', ai: 'competencia', max: 12, owner: 'team' }] },
      { title: 'Ofertas', tab: 'Ofertas', intro: 'Un archivo de Google Drive por oferta, con su resumen.', fields: [{ k: 'oferta_resumen', label: 'Conclusiones sobre la oferta', hint: 'La oferta que vamos a comunicar y por qué funciona', concl: 'oferta', type: 'textarea', owner: 'team' }, { k: 'oferta_fichas', label: 'Ofertas', type: 'fichas', item: 'oferta', ai: 'oferta', max: 12, owner: 'team' }] },
    ],
  },
  {
    key: 'mercado', num: '2', title: 'Sus clientes, competencia y ofertas',
    intro: 'Cuanto mejor conozcamos a vuestros clientes, a vuestra competencia y lo que ofrecéis, mejores serán los anuncios y los mensajes. Contadlo con vuestras palabras: no hace falta que sea perfecto, nosotros lo ordenamos y lo completamos con nuestro análisis.',
    groups: [
      { title: '0.0 Vuestros clientes', intro: 'Los tipos de cliente que tenéis hoy y los que os gustaría tener.', fields: [
        { k: 'clientes_tipo', label: 'Tipos de cliente', type: 'table', cols: [{ k: 'tipo', label: 'Tipo de cliente' }, { k: 'quien', label: 'Quién es (edad, zona, situación)' }, { k: 'busca', label: 'Qué busca' }, { k: 'gasto', label: 'Lo que suele gastar' }] },
        { k: 'clientes_origen', label: '¿Cómo llegan hoy los clientes?', hint: 'Boca a boca, Google, redes sociales, derivaciones, publicidad…', type: 'textarea' },
        { k: 'clientes_mejores', label: '¿Qué clientes os gustaría tener más?', type: 'textarea' },
        { k: 'clientes_no', label: '¿Qué clientes NO queréis?', hint: 'Para no atraerlos con los anuncios', type: 'textarea' },
      ] },
      { title: '0.0 Competencia', intro: 'Las empresas con las que os comparan vuestros clientes.', fields: [
        { k: 'competidores', label: 'Competidores principales', type: 'table', cols: [{ k: 'nombre', label: 'Nombre' }, { k: 'web', label: 'Web o redes' }, { k: 'zona', label: 'Zona' }, { k: 'mejor', label: 'Qué hacen mejor que vosotros' }, { k: 'peor', label: 'Qué hacéis mejor vosotros' }] },
      ] },
      { title: '0.0 Ofertas y servicios', intro: 'Lo que vendéis y las ofertas que queréis comunicar.', fields: [
        { k: 'ofertas', label: 'Ofertas y servicios', type: 'table', cols: [{ k: 'oferta', label: 'Oferta o servicio' }, { k: 'precio', label: 'Precio' }, { k: 'condiciones', label: 'Condiciones' }, { k: 'vigencia', label: 'Hasta cuándo' }] },
        { k: 'estrella', label: 'Servicio o producto estrella', hint: 'Lo que más queréis vender', type: 'text' },
        { k: 'diferencial', label: '¿Qué os diferencia?', hint: 'Por qué os eligen a vosotros y no a otros', type: 'textarea' },
        { k: 'objeciones', label: 'Objeciones habituales', hint: 'Lo que más dudan o preguntan antes de comprar o pedir cita', type: 'textarea' },
      ] },
    ],
  },
  {
    key: 'zona', num: '1', title: 'Área de influencia',
    groups: [
      { title: '1.2 Área de influencia', intro: 'Hasta dónde queréis atraer clientes, para configurar la segmentación geográfica de los anuncios.', fields: [
        { k: 'radio', label: 'Radio de captación', hint: 'Kilómetros alrededor de la empresa', type: 'text' },
        { k: 'localidades', label: 'Localidades concretas', hint: 'Pueblos o barrios que os interesan', type: 'textarea' },
        { k: 'zonas_excluir', label: 'Zonas a excluir', hint: 'De las que NO queréis clientes', type: 'textarea' },
      ] },
    ],
  },
  {
    key: 'agenda', num: '3', title: 'Horarios y equipo de atención',
    intro: 'Antes de llegar a vosotros, nuestro equipo ya ha hablado con cada cliente potencial y ha confirmado su interés. Vuestra parte es llamarle para darle hora, como máximo en 24 horas laborables, porque el interés se enfría en uno o dos días. Necesitamos saber quién lo va a hacer y cuándo.',
    groups: [
      { title: '3.1 Quién atiende a los clientes potenciales', intro: 'Recibirán aviso en cuanto os pasemos uno.', fields: [
        { k: 'atienden', label: 'Personas', type: 'table', cols: [
          { k: 'nombre', label: 'Nombre' }, { k: 'cargo', label: 'Cargo' }, { k: 'whatsapp', label: 'WhatsApp' }, { k: 'horario', label: 'Horario de disponibilidad' },
        ] },
      ] },
      { title: '3.2 Horario de la empresa', fields: [
        { k: 'horario', label: 'Horario de la empresa', hint: 'De lunes a domingo: de qué hora a qué hora por la mañana y por la tarde. Activad los días que abrís y poned las horas. Rellenad el lunes y pulsad «Copiar a todos» para repetirlo en los demás días.', type: 'horario' },
        { k: 'cierres', label: 'Días de cierre', hint: 'Vacaciones, festivos locales, cierres previstos', type: 'textarea' },
      ] },
      { title: '3.3 Vuestra agenda de primeras visitas', intro: 'AVANIA no gestiona vuestra agenda. Vosotros dais las citas porque solo vosotros conocéis vuestros huecos reales.', fields: [
        { k: 'huecos', label: 'Huecos de primera visita al día', hint: 'Número de primeras visitas nuevas que podéis asumir al día', type: 'number' },
        { k: 'horarios_primeras', label: 'Horarios de primeras visitas', hint: 'Días y horas en los que dais primeras visitas (por ejemplo: lunes y miércoles de 16:00 a 18:00)', type: 'textarea' },
        { k: 'duracion', label: 'Duración de una primera visita', type: 'text' },
        { k: 'antelacion', label: 'Antelación mínima para dar cita', hint: '¿Con cuánto tiempo necesitáis avisar?', type: 'text' },
        { k: 'software_citas', label: 'Software de gestión de citas', hint: 'agenda propia, Google Calendar, Gesden, Clinic Cloud...', type: 'text' },
      ] },
      { title: '3.4 Fechas señaladas y cierres', intro: 'Fechas en las que queráis hacer un esfuerzo especial de comunicación (aniversario, llegada de un equipo nuevo, campañas de temporada...) y festivos o cierres en los que no atendéis.', fields: [
        { k: 'fechas', label: 'Fechas', type: 'table', cols: [{ k: 'fecha', label: 'Fecha' }, { k: 'tipo', label: 'Tipo', type: 'select', options: ['Cierre', 'Campaña o comunicación', 'Otra'] }, { k: 'motivo', label: 'Motivo' }, { k: 'comunicar', label: 'Qué queréis comunicar' }] },
      ] },
    ],
  },
  {
    key: 'rodaje', num: '4', title: 'Rodaje de vídeos (fechas)',
    intro: 'El contrato incluye media jornada de rodaje en la empresa con un equipo profesional, de la que salen entre 15 y 20 vídeos. El cliente quiere ver la cara de quien le va a atender antes de pedir cita.',
    groups: [
      { title: '4.1 Quién graba', fields: [
        { k: 'doctor', label: 'Profesional que grabará', type: 'text' },
        { k: 'cargo_doctor', label: 'Cargo y especialidad', type: 'text' },
        { k: 'ha_grabado', label: '¿Ha grabado vídeo antes?', hint: 'Si no, no hay problema: le preparamos antes del rodaje', type: 'tri' },
        { k: 'otros', label: '¿Grabará alguien más?', hint: 'Higienista, coordinadora, otro profesional', type: 'text' },
      ] },
      { title: '4.2 Cuándo y dónde', fields: [
        { k: 'dias_rodaje', label: 'Fechas posibles para el rodaje', hint: 'Pulsad los días en el calendario: dos o tres opciones de media jornada. Quedan señalados con un círculo.', type: 'calendario' },
        { k: 'fechas_rodaje', label: 'Notas sobre las fechas', hint: 'Cualquier aclaración sobre las fechas', type: 'textarea' },
        { k: 'franja', label: 'Franja preferida', type: 'select', options: ['Mañana', 'Tarde'] },
        { k: 'sala', label: 'Sala disponible para grabar', hint: 'Sala de trabajo, sala de espera, despacho...', type: 'text' },
        { k: 'ruido', label: '¿Hay ruido o interferencias previsibles?', hint: 'Obras cercanas, aparatos, tránsito de clientes', type: 'text' },
      ] },
      { title: '4.3 Temas que queréis tratar', intro: 'Las preguntas que más os hacen los clientes en consulta. Cada una puede ser un vídeo.', fields: [
        { k: 'temas', label: 'Temas', type: 'table', cols: [{ k: 'tema', label: 'Pregunta o tema' }, { k: 'porque', label: 'Por qué es importante para vuestros clientes' }] },
        { k: 'guiones_url', label: 'Enlace a los guiones', hint: 'Documento o carpeta con los guiones de los vídeos', type: 'url', search: 'drive' },
      ] },
    ],
  },
  {
    key: 'accesos', num: '5', title: 'Web, dominio y Google (enlaces)',
    intro: 'Algunos accesos no los conoceréis de primera mano. No pasa nada: dadnos el contacto de quien lleva vuestra web o vuestro marketing y lo hablamos con esa persona. Las contraseñas, si hacen falta, van en la pestaña Credenciales.',
    groups: [
      { title: '0.0 Web, dominio y hosting', intro: 'Si tenéis WordPress: dad de alta como administrador a marketing@avania.es. Con eso nos basta.', fields: [
        { k: 'dominio', label: 'Dominio principal', type: 'text' },
        { k: 'hosting', label: 'Proveedor de hosting', type: 'text' },
        { k: 'cms', label: 'Gestor de contenidos', hint: 'WordPress, Wix, Squarespace, desarrollo a medida...', type: 'text' },
        { k: 'resp_web', label: 'Responsable de la web', hint: 'Empresa o persona que la mantiene', type: 'text' },
        { k: 'resp_web_contacto', label: 'Correo y teléfono de esa persona', type: 'text' },
      ] },
      { title: '0.0 Google', intro: 'Dad acceso de administrador a marketing@avania.es en Google Analytics, Google Tag Manager y Google My Business (como gestor).', fields: [
        { k: 'google_alta', label: '¿Los tenéis dados de alta?', type: 'tri' },
        { k: 'google_quien', label: 'Si no, ¿quién los gestiona?', type: 'text' },
        { k: 'ga_enlace', label: 'Enlace o ID de Google Analytics', hint: 'El enlace de la propiedad o el identificador (G-XXXXXXXXXX)', type: 'text' },
        { k: 'gtm_id', label: 'ID de Google Tag Manager', hint: 'GTM-XXXXXXX', type: 'text' },
        { k: 'gmb_enlace', label: 'Perfil de empresa en Google (antes My Business)', hint: 'Enlace a la ficha que sale en Google Maps', type: 'url' },
        { k: 'gsc_enlace', label: 'Google Search Console', hint: 'Enlace o dominio verificado, si lo tenéis', type: 'text' },
        { k: 'gads_id', label: 'ID de cuenta de Google Ads', hint: 'Si ya habéis anunciado en Google (123-456-7890)', type: 'text' },
      ] },
      { title: '0.0 Otras redes y canales', intro: 'Enlaces a cualquier otro canal en el que estéis presentes.', fields: [
        { k: 'tiktok', label: 'TikTok', type: 'text' },
        { k: 'linkedin', label: 'LinkedIn', type: 'url' },
        { k: 'youtube', label: 'YouTube', type: 'url' },
        { k: 'otros_canales', label: 'Otros canales o directorios', hint: 'Doctoralia, Booking, Páginas Amarillas, Telegram…', type: 'textarea' },
      ] },
    ],
  },
  {
    key: 'meta', num: '6', title: 'Meta: publicidad y redes (enlaces)',
    groups: [
      { title: '6.1 Business Manager de Meta', intro: ['Es el acceso más importante: sin él no podemos crear ni gestionar vuestros anuncios.', 'Nunca os pediremos vuestra contraseña de Facebook ni de Instagram: el acceso se concede como socio desde vuestro Business Manager y podéis retirarlo cuando queráis.', 'Cómo: Configuración del negocio → Socios → Añadir → Dar acceso a un socio. Nuestro identificador es 7853166714786634.'], fields: [
        { k: 'bm_creado', label: '¿Tenéis Business Manager creado?', type: 'tri' },
        { k: 'bm_id', label: 'ID de vuestro Business Manager', hint: 'Si ya lo tenéis', type: 'text' },
        { k: 'bm_acceso', label: '¿Habéis concedido ya el acceso?', type: 'select', options: ['Sí', 'No'] },
        { k: 'ads_id', label: 'ID de la cuenta publicitaria', hint: 'Administrador de anuncios › Ajustes de la cuenta. Es un número de unos 15 dígitos', type: 'text' },
      ] },
      { title: '6.2 Cuenta publicitaria e inversión', intro: 'La inversión en publicidad la pagáis vosotros directamente a Meta. AVANIA la gestiona, pero nunca cobra ni adelanta ese dinero.', fields: [
        { k: 'cuenta_pub', label: '¿Tenéis cuenta publicitaria activa?', type: 'tri' },
        { k: 'metodo_pago', label: 'Método de pago dado de alta en Meta', hint: 'Tarjeta, domiciliación...', type: 'text' },
        { k: 'presupuesto', label: 'Presupuesto mensual previsto para anuncios', hint: 'Una idea inicial; lo hablaremos juntos', type: 'text' },
        { k: 'campanas_previas', label: '¿Habéis hecho campañas antes?', type: 'tri' },
      ] },
      { title: '0.0 Píxel de seguimiento', intro: 'Sin este código instalado no podemos lanzar la campaña. Es lo primero que revisamos.', fields: [
        { k: 'pixel', label: '¿Tenéis ya píxel de Meta instalado?', type: 'tri' },
        { k: 'privacidad', label: '¿Tenéis política de privacidad publicada?', type: 'tri' },
        { k: 'privacidad_url', label: 'Enlace de la política de privacidad', hint: 'El enlace exacto, tal como aparece en vuestra web', type: 'url', showIf: { k: 'privacidad', v: 'Sí' } },
        { k: 'cookies', label: '¿Tenéis banner de cookies?', type: 'tri' },
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
    key: 'whatsapp', num: '7', title: 'WhatsApp: teléfonos y número de atención',
    groups: [
      { title: '7.1 Número de WhatsApp para clientes', intro: 'Los clientes potenciales reciben mensajes automáticos por WhatsApp. Recomendamos un número dedicado, separado del teléfono de la empresa. Si preferís que os lo gestionemos, lo contratamos nosotros con la tarifa mínima (unos 2,50 €/mes a vuestro cargo) y os lo facturamos aparte.', fields: [
        { k: 'wa_business', label: '¿Tenéis WhatsApp Business?', type: 'select', options: ['Sí', 'No'] },
        { k: 'wa_numero', label: 'Número actual', hint: 'Si ya tenéis uno para clientes', type: 'tel' },
        { k: 'wa_nuevo', label: '¿Preferís que os gestionemos un número nuevo?', type: 'select', options: ['Sí', 'No'] },
      ] },
      { title: '7.2 Grupo de WhatsApp del proyecto', intro: 'Crearemos un grupo con vuestro equipo y el nuestro para el día a día y los avisos de clientes.', fields: [
        { k: 'grupo1', label: 'Teléfono 1 para el grupo', type: 'tel' },
        { k: 'grupo2', label: 'Teléfono 2 para el grupo', type: 'tel' },
        { k: 'grupo3', label: 'Teléfono 3 para el grupo', type: 'tel' },
      ] },
      { title: '7.3 Avania Setex', intro: 'El asistente de WhatsApp que atiende a vuestros clientes. Lo rellenamos nosotros.', fields: [
        { k: 'setex_numero', label: 'Número de WhatsApp de Avania Setex', hint: 'El número que facilita Zernio y desde el que escribe el asistente', type: 'tel', owner: 'team', clientEdit: true },
        { k: 'setex_enlace', label: 'Enlace a su cuenta de Avania Setex', hint: 'Panel de la empresa: https://setter.goavania.com/panel', type: 'url', owner: 'team', clientEdit: true },
      ] },
    ],
  },
  {
    key: 'materiales', num: '8', title: 'Marca, logotipos y materiales',
    intro: 'Todo lo gráfico que necesitamos para los anuncios y los vídeos. Los archivos se suben a la carpeta de Drive que os hemos compartido y aquí dejáis los enlaces y los datos de vuestra marca.',
    groups: [
      { title: 'Logotipos', intro: 'PNG o SVG con fondo transparente. Pegad un enlace por archivo: logotipo principal, versión para fondo oscuro, icono…', fields: [
        { k: 'logos', label: 'Logotipos', type: 'docs' },
      ] },
      { title: 'Identidad de marca', fields: [
        { k: 'colores', label: 'Colores corporativos', hint: 'Códigos de color', type: 'text' },
        { k: 'tipografias', label: 'Tipografías', hint: 'Las letras de vuestra marca', type: 'text' },
        { k: 'tono', label: 'Tono de comunicación', hint: 'Cercano, profesional, técnico…', type: 'text' },
      ] },
      { title: 'Fotos, vídeos y otros materiales', intro: 'Mínimo 10 fotos de la empresa, fotos del equipo, antes y después (si disponéis) y vídeos existentes. Sobre los antes y después: consultad el consentimiento firmado de los clientes; no publicamos ninguna imagen sin vuestra confirmación.', fields: [
        { k: 'drive_materiales', label: 'Carpeta de Drive con los materiales', hint: 'Enlace a la carpeta donde se han subido logotipos, fotos y vídeos', type: 'url' },
        { k: 'subidos', label: '¿Habéis subido ya los materiales?', type: 'select', options: ['Sí', 'Parcialmente', 'Todavía no'] },
        { k: 'faltan', label: 'Si falta algo, ¿para cuándo lo tendréis?', type: 'text' },
      ] },
    ],
  },
  {
    key: 'formacion', num: '10', title: 'Formación de vuestro equipo · CLOSE CARE',
    intro: 'Antes de lanzar la campaña haremos una sesión de formación de dos horas con las personas que vayan a atender a los clientes. Es obligatoria: sin ella no activamos la campaña.',
    groups: [{ title: 'Sesión de formación', fields: [
      { k: 'asistentes', label: 'Quién asistirá', hint: 'Nombres y cargos. Deben venir todos los que vayan a atender pacientes', type: 'textarea' },
      { k: 'fechas_formacion', label: 'Fechas y horas posibles', hint: 'Dos o tres opciones', type: 'textarea' },
    ] }],
  },
  {
    key: 'cronograma', num: '9', title: 'Calendario de acciones',
    intro: 'Todas las fechas del proyecto en un solo sitio: lo que hace AVANIA y lo que tenéis que hacer vosotros, con su prioridad. Junto a estas listas se muestran automáticamente el rodaje y la formación que ya habéis indicado en otras secciones. Los horarios, festivos y fechas señaladas de la empresa no entran aquí: viven en Empresa › Horarios.',
    groups: [
      { title: '0.0 Acciones de AVANIA', intro: 'Lo que hacemos nosotros y para cuándo. Lo rellena nuestro equipo.', fields: [
        { k: 'acciones_avania', label: 'Acciones de AVANIA', type: 'table', owner: 'team', shared: true, clientEdit: true, optional: true, cols: ACCION_COLS },
      ] },
      { title: '0.0 Acciones del cliente', intro: 'Lo que necesitamos de vosotros y para cuándo. Podéis añadir vuestras propias acciones y marcarlas como hechas.', fields: [
        { k: 'acciones_cliente', label: 'Acciones del cliente', type: 'table', optional: true, cols: ACCION_COLS },
      ] },
    ],
  },
  {
    key: 'avania', num: '10', title: 'Nosotros: quién es quién en AVANIA',
    intro: 'El equipo de AVANIA que trabaja en este proyecto, a qué se dedica cada persona y cómo contactarla.',
    groups: [
      { title: '0.0 Quién es quién en vuestro proyecto', fields: [
        { k: 'personas', label: 'Equipo de AVANIA', type: 'table', owner: 'team', shared: true, cols: [{ k: 'nombre', label: 'Nombre' }, { k: 'rol', label: 'Rol' }, { k: 'responsabilidades', label: 'Responsabilidades' }, { k: 'correo', label: 'Correo' }, { k: 'telefono', label: 'Teléfono' }] },
      ] },
      { title: '0.0 Cómo contactarnos', fields: [
        { k: 'como_contactar', label: 'Cómo y cuándo contactar con nosotros', hint: 'Canales, horario de respuesta y qué hacer en una urgencia', type: 'textarea', owner: 'team', shared: true },
      ] },
    ],
  },
  {
    key: 'cierre', num: '11', title: 'Revisión final y confidencialidad',
    intro: 'Todos los accesos y datos se tratan con absoluta confidencialidad y se usan únicamente para la ejecución de vuestro proyecto. Los datos de vuestros clientes están protegidos por el RGPD (y los de salud, si los hay, con protección reforzada): actuamos como encargados del tratamiento. Podéis retirar cualquier acceso cuando queráis.',
    groups: [{ title: 'Antes de devolvernos el documento', fields: [
      { k: 'ok_clinica', label: 'Datos de la empresa completos', type: 'check' },
      { k: 'ok_rodaje', label: 'Fechas propuestas para el rodaje de vídeos', type: 'check' },
      { k: 'ok_materiales', label: 'Logo y mínimo 10 fotos subidas a la carpeta de Drive', type: 'check' },
      { k: 'ok_google', label: 'Acceso concedido a marketing@avania.es en Google', type: 'check' },
      { k: 'ok_meta', label: 'Acceso de socio concedido en el Business Manager de Meta', type: 'check' },
      { k: 'ok_atencion', label: 'Personas que atenderán a los clientes, con teléfono y horario', type: 'check' },
      { k: 'ok_whatsapp', label: 'Decisión sobre el número de WhatsApp', type: 'check' },
      { k: 'ok_formacion', label: 'Asistentes y fechas para la formación', type: 'check' },
    ] }],
  },
];

const SHORT = {'clinica': 'Datos', 'zona': 'Área de influencia', 'agenda': 'Horarios', 'materiales': 'Marca', 'mercado': 'Clientes y ofertas', 'oferta': 'Análisis de AVANIA', 'negocio': 'Objetivos', 'accesos': 'Web y Google', 'meta': 'Meta', 'whatsapp': 'WhatsApp', 'cronograma': 'Acciones', 'rodaje': 'Rodaje', 'formacion': 'Formación', 'cierre': 'Revisión final', 'proyecto': 'Proyecto', 'avania': 'Quién es quién'};   // nombres cortos para el menú
// Las cinco áreas del alta, en el orden en que se rellenan. Cada una lleva su barra de avance.
export const BLOCKS = [
  { key: 'empresa', title: 'La empresa y quién la forma', short: 'Empresa', sections: ['clinica', 'zona', 'agenda', 'materiales'] },
  { key: 'mercado', title: 'Sus clientes, competencia y ofertas', short: 'Análisis', sections: ['mercado', 'oferta', 'negocio'] },
  { key: 'tecnico', title: 'Enlaces técnicos', short: 'Enlaces', sections: ['accesos', 'meta', 'whatsapp'] },
  { key: 'cronograma', title: 'Fechas de acciones', short: 'Fechas', sections: ['cronograma', 'rodaje', 'formacion', 'cierre'] },
  { key: 'nosotros', title: 'Nosotros: AVANIA', short: 'Avania', sections: ['proyecto', 'avania'] },
];
{
  // La numeración sale del orden de las áreas (las claves no cambian: los datos guardados siguen donde estaban).
  const byKey = Object.fromEntries(FORM.map((x) => [x.key, x]));
  const ordered = BLOCKS.flatMap((b) => b.sections.map((k) => Object.assign(byKey[k], { block: b.key })));
  FORM.splice(0, FORM.length, ...ordered);
  BLOCKS.forEach((b, bi) => b.sections.forEach((k, si) => {
    const sec = byKey[k];
    sec.num = `${bi + 1}.${si + 1}`;
    sec.short = SHORT[k];
    sec.groups.forEach((g) => { g.title = g.title.replace(/^\d+\.\d+\s+/, ''); });
  }));
}

// «Nuestros análisis» lo rellena AVANIA y el cliente lo ve en solo lectura. «Objetivos y datos para medir» (negocio) es solo del equipo: el cliente no lo ve.
for (const k of ['oferta']) {
  const sec = FORM.find((x) => x.key === k);
  sec.shared = true;
  for (const f of sec.groups.flatMap((g) => g.fields)) if (!['pipeline_id', 'etapas'].includes(f.k)) f.shared = true;
}

// Disposición de cada ficha: el orden de los campos y su ancho en una rejilla de 12 columnas ("clave:ancho").
// Lo que no aparece aquí conserva su orden y ocupa media fila. Las claves de los datos no cambian.
const LAYOUT = {
  negocio: ['valor_medio:3', 'tasa_cierre:3', 'ciclo_venta:3', 'margen:3', 'objetivo_leads:4', 'objetivo_citas:4', 'objetivo_ventas:4', 'cpl_objetivo:4', 'respuesta_max:4', 'fuentes:4', 'pipeline_id:6', 'etapas:12'],
  proyecto: ['categoria:6', 'responsable_cuenta:6', 'fecha_firma:4', 'fecha_inicio:4', 'fecha_montaje:4', 'enlace_clickup:6', 'enlace_drive:6', 'funnels_location:6'],
  clinica: ['nombre_comercial:6', 'razon_social:6', 'cif:4', 'fecha_apertura:4', 'telefono:4', 'direccion:8', 'ciudad:4', 'web:4', 'instagram:4', 'facebook:4', 'gabinetes:6', 'profesionales:6', 'descripcion:12',
    'responsables:12', 'plantilla:12', 'telefonos:12', 'whatsapps:12', 'correos:12', 'fuera_horario:12',
    'tratamientos:12', 'financiacion:6', 'financiacion_detalle:6', 'primera_visita:6', 'primera_incluye:6', 'referentes:12'],
  mercado: ['clientes_tipo:12', 'clientes_origen:12', 'clientes_mejores:6', 'clientes_no:6', 'competidores:12', 'ofertas:12', 'estrella:6', 'diferencial:6', 'objeciones:12'],
  cronograma: ['acciones_avania:12', 'acciones_cliente:12'],
  avania: ['personas:12', 'como_contactar:12'],
  oferta: ['avatar_resumen:12', 'avatar_docs:12', 'competencia_resumen:12', 'competencia_docs:12', 'oferta_resumen:12', 'oferta_docs:12'],
  zona: ['radio:4', 'localidades:4', 'zonas_excluir:4'],
  agenda: ['atienden:12', 'horario:12', 'cierres:12', 'huecos:6', 'duracion:6', 'horarios_primeras:12', 'antelacion:6', 'software_citas:6', 'fechas:12'],
  rodaje: ['doctor:6', 'cargo_doctor:6', 'ha_grabado:6', 'otros:6', 'dias_rodaje:7', 'franja:5', 'sala:5', 'ruido:5', 'fechas_rodaje:5', 'temas:12', 'guiones_url:12'],
  accesos: ['dominio:6', 'hosting:6', 'cms:6', 'resp_web:6', 'resp_web_contacto:6', 'google_alta:6', 'google_quien:6', 'ga_enlace:6', 'gtm_id:6', 'gmb_enlace:6', 'gsc_enlace:6', 'gads_id:6', 'tiktok:6', 'linkedin:6', 'youtube:6', 'otros_canales:12'],
  meta: ['bm_creado:4', 'bm_acceso:4', 'bm_id:4', 'ads_id:4', 'cuenta_pub:4', 'metodo_pago:4', 'presupuesto:4', 'campanas_previas:4', 'pixel:6', 'cookies:6', 'privacidad:4', 'privacidad_url:8',
    'pagina_fb:6', 'perfil_ig:6', 'ig_profesional:6', 'ig_vinculado:6'],
  whatsapp: ['wa_business:6', 'wa_nuevo:6', 'wa_numero:6', 'grupo1:4', 'grupo2:4', 'grupo3:4', 'setex_numero:6', 'setex_enlace:6'],
  materiales: ['logos:12', 'colores:4', 'tipografias:4', 'tono:4', 'drive_materiales:12', 'subidos:6', 'faltan:6'],
  formacion: ['asistentes:6', 'fechas_formacion:6'],
  cierre: [],
};
// En «Cuándo y dónde» el calendario ocupa la izquierda y los demás campos se apilan a su derecha.
for (const f of FORM.find((x) => x.key === 'rodaje').groups.flatMap((g) => g.fields)) {
  if (f.k === 'dias_rodaje') f.calside = true;
  if (['franja', 'sala', 'ruido', 'fechas_rodaje'].includes(f.k)) f.side = true;
}
for (const sec of FORM) {
  const order = (LAYOUT[sec.key] || []).map((x) => x.split(':'));
  const at = (k) => { const i = order.findIndex(([x]) => x === k); return i < 0 ? 999 : i; };
  for (const g of sec.groups) {
    for (const f of g.fields) { const o = order.find(([x]) => x === f.k); if (o) f.w = Number(o[1]); }
    g.fields.sort((a, b) => at(a.k) - at(b.k));
  }
}

export const SERVICES = [
  'Hosting', 'Web / CMS', 'Dominio', 'Meta Business Manager', 'Facebook', 'Instagram',
  'WhatsApp Business', 'Google Analytics', 'Google Tag Manager', 'Google My Business', 'Software de citas',
];
// Filas que se le sugieren al cliente en la pestaña de credenciales.
export const SUGGESTED = ['Hosting', 'Web / CMS', 'Meta Business Manager', 'Instagram', 'WhatsApp Business', 'Google Analytics', 'Google Tag Manager'];

const fieldsOf = (s) => s.groups.flatMap((g) => g.fields);

export const DIAS = [['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'], ['jueves', 'Jueves'], ['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo']];
/** ¿Se enseña este campo? Los que dependen de otra respuesta (`showIf`) solo salen y cuentan cuando se da esa respuesta. */
export const shown = (f, data) => !f.showIf || (data || {})[f.showIf.k] === f.showIf.v;
export function isFilled(f, v) {
  if (f.type === 'calendario') return Array.isArray(v) && v.length > 0;
  if (f.type === 'horario') return !!v && typeof v === 'object' && Object.values(v).some((d) => d && (d.abre === true || ['m1', 'm2', 't1', 't2'].some((c) => String(d[c] || '').trim())));
  if (f.type === 'docs' || f.type === 'fichas') return Array.isArray(v) && v.some((r) => r?.url);
  if (f.type === 'table') return Array.isArray(v) && v.some((r) => Object.values(r || {}).some((x) => String(x || '').trim()));
  if (f.type === 'check') return v === true;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

// Progreso: por sección y por área, separando lo que rellena el cliente de lo que rellena la agencia.
// Los campos opcionales no cuentan, y los dentales solo cuentan si el cliente es dental.
const tally = (list) => list.reduce((t, x) => ({ done: t.done + x.done, total: t.total + x.total }), { done: 0, total: 0 });
const pctOf = (t) => ({ ...t, pct: t.total ? Math.round((t.done / t.total) * 100) : 0 });
export function progress(sections, allowed = null, dental = true) {
  const out = {}, outTeam = {};
  for (const s of FORM) {
    if (allowed && !allowed.has(s.key)) continue;
    const data = sections[s.key] || {};
    const del = new Set(Array.isArray(data._avania) ? data._avania : []);   // «No lo sé, que lo haga Avania» cuenta como respondido
    const fs = fieldsOf(s).filter((f) => !f.optional && (dental || !f.dental) && shown(f, data));
    const mine = fs.filter((f) => f.owner !== 'team'), theirs = fs.filter((f) => f.owner === 'team');
    if (mine.length) out[s.key] = { done: mine.filter((f) => isFilled(f, data[f.k]) || del.has(f.k)).length, total: mine.length };
    if (theirs.length) outTeam[s.key] = { done: theirs.filter((f) => isFilled(f, data[f.k])).length, total: theirs.length };
  }
  const client = pctOf(tally(Object.values(out))), team = pctOf(tally(Object.values(outTeam)));
  const areas = BLOCKS.map((b) => {
    const keys = b.sections.filter((k) => !allowed || allowed.has(k));
    return { key: b.key, title: b.title, short: b.short, sections: keys,
      client: pctOf(tally(keys.map((k) => out[k]).filter(Boolean))), team: pctOf(tally(keys.map((k) => outTeam[k]).filter(Boolean))) };
  }).filter((a) => a.sections.length);
  return { sections: out, sectionsTeam: outTeam, done: client.done, total: client.total, pct: client.pct, team, areas };
}

// Puertas de lanzamiento: lo mínimo que debe estar hecho para activar la campaña. `by` = quién lo tiene que mover.
// `creds` = { pendiente, recibida, verificada } del cliente.
export function gates(sections, creds = {}, allowed = null) {
  const g = (sec, k) => (sections[sec] || {})[k];
  const del = (sec, ...ks) => ks.some((k) => ((sections[sec] || {})._avania || []).includes(k));
  const nCred = (creds.pendiente || 0) + (creds.recibida || 0) + (creds.verificada || 0);
  const all = [
    { key: 'meta', label: 'Acceso a Meta', done: g('meta', 'bm_acceso') === 'Sí', todo: 'Falta el acceso a Meta Business Manager', ask: 'Daros acceso a vuestro Business Manager de Meta', why: 'Sin él no podemos crear ni gestionar vuestros anuncios.', section: 'meta', delegated: del('meta', 'bm_acceso') },
    { key: 'pixel', label: 'Píxel', done: g('meta', 'pixel') === 'Sí', todo: 'Falta instalar el píxel', ask: 'Instalar el píxel de Meta en vuestra web', why: 'Sin él no podemos lanzar la campaña. Si no sabéis cómo, decidnos quién lleva vuestra web.', section: 'meta', delegated: del('meta', 'pixel') },
    { key: 'whatsapp', label: 'WhatsApp', done: !!String(g('whatsapp', 'wa_numero') || '').trim() || g('whatsapp', 'wa_nuevo') === 'Sí', todo: 'Falta decidir el número de WhatsApp', ask: 'Decidir el número de WhatsApp para clientes', why: 'Recomendamos uno solo para clientes. Si preferís, os gestionamos uno nuevo.', section: 'whatsapp', delegated: del('whatsapp', 'wa_numero', 'wa_nuevo') },
    { key: 'credenciales', label: 'Credenciales', done: nCred > 0 && !creds.pendiente, todo: 'Faltan credenciales por recibir', ask: 'Dejarnos los accesos que no podáis delegar', why: 'Siempre que se pueda, mejor acceso delegado. Si no, guardad aquí la contraseña: nosotros no podemos verla sin doble verificación.', section: 'credenciales' },
    { key: 'rodaje', label: 'Rodaje', done: isFilled({ type: 'calendario' }, g('rodaje', 'dias_rodaje')), todo: 'Faltan fechas de rodaje', ask: 'Proponer fechas para el rodaje', why: 'Dos o tres opciones de media jornada en el calendario.', section: 'rodaje' },
    { key: 'formacion', label: 'Formación', done: !!String(g('formacion', 'fechas_formacion') || '').trim(), todo: 'Faltan fechas de formación', ask: 'Elegir fechas para la formación', why: 'Dos horas con las personas que atenderán a los clientes.', section: 'formacion' },
  ];
  return allowed ? all.filter((x) => x.section === 'credenciales' || allowed.has(x.section)) : all;
}

export function sanitizeSection(key, input, { team }) {
  const s = FORM.find((x) => x.key === key);
  if (!s) return null;
  const out = {};
  for (const f of fieldsOf(s)) {
    if (f.owner === 'team' && !f.clientEdit && !team) continue;
    if (!(f.k in input)) continue;
    const v = input[f.k];
    if (f.type === 'table') {
      const cols = f.cols.map((c) => c.k);
      out[f.k] = (Array.isArray(v) ? v : []).slice(0, 50).map((r) =>
        Object.fromEntries(cols.map((c) => [c, String((r || {})[c] ?? '').slice(0, 2000)])));
    } else if (f.type === 'calendario') {
      out[f.k] = [...new Set((Array.isArray(v) ? v : []).map(String).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(0, 20);
    } else if (f.type === 'horario') {
      out[f.k] = Object.fromEntries(DIAS.map(([d]) => [d, { abre: !!(v && v[d] && v[d].abre === true), ...Object.fromEntries(['m1', 'm2', 't1', 't2'].map((c) => [c, String((v && v[d] && v[d][c]) ?? '').slice(0, 5)])) }]));
    } else if (f.type === 'fichas') {
      out[f.k] = (Array.isArray(v) ? v : []).slice(0, f.max || 12).map((r) => ({
        nombre: String(r?.nombre ?? '').slice(0, 200),
        url: /^https?:\/\//i.test(String(r?.url ?? '').trim()) ? String(r.url).trim().slice(0, 1000) : '',
        resumen: String(r?.resumen ?? '').slice(0, 3000),
        fileId: /^[\w-]{10,100}$/.test(String(r?.fileId ?? '')) ? String(r.fileId) : '',
      })).filter((r) => r.nombre || r.url || r.resumen);
    } else if (f.type === 'docs') {
      out[f.k] = (Array.isArray(v) ? v : []).slice(0, 30).map((r) => ({
        nombre: String(r?.nombre ?? '').slice(0, 200),
        url: /^https?:\/\//i.test(String(r?.url ?? '').trim()) ? String(r.url).trim().slice(0, 1000) : '',
      })).filter((r) => r.nombre || r.url);
    } else if (f.type === 'check') out[f.k] = v === true;
    else out[f.k] = String(v ?? '').slice(0, 5000);
  }
  if ('_avania' in input) {
    const ok = new Set(fieldsOf(s).filter((f) => f.owner !== 'team' && !['table', 'docs', 'fichas', 'calendario', 'horario', 'check'].includes(f.type)).map((f) => f.k));
    out._avania = [...new Set((Array.isArray(input._avania) ? input._avania : []).map(String).filter((k) => ok.has(k)))];
  }
  return out;
}
