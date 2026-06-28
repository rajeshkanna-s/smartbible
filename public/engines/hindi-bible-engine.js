/* global createBibleEngine, window, globalThis, module */
(function (global) {
  'use strict';
  const HindiBible = createBibleEngine({
    language: 'Hindi',
    source: '/data/bibles/hindi.json',
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = HindiBible;
  else global.HindiBible = HindiBible;
})(typeof window !== 'undefined' ? window : globalThis);
