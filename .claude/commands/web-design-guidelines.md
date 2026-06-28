---
name: web-design-guidelines
description: Apply consistent visual and UX design guidelines to the Forex trading dashboard
---

Enforce the design system and UX conventions used throughout this Next.js Forex trading app.

When reviewing or writing UI code, apply these guidelines:

**Color & Theme**
- Dark background (`#0f172a` slate-900) for all dashboard surfaces.
- Accent green (`#22c55e`) for positive P&L and buy signals; accent red (`#ef4444`) for negative P&L and sell signals.
- Muted text (`#94a3b8` slate-400) for secondary labels; white for primary values.
- Never introduce new colors outside the Tailwind slate/green/red palette without a design reason.

**Typography**
- Headings: `font-semibold text-white`.
- Metric values: `font-mono text-2xl` (tabular numbers prevent layout shift on live data).
- Labels: `text-xs text-slate-400 uppercase tracking-wide`.

**Layout**
- All cards use the shared `<Card>` component in `components/ui/Card.tsx`.
- Grid layouts follow a 12-column system; sidebar is fixed at 240 px.
- Responsive breakpoints: stack columns below `md` (768 px).

**Data Tables**
- Alternating row backgrounds: `even:bg-slate-800/50`.
- Numeric cells right-aligned, text cells left-aligned.
- Always include a loading skeleton and an empty-state message.

**Charts**
- Use Recharts with the dark theme from `components/charts/`.
- Tooltips: dark background with `border border-slate-700`.
- Axes: `stroke="#475569"` (slate-600), tick color `#94a3b8`.

**Accessibility**
- All interactive elements must have visible focus rings: `focus-visible:ring-2 focus-visible:ring-blue-500`.
- Color must never be the sole differentiator — pair color with an icon or label.

When $ARGUMENTS is provided, apply these guidelines specifically to the named component or page.
