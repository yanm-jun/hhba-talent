# HHBA front-end icon design system

## Scope and quality baseline

The source of truth is `apps/web/src/styles/icon-system.css` for all existing `lucide-react` icons in the HHBA web React application. Both admin preview surfaces use an equivalent `icon-system.css` appropriate for their hand-authored SVGs.

- Preserve existing icon meaning, attributes, width, height, controls and page layout.
- Use the existing HHBA design tokens through `currentColor`; do not introduce unrelated green or gradients.
- Keep an approximately 1.8 stroke, rounded joins/caps, and optical alignment.
- Animate only actionable icons on hover-capable pointer devices: a restrained 1 px lift and subtle active feedback.
- Animate processing icons only when they represent progress.
- Respect `prefers-reduced-motion`; no hover-dependent interactions on touch devices.
- Do not modify the HHBA logo, employer marks, country flags, photo credits, QR codes, data charts, signatures, or editorial illustrations.

## Full inventory and review

Run `node apps/web/scripts/audit-ui-icons.mjs --json` from the repository root. The icon inventory CI attaches `hhba-frontend-icon-inventory` to this PR.

The inventory reports icon evidence across `apps/web/src`, `apps/web/public/preview-admin`, `apps/admin-preview` and `apps/browser-extension`. The candidate counts are **not** a claim of 100% visual coverage. Review inline SVG and symbol/emoji candidates in context before replacing them; do not blindly replace a country's flag, a brand mark, a QR code, or text arrows.

## Acceptance checklist

1. All interactive icons are legible on mobile and desktop, at 100% and 200% zoom.
2. Hover and selected states retain original button behaviour and focus rings.
3. Document editors, PDF/Word previews, and charts have no global SVG sizing regressions.
4. Loading animations do not conflict with existing application states.
5. Reduced-motion mode has no icon animation.
6. Screenshot comparisons are reviewed before merging. This branch does not auto-deploy to production.
