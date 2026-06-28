# Smart Bible

A fast, mobile-friendly Bible reader and verse filter built with **React + TypeScript + Vite**.
Read and filter the whole Bible in **English, Tamil, Malayalam, Telugu, and Hindi**.

## Features

- **Multi-language** – full Bible (66 books, ~31,000 verses) in 5 languages, bundled locally as JSON.
- **Powerful filters** – by Book / Chapter / Verse, testament (Old/New), word search (with match highlighting), or a reference code like `John 14:6` or `14:6`.
- **Single-verse view** – shows the verse on a shareable gradient card, with 8 selectable colour themes.
- **Verse navigation** – step prev/next verse or chapter without leaving the verse.
- **Chapter reading mode** – read a whole chapter as flowing text, like a real Bible page.
- **Full view** – fullscreen, distraction-free display (great for projecting).
- **Download / Share as PNG** – export any verse as an image (square / story / wide), or share via the device share sheet.
- **Copy & read aloud** – copy the verse text, or have it read out with speech synthesis.
- **Bookmarks & history** – save favourite verses and revisit recently viewed ones (stored locally).
- **Personalize** – dark mode, text-size control, and remembered last language / theme / verse.
- **AI explanation** – a written explanation (Meaning / Context / Application) in the selected language, with follow-up questions.
- **Find verses by topic** – type a theme (e.g. *forgiveness*) and jump to AI-suggested references; plus related cross-references for any verse.
- **Compare languages** – see the same verse in all five languages side by side.
- **Installable PWA** – add to home screen and use offline.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Download & bundle the Bible JSON locally (one-time)
npm run download:bibles

# 3. Start the dev server
npm run dev
```

Then open the printed local URL (default http://localhost:5173/).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run preview` | Preview the production build |
| `npm run download:bibles` | Fetch and bundle the Bible JSON into `public/data/bibles/` |

## Data sources

- English (KJV): [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv)
- Tamil / Malayalam / Telugu / Hindi: [godlytalias/Bible-Database](https://github.com/godlytalias/Bible-Database)

## Tech

- React 19, TypeScript, Vite 6
- `lucide-react` for icons
- PNG export via the Canvas API (no extra dependencies)
