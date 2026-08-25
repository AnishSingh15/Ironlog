# IronLog Design System v2

> Premium performance technology. Not a fitness app, not a SaaS dashboard, not a chatbot demo.

## 0. v2 supersedes v1

The first pass at this system (Signal Blue accent, Geist Sans, editorial/minimal cards) read as
too generic against a stronger reference: a premium athletic-performance dashboard supplied
directly as a visual benchmark (dark graphite/charcoal + red/coral accent, hero photography
treatment, muscle-group body diagram, weekly calendar grid, Manrope typography, and a labeled
interaction/animation showcase). This document describes the system that replaced it. The
`design-taste-frontend` skill's anti-slop taste discipline (one locked accent, no AI-purple, no
pure black/white, real interaction states, no fake data, shape/elevation consistency) still holds
— only the specific tokens and the degree of visual richness changed.

**One deliberate deviation from the reference:** its hero photograph is a specific external asset
this codebase doesn't have rights to reproduce. The hero *treatment* (dark duotone/gradient over
an image) is matched; that exact photo is not.

## 1. Visual Theme

**"Engineered Strength."** A training tool for someone who treats progression as an engineering
problem — measured, logged, adjusted — rendered with the confidence of an athletic performance
brand rather than a spreadsheet. Structural discipline (surface ladders instead of shadows,
negative-tracking display type, one locked accent) plus real visual richness: hero imagery,
meaningful charts, a body diagram, a calendar grid — density earns its keep instead of every
screen collapsing into a stack of identical cards.

## 2. Brand Personality

Precise. Quiet until it needs to shout. A workout number is the loudest thing on any screen it
appears on. Confident, not decorative. Never cute copy, never fake precision, never a filler verb.

## 3. Color System

One locked accent, appearing only on primary actions, active/focus states, and moments of real
significance (a PR, an AI recommendation, the active nav item) — never as page decoration.

**Accent — Iron Red** `#dc2626` (light mode) / `#f0453f` (dark mode, warmed and lifted for
contrast on a near-black canvas).

### Dark theme (primary — most training happens in low light, gyms, evenings)

| Token | Value | Use |
|---|---|---|
| `bg.canvas` | `#0e0e10` | page background |
| `bg.surface-1` | `#17171a` | cards, panels |
| `bg.surface-2` | `#1f1f23` | nested panels, active row |
| `bg.surface-3` | `#27272c` | popovers, modals |
| `border.hairline` | `#2e2e34` | default dividers |
| `border.hairline-strong` | `#3d3d45` | emphasized dividers, input borders |
| `text.primary` | `#f5f5f6` | headlines, metrics |
| `text.secondary` | `#a8a8b0` | body, labels |
| `text.tertiary` | `#6e6e78` | metadata, timestamps |
| `accent` | `#f0453f` | primary actions, active state, AI marker |
| `accent.subtle` | `#f0453f24` (14% alpha) | accent-tinted backgrounds |
| `success` | `#34d399` | PR, completed set, positive trend |
| `warning` | `#f5b342` | plateau flag, fatigue signal |
| `danger` | `#f43f6a` | destructive actions, missed session (rose, deliberately distinct hue from accent red) |
| `info` | `#60a5fa` | neutral informational tags |

### Light theme (analysis-at-a-desk, sharing progress, daytime)

| Token | Value | Use |
|---|---|---|
| `bg.canvas` | `#faf9f7` | page background (warm off-white, never pure `#fff`) |
| `bg.surface-1` | `#ffffff` | cards, panels |
| `bg.surface-2` | `#f2f1ee` | nested panels |
| `bg.surface-3` | `#e8e6e1` | popovers, modals |
| `border.hairline` | `#e2e0da` | default dividers |
| `border.hairline-strong` | `#d1cfc7` | emphasized dividers, input borders |
| `text.primary` | `#1c1b1a` | headlines, metrics (graphite, not pure black) |
| `text.secondary` | `#5b5955` | body, labels |
| `text.tertiary` | `#8c8a85` | metadata, timestamps |
| `accent` | `#dc2626` | primary actions, active state, AI marker |
| `success` / `warning` / `danger` / `info` | `#16a34a` / `#b45309` / `#e11d48` / `#2563eb` | same roles, WCAG-AA on white |

