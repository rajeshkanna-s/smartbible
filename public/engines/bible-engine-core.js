/* global window, globalThis */
(function (global) {
  'use strict';

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function createBibleEngine(options) {
    const source = options.source;
    const language = options.language;
    let data = null;
    let verses = [];

    async function load(customSource) {
      const response = await fetch(customSource || source);
      if (!response.ok) {
        throw new Error(language + ' Bible local JSON failed to load: ' + response.status);
      }
      data = await response.json();
      verses = Array.isArray(data.verses) ? data.verses : [];
      return verses.length;
    }

    function ensureLoaded() {
      if (!data) {
        throw new Error(language + ' Bible not loaded. Call await ' + language + 'Bible.load() first.');
      }
    }

    function resolveBook(book) {
      ensureLoaded();
      if (typeof book === 'number') return book;
      const needle = normalizeText(book);
      const found = data.books.find(function (candidate) {
        return normalizeText(candidate.name) === needle ||
          normalizeText(candidate.englishName) === needle ||
          String(candidate.index) === String(book);
      });
      return found ? found.index : -1;
    }

    function filter(criteria) {
      ensureLoaded();
      if (typeof criteria === 'function') {
        return verses.filter(criteria);
      }

      const current = criteria || {};
      return verses.filter(function (verse) {
        if (current.book != null && verse.book !== resolveBook(current.book)) return false;
        if (current.bookName != null && normalizeText(verse.bookName) !== normalizeText(current.bookName)) return false;
        if (current.chapter != null && verse.chapter !== Number(current.chapter)) return false;
        if (current.verse != null && verse.verse !== Number(current.verse)) return false;
        if (current.reference != null && normalizeText(verse.englishRef).indexOf(normalizeText(current.reference)) === -1 && normalizeText(verse.ref).indexOf(normalizeText(current.reference)) === -1) return false;
        if (current.contains != null && normalizeText(verse.text).indexOf(normalizeText(current.contains)) === -1) return false;
        if (current.regex != null && !(new RegExp(current.regex, 'iu')).test(verse.text)) return false;
        return true;
      });
    }

    function getVerse(book, chapter, verse) {
      return filter({ book: book, chapter: chapter, verse: verse })[0] || null;
    }

    function getChapter(book, chapter) {
      return filter({ book: book, chapter: chapter });
    }

    function getBook(book) {
      return filter({ book: book });
    }

    function search(word) {
      return filter({ contains: word });
    }

    function all() {
      ensureLoaded();
      return verses.slice();
    }

    function books() {
      ensureLoaded();
      return data.books.slice();
    }

    function count() {
      return verses.length;
    }

    return {
      load: load,
      filter: filter,
      getVerse: getVerse,
      getChapter: getChapter,
      getBook: getBook,
      search: search,
      all: all,
      books: books,
      count: count,
    };
  }

  global.createBibleEngine = createBibleEngine;
})(typeof window !== 'undefined' ? window : globalThis);
