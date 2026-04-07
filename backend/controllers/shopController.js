const db = require('../config/db');

async function listVendors(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT v.id, v.business_name, v.category, v.contact_details, u.username
       FROM vendors v
       JOIN users u ON u.id = v.user_id
       ORDER BY v.business_name`
    );
    res.json({ ok: true, vendors: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function vendorDetail(req, res) {
  const id = parseInt(req.params.id, 10);
  try {
    const [rows] = await db.query(
      `SELECT v.*, u.username FROM vendors v JOIN users u ON u.id = v.user_id WHERE v.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Vendor not found.' });
    res.json({ ok: true, vendor: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function vendorProducts(req, res) {
  const id = parseInt(req.params.id, 10);
  try {
    const [rows] = await db.query(
      `SELECT id, name, price, image_url, status FROM products WHERE vendor_id = ? AND status = 'active'`,
      [id]
    );
    res.json({ ok: true, products: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function getCart(req, res) {
  const uid = req.session.userId;
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.quantity, c.product_id, p.name, p.price, p.image_url, p.vendor_id, v.business_name
       FROM cart_items c
       JOIN products p ON p.id = c.product_id
       JOIN vendors v ON v.id = p.vendor_id
       WHERE c.user_id = ?`,
      [uid]
    );
    let subtotal = 0;
    rows.forEach((r) => {
      subtotal += Number(r.price) * r.quantity;
    });
    res.json({ ok: true, items: rows, subtotal });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function addCartItem(req, res) {
  const productId = parseInt(req.body.product_id, 10);
  const qty = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  const uid = req.session.userId;
  if (!productId) {
    return res.status(400).json({ ok: false, message: 'Pick a product.' });
  }
  try {
    const [p] = await db.query("SELECT id FROM products WHERE id = ? AND status = 'active'", [productId]);
    if (!p.length) return res.status(400).json({ ok: false, message: 'Product not available.' });
    await db.query(
      `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
      [uid, productId, qty]
    );
    res.json({ ok: true, message: 'Added to cart.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function setCartQty(req, res) {
  const productId = parseInt(req.params.productId, 10);
  const qty = parseInt(req.body.quantity, 10);
  const uid = req.session.userId;
  if (!productId || qty < 1) {
    return res.status(400).json({ ok: false, message: 'Bad quantity.' });
  }
  try {
    await db.query('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?', [
      qty,
      uid,
      productId
    ]);
    res.json({ ok: true, message: 'Updated.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function removeCartItem(req, res) {
  const productId = parseInt(req.params.productId, 10);
  const uid = req.session.userId;
  try {
    await db.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [uid, productId]);
    res.json({ ok: true, message: 'Removed.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function clearCart(req, res) {
  try {
    await db.query('DELETE FROM cart_items WHERE user_id = ?', [req.session.userId]);
    res.json({ ok: true, message: 'Cart cleared.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function checkout(req, res) {
  const uid = req.session.userId;
  const body = req.body;
  const name = (body.customer_name || '').trim();
  const email = (body.customer_email || '').trim();
  const phone = (body.customer_phone || '').trim();
  const address = (body.customer_address || '').trim();
  const city = (body.customer_city || '').trim();
  const state = (body.customer_state || '').trim();
  const pin = (body.customer_pin || '').trim();
  const payment = (body.payment_method || '').trim();
  if (!name || !email || !phone || !address || !city || !state || !pin || !payment) {
    return res.status(400).json({ ok: false, message: 'All shipping fields are required.' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query(
      `SELECT c.quantity, p.id AS product_id, p.price, p.name
       FROM cart_items c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ?`,
      [uid]
    );
    if (!items.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: 'Cart is empty.' });
    }
    let total = 0;
    items.forEach((i) => {
      total += Number(i.price) * i.quantity;
    });
    const [ins] = await conn.query(
      `INSERT INTO orders (user_id, grand_total, fulfillment_status, customer_name, customer_email,
        customer_phone, customer_address, customer_city, customer_state, customer_pin, payment_method)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid, total, name, email, phone, address, city, state, pin, payment]
    );
    const orderId = ins.insertId;
    for (const i of items) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, i.product_id, i.quantity, i.price]
      );
    }
    await conn.query('DELETE FROM cart_items WHERE user_id = ?', [uid]);
    await conn.commit();
    res.json({ ok: true, order_id: orderId, grand_total: total, message: 'Order placed.' });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ ok: false, message: 'Checkout failed.' });
  } finally {
    conn.release();
  }
}

async function myOrders(req, res) {
  try {
    const [orders] = await db.query(
      `SELECT id, grand_total, fulfillment_status, customer_name, customer_email, created_at
       FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [req.session.userId]
    );
    res.json({ ok: true, orders });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function createItemRequest(req, res) {
  const desc = (req.body.description || '').trim();
  const vendorId = req.body.vendor_id ? parseInt(req.body.vendor_id, 10) : null;
  if (!desc) return res.status(400).json({ ok: false, message: 'Describe what you need.' });
  try {
    await db.query('INSERT INTO item_requests (user_id, vendor_id, description) VALUES (?, ?, ?)', [
      req.session.userId,
      vendorId,
      desc
    ]);
    res.json({ ok: true, message: 'Request submitted.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function myItemRequests(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT r.*, v.business_name FROM item_requests r
       LEFT JOIN vendors v ON v.id = r.vendor_id
       WHERE r.user_id = ? ORDER BY r.created_at DESC`,
      [req.session.userId]
    );
    res.json({ ok: true, requests: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function listGuests(req, res) {
  try {
    const [rows] = await db.query('SELECT id, name FROM guest_list WHERE user_id = ? ORDER BY id', [
      req.session.userId
    ]);
    res.json({ ok: true, guests: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function addGuest(req, res) {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ ok: false, message: 'Name required.' });
  try {
    await db.query('INSERT INTO guest_list (user_id, name) VALUES (?, ?)', [req.session.userId, name]);
    res.json({ ok: true, message: 'Added.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function deleteGuest(req, res) {
  const id = parseInt(req.params.id, 10);
  try {
    await db.query('DELETE FROM guest_list WHERE id = ? AND user_id = ?', [id, req.session.userId]);
    res.json({ ok: true, message: 'Removed.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

module.exports = {
  listVendors,
  vendorDetail,
  vendorProducts,
  getCart,
  addCartItem,
  setCartQty,
  removeCartItem,
  clearCart,
  checkout,
  myOrders,
  createItemRequest,
  myItemRequests,
  listGuests,
  addGuest,
  deleteGuest
};
