/* global createBibleEngine, window, globalThis, module */
(function (global) {
  'use strict';
  const TeluguBible = createBibleEngine({
    language: 'Telugu',
    source: '/data/bibles/telugu.json',
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = TeluguBible;
  else global.TeluguBible = TeluguBible;
})(typeof window !== 'undefined' ? window : globalThis);