**Rules:** no pure `#000000` / `#ffffff` anywhere. `danger` is a rose/crimson, kept a visibly
different hue from the red `accent` so destructive actions never look like the primary CTA.
Semantic colors are reserved for their exact meaning, never decorative. Muscle-group tags get
desaturated neutral tints, not a rainbow.

## 4. Typography

- **Sans — Manrope** (`next/font/google`, weights 400/500/600/700): all UI text, headings, body.
- **Mono — Geist Mono** (weights 400/500/600): every metric — weight, reps, rest timer, dates,
  volume numbers, set counters, calendar labels.

| Role | Size / Weight | Tracking | Face |
|---|---|---|---|
| Workout metric (huge) | 64px / 700 | -0.02em | Mono |
| Workout metric (large) | 40px / 700 | -0.02em | Mono |
| Page title | 28px / 700 | -0.01em | Sans |
| Section heading | 18px / 600 | 0 | Sans |
| Body | 15px / 400 | 0 | Sans |
| Label / metadata | 13px / 500 | 0.01em | Sans |
| Inline metric (tables, history rows) | 14px / 500 | 0 | Mono |
| Button label | 14px / 600 | 0 | Sans |

The workout screen keeps the "billboard above, catalog below" jump: current weight/reps render at
64px mono bold, everything around them stays 15-18px sans. No middle-ground size between them.

## 5. Spacing

