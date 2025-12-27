# Audiio UI Redesign Plan

## Overview
Comprehensive redesign of Discover, Album, and Artist pages to fix:
- Poor visual hierarchy
- Inconsistent styling
- Outdated look
- Visual clutter

Style direction: Modern Minimal + Rich Immersive + Glassmorphic + Editorial

---

## Phase 1: Design System Foundation

### 1.1 Update CSS Variables (`styles.css`)
- **Typography**: Larger editorial scale (up to 72px for heroes)
- **Spacing**: Add larger values (5xl-7xl: 80-160px) for breathing room
- **Glass system**: Refined blur levels and opacity values
- **Dynamic colors**: `--ambient-primary/secondary/glow` from artwork
- **Transitions**: New presets (micro, standard, emphasized, dramatic)

### 1.2 New Visual Hierarchy System
- `--text-hero`: Pure white for hero titles
- `--text-primary`: Main content
- `--text-secondary`: Supporting text
- `--text-tertiary`: Metadata
- `--text-muted`: Least important

---

## Phase 2: Discover Page Redesign

### 2.1 Reduce Sections (17 → 8 core types)
**Keep:**
- `hero` - Featured content (redesigned)
- `horizontal` - Standard scroll row
- `compact-list` - Jump back in
- `quick-mix` - Mood pills
- `grid` - Discovery grid (merged with masonry)
- `genre-explorer` - Genre navigation

**Remove/Consolidate:**
- Remove: banner, mood-gradient, lyrics-highlight
- Merge: stacked-cards + mini-player → quick-sample
- Merge: playlist-carousel + weekly-rotation → curated-collections

### 2.2 Hero Section Redesign
- Full-bleed layout with blurred artwork ambient background
- Larger artwork (280px) with glass shadow
- Dramatic typography (56px title)
- Prominent play button with glow

### 2.3 Section Headers
- Cleaner design with subtle border
- Personalized indicator as small dot
- Uppercase "See All" link

### 2.4 Track Cards
- Glass background with subtle border
- Hover: lift + glow effect
- Tighter info layout

---

## Phase 3: Album Page Redesign

### 3.1 Immersive Hero
- Fixed ambient background (blurred artwork, 60vh)
- Larger artwork (320px) with reflection effect
- Editorial layout: artwork left, info right
- Type badge, meta row with dots separator

### 3.2 Modern Track List
- Glass container with rounded corners
- Clean 3-column grid (number, info, duration)
- Playing state: ambient color highlight
- Hover: subtle background change

### 3.3 Footer
- Cleaner credits section
- "Show Credits" pill button

---

## Phase 4: Artist Page Redesign

### 4.1 Magazine-Style Hero
- Full-width hero image (500px min-height)
- Gradient overlay from transparent to bg
- Massive name (72px, 900 weight)
- Genre cloud with glass pills
- Action buttons at bottom

### 4.2 Editorial Bio Section
- Centered, max-width 700px
- Italic quote style with decorative quote mark
- "Read more" link

### 4.3 Refined Sections
- Popular tracks: cleaner rows with hover play
- Discography tabs: pill-style tab buttons
- Album grid: consistent card design

---

## Phase 5: Shared Components

### 5.1 StickyHeader
- Smoother parallax
- Glass background when collapsed
- Dynamic accent color

### 5.2 Cards (Album/Artist)
- Glass subtle background
- Hover: lift + shadow + play button reveal
- Artist cards: circular image

### 5.3 Genre Tags
- Pill style with glass variant for dark backgrounds

---

## Implementation Order

1. **CSS Variables** - Foundation updates
2. **HeroSection.tsx** - Discover hero redesign
3. **Track cards & section headers** - Discover polish
4. **AlbumDetailView.tsx** - Album page hero + track list
5. **ArtistDetailView.tsx** - Artist page hero + bio
6. **StickyHeader.tsx** - Shared header improvements
7. **Section consolidation** - Remove/merge discover sections

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `styles.css` | CSS variables, all component styles |
| `HeroSection.tsx` | Complete redesign |
| `AlbumDetailView.tsx` | Hero, track list, footer |
| `ArtistDetailView.tsx` | Hero, bio, sections |
| `StickyHeader.tsx` | Glass effect, parallax |
| `section-definitions.ts` | Reduce section count |
| `Discover.tsx` | Simplified section zones |
