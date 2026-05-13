# CampusAid → Nexus-GH Design Audit & Rebuild Approach

Thorough examination of the CampusAid codebase at `/home/zero/Desktop/campusaid`.
Every finding below is pulled directly from the source files — no guesswork.

---

## 1. COLOR SYSTEM

CampusAid uses exactly **3 brand colors** plus white and a muted gray for text.
All values are `oklch()` — perceptually uniform, no purple drift.

### The 3 core colors

| Token | Value | Role |
|---|---|---|
| `--forest` | `oklch(0.28 0.07 145)` | Deep forest green — headings, active sidebar, heavy CTAs, authority |
| `--forest-dark` | `oklch(0.20 0.06 145)` | Darker forest — footer background |
| `--lime` | `oklch(0.88 0.22 120)` | Bright yellow-green — progress bars, active indicators, featured badges, underlines, arrow accents |
| `--lime-dark` | `oklch(0.78 0.20 120)` | Hover state for lime elements |
| `--cream` | `oklch(0.97 0.015 100)` | Warm off-white — page background |
| `--cream-dark` | `oklch(0.93 0.025 100)` | Slightly darker cream — alternate section bg, progress track |

### Supporting tokens (semantic)

| Token | Value | Role |
|---|---|---|
| `--background` | = cream | Page/body background |
| `--foreground` | `oklch(0.18 0.04 145)` | Near-black with green tint — body text |
| `--card` | `oklch(1 0 0)` | Pure white — card surfaces |
| `--border` | `oklch(0.90 0.02 100)` | Warm light gray — card borders, dividers |
| `--muted-foreground` | `oklch(0.52 0.03 145)` | Mid-green gray — captions, labels, secondary text |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Red — errors only |

### Color usage rules (observed)

- **Lime** = action. Every interactive highlight: active nav dot, progress fill, "Featured" badge, CTA hover, hero underline animation, arrow strokes on dark bg
- **Forest** = authority. Headings, logo text, primary text on light, heavy button backgrounds, sidebar active state
- **Cream** = rest. All page backgrounds, section alternation between `--cream` and `--cream-dark`
- **White** = card surface. Every card, modal, and popover
- No purple, blue, orange, or pink anywhere

### Critical contrast with Nexus-GH current state

CampusAid is **light-first** (cream background + white cards + dark forest text).
Nexus-GH is currently **dark-first** (navy `hsl(220 40% 8%)` + gold `hsl(37, 90%, 55%)`).

Adopting CampusAid's design means **inverting** Nexus to a light theme.

---

## 2. TYPOGRAPHY

### Fonts

| Role | Font | Weights | Where |
|---|---|---|---|
| **Everything** | `Plus Jakarta Sans` | 400, 500, 600, 700, 800 | All body, labels, headings, UI |
| **Numbers only** | `Geist Mono` | — | All money values, stats, percentages, IDs |

Single-font system. No heading font vs body font split.
The weight variation (400 → 800) does all the typographic hierarchy work.

`Plus Jakarta Sans` is loaded via `next/font/google`:
```ts
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  weight: ['400', '500', '600', '700', '800'],
})
```

### Letter spacing (tight — always negative)

| Context | Tracking |
|---|---|
| Hero headline | `letterSpacing: '-0.035em'` |
| Section headings | `letterSpacing: '-0.025em'` |
| Wordmark/logo | `letterSpacing: '-0.045em'` |
| Money/stats (mono) | `letterSpacing: '-0.025em'` |
| Uppercase labels | `letterSpacing: '0.08em'` to `'0.1em'` (exception — expanded for ALL CAPS) |

Rule: tight tracking everywhere except uppercase micro-labels where you expand.

### Font weight usage pattern

| Weight | Usage |
|---|---|
| 400 | Body text, long-form paragraphs |
| 500 | Nav labels, secondary descriptions, link text |
| 600 | Form labels, badge text, "See all" links, captions |
| 700 | Card titles, step headings, CTA button text |
| 800 | Hero headline, stat values, section headings, money amounts |

