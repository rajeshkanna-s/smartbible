import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('public/data/bibles');

const ENGLISH_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
  'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
  'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew',
  'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter',
  '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];

const TAMIL_BOOKS = [
  'ஆதியாகமம்', 'யாத்திராகமம்', 'லேவியராகமம்', 'எண்ணாகமம்', 'உபாகமம்',
  'யோசுவா', 'நியாயாதிபதிகள்', 'ரூத்', '1 சாமுவேல்', '2 சாமுவேல்',
  '1 இராஜாக்கள்', '2 இராஜாக்கள்', '1 நாளாகமம்', '2 நாளாகமம்', 'எஸ்றா',
  'நெகேமியா', 'எஸ்தர்', 'யோபு', 'சங்கீதம்', 'நீதிமொழிகள்',
  'பிரசங்கி', 'உன்னதப்பாட்டு', 'ஏசாயா', 'எரேமியா', 'புலம்பல்',
  'எசேக்கியேல்', 'தானியேல்', 'ஓசியா', 'யோவேல்', 'ஆமோஸ்',
  'ஒபதியா', 'யோனா', 'மீகா', 'நாகூம்', 'ஆபகூக்',
  'செப்பனியா', 'ஆகாய்', 'சகரியா', 'மல்கியா', 'மத்தேயு',
  'மாற்கு', 'லூக்கா', 'யோவான்', 'அப்போஸ்தலர்', 'ரோமர்',
  '1 கொரிந்தியர்', '2 கொரிந்தியர்', 'கலாத்தியர்', 'எபேசியர்', 'பிலிப்பியர்',
  'கொலோசெயர்', '1 தெசலோனிக்கேயர்', '2 தெசலோனிக்கேயர்', '1 தீமோத்தேயு', '2 தீமோத்தேயு',
  'தீத்து', 'பிலேமோன்', 'எபிரெயர்', 'யாக்கோபு', '1 பேதுரு',
  '2 பேதுரு', '1 யோவான்', '2 யோவான்', '3 யோவான்', 'யூதா', 'வெளிப்படுத்தல்',
];

const HINDI_BOOKS = [
  'उत्पत्ति', 'निर्गमन', 'लैव्यव्यवस्था', 'गिनती', 'व्यवस्थाविवरण',
  'यहोशू', 'न्यायियों', 'रूत', '1 शमूएल', '2 शमूएल',
  '1 राजा', '2 राजा', '1 इतिहास', '2 इतिहास', 'एज्रा',
  'नहेम्याह', 'एस्तेर', 'अय्यूब', 'भजन संहिता', 'नीतिवचन',
  'सभोपदेशक', 'श्रेष्ठगीत', 'यशायाह', 'यिर्मयाह', 'विलापगीत',
  'यहेजकेल', 'दानिय्येल', 'होशे', 'योएल', 'आमोस',
  'ओबद्याह', 'योना', 'मीका', 'नहूम', 'हबक्कूक',
  'सपन्याह', 'हाग्गै', 'जकर्याह', 'मलाकी', 'मत्ती',
  'मरकुस', 'लूका', 'यूहन्ना', 'प्रेरितों के काम', 'रोमियों',
  '1 कुरिन्थियों', '2 कुरिन्थियों', 'गलातियों', 'इफिसियों', 'फिलिप्पियों',
  'कुलुस्सियों', '1 थिस्सलुनीकियों', '2 थिस्सलुनीकियों', '1 तीमुथियुस', '2 तीमुथियुस',
  'तीतुस', 'फिलेमोन', 'इब्रानियों', 'याकूब', '1 पतरस',
  '2 पतरस', '1 यूहन्ना', '2 यूहन्ना', '3 यूहन्ना', 'यहूदा', 'प्रकाशितवाक्य',
];

