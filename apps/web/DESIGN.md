# IronLog Design System

> Premium performance technology. Not a fitness app, not a SaaS dashboard, not a chatbot demo.

## 0. Scope note (read this first)

`design-taste-frontend` (installed skill) states its own scope explicitly in Section 13: it is
**not** built for "dashboards / dense product UI / admin panels" — which is most of what IronLog
is (a workout tracker, an analytics dashboard, a multi-step logging flow, a settings screen).
Applying its landing-page vocabulary (hero sections, bento grids, marquees, scroll-hijacking)
here would work against the product, not for it.

What this system actually takes from it:
- **Section 11, the Redesign Protocol** — audit first, preserve IA/routes/analytics hooks,
  modernize in priority order (typography → spacing → color → motion → recomposition).
- **Section 4/9, the anti-slop taste discipline** — one locked accent color, no AI-purple glow,
  no pure black/white, real interaction states (loading/empty/error, not just the happy path),
  no fake data, no em-dash, accessible contrast everywhere, shape/elevation consistency locks.

What it does **not** supply: hero paradigms, bento grids, marquees, scroll-hijack patterns. None
of that appears anywhere in this system or in the redesigned pages.

## 1. Visual Theme

**"Engineered Strength."** A training tool for someone who treats progression as an engineering
problem: measured, logged, adjusted. The visual language borrows the *structural* discipline of
technical products (Linear's dark-canvas-as-structure, Vercel's typographic precision, BMW M's
restrained signal-color) and the *typographic confidence* of athletic brands (Nike's extreme
contrast between a huge number and quiet supporting text) — without importing either category's
surface-level tells (no SaaS gradient blobs, no swoosh-red, no stock gym photography).

Two design systems studied were explicitly *not* borrowed from beyond their color-discipline
lesson: Notion's pastel-card marketing chrome and Runway's full-bleed cinematic photography don't
fit a data-driven training tool and aren't part of this system.

## 2. Brand Personality

Precise. Quiet until it needs to shout. A workout number is the loudest thing on any screen it
appears on — everything else recedes. Confident, not decorative. Never cute copy, never fake
precision, never a filler verb ("elevate," "unleash," "seamless").

## 3. Color System

One locked accent, following the Color Consistency Lock rule: it appears on primary actions,
active/focus states, and moments of real significance (a PR, an AI recommendation ready to
review) — never as page decoration. This mirrors BMW M's stripe (used only to mark significance)
more than Notion's or Superhuman's decorative palettes.

**Accent — Signal Blue** `#2F6FED` (light-mode) / `#5B8DFF` (dark-mode, lifted for contrast on a
near-black canvas). Cold and technical, not the red/orange every fitness app already uses, not
the purple every AI product already uses.

### Dark theme (primary — most training happens in low light, gyms, evenings)

| Token | Value | Use |
|---|---|---|
| `bg.canvas` | `#0a0a0c` | page background (near-black, never `#000`) |
| `bg.surface-1` | `#131316` | cards, panels |
| `bg.surface-2` | `#1a1a1e` | nested panels, active row |
| `bg.surface-3` | `#212126` | popovers, modals |
| `border.hairline` | `#2a2a30` | default dividers |
| `border.hairline-strong` | `#3a3a42` | emphasized dividers, input borders |
| `text.primary` | `#f2f2f4` | headlines, metrics |
| `text.secondary` | `#a3a3ab` | body, labels |
| `text.tertiary` | `#6b6b74` | metadata, timestamps |
| `accent` | `#5B8DFF` | primary actions, active state, AI marker |
| `accent.subtle` | `#5B8DFF1A` (10% alpha) | accent-tinted backgrounds |
| `success` | `#3DD68C` | PR, completed set, positive trend |
| `warning` | `#E8A33D` | plateau flag, fatigue signal |
| `danger` | `#E5484D` | deload flag, error, missed session |

### Light theme (analysis-at-a-desk, sharing progress, daytime)

| Token | Value | Use |
|---|---|---|
| `bg.canvas` | `#fafafa` | page background (never pure `#fff`) |
| `bg.surface-1` | `#ffffff` | cards, panels |
| `bg.surface-2` | `#f2f2f3` | nested panels |
| `bg.surface-3` | `#e9e9eb` | popovers, modals |
| `border.hairline` | `#e4e4e7` | default dividers |
| `border.hairline-strong` | `#d4d4d8` | emphasized dividers, input borders |
| `text.primary` | `#18181b` | headlines, metrics |
| `text.secondary` | `#52525b` | body, labels |
| `text.tertiary` | `#8a8a92` | metadata, timestamps |
| `accent` | `#2F6FED` | primary actions, active state, AI marker |
| `success` / `warning` / `danger` | `#1E9A5C` / `#B4740B` / `#C93B3F` | same roles, WCAG-AA on white |

