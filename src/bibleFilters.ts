import type { BibleData, BibleVerse } from './types';

export type ReferenceParts = {
  bookQuery: string;
  chapter?: number;
  verse?: number;
};

export type FilterState = {
  languageId: string;
  bookIndex: string;
  chapter: string;
  verse: string;
  testament: 'all' | 'old' | 'new';
  searchText: string;
  referenceCode: string;
  exactVerseOnly: boolean;
};

export function parseReferenceCode(input: string): ReferenceParts | null {
  const value = input.trim();
  if (!value) return null;

  const onlyChapterVerse = value.match(/^(\d{1,3})\s*:\s*(\d{1,3})$/);
  if (onlyChapterVerse) {
    return {
      bookQuery: '',
      chapter: Number(onlyChapterVerse[1]),
      verse: Number(onlyChapterVerse[2]),
    };
  }

  const withBook = value.match(/^(.+?)\s+(\d{1,3})(?:\s*:\s*(\d{1,3}))?$/);
  if (!withBook) return null;

  return {
    bookQuery: withBook[1].trim(),
    chapter: Number(withBook[2]),
    verse: withBook[3] ? Number(withBook[3]) : undefined,
  };
}

export function hasActiveFilters(state: FilterState): boolean {
  return (
    state.referenceCode.trim() !== '' ||
    state.bookIndex !== '' ||
    state.chapter !== '' ||
    state.verse !== '' ||
    state.searchText.trim() !== '' ||
    state.testament !== 'all'
  );
}

export function filterVerses(data: BibleData | undefined, state: FilterState): BibleVerse[] {
  if (!data) return [];
  // No filters active -> nothing to show (so "Clear" empties the results below).
  if (!hasActiveFilters(state)) return [];

  const parsedRef = parseReferenceCode(state.referenceCode);
  const searchNeedle = normalize(state.searchText);
  const selectedBook = resolveSelectedBook(data, state.bookIndex, parsedRef?.bookQuery);
  const chapter = parsedRef?.chapter ?? numericValue(state.chapter);
  const verse = parsedRef?.verse ?? numericValue(state.verse);

  return data.verses.filter((item) => {
    if (state.testament === 'old' && item.book > 38) return false;
    if (state.testament === 'new' && item.book < 39) return false;
    if (selectedBook != null && item.book !== selectedBook) return false;
    if (chapter != null && item.chapter !== chapter) return false;
    if (verse != null && item.verse !== verse) return false;
    if (parsedRef && !parsedRef.bookQuery && state.exactVerseOnly && item.chapter !== parsedRef.chapter) return false;
    if (searchNeedle && !matchesSearch(item, searchNeedle)) return false;
    return true;
  });
}

export function chaptersForBook(data: BibleData | undefined, bookIndex: string): number[] {
  if (!data || bookIndex === '') return [];
  const selected = Number(bookIndex);
  const chapters = new Set<number>();
  data.verses.forEach((verse) => {
    if (verse.book === selected) chapters.add(verse.chapter);
  });
  return Array.from(chapters).sort((a, b) => a - b);
}

export function versesForChapter(
  data: BibleData | undefined,
  bookIndex: string,
  chapter: string,
): number[] {
  if (!data || bookIndex === '' || chapter === '') return [];
  const selected = Number(bookIndex);
  const selectedChapter = Number(chapter);
  const verses = new Set<number>();
  data.verses.forEach((verse) => {
    if (verse.book === selected && verse.chapter === selectedChapter) verses.add(verse.verse);
  });
  return Array.from(verses).sort((a, b) => a - b);
}

export function resultWindow(results: BibleVerse[], limit = 250): BibleVerse[] {
  return results.slice(0, limit);
}

function resolveSelectedBook(
  data: BibleData,
  bookIndex: string,
  parsedBookQuery?: string,
): number | null {
  if (bookIndex !== '') return Number(bookIndex);
  if (!parsedBookQuery) return null;

  const query = normalize(parsedBookQuery);
  const exact = data.books.find(
    (book) => normalize(book.name) === query || normalize(book.englishName) === query,
  );
  if (exact) return exact.index;

  const startsWith = data.books.find(
    (book) => normalize(book.name).startsWith(query) || normalize(book.englishName).startsWith(query),
  );
  return startsWith?.index ?? null;
}

function matchesSearch(item: BibleVerse, needle: string): boolean {
  return (
    normalize(item.text).includes(needle) ||
    normalize(item.ref).includes(needle) ||
    normalize(item.englishRef).includes(needle)
  );
}

function numericValue(value: string): number | undefined {
  if (value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}
