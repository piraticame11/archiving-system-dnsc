const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST,
  port:   Number(process.env.MAIL_PORT) || 587,
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const FROM = process.env.MAIL_FROM || '"ACES Research Office" <no-reply@aces.edu.ph>';

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({ from: FROM, to, subject, html });
}

function passwordResetHtml(name, link) {
  return `<p>Hello ${name},</p>
<p>Click the link below to reset your password. It expires in 1 hour.</p>
<p><a href="${link}">${link}</a></p>
<p>If you did not request this, ignore this email.</p>`;
}

function scheduleAssignedHtml(name, title, date, venue) {
  return `<p>Hello ${name},</p>
<p>You have been assigned as a panelist for the defense of:</p>
<p><strong>${title}</strong></p>
<p>Date/Time: ${date}<br>Venue: ${venue}</p>`;
}

function statusChangedHtml(name, title, status, remarks) {
  return `<p>Hello ${name},</p>
<p>Your submission <strong>${title}</strong> has been updated to: <strong>${status}</strong>.</p>
${remarks ? `<p>Remarks: ${remarks}</p>` : ''}`;
}

module.exports = { sendMail, passwordResetHtml, scheduleAssignedHtml, statusChangedHtml };
