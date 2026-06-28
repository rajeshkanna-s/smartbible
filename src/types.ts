export type BibleLanguageId = 'english' | 'tamil' | 'malayalam' | 'telugu' | 'hindi';

export type BibleBook = {
  index: number;
  name: string;
  englishName: string;
};

export type BibleVerse = {
  id: string;
  book: number;
  bookName: string;
  englishBookName: string;
  chapter: number;
  verse: number;
  ref: string;
  englishRef: string;
  text: string;
};

export type BibleData = {
  id: BibleLanguageId;
  label: string;
  shortLabel: string;
  source: string;
  downloadedAt: string;
  books: BibleBook[];
  verses: BibleVerse[];
};

export type LanguageManifest = {
  id: BibleLanguageId;
  label: string;
  shortLabel: string;
  file: string;
  source: string;
  verseCount: number;
  bookCount: number;
};

export type BibleManifest = {
  generatedAt: string;
  languages: LanguageManifest[];
};
