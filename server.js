const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DATA_DIR = path.join(__dirname, 'data');
const EMAILS_FILE = path.join(DATA_DIR, 'emails.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(EMAILS_FILE)) fs.writeFileSync(EMAILS_FILE, '[]');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

async function sendNotification(newEmail, totalCount) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('[email] Skipped — GMAIL_USER or GMAIL_APP_PASSWORD not set');
    return;
  }
  try {
    await transporter.sendMail({
      from: `"VoiceCRM Waitlist" <${process.env.GMAIL_USER}>`,
      to: 'ajain2303@gmail.com',
      subject: `New waitlist signup #${totalCount} — ${newEmail}`,
      text: `${newEmail} just joined the waitlist.\n\nTotal signups: ${totalCount}\n\nView all: ${BASE_URL}/api/emails`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <p style="font-size:13px;color:#888;margin-bottom:16px;text-transform:uppercase;letter-spacing:.08em">VoiceCRM Waitlist</p>
          <h2 style="margin:0 0 8px;font-size:22px;color:#111">New signup #${totalCount}</h2>
          <p style="font-size:18px;color:#7c3aed;font-weight:600;margin:0 0 24px">${newEmail}</p>
          <p style="color:#555;font-size:14px;margin:0">Total people on the waitlist: <strong>${totalCount}</strong></p>
        </div>
      `,
    });
    console.log(`[email] Notification sent for ${newEmail}`);
  } catch (err) {
    console.error('[email] Failed to send notification:', err.message);
  }
}

app.post('/api/waitlist', (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Valid email required.' });
  }

  ensureDataFile();
  const emails = JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf8'));

  if (emails.includes(email.toLowerCase())) {
    return res.status(409).json({ success: false, message: 'Already on the waitlist!' });
  }

  emails.push(email.toLowerCase());
  fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2));
  res.json({ success: true });
  sendNotification(email.toLowerCase(), emails.length).catch(() => {});
});

app.get('/api/qr', async (req, res) => {
  try {
    const buffer = await qrcode.toBuffer(BASE_URL, {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#7c3aed', light: '#0a0a0f' },
    });
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.get('/api/qr/instagram', async (req, res) => {
  try {
    const buffer = await qrcode.toBuffer('https://www.instagram.com/anshaftercoffee/', {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#e1306c', light: '#0a0a0f' },
    });
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.get('/api/emails', (req, res) => {
  const secret = process.env.ADMIN_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  ensureDataFile();
  const emails = JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf8'));
  res.json({ count: emails.length, emails });
});

app.get('/qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qr.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at ${BASE_URL}`);
});