8px base unit. Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`.

- Training screens: generous — `32-48px` around the active metric block, one thing at a time.
- Analysis/dashboard screens: tighter — `16-24px` card padding, `24-32px` between sections. Enough
  density to feel like a real product, not a cockpit and not an empty minimalist page either.

## 6. Components

Shape lock: **8px radius** for cards, inputs, secondary buttons, dialogs. **12px** for sheets and
larger modals. **Full pill** reserved for exactly one thing — the primary in-workout action
("Complete Set" / "Start Workout") — never diluted by pills elsewhere.

No drop shadows on the dark canvas — depth comes from the surface ladder + hairline borders. Light
theme uses one subtle shadow level for floating elements only:
`0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06)`.

**Core primitives** (`apps/web/src/components/ui/`): `Button` (primary/secondary/ghost/pill/
danger), `Metric`, `AnimatedMetric` (count-up variant), `Card`, `SectionHeader`, `Badge`,
`EmptyState`, `Skeleton`, and now real Radix-backed primitives — `Dialog`, `Sheet` (bottom-sheet,
built on the same Dialog primitive), `Tabs`, `Tooltip`, `Toast` (via `sonner`). These replace MUI's
`Dialog`/`Select`/`Accordion`/`Table` on the pages being migrated; MUI stays only where nothing
else has replaced it yet.

**MUI + Tailwind + shadcn ownership rule:** Tailwind + these Radix-pattern primitives own
application UI going forward. MUI form controls (`TextField`, `Select`) remain in places not yet
migrated — the direction is consolidation onto one primitive set, not further mixing.

## 7. Navigation

- **Desktop:** left sidebar — logo mark, Home / Workout / Plan / Progress / AI Coach / History /
  Exercises, hairline-divided sections, active item marked by an accent-tinted background + accent
  left-border that animates between routes (Navigation Transition, `layoutId`-based). User identity
  (avatar, name) pinned at the bottom of the sidebar, logout reachable from there.
- **Mobile:** bottom nav, 5 items max (Home, Workout, Progress, History, AI Coach — Settings drops
  to the profile menu in `AppHeader`, Plan reaches from Home's quick-links), large touch targets
  (56px minimum), current route marked by icon fill + the same animated indicator, never color
  alone.

## 8. Data Visualization

Every chart answers one question. Volume/progression trends use the accent line, mono-face axis
labels, no gridline clutter, no legend for a single series. The muscle-group volume view uses a
simplified SVG body diagram (a handful of named `<path>` regions) shaded by relative volume rather
than a generic bar chart — it's the one place a literal illustration earns its keep. The weekly
calendar strip uses four status states only: completed / planned / missed / rest, color + icon
both carrying the meaning (never color alone).

## 9. Workout UI (the most important surface in the product)

Deliberately the airiest screen in the app. One exercise, one set, one action, always. Structure,
top to bottom: exercise name → set counter ("Set 2 / 3") → the metric block (64px mono weight,
40px mono reps) → previous performance (mono, muted) → rest timer → the single pill-shaped primary
action → inline AI coach suggestion chips ("Keep Weight" / "Adapt") when the coach has something
to say — never a placeholder "no insights yet" card taking up the same space.

## 10. AI UI

Not a chat page. AI surfaces embed into real workflows backed by real `/api/v1/ai/*` endpoints:
Analyze Progress, Plan My Week, and (only once backend support exists) Why Am I Stuck / Adapt
Today's Workout / Review My Week — the latter three render as clearly-labeled "coming soon" until
they have a real endpoint, never a faked response. Every AI card shows the recommendation, the
reasoning, supporting evidence as small mono source tags, and explicit action controls (Apply /
Dismiss). AI-originated content gets a 2px accent left-border — the only decorative use of the
accent anywhere in the system besides the nav indicator.

## 11. Motion

Six named micro-interactions, implemented once in `apps/web/src/lib/motion.ts` and reused, not
duplicated per page:

1. **Workout Set Complete** — `SetCompleteCelebration`: icon burst + "Great Set!" + weight delta,
   triggered from `handleSetSubmit` success.
2. **Progress Update** — `AnimatedMetric`: count-up animation whenever a bound number changes.
3. **AI Insight Appears** — `insightAppear`/`expandCollapse` variants: card entrance + expandable
   reasoning/evidence section.
4. **Navigation Transition** — `navIndicatorTransition`: a `layoutId`-shared active-route indicator
   sliding between icons in `Sidebar` and `BottomNav`.
5. **Plan Generated** — `checkmarkDraw`: an SVG checkmark path animation when the weekly planner
   finishes generating.
6. **Dark/Light Toggle** — `ThemeToggleSwitch`: an animated two-state switch (not an icon-cycle
   button), thumb slides via `layout` animation.

All motion respects `prefers-reduced-motion` (global CSS override in `globals.css`) and collapses
to instant state changes. Never: parallax, scroll-hijacking, infinite loops, magnetic cursors.

## 12. Responsive Behavior

Breakpoints: `375 / 390 / 430` (phone), `768` (tablet), `1024+` (desktop). The workout screen is
mobile-first and single-column even on desktop — a focus tool, not a dashboard. Dashboard/Progress/
History go multi-column starting at `md`, matching the reference's 3-across metric/panel rows.

## 13. Accessibility

Semantic HTML throughout. Every interactive element has a visible focus ring in the accent color
at 2px. Color is never the only state signal. Touch targets minimum 44×44px, 56px on primary
workout controls. Contrast: WCAG AA minimum, verified for both themes' accent-on-canvas and
text-on-surface pairs above — note the dark-mode accent was warmed and lifted specifically to hold
contrast against the near-black canvas rather than reusing the light-mode red at the same value.
`prefers-reduced-motion` fully respected per Section 11.

## 14. Do / Don't

**Do:** one accent color, mono for every number, huge workout metrics, real API data everywhere, a
single primary action per workout screen, hairline borders over shadows on dark surfaces, an
honest "coming soon" for AI actions with no backend support yet.

**Don't:** gradient hero blobs, AI-purple anywhere, pill buttons outside the one reserved workout
CTA, decorative dark mode, fake metrics/placeholder AI text, em-dashes in UI copy, filled-track
progress bars for confidence scores, using the accent red for destructive/error states (that's
`danger`, a distinct rose).
