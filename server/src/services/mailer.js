const nodemailer = require("nodemailer");
const config = require("../config");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.mail.host || !config.mail.user) {
    console.warn("[mail] SMTP not configured — emails will be logged only");
    return null;
  }
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: { user: config.mail.user, pass: config.mail.pass },
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mail:dev] TO=${to} SUBJECT=${subject}\n${text || html}`);
    return { mocked: true };
  }
  return t.sendMail({ from: config.mail.from, to, subject, html, text });
}

function otpEmailTemplate({ code, ttlMinutes, appName }) {
  const subject = `${appName} security code: ${code}`;
  const text = `Your ${appName} verification code is: ${code}\n\nThis code expires in ${ttlMinutes} minutes.\nIf you did not request this, you can ignore this email.`;
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;max-width:480px;margin:auto">
    <div style="font-size:13px;letter-spacing:.2em;color:#00B2FF;text-transform:uppercase">${appName}</div>
    <h1 style="margin:8px 0 16px;font-size:22px">Your security code</h1>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6">Use the code below to complete sign-in. It expires in ${ttlMinutes} minutes.</p>
    <div style="margin:24px 0;padding:20px;background:#131313;border:1px solid rgba(0,178,255,.3);border-radius:10px;text-align:center">
      <span style="font-family:'JetBrains Mono',monospace;font-size:32px;letter-spacing:.4em;color:#00B2FF">${code}</span>
    </div>
    <p style="color:#71717a;font-size:12px">If you did not request this code, please ignore this email or contact support.</p>
  </div>`;
  return { subject, text, html };
}

module.exports = { sendMail, otpEmailTemplate };
