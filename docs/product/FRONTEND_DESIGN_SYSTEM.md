# Frontend Design System (Landing & Dashboard Primer)

Source of truth: `packages/ui/src/app/page.tsx` (landing) and shared UI primitives in `packages/ui/src/components/ui`.

## Layout
- Section padding: `py-16 md:py-20`.
- Container: `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8` (use for landing and dashboard content widths).

## Cards
- Marketing card (simple): `rounded-xl border border-slate-200 bg-white/60 p-4 md:p-6 shadow-sm`.
- Trust/security cards: `rounded-xl border bg-white p-6 md:p-8 shadow-lg hover:shadow-xl`.
- Dashboard card (default `Card`): `rounded-xl border bg-card py-6 px-6 shadow-sm`.
- Grid gaps: `gap-4 md:gap-6` (cards); sections use `space-y-6` or `space-y-8`.

## Typography
- H1: `text-3xl md:text-4xl font-bold` (hero/section tops).
- H2: `text-2xl md:text-3xl font-semibold`.
- H3/card titles: `text-lg md:text-xl font-semibold` or `text-base font-semibold` for compact cards.
- Body: `text-base text-slate-700` (landing), `text-sm text-muted-foreground` for supporting copy.
- Small/labels: `text-xs text-muted-foreground`.

## Actions (Buttons)
- Primary CTA: `Button` `variant="default"` (violet/blue gradient) or `variant="oxy"` (brand #0066FF); sizes `default` or `lg` for CTAs.
- Secondary: `variant="outline"` for secondary actions; `secondary` for subtle fills.
- Ghost/Text: `variant="ghost"` or `variant="link"` for minimal/link-style.
- Danger: `variant="destructive"` for destructive actions.

## Badges / Chips
- Use `Badge` variants: `default`, `secondary` (neutral/“success” states), `destructive` (error), `outline` (muted).
- Avoid custom variants; keep status chips compact (`text-xs`, `px-2 py-0.5` default).
- For setup/progress/plan labels, prefer `secondary`; for revoked/failed, use `destructive`.

## Containers & spacing quick recipe
- Section: `<section className="py-16 md:py-20">`
- Container: `<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">`
- Card grid: `<div className="grid gap-4 md:gap-6 lg:grid-cols-3">`

## Notes
- Do not alter product copy or SLAs when applying styles; keep legal/disclaimer text intact.
- Reuse primitives in `packages/ui/src/components/ui` before adding new bespoke styles.

