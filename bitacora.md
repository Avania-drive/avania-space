# Bitácora de Avania Space

Diario de lo que se ha hecho en este proyecto, de lo más antiguo a lo más nuevo. Cada cambio nuevo se apunta aquí con su fecha.
Aquí no van contraseñas, claves, tokens ni IDs de clientes.

## Qué es y dónde vive

- **Qué es:** herramienta del equipo de AVANIA para tener a mano la ficha y las credenciales de cada cliente. Hermana de Avania Setex, pero con código, repositorio y base de datos propios (no se mezcla con Setex).
- **Dirección:** `https://space.goavania.com` (ojo: no es «googleavania»).
- **Servidor:** el mismo VPS de Hostinger que Avania Setex. Carpeta `/root/avania-space`, proceso PM2 `avania-space`, escucha en `127.0.0.1:3003`.
- **Cómo llega la gente:** DNS → VPS → Traefik (ruta en `/docker/traefik-asuj/dynamic/space.yml`) → puerto 3003. Certificado de Let's Encrypt hasta el 20-ene-2027.
- **Base de datos:** Postgres de Supabase, proyecto propio, por `DATABASE_URL`. Las tablas llevan RLS sin políticas: las claves públicas de Supabase no leen nada.
- **Quién entra:** solo el equipo, con usuario y contraseña. El cliente no tiene cuenta ni panel: solo abre su formulario desde un enlace único (`/f/<token>`) que se pone en el submenú de Avania Funnels.
- **Roles del equipo:** `super_admin`, `admin` (ve y copia contraseñas, con doble verificación) y `member` (trabaja con los clientes pero no ve contraseñas).

## 2026-10-22 · Nace el proyecto

Hecho (según el primer commit `1c8f1a0` y las notas de ese día):
- **Panel de clientes** tipo CRM, con una **ficha por cliente** de 12 secciones, las del documento de onboarding de AVANIA Clinical.
- **Formulario público por enlace único**, sin cuenta. El cliente puede escribir contraseñas, pero nunca leerlas de vuelta.
- **Caja fuerte de credenciales:** contraseñas cifradas con AES-256-GCM en el servidor. La clave (`CREDENTIALS_KEY`) vive solo en el `.env` del VPS, no en Supabase ni en GitHub. Salen ocultas, con «Ver» temporal, y queda registrado quién las ve.
- **Doble verificación (TOTP)** con app de códigos, obligatoria para revelar una contraseña; dura 10 minutos.
- **Ayuda por sección** y vídeos (`public/ayuda.json`).
- **Migraciones** `001` (esquema inicial) a `004`: alta por ID de Avania Funnels, el cliente identificado por el ID del contacto en el CRM, y el píxel de seguimiento pasa de «Accesos» a «Meta».
- **Alta de clientes por Avania Funnels:** se da de alta con el ID del contacto (no se pregunta nada al cliente) y se precarga su ficha leyendo el CRM, solo lectura. Probada con datos reales de la subcuenta de AVANIA Clinical Dental.
- **Publicación** en `space.goavania.com` con el certificado y la ruta de Traefik.

Decisiones:
- Avania Space es **solo para el equipo**. El texto del documento original que decía «nunca pedimos contraseñas» hay que cambiarlo.
- Si se pierde `CREDENTIALS_KEY`, las contraseñas guardadas **no se recuperan**.

## 2026-10-23 · Correo de alta para usuarios del equipo

Antes, al crear un usuario el sistema solo generaba una contraseña temporal que el administrador tenía que pasar a mano. Ahora el usuario recibe un correo.

Hecho:
- **Correo saliente** (`src/mailer.js`, librería `nodemailer`): usa el mismo buzón SMTP de Hostinger que Avania Setex (`setter@goavania.com`), con el nombre «Avania Space». Las claves de correo están en el `.env` de Avania Space (`SMTP_*`, `MAIL_FROM`, `MAIL_REPLY_TO`, `PUBLIC_URL`). El registro anota la respuesta del servidor y las direcciones rechazadas.
- **Enlace de invitación** (migración `005_invitaciones.sql`, columnas `invite_hash` e `invite_expires_at` en `team_users`): de un solo uso, caduca a las 48 horas y solo se guarda su huella (sha256), nunca el enlace.
- **Página pública** `/invitacion?t=…` (`public/invitacion.html`): comprueba el enlace y deja elegir la contraseña (mínimo 12 caracteres, escrita dos veces). Al guardar se borra el enlace, se cierran las sesiones previas y ya no hay que cambiar la contraseña al entrar. Pide después activar la doble verificación.
- **Endpoints** nuevos `GET` y `POST /api/invitacion/:token`, con límite de intentos.
- **Crear usuario** (`POST /api/users`) manda el correo. Si el correo falla, la respuesta lo dice y devuelve la contraseña temporal para dársela a mano.
- **«Reenviar acceso»** en Equipo, para quien aún no ha elegido contraseña (`resend_invite`).
- **`src/invite.js`** (el envío de la invitación) y **`scripts/invitar.js`**: `node scripts/invitar.js correo "Nombre" member|admin` crea el usuario si no existe y le manda el enlace.
- Interfaz: el aviso al crear un usuario dice si se envió el correo (`public/app.js`).

Probado: con un usuario de prueba (ya borrado) se envió el correo, se abrió el enlace, se rechazó una contraseña corta, se guardó una buena, el enlace dejó de valer y se pudo iniciar sesión.
Todavía no se ha probado de punta a punta el botón «+ Nuevo usuario» de la pantalla.

Envíos reales:
- **Andrea Navarro** (`andrea.navarro@avania.es`, administradora): enlace enviado.
- **Jesús Vizcaino** (`jesus.vizcaino@avania.es`, administrador): enlace enviado. Se pidió escribir «viscaino», pero la cuenta que existe en Space y en Avania Setex es con «z» (en Setex entró el 21-oct dos minutos después de recibir sus correos), así que se usó esa.
- Ambos ya existían sin contraseña elegida; no se les mandó contraseña escrita, solo el enlace.

Cosas aprendidas:
- El servidor de correo de `avania.es` (Google) **acepta cualquier dirección**, incluso una inventada, en el momento del envío. Por eso «el servidor lo aceptó» no prueba que la dirección exista: hay que comprobar el nombre exacto.
- La acción «Nueva contraseña» (contraseña temporal) **no** manda correo: sigue como antes.

Copias de seguridad: `/root/backups/avania-space-pre-correo-20261023` (código y migraciones antes de estos cambios).

## 2026-10-23 (tarde) · Contraseña para abrir las credenciales

Antes de abrir la zona de credenciales de un cliente, la persona tiene que volver a escribir **la contraseña de su cuenta** de Avania Space.

Hecho:
- **Pantalla de bloqueo:** al entrar en la pestaña «🔐 Credenciales» sale «Credenciales protegidas» con un campo de contraseña. Al acertar, se abren (`public/app.js`).
- **Cuánto dura:** 10 minutos, que se renuevan mientras se usan las credenciales. Pasados 10 minutos sin tocarlas, la zona se cierra sola y vuelve a pedir la contraseña, aunque se esté dentro de la pantalla. Cerrar sesión también la cierra.
- **En el servidor** (`src/auth.js`, `src/index.js`, migración `006_reautenticacion.sql`, columna `reauth_until` en `sessions`): `GET` y `POST /api/reauth` (con límite de 8 intentos). Listar, crear, editar, borrar y revelar credenciales exigen la comprobación reciente y, si falta, responden 403 con `password_required`. Es **independiente** de la doble verificación: para ver o copiar una contraseña siguen haciendo falta las dos cosas.
- **No afecta al cliente:** el formulario por enlace (`/f/<token>`) no cambia.
- **Pruebas** (`scripts/e2e.mjs`, ampliado): sin contraseña reciente se bloquea listar, editar y revelar; contraseña mal → 400; bien → se abre; caducada → vuelve a pedirla. Todo en verde.

Hallazgo: en esa misma prueba falla «cliente guarda sección», que es ajeno a este cambio. La sección 2 del formulario («Oferta y paciente ideal») se rediseñó (ahora es del equipo y ya no tiene el campo `tratamiento` que usa la prueba) y esos cambios de `src/formdef.js` están sin confirmar en git. Hay que actualizar la prueba cuando se dé por buena la nueva sección.

Copia previa: `/root/backups/avania-space-pre-reauth-20261023`.

## 2026-10-23 (noche) · Menú lateral estilo Holded y credenciales desplegables

- **Menú lateral** (`public/app.js`, `public/space.css`): a la izquierda con iconos de línea, tarjeta de la persona (nombre y rol), Clientes / Equipo / Seguridad y «Salir» abajo. Dentro de un cliente, las secciones de su ficha pasan al lateral agrupadas por bloque, con el avance (`2/5`) a la derecha. En móvil se abre con el botón ☰.
- **Credenciales desplegables:** cada servicio es una fila que se abre y se cierra (antes, una tabla de 9 columnas que se salía por la derecha). Dentro, los campos se reparten en una rejilla que se adapta al ancho. Botones «Abrir todas» / «Cerrar todas». También lo usa el formulario del cliente.
- Pruebas de servidor (`scripts/e2e.mjs`) sin cambios en el resultado. **No se ha mirado todavía en el navegador**: falta revisar a mano el aspecto (Ctrl+F5).
- **Mismo menú que Avania Setex y estilo maestro:** el menú se rehízo con el aspecto del de Setex (filas de 32 px, texto 14 px, iconos de 18 px, activa en gris suave, rótulos de grupo en gris, tarjeta de cuenta con inicial). Ese estilo vive ahora en **un solo archivo**, `/root/avania-brand/avania-ui.css` (colores, Inter, botones, campos, tarjetas, logo y menú `.av-*`). Se edita solo ahí y se ejecuta `/root/avania-brand/sync.sh`, que lo copia a Space y a Setex (instrucciones en `/root/avania-brand/LEEME.md`). Space ya lo usa (`public/avania-ui.css`); Setex recibe la copia pero sigue con su `ui.css` propio hasta migrarlo.
- **Migración de Setex al estilo maestro (23-oct):** `ui.css` de Setex ya no lleva la cabecera (Inter, variables, botones, campos, tarjetas): la importa del maestro con `@import "/avania-ui.css"`. Setex sirve el archivo con una ruta nueva en `src/index.js` (junto a `/ui.css`). Comprobado: 8 de 9 pantallas públicas de Setex salen píxel a píxel iguales; `admin.html` cambia entre capturas incluso con el código antiguo (no es determinista). Copia para volver atrás: `/root/backups/avania-setex-pre-estilo-maestro-20261023` (public/, index.js.bak, maestro y public de Space). El maestro solo lleva las variables de color, no las reglas de `tokens.css` (pisaban los estilos de cada página); el logo `.brand` está en `space.css`.
- **Enlaces al menú:** los dos recuadros de arriba de la ficha (enlace para el submenú de Avania Funnels y enlace para el cliente) ya no están: ahora hay una zona «Enlaces» en el menú lateral del cliente con copiar enlace del cliente, copiar enlace de Funnels (si tiene), abrir el formulario, abrir AVANIA Funnels, enlace nuevo y archivar/reactivar.
- **Space con el estilo de Setex (23-oct):** a petición de Pascual, Space adopta el aspecto completo de Setex: fondo blanco, tablas planas con cabecera gris, insignias verdes, barras de progreso gruesas, pestañas y títulos. Para ello el maestro (`avania-ui.css`) ganó una sección de componentes (pestañas, insignias, barras, tablas, títulos, tarjeta destacada), que se movió desde el `ui.css` de Setex; Setex sigue igual (8 pantallas públicas comparadas, idénticas). En `space.css` se quitaron las reglas que contradecían ese estilo. Copia previa de `space.css`: scratchpad de la sesión; el código anterior completo en `/root/backups/avania-space-pre-menu-20261023`.
- **Enlaces, ahora como pantalla (23-oct):** corregido lo anterior: «Enlaces» ya no es un grupo de acciones sueltas en el menú sino un **ítem de menú** (entre Credenciales y Registro de accesos) que abre su propia pantalla a la derecha, con tarjetas: enlace para el cliente (copiar/abrir), enlace para el submenú de Avania Funnels (copiar, si el cliente lo tiene), plataformas (abrir AVANIA Funnels) y gestión del enlace (generar nuevo, archivar/reactivar).
- Visto en captura (servidor de prueba, no con datos reales): menú y credenciales plegadas se ven bien.
- Copia previa: `/root/backups/avania-space-pre-menu-20261023`.

## 2026-10-23 (noche) · Menú clonado y datos de Clínica Dental SEDI

- **Menú igual que el de Setex:** el menú del cliente ya no tiene rótulos de grupo ni una segunda tarjeta. Como «Configuración › Setter» en Setex, es una fila con el nombre del cliente que se despliega, dentro filas por bloque que también se despliegan (de una en una, con flechita) y debajo Credenciales, Enlaces y Registro de accesos. Medidas, tipografía e iconos en el maestro `avania-ui.css`.
- **Carga de los datos de la clínica (documento de onboarding de SEDI):** se volcaron en su ficha los datos de proyecto, clínica y contactos, rodaje, materiales, fechas, web y Google, Meta, agenda y equipo de atención, WhatsApp y formación. Lo que ya había (cargado antes desde Funnels) se sobrescribió donde el documento traía dato. Las contraseñas (Instagram y Zernio) entraron **cifradas en la caja fuerte** de credenciales; en esta bitácora no constan. Copia de la ficha anterior (sin contraseñas): `/root/backups/sedi-antes-de-cargar-20261023.json`.
- **Sin casilla en Space (no se cargó):** bloque 2 del documento (tratamiento, ticket, paciente ideal, ventajas, competencia): la sección 2 solo admite documentos subidos por el equipo. El nombre de contacto de Meta (Daniel Gómez Corral) se dejó en las notas de la credencial de Meta Business Manager.

