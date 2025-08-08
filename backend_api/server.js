
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const twilio = require('twilio');
const Database = require('better-sqlite3');
const { google } = require('googleapis');
const { encrypt, decrypt } = require('./crypto');

const app = express();
app.use(express.json());
app.use(cors());

// ---- DB ----
const db = new Database(path.join(__dirname, 'data.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  phone TEXT,
  name TEXT,
  address TEXT,
  password_hash TEXT,
  prepaid_hours REAL DEFAULT 0,
  lifetime_spend INTEGER DEFAULT 0,
  late_cancels INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  datetime TEXT,
  duration INTEGER,
  payment_type TEXT,
  price INTEGER,
  used_prepaid INTEGER DEFAULT 0,
  canceled INTEGER DEFAULT 0,
  weather_change INTEGER DEFAULT 0,
  calendar_event_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(student_id) REFERENCES students(id)
);
CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start TEXT,
  end TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT DEFAULT (datetime('now')),
  actor TEXT,   -- 'admin' or system identifier
  action TEXT,  -- e.g., 'gmail_token_set', 'gmail_token_cleared'
  detail TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

function setSetting(key, value){ db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }
function getSetting(key){ const r = db.prepare('SELECT value FROM settings WHERE key=?').get(key); return r?.value || null; }

function audit(actor, action, detail){ try{ db.prepare('INSERT INTO audit(actor,action,detail) VALUES (?,?,?)').run(actor, action, detail||''); }catch(_){}}


// ---- Utils ----
function parseHHMM(s){ const [h,m]=s.split(':').map(Number); return {h,m}; }
function toISO(date, h, m){ const d = new Date(date+'T00:00:00'); d.setHours(h,m,0,0); return d.toISOString(); }
function addMinutes(iso, mins){ const d=new Date(iso); d.setMinutes(d.getMinutes()+mins); return d.toISOString(); }
function fmtTime(iso){ return new Date(iso).toLocaleTimeString('en-US',{hour:'numeric', minute:'2-digit'}); }

function getStripe() {
  const mode = (process.env.PAYMENT_MODE || 'test').toLowerCase();
  const key = mode === 'live' ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST;
  if (!key) return null;
  return new Stripe(key);
}
function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function gmailOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}
function getStoredRefreshToken(){
  const enc = getSetting('gmail_refresh_token');
  if (enc) { try { return decrypt(enc); } catch(_){} }
  return process.env.GMAIL_REFRESH_TOKEN || '';
}
function getGmailTransport() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ADMIN_EMAIL } = process.env;
  const refreshToken = getStoredRefreshToken();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !refreshToken || !ADMIN_EMAIL) return null;
  return nodemailer.createTransport({
    service:'gmail',
    auth:{ type:'OAuth2', user: ADMIN_EMAIL, clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, refreshToken }
  });
}

function isAdmin(req){
  // Replace with real auth; for now we use a header-based admin key
  return req.headers['x-admin-key'] === (process.env.ADMIN_API_KEY || 'dev-admin');
}

// ---- Health ----
app.get('/ready', (_, res)=> res.json({ ok: true }));
app.get('/health', (_, res)=> res.json({ status: 'ok' }));

// ---- Availability ----
app.get('/api/availability', (req, res) => {
  try {
    const date = req.query.date; // YYYY-MM-DD
    const duration = parseInt(req.query.duration || '60', 10);
    if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
    if (![30,45,60].includes(duration)) return res.status(400).json({ error: 'duration must be 30,45,60' });

    const { h:openH, m:openM } = parseHHMM(process.env.BUSINESS_START || '08:00');
    const { h:closeH, m:closeM } = parseHHMM(process.env.BUSINESS_END || '18:00');
    const interval = parseInt(process.env.SLOT_INTERVAL || '15', 10);
    const buffer = parseInt(process.env.BUFFER_MINUTES || '15', 10);

    const startOfDayISO = toISO(date, openH, openM);
    const endOfDayISO = toISO(date, closeH, closeM);

    const candidates = [];
    let t = startOfDayISO;
    while (true) {
      const endIfBooked = addMinutes(t, duration + buffer);
      if (new Date(endIfBooked) > new Date(endOfDayISO)) break;
      candidates.push(t);
      t = addMinutes(t, interval);
    }

    const dayStart = toISO(date, 0, 0);
    const dayEnd = toISO(date, 23, 59);
    const lessons = db.prepare("SELECT * FROM lessons WHERE canceled=0 AND datetime BETWEEN ? AND ?").all(dayStart, dayEnd);
    const blocks = db.prepare("SELECT * FROM blocks WHERE start < ? AND end > ?").all(dayEnd, dayStart);

    function overlaps(aStart, aEnd, bStart, bEnd) { return (new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart)); }

    const maxPerDay = parseInt(process.env.MAX_BOOKINGS_PER_DAY || '4', 10);
    const available = candidates.filter(startISO => {
      const endISO = addMinutes(startISO, duration);
      const endWithBufferISO = addMinutes(startISO, duration + buffer);
      if (lessons.length >= maxPerDay) return false;
      for (const L of lessons) {
        const Lstart = L.datetime;
        const LendWithBuffer = addMinutes(L.datetime, L.duration + buffer);
        if (overlaps(startISO, endWithBufferISO, Lstart, LendWithBuffer)) return false;
      }
      for (const B of blocks) {
        if (overlaps(startISO, endWithBufferISO, B.start, B.end)) return false;
      }
      return true;
    });

    res.json({ date, duration, slots: available.map(s => ({ start: s, label: fmtTime(s) })) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'availability_failed', message: e.message });
  }
});

