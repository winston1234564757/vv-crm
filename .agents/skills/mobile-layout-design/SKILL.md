---
name: mobile-layout-design
description: "Rules and best practices for creating responsive, thumb-friendly, fast, and accessible mobile layouts."
risk: low
source: community
date_added: "2026-06-21"
---

# Mobile Layout & Design (Premium, Accessible, Performance-First)

You are an expert **mobile-first frontend engineer**. Your goal is to design and implement mobile web layouts that feel native, respond instantly to touch, adhere to strict accessibility guidelines, and display premium design aesthetics.

---

## 1. Core Mobile Mandates

Every mobile interface must satisfy **all five**:

1. **Mobile-First CSS**: Base styles must target mobile viewports. Media queries (`@media (min-width: ...)` or Tailwind's `sm:`, `md:`, `lg:`) are used *only* to scale up for larger devices.
2. **Thumb-Zone Accessibility**: Primary actions and navigation must reside in the natural reach zone of a user's thumb (bottom half/third of the screen).
3. **Generous Touch Targets**: All interactive elements must be easy to tap without visual clutter or accidental triggers.
4. **No Horizontal Spills**: Overflows (`overflow-x: hidden` / scroll) on the body are unacceptable. Every container must adapt gracefully to the viewport.
5. **Instant Feedback**: Tap and press states must feel physical, utilizing active classes (`active:`, `:active`) and smooth visual transitions.

---

## 2. Touch Ergonomics & Thumb Zone

### Touch Target Standards (WCAG & Platform Guidelines)
* **Minimum Dimensions**: Every interactive target (buttons, links, form fields, close icons) must be at least **48×48 CSS pixels** (Android/Material standard) or **44×44 CSS pixels** (iOS standard).
* **Target Spacing**: Ensure at least **8px of spacing** between touch targets.
* **Invisible Expansion**: If a button must look small visually, expand its physical hit area using padding or CSS pseudo-elements:
  ```css
  .small-btn {
    position: relative;
  }
  .small-btn::after {
    content: '';
    position: absolute;
    top: -12px;
    left: -12px;
    right: -12px;
    bottom: -12px;
  }
  ```

### Thumb Zone Layout Structure
* **Safe Zone (Bottom 40%)**: Place primary CTAs (e.g., "Save", "Submit", "Add to Cart") and bottom navigation bars here.
* **Hard Reach (Top 20%)**: Reserve for purely informational elements or low-frequency actions (e.g., settings gear, profile icon).
* **Modal Close Actions**: Close actions for bottom sheets and screen-wide modals should be reachable at the bottom or close to the thumb area, or dismissible via swipe-down.

---

## 3. Responsive CSS & Layout Architecture

### Typography Scaling
* Never hardcode font sizes for headers on mobile. Use fluid typography or responsive steps.
* Use `clamp()` for smooth interpolation:
  ```css
  h1 {
    font-size: clamp(1.75rem, 4vw + 1rem, 2.5rem);
  }
  ```
* Base text size should be at least `16px` (`1rem`) to prevent iOS Safari from auto-zooming on input focus.

### Layout Mechanics
* **Avoid Viewport Height (100vh) Bugs**: Mobile browsers often have dynamic bars (address bar, navigation bar) that break `100vh`. Use modern units:
  * `100dvh` (Dynamic Viewport Height) for full-screen modals.
  * `100svh` (Small Viewport Height) for static layout heights.
* **Grid and Flexbox**: Use `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` for fluid wrapping without media queries.
* **Content Padding**: Use a standard horizontal padding of `16px` (`px-4` in Tailwind) or `20px` (`px-5`) on mobile screens to keep content safe from physical screen edges (e.g., notches and curved screens).

---

## 4. Performance & Core Web Vitals (CLS Prevention)

* **Aspect Ratio**: Always define `aspect-ratio` or explicit width/height for images and media to prevent layout shifts as images load.
* **Layout Skeletons**: Avoid flashing empty space. Match the shape and dimensions of your dynamic content cards using CSS skeletons.
* **Hardware Acceleration**: For complex mobile transitions (like drawers, slide-ins, and modals), use `transform: translate3d(...)` or `will-change` to offload work to the GPU.
* **Scroll Chaining**: Disable background scrolling when drawer menus or bottom sheets are open:
  ```css
  body.modal-open {
    overflow: hidden;
    position: fixed;
    width: 100%;
  }
  ```

---

## 5. Mobile Navigation Patterns

### Bottom Navigation Bar (App-like feel)
* Max of 5 items.
* Active state must be visually distinct (e.g., color shift + dot indicator, or filled vs. outlined icon).
* Add a micro-animation (e.g., subtle scale or bounce) on tap.

### Bottom Sheets (Drawers)
* Ideal for mobile forms, filters, and context menus.
* Include a visual drag handle at the top (`w-12 h-1.5 bg-neutral-300 rounded-full mx-auto my-2`).
* Support swipe-down-to-close gestures.

### Headers & Back Buttons
* Top navigation bar must be sticky (`sticky top-0 z-50 backdrop-blur-md`) with a clear visual border or shadow separator.
* Back buttons must always be in the top-left, and label text should be minimal (just an arrow, or "Back").

---

## 6. Mobile Accessibility (WCAG 2.1 AA)

* **Contrast**: Ensure contrast ratio is at least 4.5:1 for text, and 3:1 for graphical objects (buttons, inputs).
* **Keyboard Navigation**: Form fields should have a logical tab order and clear `:focus-visible` ring.
* **No Hover Dependency**: Never hide actions or information behind hover states. If something is revealed on hover on desktop, make it visible by default or triggerable via tab/tap on mobile.
* **Aria-Labels**: Tap-only icons (like hamburger menu, search button) must have clear `aria-label` or `sr-only` text.

---

## 7. Mobile Anti-Patterns (Immediate Failure)

❌ **Hover States Only**: Hiding edit/delete actions under a hover transition. (Mobile users can't hover).
❌ **Horizontal Scroll Spill**: Forcing the user to scroll horizontally to read content or press a button.
❌ **Tiny Form Inputs**: Using `<input>` or `<select>` elements with height less than `44px` or font size less than `16px`.
❌ **No Active Feedback**: Pressing a button with zero visual changes (no scale down, opacity shift, or color change).
❌ **Desktop-First Downscaling**: Building desktop layouts and adding `max-width` overrides to shrink elements.
❌ **Static Top Modals**: Opening huge, hard-to-dismiss popups in the center of the screen with a tiny `X` button in the top-right corner.

---

## 8. Operator Checklist

* [ ] Base styles written without media queries (mobile-first).
* [ ] All clickable targets are $\ge$ 44px (preferably 48px+).
* [ ] Active states implemented for all buttons and interactive elements (`active:` or active class).
* [ ] Viewport height bugs mitigated using dynamic units (`100dvh`).
* [ ] Input text sizes are at least 16px to prevent auto-zooming.
* [ ] Background scroll locked when modal or drawer is active.
* [ ] Verified no horizontal scrollbars on standard mobile viewport width (360px - 430px).

---

## 9. Integration with Other Skills

* **ux-audit** -> Use this skill to evaluate layouts against touch ergonomics and mobile heuristics.
* **frontend-design** -> Combine with the "Premium Aesthetic" requirements to ensure mobile views are beautiful and distinct.
* **clean-code** -> Write clean, responsive CSS rules with variables and utility scopes.

---

## 10. When to Use
Use this skill whenever you are:
1. Writing or modifying CSS/Tailwind styles for layout pages (`layout.tsx`, `page.tsx`).
2. Creating responsive UI components (navigation menus, bottom sheets, form inputs).
3. Auditing the codebase or screens for responsive design bugs or layout overflows.

## Limitations
* Always verify layouts on actual mobile viewport widths (e.g. 390px, 412px, 320px) using browser devtools.
* This skill does not replace native Android/iOS development; focus exclusively on standard-compliant responsive web design.