const MALAYALAM_BOOKS = [
  'ഉല്പത്തി', 'പുറപ്പാടു്', 'ലേവ്യപുസ്തകം', 'സംഖ്യാപുസ്തകം', 'ആവർത്തനം',
  'യോശുവ', 'ന്യായാധിപന്മാർ', 'രൂത്ത്', '1 ശമൂവേൽ', '2 ശമൂവേൽ',
  '1 രാജാക്കന്മാർ', '2 രാജാക്കന്മാർ', '1 ദിനവൃത്താന്തം', '2 ദിനവൃത്താന്തം', 'എസ്രാ',
  'നെഹെമ്യാവു', 'എസ്ഥേർ', 'ഇയ്യോബ്', 'സങ്കീർത്തനങ്ങൾ', 'സദൃശവാക്യങ്ങൾ',
  'സഭാപ്രസംഗി', 'ഉത്തമഗീതം', 'യെശയ്യാവു', 'യിരെമ്യാവു', 'വിലാപങ്ങൾ',
  'യെഹെസ്കേൽ', 'ദാനീയേൽ', 'ഹോശേയ', 'യോവേൽ', 'ആമോസ്',
  'ഓബദ്യാവു', 'യോനാ', 'മീഖാ', 'നഹൂം', 'ഹബക്കൂക്',
  'സെഫന്യാവു', 'ഹഗ്ഗായി', 'സെഖര്യാവു', 'മലാഖി', 'മത്തായി',
  'മർക്കൊസ്', 'ലൂക്കൊസ്', 'യോഹന്നാൻ', 'അപ്പൊസ്തലപ്രവൃത്തികൾ', 'റോമർ',
  '1 കൊരിന്ത്യർ', '2 കൊരിന്ത്യർ', 'ഗലാത്യർ', 'എഫെസ്യർ', 'ഫിലിപ്പിയർ',
  'കൊലൊസ്സ്യർ', '1 തെസ്സലൊനീക്യർ', '2 തെസ്സലൊനീക്യർ', '1 തിമൊഥെയൊസ്', '2 തിമൊഥെയൊസ്',
  'തീത്തൊസ്', 'ഫിലേമോൻ', 'എബ്രായർ', 'യാക്കോബ്', '1 പത്രൊസ്',
  '2 പത്രൊസ്', '1 യോഹന്നാൻ', '2 യോഹന്നാൻ', '3 യോഹന്നാൻ', 'യൂദാ', 'വെളിപ്പാടു',
];

const TELUGU_BOOKS = [
  'ఆదికాండము', 'నిర్గమకాండము', 'లేవీయకాండము', 'సంఖ్యాకాండము', 'ద్వితీయోపదేశకాండము',
  'యెహోషువ', 'న్యాయాధిపతులు', 'రూతు', '1 సమూయేలు', '2 సమూయేలు',
  '1 రాజులు', '2 రాజులు', '1 దినవృత్తాంతములు', '2 దినవృత్తాంతములు', 'ఎజ్రా',
  'నెహెమ్యా', 'ఎస్తేరు', 'యోబు', 'కీర్తనల', 'సామెతలు',
  'ప్రసంగి', 'పరమగీతము', 'యెషయా', 'యిర్మీయా', 'విలాపవాక్యములు',
  'యెహెజ్కేలు', 'దానియేలు', 'హోషేయ', 'యోవేలు', 'ఆమోసు',
  'ఓబద్యా', 'యోనా', 'మీకా', 'నహూము', 'హబక్కూకు',
  'జెఫన్యా', 'హగ్గయి', 'జెకర్యా', 'మలాకీ', 'మత్తయి',
  'మార్కు', 'లూకా', 'యోహాను', 'అపొస్తలుల కార్యములు', 'రోమీయులకు',
  '1 కొరిందీయులకు', '2 కొరిందీయులకు', 'గలతీయులకు', 'ఎఫెసీయులకు', 'ఫిలిప్పీయులకు',
  'కొలొస్సయులకు', '1 దెస్సలొనీకయులకు', '2 దెస్సలొనీకయులకు', '1 తిమోతికి', '2 తిమోతికి',
  'తీతుకు', 'ఫిలేమోనుకు', 'హెబ్రీయులకు', 'యాకోబు', '1 పేతురు',
  '2 పేతురు', '1 యోహాను', '2 యోహాను', '3 యోహాను', 'యూదా', 'ప్రకటన',
];

const LANGUAGES = [
  {
    id: 'english',
    label: 'English',
    shortLabel: 'EN',
    source: 'https://github.com/aruljohn/Bible-kjv',
    download: downloadEnglishKjv,
  },
  {
    id: 'tamil',
    label: 'Tamil',
    shortLabel: 'TA',
    source: 'https://github.com/godlytalias/Bible-Database/tree/master/Tamil',
    download: () => downloadBibleDatabase('Tamil', TAMIL_BOOKS),
  },
  {
    id: 'malayalam',
    label: 'Malayalam',
    shortLabel: 'ML',
    source: 'https://github.com/godlytalias/Bible-Database/tree/master/Malayalam',
    download: () => downloadBibleDatabase('Malayalam', MALAYALAM_BOOKS),
  },
  {
    id: 'telugu',
    label: 'Telugu',
    shortLabel: 'TE',
    source: 'https://github.com/godlytalias/Bible-Database/tree/master/Telugu',
    download: () => downloadBibleDatabase('Telugu', TELUGU_BOOKS),
  },
  {
    id: 'hindi',
    label: 'Hindi',
    shortLabel: 'HI',
    source: 'https://github.com/godlytalias/Bible-Database/tree/master/Hindi',
    download: () => downloadBibleDatabase('Hindi', HINDI_BOOKS),
  },
];