- Literal «Enlace a vuestro espacio de proyecto» → «Enlace a vuestro espacio de proyecto-clickup» (`src/formdef.js`).

- **Enlaces clicables:** en toda la ficha, los campos de texto o enlace que contengan una dirección (`https://…` o `www.…`) llevan al lado un botón «Abrir ↗» (sigue lo que se escribe; se oculta si no es un enlace). También en «Enlace de acceso» de las credenciales, y los campos de solo lectura muestran la dirección como enlace (`public/fields.js`, `space.css`).

- **Dos casillas nuevas con enlace** (`src/formdef.js`): «Enlace a los guiones» al final de Rodaje de vídeos (4.3, bajo Temas) y «Enlace a la carpeta de Drive con los materiales» en Materiales gráficos. Ambas llevan el botón «Abrir ↗». En SEDI, la de materiales se rellenó con la carpeta compartida de Drive del proyecto (la del documento); la de guiones está vacía a la espera del enlace.

- **Fechas señaladas** pasa de «Contenido y rodaje» a **«Proyecto y clínica»** (`BLOCKS` en `src/formdef.js`).
- **Festivos de SEDI:** se añadieron a su tabla de fechas los festivos nacionales y de Castilla-La Mancha que quedan de 2026 y los de 2027, con «Clínica cerrada» en «Qué queréis comunicar». Fuentes: calendarios laborales de Castilla-La Mancha (Decreto 44/2025 para 2026 y Decreto 34/2026, DOCM 13-jul-2026, para 2027) vía prensa y portales de calendarios, **no el texto oficial del DOCM** (el PDF no se pudo leer). Quedan **por confirmar**: el 7-dic-2026 (las fuentes se contradicen) y las **fiestas locales de Toledo 2027** (las fija el Ayuntamiento y aún no constan; en 2026 fueron San Ildefonso el 23-ene y Lunes de Pascua el 6-abr). Se omitieron festivos que caen en sábado (1-may y 25-dic de 2027) porque la clínica no abre.
- **Horario de la clínica como agenda:** nuevo tipo de campo `horario` (8.2): tabla Lunes–Domingo con Mañana (De–A) y Tarde (De–A) en selectores de hora. Sustituye a «Horario de mañana», «de tarde» y «¿Abrís sábados?». Los datos de SEDI se pasaron a la tabla (L y X 9:30–14 y 15–20; M y J 9:30–14 y 15–19; V 9:30–14).
- **Guiones:** el campo «Enlace a los guiones» lleva un botón «Buscar en Drive 🔎» que abre Google Drive con la búsqueda «guiones + nombre del cliente». Buscar en el disco duro no es posible desde la web (no se puede obtener un enlace de un archivo local sin subirlo).

- **Agenda y equipo de atención (8)** pasa también a **«Proyecto y clínica»** (tras Fechas señaladas); «Atención y WhatsApp» queda con WhatsApp y Formación.

- **Horario: «Copiar a todos»:** en la fila del lunes, un botón copia sus cuatro horas (mañana y tarde) a los demás días, sábado y domingo incluidos (luego se borran los que no abran). Se guarda solo.

- **«Activar doble verificación» en Equipo:** si tu doble verificación no está activa, la pantalla Equipo muestra un aviso arriba con el botón, y otro botón en tu propia fila (también para el superadministrador, que antes no tenía ninguno en su fila). Al pulsarlo se abre Seguridad y arranca el alta (código QR). En Seguridad el botón «Configurar» pasó a llamarse «Activar doble verificación». El servicio de alta de 2FA ya existía; faltaba que se encontrara.

## 2026-10-23 (noche) · Llaves de acceso (passkeys) como doble verificación

A petición de Pascual («una llave de Google… nos va a ser más cómodo a todos»), se entiende como **llave de acceso (passkey, WebAuthn)**: huella, cara, PIN del equipo o llave física, incluidas las que guarda Google Password Manager.
- **Servidor:** migración `007_llaves_acceso.sql` (tabla `passkeys` y `sessions.wa_challenge`), librería `@simplewebauthn/server`. Rutas: `GET/POST /api/passkeys`, `POST /api/passkeys/options` (pide la contraseña de la cuenta), `DELETE /api/passkeys/:id` (pide contraseña), `POST /api/mfa/passkey/options` y `/verify`. Verificar con la llave abre el mismo permiso de 10 minutos que el código. El dominio de la llave sale de `PUBLIC_URL` (`space.goavania.com`).
- **Convive con el código de la app:** basta cualquiera de los dos para ver o copiar contraseñas. «Reiniciar 2FA» en Equipo borra también las llaves de esa persona.
- **Pantalla:** Seguridad tiene dos tarjetas, «🔑 Llave de acceso» (añadir, listar con fecha de uso, quitar) y «Código de una app». En la ventana de verificación aparece «🔑 Usar llave de acceso». En Equipo la columna de doble verificación indica «app», «llave» o «app + llave».
- **Probado de punta a punta** con un autenticador virtual de Chrome: contraseña errónea rechazada, alta de la llave, verificación tras un login nuevo, repetición de la misma respuesta rechazada, borrado con contraseña errónea rechazado y con la buena aceptado. Usuario de prueba ya borrado. Falta probarlo con un dispositivo real (huella/móvil).
- Copia previa: `/root/backups/avania-space-pre-passkeys-20261023`.

- **Cambiar contraseña, ordenado:** cada campo con su etiqueta encima y el campo a todo el ancho, aviso de «Mínimo 12 caracteres» bajo el campo, sin el logo repetido dentro de la tarjeta y con las tarjetas de Seguridad separadas. La pantalla de primera entrada (elegir contraseña) conserva el logo.

- **Enlace directo a la subcuenta de Avania Funnels:** nueva casilla «ID de la subcuenta de Avania Funnels» en Proyecto y clínica › Antes de empezar (solo equipo). Con ella aparece el botón «Abrir en Avania Funnels ↗» en la cabecera de cada cliente y una tarjeta «Subcuenta de Avania Funnels» (abrir y copiar) en Enlaces; sin ID, un botón «Añadir ID de subcuenta» lleva a la casilla. El enlace es `https://app.avania.marketing/v2/location/<ID>/dashboard`. Para SEDI el ID se cargó buscándolo en la lista de subcuentas de Avania Funnels (coincide por nombre y dirección). La Clínica de Paula Fernández (Vigo) queda sin ID.

- **Horario: interruptor por día:** cada día (lunes a domingo) lleva un interruptor activado/no activado. Activado = día de trabajo y se pueden poner las horas; no activado = cerrado y las horas quedan bloqueadas (se conservan por si se reactiva). «Copiar a todos» copia también si el lunes está abierto o cerrado. En datos antiguos sin interruptor, el día cuenta como abierto si tiene alguna hora. SEDI: lunes a viernes activados, sábado y domingo no. El interruptor es una pieza común (`.av-switch`) del estilo maestro.

- **Pantallas en tarjetas (estilo panel de control):** a partir de una captura de otro software que le gusta a Pascual. Fondo gris claro; cada grupo de una sección es una tarjeta blanca de esquinas redondeadas con un icono de color y el título (sin su número), y los campos se reparten en columnas dentro. Las tablas, el horario y los documentos ocupan todo el ancho; si queda una tarjeta sola en su fila, también. Se hizo de forma general (`renderSection` en `public/fields.js`, estilos en `space.css`), así que afecta a **todas las secciones del equipo y al formulario del cliente**; se revisó en capturas Clínica, Rodaje, Meta, Agenda y Oferta. Pendiente de repasar con Pascual: el resto de pantallas (Credenciales, Equipo, Seguridad, lista de clientes) por si se quiere acercarlas más a ese estilo.

- **Fechas señaladas unificada con Agenda y equipo de atención:** la sección «Fechas señaladas» desaparece del menú y su tabla pasa a ser el último grupo («3.4 Fechas señaladas») de «Agenda y equipo de atención», abajo del todo. Los datos guardados se movieron a la agenda de cada cliente (SEDI: 17 filas) y la sección antigua se borró de la base de datos. «Proyecto y clínica» queda con Antes de empezar, Clínica, Oferta y Agenda.

- **Calendario de fechas del rodaje:** en Rodaje › Cuándo y dónde, «Fechas posibles para el rodaje» es ahora un calendario mensual (lunes a domingo, con flechas de mes). Se pulsan los días y quedan **señalados con un círculo** verde; a la derecha se listan las fechas elegidas con su día de la semana y una ✕ para quitarlas. Nuevo tipo de campo `calendario` (`dias_rodaje`, lista de fechas). El texto libre anterior pasa a «Notas sobre las fechas» y no se perdió. En SEDI se señaló el 15-oct-2026 (la fecha del documento de onboarding).

- **Botón «Abrir Business Manager ↗»** (Meta, justo bajo «ID de vuestro Business Manager»): abre `https://business.facebook.com/latest/settings/business_info?business_id=<ID>`. Solo está **activado** si «¿Habéis concedido ya el acceso?» es «Sí» y hay un ID numérico; si no, sale en gris con el motivo debajo. Se actualiza al momento al cambiar el ID o el desplegable (`public/fields.js`).

- **WhatsApp de pacientes › Avania Setex (7.3):** nuevas casillas «Número de WhatsApp de Avania Setex» y «Enlace a su cuenta de Avania Setex» (solo equipo; el enlace lleva el botón «Abrir ↗»). En SEDI se cargaron el 644 11 42 73 (el teléfono de Simyo que venía en su documento para el alta de WhatsApp por Zernio) y `https://setter.goavania.com/panel`.

- Aclaración de Pascual: el 644 11 42 73 de SEDI es el número de Avania Setex (Zernio solo facilita el número para trabajar con WhatsApp). La ayuda de la casilla lo dice así.

- **Enlaces › Otras plataformas:** tarjeta con accesos directos a Zernio · WhatsApp (`https://zernio.com/dashboard/whatsapp-overview`) y al panel de Avania Setex. (Pascual pegó solo el enlace de Zernio; se interpretó como un acceso directo.)

## 2026-10-23 (noche) · Categorías de cliente

- **Categoría y color por cliente** (migración `008_categorias.sql`: tabla `categories` con nombre y color, y columna `clients.category`). Sin página de gestión: el desplegable se **retroalimenta** de las categorías que ya existen y su última opción «＋ Nueva categoría…» crea otra al momento. Se parte con «Clínica dental» (verde), «Industrial» (ámbar) y «Seguros» (azul).
- **Dónde se elige:** en «Proyecto y empresa › Antes de empezar › Categoría del cliente», con un **selector de color** al lado (cambia el color de esa categoría para todos los clientes que la usen). Es un campo solo del equipo.
- **Dónde se ve:** en la lista de clientes (columna «Categoría» con etiqueta de color y desplegable «Todas las categorías» para filtrar) y junto al nombre en la cabecera de cada ficha.
- **Renombrado:** el bloque «Proyecto y clínica» pasa a **«Proyecto y empresa»**, la sección 1 a «Vuestra empresa y vuestros contactos» y su primer grupo a «Datos de la empresa». Las etiquetas de varios campos aún dicen «clínica» (p. ej. «Teléfono principal de la clínica», «gabinetes»).
- SEDI y la Clínica de Paula Fernández quedan como «Clínica dental». Enzo Romano, Bifla y AF Mediación aún no existen en Space: al darlos de alta se les asigna «Industrial» (los dos primeros) y «Seguros».
- Probado contra el servidor real con un usuario y un cliente de prueba (ya borrados): crear categoría, color inválido (se sustituye por el de defecto), guardar la categoría de un cliente y verla en lista y detalle.

- **«Desde Avania Funnels» busca en la subcuenta que toca según la categoría:** Space solo tenía el token de **AVANIA Clinical Dental** (`FUNNELS_TOKEN`); comprobado que con él la subcuenta «AVANIA | Agencia de Marketing Digital» responde 403. Ahora el alta pide la **categoría** primero: «Clínica dental» → subcuenta Clinical Dental; industriales, seguros y cualquier otra → subcuenta de Marketing (`FUNNELS_TOKEN_MARKETING`, **pendiente de poner en el `.env`**: hace falta crear una integración privada en esa subcuenta con lectura de contactos y campos personalizados). Sin ese token, el alta de industriales y seguros avisa de que falta. Los mensajes de error nombran la subcuenta donde se buscó. Al crear el cliente se guardan además su categoría y el ID de su subcuenta (`funnels_location`, que sale del propio contacto), así que el botón «Abrir en Avania Funnels» funciona sin escribir el ID. Para industriales/seguros el nombre del cliente ya no lleva el prefijo «Clínica de».
- IDs de las subcuentas: Clinical Dental `rNLWECMnIwJnuk8CEyiQ`, Agencia de Marketing Digital `MOnEOxHI7wZrEuevmAp0`.

- Token de la subcuenta de Marketing guardado en el `.env` (copia previa del `.env` sin ese token en `/root/backups/avania-space-pre-passkeys-20261023/`). Se pegó en un chat: **regenerarlo si tiene permisos de escritura**, igual que el de Clinical Dental.

- **Mi perfil (23-oct):** la tarjeta con el nombre, arriba a la izquierda bajo el logo, ahora es un botón que abre una ventana en el centro con: nombre (editable), correo, rol, **doble verificación** (estado: app de códigos y/o llaves de acceso, con el botón «Activar doble verificación» si no hay ninguna, que lleva a Seguridad), **apariencia** (Claro / Oscuro / Automático), **color de acento** (9 colores y un selector libre, con «Restablecer») y acceso a «Cambiar contraseña». Se cierra con ✕, Esc, «Listo» o pulsando fuera. Las preferencias se guardan en la cuenta (migración `009_preferencias.sql`, columna `team_users.prefs`; ruta `PUT /api/me/prefs`) y se aplican al entrar en cualquier equipo; además se recuerdan en el navegador para pintar sin parpadeo. Probado contra el servidor real con un usuario de prueba (ya borrado) y en capturas (claro, oscuro y color morado).

