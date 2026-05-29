// systems/emailAlerts.js
const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendAlert(subject, message) {
  if (!process.env.OWNER_EMAIL) return;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.OWNER_EMAIL,
      subject,
      text: message
    });
    logger.info('Email alert sent');
  } catch (err) {
    logger.error('Email alert failed:', err);
  }
}

module.exports = { sendAlert };