// ---- Book endpoint ----
app.post('/api/book', (req, res) => {
  try {
    const { date, time, duration, student, payment_type } = req.body || {};
    if (!date || !time || !duration || !student) return res.status(400).json({ error: 'missing fields' });
    if (![30,45,60].includes(duration)) return res.status(400).json({ error: 'duration invalid' });

    const startISO = new Date(`${date}T${time}:00`).toISOString();
    const buffer = parseInt(process.env.BUFFER_MINUTES || '15', 10);
    const maxPerDay = parseInt(process.env.MAX_BOOKINGS_PER_DAY || '4', 10);

    let stu = db.prepare("SELECT * FROM students WHERE email=?").get(student.email);
    if (!stu) {
      db.prepare("INSERT INTO students (email, phone, name, address, prepaid_hours) VALUES (?,?,?,?,?)")
        .run(student.email, student.phone || '', student.name || '', student.address || '', 0);
      stu = db.prepare("SELECT * FROM students WHERE email=?").get(student.email);
    }

    const dayStart = new Date(`${date}T00:00:00`).toISOString();
    const dayEnd = new Date(`${date}T23:59:59`).toISOString();
    const count = db.prepare("SELECT COUNT(*) as c FROM lessons WHERE canceled=0 AND datetime BETWEEN ? AND ?").get(dayStart, dayEnd).c;
    if (count >= maxPerDay) return res.status(400).json({ error: 'max_lessons_reached' });

    const lessons = db.prepare("SELECT * FROM lessons WHERE canceled=0 AND datetime BETWEEN ? AND ?").all(dayStart, dayEnd);
    const endWithBufferISO = addMinutes(startISO, duration + buffer);
    const overlaps = lessons.some(L => {
      const LendWithBuffer = addMinutes(L.datetime, L.duration + buffer);
      return (new Date(startISO) < new Date(LendWithBuffer) && new Date(endWithBufferISO) > new Date(L.datetime));
    });
    if (overlaps) return res.status(400).json({ error: 'slot_unavailable' });

    const blocks = db.prepare("SELECT * FROM blocks WHERE start < ? AND end > ?").all(dayEnd, dayStart);
    const blocked = blocks.some(B => (new Date(startISO) < new Date(B.end) && new Date(endWithBufferISO) > new Date(B.start)));
    if (blocked) return res.status(400).json({ error: 'blocked_time' });

    const priceMap = { 30: 9000, 45: 13500, 60: 18000 }; // cents
    let price = priceMap[duration];
    let used_prepaid = 0;
    if (payment_type === 'cash') {
      const discounted = Math.round((price / 100) * (1 - 0.11));
      price = discounted * 100;
    } else if (payment_type === 'prepaid') {
      const neededHours = duration === 30 ? 0.5 : duration === 45 ? 0.75 : 1.0;
      if ((stu.prepaid_hours || 0) < neededHours) {
        return res.status(400).json({ error: 'insufficient_prepaid' });
      }
      used_prepaid = 1;
      db.prepare("UPDATE students SET prepaid_hours = prepaid_hours - ? WHERE id=?").run(neededHours, stu.id);
      price = 0;
    }

    const ins = db.prepare("INSERT INTO lessons (student_id, datetime, duration, payment_type, price, used_prepaid) VALUES (?,?,?,?,?,?)");
    const info = ins.run(stu.id, startISO, duration, payment_type, price, used_prepaid);

    return res.json({ ok: true, booking_id: info.lastInsertRowid, start: startISO, duration, price_cents: price });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'book_failed', message: e.message });
  }
});

