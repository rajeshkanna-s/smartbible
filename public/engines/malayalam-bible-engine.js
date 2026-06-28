/* global createBibleEngine, window, globalThis, module */
(function (global) {
  'use strict';
  const MalayalamBible = createBibleEngine({
    language: 'Malayalam',
    source: '/data/bibles/malayalam.json',
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = MalayalamBible;
  else global.MalayalamBible = MalayalamBible;
})(typeof window !== 'undefined' ? window : globalThis);