- En la lista de clientes, las etiquetas de «Credenciales» llevan ahora un texto al pasar el ratón: «N verificadas · N recibidas (con contraseña, sin comprobar) · N pendientes (aún sin contraseña)». «5 pend.» = los 5 servicios que se crean con cada cliente (Hosting, Web / CMS, Meta Business Manager, Instagram y WhatsApp Business) sin contraseña todavía.

## 2026-10-24 · Rediseño de la lista y la ficha (Inter y teal)

- **Lista de clientes por estado:** «Esperando al cliente», «Listos para lanzar», «En campaña» y «Pausados» (los dos últimos plegados). Cada fila es un enlace y muestra la frase de lo que falta, la última actividad, el responsable y una barra de 6 tramos (una por puerta). La tabla de antes sigue en «Tabla» (la vista elegida se recuerda en el navegador). `/` enfoca el buscador.
- **Puertas de lanzamiento** (`gates()` en `src/formdef.js`): acceso a Meta (`meta.bm_acceso` = Sí), píxel (`meta.pixel` = Sí), WhatsApp (número o «número nuevo» = Sí), credenciales (alguna y ninguna pendiente), rodaje (alguna fecha) y formación (fechas escritas). `/api/clients` y `/api/clients/:id` devuelven `gates`; la lista añade `last_activity`. Criterio mío, por confirmar con el equipo.
- **Ficha:** nueva pestaña «Resumen» (la de entrada) con la franja oscura «Faltan N cosas para lanzar» y la lista de secciones con lo que falta en cada una. Estado del cliente como pasos (antes un desplegable) y «Copiar enlace del cliente» en la cabecera.
- Estilos solo en `public/space.css` (sección «Rediseño»); el estilo maestro no se ha tocado. Color con significado: verde = hecho, ámbar = bloquea, rojo solo para lo destructivo.
- Copia previa en `/root/backups/avania-space-rediseno-20261024/`. Probado: puertas contra los datos reales (solo lectura) y pantallas con capturas (claro, oscuro y móvil) usando datos de prueba; **no** probado con un inicio de sesión real.

## 2026-10-24 (tarde) · Formulario del cliente en una columna

- **`public/form.js` reescrito:** sin menú lateral. Pantalla de inicio con «Lo que necesitamos primero» (las puertas de lanzamiento que aún faltan, redactadas para la clínica con su porqué) y debajo el resto del documento por bloques, con «Completa» / «Faltan N de M». Cada sección lleva «Volver al inicio» y «Siguiente: …»; el inicio se vuelve a pedir al servidor para refrescar lo pendiente. Rutas por `#clave` (el botón atrás del navegador funciona).
- **API:** `GET /api/f/:token` devuelve además `gates` (con `ask` y `why` para el cliente), `contact` (el `MAIL_REPLY_TO` ya configurado) y `client.manager` (el responsable). Pie con «Vuestra persona de contacto es …».
- **Estilos** (`space.css`, bloque «Formulario del cliente»): letra de 16 px, campos y botones de 44 px de alto, columna de 760 px, botones a ancho completo en móvil.
- Probado con capturas (escritorio, móvil y oscuro) con datos de prueba y contra el servidor reiniciado; **no** con un enlace de cliente real.
- **No incluido aún:** «No lo sé, que lo haga Avania» en cada campo (necesita guardar esa marca en los datos y mostrarla al equipo como tarea).

## 2026-10-24 (noche) · Orden y aspecto de las fichas

- **Orden y ancho de cada campo** definidos en `src/formdef.js` (bloque `LAYOUT`: «clave:ancho» en una rejilla de 12 columnas). Los campos se agrupan por tema (identidad, dirección, contacto, redes, tamaño…) y las claves de los datos no cambian. Al cambiar de sitio un campo se edita solo esa lista.
- **Alineación:** en cada fila las etiquetas quedan arriba y las cajas abajo, así que ya no se ven unas más arriba y otras más abajo aunque tengan pista o la etiqueta ocupe dos líneas.
- **Tarjetas en una sola columna**, en el orden de lectura (antes iban de dos en dos y se descolocaban). Cabecera con línea de separación, iconos de un solo tono (el acento, sin colores distintos por grupo) y la introducción como texto con barra lateral en vez de caja gris. La introducción del Business Manager pasa a tres párrafos (`intro` admite una lista).
- **Respuestas cortas como botones:** «Sí / No / No lo sé» y los desplegables de 3 opciones o menos (franja, WhatsApp Business, materiales subidos…). Un segundo clic en la opción elegida la quita. Los datos guardados son los mismos textos de siempre.
- Vale también para el formulario del cliente (mismo código). Probado con capturas de todas las fichas (escritorio y móvil) y una prueba del guardado de los botones con la API simulada; **no** con un cliente real. Copia previa en `/root/backups/avania-space-rediseno-20261024/` (archivos `*.pre-fichas`).

- **Logos en los enlaces (24-oct):** los campos «Espacio del proyecto en ClickUp» y «Carpeta compartida en Google Drive» (Antes de empezar) llevan ahora el logo de su aplicación junto a la caja y el botón «Abrir». En la cabecera de la ficha hay dos botones con esos logos: en color y con enlace si está puesto; en gris, que llevan a «Antes de empezar», si falta. Los logos están dibujados en línea (`APPS` en `public/fields.js`; un campo los usa con `app: 'clickup' | 'drive'` en `formdef.js`). Copia previa: `*.pre-iconos` en `/root/backups/avania-space-rediseno-20261024/`.

- **Lista de clientes, ajuste (24-oct):** la frase de lo que falta («Falta el acceso a Meta… y 5 más») se sustituye por **seis iconos**, uno por puerta (Meta, píxel, WhatsApp, credenciales, rodaje, formación): verde relleno = hecho, ámbar con borde discontinuo = pendiente; al pasar el ratón dice cuál es. La **categoría** pasa a su propia columna, alineada a la derecha (también en la vista de tabla). «Campaña activa» / «Pausada» salen en pequeño bajo el nombre. Copia previa: `app.js.pre-iconos-lista`.

- **Logos como imágenes (24-oct):** los dibujos en línea de ClickUp y Drive no se veían en el navegador de Pascual, así que pasan a ser archivos: `public/brand/google-drive.png` (el que envió Pascual, con el fondo blanco quitado) y `public/brand/clickup.png` (redibujado a partir de la imagen enviada, porque el adjunto no llegó como archivo; si hace falta el original exacto, sustituir ese PNG). El botón gris de la cabecera (enlace sin poner) sube de opacidad.

- **Oferta y paciente ideal, scroll (24-oct):** el visor de documentos ya no va fijo a la derecha: se mueve con la página. La rueda sobre el visor mueve la página (antes se quedaba atrapada en el documento); para desplazar el documento dentro del visor hay que pulsar en él, y vuelve a ceder la rueda a la página al sacar el ratón. Copia previa: `app.js.pre-visor`.

## 2026-10-24 (noche) · Accesibilidad (revisión con web-design-guidelines)

- **Etiquetas:** todos los campos de las fichas y del formulario del cliente tienen su `<label for>` enlazado, más `name` y `autocomplete="off"` (y sin corrector en URL, correo y teléfono). Igual en login, cambio de contraseña, perfil y bloqueo de credenciales.
- **Diálogos propios** (`openModal`, `askText`, `askConfirm`, `notice` en `public/fields.js`): rol de diálogo, foco atrapado, Esc, clic fuera y foco devuelto al cerrar. Sustituyen **todos** los `prompt`, `confirm` y `alert` (alta de cliente en un solo diálogo, categorías, servicio, nombre de llave, archivar, enlace nuevo, contraseña temporal con botón «Copiar», alta de usuario con correo, nombre y rol). Los diálogos que ya existían (contraseña, código, perfil, alta desde Funnels) pasan a usar el mismo.
- **Avisos para lectores de pantalla:** región viva para los avisos y para «Guardando / Guardado»; `role="alert"` en los errores; al cambiar de página el foco pasa al título; enlace «Saltar al contenido»; títulos sin saltos de nivel; botones «✕» con nombre; imágenes con tamaño; QR con texto alternativo.
- **Teclado:** las respuestas Sí/No pasan a botones con `aria-pressed` (antes `role=radio` sin flechas); el menú móvil cerrado ya no es enfocable.
- **URL:** búsqueda, estado, categoría, archivados y vista de la lista se guardan en la dirección (`#/?q=…&estado=…`) y sobreviven a recargar.
- **Estilo (solo `space.css`, el maestro no se toca):** texto secundario con contraste 4,5:1 (`--muted` más oscuro), etiquetas de categoría y «SPACE» con contraste suficiente, `prefers-reduced-motion`, `color-scheme`, `theme-color`, `overscroll-behavior` en diálogos, `touch-action`, `text-wrap: balance`, `preconnect` a Google Fonts.
- Fechas con `Intl.DateTimeFormat` según el idioma de la página (`lang="es"`).
- Comprobado con axe-core: **0 violaciones** en lista, ficha (resumen, empresa, Meta, enlaces) y formulario del cliente (inicio y Meta, en móvil), con datos simulados. Sin lector de pantalla real. Copia previa en `/root/backups/avania-space-a11y-20261024/`.
- **Queda:** el `@import` de la fuente sigue en el estilo maestro (`avania-ui.css:9`); sacarlo al HTML afectaría a los demás proyectos. El contraste del placeholder y el menú móvil se corrigen en `space.css`; si se quiere en el maestro, hay que pasar `sync.sh`.

## 2026-10-24 (noche) · Rediseño con Theme Factory: tema «Warm Clinic»

- **Tema propio «Warm Clinic»** (aprobado por Pascual; Inter y teal se mantienen): fondo crema `#faf7f2`, superficies blancas, líneas arena `#e7e2d9`, tinta `#1f2a2e`, texto secundario `#5b6670`, teal `#0f766e`, seafoam `#a8dadc` / menta `#e6f4f1` y teal profundo `#0b3b38` para la franja «¿Puedo lanzar?». Radios de 12 px (tarjetas) y 10 px (campos y botones). Modo oscuro verde grisáceo (`#101a19`, `#172625`). Todo es un bloque de variables al final de `public/space.css`; el estilo maestro no se ha tocado.
- **Menú lateral plano:** desaparecen los acordeones. Dentro de un cliente: su nombre, «Resumen», las secciones agrupadas por tema con su contador y los accesos (credenciales, enlaces, registro); la página actual lleva `aria-current`. `setSide` reescrito en `app.js`.
- **Formulario del cliente:** cada sección indica «Sección N de M» sobre el título (el avance ya estaba en la cabecera).
- Contraste y accesibilidad comprobados otra vez con axe-core: 0 violaciones en las 7 pantallas de prueba. Capturas revisadas en claro, oscuro y móvil, más login y seguridad. Copia previa: `/root/backups/avania-space-warm-20261024/`.
- **Queda:** emojis de títulos (🔑, 🔐) por iconos de línea; «Salir» queda al final del menú de un cliente y obliga a desplazarse en pantallas bajas; «No lo sé, que lo haga Avania» en los campos.

## 2026-10-24 (noche) · «No lo sé, que lo haga Avania», «Salir» fijo y fuera emojis

- **«No lo sé, que lo haga Avania»:** bajo cada campo que rellena la clínica (menos tablas, horario, documentos, calendario y casillas) hay un enlace con ese texto. Al pulsarlo el campo queda marcado «Lo hará Avania» (con «Deshacer») y cuenta como respondido en el avance de la clínica; si alguien lo rellena, la marca se quita sola. Se guarda en `data._avania` de cada sección (lista de claves de campo; `sanitizeSection` solo admite campos de la clínica y de esos tipos, `progress` la cuenta). Sin migración de base de datos.
- **Equipo:** el Resumen de la ficha muestra «Lo hará Avania (N)» con cada campo y su sección. En la vista del equipo solo se ve la marca (no el enlace, para no repetirlo bajo cada campo). Las puertas (Meta, píxel, WhatsApp) saben si están delegadas: el icono dice «pendiente (lo hará Avania)» y en el Resumen sale «(lo hará Avania)».
- **Clínica:** lo delegado sale en su propio bloque «Lo hará Avania · Os avisamos» y deja de pedirse en «Lo que necesitamos primero».
- **«Salir»** queda fijo al pie del menú, con línea de separación. **Emojis** de interfaz (☀️🌙🖥️, 🔑, 🔐, 🔒, 🗑, 🔎, ⧉) sustituidos por texto.
- axe-core: 0 violaciones en las 7 pantallas de prueba y en el formulario con campos delegados. Copia previa: `/root/backups/avania-space-nolose-20261024/`.
- **No probado** con un enlace de cliente real ni guardando en la base de datos real (solo la lógica del servidor por separado y la interfaz con API simulada).

## 24-oct · Menú del cliente en acordeón

- **Qué cambia:** dentro de un cliente, el menú lateral vuelve a ser de acordeones, pero distintos: cada bloque (Proyecto y empresa, Contenido y rodaje, Web, Google y Meta, Atención y WhatsApp, Cierre, Accesos) es una cabecera grande, en mayúsculas, con icono propio, contador (hechos/total) y degradado teal. Solo hay uno abierto: al abrir otro se cierra el anterior. «Resumen» queda fijo encima. Al entrar en una sección se abre su bloque; moverse dentro del bloque no lo cierra. Con el menú cerrado no se puede tabular a sus enlaces (`inert`).
- **Dónde:** `setSide` y la llamada en `clientView` (`public/app.js`), iconos `b_*`, y la sección «Menú del cliente en acordeón» al final de `public/space.css`. No toca el estilo maestro ni el servidor.
- **Probado** con API simulada en Chromium (claro y oscuro, 1360 px): abrir/cerrar exclusivo, apertura automática. **No probado** en móvil ni con un cliente real. Copia previa: `/root/backups/avania-space-pre-acordeon-20261024/`.

