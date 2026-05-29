// utils/i18n.js
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const path = require('path');
const db = require('../database');
const { logger } = require('./logger');

const i18n = i18next.createInstance();

i18n
  .use(Backend)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    preload: ['en', 'hi', 'gu'],  // ✅ Preload both languages at startup
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/translation.json')
    },
    interpolation: {
      escapeValue: false
    },
    returnObjects: true,
    debug: false  // Set to true for debugging
  })
  .then(() => {
    logger.success('i18n system loaded');
    // Check available languages
    const languages = Object.keys(i18n.store.data);
    logger.info(`Available languages: ${languages.join(', ')}`);
    logger.info(`Hindi loaded: ${i18n.store.data.hasOwnProperty('hi')}`);
  })
  .catch(err => logger.error('i18n init failed:', err));

/**
 * Returns a translation function for the given context.
 * Priority: user language → guild language → 'en'
 */
function getFixedT(guildId, userId) {
  let lang = 'en';

  if (userId) {
    const userLang = db.getUserLanguage(userId);
    if (userLang) lang = userLang;
  }

  if (lang === 'en' && guildId) {
    const guildLang = db.getGuildLanguage(guildId);
    if (guildLang) lang = guildLang;
  }

  return i18n.getFixedT(lang);
}

module.exports = { i18n, getFixedT };