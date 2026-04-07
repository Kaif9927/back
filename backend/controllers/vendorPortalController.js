const db = require('../config/db');

async function getVendorId(userId) {
  const [r] = await db.query('SELECT id FROM vendors WHERE user_id = ?', [userId]);
  return r.length ? r[0].id : null;
}

async function profile(req, res) {
  try {
    const vid = await getVendorId(req.session.userId);
    if (!vid) return res.status(400).json({ ok: false, message: 'No vendor profile.' });
    const [rows] = await db.query(
      `SELECT v.*, u.username, u.email FROM vendors v JOIN users u ON u.id = v.user_id WHERE v.id = ?`,
      [vid]
    );
    return res.json({ ok: true, vendor: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function listProducts(req, res) {
  try {
    const vid = await getVendorId(req.session.userId);
    if (!vid) return res.status(400).json({ ok: false, message: 'No vendor profile.' });
    const [rows] = await db.query(
      'SELECT id, name, price, image_url, status FROM products WHERE vendor_id = ? ORDER BY id',
      [vid]
    );
    res.json({ ok: true, products: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function addProduct(req, res) {
  const name = (req.body.name || '').trim();
  const price = parseFloat(req.body.price);
  const imageUrl = (req.body.image_url || '').trim() || '/img/placeholder-product.svg';
  if (!name || Number.isNaN(price) || price < 0) {
    return res.status(400).json({ ok: false, message: 'Name and valid price required.' });
  }
  try {
    const vid = await getVendorId(req.session.userId);
    if (!vid) return res.status(400).json({ ok: false, message: 'No vendor profile.' });
    await db.query(
      'INSERT INTO products (vendor_id, name, price, image_url, status) VALUES (?, ?, ?, ?, ?)',
      [vid, name, price, imageUrl, 'active']
    );
    res.json({ ok: true, message: 'Product added.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Could not add.' });
  }
}

async function updateProduct(req, res) {
  const id = parseInt(req.params.id, 10);
  const name = (req.body.name || '').trim();
  const price = parseFloat(req.body.price);
  const imageUrl = (req.body.image_url || '').trim();
  if (!id || !name || Number.isNaN(price)) {
    return res.status(400).json({ ok: false, message: 'Invalid data.' });
  }
  try {
    const vid = await getVendorId(req.session.userId);
    const [chk] = await db.query('SELECT id FROM products WHERE id = ? AND vendor_id = ?', [id, vid]);
    if (!chk.length) return res.status(404).json({ ok: false, message: 'Not found.' });
    await db.query(
      'UPDATE products SET name = ?, price = ?, image_url = COALESCE(NULLIF(?, \'\'), image_url) WHERE id = ?',
      [name, price, imageUrl, id]
    );
    res.json({ ok: true, message: 'Updated.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function deleteProduct(req, res) {
  const id = parseInt(req.params.id, 10);
  try {
    const vid = await getVendorId(req.session.userId);
    const [chk] = await db.query('SELECT id FROM products WHERE id = ? AND vendor_id = ?', [id, vid]);
    if (!chk.length) return res.status(404).json({ ok: false, message: 'Not found.' });
    await db.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ ok: true, message: 'Deleted.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function listOrdersForVendor(req, res) {
  try {
    const vid = await getVendorId(req.session.userId);
    if (!vid) return res.status(400).json({ ok: false, message: 'No vendor profile.' });
    const [orders] = await db.query(
      `SELECT DISTINCT o.id, o.grand_total, o.fulfillment_status, o.customer_name, o.customer_email,
        o.customer_address, o.customer_city, o.created_at
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE p.vendor_id = ?
       ORDER BY o.created_at DESC`,
      [vid]
    );
    for (const o of orders) {
      const [items] = await db.query(
        `SELECT oi.quantity, oi.unit_price, pr.name AS product_name
         FROM order_items oi
         JOIN products pr ON pr.id = oi.product_id
         WHERE oi.order_id = ? AND pr.vendor_id = ?`,
        [o.id, vid]
      );
      o.items = items;
    }
    res.json({ ok: true, orders });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function updateOrderStatus(req, res) {
  const orderId = parseInt(req.params.id, 10);
  const status = (req.body.fulfillment_status || '').trim();
  const allowed = ['pending', 'received', 'ready_for_shipping', 'out_for_delivery', 'completed'];
  if (!orderId || !allowed.includes(status)) {
    return res.status(400).json({ ok: false, message: 'Bad status or order id.' });
  }
  try {
    const vid = await getVendorId(req.session.userId);
    const [chk] = await db.query(
      `SELECT o.id FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE o.id = ? AND p.vendor_id = ?
       LIMIT 1`,
      [orderId, vid]
    );
    if (!chk.length) return res.status(404).json({ ok: false, message: 'Order not tied to your items.' });
    await db.query('UPDATE orders SET fulfillment_status = ? WHERE id = ?', [status, orderId]);
    res.json({ ok: true, message: 'Status updated.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function listRequestsForVendor(req, res) {
  try {
    const vid = await getVendorId(req.session.userId);
    const [rows] = await db.query(
      `SELECT r.*, u.username, u.email
       FROM item_requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.vendor_id = ? OR r.vendor_id IS NULL
       ORDER BY r.created_at DESC`,
      [vid]
    );
    res.json({ ok: true, requests: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function updateRequest(req, res) {
  const rid = parseInt(req.params.id, 10);
  const status = (req.body.status || '').trim();
  if (!rid || !status) return res.status(400).json({ ok: false, message: 'Invalid.' });
  try {
    const vid = await getVendorId(req.session.userId);
    await db.query(
      'UPDATE item_requests SET status = ? WHERE id = ? AND (vendor_id = ? OR vendor_id IS NULL)',
      [status, rid, vid]
    );
    res.json({ ok: true, message: 'Updated request.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

async function deleteRequest(req, res) {
  const rid = parseInt(req.params.id, 10);
  try {
    const vid = await getVendorId(req.session.userId);
    await db.query('DELETE FROM item_requests WHERE id = ? AND vendor_id = ?', [rid, vid]);
    res.json({ ok: true, message: 'Removed.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Failed.' });
  }
}

module.exports = {
  profile,
  listProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  listOrdersForVendor,
  updateOrderStatus,
  listRequestsForVendor,
  updateRequest,
  deleteRequest
};