await mkdir(outputDir, { recursive: true });

const manifest = [];

for (const language of LANGUAGES) {
  console.log(`Downloading ${language.label}...`);
  const downloaded = await language.download();
  const payload = {
    id: language.id,
    label: language.label,
    shortLabel: language.shortLabel,
    source: language.source,
    downloadedAt: new Date().toISOString(),
    books: downloaded.books,
    verses: downloaded.verses,
  };

  const file = `${language.id}.json`;
  await writeJson(path.join(outputDir, file), payload);
  manifest.push({
    id: language.id,
    label: language.label,
    shortLabel: language.shortLabel,
    file: `/data/bibles/${file}`,
    source: language.source,
    verseCount: payload.verses.length,
    bookCount: payload.books.length,
  });
  console.log(`Saved ${language.label}: ${payload.verses.length} verses`);
}

await writeJson(path.join(outputDir, 'manifest.json'), {
  generatedAt: new Date().toISOString(),
  languages: manifest,
});

console.log('Done. Bible JSON is now bundled locally in public/data/bibles.');

async function downloadEnglishKjv() {
  const base = 'https://raw.githubusercontent.com/aruljohn/Bible-kjv/master/';
  const chaptersByBook = await Promise.all(
    ENGLISH_BOOKS.map(async (bookName) => {
      const json = await fetchJson(`${base}${bookName.replace(/\s+/g, '')}.json`);
      return json.chapters ?? json.Chapter ?? [];
    }),
  );

  return normalizeBooks({
    bookNames: ENGLISH_BOOKS,
    sourceBooks: chaptersByBook.map((chapters) => ({ chapters })),
  });
}

async function downloadBibleDatabase(folder, bookNames = []) {
  const url = `https://raw.githubusercontent.com/godlytalias/Bible-Database/master/${folder}/bible.json`;
  const json = await fetchJson(url);
  const sourceBooks = json.Book ?? json.books ?? json;
  return normalizeBooks({ sourceBooks, bookNames });
}

function normalizeBooks({ sourceBooks, bookNames = [] }) {
  const books = [];
  const verses = [];

  sourceBooks.forEach((bookInput, bookIndex) => {
    const bookName =
      readString(bookInput, ['bookName', 'BookName', 'name', 'Name', 'book', 'Book']) ??
      bookNames[bookIndex] ??
      ENGLISH_BOOKS[bookIndex] ??
      `Book ${bookIndex + 1}`;

    books.push({
      index: bookIndex,
      name: bookName,
      englishName: ENGLISH_BOOKS[bookIndex] ?? bookName,
    });

    const chapters = bookInput.Chapter ?? bookInput.chapters ?? bookInput.chapter ?? [];
    chapters.forEach((chapterInput, chapterIndex) => {
      const chapter = readNumber(
        chapterInput,
        ['chapter', 'Chapter', 'chapterNumber', 'ChapterNumber'],
        chapterIndex + 1,
      );
      const verseInputs = chapterInput.Verse ?? chapterInput.verses ?? chapterInput.verse ?? [];

      verseInputs.forEach((verseInput, verseIndex) => {
        const verse = readNumber(
          verseInput,
          ['verse', 'verseNumber', 'VerseNumber'],
          verseIndex + 1,
        );
        const text = readVerseText(verseInput);
        verses.push({
          id: `${pad(bookIndex, 2)}${pad(chapter, 3)}${pad(verse, 3)}`,
          book: bookIndex,
          bookName,
          englishBookName: ENGLISH_BOOKS[bookIndex] ?? bookName,
          chapter,
          verse,
          ref: `${bookName} ${chapter}:${verse}`,
          englishRef: `${ENGLISH_BOOKS[bookIndex] ?? bookName} ${chapter}:${verse}`,
          text,
        });
      });
    });
  });

  verses.sort((a, b) => a.book - b.book || a.chapter - b.chapter || a.verse - b.verse);
  return { books, verses };
}

function readVerseText(input) {
  if (typeof input === 'string' || typeof input === 'number') {
    return String(input).trim();
  }

  return (
    readString(input, ['text', 'Text', 'verseText', 'VerseText', 'content', 'Content']) ??
    readString(input, ['Verse']) ??
    ''
  ).trim();
}

function readNumber(input, keys, fallback) {
  const raw = readString(input, keys);
  if (raw != null) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readString(input, keys) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  for (const key of keys) {
    const value = input[key];
    if (value != null && typeof value !== 'object') {
      return String(value);
    }
  }
  return null;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function pad(value, length) {
  return String(value).padStart(length, '0');
}