// ---- Block time ----
app.post('/api/admin/block', (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error:'forbidden' });
    const { start, end, note } = req.body || {};
    if (!start || !end) return res.status(400).json({ error: 'start and end required (ISO strings)' });
    db.prepare("INSERT INTO blocks (start, end, note) VALUES (?,?,?)").run(start, end, note || '');
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'block_failed', message: e.message });
  }
});

// ---- Gmail token rotation endpoints ----
app.get('/api/admin/gmail/status', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error:'forbidden' });
  const exists = !!getSetting('gmail_refresh_token');
  res.json({ hasToken: exists });
});

app.get('/api/admin/gmail/rotate/start', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error:'forbidden' });
  const o = gmailOAuthClient();
  const url = o.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar.events'
    ],
  });
  res.json({ url });
});

app.get('/oauth/google/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code');
    const o = gmailOAuthClient();
    const { tokens } = await o.getToken(code);
    if (!tokens?.refresh_token) return res.status(400).send('No refresh token (try again with consent).');
    setSetting('gmail_refresh_token', encrypt(tokens.refresh_token));
    audit('admin','gmail_token_set','rotated via OAuth callback');
    res.redirect('/admin?gmail=rotated');
  } catch (e) {
    console.error('gmail rotate cb', e);
    res.status(500).send('Failed to save token');
  }
});



// ---- Clear Gmail token (admin-only) ----
app.post('/api/admin/gmail/clear', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error:'forbidden' });
  try {
    db.prepare('DELETE FROM settings WHERE key=?').run('gmail_refresh_token');
    audit('admin','gmail_token_cleared','token removed from DB; env fallback will be used if present');
    res.json({ ok: true });
  } catch (e) {
    console.error('clear token', e);
    res.status(500).json({ error:'clear_failed' });
  }
});

// ---- Manual weather alert stub ----
app.post('/api/admin/weather/alert', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error:'forbidden' });
    const { date } = req.body || {};
    if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
    console.log('[Weather Alert Triggered for]', date);
    res.json({ ok: true, date });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'weather_alert_failed', message: e.message });
  }
});

// ---- Seed endpoint ----
app.post('/api/admin/seed', (req, res) => {
  try {
    const token = req.headers['x-seed-token'];
    if (!process.env.SEED_TOKEN || token !== process.env.SEED_TOKEN) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const exists = db.prepare("SELECT COUNT(*) as c FROM students").get().c;
    if (exists < 2) {
      db.prepare("INSERT OR IGNORE INTO students (email, phone, name, address, prepaid_hours) VALUES (?,?,?,?,?)").run('alex@example.com', '415-555-1212', 'Alex Morgan', '123 Main St, San Francisco, CA', 1.5);
      db.prepare("INSERT OR IGNORE INTO students (email, phone, name, address, prepaid_hours) VALUES (?,?,?,?,?)").run('jamie@example.com', '650-555-2323', 'Jamie Lee', '456 Oak Ave, Redwood City, CA', 0);
    }
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    const mk = (h,m)=>{ const d = new Date(tomorrow); d.setHours(h,m,0,0); return d.toISOString(); };
    const alex = db.prepare("SELECT id FROM students WHERE email=?").get('alex@example.com');
    const jamie = db.prepare("SELECT id FROM students WHERE email=?").get('jamie@example.com');
    const lc = db.prepare("SELECT COUNT(*) as c FROM lessons").get().c;
    if (lc < 2) {
      if (alex) db.prepare("INSERT INTO lessons (student_id, datetime, duration, payment_type, price) VALUES (?,?,?,?,?)").run(alex.id, mk(9,0), 45, 'card', 13500);
      if (jamie) db.prepare("INSERT INTO lessons (student_id, datetime, duration, payment_type, price) VALUES (?,?,?,?,?)").run(jamie.id, mk(15,0), 60, 'cash', 16000);
    }
    res.json({ ok: true, seeded: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'seed_failed', message: e.message });
  }
});

// ---- Startup ----
const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=> console.log(`API running on :${PORT}`));


// ---- Audit logs (admin-only) ----
app.get('/api/admin/audit/logs', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error:'forbidden' });
  try {
    const limit = Math.min(parseInt(req.query.limit || '20',10), 200);
    const rows = db.prepare('SELECT ts, actor, action, detail FROM audit ORDER BY id DESC LIMIT ?').all(limit);
    res.json({ rows });
  } catch (e) {
    console.error('audit logs', e);
    res.status(500).json({ error:'audit_failed' });
  }
});