**Rules:** no pure `#000000` / `#ffffff` anywhere. Semantic colors (`success`/`warning`/`danger`)
are reserved for their exact meaning — never used decoratively. Muscle-group tags (Chest, Back,
Legs, Shoulders, Biceps, Triceps) get *desaturated* neutral-family tints, not a rainbow — they're
metadata, not brand moments.

## 4. Typography

Two-family system, same discipline as Vercel's Geist/Geist Mono pairing and Runway's
label-contrast trick — because IronLog's core content *is* numbers, mono earns its place here
more than on a marketing site.

- **Sans — Geist** (`next/font/google`, weights 400/500/600/700): all UI text, headings, body.
- **Mono — Geist Mono** (weights 400/500/600): every metric — weight, reps, rest timer, dates,
  volume numbers, set counters. If a workout screen doesn't feel "engineered," it's probably
  because a number is rendering in the sans face.

| Role | Size / Weight | Tracking | Face |
|---|---|---|---|
| Workout metric (huge) | 64px / 700 | -0.02em | Mono |
| Workout metric (large) | 40px / 700 | -0.02em | Mono |
| Page title | 28px / 600 | -0.01em | Sans |
| Section heading | 18px / 600 | 0 | Sans |
| Body | 15px / 400 | 0 | Sans |
| Label / metadata | 13px / 500 | 0.01em | Sans |
| Inline metric (tables, history rows) | 14px / 500 | 0 | Mono |
| Button label | 14px / 600 | 0 | Sans |

Nike's "billboard above, catalog below" principle governs the workout screen specifically: the
current weight/reps render at 64px mono bold; the exercise name and set counter around it stay at
15-18px. There is no middle-ground size between them — the jump itself creates the hierarchy.

## 5. Spacing