## 2026-10-27 · Esquema de Avania Space, fase 1

A partir del esquema que montó Pascual (artifact «AVANIA SPACE · Esquema»). Acordado: por fases; usuarios del cliente con cuenta propia por invitación (fase 2); alta por categoría con bloques comunes + los de su categoría; Bóveda de herramientas cifrada dentro de Space (fase 2). Copia previa: `/root/backups/avania-space-pre-fase1-20261027/`.

Hecho en la fase 1:
- **Panel general** (`#/panel`, ahora la entrada): clientes, en campaña, en onboarding, accesos por recibir; clientes activos por categoría; altas incompletas con % y días desde el inicio; accesos pendientes por cliente. API `GET /api/dashboard`.
- **Alta por categoría** (migración `010_esquema_fase1.sql`, `categories.sections`): cada categoría lleva solo las secciones que se marquen; `null` = alta completa (clínica dental). Las demás categorías existentes arrancan con la base: Antes de empezar, Empresa, Web/Google, Meta, Materiales y Cierre. Afecta al menú de la ficha, al formulario del cliente, al % de alta y a las puertas de lanzamiento (sin WhatsApp/rodaje/formación si no los lleva). «Gabinetes o sillones» solo sale en categorías dentales. Los datos ya guardados de secciones que una categoría no lleva se conservan, solo se ocultan.
- **Configuración** (`#/config`, administradores): plantilla de alta y color por categoría, tipos de enlace (nombre y dirección de inicio de sesión) y acceso a Equipo.
- **Ficha del cliente**: pestañas nuevas **Personas** (papel, correo, WhatsApp y «¿acceso al portal?»), **Horarios y calendario** (con última modificación), **Notas** (internas; interruptor «visible para el cliente»), **Documentos** (carpeta de Drive y documentos del alta) y, en **Enlaces**, la tarjeta «Herramientas del cliente» (tipo, enlace, inicio de sesión, acceso sí/no/pendiente, visible). El Resumen suma «Datos fiscales, teléfonos, WhatsApp y correos» (nuevo grupo 1.4 con teléfonos, WhatsApp y correos con etiqueta).
- **Clientes**: tercera vista «Fichas» (tarjetas con inicial, categoría, estado y % de alta).
- API nueva: notas, enlaces, tipos de enlace, `PUT /api/categories/:name`. Pruebas en `scripts/e2e-fase1.mjs` (20 en verde) y revisión en Chromium (escritorio y móvil) con un usuario y clientes de prueba, ya borrados.

Pendiente (fase 2): cuentas de los usuarios del cliente (responsable/miembro) con invitación, portal del cliente (inicio, barra de enlaces, avisos, «Mi equipo»), «Solicitar acceso» y su aviso en el panel, logo del cliente, Bóveda de herramientas (solo administradores, cifrada). Además: los estados del cliente (Rodaje, Formación) siguen siendo los de la clínica; hay que decidir si otras categorías llevan los suyos.

## 2026-10-27 (tarde) · Esquema de Avania Space, fase 2

Copia previa: `/root/backups/avania-space-pre-fase2-20261027/`. Migración `011_fase2.sql`.

- **Usuarios del cliente con cuenta propia** (`client_users`, otra tabla y otra cookie `sp_client` que el equipo: una sesión de cliente nunca abre el panel ni al revés). Roles: **responsable** (ve todo lo suyo, accesos incluidos, invita a su equipo) y **miembro** (rellena y consulta, no ve accesos). El equipo los da de alta en la pestaña **Equipo del cliente** de la ficha (invitación por correo de un solo uso, 48 h, como la del equipo; reenviar, cambiar rol, quitar acceso, eliminar). Un correo = un acceso al portal. Sin doble verificación: el cliente puede escribir contraseñas pero nunca leerlas.
- **Portal** (`/portal`, `public/portal.html` y `portal.js`): **Inicio** (avance, «lo siguiente», herramientas, avisos de AVANIA), **Mis datos** (personas y contactos, horarios y fechas), **Documentos** (su carpeta de Drive, solo ver), **Mi alta** (`/portal/alta`: el mismo formulario del enlace por token, ahora con sesión; el miembro no ve credenciales) y **Mi equipo** (solo responsable: invita y quita miembros). Cambiar contraseña desde el propio portal. El enlace por token `/f/…` sigue funcionando igual.
- **Barra de enlaces y «Solicitar acceso»:** el cliente ve solo los enlaces marcados «visible»; con acceso se abren, sin acceso aparece «Solicitar acceso». La solicitud llega al **Panel** (tarjeta «Solicitudes de acceso», botón «Atendida») sin duplicarse.
- **Logo del cliente:** se sube pulsando el cuadrado junto al nombre en la ficha (el navegador lo reduce a 256 px; PNG, JPG o WebP, nunca SVG). Sale en la ficha, en las tarjetas de Clientes y en el portal.
- **Bóveda de herramientas** (`#/boveda`, solo administradores, `src/vault.js`): tarjetas con nombre, categoría, para qué sirve, dirección, usuario, quién la usa, coste y renovación (en ámbar si vence en menos de 30 días). Contraseña y clave API **cifradas** como las credenciales; abrir la zona pide la contraseña de la cuenta (10 min) y ver o copiar un secreto exige además la doble verificación; todo queda en el registro de cada herramienta.
- Se quitó la columna «¿Acceso al portal?» de Personas: el acceso real se gestiona en Equipo del cliente.
- Pruebas: `scripts/e2e-fase2.mjs` (62 en verde: aislamiento entre clientes y entre equipo/cliente, miembro sin credenciales, solicitudes, logo, Bóveda cifrada y registro). Se ejecuta contra un servidor de pruebas sin correo (`PORT=3013 SMTP_HOST= node src/index.js`) para no mandar invitaciones reales. Revisado en Chromium (equipo, portal, móvil) con usuarios y clientes de prueba ya borrados.
- **Sin probar de verdad:** el correo de invitación a un cliente real (el envío usa el mismo SMTP que el del equipo, pero no se ha mandado ninguno).

## 2026-10-27 (noche) · Pasos por categoría, datos para medir e investigación de KPIs

Migración `012_estados_negocio.sql`.

- **Pasos del cliente por categoría** (`categories.statuses`): la clínica conserva Onboarding › Rodaje › Formación › Campaña activa › Pausada; el resto de categorías pasa a Onboarding › **Montaje** › Campaña activa › Pausada (nuevo estado «montaje»: campaña, embudo y CRM). Editable en Configuración (la categoría siempre conserva «Campaña activa»). El servidor rechaza un paso que la categoría no tiene.
- **Sección «Objetivos y datos para medir»** (`negocio`, solo equipo, dentro de Proyecto y empresa; la llevan todas las plantillas): valor medio de un cliente nuevo, tasa de cierre, ciclo de venta, margen, objetivos mensuales (leads, citas, clientes nuevos), coste máximo por lead, tiempo máximo de atención, fuentes y, para Avania Funnels, el ID del pipeline y el mapa de etapas (cada etapa de su pipeline → Nuevo lead · Contactado · Cita agendada · Asistió · Ganado · Perdido). Las secciones se renumeran (Oferta pasa a la 3, etc.); las claves de datos no cambian.
- **Investigación de Avania Funnels (solo lectura):** la conexión de agencia (MCP «Avania») ve las 8 subcuentas (clientes incluidos) y lee pipelines, oportunidades, contactos, calendarios, formularios y facturas. Los tokens de Space (`FUNNELS_TOKEN`, `FUNNELS_TOKEN_MARKETING`) leen oportunidades y calendarios, pero **solo de las dos subcuentas de AVANIA**: en la de un cliente responden 403. Para mostrar KPIs de cada cliente dentro de Space hace falta un token de lectura por cliente (o uno de agencia): decisión pendiente.
- Hallazgos: cada cliente tiene un pipeline distinto (SEDI 11 etapas, IDP 12, Duesthetic 14, Vifra 8); la oportunidad trae origen, campaña, anuncio y creativo (`attributions`), pero **`monetaryValue` está a 0 en todas** (no hay ingresos registrados); AF Mediación (seguros) tiene un pipeline heredado «[CRM] OBESIDAD». IDP: 1.020 oportunidades, 76 leads en 30 días, 21 en «Tratamiento aceptado».
- Pruebas: `scripts/e2e-fase1.mjs` sube a 29 (pasos por categoría, rechazo de estados ajenos, sección negocio solo del equipo).

## 2026-10-27 (noche) · Resultados: KPIs desde Avania Funnels, un token por cliente

Migración `013_funnels_cliente.sql`. Decisión de Pascual: opción (a), un token de solo lectura por cliente (no un acceso de agencia).

- **Conexión por cliente** (`client_funnels`, `src/kpis.js`): en la pestaña **Resultados** de la ficha, un administrador pega el token de la integración privada de la subcuenta del cliente. Se prueba contra la subcuenta antes de guardarlo (token falso o de otra subcuenta → rechazado), se **cifra** como las credenciales, no vuelve a salir por la API y queda registrado en el registro de accesos (conectar/desconectar). Pide la contraseña de la cuenta. Solo administradores conectan o desconectan; todo el equipo ve los KPIs.
- **KPIs** (últimos 30 días frente a los 30 anteriores, por cohorte de leads): leads y variación, tasa de contacto, de cita, de asistencia (y no asistencias), de cierre y de lead a cliente; leads sin atender hace más de 24 h; facturación (la de Funnels si hay `monetaryValue`; si no, clientes × valor medio de la ficha, marcada como estimada); coste por lead, cita y cliente y retorno **con la inversión prevista de la ficha** (no es el gasto real de Meta); objetivos del mes frente a lo previsto; embudo; campañas, creativos y fuentes; oportunidades abiertas por etapa. Caché de 15 min; botón «Actualizar».
- **Etapas → pasos del embudo:** se usa lo que el equipo indique en «Objetivos y datos para medir › Etapas del pipeline»; si no, se interpretan por el nombre (Visita RESERVA = cita, Reservado = ganado, «No contesta» = intento, etc.). La tabla acepta «No asistió» como paso. Con nombres muy raros la lectura automática se queda corta: conviene rellenar el mapa.
- **Privacidad:** de cada oportunidad solo se leen etapa, estado, origen, fechas, valor, campaña y creativo; no se guarda ni se muestra ningún nombre, teléfono ni correo.
- Pruebas: `scripts/e2e-fase3.mjs` (19 en verde, contra una subcuenta real en solo lectura, usando el token de AVANIA Clinical Dental como si fuera de un cliente; el cliente de prueba se borró) y `scripts/test-kpis.mjs` (22, cálculo y mapeo con datos sintéticos). Revisado en Chromium.
- **Pendiente:** crear el token de lectura en cada subcuenta de cliente (SEDI, IDP, Duesthetic, Vifra, AF Mediación) y conectarlo; rellenar valor medio y mapa de etapas; el gasto real de Meta Ads (hoy solo la inversión prevista); tiempo de primera respuesta (necesita conversaciones). AF Mediación tiene un pipeline heredado «[CRM] OBESIDAD».

### Carga automática de las etapas del pipeline (27-oct, noche)
- Al indicar el **ID del pipeline** en «Objetivos y datos para medir» de un cliente conectado a Avania Funnels, Space lee el pipeline y rellena **todas sus etapas**, en su orden, con el paso del embudo que parece corresponderles; las de intento («No contesta», «No localizable», «Anula reunión»…) quedan sin paso. Lo que el equipo ya hubiera indicado para una etapa se conserva al recargar. Si el cliente no está conectado o el ID no existe, avisa y no toca nada.
- Encima del formulario hay un selector con los pipelines de la subcuenta (para no tener que saber el ID) y el botón «Cargar etapas» / «Recargar etapas». API: `GET /api/clients/:id/funnels/pipelines` y `POST /api/clients/:id/funnels/stages`.
- Pruebas: `e2e-fase3.mjs` sube a 26 (carga completa, conservación de lo editado, ID inexistente, sin conexión) y `test-kpis.mjs` a 26.

## 2026-10-27 (noche) · Orden visual de Panel, Equipo y Seguridad

Revisión de Pascual: cajas desordenadas en el Panel, Equipo con otro formato y Seguridad mal repartida.
- **Panel:** cinco cifras arriba y una rejilla de dos columnas: «Altas incompletas» a la izquierda (alta) y, a la derecha, «Solicitudes de acceso» y «Accesos pendientes»; abajo, a todo el ancho, **«Clientes por categoría»** (cuántos clientes y cuántos en campaña por categoría; antes solo salían los activos y quedaba vacía). Las tarjetas de una fila miden lo mismo y llevan un contador. «Ver todos los clientes» sube a la cabecera. API: `/api/dashboard` suma `by_category`.
- **Equipo:** misma estructura que el resto (título, texto, tarjeta). La tabla suelta pasa a una tarjeta con filas alineadas por columnas (inicial, usuario, rol, doble verificación, estado y acciones); en móvil cada fila se apila con sus etiquetas. Las dos cajas de aviso se reducen a una (solo si falta la doble verificación) y un párrafo.
- **Seguridad:** dos columnas iguales, llave de acceso y código de app a la izquierda y cambiar contraseña a la derecha, con la misma altura; ya no queda medio ancho vacío.
- **Configuración y Clientes:** separación entre tarjetas apiladas, botones «Quitar/Borrar/Eliminar» en rojo discreto (contorno, no relleno) y el título «Clientes (N)» ya no se parte en dos líneas.
- **«Dar acceso al portal»** (Equipo del cliente): Correo, Nombre, Rol y «Enviar invitación» en una sola fila repartida por igual (clase `.fgrid`); en móvil, apilados.
- Estilos en `public/space.css` (bloques «Orden de Panel, Equipo y Seguridad» y «Formularios en una fila»). Revisado en Chromium, escritorio y móvil.

