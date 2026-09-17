// Re-implementation of AllocationService's core FEFO greedy-allocation loop
// (src/allocation/allocation.service.ts) — batches sorted earliest-expiry
// first, consumed in order until the requested quantity is met or stock runs out.

const Decimal = require('decimal.js');

function allocateFefo(batches, neededQty) {
  const sorted = [...batches].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  let stillNeeded = new Decimal(neededQty);
  const takenFrom = [];

  for (const batch of sorted) {
    if (stillNeeded.lte(0)) break;
    const free = new Decimal(batch.onHand).minus(batch.allocated);
    if (free.lte(0)) continue;
    const take = Decimal.min(free, stillNeeded);
    takenFrom.push({ batchNumber: batch.batchNumber, qty: take.toFixed(2) });
    stillNeeded = stillNeeded.minus(take);
  }
  return { takenFrom, shortfall: stillNeeded.toFixed(2) };
}

let pass = 0, fail = 0;
function assertDeepEqual(actual, expected, testName) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`PASS: ${testName}`); pass++; }
  else { console.log(`FAIL: ${testName}\n  expected ${e}\n  got      ${a}`); fail++; }
}

// TEST 1: Two batches, order fits entirely in the earlier-expiring one
{
  const batches = [
    { batchNumber: 'EARLY', expiryDate: '2026-09-15', onHand: 50, allocated: 0 },
    { batchNumber: 'LATER', expiryDate: '2026-10-30', onHand: 100, allocated: 0 },
  ];
  const r = allocateFefo(batches, 30);
  assertDeepEqual(r.takenFrom, [{ batchNumber: 'EARLY', qty: '30.00' }], 'T1: fits in earliest batch alone');
  assertDeepEqual(r.shortfall, '0.00', 'T1: no shortfall');
}

// TEST 2: Order exceeds earliest batch — splits into the next one (the
// original seed-data scenario: 70 units, 50 in early batch + 100 in later)
{
  const batches = [
    { batchNumber: 'EARLY', expiryDate: '2026-09-15', onHand: 50, allocated: 0 },
    { batchNumber: 'LATER', expiryDate: '2026-10-30', onHand: 100, allocated: 0 },
  ];
  const r = allocateFefo(batches, 70);
  assertDeepEqual(
    r.takenFrom,
    [{ batchNumber: 'EARLY', qty: '50.00' }, { batchNumber: 'LATER', qty: '20.00' }],
    'T2: splits 50/20 across two batches, earliest-first',
  );
}

// TEST 3: Already-allocated stock is correctly excluded from what's free
{
  const batches = [{ batchNumber: 'B1', expiryDate: '2026-09-15', onHand: 100, allocated: 80 }];
  const r = allocateFefo(batches, 30);
  assertDeepEqual(r.takenFrom, [{ batchNumber: 'B1', qty: '20.00' }], 'T3: only free (unallocated) qty is taken');
  assertDeepEqual(r.shortfall, '10.00', 'T3: remainder correctly reported as shortfall');
}

// TEST 4: Batches given OUT of expiry order in the input — must still sort correctly
{
  const batches = [
    { batchNumber: 'LATER', expiryDate: '2026-12-01', onHand: 100, allocated: 0 },
    { batchNumber: 'EARLIEST', expiryDate: '2026-08-01', onHand: 20, allocated: 0 },
    { batchNumber: 'MIDDLE', expiryDate: '2026-10-01', onHand: 20, allocated: 0 },
  ];
  const r = allocateFefo(batches, 35);
  assertDeepEqual(
    r.takenFrom,
    [{ batchNumber: 'EARLIEST', qty: '20.00' }, { batchNumber: 'MIDDLE', qty: '15.00' }],
    'T4: sorts by expiry regardless of input order, never touches LATER',
  );
}

// TEST 5: Total stock insufficient — correct partial allocation + shortfall
{
  const batches = [{ batchNumber: 'B1', expiryDate: '2026-09-15', onHand: 10, allocated: 0 }];
  const r = allocateFefo(batches, 25);
  assertDeepEqual(r.takenFrom, [{ batchNumber: 'B1', qty: '10.00' }], 'T5: takes all available stock');
  assertDeepEqual(r.shortfall, '15.00', 'T5: reports correct shortfall');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
