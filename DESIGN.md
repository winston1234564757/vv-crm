---
name: VV CRM
description: Light workshop dashboard for electronics sales and repair management
---

# Design System: VV CRM (v3)

## 1. Overview

**Creative North Star: "Warm workshop, cool tool."**

VV CRM is a digital companion for a working electronics workshop — behind the counter, on a desktop, during active customer interactions. The brand personality stays warm and human (a craftsperson's companion, not a boardroom ERP), but that warmth lives in **copy, spacing, soft radii and human empty states**, not in the background hue.

The visual system is a **light, restrained, cool-neutral** interface with a single **teal accent**. It is deliberately not the warm cream / violet-on-ivory look of v1 (that palette reads as a generic AI-CRM default). Surfaces are near-white and neutral; the teal earns attention only on interactive and stateful elements.

**Key characteristics:**
- Light theme, clean off-white neutral surfaces (chroma ~0) — no warm cream tint.
- One cool teal accent, used for actions / selection / state only (≤10% of surface).
- Solid surfaces. No glassmorphism, no backdrop-blur, no gradient fills — with the two narrow exceptions in §2.1 and §4.1.
- Grotesk type pairing: Space Grotesk (display / KPI numbers) + Hanken Grotesk (body / UI).
- Tabular figures for all tables, money and KPI stats.
- Space and weight carry hierarchy; motion conveys state, never decorates.

## 2. Color (OKLCH, tokens in `src/app/globals.css`)

**The solid-surface rule.** Every panel is opaque. Shadows are shallow and neutral: `0 1px 3px oklch(0% 0 0 / 0.05)`.

### Neutrals (cool-neutral, near chroma 0)
- `--color-bg` `oklch(98.4% 0.002 240)` — page background.
- `--color-surface` `oklch(100% 0 0)` — cards / panels.
- `--color-sidebar` `oklch(97% 0.003 240)` — sidebar / secondary panel layer.
- `--color-border` `oklch(92% 0.004 240)`, `--color-border-strong` `oklch(87% 0.006 240)`.
- `--color-hover` `oklch(96% 0.004 240)` — hover / selected-row wash.

### Ink / text
- `--color-ink` `oklch(23% 0.012 250)` — primary text (≥4.5:1 on surface).
- `--color-muted` `oklch(45% 0.012 250)` — secondary text / labels.
- `--color-faint` `oklch(56% 0.012 250)` — tertiary only; never for body or placeholders.

### Accent (teal)
- `--color-accent` `oklch(51% 0.11 194)` — primary actions, active tab, selection. Use as a **fill with `--color-on-accent` (white) text**; contrast-verified for button labels.
- `--color-accent-hover` `oklch(45% 0.11 194)`, `--color-accent-active` `oklch(39% 0.10 194)`.
- `--color-accent-subtle` `oklch(51% 0.08 194 / 0.12)` — active/selected tint.
- `--color-accent-ink` `oklch(40% 0.09 194)` — teal **text** on light backgrounds (darkened for ≥4.5:1).

### Semantic (each with a `-subtle` tint for badges)
- `--color-success` `oklch(52% 0.13 162)` — completed, in stock, confirmations.
- `--color-warning` `oklch(62% 0.14 74)` — low stock, attention.
- `--color-danger` `oklch(53% 0.19 26)` — errors, destructive, overdue.
- `--color-info` `oklch(54% 0.11 236)` — informational indicators.

Legacy token names (`--color-violet`, `--color-warm-*`, `--color-text-*`, `--color-rose/amber/emerald/cyan`, `--color-iris`) remain as aliases with identical values so un-migrated markup keeps working. Migrate off them file-by-file; do not add new usages.

### 2.1 The inverse surface (v3)

One dark plate is allowed per screen, and only to carry that screen's single most important number — today it is the dashboard hero. It is **not** a dark theme: the rest of the page stays light, and there is no theme toggle behind it.

- `--color-inverse-surface` `oklch(23% 0.012 250)` (= ink), `--color-inverse-elevated`, `--color-inverse-border`.
- `--color-inverse-ink` / `--color-inverse-muted` — text on the plate. `--color-ink` disappears on it, so it must never be used there.
- `--color-accent-on-inverse` `oklch(76% 0.12 194)` — the accent at L 51% lands at ~2.5:1 on the plate and is unreadable as text; this is the only teal allowed on it. Same reasoning for `--color-success-on-inverse` / `--color-danger-on-inverse`.

**Rules:** exactly one per screen; never nested inside another surface; never used for a whole section, a sidebar or a modal. If a second plate ever seems necessary, the screen has a hierarchy problem, not a colour problem.

## 3. Typography

- **Display** — Space Grotesk. Headings and KPI numbers only. `.font-display`, letter-spacing -0.02em (floor -0.04em). Never in body, labels, buttons.
- **Body / UI** — Hanken Grotesk (`--font-sans`). Carries labels, buttons, tables, forms, body.
- **Numbers** — `.tabular` (`font-variant-numeric: tabular-nums`) on every table cell, money value and stat.
- Fixed rem scale (not fluid). Tighter ratio (~1.2). Prose 65–75ch; data tables may run denser.
- Do not pair with Inter / Roboto / system defaults for display.

## 4. Elevation, radius, spacing

- Card shadow `0 1px 3px oklch(0% 0 0 / 0.05)`, hover `0 4px 14px oklch(0% 0 0 / 0.08)`.
- Radius scale: `--radius-xs 6 · sm 8 · md 10 · lg 12 · xl 16`. Cards `lg`, buttons/inputs `md`, badges pill.
- Vary spacing for rhythm; space is hierarchy. Avoid nested cards (a card inside a card is always wrong).

### 4.1 Bento grid and chart fills (v3)

**Bento.** A dashboard may lay its cards out on a 12-column grid at `lg` (6 at `md`, one column below that) with cells of unequal width — that asymmetry is what carries emphasis, and it replaces reaching for decoration. A bento cell **is** the card: nothing inside it may be another card. Grouping inside a cell is done with a `border-t` rule or a `bg-hover` panel, never a second bordered, shadowed surface. Spans are static utility classes; Tailwind cannot see an interpolated `col-span-${n}`.

**Chart fills.** A vertical gradient from the series colour to transparent, under a line or area mark, is allowed. It is how an area chart reads its own baseline, not ornament. Everything else stands: no gradients on panels, buttons, badges or text; no glow, no glass, no backdrop-blur.

## 5. Components

- **Button** (`ui/Button.tsx`) — the single primitive. Variants: primary (teal fill), secondary (bordered), ghost, danger. Sizes sm/md/lg. Always has default/hover/active/focus/disabled/loading. Replaces all copy-pasted CTA blocks.
- **Tabs** (`ui/Tabs.tsx`) — accessible state-based tabs (`role=tablist`, arrow-key nav, underline). For in-page toggles.
- **SectionTabs** (`layout/SectionTabs.tsx`) — route-based tabs derived from `nav-config`; the "theme → page with tabs" navigation pattern. Mounted once in `admin/layout.tsx`.
- **Badge** (`ui/Badge.tsx`) — semantic pill (neutral/accent/success/warning/danger/info).
- **StandardCard**, **Input**, **Drawer**, **SearchSelect**, **TagSelect** — existing primitives, retone to new tokens.
- **Navigation** — grouped sidebar (5 domain groups + Dashboard/Settings/Store-launch standalone), single source `src/lib/nav-config.ts`. Active state = full background tint (`--color-accent-subtle`), never a side-stripe.
- **Tables** — border separation, no card-in-card. Header = label style. Hover wash on interactive rows. `overflow-x-auto` on mobile.

## 6. Motion

- 150–250 ms UI transitions; easing `cubic-bezier(0.23, 1, 0.32, 1)` (strong ease-out, no bounce).
- Press feedback `scale(0.97)` on `:active` (`.btn-press`).
- Entry: opacity + translateY(4px), 40 ms stagger. No orchestrated page-load sequences.
- `prefers-reduced-motion`: keep opacity/color, drop movement (already guarded in globals.css).
- Motion conveys state only. No decorative micro-motion.

## 7. Do / Don't

### Do
- Keep surfaces solid, neutral and near-white.
- Keep the palette restrained — one teal accent, semantic colors for meaning.
- Use `.font-display` for headings/KPIs and `.tabular` for all figures.
- Give every interactive component all its states.
- Write warm, human copy and generous, teaching empty states.

### Don't
- Don't reintroduce warm-cream backgrounds or violet-on-ivory.
- Don't use glassmorphism, backdrop-blur, glow orbs, or gradient fills anywhere except under a chart line (§4.1).
- Don't put more than one inverse plate on a screen, or use `--color-ink` / plain `--color-accent` on it (§2.1).
- Don't use side-stripe accent borders or gradient text.
- Don't use display/serif fonts in labels, buttons or data.
- Don't nest cards — including inside a bento cell — or animate layout properties (width/height/top/left).
- Don't reach for a modal first — exhaust inline / progressive alternatives.
