
// ── Oropezas i18n ─────────────────────────────────────────────────────────────
// Lightweight language toggle: ES ↔ EN
// Usage: add data-i18n="key" to any element, call i18n.setLang("en")
// The lang preference is stored in localStorage.

const TRANSLATIONS = {
  es: {
    "nav.home":        "Inicio",
    "nav.news":        "Noticias",
    "nav.forums":      "Foros",
    "nav.account":     "Mi cuenta",
    "lang.toggle":     "English",
    "hero.read_more":  "Leer más",
    "grid.read_more":  "Leer más",
    "article.by":      "Por",
    "article.published": "Publicado",
    "article.category": "Categoría",
    "profile.articles": "Artículos publicados",
    "profile.no_articles": "Sin artículos publicados aún.",
    "profile.founder": "Fundador",
    "footer.rights":   "Todos los derechos reservados.",
  },
  en: {
    "nav.home":        "Home",
    "nav.news":        "News",
    "nav.forums":      "Forums",
    "nav.account":     "My account",
    "lang.toggle":     "Español",
    "hero.read_more":  "Read more",
    "grid.read_more":  "Read more",
    "article.by":      "By",
    "article.published": "Published",
    "article.category": "Category",
    "profile.articles": "Published articles",
    "profile.no_articles": "No articles published yet.",
    "profile.founder": "Founder",
    "footer.rights":   "All rights reserved.",
  }
};

const i18n = (() => {
  let _lang = localStorage.getItem("oropezas_lang") || "es";

  function t(key) {
    return (TRANSLATIONS[_lang] || TRANSLATIONS["es"])[key] || key;
  }

  function applyToDOM() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const attr = el.getAttribute("data-i18n-attr"); // optional: "placeholder", "title", etc.
      const val = t(key);
      if (attr) el.setAttribute(attr, val);
      else el.textContent = val;
    });
    document.documentElement.lang = _lang;
    // Update toggle button label
    document.querySelectorAll(".lang-toggle-btn").forEach(btn => {
      btn.textContent = t("lang.toggle");
    });
  }

  function setLang(lang, reload = false) {
    if (!TRANSLATIONS[lang]) return;
    _lang = lang;
    localStorage.setItem("oropezas_lang", lang);
    if (reload) {
      window.location.reload();
    } else {
      applyToDOM();
      document.dispatchEvent(new CustomEvent("oropezas:langchange", { detail: { lang } }));
    }
  }

  function getLang() { return _lang; }

  function toggle() {
    setLang(_lang === "es" ? "en" : "es");
  }

  // Auto-apply on DOMContentLoaded
  document.addEventListener("DOMContentLoaded", applyToDOM);

  return { t, setLang, getLang, toggle, applyToDOM };
})();

window.i18n = i18n;
