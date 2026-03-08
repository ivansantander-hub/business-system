# Design System

This document describes the visual design system used across SGC, including colors, typography, spacing, component classes, and dark mode.

## Color Palette

### Primary (Violet)

The primary accent color for buttons, links, and highlights.

| Token | Hex | Usage |
|-------|-----|-------|
| `violet-500` | #7c3aed | Primary buttons, accents |
| `violet-600` | #6d28d9 | Hover states |
| `violet-400` | #a78bfa | Light accents |

### Neutral (Slate)

Used for text, borders, and backgrounds.

| Token | Light | Dark |
|-------|------|------|
| Text primary | `slate-900` | `slate-100` |
| Text muted | `slate-500` | `slate-400` |
| Border | `slate-200` | `slate-700` / `slate-800` |
| Background | `slate-50` | `#0a0e1a` |

### Semantic Colors

| Purpose | Light | Dark |
|---------|-------|------|
| Success | `emerald-50` / `emerald-700` | `emerald-500/10` / `emerald-400` |
| Danger | `red-50` / `red-700` | `red-500/10` / `red-400` |
| Warning | `amber-50` / `amber-700` | `amber-500/10` / `amber-400` |
| Info | `blue-50` / `blue-700` | `blue-500/10` / `blue-400` |

### Custom Surface Tokens (Tailwind)

Defined in `tailwind.config.ts`:

| Token | Light | Dark |
|-------|-------|------|
| `surface` | #ffffff | #0a0e1a |
| `panel` | #f8fafc | #111827 |
| `card` | #ffffff | #1a1f2e |
| `sidebar` | #0f1629 | #0f1629 |
| `accent` | #7c3aed | (same) |
| `accent.hover` | #6d28d9 | — |
| `accent.light` | #a78bfa | — |
| `accent.muted` | rgba(124,58,237,0.15) | — |
| `border` | #e2e8f0 | #1e293b |

---

## Typography

### Font Family

- **Primary:** Inter (Google Fonts), fallback: system-ui, -apple-system, sans-serif
- **Monospace:** ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas

Loaded in `globals.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
```

### Size Scale

| Token | Size | Line Height | Usage |
|-------|------|--------------|-------|
| `text-xs` | 0.75rem | — | Badges, captions |
| `text-sm` | 0.875rem | — | Body, form labels |
| `text-base` | 1rem | — | Default body |
| `text-lg` | 1.125rem | — | Subheadings |
| `text-xl` | 1.25rem | — | Section titles |
| `text-2xl` | 1.5rem | — | Page titles |
| `text-3xl` | 1.875rem | — | Hero text |
| `text-4xl` | 2.25rem | — | Display |

### Font Weights

- `font-normal` (400)
- `font-medium` (500)
- `font-semibold` (600)
- `font-bold` (700)
- `font-extrabold` (800)

---

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `0.5` | 0.125rem (2px) | Tight gaps |
| `1` | 0.25rem (4px) | Icon padding |
| `1.5` | 0.375rem (6px) | Small gaps |
| `2` | 0.5rem (8px) | — |
| `2.5` | 0.625rem (10px) | — |
| `3` | 0.75rem (12px) | — |
| `3.5` | 0.875rem (14px) | — |
| `4` | 1rem (16px) | Default padding |
| `5` | 1.25rem (20px) | — |
| `6` | 1.5rem (24px) | Card padding |
| `8` | 2rem (32px) | Section spacing |
| `10`–`24` | 2.5rem–6rem | Layout |

---

## Component Classes

Defined in `src/app/globals.css` under `@layer components`.

### Buttons

| Class | Description |
|-------|-------------|
| `btn-primary` | Gradient accent, white text, glow |
| `btn-secondary` | White/slate-800, border |
| `btn-danger` | Red gradient |
| `btn-success` | Emerald gradient |
| `btn-ghost` | Transparent, hover bg |

Common: `rounded-xl`, `px-4 py-2.5`, `text-sm font-semibold`, `focus-visible:ring-2`, `active:scale-[0.98]`, `disabled:opacity-50`.

### Form Inputs

| Class | Description |
|-------|-------------|
| `input-field` | Full-width input/select/textarea: `rounded-xl`, `px-3.5 py-2.5`, `border`, `focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500`, dark mode variants |

### Cards

