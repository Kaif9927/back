/**
 * Login/register JSON responses must include ok: true. Do not redirect on HTTP 200 alone
 * (misconfigured proxies or bugs could otherwise send users through as "logged in").
 */
function apiJsonOk(res, data) {
  if (!res || !res.ok || !data || typeof data !== 'object') return false;
  return data.ok === true || data.ok === 1;
}

/**
 * Human-readable login error when HTTP status and JSON disagree (e.g. 200 with empty body).
 */
function loginErrorMessage(res, data) {
  if (data && data.message) return String(data.message);
  if (res && res.ok) {
    const snippet =
      data && typeof data === 'object' && Object.keys(data).length
        ? ' Response JSON: ' + JSON.stringify(data).slice(0, 160)
        : ' Empty or missing JSON body.';
    return (
      'Login did not return { ok: true } (HTTP ' +
      res.status +
      ').' +
      snippet +
      ' Open DevTools → Network → POST /api/login → Response. Use your Render Web Service URL (not a static site). Check /api/health.'
    );
  }
  return 'Login failed (' + (res ? res.status : '?') + ').';
}

async function getSession() {
  const res = await fetch('/api/session', { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return data.user || null;
}

function redirectIfGuest() {
  return getSession().then((user) => {
    if (!user) {
      window.location.href = '/';
      return null;
    }
    return user;
  });
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}

  if (res.status === 401) {
    window.location.href = '/';
    return { res, data: null };
  }

  return { res, data };
}

function showNav(user) {
  const maintenanceLink = document.getElementById('nav-maintenance');
  if (maintenanceLink && user.role !== 'admin') {
    maintenanceLink.classList.add('hidden');
  }
  const vendorPortalLink = document.getElementById('nav-vendor-portal');
  if (vendorPortalLink) {
    vendorPortalLink.classList.toggle('hidden', user.role !== 'vendor');
  }
  const userPortalLink = document.getElementById('nav-user-portal');
  if (userPortalLink) {
    userPortalLink.classList.toggle('hidden', user.role !== 'user');
  }
}