### Type scale

```
10-11px — micro labels, badges, category tags, donor counts
12px    — secondary info, bottom-bar text
14px    — body text, nav items, form fields, standard paragraphs
15px    — card titles, slightly emphasized body
16px    — standard paragraph, modal body
17px    — hero subheading
18px    — subsection headings, step titles
clamp(1.75rem, 2.75vw, 2.375rem)  — section H2s
clamp(2.625rem, 4.25vw, 3.875rem) — hero H1
```

---

## 3. BORDER RADIUS SYSTEM

| Context | Value |
|---|---|
| Page cards, containers | `rounded-2xl` = 16px |
| Primary CTA buttons | `borderRadius: '100px'` — full pill |
| Form inputs | `rounded-2xl` = 16px |
| Nav items (sidebar) | `rounded-xl` = 12px |
| Logo mark | `rounded-xl` = 12px |
| Badges/pills | `rounded-full` |
| Small chips | `borderRadius: '6px'` |
| Progress bar | `rounded-full` |

Global radius variable: `--radius: 1rem` (16px).

---

## 4. LAYOUT PATTERNS

### Page structure
- Max content width: `1200px` centered with `margin: '0 auto'`
- Sidebar: fixed, 240px, white bg, right border
- Main content: `marginLeft: 240px` on desktop, full width on mobile
- Mobile: bottom navigation bar replaces sidebar

### Hero layout (asymmetric — intentional)
```
54fr 46fr — text column : image column
```
Not 50/50. The copy side gets more space.

### Section layouts
- Campaigns grid: `repeat(3, 1fr)` → `repeat(2, 1fr)` → `1fr`
- How-it-works: `1fr 1.6fr` — sticky heading left, scrolling steps right
- Footer: `1.6fr 1fr 1fr` — brand gets more space
- Auth: split-screen — `520px` forest panel (desktop) + flex-1 cream form

### Spacing vocabulary
- Section vertical padding: `7rem 1.5rem` (generous breathing room)
- Card padding: `p-4` / `p-4 pt-6`
- Horizontal page padding: `px-4 sm:px-6`
- Inner card gap: `space-y-1.5` to `space-y-4`
- Nav item gap: `gap-3`, `space-y-0.5`

---

## 5. INTERACTION & ANIMATION

### Entrance animations (Framer Motion)

All page elements enter with `y: 0 → visible` or `opacity: 0 → 1`:
```tsx
initial={{ opacity: 0, y: 28 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.6, delay: 0.08 }}
```

Stagger pattern: each sibling element adds `0.08s` to `0.12s` delay.

### Scroll-triggered reveals
```tsx
const ref = useRef(null)
const inView = useInView(ref, { once: true, margin: '-40px' })
// animate only when inView === true
```

### Hover states
- Cards: `whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(0,0,0,0.10)' }}`
- Images inside cards: `group-hover:scale-[1.03]` with `duration-500`
- Buttons: `active:scale-95` or `active:scale-[0.98]` — tactile press
- Nav items: instant bg color swap, `transition-all duration-150`

### Micro-transitions
- Standard UI: `transition-all duration-150` (150ms — snappy)
- Progress fill: `800ms cubic-bezier(0.4, 0, 0.2, 1)` — smooth, satisfying
- Sticky nav: transparent → blurred cream at scroll position 24px with `0.25s ease`
- Hero SVG underline: `pathLength: 0 → 1` at `delay: 1.0s` — draws after hero loads

---

## 6. COMPONENT DESIGN PATTERNS

### Cards
```
white background
1px solid var(--border)
rounded-2xl
box-shadow: 0 1px 4px rgba(0,0,0,0.04)
hover: y -4px, shadow increases
image: aspect-video with object-cover
category badge: bottom-left of image, lime pill
```

### Sidebar
```
fixed, 240px, white bg
1px right border
Logo + wordmark at top (padded, bottom border)
Nav items: rounded-xl, forest bg on active, lime dot indicator, muted on inactive
Divider + lime CTA button at bottom of nav
User info footer: avatar initial in forest circle, email/name, sign-out icon
```

