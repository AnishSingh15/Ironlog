import type { Transition, Variants } from 'framer-motion';

// Shared Framer Motion primitives for IronLog's six named micro-interactions
// (see DESIGN.md "Motion"). Keeping these in one module means every page reaches
// for the same easing/duration language instead of re-inventing it per component.

export const springSnappy: Transition = { type: 'spring', stiffness: 420, damping: 32 };
export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 26 };

// 3. AI Insight Appears - card entrance.
export const insightAppear: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: springSoft },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.15 } },
};

// 3b. Expandable evidence/reasoning section within an insight card.
export const expandCollapse: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: 'auto', opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
};

// 1. Workout Set Complete - the celebration burst icon.
export const celebrationBurst: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 500, damping: 20 },
  },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
};

// 4. Navigation Transition - the sliding active-route indicator uses layoutId with
// this transition on both Sidebar and BottomNav so it looks like one continuous piece.
export const navIndicatorTransition: Transition = { type: 'spring', stiffness: 500, damping: 40 };

// 5. Plan Generated - completion checkmark draw-in.
export const checkmarkDraw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { pathLength: 1, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
};

// Generic fade/slide for page sections entering on data load.
export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: springSoft },
};
