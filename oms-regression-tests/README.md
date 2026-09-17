# Agentic OMS — Regression tests (core logic)

Standalone checks for the three calculation areas most likely to silently
break as the app changes: order discount/tax math, FEFO batch allocation,
and replenishment recommendation math. No database, no running backend, no
network — these re-implement the exact formulas from the real service files
and assert against hand-calculated expected values, so they run anywhere in
under a second.

**These are not a substitute for the manual Test Script workbook** — they
only cover pure calculation logic, not the API, the database, or the UI.
Run the Test Script by hand against your live instance for everything else;
run these any time you change the calculation logic itself, as a fast
sanity check before you even deploy.

## What's covered, and why these three

- **`order-value-calc.test.js`** — mirrors `OrderService.calculateOrderTotals()`
  in `oms-backend/src/order/order.service.ts`. Covers: no discount, per-line
  discount, free items, overall discount interacting correctly with
  per-line discount, and — the case most likely to silently break — two
  products at different GST rates in the same order with an overall
  discount, confirming each is taxed at its own rate rather than averaged.
- **`fefo-allocation.test.js`** — mirrors the greedy batch-selection loop in
  `oms-backend/src/allocation/allocation.service.ts`. Covers: simple
  single-batch fulfilment, splitting across batches when the earliest one
  isn't enough, correctly excluding already-allocated stock, batches fed in
  the wrong order (must still sort by expiry), and insufficient total stock.
- **`replenishment.test.js`** — mirrors the days-of-cover math in
  `oms-backend/src/purchase/purchase.service.ts`. Covers: sufficient cover
  (no recommendation), insufficient cover (correct recommended quantity),
  zero sales history (must not divide by zero), and the exact lead-time
  boundary.

## Running it

```bash
npm install
npm test
```

Or run a single suite directly:

```bash
node order-value-calc.test.js
node fefo-allocation.test.js
node replenishment.test.js
```

Each prints one `PASS`/`FAIL` line per assertion and a final count. `npm
test` runs all three and exits non-zero if any assertion anywhere failed —
safe to drop into a CI step later if this project ever gets one.

## Keeping these honest

These are **re-implementations**, not imports of the real backend code —
they were written by reading the actual service files and copying the exact
formula, not by guessing. That means they can drift out of sync if the real
logic changes without this file being updated too. If you ever change the
discount, allocation, or replenishment math in the backend, treat a
still-passing run of these tests as a signal to double-check they were
actually updated to match — not as proof the change is correct.

A more robust long-term setup would import the real service classes
directly (with Prisma mocked out), so drift becomes structurally
impossible. That's a reasonable next step if this app keeps growing, but
wasn't necessary to get real, executable coverage on the highest-risk math
today.
