# Avania Space

Panel de clientes de AVANIA, onboarding por enlace y caja fuerte de credenciales.
Hermano de Avania Setex, con base de datos y código propios.

- **Panel (equipo):** usuario y contraseña. Roles: `super_admin`, `admin` (ve contraseñas con 2FA), `member`.
- **Cliente:** enlace único `/f/<token>`, sin cuenta. Puede escribir contraseñas, nunca leerlas.
- **Credenciales:** AES-256-GCM en el servidor. La clave (`CREDENTIALS_KEY`) vive solo en `.env`;
  **si se pierde, las contraseñas guardadas son irrecuperables** (guardar copia fuera del servidor).
- **Base de datos:** Postgres de Supabase por `DATABASE_URL`; tablas con RLS y sin políticas.

## Puesta en marcha
```
cp .env.example .env   # rellenar
npm install
npm run migrate
npm run superadmin -- correo@dominio "Nombre"
npm start              # 127.0.0.1:3003
```
El formulario está definido en `src/formdef.js`; la ayuda y los vídeos por sección, en `public/ayuda.json`.
`node scripts/e2e.mjs` prueba permisos, cifrado y enlace de cliente contra el servidor en marcha.
