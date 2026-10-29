// Vista previa de enlaces de Google Drive / Docs. Sirve para DOCX y PDF subidos a Drive (visor de Drive) y para Docs, Hojas y Presentaciones nativos.
// Solo se ve si quien mira tiene sesión de Google con acceso al documento (si no, Google pide iniciar sesión).
export function embedUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  const id = (re) => (u.pathname.match(re) || [])[1];
  if (u.hostname === 'docs.google.com') {
    const d = id(/^\/document\/d\/([\w-]+)/); if (d) return { src: `https://docs.google.com/document/d/${d}/preview`, kind: 'Documento de Google' };
    const p = id(/^\/presentation\/d\/([\w-]+)/); if (p) return { src: `https://docs.google.com/presentation/d/${p}/embed`, kind: 'Presentación de Google' };
    const h = id(/^\/spreadsheets\/d\/([\w-]+)/); if (h) return { src: `https://docs.google.com/spreadsheets/d/${h}/preview`, kind: 'Hoja de cálculo de Google' };
  }
  if (u.hostname === 'drive.google.com') {
    const fo = id(/^\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)/); if (fo) return { src: `https://drive.google.com/embeddedfolderview?id=${fo}#list`, kind: 'Carpeta de Drive' };
    const f = id(/^\/file\/d\/([\w-]+)/) || u.searchParams.get('id'); if (f && /^[\w-]+$/.test(f)) return { src: `https://drive.google.com/file/d/${f}/preview`, kind: 'Archivo de Drive (DOCX, PDF…)' };
  }
  return null;
}
