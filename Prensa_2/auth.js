// ============================================================
// OROPEZAS AUTH 5.0 — Firebase Auth + Google Sign-In
// Replaces Google Identity Services (GIS) TokenClient flow
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

const API  = 'https://oropezas.enriquegarciaoropeza.workers.dev';
const LS_USER_KEY = 'oropezas_user_v3';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCy7ZzxAc830KyA7TejjE5X5coPDCsokqw",
  authDomain: "oropezascom.firebaseapp.com",
  projectId: "oropezascom",
  storageBucket: "oropezascom.firebasestorage.app",
  messagingSenderId: "2029662532",
  appId: "1:2029662532:web:61f3b1c79d1c322819e711",
  measurementId: "G-0YZ2M6T744"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

function debugLog(msg) { console.log('[AUTH]', msg); }

const OROPEZAS_AUTH = window.OROPEZAS_AUTH = {
  currentUser: null,
  initialized: false,
  _auth: auth,

  // ─── Init ──────────────────────────────────────────────
  init() {
    if (this.initialized) return;
    this.initialized = true;
    debugLog('Auth init started (Firebase)');

    // Load cached user first for fast UI
    this.currentUser = this._loadUser();
    if (this.currentUser) debugLog('Loaded cached user: ' + this.currentUser.email);

    this._watchNavbarDynamic();
    this._updateUI();

    // Listen for Firebase auth state changes
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        debugLog('Firebase user detected: ' + firebaseUser.email);
        await this._syncWithBackend(firebaseUser);
      } else {
        debugLog('No Firebase user');
        // Only clear if we don't have a cached user (avoid flicker on page load)
        if (!this.currentUser) this._updateUI();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeLoginModal();
    });
  },

  // ─── Sync Firebase user with backend ───────────────────
  async _syncWithBackend(firebaseUser) {
    try {
      const idToken = await firebaseUser.getIdToken(true);
      debugLog('Got Firebase ID token, syncing with backend...');

      const res = await fetch(API + '/api/auth/google', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ firebaseToken: idToken }),
        signal:  AbortSignal.timeout(10000),
      });

      const data = await res.json();
      debugLog('Backend sync: ' + JSON.stringify({ success: data.success, has_user: !!data.user }));

      if (data.success && data.user) {
        const user = data.user;
        if (user.picture && !user.avatar) user.avatar = user.picture;
        if (user.uid && !user.unionId) user.unionId = user.uid;
        this.currentUser = user;
        this._saveUser(user);
        this.closeLoginModal();
        this._updateUI();
      }
    } catch (err) {
      debugLog('Backend sync failed: ' + err.message);
      // Still show user from Firebase if backend fails
      const fbUser = {
        uid:     firebaseUser.uid,
        email:   firebaseUser.email || '',
        name:    firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
        picture: firebaseUser.photoURL || '',
        role:    'user',
      };
      this.currentUser = fbUser;
      this._saveUser(fbUser);
      this._updateUI();
    }
  },

  // ─── Sign In with Firebase Popup ───────────────────────
  async _startGoogleSignIn() {
    debugLog('Starting Firebase Google sign-in...');
    this._showSigningInUI();

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      debugLog('Popup success: ' + result.user.email);
      await this._syncWithBackend(result.user);
    } catch (err) {
      debugLog('Sign-in error: ' + err.code + ' — ' + err.message);
      if (err.code === 'auth/popup-closed-by-user') {
        this._showAuthError('Sign-in cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        this._showAuthError('Popup was blocked. Please allow popups for this site.');
      } else if (err.code === 'auth/network-request-failed') {
        this._showAuthError('Network error. Please check your connection.');
      } else {
        this._showAuthError('Sign-in failed: ' + err.message);
      }
    }
  },

  // ─── Signing in UI spinner ─────────────────────────────
  _showSigningInUI() {
    const modalCard = document.querySelector('.auth-modal-card');
    if (modalCard) {
      modalCard.innerHTML = `
        <div style="text-align:center;padding:2rem;" id="auth-signing-in">
          <div style="width:40px;height:40px;border:3px solid #f3f3f3;border-top:3px solid #000;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
          <p style="color:#555;font-size:0.9rem;">Signing in with Google...</p>
          <button onclick="OROPEZAS_AUTH.closeLoginModal()" style="margin-top:1rem;padding:8px 16px;background:none;border:1px solid #ddd;border-radius:4px;color:#666;font-size:0.8rem;cursor:pointer;">Cancel</button>
        </div>
        <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
      `;
    }
  },

  // ─── MutationObserver for dynamic navbar ───────────────
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
          if (header.querySelector('.auth-nav-controls')) this._updateUI();
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
        el.style.display = (user.role === 'admin' || user.role === 'ceo') ? '' : 'none';
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
          <button id="gsi-signin-btn" onclick="OROPEZAS_AUTH._startGoogleSignIn()" style="display:flex;width:100%;padding:12px 16px;background:#fff;border:1px solid #dadce0;border-radius:4px;color:#3c4043;font-size:14px;font-weight:500;cursor:pointer;align-items:center;justify-content:center;gap:10px;margin:1.5rem 0;transition:box-shadow 0.2s,background 0.2s;" onmouseover="this.style.boxShadow='0 1px 2px rgba(60,64,67,0.3),0 1px 3px rgba(60,64,67,0.15)';this.style.background='#f8f9fa';" onmouseout="this.style.boxShadow='none';this.style.background='#fff';">
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
    if (menu) menu.classList.toggle('open');
  },

  // ─── Logout ─────────────────────────────────────────────
  async logout() {
    debugLog('Logging out');
    this.currentUser = null;
    try {
      await signOut(auth);
      localStorage.removeItem(LS_USER_KEY);
      sessionStorage.removeItem(LS_USER_KEY);
    } catch (e) { console.warn('[AUTH] Sign-out error:', e); }
    const menu = document.getElementById('auth-user-menu');
    if (menu) menu.classList.remove('open');
    this._updateUI();
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
        <button id="gsi-retry-btn" onclick="OROPEZAS_AUTH._startGoogleSignIn()" style="display:flex;width:100%;padding:12px 16px;background:#fff;border:1px solid #dadce0;border-radius:4px;color:#3c4043;font-size:14px;font-weight:500;cursor:pointer;align-items:center;justify-content:center;gap:10px;margin:1rem 0;transition:box-shadow 0.2s,background 0.2s;" onmouseover="this.style.boxShadow='0 1px 2px rgba(60,64,67,0.3),0 1px 3px rgba(60,64,67,0.15)';this.style.background='#f8f9fa';" onmouseout="this.style.boxShadow='none';this.style.background='#fff';">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.13-.84 2.08-1.78 2.72v2.26h2.88c1.69-1.56 2.66-3.86 2.66-6.63z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.88-2.26c-.81.54-1.84.86-3.08.86-2.37 0-4.38-1.6-5.1-3.74H.95v2.33C2.44 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.9 10.68c-.18-.54-.29-1.11-.29-1.68s.11-1.14.29-1.68V5H.95C.35 6.19 0 7.55 0 9s.35 2.81.95 4l2.95-2.32z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.95 4.95l2.95 2.33C4.62 5.14 6.63 3.58 9 3.58z"/></svg>
          Try Again
        </button>
        <p class="auth-modal-terms">By signing in, you agree to our <a href="/terminos.html">Terms of Use</a> and <a href="/privacidad.html">Privacy Policy</a>.</p>
      `;
    }
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
  isAdmin()    { return this.currentUser?.role === 'admin' || this.currentUser?.role === 'ceo'; },
  getUser()    { return this.currentUser; },

  // ─── Get current auth token for API calls (forums, etc.) ─
  async getToken() {
    const fbUser = auth.currentUser;
    if (fbUser) return await fbUser.getIdToken();
    return null;
  },
};

// ─── Close menu on outside click ────────────────────────
document.addEventListener('click', (e) => {
  const menu = document.getElementById('auth-user-menu');
  const avatar = document.getElementById('auth-user-avatar');
  if (menu && avatar && !menu.contains(e.target) && !avatar.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// ─── Init on DOM ready ─────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => OROPEZAS_AUTH.init());
} else {
  OROPEZAS_AUTH.init();
}
