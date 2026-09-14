'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type {
  AgentTaskDto,
  PurchaseOrderListItemDto,
  ReplenishmentRecommendationDto,
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

export default function DemandPage() {
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('10');
  const [targetCoverDays, setTargetCoverDays] = useState('21');

  const [recommendations, setRecommendations] = useState<ReplenishmentRecommendationDto[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderListItemDto[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Record<string, AgentTaskDto>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    api.listWarehouses(true).then(setWarehouses).catch((err) => {
      setError(err instanceof ApiError ? err.message : String(err));
    });
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

  return (
    <div>
      <h1>Demand &amp; purchase orders</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Replenishment recommendations from real sales velocity and stock cover, and every drafted PO with its real 30-minute hold.
      </p>

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
        {error && <p className="error-text">{error}</p>}
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
        <h2 style={{ marginTop: 0 }}>Purchase orders</h2>
        {purchaseOrders.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No purchase orders yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>PO</th><th>Manufacturer</th><th>Lines</th><th>Status</th><th>Hold remaining</th><th></th></tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => {
                const task = pendingTasks[po.id];
                return (
                  <tr key={po.id}>
                    <td className="mono">{po.poNumber}</td>
                    <td>{po.manufacturer.name}</td>
                    <td style={{ fontSize: 12 }}>
                      {po.lines.map((l) => `${l.product.name} x${l.orderedQty}`).join(', ')}
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
    </div>
  );
}
