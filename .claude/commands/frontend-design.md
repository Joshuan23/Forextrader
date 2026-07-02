---
name: frontend-design
description: Design and implement new UI components for the Forex trading dashboard
---

Help design, prototype, and implement frontend components for this Next.js + Tailwind CSS Forex trading application.

Usage: `/frontend-design <component-or-feature-description>`

Steps:
1. **Clarify scope** from $ARGUMENTS — what component, page, or user flow needs work?
2. **Check existing patterns** — read the relevant files in `components/` and `app/` to understand current conventions before writing new code.
3. **Design first** — describe the component's layout, state, and interactions in 3-5 bullet points before writing any code.
4. **Implement** using:
   - Functional React components with TypeScript.
   - Tailwind CSS utility classes (no inline styles, no CSS modules unless the file already uses them).
   - The shared primitives: `<Card>` (`components/ui/Card.tsx`), `<Badge>` (`components/ui/Badge.tsx`).
   - Recharts for any new chart surface.
5. **Verify** — after writing the component, trace through at least one data scenario (loading, populated, empty/error) to confirm the UI handles each state correctly.

Design principles for this project:
- Information density over whitespace — traders scan, not read.
- Live data must never cause layout shift; use fixed-width mono fonts for numbers.
- Every new component must be usable without JavaScript (SSR-safe; no `window` access at module level).
- Mobile layout is secondary; optimize for 1440 px widescreen first.

Do not add animations, transitions, or micro-interactions unless explicitly requested.
