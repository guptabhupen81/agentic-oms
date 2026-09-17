// Re-implementation of PurchaseService.recommendReplenishment's math
// (src/purchase/purchase.service.ts).

const Decimal = require('decimal.js');

function recommend(currentStock, totalSoldInLookback, lookbackDays, leadTimeDays, targetCoverDays) {
  const avgDailySales = new Decimal(totalSoldInLookback).div(lookbackDays);
  const stock = new Decimal(currentStock);
  if (avgDailySales.eq(0)) return null; // no sales history -> no recommendation

  const daysOfCover = stock.div(avgDailySales);
  if (daysOfCover.gte(leadTimeDays)) return { recommend: false, daysOfCover: daysOfCover.toFixed(1) };

  const targetStock = avgDailySales.mul(targetCoverDays);
  const recommendedQty = Decimal.max(targetStock.minus(stock), 0);
  return { recommend: true, daysOfCover: daysOfCover.toFixed(1), recommendedQty: recommendedQty.toFixed(0) };
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, testName) {
  if (String(actual) === String(expected)) { console.log(`PASS: ${testName}`); pass++; }
  else { console.log(`FAIL: ${testName} — expected ${expected}, got ${actual}`); fail++; }
}

// TEST 1: Stock covers MORE than lead time -> no recommendation
{
  const r = recommend(500, 300, 30, 10, 21); // avg 10/day, cover=50 days, lead=10 -> sufficient
  assertEqual(r.recommend, false, 'T1: sufficient cover produces no recommendation');
}

// TEST 2: Stock covers LESS than lead time -> recommends up to target cover
// avg daily = 300/30=10/day, stock=50 -> cover=5 days < leadTime(10) -> recommend
// target stock = 10*21=210, recommended = 210-50=160
{
  const r = recommend(50, 300, 30, 10, 21);
  assertEqual(r.recommend, true, 'T2: insufficient cover triggers recommendation');
  assertEqual(r.daysOfCover, '5.0', 'T2: days of cover computed correctly');
  assertEqual(r.recommendedQty, '160', 'T2: recommended qty reaches target cover exactly');
}

// TEST 3: No sales history -> must not recommend (would be division-by-zero without this guard)
{
  const r = recommend(0, 0, 30, 10, 21);
  assertEqual(r, null, 'T3: zero sales history produces no recommendation, not a crash');
}

// TEST 4: Exactly at the lead-time boundary -> should NOT trigger (uses gte, not gt)
{
  const r = recommend(100, 300, 30, 10, 21); // avg=10/day, cover=10.0 == leadTime(10)
  assertEqual(r.recommend, false, 'T4: cover exactly equal to lead time does not trigger (boundary is inclusive-safe)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
