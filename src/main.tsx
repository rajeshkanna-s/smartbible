import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  BookOpen,
  Download,
  Languages,
  Loader2,
  Maximize2,
  Search,
  Sparkles,
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

function downloadVersePng(verse: BibleVerse, theme: Theme) {
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, theme.a);
  bg.addColorStop(0.55, theme.b);
  bg.addColorStop(1, theme.c);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  const maxWidth = size - 220;
  const zoneTop = 130;
  const zoneBottom = size - 300;
  const zoneHeight = zoneBottom - zoneTop;
  const lineRatio = 1.45;

  // Shrink the font until the wrapped text fits the available zone.
  let fontSize = 72;
  let lines: string[] = [];
  while (fontSize > 24) {
    ctx.font = `700 ${fontSize}px ${PNG_FONT}`;
    lines = wrapCanvasLines(ctx, verse.text, maxWidth);
    if (lines.length * fontSize * lineRatio <= zoneHeight) break;
    fontSize -= 3;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${fontSize}px ${PNG_FONT}`;
  const lineHeight = fontSize * lineRatio;
  const blockHeight = lines.length * lineHeight;
  let y = zoneTop + (zoneHeight - blockHeight) / 2 + lineHeight / 2;
  for (const line of lines) {
    ctx.fillText(line, size / 2, y);
    y += lineHeight;
  }

  ctx.fillStyle = theme.accent;
  ctx.font = `800 46px ${PNG_FONT}`;
  ctx.fillText(verse.ref, size / 2, size - 188);

  ctx.fillStyle = theme.sub;
  ctx.font = `700 32px ${PNG_FONT}`;
  ctx.fillText(verse.englishRef, size / 2, size - 128);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = `700 26px ${PNG_FONT}`;
  ctx.fillText('Smart Bible', size / 2, size - 62);

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

function App() {
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [bibles, setBibles] = useState<Record<string, BibleData>>({});
  const [state, setState] = useState<FilterState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [focused, setFocused] = useState<BibleVerse | null>(null);
  const [panel, setPanel] = useState<'none' | 'ai' | 'compare'>('none');
  const [ai, setAi] = useState<AiState>(emptyAi);
  const [compare, setCompare] = useState<CompareState>(emptyCompare);
  const [fullView, setFullView] = useState(false);
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  const fullRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const didMountRef = useRef(false);

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
      className="app-shell"
      style={
        {
          '--theme-a': theme.a,
          '--theme-b': theme.b,
          '--theme-c': theme.c,
          '--theme-accent': theme.accent,
          '--theme-sub': theme.sub,
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
      </header>

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
            {focused && (
              <button className="back-button" onClick={() => setFocused(null)} type="button">
                <ArrowLeft size={18} />
                Back to results
              </button>
            )}

            <article
              className="verse-hero"
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
                  className="hero-icon"
                  onClick={(event) => {
                    event.stopPropagation();
                    downloadVersePng(heroVerse, theme);
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
              <p className="verse-hero-text">{heroVerse.text}</p>
              <div className="verse-hero-ref">
                <span>{heroVerse.ref}</span>
                <small>{heroVerse.englishRef}</small>
              </div>
            </article>

            <div className="explain-actions">
              <button className="explain-button" onClick={() => openFullView()} type="button">
                <Maximize2 size={18} />
                Full view
              </button>
              <button
                className="explain-button"
                onClick={() => downloadVersePng(heroVerse, theme)}
                type="button"
              >
                <Download size={18} />
                Download PNG
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
                    className="card-icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      downloadVersePng(verse, theme);
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
                <p className="card-text">{verse.text}</p>
                <div className="card-ref">
                  <span>{verse.ref}</span>
                  <small>{verse.englishRef}</small>
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
      </section>

      {fullView && heroVerse && (
        <div className="fullview-overlay" ref={fullRef} role="dialog" aria-modal="true">
          <div className="fullview-controls">
            <button
              className="fullview-icon"
              onClick={() => downloadVersePng(heroVerse, theme)}
              title="Download as PNG"
              type="button"
            >
              <Download size={22} />
            </button>
            <button
              className="fullview-icon"
              onClick={closeFullView}
              title="Close (Esc)"
              type="button"
            >
              <X size={22} />
            </button>
          </div>
          <div className="fullview-inner">
            <p className="fullview-text">{heroVerse.text}</p>
            <div className="fullview-ref">
              <span>{heroVerse.ref}</span>
              <small>{heroVerse.englishRef}</small>
            </div>
          </div>
          <p className="fullview-hint">Press Esc or tap ✕ to exit</p>
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
