// Standalone re-implementation of OrderService.calculateOrderTotals()'s math,
// tested against hand-calculated expected values. This is the exact formula
// from src/order/order.service.ts — if this test ever needs updating because
// the service logic changed, that's a signal the two have drifted.

const Decimal = require('decimal.js');

function calculateOrderTotals(lines, overallDiscountPercent) {
  const overallScale = new Decimal(1).minus(new Decimal(overallDiscountPercent).div(100));
  let subTotal = new Decimal(0);
  let totalTax = new Decimal(0);
  const results = [];

  for (const line of lines) {
    const qty = new Decimal(line.qty);
    const unitPrice = new Decimal(line.unitPrice);
    const discountPercent = new Decimal(line.discountPercent || 0);
    const gstRate = new Decimal(line.gstRatePercent).div(100);

    let taxableValue = new Decimal(0);
    let taxAmount = new Decimal(0);

    if (!line.isFreeItem) {
      const gross = qty.mul(unitPrice);
      const afterLineDiscount = gross.mul(new Decimal(1).minus(discountPercent.div(100)));
      taxableValue = afterLineDiscount.mul(overallScale);
      taxAmount = taxableValue.mul(gstRate);
    }
    subTotal = subTotal.plus(taxableValue);
    totalTax = totalTax.plus(taxAmount);
    results.push({ taxableValue: taxableValue.toFixed(2), taxAmount: taxAmount.toFixed(2) });
  }

  return {
    lines: results,
    subTotal: subTotal.toFixed(2),
    totalTax: totalTax.toFixed(2),
    totalValue: subTotal.plus(totalTax).toFixed(2),
  };
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`PASS: ${testName}`);
    pass++;
  } else {
    console.log(`FAIL: ${testName} — expected ${expected}, got ${actual}`);
    fail++;
  }
}

// TEST 1: Simple order, no discounts — sanity baseline
// 10 units @ ₹58, 5% GST => taxable 580.00, tax 29.00, total 609.00
{
  const r = calculateOrderTotals([{ qty: 10, unitPrice: 58, gstRatePercent: 5 }], 0);
  assertEqual(r.subTotal, '580.00', 'T1: no-discount subtotal');
  assertEqual(r.totalTax, '29.00', 'T1: no-discount tax');
  assertEqual(r.totalValue, '609.00', 'T1: no-discount total');
}

// TEST 2: Per-line discount only
// 10 units @ ₹100, 10% line discount, 18% GST
// gross=1000, after line discount(10%)=900, taxable=900 (no overall disc), tax=900*0.18=162, total=1062
{
  const r = calculateOrderTotals([{ qty: 10, unitPrice: 100, discountPercent: 10, gstRatePercent: 18 }], 0);
  assertEqual(r.subTotal, '900.00', 'T2: line-discount subtotal');
  assertEqual(r.totalTax, '162.00', 'T2: line-discount tax');
  assertEqual(r.totalValue, '1062.00', 'T2: line-discount total');
}

// TEST 3: Free item — billed at zero regardless of price/qty
{
  const r = calculateOrderTotals([{ qty: 50, unitPrice: 999, gstRatePercent: 18, isFreeItem: true }], 0);
  assertEqual(r.subTotal, '0.00', 'T3: free item subtotal is zero');
  assertEqual(r.totalTax, '0.00', 'T3: free item tax is zero');
}

// TEST 4: Overall discount scales an ALREADY line-discounted value, and each
// product's own GST rate still applies to its own share (the case that
// matters most: two products at different GST rates in the same order).
// Line A: 10 @ ₹100, 0% line disc, 5% GST  -> gross 1000
// Line B: 10 @ ₹100, 0% line disc, 18% GST -> gross 1000
// Overall discount 10% => each line's taxable = 1000 * 0.9 = 900
// Line A tax = 900*0.05 = 45.00 ; Line B tax = 900*0.18 = 162.00
// subTotal = 1800.00, totalTax = 207.00, total = 2007.00
{
  const r = calculateOrderTotals(
    [
      { qty: 10, unitPrice: 100, gstRatePercent: 5 },
      { qty: 10, unitPrice: 100, gstRatePercent: 18 },
    ],
    10,
  );
  assertEqual(r.lines[0].taxableValue, '900.00', 'T4: line A taxable after overall discount');
  assertEqual(r.lines[0].taxAmount, '45.00', 'T4: line A tax at its own 5% rate');
  assertEqual(r.lines[1].taxableValue, '900.00', 'T4: line B taxable after overall discount');
  assertEqual(r.lines[1].taxAmount, '162.00', 'T4: line B tax at its own 18% rate');
  assertEqual(r.subTotal, '1800.00', 'T4: combined subtotal');
  assertEqual(r.totalTax, '207.00', 'T4: combined tax (rates not mixed/averaged)');
  assertEqual(r.totalValue, '2007.00', 'T4: combined total');
}

// TEST 5: Line discount AND overall discount stack correctly (multiplicative, not additive)
// 10 @ ₹100, 20% line disc, 10% overall disc, 12% GST
// gross=1000, after line disc(20%)=800, after overall(10%)=720, tax=720*0.12=86.40, total=806.40
{
  const r = calculateOrderTotals([{ qty: 10, unitPrice: 100, discountPercent: 20, gstRatePercent: 12 }], 10);
  assertEqual(r.subTotal, '720.00', 'T5: stacked discounts subtotal');
  assertEqual(r.totalTax, '86.40', 'T5: stacked discounts tax');
  assertEqual(r.totalValue, '806.40', 'T5: stacked discounts total');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
