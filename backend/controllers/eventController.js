const db = require('../config/db');

async function listEvents(req, res) {
  try {
    const [rows] = await db.query('SELECT id, name, date, location FROM events ORDER BY date');
    res.json({ ok: true, events: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Could not load events.' });
  }
}

async function bookEvent(req, res) {
  const userId = req.session.userId;
  const eventId = parseInt(req.body.event_id, 10);

  if (!eventId) {
    return res.status(400).json({ ok: false, message: 'Pick an event.' });
  }

  try {
    const [ev] = await db.query('SELECT id FROM events WHERE id = ?', [eventId]);
    if (ev.length === 0) {
      return res.status(400).json({ ok: false, message: 'Event does not exist.' });
    }

    const [dup] = await db.query(
      'SELECT id FROM transactions WHERE user_id = ? AND event_id = ?',
      [userId, eventId]
    );
    if (dup.length > 0) {
      return res.status(400).json({ ok: false, message: 'You already registered for that event.' });
    }

    const today = new Date().toISOString().slice(0, 10);
    await db.query(
      'INSERT INTO transactions (user_id, event_id, date) VALUES (?, ?, ?)',
      [userId, eventId, today]
    );

    res.json({ ok: true, message: 'Registered.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Booking failed.' });
  }
}

async function myTransactions(req, res) {
  const userId = req.session.userId;
  try {
    const [rows] = await db.query(
      `SELECT t.id, t.date, e.name as event_name, e.date as event_date, e.location
       FROM transactions t
       JOIN events e ON e.id = t.event_id
       WHERE t.user_id = ?
       ORDER BY t.date DESC`,
      [userId]
    );
    res.json({ ok: true, transactions: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Could not load your bookings.' });
  }
}

async function participationReport(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT e.id, e.name, e.date, e.location, COUNT(t.id) as registrations
       FROM events e
       LEFT JOIN transactions t ON t.event_id = e.id
       GROUP BY e.id, e.name, e.date, e.location
       ORDER BY e.date`
    );

    const [detail] = await db.query(
      `SELECT t.id, u.username, e.name as event_name, t.date
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       JOIN events e ON e.id = t.event_id
       ORDER BY t.date DESC`
    );

    res.json({ ok: true, byEvent: rows, lines: detail });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Report error.' });
  }
}

module.exports = {
  listEvents,
  bookEvent,
  myTransactions,
  participationReport
};
