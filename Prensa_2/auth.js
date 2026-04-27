// auth.js — Google Sign-In para Oropezas.com
// Usa Google Identity Services (GIS) — sin Firebase, sin dependencias externas.
// El GOOGLE_CLIENT_ID se configura en Google Cloud Console → APIs & Credentials.

const OROPEZAS_AUTH = (function () {
  // ─── CONFIGURACIÓN ─────────────────────────────────────────────────────────
  // Reemplaza este valor con tu Client ID real desde:
  // https://console.cloud.google.com/apis/credentials
  const GOOGLE_CLIENT_ID = '233406003665-udr6c9vv4jej9ur8bsa22tdr9edouvfl.apps.googleusercontent.com';

  // Endpoints del worker
  const WORKER_URL = 'https://oropezas.enriquegarciaoropeza.workers.dev';

  // ─── ESTADO ────────────────────────────────────────────────────────────────
  let currentUser = null;

  // ─── INICIALIZACIÓN ────────────────────────────────────────────────────────
  function init() {
    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = _setupGSI;
      document.head.appendChild(script);
    } else {
      _setupGSI();
    }

    const saved = localStorage.getItem('oropezas_user');
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
        _updateUI(currentUser);
      } catch (e) {
        localStorage.removeItem('oropezas_user');
      }
    }
  }

  function _setupGSI() {
    if (typeof google === 'undefined') return;
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: _handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    const btnContainer = document.getElementById('google-signin-btn');
    if (btnContainer) {
      google.accounts.id.renderButton(btnContainer, {
        theme: 'outline',
        size: 'medium',
        shape: 'pill',
        text: 'signin_with',
        locale: 'es',
      });
    }

    if (!currentUser) {
      google.accounts.id.prompt();
    }
  }

  // ─── CALLBACK DE LOGIN ────────────────────────────────────────────────────
  async function _handleCredentialResponse(response) {
    const idToken = response.credential;
    const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

    const user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      token: idToken,
      loginAt: new Date().toISOString(),
    };

    currentUser = user;
    localStorage.setItem('oropezas_user', JSON.stringify(user));

    try {
      await fetch(`${WORKER_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
    } catch (e) {
      console.warn('Worker auth endpoint no disponible:', e.message);
    }

    _updateUI(user);
    _closeModal();
    document.dispatchEvent(new CustomEvent('oropezas:login', { detail: user }));
  }

  // ─── LOGOUT ───────────────────────────────────────────────────────────────
  function logout() {
    currentUser = null;
    localStorage.removeItem('oropezas_user');

    if (typeof google !== 'undefined') {
      google.accounts.id.disableAutoSelect();
    }

    _updateUI(null);
    document.dispatchEvent(new CustomEvent('oropezas:logout'));

    if (window.location.pathname.includes('account.html')) {
      window.location.href = 'index.html';
    }
  }

  // ─── UI ───────────────────────────────────────────────────────────────────
  function _updateUI(user) {
    const loginBtn = document.getElementById('auth-login-btn');
    const userAvatar = document.getElementById('auth-user-avatar');
    const userName = document.getElementById('auth-user-name');
    const userPicture = document.getElementById('auth-user-picture');

    if (user) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userAvatar) userAvatar.style.display = 'flex';
      if (userName) userName.textContent = user.name.split(' ')[0];
      if (userPicture) {
        userPicture.src = user.picture;
        userPicture.alt = user.name;
      }
    } else {
      if (loginBtn) loginBtn.style.display = 'flex';
      if (userAvatar) userAvatar.style.display = 'none';
      const menu = document.getElementById('auth-user-menu');
      if (menu) menu.classList.remove('open');
    }
  }

  function openLoginModal() {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
      modal = _createModal();
      document.body.appendChild(modal);
    }
    modal.classList.add('open');
    setTimeout(() => {
      if (typeof google !== 'undefined') {
        const modalBtn = document.getElementById('google-signin-modal-btn');
        if (modalBtn && !modalBtn.hasChildNodes()) {
          google.accounts.id.renderButton(modalBtn, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            locale: 'es',
            width: 280,
          });
        }
      }
    }, 100);
  }

  function _closeModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('open');
  }

  function _createModal() {
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal';
    modal.innerHTML = `
      <div class="auth-modal-backdrop"></div>
      <div class="auth-modal-card">
        <button class="auth-modal-close" aria-label="Cerrar">&times;</button>
        <div class="auth-modal-logo">
          <img src="/LOGO.jpeg" alt="Oropezas.com" onerror="this.style.display='none'">
        </div>
        <h2 class="auth-modal-title">Inicia sesión</h2>
        <p class="auth-modal-subtitle">Guarda tus artículos favoritos y personaliza tu experiencia en Oropezas.com</p>
        <div id="google-signin-modal-btn" class="auth-gsi-container"></div>
        <p class="auth-modal-terms">Al iniciar sesión aceptas nuestros <a href="/terminos.html">Términos de uso</a> y <a href="/privacidad.html">Política de privacidad</a>.</p>
      </div>
    `;

    modal.querySelector('.auth-modal-backdrop').addEventListener('click', _closeModal);
    modal.querySelector('.auth-modal-close').addEventListener('click', _closeModal);
    return modal;
  }

  function toggleUserMenu() {
    const menu = document.getElementById('auth-user-menu');
    if (menu) menu.classList.toggle('open');
  }

  document.addEventListener('click', function (e) {
    const avatar = document.getElementById('auth-user-avatar');
    const menu = document.getElementById('auth-user-menu');
    if (menu && avatar && !avatar.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('open');
    }
  });

  return {
    init,
    logout,
    openLoginModal,
    toggleUserMenu,
    getUser: () => currentUser,
    isLoggedIn: () => !!currentUser,
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => OROPEZAS_AUTH.init());
} else {
  OROPEZAS_AUTH.init();
}