### Buttons
```
Primary CTA: forest bg, white text, borderRadius 100px (pill)
Secondary CTA: lime bg, forest text, borderRadius 100px (pill)
Ghost link: forest text, no bg, underline with lime bottom border
Small contained: rounded-xl
```

### Progress bar
```
Track: cream-dark background, rounded-full
Fill: lime color, animated width with 800ms ease transition
Height variants: sm (h-1.5), md (h-2.5), lg (h-3.5)
```

### Badges/chips
```
Category: white/transparent bg, forest text, blurred backdrop (over images)
Featured: lime bg, forest text, rounded-full
Verified: lime square icon + "Student Verified" text
```

### Auth layout
```
Left panel (desktop): forest bg, dot texture pattern, logo + headline + stats
Right panel: cream bg, centered form max-w-[420px]
Inputs: rounded-2xl, 2px border (forest on focus)
Submit button: forest bg, pill shape, full width
```

### Empty states
```
cream-dark square icon container (rounded-2xl)
forest heading, muted description
forest CTA button
```

### Dot texture (decorative)
```css
backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)'
backgroundSize: '24px 24px'
opacity: 0.04
```
Used on forest-colored panels (auth left panel, home greeting banner).

---

## 7. WHAT MAKES CAMPUSAID DISTINCTIVE

1. **Single font** — Plus Jakarta Sans at 5 weights. Weight alone creates hierarchy.
2. **Lime as the singular spark** — used sparingly but always with intent: active dots, progress fills, underlines. It pops against forest and cream equally.
3. **Asymmetric grids** — `54fr 46fr`, `1fr 1.6fr` — never symmetrical.
4. **Mono for data only** — every number, price, percentage in Geist Mono. Creates instant visual separation between labels and values.
5. **Pill CTAs** — `borderRadius: 100px` on every primary action. Clean, confident.
6. **Tight letter spacing** — `-0.035em` to `-0.045em`. Makes the sans-serif feel premium.
7. **The dot pattern** — `opacity: 0.04` white radial gradient on forest panels. Subtle texture, never distracting.
8. **Color restraint** — zero blue, purple, red (except errors), orange. Just 3 colors.

---

## 8. FULL ASSESSMENT: CAN THIS BE USED FOR NEXUS-GH?

**Yes. 100%.** The design system translates cleanly to an ERP.

CampusAid is a transaction-heavy data platform that shows tables, cards, stats, progress, and forms — exactly what Nexus needs. The visual language is professional, confident, and readable at data density.

The single change that needs a decision: **CampusAid is light-first, Nexus is currently dark-first.**
Rebuilding with CampusAid's palette means switching Nexus to a light theme.

This is the right call — ERPs benefit from light themes: easier to read data tables, better contrast for small numbers, less eye strain during long sessions.

---

## 9. REBUILD APPROACH — HOW TO APPLY THIS TO NEXUS

### Step 1 — CSS token swap in `src/index.css`

Replace the current dark-navy theme entirely:

```css
:root {
  --background:   oklch(0.97 0.015 100);   /* cream */
  --foreground:   oklch(0.18 0.04 145);    /* near-black forest */
  --card:         oklch(1 0 0);            /* white */
  --card-foreground: oklch(0.18 0.04 145);
  --primary:      oklch(0.28 0.07 145);    /* forest */
  --primary-foreground: oklch(0.98 0 0);
  --secondary:    oklch(0.96 0.03 100);    /* light cream */
  --secondary-foreground: oklch(0.28 0.07 145);
  --muted:        oklch(0.94 0.02 100);
  --muted-foreground: oklch(0.52 0.03 145);
  --accent:       oklch(0.88 0.22 120);    /* lime */
  --accent-foreground: oklch(0.18 0.08 145);
  --destructive:  oklch(0.577 0.245 27.325);
  --border:       oklch(0.90 0.02 100);
  --input:        oklch(0.90 0.02 100);
  --ring:         oklch(0.88 0.22 120);    /* lime ring */
  --radius: 1rem;

  /* Brand tokens */
  --lime:         oklch(0.88 0.22 120);
  --lime-dark:    oklch(0.78 0.20 120);
  --forest:       oklch(0.28 0.07 145);
  --forest-dark:  oklch(0.20 0.06 145);
  --cream:        oklch(0.97 0.015 100);
  --cream-dark:   oklch(0.93 0.025 100);
}
```