| Class | Description |
|-------|-------------|
| `card` | White/dark card, rounded-2xl, border, shadow |
| `card-hover` | Card + hover shadow/border |
| `card-interactive` | Card-hover + cursor-pointer, active scale |
| `card-accent` | Gradient background (violet tint) |
| `stat-card` | Metric card with border |
| `stat-card-accent` | Full gradient, white text |

### Tables

| Class | Description |
|-------|-------------|
| `table-header` | Header cell: `text-xs font-semibold uppercase tracking-wider`, `bg-slate-50/80` (dark: `bg-slate-800/50`) |
| `table-cell` | Body cell: `px-4 py-3.5 text-sm`, `border-t` |

### Badges

| Class | Description |
|-------|-------------|
| `badge` | Base: `inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold` |
| `badge-success` | Emerald background + ring |
| `badge-danger` | Red background + ring |
| `badge-warning` | Amber background + ring |
| `badge-info` | Blue background + ring |
| `badge-neutral` | Slate background + ring |

### Page Structure

| Class | Description |
|-------|-------------|
| `page-header` | `flex items-center gap-3 mb-8` |
| `page-title` | `text-2xl font-bold tracking-tight` |
| `page-icon` | `w-8 h-8 p-1.5 rounded-xl bg-gradient-accent text-white` |
| `section-title` | `text-lg font-semibold` |
| `text-muted` | `text-slate-500 dark:text-slate-400` |

### Utilities

| Class | Description |
|-------|-------------|
| `divider` | `border-t border-slate-200 dark:border-slate-800` |
| `glass` | `bg-white/80 backdrop-blur-xl` (dark: `bg-slate-900/80`) |

---

## Dark Mode Strategy

- **Method:** Class-based (`darkMode: "class"` in Tailwind)
- **Toggle:** Jotai `themeAtom` stores preference; `class="dark"` on `<html>` synced by `ThemeSync` component in `StoreProvider`
- **Design tokens:** All component classes include `dark:` variants for background, text, border
- **Surface:** `dark:bg-[#0a0e1a]` for body, `dark:bg-[#141925]` for cards
- **Reduced motion:** `prefers-reduced-motion: reduce` disables animations

---

## Responsive Breakpoints

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop (sidebar visible) |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Extra large |

Example: Sidebar collapses below `lg`; content uses `p-4 sm:p-6`; PageHeader stacks on small screens (`flex-col sm:flex-row`).

---

## Animation Tokens

### Tailwind Keyframes

| Name | Effect |
|------|--------|
| `fadeIn` | opacity 0 → 1 |
| `slideUp` | translateY(10px) + opacity 0 → 1 |
| `scaleIn` | scale(0.95) + opacity 0 → 1 |
| `slideInLeft` | translateX(-100%) → 0 |

### Animation Classes

| Class | Duration | Use |
|-------|----------|-----|
| `animate-fade-in` | 0.2s | Overlays, modals |
| `animate-slide-up` | 0.3s | Dropdowns, cards |
| `animate-scale-in` | 0.2s | Popovers |
| `animate-slide-in-left` | 0.25s | Mobile drawer |

### Transitions

- Default: `transition-all duration-200`
- Buttons: `active:scale-[0.98]`
- Hover: `hover:shadow-glow`, `hover:bg-slate-50`

---

## Background Gradients

| Token | Description |
|-------|-------------|
| `bg-gradient-accent` | violet → indigo → blue (135deg) |
| `bg-gradient-card` | Subtle violet/indigo tint (light) |
| `bg-gradient-dark-card` | Dark card accent |
| `bg-gradient-success` | emerald |
| `bg-gradient-danger` | red |
| `bg-gradient-warning` | amber |
| `bg-gradient-info` | blue |

---

## Shadow Tokens

| Token | Description |
|-------|-------------|
| `shadow-glow-sm` | Violet glow (15px) |
| `shadow-glow` | Violet glow (25px) |
| `shadow-glow-lg` | Violet glow (35px) |
| `shadow-card` | Light card shadow |
| `shadow-card-hover` | Elevated card |
| `shadow-card-dark` | Dark theme card |
| `shadow-card-dark-hover` | Dark theme elevated |

---

## Border Radius

- `rounded-xl` — 0.75rem (12px) — Buttons, inputs
- `rounded-2xl` — 1rem — Cards
- `rounded-3xl` — 1.25rem — Large containers
