export function getAuthToken() {
  return localStorage.getItem('token');
}

export function getCurrentUser() {
  const raw = localStorage.getItem('currentUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function setSession({ token, user }) {
  if (token) localStorage.setItem('token', token);
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('email', user.email || '');
  }
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('email');
}