## 2026-10-27 (noche) · Lo privado de la agencia, por color y oculto al cliente; menú de administración abajo

- **Menú lateral:** la administración interna (Bóveda, Configuración, **Equipo agencia**, Seguridad) pasa a un bloque fijo abajo, encima de «Salir», con el rótulo «Administración». «Equipo» pasa a llamarse **«Equipo agencia»** para no confundirlo con «Equipo del cliente». Arriba quedan Panel y Clientes.
- **Privacidad (servidor, `src/index.js`):** el cliente ya **no recibe** lo que es solo de la agencia: ni las secciones enteras de equipo (Objetivos y datos para medir, Oferta) ni «Antes de empezar» (todos sus campos son de equipo; antes el cliente la veía en solo lectura) ni los campos de equipo dentro de sus secciones (p. ej. el número y el enlace de Avania Setex de WhatsApp). Se filtra en las respuestas del enlace y del portal, no solo en pantalla. Pruebas nuevas en `e2e-fase1.mjs` (33 en verde).
- **Colores:** navy `#14284b` = solo la agencia; ~~gris `#6b7280`~~ **verde `#16a34a`** (cambiado el mismo día porque el gris apenas se veía) = lo ve y rellena el cliente (más claros en modo oscuro: navy `#9db4e6`, verde `#4ade80`; variables `--agency` y `--client` en `space.css`). Aparecen en el menú de la ficha (barra lateral e icono de cada entrada, y de cada bloque si todo su contenido es del mismo tipo), con una leyenda bajo el nombre del cliente; junto al título de cada página («Solo agencia» / «Lo ve el cliente»); y en cada campo (barra lateral; los campos de agencia dentro de una sección del cliente llevan además la etiqueta «Solo agencia»). Excepción acordada con Pascual a la regla «nada de navy en Space»: el navy se usa solo para marcar lo privado.
- Pendiente de confirmar: reorganizar el menú de la ficha en dos zonas (agencia / cliente) y reducir las entradas.

- **Color del cliente: gris → verde** `#16a34a` (`#4ade80` en oscuro). Un solo cambio en `--client`.

## 2026-10-27 (noche) · Web y Google y Meta pasan a la zona protegida de credenciales

Petición de Pascual: las secciones «Web, dominio y Google» y «Meta: publicidad y redes» son de carácter restringido y van dentro de Credenciales.
- **Menú de la ficha:** desaparece el bloque «Web, Google y Meta» del alta. El grupo **«Accesos y credenciales»** reúne ahora Web y Google, Meta, Credenciales, Enlaces y Registro. Las tres primeras comparten una sola pantalla con pestañas (**Web y Google · Meta · Contraseñas**) y la misma puerta: hay que volver a escribir la contraseña de la cuenta (10 minutos de uso).
- **Restricción real, en el servidor (`src/index.js`):** sin contraseña reciente, `GET /api/clients/:id` no devuelve ningún valor de esas dos secciones (solo las marcas «lo hará Avania»); los datos salen por `GET /api/clients/:id/restricted` y guardar en ellas (`PUT …/sections/accesos|meta`) también exige la contraseña. Las puertas de lanzamiento y los porcentajes se siguen calculando igual. Pruebas nuevas en `e2e-fase1.mjs` (42 en verde).
- **Cliente:** sigue rellenando esas secciones, pero en su inicio van agrupadas con sus contraseñas bajo «Accesos y credenciales» (antes «Web, Google y Meta» y «Accesos» por separado).
- Pequeño arreglo: la etiqueta «Contraseña» de la pantalla de bloqueo ya queda encima del campo.

## 2026-10-27 (noche) · Vista de cliente

Botón **«Vista de cliente»** arriba, en la cabecera de cada ficha, **solo para administradores y superadministradores** (el miembro de la agencia no lo ve, y si fuerza la URL `?vista=cliente` sigue en la ficha normal; el servidor también lo rechaza con 403).
- **Qué hace:** cambia el menú y cada página a lo que realmente ve el cliente, en **solo lectura** (`inert`: no se puede pulsar ni escribir, y no se guarda nada). Una barra fija avisa («Así lo ve …») con un selector **Ver como: Responsable / Miembro** y «Salir de la vista de cliente».
- **Páginas:** Inicio (avance, lo siguiente, herramientas visibles y avisos; sin notas internas), Mis datos (personas y contactos, horarios), Documentos, Mi equipo (solo responsable), cada sección del alta de su categoría sin los campos de agencia, y Credenciales (solo responsable). Desaparecen del menú Resultados, Notas, Enlaces, Registro, «Antes de empezar», «Objetivos y datos para medir» y «Oferta». Las partes restringidas (Web y Google, Meta, Credenciales) piden la contraseña de la cuenta.
- **Idéntico al real:** el Inicio y Documentos usan las mismas piezas que el portal (`public/clientview.js`) y el servidor calcula el inicio con la misma función (`homeFor`, `GET /api/clients/:id/preview/home?role=`). Pruebas en `e2e-fase2.mjs` (68 en verde).

- **Arreglo en la Vista de cliente (27-oct):** el botón «Abrir carpeta» (Documentos) no funcionaba solo ahí, porque todo el contenido iba bloqueado con `inert`. Ahora los campos y botones se desactivan uno a uno y los enlaces internos no navegan, pero los que abren otra pestaña (Drive, herramientas) funcionan. En el portal real y en la ficha de agencia nunca falló.

## 2026-10-28 · Onboarding reestructurado en cinco áreas, con avance, prioridades, cronograma e informe

Petición de Pascual: ordenar el onboarding en 1) la empresa y quién la forma, 2) sus clientes, competencia y ofertas, 3) enlaces técnicos, 4) fechas de acciones, 5) nosotros (quién es quién en AVANIA y sus enlaces); con barra de avance, tareas priorizadas (nuestras y del cliente) e informe por correo al terminar. **Sin perder datos** (Paula Fernández, etc.): las claves de las secciones no cambian; las 29 secciones guardadas se compararon con la copia y son idénticas.
- **Áreas** (`BLOCKS` en `src/formdef.js`, numeradas 1.1, 1.2…): 1 `clinica`, `agenda`, `materiales` · 2 `mercado` (nueva), `oferta`, `negocio` · 3 `accesos`, `meta`, `whatsapp` + Bóveda de accesos (credenciales) · 4 `cronograma` (nueva), `rodaje`, `formacion`, `cierre` · 5 `proyecto`, `avania` (nueva).
- **Campos nuevos:** fecha de apertura, «¿Quiénes sois?», resto del equipo; mercado (tipos de cliente, competidores, ofertas, diferencial, objeciones); conclusiones de los análisis de AVANIA además de los enlaces; logotipos, tipografías y tono; enlaces de Google (Analytics, GTM, perfil de empresa, Search Console, Ads), ID de cuenta publicitaria y otras redes; acciones de AVANIA y del cliente con fecha, prioridad y estado; quién es quién en AVANIA.
- **Campos `shared`:** los rellena la agencia y el cliente los ve en solo lectura (quién es quién, acciones de AVANIA). Los `optional` no cuentan para el avance.
- **Avance** separado cliente / AVANIA y por área (`progress()`); al cliente no se le envía el avance interno de la agencia. Los campos dentales ya no cuentan para clientes no dentales.
- **Tareas y cronograma** (`src/plan.js`): tareas del cliente y de AVANIA con prioridad alta/media/baja (puertas de lanzamiento primero, vencidas suben a alta); cronograma con inicio, objetivo de 20 días, rodaje, formación, fechas señaladas y acciones.
- **Cierre e informe** (`src/report.js`, migración `014`): botón «Nuestra parte está terminada»; cuando también termina el cliente (marca todo en «Revisión final») sale un correo a `REPORT_TO` (.env, por defecto pascual.vila@avania.es) con lo visto, lo que falta, siguientes pasos, cronograma y puntos para la reunión. Una sola vez; también «Ver informe» y «Enviar informe ahora». Sin contraseñas.
- **Equipo de AVANIA:** directorio en Configuración (`agency_people`, sembrado con nombres y correos del equipo; roles y responsabilidades por rellenar) y botón «Cargar el equipo de AVANIA» en la ficha de cada cliente.
- **Nosotros** muestra los enlaces del cliente: Drive, Avania Funnels, Avania Setex y ClickUp.
- Arreglado de paso un icono SVG roto (`doc`) que daba error en consola.
- Pruebas: `scripts/e2e-onboarding.mjs` (nueva, 30 en verde), `e2e-fase1` y `e2e-fase2` en verde; revisado en Chromium escritorio y móvil. Copia previa en `/root/backups/avania-space-pre-onboarding-20261028`.
- Pendiente: Pascual rellena roles/responsabilidades en Configuración; no se ha enviado ningún correo de prueba del informe; el avance de Paula baja porque hay campos nuevos por rellenar.

## 2026-10-28 (tarde) · Orden de la ficha, cronograma de procesos, hitos editables y menú plano

- **Empresa y marca:** filas de la rejilla que suman 12, área de influencia en una fila, «Marca, logotipos y materiales» en tres bloques. «Huecos de primera visita» pasa a número y se añade «Horarios de primeras visitas» (los textos antiguos de Paula y SEDI se movieron a ese campo, sin perder nada).
- **Formulario:** sin subetiquetas bajo los campos, sin barra verde lateral (el color de quién lo ve queda en iconos del menú y etiqueta de página), menos aire entre campos (se quitó el hueco reservado de «No lo sé, que lo haga Avania»).
- **Cronograma de fechas:** firma del contrato, inicio real y objetivo de montaje son editables en el propio cronograma (se guardan al momento). El objetivo son **20 días laborables** (lunes a viernes) desde el inicio, calculado salvo que se fije a mano. Se pueden añadir acciones rápidas. Los 20-oct de Paula pasaron a «Firma del contrato» y el inicio real quedó vacío.
- **Página «Cronograma» (menú propio, la ve el cliente):** las 14 fases desde los documentos de investigación hasta la primera revisión de resultados (guiones, aprobación de guiones, diseño, fechas de grabación, envío de guiones, rodaje, edición, copies, montaje de campañas, aprobación, formación, fecha de lanzamiento estimada, primera revisión). Estado, quién, fecha, orden y fases propias editables (`PUT /api/clients/:id/proceso`, guardado en `client_sections` clave `proceso`); suma «próximas acciones» y las fechas. También en el portal, el enlace por token, la vista de cliente y el informe.
- **Menú plano:** Empresa · Análisis · Enlaces · Fechas · Avania · Gestión, nombres cortos (`short` en `formdef.js`), filas pequeñas sin recuadros ni degradados (bloque final de `space.css`).
- **Enlaces de AVANIA del cliente:** fichas con el logo de Drive y ClickUp y una inicial para Funnels y Setex (el icono de cadena salía sin tamaño).
- Icono SVG roto de «doc» corregido. Pruebas: `e2e-onboarding` en verde; revisado en Chromium, escritorio y móvil.
- **Fechas (28-oct):** al teclear un año el navegador daba por buena «0002-11-02», se guardaba y la pantalla se redibujaba a mitad. Ahora todas las entradas de fecha (cronograma, fases, campos y tablas de la ficha) solo guardan con año de cuatro cifras (2000-2100) y el servidor ignora años absurdos.
- **Menús y ayuda (28-oct):** la leyenda «Solo agencia / Lo ve el cliente» pasa abajo, en Administración (solo la ve la agencia, y solo dentro de la ficha). «Cómo se hace» pasa a un icono «?» arriba a la derecha, junto a Drive (ficha y formulario del cliente), que abre la guía con su texto y vídeo.
- **Objetivos:** con la subcuenta conectada ya no se pide el ID del pipeline: con uno solo se elige y carga solo (Paula quedó con «[SEDI] Pipeline Clinica» y sus 11 etapas) y con varios sale un selector que carga las etapas al elegir. Sin conectar sigue el campo de ID a mano.
- **Documentos:** la pestaña (y «Documentos» del portal) lista los archivos de la carpeta de Drive del cliente, con tipo, **carpeta en la que está** y fecha, leídos de Google Drive (`src/drive.js`, solo lectura, hasta 3 niveles de subcarpetas, caché de 5 min, botón Actualizar). **Falta conectar Google:** hace falta una cuenta de servicio de Google (`GOOGLE_SA_FILE` en `.env`, ruta del JSON) y compartir con su correo (como lector) la carpeta de marketing de cada cliente. Sin eso, la agencia ve un aviso y el cliente no ve nada. Probado solo contra un Drive simulado.
- **Visibilidad (28-oct):** «Nuestros análisis» y «Objetivos y datos para medir» pasan a verse por el cliente en solo lectura (el ID del pipeline y sus etapas siguen siendo internos). Se ven valor medio, tasa de cierre y margen: si no quieres enseñar alguno, hay que marcarlo como interno en `formdef.js`.
- **Aspecto (28-oct):** introducciones corridas (sin recuadro), tarjetas con el mismo relleno, vista previa a la par de las tarjetas (Marca y Análisis), calendario del rodaje con sala, ruido, franja y notas a su derecha, casillas de la revisión final alineadas a la izquierda, menús planos pero con fichas de color suave en los iconos y fondo tenue en lo activo, Resultados con color por tipo de dato (tarjetas, embudo y objetivos en degradado, deltas verde/rojo) y rejilla de 4 columnas que reparte la última fila.

## Pendiente

