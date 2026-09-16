'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type {
  AgentTaskDto,
  ManufacturerDto,
  ProductDto,
  PurchaseOrderListItemDto,
  ReplenishmentRecommendationDto,
  TruckDto,
  WarehouseDto,
} from '../../lib/types';

/** Live "mm:ss" countdown computed from a real server dueAt timestamp —
 * same pattern as the Approvals page's Countdown, kept local to this page
 * since it's small enough not to be worth sharing yet. */
function Countdown({ dueAt }: { dueAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remainingMs = new Date(dueAt).getTime() - now;
  if (remainingMs <= 0) return <span className="error-text">overdue</span>;
  const totalSeconds = Math.floor(remainingMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const urgent = remainingMs < 5 * 60 * 1000;
  return (
    <span className="mono" style={{ color: urgent ? 'var(--error)' : 'var(--accent)' }}>
      {m}:{s.toString().padStart(2, '0')}
    </span>
  );
}

interface ManualPoLine {
  productId: string;
  sku: string;
  name: string;
  orderedQty: string;
}

export default function DemandPage() {
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerDto[]>([]);
  const [trucks, setTrucks] = useState<TruckDto[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('10');
  const [targetCoverDays, setTargetCoverDays] = useState('21');

  const [recommendations, setRecommendations] = useState<ReplenishmentRecommendationDto[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderListItemDto[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Record<string, AgentTaskDto>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // --- Manual PO builder ---
  const [manualManufacturerId, setManualManufacturerId] = useState('');
  const [manualProductQuery, setManualProductQuery] = useState('');
  const [manualProductResults, setManualProductResults] = useState<ProductDto[]>([]);
  const [manualLines, setManualLines] = useState<ManualPoLine[]>([]);

  // --- Goods Receipt (GR) ---
  const [grPurchaseOrderId, setGrPurchaseOrderId] = useState('');
  const [grLineId, setGrLineId] = useState('');
  const [grBatchNumber, setGrBatchNumber] = useState('');
  const [grManufactureDate, setGrManufactureDate] = useState('');
  const [grExpiryDate, setGrExpiryDate] = useState('');
  const [grReceivedQty, setGrReceivedQty] = useState('');
  const [grWarehouseId, setGrWarehouseId] = useState('');
  const [grTruckId, setGrTruckId] = useState('');

  async function refreshOrders() {
    try {
      const [pos, tasks] = await Promise.all([api.listPurchaseOrders(), api.listAgentTasks()]);
      setPurchaseOrders(pos);
      const map: Record<string, AgentTaskDto> = {};
      tasks.filter((t) => t.taskType === 'PO_HOLD').forEach((t) => { map[t.entityId] = t; });
      setPendingTasks(map);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    api.listWarehouses(true).then(setWarehouses).catch(() => {});
    api.listManufacturers().then(setManufacturers).catch(() => {});
    api.listTrucks(true).then(setTrucks).catch(() => {});
    refreshOrders();
  }, []);

  async function handleGetRecommendations() {
    if (!warehouseId) return;
    setError(null);
    setBusy(true);
    try {
      setRecommendations(
        await api.getReplenishmentRecommendations(warehouseId, Number(leadTimeDays), Number(targetCoverDays)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePO(rec: ReplenishmentRecommendationDto) {
    setBusy(true);
    setError(null);
    try {
      await api.createPurchaseOrder({
        manufacturerId: rec.manufacturerId,
        lines: [{ productId: rec.productId, orderedQty: Number(rec.recommendedOrderQty) }],
      });
      setRecommendations((rs) => rs.filter((r) => r.productId !== rec.productId));
      await refreshOrders();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(poId: string, outcome: 'approved' | 'rejected') {
    setBusy(true);
    setError(null);
    try {
      await api.resolvePOHold(poId, outcome);
      await refreshOrders();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // --- Manual PO handlers ---
  async function handleManualProductSearch(query: string) {
    setManualProductQuery(query);
    if (!query.trim()) { setManualProductResults([]); return; }
    try {
      setManualProductResults(await api.searchProducts(query));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  function addManualLine(p: ProductDto) {
    if (manualLines.some((l) => l.productId === p.id)) return;
    setManualLines((ls) => [...ls, { productId: p.id, sku: p.sku, name: p.name, orderedQty: '1' }]);
    setManualProductQuery('');
    setManualProductResults([]);
  }

  function updateManualLine(productId: string, orderedQty: string) {
    setManualLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, orderedQty } : l)));
  }

  function removeManualLine(productId: string) {
    setManualLines((ls) => ls.filter((l) => l.productId !== productId));
  }

  async function handleCreateManualPO() {
    setError(null);
    if (!manualManufacturerId) { setError('Select a manufacturer'); return; }
    if (manualLines.length === 0) { setError('Add at least one product'); return; }
    setBusy(true);
    try {
      await api.createPurchaseOrder({
        manufacturerId: manualManufacturerId,
        lines: manualLines.map((l) => ({ productId: l.productId, orderedQty: Number(l.orderedQty) || 0 })),
      });
      setManualLines([]);
      setManualManufacturerId('');
      await refreshOrders();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // --- GR handlers ---
  const receivablePOs = purchaseOrders.filter((po) => po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED');
  const grPO = purchaseOrders.find((po) => po.id === grPurchaseOrderId);

  async function handleReceiveGoods() {
    setError(null);
    if (!grLineId || !grBatchNumber || !grManufactureDate || !grExpiryDate || !grReceivedQty || !grWarehouseId) {
      setError('Fill in all goods receipt fields');
      return;
    }
    setBusy(true);
    try {
      await api.receiveGoods({
        purchaseOrderLineId: grLineId,
        batchNumber: grBatchNumber,
        manufactureDate: grManufactureDate,
        expiryDate: grExpiryDate,
        receivedQty: Number(grReceivedQty),
        warehouseId: grWarehouseId,
        truckId: grTruckId || undefined,
      });
      setGrLineId('');
      setGrBatchNumber('');
      setGrManufactureDate('');
      setGrExpiryDate('');
      setGrReceivedQty('');
      await refreshOrders();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Demand &amp; purchase orders</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Replenishment recommendations, manual purchase orders, and goods receipt — all Primary (Manufacturer to Distributor) fulfillment.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Get recommendations</h2>
        <div className="row">
          <div className="field">
            <label>Warehouse</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Select…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Lead time (days)</label>
            <input type="number" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} />
          </div>
          <div className="field">
            <label>Target cover (days)</label>
            <input type="number" value={targetCoverDays} onChange={(e) => setTargetCoverDays(e.target.value)} />
          </div>
        </div>
        <button onClick={handleGetRecommendations} disabled={busy || !warehouseId}>Get recommendations</button>
      </div>

      {recommendations.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Recommendations</h2>
          <table>
            <thead>
              <tr><th>SKU</th><th>Stock</th><th>Avg daily sales</th><th>Days of cover</th><th>Recommend</th><th>Rationale</th><th></th></tr>
            </thead>
            <tbody>
              {recommendations.map((r) => (
                <tr key={r.productId}>
                  <td className="mono">{r.sku}</td>
                  <td className="mono">{r.currentStock}</td>
                  <td className="mono">{r.averageDailySales}</td>
                  <td className="mono">{r.daysOfCoverRemaining}</td>
                  <td className="mono">{r.recommendedOrderQty}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.rationale}</td>
                  <td><button onClick={() => handleCreatePO(r)} disabled={busy}>Create PO</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Manual purchase order</h2>
        <div className="row">
          <div className="field">
            <label>Manufacturer</label>
            <select value={manualManufacturerId} onChange={(e) => setManualManufacturerId(e.target.value)}>
              <option value="">Select…</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ position: 'relative' }}>
          <label>Search product by code or name</label>
          <input value={manualProductQuery} onChange={(e) => handleManualProductSearch(e.target.value)} />
          {manualProductResults.length > 0 && (
            <div className="card" style={{ position: 'absolute', zIndex: 10, width: '100%', marginTop: 4, padding: 4 }}>
              {manualProductResults.map((p) => (
                <div key={p.id} onClick={() => addManualLine(p)} style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                  <span className="mono">{p.sku}</span> — {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
        {manualLines.length > 0 && (
          <table style={{ marginTop: 12 }}>
            <thead><tr><th>Product</th><th>Qty</th><th></th></tr></thead>
            <tbody>
              {manualLines.map((l) => (
                <tr key={l.productId}>
                  <td>{l.name} <span className="mono" style={{ color: 'var(--text-muted)' }}>({l.sku})</span></td>
                  <td style={{ width: 90 }}>
                    <input type="number" value={l.orderedQty} onChange={(e) => updateManualLine(l.productId, e.target.value)} />
                  </td>
                  <td><button className="secondary" onClick={() => removeManualLine(l.productId)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button onClick={handleCreateManualPO} disabled={busy} style={{ marginTop: 12 }}>Create manual PO</button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Purchase orders</h2>
        {purchaseOrders.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No purchase orders yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>PO</th><th>Manufacturer</th><th>Lines (ordered / received)</th><th>Status</th><th>Hold remaining</th><th></th></tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => {
                const task = pendingTasks[po.id];
                return (
                  <tr key={po.id}>
                    <td className="mono">{po.poNumber}</td>
                    <td>{po.manufacturer.name}</td>
                    <td style={{ fontSize: 12 }}>
                      {po.lines.map((l) => `${l.product.name} ${l.receivedQty}/${l.orderedQty}`).join(', ')}
                    </td>
                    <td><span className="status-pill">{po.status}</span></td>
                    <td>{task ? <Countdown dueAt={task.dueAt} /> : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {task && (
                        <>
                          <button disabled={busy} onClick={() => handleResolve(po.id, 'approved')}>Release</button>
                          <button
                            className="secondary"
                            style={{ marginLeft: 6 }}
                            disabled={busy}
                            onClick={() => handleResolve(po.id, 'rejected')}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Goods receipt (GRN)</h2>
        <div className="row">
          <div className="field">
            <label>Purchase order</label>
            <select value={grPurchaseOrderId} onChange={(e) => { setGrPurchaseOrderId(e.target.value); setGrLineId(''); }}>
              <option value="">Select…</option>
              {receivablePOs.map((po) => (
                <option key={po.id} value={po.id}>{po.poNumber} — {po.manufacturer.name}</option>
              ))}
            </select>
          </div>
          {grPO && (
            <div className="field">
              <label>Line</label>
              <select value={grLineId} onChange={(e) => setGrLineId(e.target.value)}>
                <option value="">Select…</option>
                {grPO.lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.product.name} ({l.receivedQty}/{l.orderedQty} received)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {grLineId && (
          <>
            <div className="row">
              <div className="field">
                <label>Batch number</label>
                <input value={grBatchNumber} onChange={(e) => setGrBatchNumber(e.target.value)} />
              </div>
              <div className="field">
                <label>Received qty</label>
                <input type="number" value={grReceivedQty} onChange={(e) => setGrReceivedQty(e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Manufacture date</label>
                <input type="date" value={grManufactureDate} onChange={(e) => setGrManufactureDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Expiry date</label>
                <input type="date" value={grExpiryDate} onChange={(e) => setGrExpiryDate(e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Receiving warehouse</label>
                <select value={grWarehouseId} onChange={(e) => setGrWarehouseId(e.target.value)}>
                  <option value="">Select…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Inbound truck (optional)</label>
                <select value={grTruckId} onChange={(e) => setGrTruckId(e.target.value)}>
                  <option value="">Not recorded</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>{t.registration} — {t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={handleReceiveGoods} disabled={busy}>Record receipt</button>
          </>
        )}
      </div>
    </div>
  );
}
