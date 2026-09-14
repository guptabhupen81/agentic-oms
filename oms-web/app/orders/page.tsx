'use client';

import { useEffect, useState } from 'react';
import { api, session, ApiError } from '../../lib/api';
import type {
  AllocationResult,
  OrderListItemDto,
  OrderResponse,
  OrderValueResultDto,
  ProductDto,
  RetailerDto,
  StockSummaryDto,
  ValidateOrderResult,
  WarehouseDto,
} from '../../lib/types';

function newClientOrderId() {
  // crypto.randomUUID() only works in a "secure context" (HTTPS, or
  // localhost) — this app is often accessed over plain http:// via a raw
  // IP address during early testing, where that API is unavailable by
  // browser spec. clientOrderId only needs to be unique per device, not
  // cryptographically random, so a plain fallback is fine.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `web-${crypto.randomUUID()}`;
  }
  const rand = () => Math.random().toString(16).slice(2);
  return `web-${Date.now().toString(16)}-${rand()}-${rand()}`;
}

interface DraftLine {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  gstRatePercent: number;
  orderedQty: string;
  discountPercent: string;
  isFreeItem: boolean;
}

/** Mirrors OrderService.calculateOrderTotals() exactly — per-line discount,
 * then the overall bill discount scales each already-discounted line
 * proportionally, THEN tax is computed. Client-side so the user sees a live
 * total while building the order, before it even exists server-side; the
 * server recomputes the authoritative figure the same way once created. */
function computeLineTotal(line: DraftLine, overallDiscountPercent: number) {
  const qty = Number(line.orderedQty) || 0;
  if (line.isFreeItem) return { taxable: 0, tax: 0, total: 0 };
  const gross = qty * line.unitPrice;
  const afterLineDiscount = gross * (1 - (Number(line.discountPercent) || 0) / 100);
  const taxable = afterLineDiscount * (1 - overallDiscountPercent / 100);
  const tax = taxable * (line.gstRatePercent / 100);
  return { taxable, tax, total: taxable + tax };
}

