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

// Gmail SMTP requires the From address to match the authenticated account.
// Always use MAIL_USER as the actual sender address.
const fromName = process.env.MAIL_FROM_NAME || 'ACES Research Office';
const FROM = `"${fromName}" <${process.env.MAIL_USER}>`;

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({ from: FROM, to, subject, html });
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

function otpHtml(name, code) {
  return `<p>Hello ${name},</p>
<p>Your verification code is:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
<p>This code expires in 10 minutes. If you did not request this, ignore this email.</p>`;
}

function tempPasswordHtml(name, tempPassword, minutesValid) {
  return `<p>Hello ${name},</p>
<p>Here is a temporary password to sign back into your account:</p>
<p style="font-size:20px;font-weight:bold;letter-spacing:2px;">${tempPassword}</p>
<p>It is valid for ${minutesValid} minutes. Sign in with it and set a new password right away.</p>
<p>If you did not request this, ignore this email.</p>`;
}

function adviserRequestHtml(adviserName, groupName, leaderName) {
  return `<p>Hello ${adviserName},</p>
<p><strong>${leaderName}</strong> has selected you as the adviser for their group <strong>${groupName}</strong>.</p>
<p>Please review and respond to this request in the Group Requests section of your dashboard.</p>`;
}

function adviserDecisionHtml(leaderName, groupName, decision, reason) {
  const verb = decision === 'approved' ? 'approved' : 'declined';
  return `<p>Hello ${leaderName},</p>
<p>Your adviser request for <strong>${groupName}</strong> was <strong>${verb}</strong>.</p>
${reason ? `<p>Reason: ${reason}</p>` : ''}`;
}

module.exports = {
  sendMail, scheduleAssignedHtml, statusChangedHtml, otpHtml, tempPasswordHtml,
  adviserRequestHtml, adviserDecisionHtml,
};
