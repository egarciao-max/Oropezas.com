// ============================================================
// OROPEZAS AUTH 4.0 — Google Identity + TokenClient Popup
// Debug overlay added — shows step-by-step progress on page
// ============================================================

(function () {
  'use strict';

  const API  = 'https://oropezas.enriquegarciaoropeza.workers.dev';
  const GOOGLE_CLIENT_ID = '233406003665-phh7pcmg6gr23fdlsfjb5db90avi9vrb.apps.googleusercontent.com';
  const LS_USER_KEY = 'oropezas_user_v3';

  // Debug overlay - commented out for production
  function debugLog(msg) {
    console.log('[AUTH]', msg);
  }

  const OROPEZAS_AUTH = window.OROPEZAS_AUTH = {
    currentUser: null,
    initialized: false,
    tokenClient: null,

    // ─── Init ──────────────────────────────────────────────
    init() {
      if (this.initialized) return;
      this.initialized = true;
      debugLog('Auth init started');

      this.currentUser = this._loadUser();
      debugLog('Loaded user: ' + (this.currentUser ? this.currentUser.email : 'none'));

      this._loadGSIScript();
      this._watchNavbarDynamic();
      this._updateUI();

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeLoginModal();
      });
    },

    // ─── Load Google Identity Services Script ─────────────
    _loadGSIScript() {
      if (window.google?.accounts?.oauth2 || window.google?.accounts?.id) {
        debugLog('GSI already loaded');
        this._setupGSI();
        return;
      }
      if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
        debugLog('GSI script tag exists, waiting...');
        const check = setInterval(() => {
          if (window.google?.accounts?.oauth2 || window.google?.accounts?.id) {
            clearInterval(check);
            debugLog('GSI loaded via interval');
            this._setupGSI();
          }
        }, 100);
        setTimeout(() => clearInterval(check), 5000);
        return;
      }
      debugLog('Loading GSI script...');
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => { debugLog('GSI script onload'); this._setupGSI(); };
      script.onerror = () => { debugLog('GSI script FAILED'); };
      document.head.appendChild(script);
    },

    // ─── Google Sign-In Setup ───────────────────────────────
    _setupGSI() {
      if (!window.google?.accounts) { debugLog('GSI not available'); return; }
      debugLog('Setting up GSI...');

      if (google.accounts.id) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => this._handleGoogleCredential(response),
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        debugLog('GIS initialize done');
      }

      if (google.accounts?.oauth2) {
        try {
          this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'openid email profile',
            callback: (tokenResponse) => {
              debugLog('TokenClient callback fired!');
              this._handleTokenResponse(tokenResponse);
            },
            error_callback: (err) => {
              debugLog('TokenClient ERROR: ' + JSON.stringify(err));
              this._showAuthError('Sign-in failed. Try again.');
            },
          });
          debugLog('TokenClient created');
        } catch (e) {
          debugLog('TokenClient init failed: ' + e.message);
        }
      }
    },

    // ─── PRIMARY: TokenClient Popup Sign-In ────────────────
    _startGoogleSignIn() {
      debugLog('Start sign-in clicked');
      this._signInStartTime = Date.now();
      this._signInTimeout = setTimeout(() => {
        debugLog('Sign-in timed out after 6s');
        this._showAuthError('Sign-in could not complete. Make sure you are signed into Google in this browser, then try again.');
      }, 6000);

      if (this.tokenClient) {
        try {
          debugLog('Calling requestAccessToken...');
          this.tokenClient.requestAccessToken({ prompt: 'consent' });
          const modalCard = document.querySelector('.auth-modal-card');
          if (modalCard) {
            modalCard.innerHTML = `
              <div style="text-align:center;padding:2rem;" id="auth-signing-in">
                <div style="width:40px;height:40px;border:3px solid #f3f3f3;border-top:3px solid #000;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
                <p style="color:#555;font-size:0.9rem;">Opening Google Sign-In...</p>
                <button onclick="OROPEZAS_AUTH.closeLoginModal()" style="margin-top:1rem;padding:8px 16px;background:none;border:1px solid #ddd;border-radius:4px;color:#666;font-size:0.8rem;cursor:pointer;">Cancel</button>
              </div>
              <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
            `;
          }
          return;
        } catch (e) {
          debugLog('requestAccessToken failed: ' + e.message);
          clearTimeout(this._signInTimeout);
          this._showAuthError('Sign-in failed to start. Please try again.');
        }
      } else {
        debugLog('No tokenClient, using renderButton fallback');
        clearTimeout(this._signInTimeout);
        this._renderGSIButton();
      }
    },

    // ─── Handle TokenClient Response ──────────────────────
    async _handleTokenResponse(tokenResponse) {
      clearTimeout(this._signInTimeout);
      debugLog('TokenClient callback: ' + JSON.stringify({has_access_token: !!tokenResponse?.access_token, error: tokenResponse?.error}));

      if (!tokenResponse?.access_token) {
        debugLog('No access_token in response');
        this._showAuthError('No access token received from Google. Please try again.');
        return;
      }

      debugLog('Got access token, verifying with backend...');
      const modalCard = document.querySelector('.auth-modal-card');
      if (modalCard) {
        modalCard.innerHTML = `
          <div style="text-align:center;padding:2rem;" id="auth-signing-in">
            <div style="width:40px;height:40px;border:3px solid #f3f3f3;border-top:3px solid #000;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
            <p style="color:#555;font-size:0.9rem;">Verifying your account...</p>
          </div>
          <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
        `;
      }

      const safetyTimeout = setTimeout(() => {
        debugLog('Backend verification timed out after 12s');
        this._showAuthError('Sign-in verification timed out. Please try again.');
      }, 12000);

      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 10000);
        debugLog('POST /api/auth/google...');

        const res = await fetch(API + '/api/auth/google', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ accessToken: tokenResponse.access_token }),
          signal:  controller.signal,
        });
        clearTimeout(fetchTimeout);
        clearTimeout(safetyTimeout);

        debugLog('Backend responded: ' + res.status);
        const data = await res.json();
        debugLog('Backend data: ' + JSON.stringify({success: data.success, has_user: !!data.user, error: data.error}));

        if (data.success && data.user) {
          const user = data.user;
          if (user.picture && !user.avatar) user.avatar = user.picture;
          if (user.uid && !user.unionId) user.unionId = user.uid;

          this.currentUser = user;
          this._saveUser(user);
          debugLog('Sign-in complete for: ' + (user.name || user.email));
          this.closeLoginModal();
          this._updateUI();
        } else {
          debugLog('Backend rejected: ' + (data.error || 'unknown'));
          this._showAuthError(data.error || 'Authentication failed. Please try again.');
        }
      } catch (err) {
        clearTimeout(safetyTimeout);
        debugLog('Error: ' + (err.name + ': ' + err.message));
        if (err.name === 'AbortError') {
          this._showAuthError('Sign-in timed out. Please check your connection and try again.');
        } else {
          this._showAuthError('Network error. Please try again.');
        }
      }
    },

    // ─── Handle Google Credential (renderButton fallback) ─
    async _handleGoogleCredential(response) {
      clearTimeout(this._signInTimeout);
      debugLog('GIS credential callback fired');
      if (!response?.credential) {
        debugLog('No credential in Google response');
        return;
      }

      const modalCard = document.querySelector('.auth-modal-card');
      if (modalCard) {
        modalCard.innerHTML = `
          <div style="text-align:center;padding:2rem;" id="auth-signing-in">
            <div style="width:40px;height:40px;border:3px solid #f3f3f3;border-top:3px solid #000;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
            <p style="color:#555;font-size:0.9rem;">Signing in...</p>
          </div>
          <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
        `;
      }

      const safetyTimeout = setTimeout(() => {
        debugLog('Sign-in timed out after 12s');
        this._showAuthError('Sign-in timed out. The server may be busy. Please try again.');
      }, 12000);

      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 10000);
        debugLog('POST /api/auth/google with idToken...');

        const res = await fetch(API + '/api/auth/google', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ idToken: response.credential }),
          signal:  controller.signal,
        });
        clearTimeout(fetchTimeout);
        clearTimeout(safetyTimeout);

        const data = await res.json();
        debugLog('Backend data: ' + JSON.stringify({success: data.success, has_user: !!data.user}));

        if (data.success && data.user) {
          const user = data.user;
          if (user.picture && !user.avatar) user.avatar = user.picture;
          if (user.uid && !user.unionId) user.unionId = user.uid;

          this.currentUser = user;
          this._saveUser(user);
          debugLog('Sign-in complete');
          this.closeLoginModal();
          this._updateUI();
        } else {
          debugLog('Backend rejected: ' + (data.error || 'unknown'));
          this._showAuthError(data.error || 'Authentication failed');
        }
      } catch (err) {
        clearTimeout(safetyTimeout);
        debugLog('Error: ' + (err.name + ': ' + err.message));
        if (err.name === 'AbortError') {
          this._showAuthError('Sign-in timed out. Please check your connection and try again.');
        } else {
          this._showAuthError('Network error. Please try again.');
        }
      }
    },

    // ─── Render Google Sign-In Button (fallback) ──────────
    _renderGSIButton() {
      if (!window.google?.accounts?.id) return;
      const container = document.getElementById('gsi-button-container');
      if (!container) return;
      container.innerHTML = '';
      try {
        google.accounts.id.renderButton(container, {
          type: 'standard', theme: 'outline', size: 'large',
          text: 'continue_with', shape: 'rectangular',
          width: container.clientWidth || 280, logo_alignment: 'center',
        });
        debugLog('renderButton done');
      } catch (e) {
        debugLog('renderButton failed: ' + e.message);
      }
    },

    // ─── Show auth error in modal ─────────────────────────
    _showAuthError(msg) {
      debugLog('ERROR: ' + msg);
      const modalCard = document.querySelector('.auth-modal-card');
      if (modalCard) {
        modalCard.innerHTML = `
          <button class="auth-modal-close" onclick="OROPEZAS_AUTH.closeLoginModal()">&times;</button>
          <div class="auth-modal-logo"><img src="/LOGO.jpeg" alt="Logo" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=font-size:1.5rem;font-weight:900;>OROPEZAS</span>';"></div>
          <p class="auth-modal-title">Sign In</p>
          <div style="background:#fee;color:#c00;padding:0.75rem 1rem;border-radius:4px;margin-bottom:1rem;font-size:0.85rem;">
            &#9888; ${msg}
          </div>
          <button id="gsi-fallback-btn" onclick="OROPEZAS_AUTH._startGoogleSignIn()" style="display:flex;width:100%;padding:12px 16px;background:#fff;border:1px solid #dadce0;border-radius:4px;color:#3c4043;font-size:14px;font-weight:500;cursor:pointer;align-items:center;justify-content:center;gap:10px;margin:1rem 0;transition:box-shadow 0.2s,background 0.2s;" onmouseover="this.style.boxShadow='0 1px 2px rgba(60,64,67,0.3),0 1px 3px rgba(60,64,67,0.15)';this.style.background='#f8f9fa';" onmouseout="this.style.boxShadow='none';this.style.background='#fff';">
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.13-.84 2.08-1.78 2.72v2.26h2.88c1.69-1.56 2.66-3.86 2.66-6.63z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.88-2.26c-.81.54-1.84.86-3.08.86-2.37 0-4.38-1.6-5.1-3.74H.95v2.33C2.44 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.9 10.68c-.18-.54-.29-1.11-.29-1.68s.11-1.14.29-1.68V5H.95C.35 6.19 0 7.55 0 9s.35 2.81.95 4l2.95-2.32z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.95 4.95l2.95 2.33C4.62 5.14 6.63 3.58 9 3.58z"/></svg>
            Try Again
          </button>
          <div id="gsi-button-container" style="display:none;"></div>
          <p class="auth-modal-terms">By signing in, you agree to our <a href="/terminos.html">Terms of Use</a> and <a href="/privacidad.html">Privacy Policy</a>.</p>
        `;
      }
    },

    // ─── MutationObserver for dynamic navbar (Kelowna) ───
    _watchNavbarDynamic() {
      const header = document.querySelector('header');
      if (!header) return;
      if (header.querySelector('.auth-nav-controls')) {
        this._updateUI();
        return;
      }
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'childList' && m.addedNodes.length) {
            if (header.querySelector('.auth-nav-controls')) {
              this._updateUI();
            }
          }
        }
      });
      observer.observe(header, { childList: true, subtree: true });
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (header.querySelector('.auth-nav-controls')) {
          this._updateUI();
          clearInterval(interval);
        }
        if (attempts > 20) clearInterval(interval);
      }, 200);
    },

    // ─── Update UI based on auth state ─────────────────────
    _updateUI() {
      const user = this.currentUser;
      const loginBtn   = document.getElementById('auth-login-btn');
      const avatarBox  = document.getElementById('auth-user-avatar');
      const picImg     = document.getElementById('auth-user-picture');
      const nameLabel  = document.getElementById('auth-user-name');
      const menu       = document.getElementById('auth-user-menu');

      if (!loginBtn || !avatarBox) return;

      if (user) {
        debugLog('UI: logged in as ' + (user.name || user.email));
        loginBtn.style.display = 'none';
        avatarBox.style.display = 'flex';
        if (picImg) {
          picImg.src = user.picture || '';
          picImg.style.display = user.picture ? 'block' : 'none';
        }
        if (nameLabel) {
          const first = (user.name || '').split(' ')[0];
          nameLabel.textContent = first;
        }
        if (menu) menu.classList.remove('open');
        document.querySelectorAll('.admin-only').forEach(el => {
          el.style.display = (user.role === 'admin') ? '' : 'none';
        });
      } else {
        debugLog('UI: not logged in');
        loginBtn.style.display = 'flex';
        avatarBox.style.display = 'none';
        if (menu) menu.classList.remove('open');
        document.querySelectorAll('.admin-only').forEach(el => {
          el.style.display = 'none';
        });
      }
    },

    // ─── Login Modal ───────────────────────────────────────
    openLoginModal() {
      debugLog('Opening login modal');
      let modal = document.getElementById('auth-modal');

      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'auth-modal';
        modal.innerHTML = `
          <div class="auth-modal-backdrop" onclick="OROPEZAS_AUTH.closeLoginModal()"></div>
          <div class="auth-modal-card">
            <button class="auth-modal-close" onclick="OROPEZAS_AUTH.closeLoginModal()">&times;</button>
            <div class="auth-modal-logo"><img src="/LOGO.jpeg" alt="Logo" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=font-size:1.5rem;font-weight:900;>OROPEZAS</span>';"></div>
            <p class="auth-modal-title">Sign In</p>
            <p class="auth-modal-subtitle">Access your account with Google</p>
            <button id="gsi-fallback-btn" onclick="OROPEZAS_AUTH._startGoogleSignIn()" style="display:flex;width:100%;padding:12px 16px;background:#fff;border:1px solid #dadce0;border-radius:4px;color:#3c4043;font-size:14px;font-weight:500;cursor:pointer;align-items:center;justify-content:center;gap:10px;margin:1.5rem 0;transition:box-shadow 0.2s,background 0.2s;" onmouseover="this.style.boxShadow='0 1px 2px rgba(60,64,67,0.3),0 1px 3px rgba(60,64,67,0.15)';this.style.background='#f8f9fa';" onmouseout="this.style.boxShadow='none';this.style.background='#fff';">
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.13-.84 2.08-1.78 2.72v2.26h2.88c1.69-1.56 2.66-3.86 2.66-6.63z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.88-2.26c-.81.54-1.84.86-3.08.86-2.37 0-4.38-1.6-5.1-3.74H.95v2.33C2.44 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.9 10.68c-.18-.54-.29-1.11-.29-1.68s.11-1.14.29-1.68V5H.95C.35 6.19 0 7.55 0 9s.35 2.81.95 4l2.95-2.32z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.95 4.95l2.95 2.33C4.62 5.14 6.63 3.58 9 3.58z"/></svg>
              Continue with Google
            </button>
            <div id="gsi-button-container" style="display:none;"></div>
            <p class="auth-modal-terms">By signing in, you agree to our <a href="/terminos.html">Terms of Use</a> and <a href="/privacidad.html">Privacy Policy</a>.</p>
          </div>
        `;
        document.body.appendChild(modal);
      }

      modal.classList.add('open');
      document.body.style.overflow = 'hidden';

      setTimeout(() => this._renderGSIButton(), 50);
      setTimeout(() => {
        const container = document.getElementById('gsi-button-container');
        if (container && container.children.length === 1 && container.querySelector('p')) {
          this._renderGSIButton();
        }
      }, 2000);
    },

    // ─── Close Modal ──────────────────────────────────────
    closeLoginModal() {
      const modal = document.getElementById('auth-modal');
      if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
      }
    },

    // ─── Toggle User Menu ──────────────────────────────────
    toggleUserMenu() {
      const menu = document.getElementById('auth-user-menu');
      if (menu) menu.classList.toggle('open');
    },

    // ─── Logout ─────────────────────────────────────────────
    logout() {
      debugLog('Logging out');
      this.currentUser = null;
      this.tokenClient = null;
      try {
        localStorage.removeItem(LS_USER_KEY);
        sessionStorage.removeItem(LS_USER_KEY);
      } catch (e) { console.warn('[AUTH] localStorage clear failed:', e); }
      if (window.google?.accounts?.id) {
        google.accounts.id.disableAutoSelect();
      }
      const menu = document.getElementById('auth-user-menu');
      if (menu) menu.classList.remove('open');
      this._updateUI();
    },

    // ─── Persist ──────────────────────────────────────────
    _saveUser(user) {
      try { localStorage.setItem(LS_USER_KEY, JSON.stringify(user)); }
      catch (e) { console.warn('[AUTH] localStorage save failed:', e); }
    },
    _loadUser() {
      try {
        const raw = localStorage.getItem(LS_USER_KEY);
        if (!raw) return null;
        const user = JSON.parse(raw);
        if (user && user.uid && user.name) {
          if (user.picture && !user.avatar) user.avatar = user.picture;
          if (user.uid && !user.unionId) user.unionId = user.uid;
          return user;
        }
      } catch (e) { console.warn('[AUTH] localStorage load failed:', e); }
      return null;
    },

    // ─── Utility ───────────────────────────────────────────
    isLoggedIn() { return !!this.currentUser; },
    isAdmin()    { return this.currentUser?.role === 'admin'; },
    getUser()    { return this.currentUser; },
  };

  // ─── Init on DOM ready ─────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => OROPEZAS_AUTH.init());
  } else {
    OROPEZAS_AUTH.init();
  }

  // ─── Close menu on outside click ────────────────────────
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('auth-user-menu');
    const avatar = document.getElementById('auth-user-avatar');
    if (menu && avatar && !menu.contains(e.target) && !avatar.contains(e.target)) {
      menu.classList.remove('open');
    }
  });

})();