export default function OrdersPage() {
  const [retailers, setRetailers] = useState<RetailerDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [retailerId, setRetailerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [overallDiscountPercent, setOverallDiscountPercent] = useState('0');

  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<ProductDto[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Record<string, StockSummaryDto>>({});
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [orders, setOrders] = useState<OrderListItemDto[]>([]);
  const [createdOrder, setCreatedOrder] = useState<OrderResponse | null>(null);
  const [createdOrderValue, setCreatedOrderValue] = useState<OrderValueResultDto | null>(null);
  const [validation, setValidation] = useState<ValidateOrderResult | null>(null);
  const [allocation, setAllocation] = useState<AllocationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshOrders() {
    try {
      setOrders(await api.listOrders());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refreshOrders();
    api.listRetailers(true).then(setRetailers).catch(() => {});
    api.listWarehouses(true).then(setWarehouses).catch(() => {});
  }, []);

  // Refresh stock-in-hand whenever the warehouse changes, for every product
  // already added to the order (not just future searches).
  useEffect(() => {
    if (!warehouseId) {
      setStockByProduct({});
      return;
    }
    api.getWarehouseStockSummary(warehouseId).then((rows) => {
      const map: Record<string, StockSummaryDto> = {};
      rows.forEach((r) => { map[r.productId] = r; });
      setStockByProduct(map);
    }).catch((err) => {
      setError(err instanceof ApiError ? err.message : String(err));
    });
  }, [warehouseId]);

  async function handleProductSearch(query: string) {
    setProductQuery(query);
    if (query.trim().length === 0) {
      setProductResults([]);
      return;
    }
    try {
      setProductResults(await api.searchProducts(query));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  function addLine(product: ProductDto) {
    if (lines.some((l) => l.productId === product.id)) return; // already added
    setLines((ls) => [
      ...ls,
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unitPrice: Number(product.defaultUnitPrice ?? 0),
        gstRatePercent: Number(product.gstRatePercent),
        orderedQty: '1',
        discountPercent: '0',
        isFreeItem: false,
      },
    ]);
    setProductQuery('');
    setProductResults([]);
  }

  function updateLine(productId: string, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: string) {
    setLines((ls) => ls.filter((l) => l.productId !== productId));
  }

  const overallDiscountNum = Number(overallDiscountPercent) || 0;
  const liveTotals = lines.reduce(
    (acc, line) => {
      const { taxable, tax, total } = computeLineTotal(line, overallDiscountNum);
      return { subTotal: acc.subTotal + taxable, totalTax: acc.totalTax + tax, totalValue: acc.totalValue + total };
    },
    { subTotal: 0, totalTax: 0, totalValue: 0 },
  );

  async function handleCreateOrder() {
    setError(null);
    if (!retailerId) { setError('Select a retailer'); return; }
    if (lines.length === 0) { setError('Add at least one product'); return; }
    setBusy(true);
    try {
      const createdById = session.getUserId();
      if (!createdById) throw new Error('Log in first');

      const order = await api.createOrder({
        clientOrderId: newClientOrderId(),
        retailerId,
        createdById,
        sourceType: 'OMS_EXECUTIVE',
        overallDiscountPercent: overallDiscountNum,
        lines: lines.map((l) => ({
          productId: l.productId,
          orderedQty: Number(l.orderedQty) || 0,
          discountPercent: Number(l.discountPercent) || 0,
          isFreeItem: l.isFreeItem,
        })),
      });
      setCreatedOrder(order);
      setCreatedOrderValue(await api.getOrderValue(order.id));
      setValidation(null);
      setAllocation(null);
      setLines([]);
      setOverallDiscountPercent('0');
      await refreshOrders();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleValidate() {
    if (!createdOrder || !warehouseId) return;
    setError(null);
    setBusy(true);
    try {
      setValidation(await api.validateOrder(createdOrder.id, warehouseId));
      await refreshOrders();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAllocate() {
    if (!createdOrder || !warehouseId) return;
    setError(null);
    setBusy(true);
    try {
      setAllocation(await api.runAllocation(createdOrder.id, warehouseId));
      await refreshOrders();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>New order</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Recent orders</h2>
        {orders.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No orders yet.</p>
        ) : (
          <table>
            <thead><tr><th>Order</th><th>Retailer</th><th>Lines</th><th>Value</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.orderNumber}</td>
                  <td>{o.retailer.code} — {o.retailer.name}</td>
                  <td className="mono">{o.lines.length}</td>
                  <td className="mono">₹{o.estimatedValue}</td>
                  <td><span className="status-pill">{o.status}</span></td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(o.orderDate).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Build order</h2>
        <div className="row">
          <div className="field">
            <label>Retailer</label>
            <select value={retailerId} onChange={(e) => setRetailerId(e.target.value)}>
              <option value="">Select…</option>
              {retailers.map((r) => (
                <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Warehouse (for stock visibility)</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Select…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field" style={{ position: 'relative' }}>
          <label>Search product by code or name</label>
          <input
            value={productQuery}
            onChange={(e) => handleProductSearch(e.target.value)}
            placeholder="e.g. FRESHCO or Milk"
          />
          {productResults.length > 0 && (
            <div className="card" style={{ position: 'absolute', zIndex: 10, width: '100%', marginTop: 4, padding: 4 }}>
              {productResults.map((p) => (
                <div
                  key={p.id}
                  onClick={() => addLine(p)}
                  style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                >
                  <span className="mono">{p.sku}</span> — {p.name}
                  {warehouseId && (
                    <span style={{ float: 'right', color: 'var(--text-muted)' }} className="mono">
                      SIH: {stockByProduct[p.id]?.stockInHand ?? '0.00'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr><th>Product</th><th>SIH</th><th>Qty</th><th>Discount %</th><th>Free</th><th>Line total</th><th></th></tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const { total } = computeLineTotal(line, overallDiscountNum);
                const sih = stockByProduct[line.productId]?.stockInHand;
                return (
                  <tr key={line.productId}>
                    <td>{line.name} <span className="mono" style={{ color: 'var(--text-muted)' }}>({line.sku})</span></td>
                    <td className="mono" style={{ color: warehouseId && sih !== undefined && Number(sih) < Number(line.orderedQty) ? 'var(--error)' : undefined }}>
                      {warehouseId ? (sih ?? '0.00') : '—'}
                    </td>
                    <td style={{ width: 80 }}>
                      <input
                        type="number"
                        value={line.orderedQty}
                        onChange={(e) => updateLine(line.productId, { orderedQty: e.target.value })}
                      />
                    </td>
                    <td style={{ width: 90 }}>
                      <input
                        type="number"
                        value={line.discountPercent}
                        disabled={line.isFreeItem}
                        onChange={(e) => updateLine(line.productId, { discountPercent: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={line.isFreeItem}
                        onChange={(e) => updateLine(line.productId, { isFreeItem: e.target.checked })}
                      />
                    </td>
                    <td className="mono">₹{total.toFixed(2)}</td>
                    <td><button className="secondary" onClick={() => removeLine(line.productId)}>Remove</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="row" style={{ marginTop: 16, alignItems: 'flex-end' }}>
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Overall discount % (before tax)</label>
            <input
              type="number"
              value={overallDiscountPercent}
              onChange={(e) => setOverallDiscountPercent(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Subtotal ₹{liveTotals.subTotal.toFixed(2)} + Tax ₹{liveTotals.totalTax.toFixed(2)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Order value: ₹{liveTotals.totalValue.toFixed(2)}</div>
          </div>
        </div>

        <button onClick={handleCreateOrder} disabled={busy} style={{ marginTop: 12 }}>Create order</button>
        {error && <p className="error-text">{error}</p>}
      </div>

      {createdOrder && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Order created</h2>
          <p className="mono">
            {createdOrder.orderNumber} — <span className="status-pill">{createdOrder.status}</span>
            {createdOrderValue && <> — value ₹{createdOrderValue.totalValue}</>}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleValidate} disabled={busy || !warehouseId}>Validate order</button>
            <button
              className="secondary"
              onClick={handleAllocate}
              disabled={busy || !warehouseId || validation?.passed !== true}
            >
              Run allocation (FEFO)
            </button>
          </div>
        </div>
      )}

      {validation && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Validation — {validation.passed ? 'passed' : 'on hold'}</h2>
          <table>
            <thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead>
            <tbody>
              {validation.checks.map((c, i) => (
                <tr key={i}>
                  <td>{c.name}</td>
                  <td><span className="status-pill" style={{ color: c.passed ? 'var(--success)' : 'var(--error)' }}>{c.passed ? 'Pass' : 'Fail'}</span></td>
                  <td className="mono" style={{ fontSize: 12 }}>{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!validation.passed && (
            <p className="error-text" style={{ marginTop: 12 }}>
              Order is on hold. A task was opened in <a href="/approvals">Approvals</a> (due{' '}
              {validation.dueAt ? new Date(validation.dueAt).toLocaleTimeString() : '—'}) — approve there to override, or reject to cancel.
            </p>
          )}
        </div>
      )}

      {allocation && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Allocation result — {allocation.fullyAllocated ? 'fully allocated' : 'partial'}</h2>
          {allocation.lines.map((line) => (
            <div key={line.orderLineId} style={{ marginBottom: 12 }}>
              <p className="mono">
                Ordered {line.orderedQty} — allocated {line.allocatedQty}
                {Number(line.shortfallQty) > 0 && ` — short ${line.shortfallQty}`}
              </p>
              <table>
                <thead>
                  <tr><th>Batch</th><th>Expiry</th><th>Qty taken</th></tr>
                </thead>
                <tbody>
                  {line.batchesUsed.map((b) => (
                    <tr key={b.batchId}>
                      <td className="mono">{b.batchNumber}</td>
                      <td>{b.expiryDate.slice(0, 10)}</td>
                      <td className="mono">{b.qtyTaken}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p style={{ marginTop: 12 }}>
            Next: go to <a href="/picklists">Picklist</a> with order ID <span className="mono">{allocation.orderId}</span>.
          </p>
        </div>
      )}
    </div>
  );
}
