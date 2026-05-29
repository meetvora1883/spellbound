// public/js/i18n-frontend.js
window._i18nData = null;
window._i18nLang = 'en';

/**
 * Fetch translations for the given (or saved) language and translate the whole page.
 * Use this once on page load.
 */
window.applyTranslations = async function(langOverride) {
  try {
    let lang = langOverride || 'en';
    if (!langOverride) {
      try {
        const userRes = await fetch('/api/user/language');
        if (userRes.ok) {
          const data = await userRes.json();
          if (data && data.language) lang = data.language;
        }
      } catch (e) {}
    }

    const res = await fetch(`/api/translations?lng=${lang}&t=${Date.now()}`);
    if (!res.ok) return;
    const t = await res.json();
    if (!t || Object.keys(t).length === 0) return;

    window._i18nData = t;
    window._i18nLang = lang;

    translateElements();
    console.log(`Translations applied for language: ${lang}`);
  } catch(e) {
    console.error('i18n error:', e);
  }
};

/**
 * Instantly translate all [data-i18n] elements using already-loaded data.
 * Call this after inserting any new HTML (partials).
 */
window.translateElements = function() {
  if (!window._i18nData) return;

  function getNested(obj, path) {
    return path.split('.').reduce((prev, cur) => prev?.[cur], obj);
  }

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = getNested(window._i18nData, key);
    if (text) el.textContent = text;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const text = getNested(window._i18nData, key);
    if (text) el.placeholder = text;
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const text = getNested(window._i18nData, key);
    if (text) el.title = text;
  });
};

/**
 * Global translation function – use in JavaScript for dynamic text.
 */
window.t = function(key, fallback) {
  if (!window._i18nData) return fallback || key;
  const parts = key.split('.');
  let obj = window._i18nData;
  for (const p of parts) {
    if (!obj || typeof obj !== 'object') return fallback || key;
    obj = obj[p];
  }
  return obj || fallback || key;
};

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
  window.applyTranslations();
});