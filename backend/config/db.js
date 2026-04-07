const { Pool } = require('pg');

require('./loadEnv').loadEnv();

/** Render Dashboard often uses `DB_URL`; docs use `DATABASE_URL`. Either works. */
function getDatabaseUrl() {
  return (process.env.DATABASE_URL || process.env.DB_URL || '').trim();
}

function mysqlPlaceholdersToPg(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

function buildPgText(text) {
  let pgText = mysqlPlaceholdersToPg(text);
  const t = text.trim();
  if (/^INSERT\s+INTO/i.test(t) && !/RETURNING/i.test(text)) {
    pgText += ' RETURNING id';
  }
  return pgText;
}

function wrapMysqlStyleResult(result) {
  if (result.command === 'INSERT') {
    const id =
      result.rows && result.rows[0] && result.rows[0].id != null ? result.rows[0].id : null;
    return [{ insertId: id, affectedRows: result.rowCount }];
  }
  return [result.rows || []];
}

const connectionString = getDatabaseUrl();
const useSsl =
  Boolean(connectionString) &&
  (connectionString.includes('render.com') ||
    process.env.DATABASE_SSL === '1' ||
    /[?&]sslmode=require/i.test(connectionString));

const pool = new Pool({
  connectionString: connectionString || undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined
});

async function query(text, params = []) {
  const pgText = buildPgText(text);
  const result = await pool.query(pgText, params);
  return wrapMysqlStyleResult(result);
}

async function getConnection() {
  const client = await pool.connect();
  return {
    async beginTransaction() {
      await client.query('BEGIN');
    },
    async commit() {
      await client.query('COMMIT');
    },
    async rollback() {
      await client.query('ROLLBACK');
    },
    release() {
      client.release();
    },
    async query(text, params = []) {
      const pgText = buildPgText(text);
      const result = await client.query(pgText, params || []);
      return wrapMysqlStyleResult(result);
    }
  };
}

module.exports = { query, getConnection, pool, getDatabaseUrl };