### Step 2 — Font swap in `src/index.css` and `index.html`

Remove `DM Sans`, `Space Grotesk`, `Outfit`, `Pacifico`.
Replace with:

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Geist+Mono:wght@400;700&display=swap" rel="stylesheet" />
```

Tailwind config: `fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'], mono: ['Geist Mono', 'monospace'] }`

### Step 3 — Sidebar rebuild

Replace `AppSidebar.tsx` glassmorphic dark sidebar with:
- White background, 1px right border
- Forest active nav item (bg + white text + lime dot)
- Muted gray inactive items
- Logo: `NX` in forest square with lime text
- Bottom CTA button (lime bg + forest text) for most-used action (POS or New Sale)

### Step 4 — Component tokens

Everywhere the old code uses `text-primary`, `bg-primary`, `border-border` etc:
- These will automatically pick up the new token values after Step 1
- `hsl(220 40% 8%)` and `hsl(37, 90%, 55%)` hardcoded references need manual search/replace

### Step 5 — Button shapes

Primary action buttons: `rounded-full` pill style, forest bg, white text
Secondary/accent: `rounded-full`, lime bg, forest text
Contained/form: `rounded-xl`, standard height

### Step 6 — Stat cards and tables

Stat cards: white bg, `rounded-2xl`, subtle border, forest heading, **Geist Mono** for the number
Tables: cream background, white card, standard border — no dark alternating rows
Progress bars: lime fill on cream-dark track

### Step 7 — Animation

Add these patterns to `tailwind.config.ts` keyframes and use in high-value entrance spots:
- Dashboard load: staggered card entrance `y: 20 → 0` with 0.08s delays
- Sidebar nav hover: `duration-150` snap
- Table row entrance on data load: fade-in `opacity: 0 → 1`

---

## 10. WHAT TO PRESERVE FROM CURRENT NEXUS

These existing pieces stay because they're solid and already match the new direction:
- `src/lib/ghana.ts` — GHS formatting, regions, taxes (untouched)
- All Supabase logic, hooks, RLS (untouched)
- `TierGate`, `useLicenseTier` (untouched — gating logic is separate from UI)
- shadcn/ui Radix primitives — they're already token-based so Step 1 reflections them automatically
- All form logic, validation, dialogs (untouched)
- Framer Motion already installed — add entrance animations

---

## SUMMARY

| Element | CampusAid | Nexus (new) |
|---|---|---|
| Background | cream `oklch(0.97 0.015 100)` | Same |
| Cards | white, `rounded-2xl`, light border | Same |
| Primary color | forest green | Same |
| Accent | lime green | Same (replaces gold) |
| Font | Plus Jakarta Sans | Same (replaces DM Sans + Space Grotesk) |
| Numbers | Geist Mono | Same |
| Sidebar | white, 240px, forest active, lime dot | Same |
| CTA buttons | pill shape (`borderRadius: 100px`) | Same |
| Letter spacing | tight `-0.025em` to `-0.045em` | Same |
| Animations | Framer Motion, `useInView`, y-entrance | Same |
| Theme mode | Light-first | Switch from dark-first |

The rebuild is fully achievable. Every pattern translates. The main work is:
1. CSS token swap (30 min)
2. Font swap (15 min)
3. Sidebar visual rebuild (1-2 hrs)
4. Search/replace hardcoded dark colors in components (1-2 hrs)
5. Button radius standardization (30 min)
