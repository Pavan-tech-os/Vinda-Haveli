// Sends emails through Gmail (or any SMTP service). Never throws: a failed email must not break a booking or an order.
export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export const rows = (pairs: [string, unknown][]) =>
  `<table style="width:100%;border-collapse:collapse;margin:14px 0">${pairs.filter(([, v]) => v !== '' && v != null).map(([k, v]) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#777;width:38%">${esc(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee"><b>${esc(v)}</b></td></tr>`).join('')}</table>`;

export const layout = (title: string, html: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;background:#f6f1e7;padding:20px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:10px;overflow:hidden">` +
  `<div style="background:#1a1208;color:#d4af37;padding:16px 22px;font-size:20px;letter-spacing:2px">VINDU HAVELI</div>` +
  `<div style="padding:22px;color:#222;line-height:1.5"><h2 style="margin:0 0 10px;font-size:19px">${esc(title)}</h2>${html}</div></div></div>`;

let transporter: any = null;
export const mailConfigured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!to) return false;
  if (!mailConfigured()) { console.warn('[mail] SMTP_USER / SMTP_PASS are not set, so this email was skipped:', subject); return false; }
  try {
    if (!transporter) {
      const mod: any = await import('nodemailer'); const nodemailer = mod.default ?? mod;
      const port = Number(process.env.SMTP_PORT || 465);
      transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || '').replace(/\s+/g, '') } });
    }
    await transporter.sendMail({ from: `"${process.env.MAIL_FROM_NAME || 'Vindu Haveli'}" <${process.env.SMTP_USER}>`, to, subject, html });
    return true;
  } catch (e) { console.error('[mail] sending failed:', subject, e); return false; }
}