<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: VV CRM
description: Internal sales and repair management for electronics — warm, human, simple
---

# Design System: VV CRM

## 1. Overview

**Creative North Star: "The Workshop Companion"**

VV CRM is a digital workbench for someone who serves customers face-to-face — selling phones, taking in repairs, checking stock. It moves like the person behind the counter: direct, warm, unhurried. The denim-blue surfaces ground the interface like a well-worn apron; the amber accent cuts through like a trouble light hanging above the bench.

The system is committed to its color — selvedge blue carries 40–60% of chrome, but the energy comes from contrast: a sharp amber accent used at the moments that matter (new repair, low stock, sale closed). Typography is a warm variable humanist: massive where it needs to lead, light where it needs to recede. Every panel has a signature 4px bottom border — the workshop bench edge — grounding the interface in something physical.

**Key Characteristics:**
- Selvedge blue as the primary material — warm, not corporate
- Amber accent for tension and attention — rare, therefore powerful
- One variable humanist font across all roles, with extreme weight contrast (700 ↔ 300)
- 4px bottom border on every panel — the bench edge
- Choreographed motion with 60ms staggered entrances
- Flat surfaces with tonal layering; shadows have no place here
- Generous white space, but data tables are confidently dense

## 2. Colors

**The Committed Rule.** Selvedge blue carries 40–60% of every screen. It is the material of chrome, navigation, primary actions. Amber is the interruption — less than 5% of any view, used only for moments that demand attention. Warm neutrals keep everything approachable.

### Primary
- **Selvedge Blue** (`oklch(45% 0.06 260)`): The primary material. Navigation bars, primary buttons, interactive surfaces, focused states. Named after the edge of selvedge denim — a darker, warmer blue than navy.
- **Selvedge Blue Deep** (`oklch(35% 0.06 260)`): Hover states, pressed states, active navigation.

### Accent
- **Trouble Light Amber** (`oklch(72% 0.14 80)`): A sharp, warm amber. Used exclusively for: new repair badge, low stock indicator, sale confirmation flash, primary CTAs that need urgency. Never decorative.

### Neutral
- **Workbench Cream** (`oklch(97% 0.004 80)`): Main background. Soft, warm off-white.
- **Cork Board** (`oklch(93% 0.006 70)`): Card surfaces, secondary containers.
- **Well-Worn Gray** (`oklch(88% 0.005 260)`): Borders, dividers, separators.
- **Cast Iron** (`oklch(25% 0.008 260)`): Primary text. Warm near-black.
- **Faded Ink** (`oklch(50% 0.01 260)`): Secondary text, labels, metadata.
- **Error** (`oklch(50% 0.2 25)`): Destructive actions, validation errors.

### Named Rules
**The Bench Edge Rule.** Every panel, card, and container has a 4px bottom border in the background tone one step darker than itself. It reads as a physical edge — the lip of a workbench — not an accent stripe. Never use border-left or border-right as decoration.

## 3. Typography

**Font:** Readex Pro — a variable humanist sans with distinctive ink traps and warm proportions. The same font across all roles, expressing hierarchy through weight and scale alone.

**Character:** Warm, confident, crafted. Ink traps give it a subtle mechanical personality — appropriate for a workshop tool. The extreme weight range (300–700) lets one typeface cover both massive display headers and delicate data labels without a second face.

### Hierarchy
- **Display** (Bold 700, `clamp(2.5rem, 6vw, 5rem)`, 1.05): Page titles, empty states, major transitions. Used rarely for maximum impact.
- **Headline** (SemiBold 600, `clamp(1.5rem, 3vw, 2.5rem)`, 1.15): Section headers, panel titles, modal headers.
- **Title** (Medium 500, `1.125rem` / 18px, 1.25): Card headers, navigation labels, data table headers.
- **Body** (Regular 400, `0.9375rem` / 15px, 1.55): Primary reading text, descriptions. Max line length 70ch.
- **Label** (Medium 500, `0.75rem` / 12px, 1.3, 0.015em letter-spacing): Form labels, table data cells, metadata badges. Compact but legible.
- **Monotitle** (Readex Pro Light 300, `0.875rem` / 14px): Secondary stats, supporting numbers, timestamps.

### Named Rules
**The Weight Contrast Rule.** Hierarchy comes from weight first, size second. Display is 700; supporting text drops to 300. Never use a weight within 100 of the adjacent level — the gap must feel decisive.

## 4. Elevation

**The Flat Surface Rule.** Depth is communicated through tonal layering, never shadows. A panel sits above its background by being one tone warmer or cooler, never by casting a shadow. Active states shift background tone (Selvedge Blue Deep) rather than adding elevation.

There is no box-shadow in this system. Zero. The 4px bench-edge border provides all the edge definition needed.

## 5. Components

*[No components exist yet. This section will be populated on the next scan pass.]*

### Component Philosophy (for implementation reference)
- Buttons: filled (Selvedge Blue) or ghost (transparent + text). Pill-shaped only where the interaction is momentary (badges, chips). Never square-edged primary buttons.
- Tables: generously padded (16px vertical, 24px horizontal), alternating row tone (Workbench Cream / Cork Board), bench-edge bottom border on header row.
- Navigation: vertical sidebar in Selvedge Blue, active item in Selvedge Blue Deep with amber left indicator (2px, not 4px — the bench edge is horizontal only).
- Cards: no border-radius, Cork Board background, 4px bench-edge bottom border, 16px internal padding.

## 6. Do's and Don'ts

### Do:
- **Do** let selvedge blue own the chrome — nav, primary buttons, header bars, table head
- **Do** use amber for moments that matter — new repair, low stock, sale confirmation — and nowhere else
- **Do** use the 4px bench-edge bottom border on every panel as the signature visual move
- **Do** make display typography massive (4-5rem) and supporting text light (300 weight) — the gap is the point
- **Do** choreograph entrances: stagger children at 60ms intervals with ease-out-quart timing
- **Do** keep data tables confident — 16px cell padding, clear tone alternation, readable without horizontal lines

### Don't:
- **Don't** use cold corporate blues — selvedge is warm; navy and royal blue are forbidden
- **Don't** use shadows for depth — tonal layering and the bench edge are the only elevation tools
- **Don't** build a three-column admin dashboard with a grey sidebar — that is the CRM cliché we reject
- **Don't** use border-left or border-right greater than 2px for decoration — horizontal bench edge only
- **Don't** use gradient text, glassmorphism, or side-stripe borders
- **Don't** overuse amber — its rarity is its power
- **Don't** overload screens — density belongs in tables only; everything else breathes
