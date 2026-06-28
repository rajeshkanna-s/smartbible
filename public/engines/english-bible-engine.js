/* global createBibleEngine, window, globalThis, module */
(function (global) {
  'use strict';
  const EnglishBible = createBibleEngine({
    language: 'English',
    source: '/data/bibles/english.json',
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = EnglishBible;
  else global.EnglishBible = EnglishBible;
})(typeof window !== 'undefined' ? window : globalThis);
