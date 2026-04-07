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

function readEnvFile(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;

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
      if (key) out[key] = value;
    });
  return out;
}

/**
 * Merge backend/.env then repo root `.env` (root wins on duplicate keys).
 * Never overwrites keys already set in process.env (e.g. Render dashboard).
 */
function loadEnv() {
  const backendDir = path.join(__dirname, '..');
  const repoRoot = path.join(backendDir, '..');
  const merged = {
    ...readEnvFile(path.join(backendDir, '.env')),
    ...readEnvFile(path.join(repoRoot, '.env'))
  };
  Object.entries(merged).forEach(([key, value]) => {
    if (value === '' || process.env[key] !== undefined) return;
    process.env[key] = value;
  });
}

module.exports = { loadEnv };
