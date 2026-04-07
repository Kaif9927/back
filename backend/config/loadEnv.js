const fs = require('fs');
const path = require('path');

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .forEach((line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return;

      const key = line.slice(0, idx).trim();
      const value = stripQuotes(line.slice(idx + 1).trim());
      if (!key) return;
      if (process.env[key] !== undefined) return;
      process.env[key] = value;
    });
}

module.exports = { loadEnv };

