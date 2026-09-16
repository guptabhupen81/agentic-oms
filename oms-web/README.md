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

## The workspace shell (tabs, not page navigation)

The whole authenticated app is now **one page** (`app/page.tsx`) rather than
15 separate routes navigated via links. Every sidebar click opens or
switches to a **tab** in React state — a real route change would unmount
the entire tree and lose every other open tab's work, which defeats the
point of tabs. Dashboard is permanently pinned as tab zero and can't be
closed; up to 5 more can be open alongside it (6 total) — trying to open a
7th prompts to close one first, and closing any non-Dashboard tab asks for
confirmation first.

The individual route files (`/orders`, `/masters/products`, etc.) still
exist and still work as real Next.js routes — the shell just imports each
one's component directly and renders it inside a tab, so there's exactly one
implementation of each screen, not two. Known limitation: visiting one of
those routes directly by URL renders it standalone, without the
sidebar/tab chrome — the primary flow is always through `/` after login.

**Dashboard** (`/`, after login) shows one live summary card per agent,
pulling from the same endpoints each agent's own page uses — click any card
to open that agent's tab.

## Getting started

```bash
npm install
npm run dev
```

Log in at `/login` — you'll land on the Dashboard afterward, not Orders.

1. **Dashboard** — click any agent card to open its tab.
2. **Orders** — the order builder now supports everything at once: search a
   product by SKU or name, see its real stock-in-hand for the selected
   warehouse before adding it, add multiple lines, set a per-line discount
   or mark a line free, set an overall bill discount, and watch the live
   order value total update as you go. Create the order, then validate and
   allocate as before.
2. **Picklist** — generate a picklist from that order's ID, record picks,
   complete it (watch for the discrepancy warning if picked ≠ requested).
3. **Van sales** — load a van from a warehouse batch, record a direct sale
   (generates a real GST invoice), unload at day's end.
4. **Approvals / Agent Trace** — real, not mock: click **Validate order** on
   the Orders page first. If it fails a check (try ordering more than the
   seeded product's `maxOrderQty` of 500, or exceeding stock), a real task
   appears in **Approvals** with a genuine countdown computed from the
   server's `dueAt` — refresh the page and the timer keeps counting from the
   true remaining time, because it's not client-side state. Approve/reject
   it there, then check **Agent Trace** for the event log this generated.
5. **Masters** (sidebar) — create/edit/deactivate Retailers, Products, Vans,
   and Warehouses directly; Manufacturers and Product Hierarchy are
   view-only lists, matching the spec exactly. Creating a retailer or
   product here means you no longer need Prisma Studio to get real IDs for
   the Orders page — copy them straight from these tables. Retailers,
   Products, Vans, and Warehouses all show their manually-entered code
   (Retailer's `code`, Product's `sku`, Van's `registration`, Warehouse's
   `code`) as the first column in every list.
6. **Demand Agent** (`/demand`) — pick a warehouse, get real replenishment
   recommendations from actual sales velocity, click "Create PO" to draft
   one — watch the real 30-minute hold countdown, same mechanic as order
   validation. Release or cancel it right there, or from Approvals. You can
   also build a **manual PO** directly (pick a manufacturer, search and add
   products) without going through a recommendation, and record a **Goods
   Receipt** against any sent/partially-received PO — pick the line, enter
   batch number, dates, quantity, warehouse, and optionally which truck
   delivered it; watch the PO's status move to Partially Received or
   Received automatically once you do.
7. **Forecast Agent** (`/forecasting`) — add a named factor (promotion,
   launch, competitor, event) scoped to a category or product, then run a
   forecast with a base quantity per product — see exactly which factors
   moved which line and by how much.
8. **Inventory Agent** (`/inventory`) — real-time stock across every
   warehouse, by batch, with free vs. allocated quantity broken out.

The sidebar is grouped into **Agents** (the operational, agent-driven
screens) and **Masters** (the data you manage directly) — matching how the
system is meant to be read: masters are what agents reason over.

Landing page (`/`) now redirects to `/login`, not `/orders` — you always
start from an explicit sign-in.

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
