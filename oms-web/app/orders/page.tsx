'use client';

import { useState } from 'react';
import { api, session, ApiError } from '../../lib/api';
import type { AllocationResult, OrderResponse } from '../../lib/types';

function newClientOrderId() {
  return `web-${crypto.randomUUID()}`;
}

export default function OrdersPage() {
  const [retailerId, setRetailerId] = useState('');
  const [productId, setProductId] = useState('');
  const [orderedQty, setOrderedQty] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const [createdOrder, setCreatedOrder] = useState<OrderResponse | null>(null);
  const [allocation, setAllocation] = useState<AllocationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const createdById = session.getUserId();
      if (!createdById) throw new Error('Log in first');

      const order = await api.createOrder({
        clientOrderId: newClientOrderId(),
        retailerId,
        createdById,
        sourceType: 'OMS_EXECUTIVE',
        lines: [{ productId, orderedQty: Number(orderedQty) }],
      });
      setCreatedOrder(order);
      setAllocation(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAllocate() {
    if (!createdOrder) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api.runAllocation(createdOrder.id, warehouseId);
      setAllocation(result);
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
        <form onSubmit={handleCreateOrder}>
          <div className="field">
            <label>Retailer ID</label>
            <input value={retailerId} onChange={(e) => setRetailerId(e.target.value)} required />
          </div>
          <div className="row">
            <div className="field">
              <label>Product ID</label>
              <input value={productId} onChange={(e) => setProductId(e.target.value)} required />
            </div>
            <div className="field">
              <label>Ordered qty</label>
              <input value={orderedQty} onChange={(e) => setOrderedQty(e.target.value)} type="number" required />
            </div>
          </div>
          <button type="submit" disabled={busy}>Create order</button>
          {error && <p className="error-text">{error}</p>}
        </form>
      </div>

      {createdOrder && (
        <div className="card">
          <h2>Order created</h2>
          <p className="mono">{createdOrder.orderNumber} — <span className="status-pill">{createdOrder.status}</span></p>

          <div className="field" style={{ marginTop: 16 }}>
            <label>Warehouse ID to allocate from</label>
            <input value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} />
          </div>
          <button onClick={handleAllocate} disabled={busy || !warehouseId}>Run allocation (FEFO)</button>
        </div>
      )}

      {allocation && (
        <div className="card">
          <h2>Allocation result — {allocation.fullyAllocated ? 'fully allocated' : 'partial'}</h2>
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
