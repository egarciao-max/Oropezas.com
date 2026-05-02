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

      // Load Google Identity Services script dynamically
      this._loadGSIScript();

      // Watch for navbar being loaded dynamically (Kelowna)
      this._watchNavbarDynamic();

      // Initial UI update (in case navbar is already in DOM)
      this._updateUI();

      // Keyboard: ESC closes modal
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeLoginModal();
      });
    },

    // ─── Load Google Identity Services Script ─────────────
    _loadGSIScript() {
      if (window.google?.accounts?.id) {
        this._setupGSI();
        return;
      }

      // Check if script is already loading
      if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
        // Wait for it to load
        const check = setInterval(() => {
          if (window.google?.accounts?.id) {
            clearInterval(check);
            this._setupGSI();
          }
        }, 100);
        setTimeout(() => clearInterval(check), 5000); // Give up after 5s
        return;
      }

      // Create and load script
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this._setupGSI();
      };
      script.onerror = () => {
        console.error('[AUTH] Failed to load Google Identity Services');
      };
      document.head.appendChild(script);
    },

    // ─── Google Sign-In Setup ───────────────────────────────
    _setupGSI() {
      if (!window.google?.accounts?.id) return;

      // Initialize with your Google Client ID
      google.accounts.id.initialize({
        client_id: '233406003665-udr6c9vv4jej9ur8bsa22tdr9edouvfl.apps.googleusercontent.com',
        callback: (response) => this._handleGoogleCredential(response),
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // If modal is already open, render the button now
      const modal = document.getElementById('auth-modal');
      if (modal && modal.classList.contains('open')) {
        this._tryRenderGSIButton();
      }

      // DO NOT auto-prompt — user must click Sign In
    },

    // ─── Try to render GSI button ─────────────────────────
    _tryRenderGSIButton(attempts = 0) {
      const btn = document.getElementById('google-signin-btn');
      const fallback = document.getElementById('gsi-fallback-btn');

      if (!btn) {
        if (attempts < 5) {
          setTimeout(() => this._tryRenderGSIButton(attempts + 1), 200);
        }
        return false;
      }

      // Always show fallback by default — hide only if GSI renders successfully
      if (fallback) fallback.style.display = 'flex';

      if (!window.google?.accounts?.id) {
        // GSI not loaded yet — keep fallback visible, retry
        if (attempts < 15) {
          setTimeout(() => this._tryRenderGSIButton(attempts + 1), 300);
        }
        return false;
      }

      // GSI loaded — try to render real button
      btn.innerHTML = '';

      try {
        google.accounts.id.renderButton(btn, {
          theme: 'outline',
          size:  'large',
          width: 280,
          text:  'continue_with',
          shape: 'rectangular',
        });

        // Check if button actually appeared after a short delay
        setTimeout(() => {
          const hasContent = btn.children.length > 0 || btn.innerHTML.length > 50;
          if (hasContent && fallback) {
            // Real button rendered — hide fallback
            fallback.style.display = 'none';
          }
          // If no content, fallback stays visible
        }, 500);

        return true;
      } catch (e) {
        console.error('[AUTH] renderButton failed:', e);
        // Fallback already visible
        return false;
      }
    },

    // ─── Trigger Google sign-in via one-tap prompt ──────────
    _triggerGSISignIn() {
      if (!window.google?.accounts?.id) {
        alert('Google Sign-In is loading. Please wait a moment and try again.');
        return;
      }

      // Show loading in modal
      const modalCard = document.querySelector('.auth-modal-card');
      if (modalCard) {
        modalCard.innerHTML = `
          <div style="text-align:center;padding:2rem;">
            <div style="width:40px;height:40px;border:3px solid #f3f3f3;border-top:3px solid #000;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
            <p style="color:#555;font-size:0.9rem;">Opening Google Sign-In...</p>
          </div>
          <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
        `;
      }

      // Small delay to show loading before prompt
      setTimeout(() => {
        try {
          google.accounts.id.prompt((notification) => {
            const notDisplayed = notification.getNotDisplayedReason && notification.getNotDisplayedReason();
            const skipped = notification.getSkippedReason && notification.getSkippedReason();

            if (notDisplayed === 'opt_out_or_no_session') {
              // User needs to enable third-party cookies or sign in to Google
              this._showAuthError(
                'Please sign in to your Google account in this browser first, then try again.'
              );
            } else if (notDisplayed || skipped) {
              this._showAuthError(
                'Sign-in popup was blocked. Please allow popups for this site.'
              );
            }
            // If successful, callback handles it
          });
        } catch (e) {
          console.error('[AUTH] prompt failed:', e);
          this._showAuthError('Google Sign-In failed. Please try again.');
        }
      }, 300);
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
          // Add backward-compatible aliases for old account.html code
          const user = data.user;
          if (user.picture && !user.avatar) user.avatar = user.picture;
          if (user.uid && !user.unionId) user.unionId = user.uid;

          this.currentUser = user;
          this._saveUser(user);
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
            <button class="gsi-custom-btn" onclick="OROPEZAS_AUTH._triggerGSISignIn()" style="display:flex;width:100%;padding:12px 16px;background:#fff;border:1px solid #dadce0;border-radius:4px;color:#3c4043;font-size:14px;font-weight:500;cursor:pointer;align-items:center;justify-content:center;gap:10px;margin:1.5rem 0;transition:box-shadow 0.2s,background 0.2s;" onmouseover="this.style.boxShadow='0 1px 2px rgba(60,64,67,0.3),0 1px 3px rgba(60,64,67,0.15)';this.style.background='#f8f9fa';" onmouseout="this.style.boxShadow='none';this.style.background='#fff';">
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.13-.84 2.08-1.78 2.72v2.26h2.88c1.69-1.56 2.66-3.86 2.66-6.63z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.88-2.26c-.81.54-1.84.86-3.08.86-2.37 0-4.38-1.6-5.1-3.74H.95v2.33C2.44 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.9 10.68c-.18-.54-.29-1.11-.29-1.68s.11-1.14.29-1.68V5H.95C.35 6.19 0 7.55 0 9s.35 2.81.95 4l2.95-2.32z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.95 4.95l2.95 2.33C4.62 5.14 6.63 3.58 9 3.58z"/></svg>
              Continue with Google
            </button>
            <p class="auth-modal-terms">By signing in, you agree to our <a href="/terminos.html">Terms of Use</a> and <a href="/privacidad.html">Privacy Policy</a>.</p>
          </div>
        `;
        document.body.appendChild(modal);
      }

      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
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
        if (user && user.uid && user.name) {
          // Ensure backward-compatible aliases exist
          if (user.picture && !user.avatar) user.avatar = user.picture;
          if (user.uid && !user.unionId) user.unionId = user.uid;
          return user;
        }
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
