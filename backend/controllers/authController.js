const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function login(req, res) {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const expectedRole = (req.body.expectedRole || '').trim();

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'Username and password are required.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT id, username, email, password, role FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, message: 'Bad username or password.' });
    }

    const row = rows[0];
    const stored = row.password;
    if (
      !stored ||
      typeof stored !== 'string' ||
      stored.length < 20 ||
      !stored.startsWith('$2')
    ) {
      console.error('login: invalid or missing password hash for user id %s', row.id);
      return res.status(500).json({
        ok: false,
        message: 'Account data is invalid. Reset the user password or re-run database seed.'
      });
    }
    const match = await bcrypt.compare(password, stored);
    if (!match) {
      return res.status(401).json({ ok: false, message: 'Bad username or password.' });
    }

    if (expectedRole && row.role !== expectedRole) {
      return res.status(403).json({
        ok: false,
        message: 'This account is not for that login page. Use the right portal.'
      });
    }

    const userPayload = {
      id: Number(row.id),
      username: String(row.username),
      email: row.email != null ? String(row.email) : null,
      role: String(row.role)
    };

    req.session.userId = userPayload.id;
    req.session.username = userPayload.username;
    req.session.role = userPayload.role;
    req.session.email = userPayload.email;

    // Ensure store (e.g. connect-pg-simple) finishes persisting before the client
    // navigates; otherwise the next GET /api/session can run before the row exists.
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    // Explicit JSON string (not res.json) avoids rare edge cases where session
    // middleware + JSON serialization interact badly; always send a non-empty body.
    const body = {
      ok: true,
      success: true,
      message: 'Logged in.',
      user: userPayload
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    return res.status(200).send(JSON.stringify(body));
  } catch (err) {
    console.error('login err', err);
    return res.status(500).json({ ok: false, message: 'Something is wrong DB-side. Try again.' });
  }
}

async function register(req, res) {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const email = (req.body.email || '').trim();
  const role = (req.body.role || 'user').trim();
  const businessName = (req.body.business_name || '').trim();
  const category = (req.body.category || '').trim();

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'Username and password are required.' });
  }
  if (!['admin', 'vendor', 'user'].includes(role)) {
    return res.status(400).json({ ok: false, message: 'Role must be admin, vendor, or user.' });
  }
  if (role === 'vendor' && !businessName) {
    return res.status(400).json({ ok: false, message: 'Business name is required for vendors.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [ins] = await conn.query(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [username, email || null, hash, role]
      );
      const uid = ins.insertId;
      if (role === 'vendor') {
        await conn.query(
          'INSERT INTO vendors (user_id, business_name, category, contact_details) VALUES (?, ?, ?, ?)',
          [uid, businessName, category || null, req.body.contact_details || null]
        );
      }
      await conn.commit();
      return res.json({ ok: true, message: 'Account created. You can log in now.' });
    } catch (e) {
      await conn.rollback();
      if (e.code === 'ER_DUP_ENTRY' || e.code === '23505') {
        return res.status(400).json({ ok: false, message: 'Username already taken.' });
      }
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('register err', err);
    return res.status(500).json({ ok: false, message: 'Could not register.' });
  }
}

function logout(req, res) {
  req.session.destroy((err) => {
    res.clearCookie('connect.sid', { path: '/' });
    if (err) {
      console.error('logout destroy', err);
      return res.status(500).json({ ok: false, message: 'Could not log out.' });
    }
    return res.json({ ok: true, message: 'Logged out.' });
  });
}

async function sessionInfo(req, res) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, message: 'Not logged in.' });
  }
  try {
    const [rows] = await db.query('SELECT email FROM users WHERE id = ?', [req.session.userId]);
    const email = rows.length ? rows[0].email : null;
    req.session.email = email;
    res.json({
      ok: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        email,
        role: req.session.role
      }
    });
  } catch (e) {
    res.json({
      ok: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        email: null,
        role: req.session.role
      }
    });
  }
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ ok: false, message: 'Session expired or not logged in.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ ok: false, message: 'Admins only for that.' });
  }
  next();
}

function requireVendor(req, res, next) {
  if (req.session.role !== 'vendor') {
    return res.status(403).json({ ok: false, message: 'Vendors only.' });
  }
  next();
}

function requireCustomer(req, res, next) {
  if (req.session.role !== 'user') {
    return res.status(403).json({ ok: false, message: 'Regular users only for that.' });
  }
  next();
}

module.exports = {
  login,
  register,
  logout,
  sessionInfo,
  requireAuth,
  requireAdmin,
  requireVendor,
  requireCustomer
};
