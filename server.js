const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
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

app.get('/qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qr.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at ${BASE_URL}`);
});
