let currentUser = null;

function getToken() {
  return localStorage.getItem('mytube_token');
}

function setToken(token) {
  if (token) localStorage.setItem('mytube_token', token);
  else localStorage.removeItem('mytube_token');
}

async function checkAuth() {
  const token = getToken();
  if (!token) { currentUser = null; return null; }
  try {
    const res = await fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) { currentUser = null; setToken(null); return null; }
    currentUser = await res.json();
    return currentUser;
  } catch {
    currentUser = null;
    return null;
  }
}

async function register(username, email, password) {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  setToken(data.token);
  currentUser = data.user;
  return data.user;
}

async function login(login, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  setToken(data.token);
  currentUser = data.user;
  return data.user;
}

function logout() {
  setToken(null);
  currentUser = null;
}

function authHeaders() {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function showAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('active');
}

function hideAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
}

function updateAuthUI() {
  const userInfo = document.getElementById('userInfo');
  const authBtns = document.getElementById('authButtons');
  if (!userInfo || !authBtns) return;

  if (currentUser) {
    userInfo.style.display = 'flex';
    authBtns.style.display = 'none';
    document.getElementById('userName').textContent = currentUser.username;
  } else {
    userInfo.style.display = 'none';
    authBtns.style.display = 'flex';
  }
}

function initAuthUI() {
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const authError = document.getElementById('authError');

  if (loginTab) {
    loginTab.addEventListener('click', () => {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      loginForm.style.display = 'flex';
      registerForm.style.display = 'none';
      authError.style.display = 'none';
    });
  }

  if (registerTab) {
    registerTab.addEventListener('click', () => {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      registerForm.style.display = 'flex';
      loginForm.style.display = 'none';
      authError.style.display = 'none';
    });
  }

  document.querySelectorAll('.modal-close').forEach(el => {
    el.addEventListener('click', hideAuthModal);
  });

  document.getElementById('loginSubmit')?.addEventListener('click', async () => {
    const l = document.getElementById('loginLogin').value;
    const p = document.getElementById('loginPassword').value;
    try {
      await login(l, p);
      hideAuthModal();
      updateAuthUI();
      location.reload();
    } catch (e) {
      authError.textContent = e.message;
      authError.style.display = 'block';
    }
  });

  document.getElementById('registerSubmit')?.addEventListener('click', async () => {
    const u = document.getElementById('regUsername').value;
    const e = document.getElementById('regEmail').value;
    const p = document.getElementById('regPassword').value;
    try {
      await register(u, e, p);
      hideAuthModal();
      updateAuthUI();
      location.reload();
    } catch (err) {
      authError.textContent = err.message;
      authError.style.display = 'block';
    }
  });

  document.getElementById('loginBtn')?.addEventListener('click', showAuthModal);
  document.getElementById('registerBtn')?.addEventListener('click', showAuthModal);
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    logout();
    updateAuthUI();
    location.reload();
  });
}
