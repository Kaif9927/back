const db = require('../config/db');

const DURATIONS = ['6 months', '1 year', '2 years'];

function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function addYears(d, n) {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
}

function endDateFromDuration(startDate, durationLabel) {
  const start = new Date(startDate);
  if (durationLabel === '6 months') {
    return addMonths(start, 6);
  }
  if (durationLabel === '1 year') {
    return addYears(start, 1);
  }
  if (durationLabel === '2 years') {
    return addYears(start, 2);
  }
  return null;
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

// add membership (admin)
async function createMembership(req, res) {
  const userId = parseInt(req.body.user_id, 10);
  const duration = (req.body.duration || '').trim();
  const startRaw = (req.body.start_date || '').trim();

  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ ok: false, message: 'Pick a user.' });
  }
  if (!DURATIONS.includes(duration)) {
    return res.status(400).json({ ok: false, message: 'Duration must be 6 months, 1 year, or 2 years.' });
  }
  if (!startRaw) {
    return res.status(400).json({ ok: false, message: 'Start date is required.' });
  }

  const endD = endDateFromDuration(startRaw, duration);
  if (!endD) {
    return res.status(400).json({ ok: false, message: 'Invalid duration.' });
  }

  try {
    const [u] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (u.length === 0) {
      return res.status(400).json({ ok: false, message: 'User not found.' });
    }

    await db.query(
      `INSERT INTO memberships (user_id, duration, start_date, end_date, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [userId, duration, startRaw, fmtDate(endD)]
    );

    return res.json({ ok: true, message: 'Membership saved.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Could not save membership.' });
  }
}

async function getMembershipByNumber(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ ok: false, message: 'Membership number required.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT m.*, u.username FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'No membership with that number.' });
    }
    return res.json({ ok: true, membership: rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Lookup failed.' });
  }
}

async function updateMembership(req, res) {
  const membershipId = parseInt(req.body.membership_id, 10);
  const action = req.body.action;
  const extendMonths = parseInt(req.body.extend_months || '6', 10);

  if (!membershipId) {
    return res.status(400).json({ ok: false, message: 'Membership number is required.' });
  }
  if (action !== 'extend' && action !== 'cancel') {
    return res.status(400).json({ ok: false, message: 'Choose extend or cancel.' });
  }

  try {
    const [existing] = await db.query('SELECT * FROM memberships WHERE id = ?', [membershipId]);
    if (existing.length === 0) {
      return res.status(404).json({ ok: false, message: 'Membership not found.' });
    }

    const m = existing[0];

    if (action === 'cancel') {
      await db.query("UPDATE memberships SET status = 'cancelled' WHERE id = ?", [membershipId]);
      return res.json({ ok: true, message: 'Membership cancelled.' });
    }

    // extend
    const base = new Date(m.end_date);
    const months = [6, 12, 24].includes(extendMonths) ? extendMonths : 6;
    const newEnd = addMonths(base, months);

    await db.query(
      'UPDATE memberships SET end_date = ?, status = ? WHERE id = ?',
      [fmtDate(newEnd), 'active', membershipId]
    );

    return res.json({ ok: true, message: `Extended until ${fmtDate(newEnd)}.` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Update failed.' });
  }
}

async function listUsersForDropdown(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT id, username FROM users WHERE role = 'user' ORDER BY username"
    );
    res.json({ ok: true, users: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Could not load users.' });
  }
}

async function membershipReport(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT m.id, m.user_id, u.username, m.duration, m.start_date, m.end_date, m.status
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       ORDER BY m.id`
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let active = 0;
    let expired = 0;
    const list = rows.map((r) => {
      const end = new Date(r.end_date);
      const naturallyExpired = end < today && r.status !== 'cancelled';
      const bucket =
        r.status === 'cancelled'
          ? 'cancelled'
          : naturallyExpired || r.status === 'expired'
            ? 'expired'
            : 'active';
      if (bucket === 'active') active++;
      if (bucket === 'expired') expired++;
      return { ...r, bucket };
    });

    res.json({
      ok: true,
      rows: list,
      summary: { active, expired, total: rows.length }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Report failed.' });
  }
}

module.exports = {
  createMembership,
  getMembershipByNumber,
  updateMembership,
  listUsersForDropdown,
  membershipReport,
  DURATIONS
};
