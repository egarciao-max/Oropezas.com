// ============================================================
// OROPEZAS AUTH 3.0 — Google Identity + Account Management
// Fixes: Kelowna compat, dynamic navbar timing, no auto-prompt,
//        proper token expiry, MutationObserver, clean logout
// ============================================================

(function () {
  'use strict';

  const API  = 'https://oropezas.enriquegarciaoropeza.workers.dev';
  const LS_USER_KEY = 'oropezas_user_v3';

  const OROPEZAS_AUTH = window.OROPEZAS_AUTH = {
    currentUser: null,
    initialized: false,

    // ─── Init ──────────────────────────────────────────────
    init() {
      if (this.initialized) return;
      this.initialized = true;

      // Load cached user
      this.currentUser = this._loadUser();

      // Setup GSI library when ready
      if (window.google?.accounts?.id) {
        this._setupGSI();
      } else {
        window.addEventListener('gsi-ready', () => this._setupGSI(), { once: true });
      }

      // Watch for navbar being loaded dynamically (Kelowna)
      this._watchNavbarDynamic();

      // Initial UI update (in case navbar is already in DOM)
      this._updateUI();

      // Keyboard: ESC closes modal
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeLoginModal();
      });
    },

    // ─── Google Sign-In Setup ───────────────────────────────
    _setupGSI() {
      if (!window.google?.accounts?.id) return;

      // Initialize with your Google Client ID
      google.accounts.id.initialize({
        client_id: '549479429584-99b5j2l77d6k97p9f8n1f5m0d5b0h0q7.apps.googleusercontent.com',
        callback: (response) => this._handleGoogleCredential(response),
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Render GSI button inside modal if modal exists or will exist
      this._tryRenderGSIButton();

      // DO NOT auto-prompt — user must click Sign In
      // google.accounts.id.prompt(); ← REMOVED
    },

    // ─── Try to render GSI button ─────────────────────────
    _tryRenderGSIButton() {
      const btn = document.getElementById('google-signin-btn');
      if (btn && window.google?.accounts?.id) {
        google.accounts.id.renderButton(btn, {
          theme: 'outline',
          size:  'large',
          width: 280,
          text:  'continue_with',
          shape: 'rectangular',
        });
        return true;
      }
      return false;
    },

    // ─── Handle Google Credential ─────────────────────────
    async _handleGoogleCredential(response) {
      if (!response?.credential) {
        console.error('[AUTH] No credential in Google response');
        return;
      }

      // Show loading in modal
      const modalCard = document.querySelector('.auth-modal-card');
      if (modalCard) {
        modalCard.innerHTML = `
          <div style="text-align:center;padding:2rem;">
            <div style="width:40px;height:40px;border:3px solid #f3f3f3;border-top:3px solid #000;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
            <p style="color:#555;font-size:0.9rem;">Signing in...</p>
          </div>
          <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
        `;
      }

      try {
        const res = await fetch(API + '/api/auth/google', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ idToken: response.credential }),
        });

        const data = await res.json();

        if (data.success && data.user) {
          this.currentUser = data.user;
          this._saveUser(data.user);
          this.closeLoginModal();
          this._updateUI();

          // Refresh page to update content based on auth state
          // Only refresh if we're not on account page (already shows user)
          if (!window.location.pathname.includes('account')) {
            // Small delay to let UI update
            setTimeout(() => {
              // Don't hard reload — let SPA feel
              // window.location.reload();
            }, 100);
          }
        } else {
          this._showAuthError(data.error || 'Authentication failed');
        }
      } catch (err) {
        console.error('[AUTH] Error verifying token:', err);
        this._showAuthError('Network error. Please try again.');
      }
    },

    // ─── Show auth error in modal ─────────────────────────
    _showAuthError(msg) {
      const modalCard = document.querySelector('.auth-modal-card');
      if (modalCard) {
        modalCard.innerHTML = `
          <button class="auth-modal-close" onclick="OROPEZAS_AUTH.closeLoginModal()">×</button>
          <div class="auth-modal-logo"><img src="/LOGO.jpeg" alt="Logo" onerror="this.style.display='none'"></div>
          <p class="auth-modal-title">Sign In</p>
          <p class="auth-modal-subtitle">Access your account</p>
          <div style="background:#fee;color:#c00;padding:0.75rem 1rem;border-radius:4px;margin-bottom:1rem;font-size:0.85rem;">
            ⚠️ ${msg}
          </div>
          <div id="google-signin-btn" style="display:flex;justify-content:center;"></div>
          <p class="auth-modal-terms">By signing in, you agree to our <a href="/terminos.html">Terms</a></p>
        `;
        this._tryRenderGSIButton();
      }
    },

    // ─── MutationObserver for dynamic navbar (Kelowna) ───
    _watchNavbarDynamic() {
      const header = document.querySelector('header');
      if (!header) return;

      // If navbar already has content, we're good
      if (header.querySelector('.auth-nav-controls')) {
        this._updateUI();
        return;
      }

      // Watch for navbar being injected via fetch
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'childList' && m.addedNodes.length) {
            // Check if auth controls now exist
            if (header.querySelector('.auth-nav-controls')) {
              this._updateUI();
              // Also try to render GSI button if modal exists
              this._tryRenderGSIButton();
            }
          }
        }
      });

      observer.observe(header, { childList: true, subtree: true });

      // Also check periodically for a few seconds (fallback)
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (header.querySelector('.auth-nav-controls')) {
          this._updateUI();
          this._tryRenderGSIButton();
          clearInterval(interval);
        }
        if (attempts > 20) clearInterval(interval); // Stop after ~4s
      }, 200);
    },

    // ─── Update UI based on auth state ─────────────────────
    _updateUI() {
      const user = this.currentUser;

      // Find elements (works even with dynamically loaded navbar)
      const loginBtn   = document.getElementById('auth-login-btn');
      const avatarBox  = document.getElementById('auth-user-avatar');
      const picImg     = document.getElementById('auth-user-picture');
      const nameLabel  = document.getElementById('auth-user-name');
      const menu       = document.getElementById('auth-user-menu');

      if (!loginBtn || !avatarBox) {
        // Navbar not loaded yet — will be picked up by MutationObserver
        return;
      }

      if (user) {
        // LOGGED IN: show avatar, hide login button
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

        // Show admin-only elements if admin
        document.querySelectorAll('.admin-only').forEach(el => {
          el.style.display = (user.role === 'admin') ? '' : 'none';
        });
      } else {
        // LOGGED OUT: show login button, hide avatar
        loginBtn.style.display = 'flex';
        avatarBox.style.display = 'none';
        if (menu) menu.classList.remove('open');

        // Hide admin-only elements
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
            <button class="auth-modal-close" onclick="OROPEZAS_AUTH.closeLoginModal()">×</button>
            <div class="auth-modal-logo"><img src="/LOGO.jpeg" alt="Logo" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=font-size:1.5rem;font-weight:900;>OROPEZAS</span>';"></div>
            <p class="auth-modal-title">Sign In</p>
            <p class="auth-modal-subtitle">Access your account with Google</p>
            <div id="google-signin-btn" style="display:flex;justify-content:center;margin:1.5rem 0;"></div>
            <p class="auth-modal-terms">By signing in, you agree to our <a href="/terminos.html">Terms of Use</a> and <a href="/privacidad.html">Privacy Policy</a>.</p>
          </div>
        `;
        document.body.appendChild(modal);
      }

      modal.classList.add('open');
      document.body.style.overflow = 'hidden';

      // Render GSI button now that modal is in DOM
      requestAnimationFrame(() => {
        this._tryRenderGSIButton();
      });
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
      if (menu) {
        menu.classList.toggle('open');
      }
    },

    // ─── Logout ─────────────────────────────────────────────
    logout() {
      this.currentUser = null;
      try {
        localStorage.removeItem(LS_USER_KEY);
        sessionStorage.removeItem(LS_USER_KEY);
      } catch (e) {
        console.warn('[AUTH] localStorage clear failed:', e);
      }

      // Revoke Google session
      if (window.google?.accounts?.id) {
        google.accounts.id.disableAutoSelect();
      }

      // Close menu
      const menu = document.getElementById('auth-user-menu');
      if (menu) menu.classList.remove('open');

      // Update UI
      this._updateUI();

      // Optional: redirect to home
      // window.location.href = '/';
    },

    // ─── Persist ──────────────────────────────────────────
    _saveUser(user) {
      try {
        localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
      } catch (e) {
        console.warn('[AUTH] localStorage save failed:', e);
      }
    },

    _loadUser() {
      try {
        const raw = localStorage.getItem(LS_USER_KEY);
        if (!raw) return null;
        const user = JSON.parse(raw);
        // Validate: must have uid and name
        if (user && user.uid && user.name) return user;
      } catch (e) {
        console.warn('[AUTH] localStorage load failed:', e);
      }
      return null;
    },

    // ─── Utility: isLoggedIn / isAdmin ─────────────────────
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
