// ============================================================
// OROPEZAS ADSENSE + COOKIE CONSENT
// Add your AdSense Publisher ID below after approval
// ============================================================

(function() {
  'use strict';

  // ─── CONFIG ──────────────────────────────────────────────
  const ADSENSE_PUB_ID = 'pub-8411594357975477';

  // ─── COOKIE CONSENT BANNER ───────────────────────────────
  function initCookieConsent() {
    if (localStorage.getItem('cookie_consent')) return; // already decided

    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.innerHTML =
      '<div style="position:fixed;bottom:0;left:0;right:0;background:#1a1a1a;color:#fff;padding:16px 20px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:14px;line-height:1.5;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;">' +
        '<span style="max-width:700px;">Utilizamos cookies y tecnologías similares para mejorar tu experiencia, mostrar anuncios personalizados (Google AdSense) y analizar el tráfico. Al hacer clic en "Aceptar", aceptas nuestra <a href=\"/privacidad.html\" style=\"color:#4dabf7;text-decoration:underline;\">Política de Privacidad</a> y el uso de cookies.</span>' +
        '<div style="display:flex;gap:10px;flex-shrink:0;">' +
          '<button id="cookie-accept" style="background:#fff;color:#1a1a1a;border:none;padding:8px 18px;border-radius:4px;font-weight:600;cursor:pointer;font-size:13px;">Aceptar</button>' +
          '<button id="cookie-reject" style="background:transparent;color:#fff;border:1px solid #555;padding:8px 18px;border-radius:4px;cursor:pointer;font-size:13px;">Rechazar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);

    document.getElementById('cookie-accept').addEventListener('click', function() {
      localStorage.setItem('cookie_consent', 'accepted');
      banner.remove();
      initAdSense(); // Load ads after consent
    });

    document.getElementById('cookie-reject').addEventListener('click', function() {
      localStorage.setItem('cookie_consent', 'rejected');
      banner.remove();
      // Ads don't load — non-personalized only
    });
  }

  // ─── ADSENSE LOADER ──────────────────────────────────────
  function initAdSense() {
    if (!ADSENSE_PUB_ID) {
      console.log('[ADSENSE] No Publisher ID set. Skipping ad load.');
      return;
    }

    // Load AdSense script
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-' + ADSENSE_PUB_ID;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);

    // Initialize ad slots
    document.querySelectorAll('.adsbygoogle').forEach(function(slot) {
      slot.setAttribute('data-ad-client', 'ca-' + ADSENSE_PUB_ID);
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch(e) { console.log('[ADSENSE] Ad push error:', e); }
    });
  }

  // ─── INIT ────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieConsent);
  } else {
    initCookieConsent();
  }
})();
