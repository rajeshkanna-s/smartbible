/* global createBibleEngine, window, globalThis, module */
(function (global) {
  'use strict';
  const TamilBible = createBibleEngine({
    language: 'Tamil',
    source: '/data/bibles/tamil.json',
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = TamilBible;
  else global.TamilBible = TamilBible;
})(typeof window !== 'undefined' ? window : globalThis);
