<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: VV CRM
description: Bento-frosh dashboard for electronics sales and repair management
---

# Design System: VV CRM

## 1. Overview

**Creative North Star: "The Frosted Workshop"**

VV CRM is a digital command center for a modern electronics workshop. Light pours through frosted glass panels that float above a subtle gradient backdrop. The interface feels tangible — cards have weight, depth, and a gentle glow — while staying bright and approachable.

The design pairs the warmth of a physical workshop with the polish of a modern SaaS tool. Glassmorphism gives the interface depth without heaviness. A bento grid layout makes information scannable at a glance, with varied card sizes creating rhythm and hierarchy. Saturated accent colors (violet, cyan, amber, rose) cut through the frosted surfaces with purpose.

**Key Characteristics:**
- Light theme with subtle warm-to-cool gradient background
- Glass cards with backdrop-blur and subtle borders
- Bento grid — varied card sizes, gapless, rhythmic
- Saturated accent palette: violet, cyan, amber, rose
- Generous corner rounding (16px cards, 12px buttons)
- Subtle shadows for depth (not heavy, not flat)
- Readex Pro typography, weight-driven hierarchy

## 2. Colors

**The Frosted Surface Rule.** Every panel is a glass card: translucent background (`oklch(100% 0 0 / 0.65)`), `backdrop-blur-xl`, subtle border matching the card background lightness.

### Background
- **Gradient Start** (`oklch(97% 0.012 280)`): Warm lavender-ivory at the top of the page.
- **Gradient End** (`oklch(97% 0.008 340)`): Soft rose-ivory at the bottom.

### Glass Surface
- **Glass White** (`oklch(100% 0 0 / 0.65)`): Default card background.
- **Glass Border** (`oklch(100% 0 0 / 0.9)`): Card borders, subtle white-on-light.

### Primary
- **Electric Violet** (`oklch(55% 0.22 290)`): Primary actions, interactive elements, brand chrome.
- **Violet Deep** (`oklch(45% 0.22 290)`): Hover and pressed states.

### Accents
- **Vibrant Cyan** (`oklch(62% 0.18 210)`): Data visualization, charts, informational badges.
- **Rose** (`oklch(55% 0.2 10)`): Destructive actions, urgent alerts, error states.
- **Amber** (`oklch(70% 0.18 80)`): Warning states, low stock, attention badges.
- **Deep Indigo** (`oklch(25% 0.04 280)`): Primary text.
- **Muted Iris** (`oklch(45% 0.04 280)`): Secondary text, labels, metadata.

## 3. Typography

**Font:** Readex Pro — variable humanist sans.

### Hierarchy
- **Display** (Bold 700, `clamp(2rem, 4vw, 3rem)`, 1.1): Page titles, empty states.
- **Headline** (SemiBold 600, `clamp(1.25rem, 2.5vw, 1.75rem)`, 1.2): Section headers, panel titles.
- **Title** (Medium 500, `1rem` / 16px, 1.3): Card headers, navigation.
- **Body** (Regular 400, `0.9375rem` / 15px, 1.55): Reading text.
- **Label** (Medium 500, `0.75rem` / 12px, 1.3, 0.01em): Badges, data cells, form labels.
- **Stat** (Light 300, `2rem` / 32px, 1): Metric values, key numbers.

## 4. Elevation

**The Glass Rule.** Cards float above the background on two axes: subtle shadow underneath (`0 4px 24px oklch(0% 0 0 / 0.06)`) and a light-reflecting border on top (`0 0 0 1px oklch(100% 0 0 / 0.8)`). The shadow is ambient — it suggests a card, not a cliff. On hover, shadow deepens to `0 8px 40px oklch(0% 0 0 / 0.1)`.

## 5. Components

### Glass Card
- **Background**: `oklch(100% 0 0 / 0.65)`
- **Backdrop**: `blur(24px)`
- **Border**: `1px solid oklch(100% 0 0 / 0.9)`
- **Radius**: `16px`
- **Shadow**: `0 4px 24px oklch(0% 0 0 / 0.06)`

### Buttons
- **Primary**: Electric Violet fill, 12px radius, 1.5px border matching fill.
- **Ghost**: Transparent, Electric Violet text, hover fills at 10% opacity.
- **Danger**: Rose fill.

### Navigation
- **Sidebar**: Glass card style, full height. Active item: Electric Violet left indicator (3px) + subtle Violet tinted background.

## 6. Do's and Don'ts

### Do:
- **Do** use glass cards as the primary surface — every panel floats
- **Do** vary bento card sizes — some tall, some wide, some square
- **Do** use saturated accents sparingly — violet for chrome, others for specific signal
- **Do** keep the bento grid tight — no gaps between cards, use negative space inside
- **Do** use gradient background as the only source of page-level depth

### Don't:
- **Don't** use pure white backgrounds — the gradient should always show through
- **Don't** stack glass cards on glass cards (nested glass looks muddy)
- **Don't** use shadow-heavy cards — glass needs light touch
- **Don't** use more than 3 accent colors on a single screen
- **Don't** make the bento grid a uniform 3×3 of same-sized cards