- **Copia de `CREDENTIALS_KEY` fuera del servidor** (sin ella, las contraseñas guardadas no se recuperan). No consta que se haya hecho.
- **Token de la integración de Avania Funnels:** se pegó en un chat; regenerarlo si tiene permisos de escritura.
- **Probar el botón «+ Nuevo usuario»** de la pantalla con una dirección de prueba.
- **Decidir** si «Nueva contraseña» también debe mandar un correo con enlace, como el alta.
- **Actualizar `scripts/e2e.mjs`** a la nueva sección 2 del formulario (falla «cliente guarda sección»).
- **Revisar en el navegador** el menú lateral y las credenciales desplegables, y la pantalla de bloqueo de credenciales en el navegador (solo se ha probado el servidor).
- **Commit:** los cambios del 23-oct están sin confirmar en git, junto con otros cambios en `formdef.js`, `fields.js`, `form.js`, `space.css`, `ayuda.json` y `.env.example` que no son de esta sesión.
- Que Andrea y Jesús elijan su contraseña y activen la doble verificación.

- **Rediseño, siguientes pasos:** un solo desbloqueo para credenciales, sustituir `prompt`/`alert`/`confirm`, y la agrupación «Esperando a nosotros» (hoy solo se distingue «esperando al cliente»).

## Referencia rápida

- Arrancar: `npm start` (en el servidor lo lleva PM2: `pm2 restart avania-space`).
- Migraciones: `npm run migrate`.
- Primer superadministrador: `npm run superadmin -- correo "Nombre"`.
- Invitar a alguien: `node scripts/invitar.js correo "Nombre" member|admin`.
- Prueba de permisos, cifrado y enlace de cliente: `node scripts/e2e.mjs`.
- Variables de `.env` (solo nombres): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, `CREDENTIALS_KEY`, `PORT`, `FUNNELS_TOKEN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_REPLY_TO`, `PUBLIC_URL`.
- Archivos clave: `src/index.js` (rutas), `src/auth.js` (sesión, roles, doble verificación), `src/crypto.js` (cifrado), `src/formdef.js` (el formulario), `src/funnels.js` (lectura del CRM), `src/mailer.js` y `src/invite.js` (correo).

## 2026-10-27 · «Clínica» pasa a «empresa»

- Todos los textos visibles que hablaban de «la clínica» como cliente ahora dicen «la empresa» (formulario de onboarding, alta de cliente, avisos, ayudas). Ejemplos: «Nombre de la empresa», «Teléfono principal de la empresa», «Horarios de la empresa».
- Un cliente nuevo sin nombre ya no se llama «Clínica de …»: usa el nombre del contacto tal cual.
- No se tocó por dentro: la clave interna de la sección (`clinica`), el nombre de la subcuenta «AVANIA Clinical Dental» y el campo de Funnels «¿Cuál es tu rol en la clínica?», que se llaman así en origen.
- Quedan palabras de ámbito dental (pacientes, doctor, gabinetes) en el formulario; pendiente de decidir si también se generalizan.

## 29-oct — Accesos de Google Analytics y Tag Manager en la Bóveda
- Revisión: ninguno de los 5 clientes tenía filas de «Google Analytics» ni «Google Tag Manager» en la Bóveda. En el formulario («Web y Google»), SEDI y la Clínica de Paula Fernández marcan «¿Los tenéis dados de alta?» pero ningún cliente ha rellenado el enlace de Analytics ni el ID de GTM.
- Se han creado las dos filas, en estado `pendiente` y sin datos, en los 5 clientes (10 filas), para poder solicitarlas desde la pestaña de credenciales.
- `SUGGESTED` (src/formdef.js) ahora incluye ambos servicios: los clientes nuevos las traen de serie (requiere reiniciar `avania-space`).

## 29-oct — Preguntas de tratamientos, precios y primera visita en «La empresa»
- Revisado: ninguna de estas preguntas estaba en los formularios. Solo había «Ofertas y servicios» (con precio) en Mercado y el horario general de la empresa en Horarios y equipo.
- Nueva fila 1.5 «Tratamientos, precios y primera visita» en la sección Empresa (`clinica`): `tratamientos` (tabla tratamiento / precio o rango / notas), `financiacion` + `financiacion_detalle`, `primera_visita` (gratuita / de pago / depende) + `primera_incluye` (escáner 3D, simulación…) y `referentes` (casos, nivel Invisalign, máster o título, reseñas y nota en Google). Marcados `dental`: solo cuentan en el progreso de las empresas dentales.
- En 1.4 Teléfonos, WhatsApp y correos: columna «Horario de atención» en las tablas de teléfonos y WhatsApp, y pregunta `fuera_horario` («¿Qué pasa si escriben o llaman cuando nadie atiende?»). La web ya estaba en Datos de la empresa.
- Las claves nuevas no tocan los datos ya guardados. Reiniciado `avania-space`.

## 29-oct — «Objetivos y datos para medir» solo para el equipo
- La sección `negocio` (valor de un cliente nuevo, objetivos mensuales, pipeline y etapas) estaba marcada como compartida: el cliente la veía en solo lectura. Ya no: es solo del equipo de AVANIA y el servidor no se la envía al cliente (ni por enlace ni por portal). Texto de la sección corregido.
- «Nuestros análisis» (`oferta`) sigue compartido en solo lectura.
- Los resultados del portal (`/api/p/kpis`) se calculan con esos datos y no cambian: el cliente sigue viendo leads, citas y ventas.
- **Sin referencias a «Objetivos y datos para medir» en lo que ve el cliente (29-oct):** `/api/formdef` sin sesión de equipo ya no envía las secciones ni los campos solo de la agencia (ni su título ni su texto) y quita esa sección de las áreas. Los resultados del portal (`/api/p/kpis`) ya no llevan los objetivos, el valor medio ni el mapeo de etapas, y no se enseña la facturación estimada con el valor medio ni el retorno calculado con ella (sí la facturación real de Funnels y los costes por lead, cita y cliente con la inversión de Meta).
- **Cabecera de la ficha del cliente (29-oct):** los botones grandes pasan a iconos pequeños arriba a la derecha, con el nombre al pasar el ratón: vista de cliente (relleno), copiar enlace, Avania Funnels (discontinuo si falta el ID de la subcuenta), ClickUp, Drive y ayuda. `iconBtn()` en public/app.js; estilos `.ibtn` en space.css.

## 29-oct — Respuestas de Paula Fernández en «La empresa» (1.5)
- Cargadas en Clínica de Paula Fernández Riveiro → La empresa → «1.5 Tratamientos, precios y primera visita», a partir de sus mensajes de WhatsApp: tabla de tratamientos con rangos, financiación (sin intereses a 6 meses, 1 año o 15 meses, y CaixaBank con cuota reducida), primera visita, y referentes (certificada en Invisalign desde los inicios, Platinum en 2019, ya no trabaja con la marca).
- La opción «Depende del tratamiento» de `primera_visita` pasa a «Depende»: en su caso es gratuita si hace el estudio y 40 € si no, y el detalle va en «¿Qué incluye la primera visita?».

## 29-oct — Palabras de ámbito dental generalizadas y prueba del informe
- Textos visibles de `formdef.js`, `report.js` y `ayuda.json`: «paciente(s)» pasa a «cliente(s)», «doctor/doctora» a «profesional» y «gabinete» a «sala de trabajo». Las claves internas (`doctor`, `cargo_doctor`, `gabinetes`) y los campos marcados `dental` (financiación, Invisalign, número de gabinetes) no se tocan. La frase del RGPD ya no da por hecho que sean datos de salud.
- Prueba real del informe: `node scripts/probar-informe.mjs [nombre]` envía el informe de un cliente a `REPORT_TO` con asunto «[PRUEBA]» y sin marcar `report_sent_at`. Enviado a pascual.vila@avania.es con Clínica de Paula Fernández (SMTP respondió «queued»). Reiniciado `avania-space`.

## 29-oct — Menú de la ficha: menos pestañas
- «Equipo del cliente» pasa dentro de «Personas» (debajo de la tabla de personas) y «Notas» dentro de «Documentos» (debajo de la carpeta de Drive). El menú pierde dos entradas; los enlaces antiguos `#/c/<id>/equipo` y `/notas` abren la pestaña nueva. Cambio en `public/app.js` (`pages`, alias de pestaña y ramas `personas` y `documentos`).
- Probado en Chromium (1360 y 390 px) con API simulada: sin errores de consola, y los cuatro bloques se ven en su sitio.
- No se ha tocado la vista del cliente (portal), donde «Mi equipo» sigue aparte.

## 29-oct — Mapa y estudio sociodemográfico de la zona
- En La empresa → Datos, justo debajo de «Área de influencia», hay un desplegable «Mapa y estudio de la zona» (solo equipo). Lee dirección, ciudad, radio y localidades del propio formulario; no hay campos nuevos.
- Mapa (Leaflet 1.9.4 desde cdnjs + teselas OpenStreetMap): chincheta azul para la empresa con el círculo del radio y verdes para cada localidad. Se sitúan con Nominatim (1 petición/s, caché de 90 días en `cache/`).
- Estudio: datos oficiales por municipio del Atlas de distribución de renta de los hogares del INE (operación 353; hoy año 2024): población, edad media, % menores de 18 y de 65 o más, personas por hogar, hogares unipersonales, % población española, renta neta por persona y por hogar. Total con media ponderada por población y un texto de «Lectura de la zona». Si un dato no existe se muestra «—» o «Sin dato municipal»; un barrio o pedanía usa los datos de su municipio.
- Código: `src/zona.js` (ruta `GET /api/clients/:id/zona` en `src/index.js`) y `zonaCard` en `public/extra.js`. La tabla del INE de cada provincia está fijada en `RENTA_TABLE` (comprobada contra municipios de las 52 provincias); la de demografía se resuelve por posición. Caché en disco de un mes por provincia.
- Límites: máximo 15 localidades; si la dirección cae en otro municipio que la ciudad indicada se usa el centro de la ciudad y se avisa. No se calculan municipios dentro del radio que no estén escritos en «Localidades».
- Probado en Chromium (1360 y 390 px) con Toledo, Olías del Rey, Bargas, Sonseca e Illescas.

## 29-oct — «Área de influencia» pasa a su propia pestaña
- Menú de Empresa: Datos · Área de influencia · Horarios · Marca. Es una sección nueva (`zona`) con los mismos tres campos (radio, localidades, zonas a excluir); la numeración sale sola (1.2 Área de influencia, 1.3 Horarios, 1.4 Marca).
- Migración `sql/016_area_influencia_seccion.sql` (aplicada): copia esos tres campos, y sus marcas «lo hará Avania», de `clinica` a `zona` (2 clientes tenían datos) y los quita de `clinica`; las categorías con plantilla que llevaban Datos añaden `zona`.
- El mapa y estudio de la zona vive ahora en esa pestaña, con un botón más grande («Ver mapa y estudio de la zona»). `GET /api/clients/:id/zona` lee dirección y ciudad de Datos, y radio y localidades de Área de influencia.
- Mapa: las teselas de OpenStreetMap exigen referer; se pide `referrerPolicy: 'origin'` en la capa porque la cabecera general es `no-referrer`.

## 29-oct — Mapa: pestaña abierta, tabla en tarjeta y chincheta exacta de la empresa
- El mapa y estudio de la zona ya no es un desplegable: sale abierto y carga al entrar en Área de influencia. La tabla de datos va en una tarjeta blanca con esquinas redondeadas y los miles se escriben siempre con punto.
- Dirección de la empresa (`locateAddress` en `src/zona.js`): se limpia como la escribiría una persona (C/ → Calle, quita «Local 11», «Bajo», «1º A», «España»…) y se busca primero en CartoCiudad (callejero oficial del IGN, con número de portal y comprobando municipio, número y nombre de la calle); si no, OpenStreetMap a nivel de calle; y como último recurso el centro de la ciudad. Cada resultado lleva `precision`: portal, calle o ciudad, y el panel lo dice (en naranja si no es el portal exacto).
- La empresa se marca con una chincheta azul en forma de gota con un edificio dentro, más grande y siempre con su etiqueta; las localidades siguen siendo puntos verdes.
- Con las direcciones reales de hoy: Paula Fernández (Vigo) sale en el portal exacto; SEDI (C/ Guadarrama 71, Toledo) no existe con ese nombre en el callejero de Toledo capital y sale en el centro de la ciudad con aviso (revisar cómo está escrita).

## 29-oct — Documentos: subir archivos y vista previa
- **Subir:** nueva tarjeta «Documentos del cliente» en la pestaña Documentos: botón «Subir documentos» o arrastrar archivos (hasta 15 MB cada uno; se guardan en la base de datos, tabla `client_files`, `sql/017_client_files.sql`). Cada uno tiene Ver, Descargar y quitar. Solo los ve el equipo.
- **Rutas:** `GET/POST /api/clients/:id/files`, `GET/DELETE /api/clients/:id/files/:fid`. La subida va en binario y exige la cabecera `X-Space-Upload: 1` (sustituye a «solo JSON» como freno de CSRF en esa ruta).
- **Seguridad:** PDF, imágenes (png, jpg, webp, gif) y texto plano se muestran dentro; el resto (Word, Excel, HTML, SVG…) siempre se descarga. Solo esa ruta se puede enmarcar (`X-Frame-Options: SAMEORIGIN`).
- **Vista previa:** vuelve el panel de la derecha en Documentos. Se abre con «Ver» en los archivos subidos, en «Documentos del alta» y en «Ver aquí» de cada archivo de la carpeta de Drive. Word y Excel subidos no se pueden previsualizar (se dice y se ofrece descargar); los de Drive sí.
- La cabecera de la pestaña ya no dice «Lo ve el cliente»: Documentos y notas es solo de la agencia.
- Prueba: `node scripts/e2e-archivos.mjs` (11 comprobaciones, cliente y usuario de prueba que se borran al terminar).

## 30-oct — Icono «enviar correo» en los correos de los clientes
- Junto a cada correo de una persona del cliente sale un sobre (`.mailbtn`, `mailLink` en `public/fields.js`) que abre el programa de correo con un mensaje nuevo para esa dirección (`mailto:`). Está en: tablas «Responsables» y «Correos generales» (La empresa), campos de tipo correo y lista «Equipo del cliente» (usuarios del portal) en Personas.
- Solo en la vista del equipo; el sobre se oculta si lo escrito no es un correo válido y sigue lo que se escribe.
- No lo llevan los correos del equipo de AVANIA («Equipo de AVANIA», directorio de Configuración y usuarios de la agencia), ni el portal del cliente.

