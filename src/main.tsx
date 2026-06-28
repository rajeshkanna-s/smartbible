import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  BookOpen,
  BookText,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  Heart,
  Languages,
  Link2,
  Loader2,
  Maximize2,
  Moon,
  Search,
  Send,
  Share2,
  Sparkles,
  Sun,
  Type,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  chaptersForBook,
  filterVerses,
  hasActiveFilters,
  parseReferenceCode,
  resultWindow,
  versesForChapter,
  type FilterState,
} from './bibleFilters';
import type {
  BibleData,
  BibleLanguageId,
  BibleManifest,
  BibleVerse,
  LanguageManifest,
} from './types';
import './styles.css';
import './styles-v2.css';

const defaultState: FilterState = {
  languageId: 'english',
  bookIndex: '42',
  chapter: '14',
  verse: '6',
  testament: 'all',
  searchText: '',
  referenceCode: 'John 14:6',
  exactVerseOnly: true,
};

// ---------- AI explanation service (user-provided Supabase edge function) ----------
const AI_ENDPOINT = 'https://wuvgoqjxvnbihwiijzfb.supabase.co/functions/v1/ai-chat';
const AI_KEY = 'sb_publishable_XwfSIwlW4c35Ejv4nwG6Dg_LkXaK4Z_';
const AI_PROVIDERS = [
  {
    provider: 'nvidia',
    modelId: 'a34c3d62-5e7d-4504-a009-b689575bdb37',
    tokenSlotId: 'b8ee59ec-62ed-42fb-b77a-09654020b8b3',
  },
  {
    provider: 'openrouter',
    modelId: 'eecca7be-5693-4be4-860c-48055729aeb0',
    tokenSlotId: '877fbe3c-eb52-4b9a-a386-ef97a78eb77c',
  },
];

