# Agentic OMS — Backend (v0.1, modular monolith)

Backend for an Agentic AI-based Order Management System for FMCG distribution
(Purchase from Manufacturers → Inventory with Batch/Expiry → Order from
Retailers → FEFO Allocation → Picklist → GST Invoice → Van Sales).

## Why this architecture

**Modular monolith, not microservices.** One deployable service, split
internally into clean modules (`product`, `inventory`, `order`, `allocation`,
`invoice`, `purchase`). This is a deliberate cost decision for a low-margin
business: one container and one database to pay for, instead of the
per-service infra/monitoring overhead microservices bring. Module boundaries
are kept clean (each module only exposes its service via DI, no reaching into
another module's Prisma queries) specifically so any module *could* be
extracted into its own service later if it ever needs independent scaling —
without a rewrite.

**Same logic for Web and Mobile.** All business rules — FEFO allocation, GST
tax split, replenishment recommendation — live only in this backend. Both the
Web app and the Android app call the same REST endpoints. The Android app
additionally carries a *local, version-tracked* port of the allocation/tax
rules (built with Kotlin Multiplatform, in the mobile repo — not this one) used
**only while offline**; the moment connectivity returns, mobile defers to this
server. That's the practical way to get "same logic across native platforms"
without duplicating business logic in a form (like a DLL loaded over data-sync)
that native Android doesn't actually support.

**Explainable "agent" behaviour.** Every FEFO allocation decision is written
to the `Allocation` table with a plain-language `reasonNote` (which batch, why
that one, how many alternatives existed). Allocation math itself is
deterministic code, not an LLM call — an LLM-based agent can sit in front of
this to narrate/explain decisions or handle exceptions, but the arithmetic
that moves stock and money should never depend on model non-determinism.

## Stack

- NestJS (TypeScript) — REST API, DI, module structure
- Prisma ORM + PostgreSQL
- `decimal.js` for all quantity/money math (never use JS floats for stock or currency)

## Cost-conscious hosting (suggested)

- **DB:** Neon or Supabase free tier to start (both are Postgres-compatible, no card required at small scale)
- **App:** Render / Railway / Fly.io free-to-low tier (~$0–7/month) for a single container
- Add Redis / a queue only when a real need appears (e.g. background PDF generation) — don't pre-pay for infrastructure you don't need yet

## Getting started

```bash
npm install
cp .env.example .env    # then fill in DATABASE_URL (e.g. from Neon/Supabase)
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

> Note: this scaffold was built in a sandboxed environment without access to
> Prisma's binary CDN, so `prisma generate`/`migrate` were not run here.
> Run the commands above on your own machine — they're standard Prisma flow
> and should work immediately given the schema in `prisma/schema.prisma`.

The seed script creates one product with two batches (different expiry dates)
and a demo order — enough to immediately exercise the FEFO allocation agent:

```bash
curl -X POST http://localhost:3000/allocation/run \
  -H "Content-Type: application/json" \
  -d '{"orderId": "<order id printed by seed>", "warehouseId": "<warehouse id printed by seed>"}'
```

You should see the order line get satisfied from the earlier-expiring batch
first, splitting into the second batch only for the remainder — with an
`Allocation` row recorded for each, including the reasoning.

Then generate a picklist from that same order, and complete it:

```bash
curl -X POST http://localhost:3000/picklists/generate \
  -H "Content-Type: application/json" \
  -d '{"orderIds": ["<order id>"]}'

# Record what was actually picked for each line (defaults to 0 until you call this)
curl -X POST http://localhost:3000/picklists/lines/<picklistLineId>/pick \
  -H "Content-Type: application/json" -d '{"pickedQty": 50}'

curl -X POST http://localhost:3000/picklists/<picklistId>/complete
```

## Auth

Every route requires a JWT except `POST /auth/login` and `POST /auth/users`
(open for demo purposes — lock the latter to `ADMIN` once you have a real
admin account). Get a token, then pass it as `Authorization: Bearer <token>`
on every other call.

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "oms.exec@example.com", "password": "password123"}'
```

Role-restrict any endpoint with `@Roles(UserRole.WAREHOUSE_INCHARGE)` etc.
(see `src/auth/roles.decorator.ts`) — none of the existing endpoints have
role restrictions applied yet beyond requiring *some* valid user; add them as
your screens settle (e.g. only `WAREHOUSE_INCHARGE` should complete
picklists, only `VAN_SELLER` should record van sales).

## Agent layer (the "agentic AI" piece)

`POST /agent/chat` runs a real tool-calling loop against Claude: the model
can call `get_replenishment_recommendations`, `get_warehouse_stock`,
`explain_order_allocation`, and `create_purchase_order` — each mapped
directly to the same service methods the REST API uses, so the agent can
never bypass business logic or touch the database directly.

```bash
curl -X POST http://localhost:3000/agent/chat \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"message": "What should we reorder for warehouse <id>? Lead time is 12 days."}'
```

The response includes a `messages` array — pass that back as `history` on
your next call to continue the same conversation (the server is stateless
per request, by design, so there's no session state to keep in sync between
Web and Mobile).

Requires `ANTHROPIC_API_KEY` in `.env`. Cost note: pay-per-call, so idle time
costs nothing — fits the low-recurring-cost requirement. `MAX_TOOL_ROUNDS` in
`agent.service.ts` caps how many tool-call rounds one chat turn can take, so
a stuck loop can't run away with API spend.

## Order Management enhancements

- **Multiple products per order** — was already supported by the schema
  (`lines: []`), but is now the primary way the web app builds an order.
- **Per-line discount** (`OrderLine.discountPercent`) and **overall bill
  discount** (`Order.overallDiscountPercent`), both applied before tax. The
  overall discount scales each line's already-discounted value
  proportionally, so each product's own GST rate still applies correctly to
  its own reduced share — see `OrderService.calculateOrderTotals()`.
- **Free items** (`OrderLine.isFreeItem`) — billed at zero regardless of
  discount, but still allocated, picked, and shipped normally.
- **Order/invoice value preview** — `GET /orders/:id/value` runs the exact
  same calculation the credit-limit check and the real invoice both use, so
  the number a user previews never diverges from what they're actually
  billed. `GET /orders` (the list) includes each order's `estimatedValue` too.
- **Product search** — `GET /products?search=<code-or-name>` matches SKU or
  name, case-insensitive, capped at 20 results (type-ahead use case).
- **Stock-in-hand summary** — `GET /inventory/warehouse/:id/summary` returns
  one row per product with free quantity only (batches collapsed) — what the
  Orders page shows next to each line while it's being built.

## Forecasting & Demand

- `POST /forecast-factors`, `GET /forecast-factors` — named factors (promotion,
  product launch, competitor, special event), each scoped to either a whole
  category or one product, with a date window and an uplift %.
- `POST /forecasts` — runs a forecast: base qty (user-entered, per product) →
  scaled by quarter growth % → scaled again by every currently-active
  matching factor. Every line records which factors applied and by how much,
  in plain text (`appliedFactors`), so nothing is a black-box number.
- `GET /forecasts`, `GET /forecasts/:id` — history and detail.
- Purchase Orders now open a real `PO_HOLD` task (30-min `dueAt`) the moment
  they're drafted — `POST /purchase/orders/:id/resolve-hold` approves
  (simulates sending to SAP) or rejects (cancels). Same pattern as Order
  Validation, reused rather than reinvented.

## Masters

Full manage (create, edit, activate/deactivate) for the four masters that
change often: **Retailer, Product, Van, Warehouse**. `Manufacturer` and the
`Product Hierarchy` tree are intentionally **view-only** endpoints — no
POST/PATCH — since those are populated through Purchase onboarding and
initial setup, not day-to-day management, per the actual requirement.

- `GET/POST/PATCH /retailers`, `POST /retailers/:id/toggle-active`
- `GET/POST/PATCH /warehouses`, `POST /warehouses/:id/toggle-active`
- `GET/POST/PATCH /vans`, `POST /vans/:id/toggle-active`
- `GET/POST/PATCH /products` (extended — was read-only before), `POST /products/:id/toggle-active`
- `GET /manufacturers` — view-only
- `GET /products/hierarchy` — view-only (already existed)

None of these hard-delete — deactivating keeps history intact for anything
that already references the record (an old order still points at a real
retailer even after it's deactivated).

## Agent Tasks — the real approval/reminder backbone

`AgentTask` and `AgentEvent` are the backbone behind an Approvals inbox and
Agent Trace view: any domain service can open a task with a **real `dueAt`
timestamp** (not a client-side fake countdown) when something needs a human,
and every agent decision — auto or human-assisted — writes an `AgentEvent`
row. Currently wired for real:

- **Order validation** (`POST /orders/:id/validate`) — runs the 3 checks
  (stock availability, credit limit, min/max order qty) against real data.
  Any failure sets the order to `VALIDATION_HOLD` and opens a real
  `ORDER_VALIDATION` task with `dueAt` = now + 30 minutes.
- **Resolution** (`POST /orders/:id/resolve-validation`) — approve overrides
  the failed check and returns the order to `DRAFT` (ready to allocate);
  reject cancels it.
- `GET /agent-tasks` — every pending task, any type (Approvals inbox).
- `GET /agent-tasks/events` — recent agent decisions (Agent Trace).

Other task types (`PO_HOLD`, `COST_APPROVAL`, `DELIVERY_DISPUTE`,
`BREAKDOWN_WATCHDOG`) exist in the schema as the next phases of this same
pattern, but nothing creates them yet — see "Not yet built" below.

## Module map

| Module | Responsibility |
|---|---|
| `product` | Product hierarchy (N levels), product master, delta sync endpoint |
| `inventory` | Stock by warehouse+batch, manual adjustments, stock transfers |
| `order` | Order + order lines, idempotent create (for offline-upload-on-sync) |
| `allocation` | **Order Allocation Agent** — FEFO allocation, auditable decisions |
| `picklist` | Groups allocations into per-warehouse picklists, tracks picking + discrepancies, deducts stock on completion |
| `invoice` | India GST invoice generation (CGST/SGST vs IGST), van-direct invoices |
| `purchase` | Purchase orders to Manufacturers, replenishment recommendation ("Purchase Agent"), GRN/batch receipt |
| `van` | Van load (warehouse → van), direct sale (invoice, no order), end-of-day unload/reconciliation |
| `auth` | JWT login, global auth guard (`@Public()` to exempt), `@Roles()` guard for role restriction |
| `agent` | LLM tool-calling agent (Claude) — Purchase recommendations, stock lookup, allocation explanation, in natural language |
| `agent-task` | Generic approval-queue + audit-trail (`AgentTask`, `AgentEvent`) — backbone for Approvals inbox and Agent Trace |
| `masters` | Retailer, Warehouse, Van CRUD + view-only Manufacturer — the four/two master-data split |
| `forecast` | Named factors + forecast runs with per-line explainability |

## Not yet built (next increments)

- Demand Agent: manufacturer cadence, 4-week recalibration, truck-capacity
  top-up, and the `PO_HOLD` task type with real 30-min auto-send-to-SAP
- Fulfilment Agent: route planning (biggest→smallest truck), GPS geofence
  delivery confirmation, the `COST_APPROVAL` and `DELIVERY_DISPUTE` task types
- Fleet Agent: vehicles, trip logs, the `BREAKDOWN_WATCHDOG` task type
- Forecasting: quarter growth/weight/factor model and its approval flow
- A real scheduler (e.g. `@nestjs/schedule`) to auto-resolve a task when
  `dueAt` passes with no human action, instead of it just sitting `PENDING`
- Role restrictions on individual endpoints (infrastructure is in place via `@Roles()`, just not applied per-route yet)
- Mobile sync contract doc (what "download masters" / "upload transactions"
  actually looks like as request/response shapes)
- Multi-warehouse allocation (today the caller picks one warehouse per
  allocation run; a fuller version could let the agent choose the warehouse too)
- Persisting agent conversation history server-side (currently the client
  round-trips the whole history each call, per the API's stateless pattern)
