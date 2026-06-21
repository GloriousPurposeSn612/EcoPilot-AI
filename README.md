# EcoPilot AI — Personal Carbon Reduction Coach

> Challenge vertical: **Carbon Footprint Awareness Platform**

EcoPilot AI helps individuals understand, visualize, and reduce their personal
carbon footprint through a transparent scoring engine, interactive simulations,
and an AI sustainability coach powered by Google Gemini.

## Problem statement

Most carbon calculators output a single number with no context and no path
forward. EcoPilot AI closes that gap: it computes a deterministic footprint,
identifies the user's largest emission source, lets them simulate realistic
lifestyle changes, and uses Gemini to generate a personalized weekly plan
grounded in their actual profile.

## Approach & logic

1. **Deterministic local calculation.** Five lifestyle inputs map to annual
   CO₂e estimates derived from public lifestyle-emission averages
   (`src/features/carbon/calc.ts`). Logic is transparent and audit-friendly.
2. **Categorization.** Total emissions are bucketed into Excellent / Good /
   Moderate / High Impact / Critical based on fixed thresholds.
3. **Decision intelligence.** The largest emission source is identified
   locally and used to prioritize recommendations — no AI required for this
   step. AI only enriches the explanations.
4. **Simulation.** Toggling lifestyle changes recomputes the projected
   footprint instantly with no network calls.
5. **AI coaching.** A single Gemini call generates 4–6 personalized
   recommendations. Output is validated with Zod; if Gemini fails, a
   deterministic fallback set is returned.

## AI decision-making process

- Deterministic logic computes the footprint, category, breakdown, and
  prioritization (largest source first).
- Gemini receives the full computed profile (not raw inputs alone) so its
  recommendations are grounded in the actual analysis.
- Gemini output is JSON-validated; malformed responses fall back gracefully.
- All AI happens server-side via a TanStack `createServerFn`; no key reaches
  the browser.

## Google Gemini integration

- Model: `google/gemini-3-flash-preview` via Lovable AI Gateway
  (`https://ai.gateway.lovable.dev/v1`).
- API key: `LOVABLE_API_KEY` (auto-provisioned by Lovable Cloud). Read only
  from `process.env` in `src/lib/ai-gateway.server.ts`.
- Timeout, retry-friendly error mapping (429, 402), and a complete fallback
  recommendation set ensure the app never crashes when AI is unavailable.

## Features

- 5-question lifestyle assessment (React Hook Form + Zod validation).
- Transparent footprint score with category, per-day breakdown, and global-
  average comparison.
- Recharts visualizations: emission-source pie chart and comparison bar chart.
- Interactive simulation engine with current vs. projected scores, reduction
  percentage, and estimated annual savings (social cost of carbon proxy).
- AI sustainability plan with impact / difficulty / estimated kg reduction
  per recommendation, prioritized by largest emission source.
- Graceful fallback recommendations when AI is unavailable.

## Architecture overview

```
src/
├─ features/carbon/
│  ├─ calc.ts              # Pure deterministic calculation + simulation
│  └─ ai.functions.ts      # createServerFn calling Gemini, Zod-validated
├─ lib/
│  └─ ai-gateway.server.ts # Server-only Gemini fetch helper
├─ routes/
│  ├─ __root.tsx           # Shell, error & 404 boundaries
│  └─ index.tsx            # Dashboard UI
└─ styles.css              # Tailwind v4 theme (green/blue sustainability palette)
```

Design principles:
- Pure functions where possible (`calc.ts` has zero side effects).
- AI is an enhancement, not a dependency.
- Single route, single page — minimal surface area, maximum maintainability.

## Setup instructions

```bash
bun install
bun dev
```

The app is served at the URL printed by Vite.

### Environment variables

| Variable           | Where             | Purpose                                       |
| ------------------ | ----------------- | --------------------------------------------- |
| `LOVABLE_API_KEY`  | Server (auto-set) | Authenticates to Lovable AI Gateway (Gemini). |

`LOVABLE_API_KEY` is auto-provisioned by Lovable Cloud — no manual setup
required. It is read only inside `*.server.ts` files / server function
handlers and never exposed to the browser. For local non-Lovable runs, set
it in a `.env` file (do not commit).

## Assumptions made

- Single-user app, no authentication, no persistence.
- Annual emission estimates use public lifestyle averages; this is an
  awareness tool, not certified accounting.
- Social cost of carbon ≈ $50/tonne for the "annual savings" indicator.
- Global per-capita average ≈ 4,800 kg CO₂e/year.

## Accessibility features

- Semantic HTML (`header`, `main`, `section`, `footer`, `h1`/`h2`/`h3`).
- All form controls have associated `<Label>` and an accessible name.
- Charts include `role="img"` and descriptive `aria-label`.
- Live region (`aria-live="polite"`) for AI loading state.
- Icons use `aria-hidden` so screen readers aren't spammed.
- Color choices use design-system tokens; contrast meets WCAG AA.
- Keyboard navigation and focus-visible inherited from shadcn primitives.
- `min-h-dvh` for proper mobile viewport handling.

## Security considerations

- `LOVABLE_API_KEY` is read only from `process.env` inside `.server.ts` files;
  no `VITE_` exposure.
- All AI calls run server-side via TanStack `createServerFn`.
- Inputs validated client- and server-side with Zod.
- AI output validated with Zod before rendering.
- Network timeouts (12 s) and explicit error mapping for 429 / 402.
- No user data persisted, transmitted, or logged beyond the AI request.

## Testing strategy

The calculation and simulation logic is intentionally pure and isolated in
`src/features/carbon/calc.ts`, making it trivial to unit test with Vitest:

```ts
import { calculateFootprint, simulate, EMPTY_TOGGLES } from "@/features/carbon/calc";

test("car + high meat = High Impact or worse", () => {
  const f = calculateFootprint({
    transport: "car", diet: "high-meat", electricity: "high",
    shopping: "frequent", flights: "frequent",
  });
  expect(["High Impact", "Critical"]).toContain(f.category);
  expect(f.largestSource).toBeDefined();
});

test("simulation reduces footprint", () => {
  const profile = { transport: "car", diet: "mixed", electricity: "high",
                    shopping: "average", flights: "occasional" } as const;
  const s = simulate(profile, { ...EMPTY_TOGGLES, reduceElectricity: true });
  expect(s.reductionKg).toBeGreaterThan(0);
});
```

UI behavior can be covered with React Testing Library against `routes/index.tsx`.

## Future improvements

- Save scenarios locally with `localStorage` for offline comparison.
- Multi-language support.
- Country-specific emission factors.
- Optional account-based history tracking.

## Deployment

Standard TanStack Start build:

```bash
bun run build
```

Deploy the output to any platform supporting the project's runtime (the
template targets edge runtimes such as Cloudflare Workers). Set
`LOVABLE_API_KEY` as a server-side secret in the deployment environment.