## 30-oct — Documentos y notas: fuera la carpeta de Drive
- Se quitan de la pestaña Documentos las tarjetas «Carpeta de Google Drive» y «Documentos de la carpeta» (el acceso a Drive ya está en el icono de la cabecera de la ficha). Quedan: Documentos del cliente (subidas), Documentos del alta y Notas. El portal del cliente sigue con su sección de Drive.

## 30-oct — Drive: árbol de carpetas y carpeta principal de marketing
- `src/drive.js` devuelve ahora el árbol (carpetas y subcarpetas con sus documentos, 3 niveles) en vez de una lista plana.
- Carpeta principal: `DRIVE_ROOT_FOLDER` en .env (enlace de la carpeta MARKETING). Un cliente solo puede enlazar una carpeta que cuelgue de ella; si no, el equipo ve «no está dentro de la carpeta principal» y el cliente no ve nada.
- Pantalla (agencia y portal): carpetas desplegables con su número de documentos; cada documento abre en Drive.
- Sigue pendiente la cuenta de servicio de Google (`GOOGLE_SA_FILE`) y compartir con ella la carpeta MARKETING; probado con un Google simulado.

## 30-oct — Drive: una carpeta, un cliente
- Al guardar «Carpeta compartida en Google Drive» (Proyecto) se rechaza si esa misma carpeta ya está en otro cliente. El cliente nunca elige carpeta: el portal lee solo la que el equipo enlazó a su ficha.
- Se rechaza también enlazar la carpeta principal de marketing a un cliente (al guardar y al leer): cada cliente necesita su subcarpeta propia.

## 30-oct — Drive: estructura [CLIENTES] / cliente / MARKETING
- Corrección: la carpeta que se dio como «principal» era en realidad el MARKETING de Paula Fernández. La estructura real es `[CLIENTES] AVANIA TODOS / <cliente> / MARKETING / carpetas`.
- `DRIVE_ROOT_FOLDER` ahora es la carpeta [CLIENTES]. A un cliente solo se le puede enlazar una carpeta llamada MARKETING que cuelgue de una carpeta de cliente dentro de [CLIENTES]; se rechaza la raíz, la carpeta del cliente entera y cualquier otra. Probado con Google simulado.
- La cuenta de servicio debe tener acceso de lector a [CLIENTES] (para poder comprobar el origen de cada carpeta); Space solo enseña al cliente lo que hay dentro de su MARKETING.

## 30-oct — Drive: la cuenta de servicio solo ve las MARKETING que se le comparten
- Cambio de criterio: no se comparte [CLIENTES] con la cuenta de servicio, solo la carpeta MARKETING de cada cliente, una a una. Se quita `DRIVE_ROOT_FOLDER` del .env (queda como opción en `drive.js`).
- Al leer se exige que la carpeta enlazada se llame MARKETING; el resto lo garantiza el propio Drive (lo que no se comparte con la cuenta, Space no lo puede leer). Se mantiene el rechazo de carpeta repetida en dos clientes.

## 30-oct — Drive conectado
- Cuenta de servicio `space-drive-lector@avania-space.iam.gserviceaccount.com` en `secrets/google-drive.json` (permisos 600), `GOOGLE_SA_FILE` en el .env, Space reiniciado.
- Probado con Drive real: la MARKETING de Paula Fernández (ya enlazada en su ficha) se lee entera (108 documentos, 5 carpetas). [CLIENTES] y la carpeta del cliente dan «sin permiso» (no compartidas) y una subcarpeta se rechaza por no llamarse MARKETING.

## 30-oct — Portal del cliente al ancho de la vista del equipo + Drive en Documentos
- Portal: mismo ancho que la vista del equipo (1180 px, antes 760), cabecera en una sola línea y reparto en dos columnas en escritorio (Inicio: avance y tareas a la izquierda, proyecto, fechas, herramientas y avisos a la derecha; Documentos: carpeta y árbol). En móvil sigue una columna. Clase `portal` en el body y `.cols` en `space.css`; solo afecta al portal (el formulario de alta sigue en 760).
- Documentos de la vista del equipo vuelve a enseñar el árbol de carpetas de Drive del cliente (con «Ver aquí» en el visor), con avisos técnicos si falta compartir la carpeta.

## 30-oct — Vista de cliente: más ancha y con carpetas que se abren
- La «Vista de cliente» (ficha del equipo) seguía con 760 px (`.pvpage`) y bloqueaba todos los clics (solo lectura): ahora ocupa el ancho de la ficha (1124 px), con dos columnas solo en pantallas de 1300 px o más, y las carpetas de Drive se abren y cierran y «Actualizar» funciona. El resto sigue bloqueado.
- Pendiente de decidir: unificar «Documentos del cliente» (subidas a Space) con el Drive subiendo directamente a Drive; la cuenta de servicio hoy es solo lectura y Google no deja a una cuenta de servicio crear archivos en carpetas de «Mi unidad» de otro usuario.

## 30-oct — Cronograma: las fechas de la empresa ya no se mezclan con las del proyecto
- `timelineOf` (src/plan.js) dejaba entrar las «Fechas señaladas» de Empresa › Horarios (aniversarios, festivos, cierres) en las fechas del proyecto, tanto en la ficha como en el portal y en el informe. Se quitan: el cronograma solo lleva firma, inicio, montaje, rodaje, formación, fases y acciones. Los textos explicativos lo dicen.

## 30-oct — «Ver cliente»: el superadministrador decide qué ve cada cliente
- Migración 018: `clients.client_view` (solo guarda los cambios hechos a mano). Valores de fábrica en `src/visibility.js`: lo que el cliente ya veía sigue viéndose (Cronograma, Resultados, Personas, Documentos, Credenciales y las secciones del alta, incluida Área de influencia) y lo interno de la agencia sigue oculto (Resumen, Enlaces, Registro, Objetivos, Proyecto).
- Ficha del cliente: la etiqueta «Lo ve el cliente / Solo agencia» de cada página pasa a ser la casilla **Ver cliente** (solo superadministrador; el resto del equipo ve el estado). `PUT /api/clients/:id/client-view`. El menú de la ficha pinta cada opción según el estado.
- Portal: el menú se arma con esas casillas y el servidor lo comprueba en cada petición (formulario del alta, guardar secciones, credenciales, Resultados, Drive, Inicio) con un 403 si está desactivado. Páginas nuevas: **Área de influencia** (mapa y estudio de la zona, `/api/p/zona`) e **Información** (secciones internas que se activen, solo lectura y sin contraseñas, `/api/p/shared`).
- «Vista de cliente» de la ficha usa los mismos ajustes.

## 30-oct — Documentos: solo la carpeta de Drive
- La pestaña Documentos de la ficha deja solo «Documentos de la carpeta» (árbol de Drive) y las Notas: se quitan «Documentos del cliente» (subidas a Space) y «Documentos del alta». Los 4 archivos .gdoc ya subidos siguen guardados en la base pero no se muestran en ningún sitio.
- Botón **Subir documentos** (super_admin y admin): elige la carpeta de destino, permite crear una carpeta nueva dentro de la elegida (`POST /api/clients/:id/drive/folders`, `createFolder` en `src/drive.js`, comprueba que cuelgue de la carpeta MARKETING del cliente) y abre esa carpeta en Drive para arrastrar los archivos.
- Comprobado con Drive real: la cuenta de servicio es editora de MARKETING de Paula y crear carpetas funciona (carpeta de prueba creada y borrada); subir archivos da 403 «Service Accounts do not have storage quota» (Google no da espacio a las cuentas de servicio en «Mi unidad»). Para subir archivos desde Space haría falta una unidad compartida, delegación de dominio o OAuth con una cuenta de usuario.
- `createFolder` usa el permiso de escritura de Drive solo para crear carpetas; el resto sigue siendo lectura.

## 30-oct — Documentos: explorador de archivos y vista previa en ventana emergente
- La lista de Drive pasa a ser un explorador: árbol de carpetas a la izquierda (con número de documentos), a la derecha miga de pan, tarjetas de subcarpetas y tabla de archivos con icono por tipo (PDF, DOC, XLS, PPT, IMG, VID, AUD), tipo, tamaño, fecha de modificación (la de subida, al pasar el ratón), quién lo tocó (solo equipo) y botón Ver. Columnas ordenables y buscador por nombre en todo el árbol. En móvil, una columna. Drive aporta ahora `size`, `createdTime` y `lastModifyingUser`.
- La vista previa («Ver») se abre en una ventana emergente con X (y Esc) en lugar del panel lateral; ya no se reserva ese espacio en Documentos ni en las secciones con documentos.
- Drive no tiene estado de «realizado»: si se quiere, habría que marcarlo en Space por archivo.

## 30-oct — Documentos del cliente en su propia voz
- En el portal y en la «Vista de cliente», Documentos habla al cliente («Vuestros documentos», «Aquí tenéis los materiales, informes y documentos de vuestro proyecto…», buscador y mensajes de carpeta vacía en segunda persona del plural), sin la tarjeta repetida de la carpeta: el botón «Abrir en Google Drive» va en la cabecera del explorador. La carpeta raíz se llama «Todos los documentos» y no muestra el nombre interno MARKETING. Sin «Subir documentos», «Ver» ni la columna «Por», que son del equipo. Si Drive no responde, el cliente ve un aviso con el botón de abrir la carpeta en lugar de nada.

## 30-oct — «Vista de cliente» con lectura y escritura
- La «Vista de cliente» de la ficha ya no es solo lectura: campos y botones funcionan y lo que se cambia (teléfonos, correos, dirección, fechas…) se guarda en la ficha del cliente con el mismo guardado de la ficha (`PUT /api/clients/:id/sections/:clave`); Credenciales usa también los accesos del equipo. Lo único que sigue de solo lectura es «Información» (lo interno que el superadministrador decide enseñar) y los enlaces que llevan al portal del cliente (no hay sesión de cliente aquí).
- Probado con una maqueta: se cambia un campo y sale el `PUT` a la sección.

## 30-oct — Roles del equipo de AVANIA
- Directorio del equipo (Configuración › `agency_people`): Pascual Vila → CEO y estrategia; Andrea Navarro → Estrategia y análisis; Jesús Vizcaino → Programación (las responsabilidades quedan como estaban: solo Jesús tiene «Área técnica»).

## 30-oct — Horarios: las horas siempre se pueden escribir
- En el horario de Empresa › Horarios, las horas de un día «cerrado» estaban desactivadas hasta pulsar el interruptor del día, y parecía que no se podía editar (también en el portal). Ahora nunca se desactivan: un día cerrado se atenúa y, al escribir una hora, pasa solo a abierto.
- Pendiente de decidir con Pascual: los campos que son de AVANIA (sección Proyecto y alguno suelto en WhatsApp y Cronograma) siguen sin poder tocarlos el cliente; ver riesgos (enlace de Drive y subcuenta de Funnels).

## 30-oct — Todo editable para el cliente (salvo Drive, Funnels y categoría) y tablas de equipo
- Nuevo marcador `clientEdit: true` en `formdef.js`: el campo sigue siendo de AVANIA a efectos de avance, pero el cliente lo ve y lo edita. Puesto en: Proyecto (firma, inicio real, objetivo de montaje, responsable de cuenta, espacio de ClickUp), WhatsApp (número y enlace de Avania Setex) y Calendario de acciones (Acciones de AVANIA). La sección Proyecto pasa a verse en el alta del cliente con esos cinco campos. **Siguen solo de la agencia**: carpeta de Drive, ID de la subcuenta de Funnels y categoría (el cliente podría leer los datos de otro cliente o cambiar su plantilla). El servidor los descarta aunque se los envíen. Comprobado contra el servidor real con un usuario de portal temporal (borrado después).
- Tablas: una sola fila de salida (antes tres en blanco), se puede quitar también la última y, vacía, enseña «Nada añadido todavía». «Responsables» pasa a llamarse **Equipo** (y «Resto del equipo» a «Resto de la plantilla»); el informe dice «Equipo:».
- El error al borrar filas del equipo no se reprodujo contra el servidor real (ficha, vista de cliente y portal guardan bien con las filas vaciadas); si vuelve a salir, hace falta el texto exacto del mensaje.
- Pendiente de decidir: mover la parametrización de la cuenta (categoría, carpeta de Drive, subcuenta de Funnels) a una tarjeta de «Configuración de la agencia».

## 31-oct — Alta «desde Avania Funnels» con el ID de la subcuenta
- La ventana «+ Desde Avania Funnels» ya no pide el ID de un contacto ni consulta el CRM: pide nombre de la empresa, **ID de la subcuenta** de Avania Funnels (la ya creada para el cliente), ciudad opcional y categoría. El ID se guarda como `funnels_location` (Proyecto) y en `funnels_contact_id`, así el enlace `/c/{{location.id}}` del submenú abre su ficha. Los clientes dados de alta antes siguen con `{{contact.id}}`.

## 31-oct — Instituto Dental Parque: datos desde Notion
- Rellenados desde la ficha de Notion «Clínica Dental Parque»: CIF, dirección, teléfono, equipo (Julián García, correo y teléfono), carpeta de Drive y número de Avania Setex (+34 644 16 00 72). Sin tocar nombre comercial ni ciudad. Falta la razón social (Notion no la trae).
- Credenciales de Instituto Dental Parque copiadas desde la base «Acceso a RRSS» de Notion a sus credenciales en Space (cifradas, estado «recibida», sin verificar): Instagram (@institutodentalparque), Instagram (anterior), Facebook y Gmail. El resto de servicios sigue pendiente.