async function fetchAiExplanation(prompt: string): Promise<string> {
  let lastError: unknown;
  for (const provider of AI_PROVIDERS) {
    try {
      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: AI_KEY,
          Authorization: `Bearer ${AI_KEY}`,
        },
        body: JSON.stringify({
          ...provider,
          prompt,
          temperature: 0.3,
          top_p: 0.7,
          max_tokens: 768,
          attempt_timeout_ms: 20000,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(`AI service responded ${response.status}`);
      const data = await response.json();
      const text = String(data?.content ?? data?.message ?? '').trim();
      if (text) return text;
      throw new Error('Empty AI response');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI request failed.');
}

function buildExplainPrompt(verse: BibleVerse, languageLabel: string): string {
  return [
    'You are a careful, faithful Bible study assistant.',
    `Explain this Bible verse for a general reader. Write the whole answer in ${languageLabel}.`,
    'Use these short sections with clear headings:',
    '1. Meaning - what the verse is saying.',
    '2. Context - the book and situation around it.',
    '3. Application - one practical takeaway for daily life.',
    'Be warm, concise (under 200 words), and do not invent quotations.',
    '',
    `Reference: ${verse.englishRef}`,
    `Verse text: "${verse.text}"`,
  ].join('\n');
}

// ---------- Color themes ----------
type Theme = {
  id: string;
  name: string;
  a: string; // gradient top
  b: string; // gradient mid
  c: string; // gradient bottom
  accent: string; // native reference colour
  sub: string; // english reference colour
};

const THEMES: Theme[] = [
  { id: 'indigo', name: 'Indigo', a: '#4356b8', b: '#2f3b8f', c: '#232a73', accent: '#8ce0d6', sub: '#b9c2f2' },
  { id: 'emerald', name: 'Emerald', a: '#1f9d7a', b: '#157a5f', c: '#0e5544', accent: '#ffe08a', sub: '#c4ecdc' },
  { id: 'sunset', name: 'Sunset', a: '#ff7e5f', b: '#e85d6b', c: '#b23a64', accent: '#fff1c2', sub: '#ffd9cf' },
  { id: 'royal', name: 'Royal', a: '#7b4dd8', b: '#5b34b0', c: '#3f2185', accent: '#ffd24d', sub: '#ddd0ff' },
  { id: 'ocean', name: 'Ocean', a: '#1f9fce', b: '#1c77ad', c: '#16527f', accent: '#aef0d0', sub: '#c3e7f7' },
  { id: 'rose', name: 'Rose', a: '#e0568a', b: '#c23a74', c: '#8f2a5e', accent: '#ffe6a3', sub: '#ffd2e2' },
  { id: 'charcoal', name: 'Charcoal', a: '#3c4456', b: '#2a3140', c: '#181d27', accent: '#7fe0c6', sub: '#c3cad8' },
  { id: 'wine', name: 'Wine', a: '#9c3a52', b: '#7a2840', c: '#561a2f', accent: '#ffd98a', sub: '#f3c9d2' },
];

// ---------- PNG export (dependency-free canvas render) ----------
const PNG_FONT = "'Segoe UI', 'Nirmala UI', 'Noto Sans', system-ui, sans-serif";

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type Ratio = 'square' | 'story' | 'wide';
const RATIO_SIZES: Record<Ratio, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  wide: { w: 1920, h: 1080 },
};

// Paint the verse image onto a given canvas at the chosen aspect ratio.
function paintVerseCanvas(
  canvas: HTMLCanvasElement,
  verse: BibleVerse,
  theme: Theme,
  ratio: Ratio,
): boolean {
  const { w, h } = RATIO_SIZES[ratio];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, theme.a);
  bg.addColorStop(0.55, theme.b);
  bg.addColorStop(1, theme.c);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const unit = Math.min(w, h);
  const padX = w * 0.1;
  const maxWidth = w - padX * 2;
  const refZone = h * 0.2;
  const zoneTop = h * 0.1;
  const zoneBottom = h - refZone;
  const zoneHeight = zoneBottom - zoneTop;
  const lineRatio = 1.45;

  // Shrink the font until the wrapped text fits the available zone.
  let fontSize = Math.round(unit * 0.07);
  let lines: string[] = [];
  while (fontSize > 18) {
    ctx.font = `700 ${fontSize}px ${PNG_FONT}`;
    lines = wrapCanvasLines(ctx, verse.text, maxWidth);
    if (lines.length * fontSize * lineRatio <= zoneHeight) break;
    fontSize -= 2;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${fontSize}px ${PNG_FONT}`;
  const lineHeight = fontSize * lineRatio;
  const blockHeight = lines.length * lineHeight;
  let y = zoneTop + (zoneHeight - blockHeight) / 2 + lineHeight / 2;
  for (const line of lines) {
    ctx.fillText(line, w / 2, y);
    y += lineHeight;
  }

  const sameRef = verse.ref === verse.englishRef;
  ctx.fillStyle = theme.accent;
  ctx.font = `800 ${Math.round(unit * 0.043)}px ${PNG_FONT}`;
  ctx.fillText(verse.ref, w / 2, sameRef ? h - refZone * 0.62 : h - refZone * 0.72);

  if (!sameRef) {
    ctx.fillStyle = theme.sub;
    ctx.font = `700 ${Math.round(unit * 0.03)}px ${PNG_FONT}`;
    ctx.fillText(verse.englishRef, w / 2, h - refZone * 0.46);
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = `700 ${Math.round(unit * 0.024)}px ${PNG_FONT}`;
  ctx.fillText('Smart Bible', w / 2, h - refZone * 0.18);

  return true;
}

function getHeroFontSize(text: string, ratio: Ratio, scale: number): string {
  const len = Math.max(20, text.length);

  let availH = 84;
  let refH = 15;
  let availW = 88;
  let minPx = 13;
  let maxPx = 36;
  let buffer = 0.82;

  if (ratio === 'wide') {
    availH = 56.25;
    refH = 12;
    availW = 80;
    minPx = 12;
    maxPx = 28;
    buffer = 0.85;
  } else if (ratio === 'story') {
    availH = 178;
    refH = 22;
    availW = 84;
    minPx = 13;
    maxPx = 34;
    buffer = 0.8;
  }

  // Calculate dynamic cqw font size based on character density and container geometry
  const calculatedCqw = Math.sqrt((availH - refH) * availW / (0.825 * len)) * buffer;

  return `clamp(${minPx}px, calc(${calculatedCqw.toFixed(2)}cqw * ${scale}), ${maxPx}px)`;
}

function getFullviewFontSize(text: string, scale: number): string {
  const len = text.length;
  let baseRem = 2.4;

  if (len < 100) baseRem = 2.8;
  else if (len < 180) baseRem = 2.2;
  else if (len < 260) baseRem = 1.75;
  else if (len < 340) baseRem = 1.45;
  else baseRem = 1.25;

  return `calc(${baseRem * scale} * clamp(1.1rem, 3.8vw, 2.5rem))`;
}

function renderVerseCanvas(verse: BibleVerse, theme: Theme, ratio: Ratio): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  return paintVerseCanvas(canvas, verse, theme, ratio) ? canvas : null;
}

function downloadVersePng(verse: BibleVerse, theme: Theme, ratio: Ratio = 'square') {
  const canvas = renderVerseCanvas(verse, theme, ratio);
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${verse.englishRef.replace(/[\s:]+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

type AiState = { loading: boolean; text: string; error: string };
type CompareRow = { id: BibleLanguageId; label: string; nativeRef: string; text: string };
type CompareState = { loading: boolean; rows: CompareRow[]; error: string };

const emptyAi: AiState = { loading: false, text: '', error: '' };
const emptyCompare: CompareState = { loading: false, rows: [], error: '' };

// ---------- Lightweight markdown rendering for AI explanations ----------
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={`${keyPrefix}-${index}`}>{part}</React.Fragment>;
  });
}

type ExplainSection = { num: string | null; title: string | null; body: string[] };

function parseExplanation(raw: string): ExplainSection[] {
  const lines = raw.replace(/\r/g, '').split('\n');
  const sections: ExplainSection[] = [];
  let current: ExplainSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const hashHeading = line.match(/^#{1,6}\s*(.+)$/);
    const boldHeading = !hashHeading && line.match(/^\*\*(.+?)\*\*:?$/);
    const headingText = hashHeading ? hashHeading[1] : boldHeading ? boldHeading[1] : null;

    if (headingText) {
      const numbered = headingText.match(/^(\d+)[.)]\s*(.+)$/);
      current = {
        num: numbered ? numbered[1] : null,
        title: (numbered ? numbered[2] : headingText).replace(/\*\*/g, '').trim(),
        body: [],
      };
      sections.push(current);
    } else {
      if (!current) {
        current = { num: null, title: null, body: [] };
        sections.push(current);
      }
      current.body.push(line);
    }
  }
  return sections;
}

function ExplanationContent({ text }: { text: string }) {
  const sections = parseExplanation(text);
  let badge = 0;
  return (
    <div className="ai-rich">
      {sections.map((section, sIndex) => {
        const label = section.num ?? (section.title ? String(++badge) : null);
        // Split the body into paragraphs on blank lines.
        const paragraphs: string[] = [];
        section.body.forEach((line) => {
          if (line === '') {
            if (paragraphs.length && paragraphs[paragraphs.length - 1] !== '') paragraphs.push('');
          } else if (paragraphs.length && paragraphs[paragraphs.length - 1] !== '') {
            paragraphs[paragraphs.length - 1] += ` ${line}`;
          } else {
            if (paragraphs.length && paragraphs[paragraphs.length - 1] === '') paragraphs.pop();
            paragraphs.push(line);
          }
        });
        const blocks = paragraphs.filter((p) => p !== '');
        return (
          <section className="ai-section" key={sIndex}>
            {section.title && (
              <div className="ai-section-head">
                {label && <span className="ai-num">{label}</span>}
                <h4>{renderInline(section.title, `h-${sIndex}`)}</h4>
              </div>
            )}
            {blocks.map((para, pIndex) => (
              <p key={pIndex}>{renderInline(para, `p-${sIndex}-${pIndex}`)}</p>
            ))}
          </section>
        );
      })}
    </div>
  );
}

// ---------- Persistence (localStorage) ----------
type SavedVerse = BibleVerse & { languageId: string; label: string };

type Persisted = {
  languageId?: string;
  themeId?: string;
  fontScale?: number;
  dark?: boolean;
  bookmarks?: SavedVerse[];
  recent?: SavedVerse[];
  lastState?: FilterState;
};

const STORE_KEY = 'smart-bible:v1';

function loadStore(): Persisted {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Persisted;
  } catch {
    return {};
  }
}

function saveStore(patch: Persisted) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...loadStore(), ...patch }));
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

// ---------- Verse of the day ----------
const VOD_REFS = [
  'John 3:16', 'Philippians 4:13', 'Jeremiah 29:11', 'Psalms 23:1', 'Romans 8:28',
  'Proverbs 3:5', 'Isaiah 41:10', 'John 14:6', 'Joshua 1:9', 'Matthew 6:33',
  'Psalms 46:1', 'Romans 12:2', 'Philippians 4:6', '2 Timothy 1:7', '1 Corinthians 13:4',
  'Galatians 5:22', 'Ephesians 2:8', 'Psalms 119:105', 'Matthew 11:28', 'Hebrews 11:1',
  'Isaiah 40:31', 'Psalms 27:1', 'Romans 5:8', 'John 1:1', 'Psalms 91:1',
  'Proverbs 16:3', 'Matthew 5:16', 'Lamentations 3:22', 'Micah 6:8', '1 Peter 5:7',
  'Psalms 121:1',
];

function verseOfDayRef(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return VOD_REFS[day % VOD_REFS.length];
}

function initialFilterState(): FilterState {
  const store = loadStore();
  if (store.lastState) {
    return {
      ...defaultState,
      ...store.lastState,
      languageId: store.languageId ?? store.lastState.languageId ?? defaultState.languageId,
    };
  }
  return {
    ...defaultState,
    languageId: store.languageId ?? defaultState.languageId,
    referenceCode: verseOfDayRef(),
    bookIndex: '',
    chapter: '',
    verse: '',
  };
}

// ---------- Verse navigation (within a language's flat verse list) ----------
function adjacentVerse(bible: BibleData | undefined, verse: BibleVerse, dir: 1 | -1): BibleVerse | null {
  if (!bible) return null;
  const idx = bible.verses.findIndex((v) => v.id === verse.id);
  if (idx < 0) return null;
  return bible.verses[idx + dir] ?? null;
}

function adjacentChapter(bible: BibleData | undefined, verse: BibleVerse, dir: 1 | -1): BibleVerse | null {
  if (!bible) return null;
  const verses = bible.verses;
  const idx = verses.findIndex((v) => v.id === verse.id);
  if (idx < 0) return null;

  if (dir === 1) {
    for (let i = idx + 1; i < verses.length; i++) {
      if (verses[i].book !== verse.book || verses[i].chapter !== verse.chapter) return verses[i];
    }
    return null;
  }
  // Previous chapter: walk back to the start of the current chapter, then to the prev chapter's start.
  let first = idx;
  while (first > 0 && verses[first - 1].book === verse.book && verses[first - 1].chapter === verse.chapter) {
    first--;
  }
  const prev = first - 1;
  if (prev < 0) return null;
  const pv = verses[prev];
  let pFirst = prev;
  while (pFirst > 0 && verses[pFirst - 1].book === pv.book && verses[pFirst - 1].chapter === pv.chapter) {
    pFirst--;
  }
  return verses[pFirst];
}

function chapterVerses(bible: BibleData | undefined, book: number, chapter: number): BibleVerse[] {
  if (!bible) return [];
  return bible.verses.filter((v) => v.book === book && v.chapter === chapter);
}

// ---------- Search-term highlighting ----------
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string, keyPrefix: string): React.ReactNode {
  const terms = query
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
  if (!terms.length) return text;

  const lowerTerms = terms.map((t) => t.toLowerCase());
  const re = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  return text.split(re).map((part, index) =>
    lowerTerms.includes(part.toLowerCase()) ? (
      <mark key={`${keyPrefix}-${index}`}>{part}</mark>
    ) : (
      <React.Fragment key={`${keyPrefix}-${index}`}>{part}</React.Fragment>
    ),
  );
}

// ---------- AI: topic finder + cross references ----------
type RefHit = { ref: string; note: string };

function parseRefHits(raw: string): RefHit[] {
  const hits: RefHit[] = [];
  const seen = new Set<string>();
  for (const line of raw.replace(/\r/g, '').split('\n')) {
    const m = line.match(/\b((?:[1-3]\s?)?[A-Za-z][A-Za-z ]+?)\s+(\d{1,3}):(\d{1,3})\b/);
    if (!m) continue;
    const ref = `${m[1].trim()} ${m[2]}:${m[3]}`;
    const key = ref.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const note = line
      .slice((m.index ?? 0) + m[0].length)
      .replace(/^[\s—:.\-–)]+/, '')
      .trim();
    hits.push({ ref, note });
    if (hits.length >= 10) break;
  }
  return hits;
}

function buildTopicPrompt(topic: string): string {
  return [
    `List 8 well-known Bible verses about "${topic}".`,
    'Respond as a plain list, one verse per line, in EXACTLY this format:',
    'Book Chapter:Verse — short note',
    'Use standard English book names (e.g. "John 3:16", "1 Corinthians 13:4").',
    'No headings, no numbering, no extra commentary.',
  ].join('\n');
}

function buildRelatedPrompt(verse: BibleVerse): string {
  return [
    `Give 6 cross-reference Bible verses closely related to ${verse.englishRef}.`,
    `Verse text: "${verse.text}"`,
    'Respond as a plain list, one per line, in EXACTLY this format:',
    'Book Chapter:Verse — short note',
    'Use standard English book names. No headings or numbering.',
  ].join('\n');
}

function buildFollowupPrompt(verse: BibleVerse, languageLabel: string, question: string): string {
  return [
    'You are a faithful Bible study assistant answering a follow-up question about a verse.',
    `Answer in ${languageLabel}. Be concise (under 150 words) and do not invent quotations.`,
    '',
    `Verse: ${verse.englishRef} — "${verse.text}"`,
    `Question: ${question}`,
  ].join('\n');
}

// ---------- Clipboard / share / speech ----------
const SPEECH_LANG: Record<string, string> = {
  english: 'en-US',
  tamil: 'ta-IN',
  hindi: 'hi-IN',
  telugu: 'te-IN',
  malayalam: 'ml-IN',
};

function verseToText(verse: BibleVerse): string {
  return `${verse.text}\n— ${verse.ref}`;
}

async function copyVerseText(verse: BibleVerse): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(verseToText(verse));
    return true;
  } catch {
    return false;
  }
}

async function shareVerse(verse: BibleVerse, theme: Theme, ratio: Ratio): Promise<void> {
  const text = verseToText(verse);
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  // Try sharing the verse image when supported, otherwise share text.
  const canvas = renderVerseCanvas(verse, theme, ratio);
  if (canvas && nav.canShare) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) {
      const file = new File([blob], `${verse.englishRef.replace(/[\s:]+/g, '-')}.png`, {
        type: 'image/png',
      });
      if (nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: verse.ref, text });
          return;
        } catch {
          /* user cancelled or share failed; fall through */
        }
      }
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: verse.ref, text });
      return;
    } catch {
      /* cancelled */
      return;
    }
  }
  await navigator.clipboard.writeText(text).catch(() => {});
}

function App() {
  const stored = useMemo(loadStore, []);
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [bibles, setBibles] = useState<Record<string, BibleData>>({});
  const [state, setState] = useState<FilterState>(initialFilterState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [focused, setFocused] = useState<BibleVerse | null>(null);
  const [panel, setPanel] = useState<'none' | 'ai' | 'compare' | 'related'>('none');
  const [ai, setAi] = useState<AiState>(emptyAi);
  const [compare, setCompare] = useState<CompareState>(emptyCompare);
  const [fullView, setFullView] = useState(false);
  const [theme, setTheme] = useState<Theme>(
    THEMES.find((t) => t.id === stored.themeId) ?? THEMES[0],
  );

  // New: personalization + saved + reading + share/AI extras
  const [dark, setDark] = useState<boolean>(stored.dark ?? false);
  const [fontScale, setFontScale] = useState<number>(stored.fontScale ?? 1);
  const [bookmarks, setBookmarks] = useState<SavedVerse[]>(stored.bookmarks ?? []);
  const [recent, setRecent] = useState<SavedVerse[]>(stored.recent ?? []);
  const [savedOpen, setSavedOpen] = useState(false);
  const [reading, setReading] = useState<{ book: number; chapter: number } | null>(null);
  const [pngRatio, setPngRatio] = useState<Ratio>('square');
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [related, setRelated] = useState<{ loading: boolean; hits: RefHit[]; error: string }>({
    loading: false,
    hits: [],
    error: '',
  });
  const [chat, setChat] = useState<{ turns: { q: string; a: string }[]; input: string; loading: boolean; error: string }>(
    { turns: [], input: '', loading: false, error: '' },
  );
  const [topic, setTopic] = useState<{ q: string; loading: boolean; hits: RefHit[]; error: string }>(
    { q: '', loading: false, hits: [], error: '' },
  );

  const fullRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const didMountRef = useRef(false);

  // Preload speech-synthesis voices (they populate asynchronously in Chrome).
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const warm = () => window.speechSynthesis.getVoices();
    warm();
    window.speechSynthesis.addEventListener('voiceschanged', warm);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', warm);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      try {
        setLoading(true);
        const response = await fetch('/data/bibles/manifest.json');
        if (!response.ok) {
          throw new Error('Bible JSON is missing. Run npm run download:bibles first.');
        }
        const nextManifest = (await response.json()) as BibleManifest;
        if (cancelled) return;
        setManifest(nextManifest);
        const first = nextManifest.languages[0];
        const data = await fetchLanguage(first);
        if (!cancelled) setBibles((current) => ({ ...current, [data.id]: data }));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load Bible data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadManifest();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!manifest) return;
    const language = manifest.languages.find((item) => item.id === state.languageId);
    if (!language || bibles[language.id]) return;

    let cancelled = false;
    setLoading(true);
    fetchLanguage(language)
      .then((data) => {
        if (!cancelled) setBibles((current) => ({ ...current, [data.id]: data }));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load Bible data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bibles, manifest, state.languageId]);

  const selectedBible = bibles[state.languageId];
  const selectedLanguage = manifest?.languages.find((language) => language.id === state.languageId);
  const chapters = useMemo(
    () => chaptersForBook(selectedBible, state.bookIndex),
    [selectedBible, state.bookIndex],
  );
  const verses = useMemo(
    () => versesForChapter(selectedBible, state.bookIndex, state.chapter),
    [selectedBible, state.bookIndex, state.chapter],
  );
  const results = useMemo(() => filterVerses(selectedBible, state), [selectedBible, state]);
  const visibleResults = useMemo(() => resultWindow(results), [results]);

  const singleResult = results.length === 1 ? results[0] : null;
  const heroVerse = focused ?? singleResult;

  // Reset the explanation panel whenever the focused verse changes.
  useEffect(() => {
    setPanel('none');
    setAi(emptyAi);
    setCompare(emptyCompare);
    setRelated({ loading: false, hits: [], error: '' });
    setChat({ turns: [], input: '', loading: false, error: '' });
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [heroVerse?.id, state.languageId]);

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function selectLanguage(languageId: BibleLanguageId) {
    setFocused(null);
    setState((current) => ({ ...current, languageId }));
  }

  function onReferenceChange(text: string) {
    setFocused(null);
    setState((current) => {
      const next: FilterState = { ...current, referenceCode: text };
      const parsed = parseReferenceCode(text);
      if (parsed) {
        if (parsed.bookQuery) {
          const query = parsed.bookQuery.trim().toLocaleLowerCase();
          const book =
            selectedBible?.books.find(
              (item) =>
                item.name.toLocaleLowerCase() === query ||
                item.englishName.toLocaleLowerCase() === query,
            ) ??
            selectedBible?.books.find(
              (item) =>
                item.name.toLocaleLowerCase().startsWith(query) ||
                item.englishName.toLocaleLowerCase().startsWith(query),
            );
          if (book) next.bookIndex = String(book.index);
        }
        next.chapter = parsed.chapter != null ? String(parsed.chapter) : '';
        next.verse = parsed.verse != null ? String(parsed.verse) : '';
      }
      return next;
    });
  }

  function clearFilters() {
    setFocused(null);
    setState({
      languageId: state.languageId,
      bookIndex: '',
      chapter: '',
      verse: '',
      testament: 'all',
      searchText: '',
      referenceCode: '',
      exactVerseOnly: true,
    });
  }

  function openFullView(verse?: BibleVerse) {
    if (verse) setFocused(verse);
    setFullView(true);
    const root = document.documentElement;
    if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
  }

  function closeFullView() {
    setFullView(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  // Esc to close + keep state in sync if the user exits fullscreen via the browser.
  useEffect(() => {
    if (!fullView) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setFullView(false);
    }
    function onFsChange() {
      if (!document.fullscreenElement) setFullView(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [fullView]);

  // Close full view if the verse goes away (e.g. filters change).
  useEffect(() => {
    if (!heroVerse && fullView) closeFullView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroVerse]);

  // Bring the verse into view when one is opened from the results list (mobile-friendly).
  useEffect(() => {
    if (focused && heroRef.current) {
      heroRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focused]);

  // Live preview of the downloadable image — reflects ratio + theme + verse.
  useEffect(() => {
    const canvas = previewRef.current;
    if (!heroVerse || !canvas) return;
    if (!paintVerseCanvas(canvas, heroVerse, theme, pngRatio)) return;
    const { w, h } = RATIO_SIZES[pngRatio];
    const maxW = 380;
    const maxH = 320;
    const scale = Math.min(maxW / w, maxH / h, 1);
    canvas.style.width = `${Math.round(w * scale)}px`;
    canvas.style.height = `${Math.round(h * scale)}px`;
  }, [heroVerse?.id, theme.id, pngRatio]);

  // On small screens the filter bar fills the viewport, so scroll the results into
  // view once a filter is applied. Debounced so typing a search doesn't jump per key.
  useEffect(() => {
    // Skip the very first render (initial load) so we don't scroll past the filters.
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (typeof window === 'undefined' || window.innerWidth > 760) return;
    if (!hasActiveFilters(state) || (!results.length && !heroVerse)) return;

    const timer = setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
    return () => clearTimeout(timer);
  }, [
    results.length,
    heroVerse,
    state.referenceCode,
    state.bookIndex,
    state.chapter,
    state.verse,
    state.searchText,
    state.testament,
  ]);

  // ---------- Persistence ----------
  useEffect(() => saveStore({ themeId: theme.id }), [theme.id]);
  useEffect(() => saveStore({ fontScale }), [fontScale]);
  useEffect(() => saveStore({ bookmarks }), [bookmarks]);
  useEffect(() => saveStore({ recent }), [recent]);
  useEffect(() => saveStore({ languageId: state.languageId, lastState: state }), [state]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    saveStore({ dark });
  }, [dark]);

  // Register the service worker (production builds only) for offline / installable PWA.
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Track recently viewed verses.
  useEffect(() => {
    if (!heroVerse) return;
    const entry: SavedVerse = {
      ...heroVerse,
      languageId: state.languageId,
      label: selectedLanguage?.label ?? '',
    };
    setRecent((cur) => [
      entry,
      ...cur.filter((v) => !(v.id === entry.id && v.languageId === entry.languageId)),
    ].slice(0, 30));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroVerse?.id, state.languageId]);

  // Stop speech when the verse changes or component updates away.
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [heroVerse?.id]);

  // ---------- Bookmarks ----------
  function isBookmarked(verse: BibleVerse, langId: string): boolean {
    return bookmarks.some((b) => b.id === verse.id && b.languageId === langId);
  }
  function toggleBookmark(verse: BibleVerse, langId: string, label: string) {
    setBookmarks((cur) => {
      const exists = cur.some((b) => b.id === verse.id && b.languageId === langId);
      if (exists) return cur.filter((b) => !(b.id === verse.id && b.languageId === langId));
      return [{ ...verse, languageId: langId, label }, ...cur];
    });
  }

  // ---------- Navigation ----------
  function goVerse(dir: 1 | -1) {
    if (!heroVerse) return;
    const next = adjacentVerse(selectedBible, heroVerse, dir);
    if (next) setFocused(next);
  }
  function goChapter(dir: 1 | -1) {
    if (!heroVerse) return;
    const next = adjacentChapter(selectedBible, heroVerse, dir);
    if (next) setFocused(next);
  }

  // ---------- Reading mode ----------
  function openReading(verse: BibleVerse) {
    setReading({ book: verse.book, chapter: verse.chapter });
  }
  function readingStep(dir: 1 | -1) {
    if (!reading) return;
    const first = chapterVerses(selectedBible, reading.book, reading.chapter)[0];
    if (!first) return;
    const next = adjacentChapter(selectedBible, first, dir);
    if (next) setReading({ book: next.book, chapter: next.chapter });
  }

  // ---------- Share / copy / speak ----------
  async function doCopy(verse: BibleVerse) {
    if (await copyVerseText(verse)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }
  function speak(verse: BibleVerse) {
    if (!('speechSynthesis' in window)) {
      setError('Read aloud is not supported in this browser.');
      return;
    }
    const synth = window.speechSynthesis;
    if (speaking || synth.speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();

    const utter = new SpeechSynthesisUtterance(verse.text);
    const lang = SPEECH_LANG[state.languageId] || 'en-US';
    const base = lang.slice(0, 2).toLowerCase();
    const voices = synth.getVoices();
    const match =
      voices.find((v) => v.lang && v.lang.toLowerCase() === lang.toLowerCase()) ||
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(base));
    if (match) utter.voice = match;
    utter.lang = match?.lang || lang;
    utter.rate = 0.95;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);

    // Keep a reference so Chrome doesn't garbage-collect the utterance mid-speech.
    utterRef.current = utter;
    setSpeaking(true);
    // Chrome sometimes leaves the queue paused; resume defensively.
    synth.resume();
    synth.speak(utter);
  }

  // ---------- AI: follow-up chat + related + topic finder ----------
  async function askFollowup(verse: BibleVerse) {
    const question = chat.input.trim();
    if (!question || chat.loading) return;
    setChat((c) => ({ ...c, loading: true, error: '' }));
    try {
      const answer = await fetchAiExplanation(
        buildFollowupPrompt(verse, selectedLanguage?.label ?? 'English', question),
      );
      setChat((c) => ({ turns: [...c.turns, { q: question, a: answer }], input: '', loading: false, error: '' }));
    } catch (err) {
      setChat((c) => ({ ...c, loading: false, error: err instanceof Error ? err.message : 'Failed.' }));
    }
  }
  async function runRelated(verse: BibleVerse) {
    setPanel('related');
    if (related.hits.length || related.loading) return;
    setRelated({ loading: true, hits: [], error: '' });
    try {
      const hits = parseRefHits(await fetchAiExplanation(buildRelatedPrompt(verse)));
      setRelated({ loading: false, hits, error: hits.length ? '' : 'No related verses found.' });
    } catch (err) {
      setRelated({ loading: false, hits: [], error: err instanceof Error ? err.message : 'Failed.' });
    }
  }
  async function runTopic() {
    const q = topic.q.trim();
    if (!q || topic.loading) return;
    setTopic((t) => ({ ...t, loading: true, hits: [], error: '' }));
    try {
      const hits = parseRefHits(await fetchAiExplanation(buildTopicPrompt(q)));
      setTopic((t) => ({ ...t, loading: false, hits, error: hits.length ? '' : 'No verses found.' }));
    } catch (err) {
      setTopic((t) => ({ ...t, loading: false, error: err instanceof Error ? err.message : 'Failed.' }));
    }
  }
  function jumpToRef(ref: string) {
    setSavedOpen(false);
    setReading(null);
    onReferenceChange(ref);
  }
  function openSavedVerse(saved: SavedVerse) {
    setSavedOpen(false);
    if (saved.languageId !== state.languageId) {
      setState((cur) => ({ ...cur, languageId: saved.languageId }));
    }
    setFocused(saved);
  }

  async function fetchLanguage(language: LanguageManifest): Promise<BibleData> {
    const response = await fetch(language.file);
    if (!response.ok) throw new Error(`${language.label} Bible JSON failed to load.`);
    return (await response.json()) as BibleData;
  }

  async function runAiExplanation(verse: BibleVerse) {
    setPanel('ai');
    if (ai.text || ai.loading) return;
    setAi({ loading: true, text: '', error: '' });
    try {
      const text = await fetchAiExplanation(
        buildExplainPrompt(verse, selectedLanguage?.label ?? 'English'),
      );
      setAi({ loading: false, text, error: '' });
    } catch (err) {
      setAi({
        loading: false,
        text: '',
        error: err instanceof Error ? err.message : 'AI explanation failed. Please try again.',
      });
    }
  }

  async function runCompare(verse: BibleVerse) {
    setPanel('compare');
    if (compare.rows.length || compare.loading || !manifest) return;
    setCompare({ loading: true, rows: [], error: '' });
    try {
      const map: Record<string, BibleData> = { ...bibles };
      await Promise.all(
        manifest.languages.map(async (language) => {
          if (map[language.id]) return;
          const data = await fetchLanguage(language);
          map[language.id] = data;
        }),
      );
      setBibles(map);
      const rows: CompareRow[] = manifest.languages.map((language) => {
        const match = map[language.id]?.verses.find((item) => item.id === verse.id);
        return {
          id: language.id,
          label: language.label,
          nativeRef: match?.ref ?? verse.englishRef,
          text: match?.text ?? '—',
        };
      });
      setCompare({ loading: false, rows, error: '' });
    } catch (err) {
      setCompare({
        loading: false,
        rows: [],
        error: err instanceof Error ? err.message : 'Could not load all languages.',
      });
    }
  }

  return (
    <main
      className={`app-shell${dark ? ' dark' : ''}`}
      style={
        {
          '--theme-a': theme.a,
          '--theme-b': theme.b,
          '--theme-c': theme.c,
          '--theme-accent': theme.accent,
          '--theme-sub': theme.sub,
          '--reader-scale': fontScale,
        } as React.CSSProperties
      }
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-badge">
            <BookOpen size={18} />
          </span>
          Smart Bible
        </div>
        <div className="topbar-tools">
          <div className="font-control" title="Text size">
            <Type size={15} />
            <input
              aria-label="Text size"
              max={1.5}
              min={0.85}
              onChange={(event) => setFontScale(Number(event.target.value))}
              step={0.05}
              type="range"
              value={fontScale}
            />
          </div>
          <button
            className={`tool-button ${savedOpen ? 'active' : ''}`}
            onClick={() => setSavedOpen((v) => !v)}
            type="button"
          >
            <Heart size={16} />
            Saved
            {bookmarks.length > 0 && <span className="tool-badge">{bookmarks.length}</span>}
          </button>
          <button
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="tool-button icon-only"
            onClick={() => setDark((v) => !v)}
            title={dark ? 'Light mode' : 'Dark mode'}
            type="button"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <section className="topic-bar" aria-label="Find verses by topic">
        <div className="input-icon topic-input">
          <Sparkles size={18} />
          <input
            onChange={(event) => setTopic((t) => ({ ...t, q: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runTopic();
            }}
            placeholder="Find verses by topic — e.g. forgiveness, fear, hope"
            value={topic.q}
          />
        </div>
        <button className="topic-go" disabled={topic.loading} onClick={() => runTopic()} type="button">
          {topic.loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
          Find
        </button>
        {(topic.hits.length > 0 || topic.error) && (
          <div className="topic-results">
            {topic.error && <span className="topic-error">{topic.error}</span>}
            {topic.hits.map((hit) => (
              <button className="ref-chip" key={hit.ref} onClick={() => jumpToRef(hit.ref)} title={hit.note} type="button">
                {hit.ref}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="filter-bar" aria-label="Bible filters">
        <div className="language-grid" role="group" aria-label="Languages">
          {manifest?.languages.map((language) => (
            <button
              className={language.id === state.languageId ? 'active' : ''}
              key={language.id}
              onClick={() => selectLanguage(language.id)}
              type="button"
            >
              <Languages size={16} />
              {language.label}
            </button>
          ))}
        </div>

        <div className="filter-grid">
          <label className="field-reference">
            Reference
            <div className="input-icon">
              <Search size={18} />
              <input
                value={state.referenceCode}
                onChange={(event) => onReferenceChange(event.target.value)}
                placeholder="John 14:6 or 14:6"
              />
            </div>
          </label>

          <label className="field-book">
            Book
            <select
              value={state.bookIndex}
              onChange={(event) => {
                setFocused(null);
                setState((current) => ({
                  ...current,
                  bookIndex: event.target.value,
                  chapter: '',
                  verse: '',
                  referenceCode: '',
                }));
              }}
            >
              <option value="">All books</option>
              {selectedBible?.books.map((book) => (
                <option key={book.index} value={book.index}>
                  {book.name} / {book.englishName}
                </option>
              ))}
            </select>
          </label>

          <label className="field-chapter">
            Chapter
            <select
              value={state.chapter}
              onChange={(event) => {
                setFocused(null);
                setState((current) => ({
                  ...current,
                  chapter: event.target.value,
                  verse: '',
                  referenceCode: '',
                }));
              }}
              disabled={!chapters.length}
            >
              <option value="">Any</option>
              {chapters.map((chapter) => (
                <option key={chapter} value={chapter}>
                  {chapter}
                </option>
              ))}
            </select>
          </label>

          <label className="field-verse">
            Verse
            <select
              value={state.verse}
              onChange={(event) => {
                setFocused(null);
                setState((current) => ({
                  ...current,
                  verse: event.target.value,
                  referenceCode: '',
                }));
              }}
              disabled={!verses.length}
            >
              <option value="">Any</option>
              {verses.map((verse) => (
                <option key={verse} value={verse}>
                  {verse}
                </option>
              ))}
            </select>
          </label>

          <label className="field-search">
            Search words
            <input
              value={state.searchText}
              onChange={(event) => {
                setFocused(null);
                update('searchText', event.target.value);
              }}
              placeholder="love, தேவன், परमेश्वर..."
            />
          </label>

          <div className="field field-testament">
            <span className="field-label">Testament</span>
            <div className="segmented" role="group" aria-label="Testament">
              {[
                ['all', 'All'],
                ['old', 'Old'],
                ['new', 'New'],
              ].map(([value, label]) => (
                <button
                  className={state.testament === value ? 'active' : ''}
                  key={value}
                  onClick={() => {
                    setFocused(null);
                    update('testament', value as FilterState['testament']);
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="field field-actions">
            <label className="toggle">
              <input
                checked={state.exactVerseOnly}
                onChange={(event) => update('exactVerseOnly', event.target.checked)}
                type="checkbox"
              />
              Exact chapter:verse
            </label>
            <button className="clear-button" onClick={clearFilters} type="button">
              <X size={18} />
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="results" aria-live="polite" ref={resultsRef}>
        {savedOpen ? (
          <div className="panel-view">
            <div className="panel-head">
              <h2>
                <Heart size={18} /> Saved &amp; recent
              </h2>
              <button className="back-button" onClick={() => setSavedOpen(false)} type="button">
                <ArrowLeft size={18} /> Back
              </button>
            </div>
            {bookmarks.length === 0 && recent.length === 0 && (
              <div className="empty-state">
                <Heart size={34} />
                <p>No saved verses yet.</p>
                <span>Tap the heart on any verse to keep it here.</span>
              </div>
            )}
            {bookmarks.length > 0 && (
              <>
                <h3 className="panel-section-title">Bookmarks</h3>
                <div className="saved-list">
                  {bookmarks.map((v) => (
                    <div
                      className="saved-card"
                      key={`bm-${v.languageId}-${v.id}`}
                      onClick={() => openSavedVerse(v)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openSavedVerse(v);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <button
                        className="saved-heart on"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBookmark(v, v.languageId, v.label);
                        }}
                        title="Remove bookmark"
                        type="button"
                      >
                        <Heart size={15} fill="currentColor" />
                      </button>
                      <p className="saved-text">{v.text}</p>
                      <div className="saved-meta">
                        <span>{v.ref}</span>
                        <small>{v.label}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {recent.length > 0 && (
              <>
                <h3 className="panel-section-title">Recently viewed</h3>
                <div className="saved-list">
                  {recent.map((v) => (
                    <div
                      className="saved-card"
                      key={`rc-${v.languageId}-${v.id}`}
                      onClick={() => openSavedVerse(v)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openSavedVerse(v);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <button
                        className={`saved-heart ${isBookmarked(v, v.languageId) ? 'on' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBookmark(v, v.languageId, v.label);
                        }}
                        title="Bookmark"
                        type="button"
                      >
                        <Heart size={15} fill={isBookmarked(v, v.languageId) ? 'currentColor' : 'none'} />
                      </button>
                      <p className="saved-text">{v.text}</p>
                      <div className="saved-meta">
                        <span>{v.ref}</span>
                        <small>{v.label}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : reading ? (
          <div className="panel-view reading-view">
            <div className="panel-head">
              <h2>
                <BookText size={18} />{' '}
                {(() => {
                  const head = chapterVerses(selectedBible, reading.book, reading.chapter)[0];
                  return head ? `${head.bookName} ${reading.chapter}` : 'Chapter';
                })()}
              </h2>
              <button className="back-button" onClick={() => setReading(null)} type="button">
                <ArrowLeft size={18} /> Back
              </button>
            </div>
            <div className="reading-body">
              {chapterVerses(selectedBible, reading.book, reading.chapter).map((v) => (
                <p
                  className="reading-verse"
                  key={v.id}
                  onClick={() => {
                    setReading(null);
                    setFocused(v);
                  }}
                >
                  <sup>{v.verse}</sup> {v.text}
                </p>
              ))}
            </div>
            <div className="reading-nav">
              <button onClick={() => readingStep(-1)} type="button">
                <ChevronsLeft size={18} /> Prev chapter
              </button>
              <button onClick={() => readingStep(1)} type="button">
                Next chapter <ChevronsRight size={18} />
              </button>
            </div>
          </div>
        ) : (
        <>
        <div className="result-head">
          <div>
            <p className="eyebrow">{selectedLanguage?.label ?? 'Bible'}</p>
            <h2>
              {heroVerse ? 'Single verse' : `${results.length.toLocaleString()} verses found`}
            </h2>
          </div>
          <div className="stat">
            <BookOpen size={18} />
            {selectedBible?.verses.length.toLocaleString() ?? 0}
          </div>
        </div>

        {error && <div className="notice error">{error}</div>}
        {loading && <div className="notice">Loading local Bible JSON...</div>}

        {results.length > 0 && (
          <div className="theme-bar">
            <span className="theme-label">Card colour</span>
            <div className="theme-swatches" role="group" aria-label="Card colour">
              {THEMES.map((item) => (
                <button
                  aria-label={item.name}
                  className={`swatch ${item.id === theme.id ? 'active' : ''}`}
                  key={item.id}
                  onClick={() => setTheme(item)}
                  style={{ background: `linear-gradient(135deg, ${item.a}, ${item.c})` }}
                  title={item.name}
                  type="button"
                />
              ))}
            </div>
          </div>
        )}

        {!loading && !error && !results.length && (
          <div className="empty-state">
            <BookOpen size={34} />
            <p>Pick a language and a filter to begin.</p>
            <span>
              Try a reference like <strong>John 3:16</strong>, choose a Book / Chapter / Verse, or
              search a word.
            </span>
          </div>
        )}

        {/* ---------- Single verse hero (image-style card) ---------- */}
        {heroVerse && (
          <div className="hero-wrap" ref={heroRef}>
            <div className="hero-topbar">
              {focused ? (
                <button className="back-button" onClick={() => setFocused(null)} type="button">
                  <ArrowLeft size={18} />
                  Back to results
                </button>
              ) : (
                <span />
              )}
              <div className="verse-nav" role="group" aria-label="Navigate verses">
                <button onClick={() => goChapter(-1)} title="Previous chapter" type="button">
                  <ChevronsLeft size={18} />
                </button>
                <button onClick={() => goVerse(-1)} title="Previous verse" type="button">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => goVerse(1)} title="Next verse" type="button">
                  <ChevronRight size={18} />
                </button>
                <button onClick={() => goChapter(1)} title="Next chapter" type="button">
                  <ChevronsRight size={18} />
                </button>
              </div>
            </div>

            <article
              className={`verse-hero verse-hero--${pngRatio}`}
              onClick={() => openFullView()}
              role="button"
              tabIndex={0}
              title="Open full view"
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openFullView();
                }
              }}
            >
              <div className="hero-controls">
                <button
                  className={`hero-icon ${isBookmarked(heroVerse, state.languageId) ? 'on' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleBookmark(heroVerse, state.languageId, selectedLanguage?.label ?? '');
                  }}
                  title={isBookmarked(heroVerse, state.languageId) ? 'Remove bookmark' : 'Bookmark'}
                  type="button"
                >
                  <Heart
                    size={18}
                    fill={isBookmarked(heroVerse, state.languageId) ? 'currentColor' : 'none'}
                  />
                </button>
                <button
                  className="hero-icon"
                  onClick={(event) => {
                    event.stopPropagation();
                    downloadVersePng(heroVerse, theme, pngRatio);
                  }}
                  title="Download PNG"
                  type="button"
                >
                  <Download size={18} />
                </button>
                <button
                  className="hero-icon"
                  onClick={(event) => {
                    event.stopPropagation();
                    openFullView();
                  }}
                  title="Full view"
                  type="button"
                >
                  <Maximize2 size={18} />
                </button>
              </div>
              <p 
                className="verse-hero-text"
                style={{ fontSize: getHeroFontSize(heroVerse.text, pngRatio, fontScale) }}
              >
                {heroVerse.text}
              </p>
              <div className="verse-hero-ref">
                <span>{heroVerse.ref}</span>
                {heroVerse.ref !== heroVerse.englishRef && <small>{heroVerse.englishRef}</small>}
              </div>
            </article>

            <div className="ratio-row">
              <span className="ratio-label">Image size</span>
              <div className="segmented ratio-seg" role="group" aria-label="Image size">
                {([
                  ['square', 'Square'],
                  ['story', 'Story'],
                  ['wide', 'Wide'],
                ] as [Ratio, string][]).map(([value, label]) => (
                  <button
                    className={pngRatio === value ? 'active' : ''}
                    key={value}
                    onClick={() => setPngRatio(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>


            <div className="explain-actions">
              <button className="explain-button" onClick={() => openFullView()} type="button">
                <Maximize2 size={18} />
                Full view
              </button>
              <button
                className="explain-button"
                onClick={() => downloadVersePng(heroVerse, theme, pngRatio)}
                type="button"
              >
                <Download size={18} />
                Download PNG
              </button>
              <button className="explain-button" onClick={() => doCopy(heroVerse)} type="button">
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                className="explain-button"
                onClick={() => shareVerse(heroVerse, theme, pngRatio)}
                type="button"
              >
                <Share2 size={18} />
                Share
              </button>
              <button
                className={`explain-button ${speaking ? 'active' : ''}`}
                onClick={() => speak(heroVerse)}
                type="button"
              >
                {speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                {speaking ? 'Stop' : 'Read aloud'}
              </button>
              <button className="explain-button" onClick={() => openReading(heroVerse)} type="button">
                <BookText size={18} />
                Read chapter
              </button>
              <button
                className={`explain-button ${panel === 'ai' ? 'active' : ''}`}
                onClick={() => runAiExplanation(heroVerse)}
                type="button"
              >
                <Sparkles size={18} />
                AI explanation
              </button>
              <button
                className={`explain-button ${panel === 'related' ? 'active' : ''}`}
                onClick={() => runRelated(heroVerse)}
                type="button"
              >
                <Link2 size={18} />
                Related verses
              </button>
              <button
                className={`explain-button ${panel === 'compare' ? 'active' : ''}`}
                onClick={() => runCompare(heroVerse)}
                type="button"
              >
                <Languages size={18} />
                Compare languages
              </button>
            </div>

            {panel === 'ai' && (
              <div className="explain-panel explain-panel--ai">
                <div className="ai-head">
                  <span className="ai-head-badge">
                    <Sparkles size={18} />
                  </span>
                  <div className="ai-head-text">
                    <h3>AI explanation</h3>
                    <span className="ai-head-sub">
                      {heroVerse.englishRef} · {selectedLanguage?.label}
                    </span>
                  </div>
                </div>
                {ai.loading && (
                  <p className="explain-loading">
                    <Loader2 className="spin" size={18} /> Thinking through this verse…
                  </p>
                )}
                {ai.error && <p className="explain-error">{ai.error}</p>}
                {ai.text && <ExplanationContent text={ai.text} />}

                {ai.text && (
                  <div className="ai-chat">
                    {chat.turns.map((turn, index) => (
                      <div className="ai-turn" key={index}>
                        <p className="ai-q">{turn.q}</p>
                        <div className="ai-a">
                          <ExplanationContent text={turn.a} />
                        </div>
                      </div>
                    ))}
                    {chat.error && <p className="explain-error">{chat.error}</p>}
                    <div className="ai-ask">
                      <input
                        onChange={(event) => setChat((c) => ({ ...c, input: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') askFollowup(heroVerse);
                        }}
                        placeholder="Ask a follow-up question…"
                        value={chat.input}
                      />
                      <button
                        disabled={chat.loading || !chat.input.trim()}
                        onClick={() => askFollowup(heroVerse)}
                        title="Ask"
                        type="button"
                      >
                        {chat.loading ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {panel === 'related' && (
              <div className="explain-panel">
                <h3>
                  <Link2 size={16} /> Related verses
                </h3>
                {related.loading && (
                  <p className="explain-loading">
                    <Loader2 className="spin" size={18} /> Finding related verses…
                  </p>
                )}
                {related.error && <p className="explain-error">{related.error}</p>}
                <div className="topic-results">
                  {related.hits.map((hit) => (
                    <button
                      className="ref-chip"
                      key={hit.ref}
                      onClick={() => jumpToRef(hit.ref)}
                      title={hit.note}
                      type="button"
                    >
                      {hit.ref}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {panel === 'compare' && (
              <div className="explain-panel">
                <h3>
                  <Languages size={16} /> The same verse in every language
                </h3>
                {compare.loading && (
                  <p className="explain-loading">
                    <Loader2 className="spin" size={18} /> Loading all languages…
                  </p>
                )}
                {compare.error && <p className="explain-error">{compare.error}</p>}
                {compare.rows.map((row) => (
                  <div className="compare-row" key={row.id}>
                    <div className="compare-lang">
                      {row.label}
                      <small>{row.nativeRef}</small>
                    </div>
                    <p>{row.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------- Multi-result list ---------- */}
        {!heroVerse && results.length > 1 && (
          <div className="verse-list">
            {visibleResults.map((verse) => (
              <div
                className="verse-card"
                key={`${state.languageId}-${verse.id}`}
                onClick={() => setFocused(verse)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFocused(verse);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="card-controls">
                  <button
                    className={`card-icon ${isBookmarked(verse, state.languageId) ? 'on' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleBookmark(verse, state.languageId, selectedLanguage?.label ?? '');
                    }}
                    title="Bookmark"
                    type="button"
                  >
                    <Heart size={15} fill={isBookmarked(verse, state.languageId) ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="card-icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      downloadVersePng(verse, theme, pngRatio);
                    }}
                    title="Download PNG"
                    type="button"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    className="card-icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      openFullView(verse);
                    }}
                    title="Full view"
                    type="button"
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>
                <p className="card-text">
                  {state.searchText.trim()
                    ? highlightText(verse.text, state.searchText, verse.id)
                    : verse.text}
                </p>
                <div className="card-ref">
                  <span>{verse.ref}</span>
                  {verse.ref !== verse.englishRef && <small>{verse.englishRef}</small>}
                </div>
              </div>
            ))}
          </div>
        )}

        {!heroVerse && results.length > visibleResults.length && (
          <div className="notice">
            Showing first {visibleResults.length} verses. Add more filters to narrow the list.
          </div>
        )}
        </>
        )}
      </section>

      {fullView && heroVerse && (
        <div className="fullview-overlay" ref={fullRef} role="dialog" aria-modal="true">
          <div className="fullview-controls">
            <button
              className={`fullview-icon ${isBookmarked(heroVerse, state.languageId) ? 'on' : ''}`}
              onClick={() => toggleBookmark(heroVerse, state.languageId, selectedLanguage?.label ?? '')}
              title="Bookmark"
              type="button"
            >
              <Heart size={22} fill={isBookmarked(heroVerse, state.languageId) ? 'currentColor' : 'none'} />
            </button>
            <button
              className="fullview-icon"
              onClick={() => downloadVersePng(heroVerse, theme, pngRatio)}
              title="Download as PNG"
              type="button"
            >
              <Download size={22} />
            </button>
            <button className="fullview-icon" onClick={closeFullView} title="Close (Esc)" type="button">
              <X size={22} />
            </button>
          </div>
          <div className="fullview-inner">
              <p 
                className="fullview-text"
                style={{ fontSize: getFullviewFontSize(heroVerse.text, fontScale) }}
              >
                {heroVerse.text}
              </p>
            <div className="fullview-ref">
              <span>{heroVerse.ref}</span>
              {heroVerse.ref !== heroVerse.englishRef && <small>{heroVerse.englishRef}</small>}
            </div>
          </div>
          <div className="fullview-nav">
            <button onClick={() => goVerse(-1)} title="Previous verse" type="button">
              <ChevronLeft size={26} />
            </button>
            <button onClick={() => goVerse(1)} title="Next verse" type="button">
              <ChevronRight size={26} />
            </button>
          </div>
          <p className="fullview-hint">← / → verse · Esc to exit</p>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
