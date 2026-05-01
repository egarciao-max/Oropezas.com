// auth.js — Google Sign-In para Oropezas.com
// Usa Google Identity Services (GIS) — sin Firebase, sin dependencias externas.

const OROPEZAS_AUTH = (function () {
	// ─── CONFIGURACIÓN ─────────────────────────────────────────────────────────
	const GOOGLE_CLIENT_ID = '233406003665-udr6c9vv4jej9ur8bsa22tdr9edouvfl.apps.googleusercontent.com';
	const WORKER_URL = 'https://oropezas.enriquegarciaoropeza.workers.dev';
	const USER_KEY = 'oropezas_user_v2'; // versión para invalidar caches antiguas
	const CACHE_KEY = 'oropezas_account_cache';
	const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

	// ─── ESTADO ────────────────────────────────────────────────────────────────
	let currentUser = null;
	let navbarObserver = null;

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

		_restoreSession();
		_watchNavbar();
	}

	function _restoreSession() {
		const saved = localStorage.getItem(USER_KEY);
		if (!saved) return;

		try {
			const parsed = JSON.parse(saved);
			if (_isTokenValid(parsed.token)) {
				currentUser = parsed;
				_updateUI(currentUser);
			} else {
				// Token expirado — limpiar sesión silenciosamente
				localStorage.removeItem(USER_KEY);
				localStorage.removeItem(CACHE_KEY);
				currentUser = null;
				_updateUI(null);
			}
		} catch (e) {
			localStorage.removeItem(USER_KEY);
			localStorage.removeItem(CACHE_KEY);
		}
	}

	function _isTokenValid(token) {
		if (!token) return false;
		try {
			const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
			// Margen de 60 segundos para evitar rechazos justo en el límite
			return payload.exp * 1000 > Date.now() + 60000;
		} catch (e) {
			return false;
		}
	}

	function _watchNavbar() {
		// Si el navbar aún no está cargado (main.js lo trae vía fetch),
		// observamos el DOM para actualizar la UI cuando aparezcan los controles.
		const attemptUpdate = () => {
			const avatar = document.getElementById('auth-user-avatar');
			if (avatar) {
				_updateUI(currentUser);
				if (navbarObserver) {
					navbarObserver.disconnect();
					navbarObserver = null;
				}
			}
		};

		attemptUpdate();

		if (!navbarObserver && typeof MutationObserver !== 'undefined') {
			navbarObserver = new MutationObserver(attemptUpdate);
			const header = document.querySelector('header');
			if (header) {
				navbarObserver.observe(header, { childList: true, subtree: true });
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
		localStorage.setItem(USER_KEY, JSON.stringify(user));

		try {
			const serverRes = await fetch(`${WORKER_URL}/api/auth/google`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken }),
			});
			if (serverRes.ok) {
				const serverData = await serverRes.json();
				if (serverData.success && serverData.user) {
					// Merge role, title, bio from server
					user.role = serverData.user.role || 'user';
					user.title = serverData.user.title || '';
					user.bio = serverData.user.bio || '';
					currentUser = user;
					localStorage.setItem(USER_KEY, JSON.stringify(user));
				}
			}
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
		localStorage.removeItem(USER_KEY);
		localStorage.removeItem(CACHE_KEY);

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

	// ─── CACHE DE CUENTA ──────────────────────────────────────────────────────
	function getCache() {
		try {
			const raw = localStorage.getItem(CACHE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (Date.now() - parsed._cachedAt > CACHE_TTL_MS) return null;
			return parsed.data;
		} catch (e) {
			return null;
		}
	}

	function setCache(data) {
		try {
			localStorage.setItem(CACHE_KEY, JSON.stringify({ _cachedAt: Date.now(), data }));
		} catch (e) {
			// Si localStorage está lleno, ignorar silenciosamente
		}
	}

	function clearCache() {
		localStorage.removeItem(CACHE_KEY);
	}

	return {
		init,
		logout,
		openLoginModal,
		toggleUserMenu,
		getUser: () => currentUser,
		isLoggedIn: () => !!currentUser && _isTokenValid(currentUser?.token),
		getCache,
		setCache,
		clearCache,
	};
})();

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => OROPEZAS_AUTH.init());
} else {
	OROPEZAS_AUTH.init();
}