- 1-nov: Resultados (Dental Parque y todos): se quita la lista «Leads sin campaña o anuncio» y en Estadísticas aparece el número «Leads sin anuncio asignado» (últimos 30 días; solo el equipo, no el portal del cliente). El endpoint de asignación manual sigue ahí por si hiciera falta.

- 1-nov: Bóvedas (accesos de cada cliente, pestaña Contraseñas, y Bóveda de herramientas): casillas «Se entra con» Google, Meta y Apple con sus iconos (sql/019_acceso_con.sql, ya aplicada). Un acceso marcado así cuenta como «recibida» sin contraseña y deja de salir como «sin contraseña»; la contraseña sigue pudiéndose guardar. También lo ve y lo marca el cliente en su formulario/portal. Código en src/sso.js, fields.js (ssoPicker) y space.css.

- 1-nov: Clientes (vista Por estado): el grupo «En campaña» sale desplegado; si lo pliegas, se recuerda mientras buscas o filtras. «Pausados» sigue plegado.

## 3-nov — Instituto Dental Parque: ficha completada desde la carpeta de Drive
- Copia previa de la ficha: `/root/backups/avania-space-idp-antes-de-importar-drive-2026-11-03.json`. Solo se rellenó lo que estaba vacío y se añadieron filas nuevas a las tablas (nada se pisó).
- **Datos de la empresa:** razón social (Clínica BIOBUCAL SLU), web, descripción, plantilla (6 personas del equipo, según su web), teléfono de recepción, correo general, tratamientos (6) y cargo de Julián García (director médico). **Horarios:** personas que atienden.
- **Clientes y ofertas:** 4 tipos de cliente (avatares), origen de pacientes, competidores (Albelo, Sanion Clínica Altozano, Rafa Pla, Ibermonte), 2 ofertas, servicio estrella, diferencial y objeciones.
- **Nuestros análisis:** conclusiones de avatar, competencia y oferta con enlaces a las hojas y documentos de Drive (avatares, análisis de la web, ACO + guiones, copys de Meta). **Marca:** logotipos y recursos de marca (enlaces), carpeta de material del cliente y tono de comunicación.
- **5 notas internas** (no visibles al cliente): contrato y propuesta (sin DNI ni IBAN), informes mensuales de junio y julio de 2025, reunión de onboarding, anuncios y guiones, y lo que se revisó pero no se pasó (plantillas de otro negocio, formularios vacíos).
- Carpeta de Drive enlazada: se cambia a «2. MARKETING» del cliente (antes estaba la carpeta del cliente entera, que Space rechaza). La comprobación del nombre acepta ahora numeración delante («2. MARKETING»). Falta compartir esa carpeta con la cuenta de servicio de Space para ver el explorador.

## 4-nov — Commit, reinicio y bitácora al día
- Se agrupa en un commit todo lo hecho desde el 30-oct (Drive con explorador y vista previa, «Ver cliente», portal ancho, vista de cliente con escritura, equipo y tablas, campos editables, ficha de Instituto Dental Parque) más lo pendiente de la sesión del 1-nov (casillas «Se entra con» Google/Meta/Apple, ajustes de KPIs). Migraciones 016-019 ya aplicadas.
- `.gitignore`: ahora excluye también `secrets/` (cuenta de servicio de Google) y `cache/`. Nunca se versionan el .env ni los secretos.
- Servicio reiniciado (`pm2 restart avania-space`).

## 5-nov — Duesthetic Models: ficha completada desde Notion
- Origen: página de Notion «[DUESTHETIC] Formulario de onboarding – AVANIA Clinical». Copia previa: `/root/backups/avania-space-duesthetic-antes-notion-2026-11-05.json`. Solo se rellenó lo vacío.
- Empresa: razón social, web, responsable (José Miguel Sánchez) y correo general; carpeta de Drive (enlace MARKETING). Caja fuerte (cifradas): Hosting (Arsys) y Respond.io; Duesthetic SimbiosysApp sin contraseña (doble verificación por correo). Nota interna con el curso, la oferta y lo que falta.
- 5-nov: Duesthetic › Web, dominio y Google: dominio, hosting (Arsys) y responsable de la web rellenados.
- 5-nov: Bóveda de herramientas: añadidas Arsys, Respond.io y SimbiosysApp de Duesthetic (copia de las credenciales del cliente, cifradas).

## 5-nov — Duesthetic Models: dos fichas unidas y botón «Dar de baja»
- Había dos fichas «Duesthetic Models» (la de 27-oct y la de hoy con la subcuenta de Funnels). Copia previa de ambas: `/root/backups/avania-space-duesthetic-antes-unir-2026-11-05.json`. Quedó la de la subcuenta de Funnels (activa) con los datos de las dos: secciones, credenciales (con contraseñas cifradas), nota interna, registro y carpeta de Drive. Ciudad: «Madrid y Málaga». La otra se borró.
- Botón «Dar de baja»: NO en la ficha (es lo del cliente) sino en el panel de clientes (vistas Por estado, Fichas y Tabla), solo administradores (también se exige en el servidor). Abre una ventana que obliga a escribir «dar de baja» para activar el botón. Archiva: sale de la lista, enlace desactivado, nada se borra; con «Archivados» marcado sale «Reactivar». Probado en Chromium (escritorio y móvil). Código: `askPhrase` en fields.js, `bajaBtn` en app.js.

## 5-nov — Duesthetic Models: avatares desde el PDF de la carpeta de Drive
- Origen: «Duesthetic Avatares Investigación Express.pdf» (10 avatares, 6-ago-2026). Copia previa: `/root/backups/avania-space-duesthetic-antes-avatares-2026-11-05.json`. Solo se rellenó lo vacío.
- **Nuestros análisis:** conclusiones del avatar (ranking /50 y lectura estratégica), resumen de la oferta, y enlaces al PDF y a la carpeta de Drive.
- **Sus clientes, competencia y ofertas:** 10 tipos de cliente, mejores clientes, servicio estrella, diferencial, objeciones y 3 ofertas (curso grupal 1.500 €, VIP en pareja, monográfico 700 € en pareja).
- **Notas internas (no visibles al cliente):** una por avatar con las 10 secciones del PDF (buyer persona, día típico, contenido, referentes, objeciones, mensajes, ángulos, canales, journey, retargeting) + una de origen.
- 5-nov: A petición de Pascual se deshace la importación del PDF de avatares en Duesthetic Models (era de otro avatar/cliente): vuelven las secciones «Análisis de AVANIA» y «Sus clientes, competencia y ofertas» a su estado anterior y se borran las 11 notas. Copia de lo borrado: /root/backups/avania-space-duesthetic-antes-avatares-2026-11-05.json (estado anterior) — el contenido importado ya no se conserva.

## 5-nov — Análisis de AVANIA en pestañas con fichas
- «Nuestros análisis» (sección oferta) pasa a tener pestañas Avatares · Competencia · Ofertas. En cada una: conclusiones (portada) y fichas cuadradas, cada una con nombre, enlace de Drive (botones «Ver» y «Abrir en Drive»), resumen y «+ Añadir» (hasta 12). Datos nuevos: avatares, competencia_fichas, oferta_fichas (tipo de campo nuevo `fichas` en formdef/fields.js). Los enlaces que ya había en las listas antiguas (…_docs) se pasan a fichas sin resumen; copia en /root/backups/avania-space-oferta-antes-fichas-2026-11-05.json. Probado en Chromium (escritorio y móvil) con API simulada.

## 5-nov — Fichas de análisis: elegir archivo de Drive y resumen automático
- En cada ficha (Avatares/Competencia/Ofertas) ya no se pega el enlace: «Elegir archivo de Google Drive» abre un explorador de la carpeta del cliente (buscador; solo Documentos, Hojas, Presentaciones y PDF). Al elegir sale la ventana «¿Es este el archivo?» (nombre, tipo, carpeta, fecha y enlace para comprobarlo); si se confirma, Space lee el archivo, escribe el resumen con Claude y lo deja en la ficha (editable). Botones «Cambiar archivo» y «Resumir de nuevo».
- Servidor: `POST /api/clients/:id/analisis` (src/index.js), lectura de archivos en drive.js (`readClientFile`, solo dentro de la carpeta del cliente) y resumen en src/ai.js. **Necesita `ANTHROPIC_API_KEY` en el .env de Space** (no está puesta; sin ella la ficha guarda el archivo y avisa de que falta la clave) y la carpeta MARKETING del cliente compartida con la cuenta de servicio de Drive. Modelo por defecto claude-sonnet-5-5 (`AI_MODEL` lo cambia). Probado en Chromium con API simulada; el resumen con IA real, sin probar.

## 5-nov — Reestructuración de menús: Tareas, Personas en Empresa, Documentos en Enlaces
- **«Cronograma» → «Tareas»** (menú de la agencia, Vista de cliente y portal del cliente). «Fechas» a secas pasa a «Fechas clave» (firma, inicio, montaje, rodaje…).
- **Tareas y subtareas con responsable y fechas** (`public/clientview.js` `phasesNode`, `src/plan.js`): las antiguas «fases» son ahora tareas con responsable del equipo AVANIA (desplegable con las personas de «Equipo de AVANIA» del cliente y los usuarios activos de Space, `team` en `GET /api/clients/:id`), estado, fecha de inicio y de fin, y subtareas con los mismos campos (desplegables con «Subtareas n/m»). Sin migración: se guardan en la sección `proceso` (`fases[].responsable/inicio/fecha/sub[]`); las ya guardadas siguen valiendo. `cleanFases` valida todo (máx. 60 tareas y 40 subtareas por tarea). Las subtareas entran en «Próximas acciones» y en «Fechas clave» (con el nombre de su tarea delante). El cliente las ve en solo lectura, con responsable y «inicio → fin».
- **Menú:** Personas pasa a Empresa (último elemento) y Documentos a Enlaces (tras Contraseñas). Las claves y los enlaces antiguos (`#/c/<id>/personas`, `/documentos`) siguen funcionando; el «Ver cliente» no cambia.
- **Resumen sintetizado:** semáforo de lanzamiento más compacto, áreas en dos columnas, solo 4 tareas por prioridad con enlace a Tareas; fuera el cronograma duplicado, las listas por área y «Ficha y accesos» (ya están en el menú).
- Probado en Chromium (escritorio y móvil, sin scroll horizontal) con un cliente temporal, ya borrado. Pendiente por si se quiere: arrastrar para reordenar y vista de calendario/Gantt.

## 5-nov — Tareas: campos más pequeños, eliminar y marcar hecha/pendiente en «Fechas clave»
- Los campos de texto de las tareas y subtareas son más pequeños (nombre máx. 520 px, selectores y fechas compactos; la fecha mantiene ancho para verse entera).
- «Fechas clave» (acciones añadidas con «+ Añadir a las tareas»): cada acción lleva ahora una **✕ para eliminarla** (con confirmación) y una casilla **«Hecha»** que se puede marcar y desmarcar (las hechas siguen visibles, tachadas, para poder volver a ponerlas pendientes). Los hitos (firma, inicio, montaje) no se eliminan. El cliente sigue sin ver las hechas. `src/plan.js` añade `del: {key, i}` a cada acción del cronograma.
- Las tareas (antes fases) ya se podían eliminar con la ✕ de su fila y cambiar de estado en los dos sentidos (Pendiente / En curso / Esperando cliente / Hecho). Nota: «Próximas acciones» se recalcula al recargar la página, no al marcar.

## 5-nov — Tareas: una línea por tarea, estados en color y texto más grande
- Escritorio (≥1180 px): nombre de la tarea, responsable, estado, inicio y fin en la misma línea (fechas a la derecha del texto), seguido de los botones (subtareas «↳ n/m», subir, bajar, quitar). En pantallas más estrechas el responsable, el estado y las fechas pasan a una segunda línea.
- El desplegable de estado va en color: Pendiente (gris), En curso (azul), Esperando cliente (ámbar) y Hecho (verde); las mismas etiquetas de color en la vista de solo lectura del cliente.
- Texto algo más grande en tareas y subtareas (15 px; campos de 14 px).

## 5-nov — Tareas: cruz roja para eliminar tareas y subtareas
- La ✕ gris de cada tarea y subtarea pasa a ser un icono con **cruz blanca en círculo rojo** (`.phdel`). Al pulsarla pide confirmación («¿Eliminar «…» y sus N subtareas? No se puede deshacer.»); «Cancelar» no borra nada. Probado en Chromium: eliminar subtarea, cancelar y eliminar tarea.

## 5-nov — Tareas hechas sin tachar
- Las tareas, subtareas y acciones de «Fechas clave» marcadas como hechas ya no llevan el texto tachado (`public/space.css`); siguen en gris suave y con el estado «Hecho» en verde.

## 5-nov — Elegir archivo de Drive: ventana más ancha
- La ventana «Elegir archivo de Google Drive» (fichas de Avatares, Competencia y Ofertas) pasa de 640 px a 980 px de ancho (94 % de la pantalla en móvil) y la lista es más alta (62 % de la pantalla), para ver bien los nombres de los documentos y su carpeta.

## 5-nov — Tareas: papelera pequeña en lugar de la cruz roja
- El botón de eliminar tarea y subtarea es ahora una **papelera pequeña** (15 px, en rojo; con fondo rosado al pasar el ratón) en lugar del círculo rojo con cruz. Mantiene la confirmación antes de borrar.

## 5-nov — Fichas de análisis: el error del resumen se queda a la vista
- «Elegir archivo» / «Resumir de nuevo» no escribía nada porque **Space no tiene `ANTHROPIC_API_KEY` en su `.env`** (el error está en el log desde que se creó la función). El aviso salía solo unos segundos; ahora el motivo queda escrito en rojo dentro de la ficha. Para que funcione hay que poner la clave de IA de Space en `.env` y reiniciar `avania-space`. Las «conclusiones» de cada pestaña siguen siendo texto a mano: no se rellenan solas a partir de los resúmenes (pendiente de decidir).
