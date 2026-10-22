'use strict';
/*
 * ECOTERM Gradilišta – server.
 * Pokretanje: npm install && npm start   (zatim otvori http://localhost:3000)
 * Postavke se zadaju varijablama okoline – vidi README.md.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const { openDb } = require('./db');

const PORT = Number(process.env.PORT) || 3000;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'));
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const COOKIE = 'gradiliste_uredaj';
const DEVICE_MAX_AGE = 5 * 365 * 24 * 3600 * 1000; // uređaj ostaje prijavljen 5 godina
const INVITE_TTL = 48 * 3600 * 1000;                // QR pozivnica vrijedi 48 sati
const ROLES = ['admin', 'radnik'];
const STATUSES = { priprema: 'U pripremi', u_tijeku: 'U tijeku', zavrseno: 'Završeno' };
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const newToken = () => crypto.randomBytes(32).toString('base64url');
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// Kratak opis uređaja za popis prijavljenih uređaja, npr. "Android · Chrome"
function deviceLabel(ua = '') {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Uređaj';
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return br ? `${os} · ${br}` : os;
}

function baseUrl(req) {
  return PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
}

function fail(res, status, error) {
  return res.status(status).json({ error });
}

async function main() {
  const db = await openDb();
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  // Prvo postavljanje: dok nema nijednog korisnika, voditelj se prijavi kodom iz SETUP_CODE (ili iz loga).
  const setupCode = process.env.SETUP_CODE || crypto.randomBytes(4).toString('hex');
  const userCount = async () => (await db.get('SELECT COUNT(*) AS n FROM users')).n;
  if ((await userCount()) === 0) {
    console.log(`\n  Prvo postavljanje – kod za prvog voditelja: ${setupCode}\n`);
  }

  async function createDevice(req, res, userId) {
    const token = newToken();
    const t = Date.now();
    await db.run('INSERT INTO devices (user_id, token_hash, label, created_at, last_seen) VALUES (?, ?, ?, ?, ?)',
      [userId, hash(token), deviceLabel(req.get('user-agent')), t, t]);
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: DEVICE_MAX_AGE, path: '/' });
  }

  async function systemMessage(siteId, userId, body) {
    await db.run('INSERT INTO messages (site_id, user_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)',
      [siteId, userId, 'system', body, Date.now()]);
  }

  const app = express();
  app.set('trust proxy', true); // hosting obično stoji iza proxyja (HTTPS)
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // Prepoznaj uređaj po kolačiću
  app.use(async (req, res, next) => {
    const token = readCookie(req, COOKIE);
    if (token) {
      const row = await db.get(
        `SELECT d.id AS device_id, d.last_seen, u.id, u.name, u.role, u.created_at
           FROM devices d JOIN users u ON u.id = d.user_id
          WHERE d.token_hash = ? AND u.active = 1`, [hash(token)]);
      if (row) {
        req.user = { id: row.id, name: row.name, role: row.role, deviceId: row.device_id, createdAt: row.created_at };
        if (Date.now() - row.last_seen > 60000) {
          await db.run('UPDATE devices SET last_seen = ? WHERE id = ?', [Date.now(), row.device_id]);
        }
      }
    }
    next();
  });

  const auth = (req, res, next) => (req.user ? next() : fail(res, 401, 'Ovaj uređaj nije prijavljen.'));
  const admin = (req, res, next) => (req.user?.role === 'admin' ? next() : fail(res, 403, 'Samo voditelj to može.'));

  // ---------- Prijava ----------
  app.get('/api/me', async (req, res) => {
    res.json({ user: req.user || null, setupNeeded: (await userCount()) === 0 });
  });

  app.post('/api/setup', async (req, res) => {
    if ((await userCount()) > 0) return fail(res, 400, 'Aplikacija je već postavljena.');
    const name = clean(req.body.name, 80);
    if (!name) return fail(res, 400, 'Upišite ime.');
    if (clean(req.body.code, 100) !== setupCode) return fail(res, 403, 'Kod nije ispravan.');
    const { insertId } = await db.run('INSERT INTO users (name, role, active, created_at) VALUES (?, ?, 1, ?)',
      [name, 'admin', Date.now()]);
    await createDevice(req, res, insertId);
    res.json({ ok: true });
  });

  async function findInvite(token) {
    const inv = await db.get('SELECT * FROM invites WHERE token_hash = ?', [hash(token)]);
    if (!inv || inv.used_at || inv.expires_at < Date.now()) return null;
    if (inv.user_id) {
      const u = await db.get('SELECT name FROM users WHERE id = ? AND active = 1', [inv.user_id]);
      if (!u) return null;
      inv.name = u.name;
    }
    return inv;
  }

  app.get('/api/invites/:token', async (req, res) => {
    const inv = await findInvite(req.params.token);
    if (!inv) return fail(res, 404, 'Pozivnica ne postoji, iskorištena je ili je istekla. Zatražite novi QR kod.');
    res.json({ name: inv.name || '', role: inv.role, existingUser: !!inv.user_id });
  });

  app.post('/api/invites/:token/accept', async (req, res) => {
    const inv = await findInvite(req.params.token);
    if (!inv) return fail(res, 404, 'Pozivnica ne postoji, iskorištena je ili je istekla. Zatražite novi QR kod.');
    const name = clean(req.body.name, 80) || inv.name;
    if (!inv.user_id && !name) return fail(res, 400, 'Upišite ime.');
    // Uvjet "used_at IS NULL" sprječava da se ista pozivnica iskoristi dvaput istovremeno
    const { changes } = await db.run('UPDATE invites SET used_at = ? WHERE id = ? AND used_at IS NULL', [Date.now(), inv.id]);
    if (!changes) return fail(res, 409, 'Pozivnica je upravo iskorištena.');
    const userId = inv.user_id || (await db.run('INSERT INTO users (name, role, active, created_at) VALUES (?, ?, 1, ?)',
      [name, inv.role, Date.now()])).insertId;
    await createDevice(req, res, userId);
    res.json({ ok: true });
  });

  app.post('/api/invites', auth, admin, async (req, res) => {
    const role = ROLES.includes(req.body.role) ? req.body.role : 'radnik';
    const userId = Number(req.body.userId) || null;
    const name = clean(req.body.name, 80) || null;
    if (userId && !(await db.get('SELECT id FROM users WHERE id = ? AND active = 1', [userId]))) {
      return fail(res, 404, 'Korisnik ne postoji.');
    }
    const token = newToken();
    const expiresAt = Date.now() + INVITE_TTL;
    await db.run(
      'INSERT INTO invites (token_hash, name, role, user_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [hash(token), name, role, userId, req.user.id, Date.now(), expiresAt]);
    const url = `${baseUrl(req)}/pozivnica/${token}`;
    const qr = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    res.json({ url, qr, expiresAt });
  });

  app.post('/api/logout', auth, async (req, res) => {
    await db.run('DELETE FROM devices WHERE id = ?', [req.user.deviceId]);
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  // ---------- Ljudi i uređaji (voditelj) ----------
  app.get('/api/people', auth, admin, async (req, res) => {
    const users = await db.all('SELECT id, name, role, active, created_at FROM users ORDER BY active DESC, name');
    const devices = await db.all('SELECT id, user_id, label, created_at, last_seen FROM devices ORDER BY last_seen DESC');
    res.json(users.map((u) => ({
      id: u.id, name: u.name, role: u.role, active: !!u.active, createdAt: u.created_at,
      devices: devices.filter((d) => d.user_id === u.id).map((d) => ({
        id: d.id, label: d.label, createdAt: d.created_at, lastSeen: d.last_seen, current: d.id === req.user.deviceId,
      })),
    })));
  });

  app.patch('/api/people/:id', auth, admin, async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) return fail(res, 400, 'Ne možete mijenjati sami sebe.');
    if (req.body.role !== undefined) {
      if (!ROLES.includes(req.body.role)) return fail(res, 400, 'Nepoznata uloga.');
      await db.run('UPDATE users SET role = ? WHERE id = ?', [req.body.role, id]);
    }
    if (req.body.active !== undefined) {
      await db.run('UPDATE users SET active = ? WHERE id = ?', [req.body.active ? 1 : 0, id]);
      if (!req.body.active) await db.run('DELETE FROM devices WHERE user_id = ?', [id]);
    }
    res.json({ ok: true });
  });

  app.delete('/api/devices/:id', auth, admin, async (req, res) => {
    await db.run('DELETE FROM devices WHERE id = ?', [Number(req.params.id)]);
    res.json({ ok: true });
  });

  // ---------- Gradilišta ----------
  const siteRow = (s) => ({
    id: s.id, name: s.name, address: s.address || '', clientName: s.client_name || '',
    clientPhone: s.client_phone || '', note: s.note || '', status: s.status, createdAt: s.created_at,
  });

  app.get('/api/sites', auth, async (req, res) => {
    const rows = await db.all(
      `SELECT s.*, m.id AS last_id, m.kind AS last_kind, m.body AS last_body, m.created_at AS last_at,
              m.user_id AS last_user_id, u.name AS last_user,
              (SELECT COUNT(*) FROM messages x
                WHERE x.site_id = s.id AND (x.user_id IS NULL OR x.user_id <> ?) AND x.created_at > ?
                  AND x.id > COALESCE((SELECT r.last_read_id FROM site_reads r
                                        WHERE r.site_id = s.id AND r.user_id = ?), 0)) AS unread
         FROM sites s
         LEFT JOIN messages m ON m.id = (SELECT MAX(id) FROM messages WHERE site_id = s.id)
         LEFT JOIN users u ON u.id = m.user_id
        ORDER BY COALESCE(m.created_at, s.created_at) DESC`, [req.user.id, req.user.createdAt, req.user.id]);
    res.json(rows.map((r) => ({
      ...siteRow(r),
      unread: Number(r.unread),
      last: r.last_id ? { kind: r.last_kind, body: r.last_body || '', at: r.last_at, user: r.last_user || '', mine: r.last_user_id === req.user.id } : null,
    })));
  });

  function readSite(body) {
    const site = {
      name: clean(body.name, 120),
      address: clean(body.address, 200),
      client_name: clean(body.clientName, 120),
      client_phone: clean(body.clientPhone, 40),
      note: clean(body.note, 4000),
      status: STATUSES[body.status] ? body.status : 'u_tijeku',
    };
    return site.name ? site : null;
  }

  app.post('/api/sites', auth, admin, async (req, res) => {
    const s = readSite(req.body);
    if (!s) return fail(res, 400, 'Upišite naziv gradilišta.');
    const { insertId } = await db.run(
      `INSERT INTO sites (name, address, client_name, client_phone, note, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.name, s.address, s.client_name, s.client_phone, s.note, s.status, req.user.id, Date.now()]);
    await systemMessage(insertId, req.user.id, `${req.user.name} je otvorio/la gradilište`);
    res.json({ id: insertId });
  });

  app.patch('/api/sites/:id', auth, admin, async (req, res) => {
    const id = Number(req.params.id);
    const old = await db.get('SELECT * FROM sites WHERE id = ?', [id]);
    if (!old) return fail(res, 404, 'Gradilište ne postoji.');
    const s = readSite({ ...siteRow(old), ...req.body });
    if (!s) return fail(res, 400, 'Upišite naziv gradilišta.');
    await db.run(
      'UPDATE sites SET name = ?, address = ?, client_name = ?, client_phone = ?, note = ?, status = ? WHERE id = ?',
      [s.name, s.address, s.client_name, s.client_phone, s.note, s.status, id]);
    if (s.status !== old.status) {
      await systemMessage(id, req.user.id, `${req.user.name} je promijenio/la status u: ${STATUSES[s.status]}`);
    }
    res.json({ ok: true });
  });

  // ---------- Poruke i slike ----------
  const msgRow = (m) => ({
    id: m.id, userId: m.user_id, user: m.user_name || '', kind: m.kind, body: m.body || '',
    image: m.image ? `/uploads/${m.image}` : null,
    thumb: m.thumb ? `/uploads/${m.thumb}` : null,
    createdAt: m.created_at,
  });

  app.get('/api/sites/:id/messages', auth, async (req, res) => {
    const id = Number(req.params.id);
    const after = Number(req.query.after) || 0;
    const sql = `SELECT m.*, u.name AS user_name FROM messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.site_id = ?`;
    const rows = after
      ? await db.all(`${sql} AND m.id > ? ORDER BY m.id LIMIT 500`, [id, after])
      : (await db.all(`${sql} ORDER BY m.id DESC LIMIT 300`, [id])).reverse();
    res.json(rows.map(msgRow));
  });

  const upload = multer({
    storage: multer.diskStorage({
      destination: UPLOAD_DIR,
      filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${IMAGE_TYPES[file.mimetype]}`),
    }),
    limits: { fileSize: 15 * 1024 * 1024, files: 2 },
    fileFilter: (req, file, cb) => cb(null, !!IMAGE_TYPES[file.mimetype]),
  });

  app.post('/api/sites/:id/messages', auth, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'thumb', maxCount: 1 }]), async (req, res) => {
    const id = Number(req.params.id);
    const image = req.files?.image?.[0]?.filename || null;
    const thumb = req.files?.thumb?.[0]?.filename || image;
    const body = clean(req.body.body, 4000);
    if (!(await db.get('SELECT id FROM sites WHERE id = ?', [id]))) return fail(res, 404, 'Gradilište ne postoji.');
    if (!image && !body) return fail(res, 400, 'Poruka je prazna ili slika nije u podržanom formatu.');
    const t = Date.now();
    const { insertId } = await db.run(
      'INSERT INTO messages (site_id, user_id, kind, body, image, thumb, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, image ? 'image' : 'text', body, image, thumb, t]);
    res.json(msgRow({ id: insertId, user_id: req.user.id, user_name: req.user.name, kind: image ? 'image' : 'text', body, image, thumb, created_at: t }));
  });

  app.post('/api/sites/:id/read', auth, async (req, res) => {
    const siteId = Number(req.params.id);
    const lastId = Number(req.body.lastId) || 0;
    const row = await db.get('SELECT last_read_id FROM site_reads WHERE user_id = ? AND site_id = ?', [req.user.id, siteId]);
    if (!row) {
      await db.run('INSERT INTO site_reads (user_id, site_id, last_read_id) VALUES (?, ?, ?)', [req.user.id, siteId, lastId]);
    } else if (lastId > row.last_read_id) {
      await db.run('UPDATE site_reads SET last_read_id = ? WHERE user_id = ? AND site_id = ?', [lastId, req.user.id, siteId]);
    }
    res.json({ ok: true });
  });

  // Slike vide samo prijavljeni uređaji
  app.use('/uploads', auth, express.static(UPLOAD_DIR, {
    maxAge: '30d', immutable: true, index: false,
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
  }));

  app.use('/api', (req, res) => fail(res, 404, 'Nepoznata adresa.'));

  // ---------- Aplikacija (frontend) ----------
  const PUBLIC_DIR = path.join(__dirname, 'public');
  app.use(express.static(PUBLIC_DIR, { index: false }));
  app.get('/{*any}', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error(err);
    if (err instanceof multer.MulterError) return fail(res, 400, 'Slika je prevelika ili neispravna.');
    fail(res, 500, 'Greška na serveru.');
  });

  app.listen(PORT, () => console.log(`ECOTERM Gradilišta radi na http://localhost:${PORT} (baza: ${db.client})`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
