# Agentic OMS — Web app (v0.1)

Next.js (App Router, TypeScript) client for the OMS backend. Verified: this
one **does** build cleanly in this sandbox (`npx next build` — full
type-check + static generation passed) since npm/Next's own toolchain was
reachable here, unlike the Android/Gradle and Prisma-engine cases.

## Why these choices

**No state library, no Tailwind.** A handful of pages each with 2-3 pieces
of local state doesn't earn Redux/Zustand — `useState` and prop passing is
the honest amount of complexity. Plain CSS with a small token system
(`globals.css`) instead of Tailwind, for the same reason: this app doesn't
have enough surface area to need a utility-class system yet.

**Same contract as Android, on purpose.** `lib/types.ts` and `lib/api.ts`
describe exactly the same backend endpoints and shapes as the Android
client's DTOs/`OmsApiService`. Neither client reinterprets a business rule —
both just call the one backend. If you're presenting this as a showcase,
this is the concrete answer to "how did you keep web and mobile consistent."

**Deliberately not the generic AI-generated look.** Dark slate-teal
background (not the near-black-with-one-accent template), amber as the one
functional accent (apt for a logistics/warehouse tool, not decorative),
IBM Plex Mono reserved for things that are actually tabular/code-like
(batch numbers, IDs, quantities) rather than sprinkled on as a stylistic
tic. See `app/globals.css` for the token list.

**No offline handling.** Unlike the Android app, this is a straightforward
online client — matches the brief ("Web can be accessed online"). If a call
fails, the page shows the error; there's no local queue.

## Getting started

```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:3000`) if your
backend isn't on the default port. Log in with the seeded demo account
(`oms.exec@example.com` / `password123`), then walk through:

1. **Orders** — create an order, then run FEFO allocation against a
   warehouse ID (from the backend seed output) — see the batch split live.
2. **Picklist** — generate a picklist from that order's ID, record picks,
   complete it (watch for the discrepancy warning if picked ≠ requested).
3. **Van sales** — load a van from a warehouse batch, record a direct sale
   (generates a real GST invoice), unload at day's end.

## What's here vs. not yet built

Same gaps as the backend/Android README's "not yet built" lists — this is a
thin client over that API, so it inherits them: no retailer/warehouse/batch
picker UI (IDs are typed in manually, same limitation as the Android van
screen), no role-based view restriction, no persisted picklist/van-load
history list (you navigate by ID).

## Module map

- `lib/types.ts` — shared TS types mirroring backend DTOs
- `lib/api.ts` — fetch wrapper, JWT storage (localStorage), all backend calls
- `app/login`, `app/orders`, `app/picklists`, `app/van` — the four screens
- `app/layout.tsx` + `app/sidebar-nav.tsx` — shell and navigation
- `app/globals.css` — the whole design token system, in one place
