// ============================================================
// OROPEZAS AUTH 4.0 — Google Identity + TokenClient Popup
// Fixes: Uses popup-based OAuth (works with 3P cookies blocked)
//        Fallback to renderButton() for older browsers
// ============================================================

(function () {
  'use strict';

  const API  = 'https://oropezas.enriquegarciaoropeza.workers.dev';
  const GOOGLE_CLIENT_ID = '233406003665-phh7pcmg6gr23fdlsfjb5db90avi9vrb.apps.googleusercontent.com';
  const LS_USER_KEY = 'oropezas_user_v3';

  const OROPEZAS_AUTH = window.OROPEZAS_AUTH = {
    currentUser: null,
    initialized: false,
    tokenClient: null,

    // ─── Init ──────────────────────────────────────────────
    init() {
      if (this.initialized) return;
      this.initialized = true;

      this.currentUser = this._loadUser();
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
        this._setupGSI();
        return;
      }
      if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
        const check = setInterval(() => {
          if (window.google?.accounts?.oauth2 || window.google?.accounts?.id) {
            clearInterval(check);
            this._setupGSI();
          }
        }, 100);
        setTimeout(() => clearInterval(check), 5000);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => this._setupGSI();
      script.onerror = () => console.error('[AUTH] Failed to load Google Identity Services');
      document.head.appendChild(script);
    },

    // ─── Google Sign-In Setup ───────────────────────────────
    _setupGSI() {
      if (!window.google?.accounts) return;

      // Setup GIS callback (for renderButton fallback)
      if (google.accounts.id) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => this._handleGoogleCredential(response),
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      }

      // Setup TokenClient (primary method — popup, works with 3P cookies blocked)
      if (google.accounts?.oauth2) {
        try {
          this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'openid email profile',
            callback: (tokenResponse) => this._handleTokenResponse(tokenResponse),
            error_callback: (err) => {
              console.error('[AUTH] TokenClient error:', err);
              this._showAuthError('Sign-in was cancelled or failed. Please try again.');
            },
          });
        } catch (e) {
          console.error('[AUTH] TokenClient init failed:', e);
        }
      }
    },

    // ─── PRIMARY: TokenClient Popup Sign-In ────────────────
    _startGoogleSignIn() {
      // Hard timeout: if nothing happens in 6s, show error
      // (iOS Safari can silently fail when not signed into Google)
      this._signInStartTime = Date.now();
      this._signInTimeout = setTimeout(() => {
        console.error('[AUTH] Sign-in silently failed after 6s (iOS Safari?)');
        this._showAuthErrorWithCancel(
          'Sign-in could not complete. Make sure you are signed into Google in Safari settings, or try a different browser.'
        );
      }, 6000);

      if (this.tokenClient) {
        try {
          this.tokenClient.requestAccessToken({ prompt: 'consent' });
          // Show loading state
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
          console.error('[AUTH] TokenClient requestAccessToken failed:', e);
          clearTimeout(this._signInTimeout);
          this._showAuthError('Sign-in failed to start. Please try again.');
        }
      } else {
        // TokenClient not available — use renderButton fallback
        clearTimeout(this._signInTimeout);
        this._renderGSIButton();
      }
    },

    // ─── Show auth error with cancel button ─────────────────
    _showAuthErrorWithCancel(msg) {
      clearTimeout(this._signInTimeout);
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

    // ─── Handle TokenClient Response ──────────────────────
    async _handleTokenResponse(tokenResponse) {
      clearTimeout(this._signInTimeout);
      if (!tokenResponse?.access_token) {
        this._showAuthError('No access token received from Google.');
        return;
      }

      // Show loading in modal
      const modalCard = document.querySelector('.auth-modal-card');
      if (modalCard) {
        modalCard.innerHTML = `
          <div style="text-align:center;padding:2rem;" id="auth-signing-in">
            <div style="width:40px;height:40px;border:3px solid #f3f3f3;border-top:3px solid #000;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
            <p style="color:#555;font-size:0.9rem;">Signing in...</p>
            <p style="color:#888;font-size:0.75rem;margin-top:0.5rem;">This may take a few seconds</p>
          </div>
          <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
        `;
      }

      // 12-second safety timeout: if fetch hangs, show error
      const safetyTimeout = setTimeout(() => {
        console.error('[AUTH] Sign-in timed out after 12s');
        this._showAuthError('Sign-in timed out. The server may be busy. Please try again.');
      }, 12000);

      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(API + '/api/auth/google', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ accessToken: tokenResponse.access_token }),
          signal:  controller.signal,
        });
        clearTimeout(fetchTimeout);
        clearTimeout(safetyTimeout);

        const data = await res.json();

        if (data.success && data.user) {
          const user = data.user;
          if (user.picture && !user.avatar) user.avatar = user.picture;
          if (user.uid && !user.unionId) user.unionId = user.uid;

          this.currentUser = user;
          this._saveUser(user);
          this.closeLoginModal();
          this._updateUI();
        } else {
          this._showAuthError(data.error || 'Authentication failed');
        }
      } catch (err) {
        clearTimeout(safetyTimeout);
        console.error('[AUTH] Error verifying token:', err);
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
      if (!response?.credential) {
        console.error('[AUTH] No credential in Google response');
        return;
      }

      const modalCard = document.querySelector('.auth-modal-card');
      if (modalCard) {
        modalCard.innerHTML = `
          <div style="text-align:center;padding:2rem;" id="auth-signing-in">
            <div style="width:40px;height:40px;border:3px solid #f3f3f3;border-top:3px solid #000;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
            <p style="color:#555;font-size:0.9rem;">Signing in...</p>
            <p style="color:#888;font-size:0.75rem;margin-top:0.5rem;">This may take a few seconds</p>
          </div>
          <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
        `;
      }

      // 12-second safety timeout
      const safetyTimeout = setTimeout(() => {
        console.error('[AUTH] Sign-in timed out after 12s');
        this._showAuthError('Sign-in timed out. The server may be busy. Please try again.');
      }, 12000);

      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(API + '/api/auth/google', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ idToken: response.credential }),
          signal:  controller.signal,
        });
        clearTimeout(fetchTimeout);
        clearTimeout(safetyTimeout);

        const data = await res.json();

        if (data.success && data.user) {
          const user = data.user;
          if (user.picture && !user.avatar) user.avatar = user.picture;
          if (user.uid && !user.unionId) user.unionId = user.uid;

          this.currentUser = user;
          this._saveUser(user);
          this.closeLoginModal();
          this._updateUI();
        } else {
          this._showAuthError(data.error || 'Authentication failed');
        }
      } catch (err) {
        clearTimeout(safetyTimeout);
        console.error('[AUTH] Error verifying token:', err);
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
      } catch (e) {
        console.error('[AUTH] renderButton failed:', e);
      }
    },

    // ─── Show auth error in modal ─────────────────────────
    _showAuthError(msg) {
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
            Continue with Google
          </button>
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
            <!-- Hidden container for renderButton fallback -->
            <div id="gsi-button-container" style="display:none;"></div>
            <p class="auth-modal-terms">By signing in, you agree to our <a href="/terminos.html">Terms of Use</a> and <a href="/privacidad.html">Privacy Policy</a>.</p>
          </div>
        `;
        document.body.appendChild(modal);
      }

      modal.classList.add('open');
      document.body.style.overflow = 'hidden';

      // If TokenClient isn't available yet, try to set it up now
      if (!this.tokenClient && window.google?.accounts?.oauth2) {
        this._setupGSI();
      }
      // If Google GIS isn't loaded at all, show a helpful message
      if (!window.google?.accounts) {
        const btn = document.getElementById('gsi-fallback-btn');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = 'Google Sign-In is loading... Please wait.';
        }
        // Retry after script loads
        const check = setInterval(() => {
          if (window.google?.accounts) {
            clearInterval(check);
            this._setupGSI();
            const btn2 = document.getElementById('gsi-fallback-btn');
            if (btn2) {
              btn2.disabled = false;
              btn2.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.13-.84 2.08-1.78 2.72v2.26h2.88c1.69-1.56 2.66-3.86 2.66-6.63z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.88-2.26c-.81.54-1.84.86-3.08.86-2.37 0-4.38-1.6-5.1-3.74H.95v2.33C2.44 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.9 10.68c-.18-.54-.29-1.11-.29-1.68s.11-1.14.29-1.68V5H.95C.35 6.19 0 7.55 0 9s.35 2.81.95 4l2.95-2.32z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.95 4.95l2.95 2.33C4.62 5.14 6.63 3.58 9 3.58z"/></svg> Continue with Google`;
            }
          }
        }, 200);
        setTimeout(() => clearInterval(check), 5000);
      }
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
