// Correo saliente de Avania Space (alta de usuarios del equipo). Mismo buzón SMTP de Hostinger que Avania Setex, configurado en
// .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_REPLY_TO y PUBLIC_URL. Sin SMTP no se envía nada y se avisa.
import nodemailer from 'nodemailer';

export const PUBLIC_URL = process.env.PUBLIC_URL || 'https://space.goavania.com';
export const mailEnabled = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
let transport = null;
const transporter = () => (transport ??= nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Envía un correo con título, párrafos y un botón. Devuelve true si el servidor lo aceptó; lanza si falla. */
export async function sendMail({ to, subject, title, paragraphs, button }) {
  if (!mailEnabled()) throw new Error('El correo no está configurado en este servidor (faltan las claves SMTP en .env).');
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f3f4f6;font:16px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111827">
  <div style="max-width:520px;margin:0 auto;padding:28px 16px">
    <p style="margin:0 0 16px"><img src="${PUBLIC_URL}/brand/avania-light.png" alt="avania" height="28" style="height:28px;vertical-align:bottom;border:0"> <span style="font-weight:800;font-size:13px;letter-spacing:.06em;color:#8a8a8a">SPACE</span></p>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:24px">
      <h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
      ${paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join('')}
      ${button ? `<p style="margin:20px 0"><a href="${esc(button.url)}" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:700;display:inline-block">${esc(button.label)}</a></p>
      <p style="font-size:13px;color:#6b7280;margin:0">Si el botón no funciona, copia este enlace: <br><span style="word-break:break-all">${esc(button.url)}</span></p>` : ''}
    </div>
    <p style="font-size:12px;color:#6b7280;margin:16px 0 0">Avania Space · AVANIA MARKETING Y COMUNICACION SL</p>
  </div></body></html>`;
  const text = [title, '', ...paragraphs, ...(button ? ['', `${button.label}: ${button.url}`] : [])].join('\n');
  const info = await transporter().sendMail({
    from: process.env.MAIL_FROM || `Avania Space <${process.env.SMTP_USER}>`,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
    to, subject, html, text,
  });
  const rejected = (info.rejected ?? []).length;
  console.log(`[email] ${rejected ? 'RECHAZADO' : 'enviado'} a ${to}: ${subject} · ${String(info.response ?? '').slice(0, 80)}`);
  if (rejected) throw new Error('El servidor de correo ha rechazado esa dirección.');
  return true;
}

/** Envía un correo con el HTML ya montado (informes). Devuelve true si el servidor lo aceptó; lanza si falla. */
export async function sendHtml({ to, subject, html, text }) {
  if (!mailEnabled()) throw new Error('El correo no está configurado en este servidor (faltan las claves SMTP en .env).');
  const info = await transporter().sendMail({
    from: process.env.MAIL_FROM || `Avania Space <${process.env.SMTP_USER}>`,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
    to, subject, html, text,
  });
  const rejected = (info.rejected ?? []).length;
  console.log(`[email] ${rejected ? 'RECHAZADO' : 'enviado'} a ${to}: ${subject} · ${String(info.response ?? '').slice(0, 80)}`);
  if (rejected) throw new Error('El servidor de correo ha rechazado esa dirección.');
  return true;
}
