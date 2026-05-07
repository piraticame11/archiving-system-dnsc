// Central fetch wrapper — auto-injects Bearer token, handles 401 with retry
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers, credentials: 'include' });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      // Only redirect if we're not already on a public auth page
      const pub = ['/pages/login.html', '/pages/register.html', '/pages/forgot-password.html', '/pages/reset-password.html'];
      if (!pub.some(p => window.location.pathname.endsWith(p))) {
        window.location.href = '/pages/login.html';
      }
      return res;
    }
    headers['Authorization'] = `Bearer ${newToken}`;
    return fetch(path, { ...options, headers, credentials: 'include' });
  }

  return res;
}

async function apiGet(path) {
  return apiFetch(path, { method: 'GET' });
}

async function apiPost(path, body) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
}

async function apiPatch(path, body) {
  return apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
}

async function apiDelete(path) {
  return apiFetch(path, { method: 'DELETE' });
}

async function apiPostForm(path, formData) {
  const token = getAccessToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(path, { method: 'POST', headers, body: formData, credentials: 'include' });
}
