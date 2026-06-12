---
name: VV CRM
description: Warm workshop dashboard for electronics sales and repair management
---

# Design System: VV CRM

## 1. Overview

**Creative North Star: "The Workshop Bench"**

VV CRM is a digital companion for a working electronics workshop. It lives behind the counter, on a desktop, during active customer interactions. The interface feels tangible and warm — like a well-worn workbench, not a sterile dashboard.

Design decisions serve clarity and speed. Every element earns its place. Color has purpose. Motion has reason. Silence is a design tool.

**Key Characteristics:**
- Warm light theme with solid, not gradient, backgrounds
- Solid cards with subtle warm shadows (no backdrop-blur, no glass)
- Consistent, predictable grids
- One restrained accent color for interactive elements
- Readex Pro typography, weight-driven hierarchy
- Space as hierarchy — generous where it matters, compact where it doesn't

## 2. Color

**The Warm Surface Rule.** Every surface is solid. No transparency, no backdrop-blur, no glass. Shadows are warm and shallow: `0 1px 3px oklch(0% 0 0 / 0.06)`.

### Background
- **Page Surface** (`oklch(96% 0.006 60)`): Warm ivory, solid fill. The entire application sits on this.
- **Card Surface** (`oklch(100% 0 0 / 1)`): Pure white cards with warm shadow.
- **Sidebar Surface** (`oklch(94% 0.005 60)`): Slightly deeper warm tone to distinguish from content area.

### Primary
- **Warm Violet** (`oklch(50% 0.18 290)`): Primary actions, interactive elements. Saturated but not harsh.
- **Violet Hover** (`oklch(42% 0.18 290)`): Hover and pressed states.
- **Violet Subtle** (`oklch(50% 0.06 290 / 0.1)`): Light tint for active states, selected rows.

### Text
- **Primary Text** (`oklch(20% 0.01 60)`): Warm near-black for headings and body.
- **Secondary Text** (`oklch(40% 0.01 60)`): Warm mid-gray for labels, metadata.
- **Muted Text** (`oklch(55% 0.01 60)`): Placeholder text, disabled states.

### Semantics
- **Error** (`oklch(50% 0.2 25)`): Errors, destructive actions.
- **Warning** (`oklch(65% 0.18 85)`): Low stock, attention-needed states.
- **Success** (`oklch(55% 0.15 145)`): Completed states, confirmations.
- **Info** (`oklch(55% 0.12 210)`): Informational badges, data indicators.

## 3. Typography

**Font:** Readex Pro — variable humanist sans. Single family carries everything.

### Fixed rem scale

| Style | Weight | Size | Line Height | Letter Spacing |
|-------|--------|------|-------------|----------------|
| Display | Bold 700 | 1.75rem / 28px | 1.15 | -0.02em |
| Headline | SemiBold 600 | 1.25rem / 20px | 1.2 | -0.01em |
| Title | Medium 500 | 1rem / 16px | 1.3 | 0 |
| Body | Regular 400 | 0.9375rem / 15px | 1.5 | 0 |
| Label | Medium 500 | 0.75rem / 12px | 1.3 | 0.01em |
| Stat | SemiBold 600 | 1.5rem / 24px | 1 | -0.01em |

Line length: 65-75ch for prose; tables and data can run wider.

## 4. Elevation & Surfaces

Cards use solid white backgrounds with warm, shallow shadows. No backdrop-blur. No transparency.

- **Card Shadow**: `0 1px 3px oklch(0% 0 0 / 0.06)`, hover `0 4px 12px oklch(0% 0 0 / 0.1)`
- **Card Radius**: `12px`
- **Card Padding**: `p-5` (1.25rem)

## 5. Components

### Standard Card
- **Background**: `oklch(100% 0 0 / 1)`
- **Border**: `1px solid oklch(90% 0.005 60)`
- **Radius**: `12px`
- **Shadow**: `0 1px 3px oklch(0% 0 0 / 0.06)`

### Buttons
- **Primary**: Warm Violet fill, 10px radius, 0.875rem text, 500 weight
- **Secondary**: Outlined variant with same radius, warm violet text on transparent
- **Ghost**: Transparent, warm violet text, hover fills at 10% opacity
- **Danger**: Error red fill
- **All buttons**: `transform: scale(0.97)` on `:active` for physical press feedback

### Navigation
- **Sidebar**: Warm neutral surface (`oklch(94% 0.005 60)`), full height. Active item: Warm Violet tinted background (`oklch(50% 0.06 290 / 0.1)`), filled text.
- **No side-stripe accents**. Use full background tint instead.

### Forms
- **Label**: Above input, 0.75rem, 500 weight, secondary text color
- **Input**: 1px border, 10px radius, 0.875rem text, inner padding 0.75rem vertical / 1rem horizontal
- **Focus**: Warm Violet border + ring
- **Error**: Red border + inline message below input
- **Select**: Same styling as input

### Tables
- **Clean borders**: top-border or bottom-border separation, no card-in-card
- **Header**: Label style, secondary text
- **Rows**: Body style, hover background on interactive rows
- **Mobile**: `overflow-x-auto` with sticky first column

## 6. Motion

- **Duration**: 150-250ms for UI transitions (never block flow)
- **Easing**: `cubic-bezier(0.23, 1, 0.32, 1)` — strong ease-out
- **Press feedback**: `transform: scale(0.97)` on `:active` — 100ms
- **Entry**: Opacity + translateY(4px), stagger 40ms between items
- **`prefers-reduced-motion`**: Keep opacity/color transitions, remove all position/movement
- **No decorative motion**: Every animation conveys state or prevents jarring changes

## 7. Do's and Don'ts

### Do:
- **Do** use solid surfaces — every panel is opaque, warm, and grounded
- **Do** keep the palette restrained — one accent color, muted neutrals
- **Do** use space as hierarchy — more space = more importance
- **Do** make every form label visible and above its input
- **Do** show inline errors with recovery suggestions

### Don't:
- **Don't** use glassmorphism, backdrop-blur, or transparent surfaces
- **Don't** use gradient backgrounds
- **Don't** use side-stripe accent borders
- **Don't** use `alert()` for error messages
- **Don't** use display fonts or serif fonts in UI
- **Don't** animate layout properties (width, height, top, left)
- **Don't** show loading spinners — use skeleton states
