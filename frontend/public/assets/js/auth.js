// In-memory access token (never stored in localStorage)
let _accessToken = null;

function setAccessToken(token) { _accessToken = token; }
function getAccessToken()      { return _accessToken; }
function clearAccessToken()    { _accessToken = null; }

function getUser() {
  if (!_accessToken) return null;
  try {
    const payload = JSON.parse(atob(_accessToken.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) { _accessToken = null; return null; }
    return payload;
  } catch { return null; }
}

function isAuthenticated() { return !!getUser(); }

async function refreshAccessToken() {
  try {
    const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error('Refresh failed');
    const data = await res.json();
    setAccessToken(data.data.accessToken);
    return data.data.accessToken;
  } catch {
    clearAccessToken();
    return null;
  }
}

async function logout() {
  try {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Authorization': `Bearer ${_accessToken}` },
    });
  } catch {}
  clearAccessToken();
  window.location.href = '/pages/login.html';
}

// Sync guard — only safe to call AFTER requireAuthAsync() has resolved
function requireAuth(...allowedRoles) {
  const user = getUser();
  if (!user) { window.location.href = '/pages/login.html'; return null; }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    window.location.href = '/pages/login.html';
    return null;
  }
  return user;
}

// Async guard for protected pages — always call this on page load.
// Restores session via refresh token if access token is missing (fresh navigation).
// Usage: requireAuthAsync('admin','superadmin').then(user => { if (!user) return; ... });
async function requireAuthAsync(...allowedRoles) {
  if (!_accessToken || !getUser()) {
    await refreshAccessToken();
  }
  const user = getUser();
  if (!user) {
    window.location.href = '/pages/login.html';
    return null;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    window.location.href = '/pages/login.html';
    return null;
  }
  return user;
}

// On page load, try to restore session via refresh token
async function restoreSession() {
  if (_accessToken && getUser()) return true;
  const token = await refreshAccessToken();
  return !!token;
}