8px base unit (Vercel/Nike/Runway/Notion all converge here — it's not a stylistic choice, it's
the correct default). Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`.

- Training screens: generous — `32-48px` around the active metric block. One thing on screen at a
  time earns the space (Superhuman's one-CTA-per-view discipline, applied to sets instead of
  marketing bands).
- Analysis screens: tighter — `16-24px` card padding, `24-32px` between sections. Enough
  information density to be useful without becoming a "cockpit."

## 6. Components

Shape lock (per the skill's Shape Consistency Lock rule — mixing radii is the #1 way a UI reads
as unfinished): **8px radius** for cards, inputs, and secondary buttons. **12px** for modals and
sheets. **Full pill** reserved for exactly one thing — the primary in-workout action ("Complete
Set" / "Start Workout") — so it stays unmistakable as *the* action, never diluted by pills
elsewhere (Superhuman and Nike both reserve pills for a single hero-level CTA, not universal
buttons).

No drop shadows on the dark canvas (Linear/BMW M/Runway all skip them — depth comes from the
surface ladder + hairline borders instead). Light theme uses one subtle shadow level for floating
elements only (`0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06)`), matching Vercel's
stacked-subtle-offset approach rather than a single heavy drop shadow.

**Core primitives:** `Button` (primary/secondary/ghost/pill), `Metric` (the mono display number +
label pairing), `Card`, `SectionHeader`, `Badge` (semantic-only, muscle-group tint), `Tabs`,
`WorkoutSet` (the set-row control), `ExerciseCard`, `AIInsight` / `AIRecommendation`, `Timer`,
`BottomNav` (mobile), `Sidebar` (desktop), `EmptyState`, `Skeleton`, `Dialog`, `Sheet`.

**MUI + Tailwind + shadcn ownership rule** (per the brief's instruction not to add a framework):
Tailwind utility classes own layout, spacing, and one-off styling. MUI is kept only where it's
already load-bearing (date pickers) and is re-skinned via the theme tokens above, not left at MUI
defaults. New interactive primitives are built as plain Tailwind + Radix-pattern components (no
new dependency), not new MUI components — the direction is consolidation, not further mixing.

## 7. Navigation

Rebuilt from scratch, matching Linear/Vercel's single-line, no-clutter nav discipline.

- **Desktop:** left sidebar — Home, Workout, Plan, Progress, AI Coach, History, Settings. 64px
  logo row, hairline-divided sections, active item marked by accent-tinted background + accent
  left-border (not a filled pill — reserve pills for the workout CTA only).
- **Mobile:** bottom nav, 5 items max (Home, Workout, Progress, History, AI Coach — Settings
  drops to the profile menu in AppHeader, reachable from every page, and Plan nests under
  Progress once it exists, to avoid a 7-item bottom bar), large touch targets (56px height
  minimum), current route marked by accent icon fill, not color-only (accessibility).

## 8. Data Visualization

Every chart answers one question, per the brief. Volume/progression trends use a single accent
line, mono-face axis labels, no gridline clutter, no legend when there's only one series. No
filled progress-bar-with-track visuals for confidence scores (banned pattern) — confidence renders
as a plain mono percentage next to the recommendation instead.

## 9. Workout UI (the most important surface in the product)

`VISUAL_DENSITY: 2` here — deliberately the airiest screen in the app. One exercise, one set, one
action, always. Structure, top to bottom: exercise name (18px sans) → set counter ("Set 2 / 3",
13px label) → the metric block (64px mono weight, 40px mono reps, both editable in place) →
previous performance (14px mono, muted) → rest timer (large mono countdown when active) → the
single pill-shaped primary action → the AI Coach card (only when it has something to say, never a
placeholder "no insights yet" card taking up the same space).

## 10. AI UI

Not a chat page. AI surfaces embed into the workflows the brief lists: Analyze Progress, Plan My
Week, Why Am I Stuck, What Should I Do Today, Adapt Workout, Review My Week — each a real call to
the existing `/api/v1/ai/*` endpoints, never mocked. Every AI card shows: the recommendation
(sans, primary weight), the reasoning (secondary text, one to two sentences), supporting evidence
as small mono source tags when RAG was used (e.g. `progressive-overload.md`), and explicit
action controls (Apply / Dismiss) — never just a wall of generated text. AI-originated content is
marked by a 2px accent left-border on its card, the only decorative use of the accent color
anywhere in the system.

## 11. Motion

`MOTION_INTENSITY: 4` — present, purposeful, never decorative (the skill's "motion must be
motivated" rule applies regardless of page type). Used for: set-completion confirmation (a
100-150ms scale/opacity pulse on the metric block), AI recommendation card entrance
(opacity/y translate, ~200ms), rest-timer countdown (numeric only, no spinning graphics), route
transitions (fade, ~150ms). Never: parallax, scroll-hijacking, infinite loops, magnetic cursors —
none of that belongs in a tool someone is using mid-set. All motion respects
`prefers-reduced-motion` and collapses to instant state changes.

## 12. Responsive Behavior

Breakpoints: `375 / 390 / 430` (phone) `768` (tablet) `1024+` (desktop), tested at each. The
workout screen is designed mobile-first and unapologetically single-column even on desktop — it's
a focus tool, not a dashboard, and stretching it wide would work against the one-thing-at-a-time
principle. Analysis screens (Progress, History) go multi-column starting at `md`.

## 13. Accessibility

Semantic HTML throughout (`<button>`, `<nav>`, `<main>`, proper heading order). Every interactive
element has a visible focus ring in the accent color at 2px. Color is never the only state signal
(active nav items get an icon-fill change, not just a color shift; success/danger states pair
color with an icon). Touch targets minimum 44×44px, 56px on primary workout controls. Contrast:
WCAG AA minimum body text, verified for both themes' accent-on-canvas and text-on-surface pairs
above. `prefers-reduced-motion` fully respected per Section 11.

## 14. Do / Don't

**Do:** one accent color, mono for every number, huge workout metrics, real API data everywhere,
a single primary action per workout screen, hairline borders over shadows on dark surfaces.

**Don't:** gradient hero blobs, AI-purple anywhere, a 12-card generic dashboard, pill buttons
outside the one reserved workout CTA, decorative dark mode ("dark because fitness apps are
dark" — light mode gets equal design intent), fake metrics/placeholder AI text/"coming soon"
states, em-dashes anywhere in UI copy, filled-track progress bars for confidence scores.

## 15. Reference Influences

| Reference | Borrowed (conceptually) | Not borrowed |
|---|---|---|
| **Linear** | Dark-canvas-as-structure (surface ladder instead of shadows), one locked accent, negative tracking on display type | Product-screenshot-as-hero-decoration |
| **Vercel** | Sans/mono pairing for narrative vs. technical content, stacked-subtle-shadow system for light mode | Multi-stop mesh gradient hero |
| **Nike** | Extreme typographic contrast (huge metric, quiet everything else), depth from content not chrome | Pill-everywhere geometry, red sale-signal color |
| **BMW M** | Accent color reserved for moments of real significance, heavy/light weight pairing for editorial contrast | Sharp 0-radius rectangles everywhere, tricolor stripe motif |
| **Runway** | Tight line-height for a dense, considered feel on data-heavy rows | Full-bleed cinematic photography as primary UI |
| **Superhuman** | One CTA per view/card (focus discipline), generous editorial spacing on analysis screens | Three-canvas polarity, proprietary color rotation per page |
| **Notion** | Calm information architecture, desaturated tag colors as metadata not brand moments | Pastel marketing card bands, rounded pill toggles |

The result is not a collage of any of the above — it's one accent, one shape lock, one
sans/mono pairing, applied consistently across a product whose two real contexts (training,
analysis) get deliberately different density, not different identities.
