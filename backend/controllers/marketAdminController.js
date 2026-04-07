const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function listUsers(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.email, u.role,
              v.id AS vendor_id, v.business_name, v.category, v.contact_details
       FROM users u
       LEFT JOIN vendors v ON v.user_id = u.id
       ORDER BY u.id`
    );
    res.json({ ok: true, users: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function createUser(req, res) {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const email = (req.body.email || '').trim();
  const role = (req.body.role || 'user').trim();
  const businessName = (req.body.business_name || '').trim();
  const category = (req.body.category || '').trim();
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'Username and password required.' });
  }
  if (!['admin', 'vendor', 'user'].includes(role)) {
    return res.status(400).json({ ok: false, message: 'Bad role.' });
  }
  if (role === 'vendor' && !businessName) {
    return res.status(400).json({ ok: false, message: 'Business name required for vendor.' });
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
        const contact =
          req.body.contact_details != null ? String(req.body.contact_details).trim() || null : null;
        await conn.query(
          'INSERT INTO vendors (user_id, business_name, category, contact_details) VALUES (?, ?, ?, ?)',
          [uid, businessName, category || null, contact]
        );
      }
      await conn.commit();
      res.json({ ok: true, message: 'User created.', id: uid });
    } catch (e) {
      await conn.rollback();
      if (e.code === 'ER_DUP_ENTRY' || e.code === '23505') {
        return res.status(400).json({ ok: false, message: 'Username taken.' });
      }
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function updateUser(req, res) {
  const id = parseInt(req.params.id, 10);
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';
  if (!id) return res.status(400).json({ ok: false, message: 'Bad id.' });
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET email = ?, password = ? WHERE id = ?', [
        email || null,
        hash,
        id
      ]);
    } else {
      await db.query('UPDATE users SET email = ? WHERE id = ?', [email || null, id]);
    }
    res.json({ ok: true, message: 'Updated.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function deleteUser(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || id === req.session.userId) {
    return res.status(400).json({ ok: false, message: 'Cannot delete that account.' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [vrows] = await conn.query('SELECT id FROM vendors WHERE user_id = ?', [id]);
    if (vrows.length) {
      const vid = vrows[0].id;
      await conn.query(
        `DELETE FROM order_items oi USING products p
         WHERE oi.product_id = p.id AND p.vendor_id = ?`,
        [vid]
      );
      await conn.query('DELETE FROM products WHERE vendor_id = ?', [vid]);
      await conn.query('DELETE FROM item_requests WHERE vendor_id = ?', [vid]);
      await conn.query('DELETE FROM vendors WHERE id = ?', [vid]);
    }
    await conn.query('DELETE FROM cart_items WHERE user_id = ?', [id]);
    await conn.query('DELETE FROM orders WHERE user_id = ?', [id]);
    await conn.query('DELETE FROM item_requests WHERE user_id = ?', [id]);
    await conn.query('DELETE FROM guest_list WHERE user_id = ?', [id]);
    await conn.query('DELETE FROM transactions WHERE user_id = ?', [id]);
    await conn.query('DELETE FROM memberships WHERE user_id = ?', [id]);
    await conn.query('DELETE FROM users WHERE id = ?', [id]);
    await conn.commit();
    res.json({ ok: true, message: 'Deleted.' });
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {}
    console.error(e);
    res.status(400).json({
      ok: false,
      message: 'Could not delete user.'
    });
  } finally {
    conn.release();
  }
}

async function createVendorAdmin(req, res) {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const email = (req.body.email || '').trim();
  const businessName = (req.body.business_name || '').trim();
  const category = (req.body.category || '').trim();
  const contact = req.body.contact_details;
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'Username and password required.' });
  }
  if (!businessName) {
    return res.status(400).json({ ok: false, message: 'Business name required for vendor.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [ins] = await conn.query(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [username, email || null, hash, 'vendor']
      );
      const uid = ins.insertId;
      await conn.query(
        'INSERT INTO vendors (user_id, business_name, category, contact_details) VALUES (?, ?, ?, ?)',
        [uid, businessName, category || null, contact ? String(contact).trim() || null : null]
      );
      await conn.commit();
      return res.json({ ok: true, message: 'Vendor created.', id: uid });
    } catch (e) {
      await conn.rollback();
      if (e.code === 'ER_DUP_ENTRY' || e.code === '23505') {
        return res.status(400).json({ ok: false, message: 'Username taken.' });
      }
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function listVendorsAdmin(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT v.id, v.business_name, v.category, v.contact_details, u.username, u.email
       FROM vendors v JOIN users u ON u.id = v.user_id ORDER BY v.id`
    );
    res.json({ ok: true, vendors: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function updateVendorAdmin(req, res) {
  const id = parseInt(req.params.id, 10);
  const businessName = (req.body.business_name || '').trim();
  const category = (req.body.category || '').trim();
  const contact = (req.body.contact_details || '').trim();
  if (!id || !businessName) return res.status(400).json({ ok: false, message: 'Invalid.' });
  try {
    await db.query(
      'UPDATE vendors SET business_name = ?, category = ?, contact_details = ? WHERE id = ?',
      [businessName, category || null, contact || null, id]
    );
    res.json({ ok: true, message: 'Vendor updated.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function deleteVendorAdmin(req, res) {
  const id = parseInt(req.params.id, 10);
  const conn = await db.getConnection();
  try {
    const [v] = await conn.query('SELECT user_id FROM vendors WHERE id = ?', [id]);
    if (!v.length) return res.status(404).json({ ok: false, message: 'Not found.' });
    const uid = v[0].user_id;
    await conn.beginTransaction();
    await conn.query(
      `DELETE FROM order_items oi USING products p
       WHERE oi.product_id = p.id AND p.vendor_id = ?`,
      [id]
    );
    await conn.query('DELETE FROM products WHERE vendor_id = ?', [id]);
    await conn.query('DELETE FROM vendors WHERE id = ?', [id]);
    await conn.query('DELETE FROM users WHERE id = ?', [uid]);
    await conn.commit();
    res.json({ ok: true, message: 'Vendor and user removed.' });
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {}
    console.error(e);
    res.status(400).json({ ok: false, message: 'Could not delete vendor.' });
  } finally {
    conn.release();
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  createVendorAdmin,
  listVendorsAdmin,
  updateVendorAdmin,
  deleteVendorAdmin
};
