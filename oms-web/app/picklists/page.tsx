'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { CompletePicklistResponse, PicklistDto, PicklistListItemDto } from '../../lib/types';

export default function PicklistsPage() {
  const [picklists, setPicklists] = useState<PicklistListItemDto[]>([]);
  const [orderIdsInput, setOrderIdsInput] = useState('');
  const [picklistIdInput, setPicklistIdInput] = useState('');
  const [picklist, setPicklist] = useState<PicklistDto | null>(null);
  const [pickedDrafts, setPickedDrafts] = useState<Record<string, string>>({});
  const [completion, setCompletion] = useState<CompletePicklistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshList() {
    try {
      setPicklists(await api.listPicklists());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refreshList();
  }, []);

  async function loadById(id: string) {
    setError(null);
    setBusy(true);
    try {
      setPicklist(await api.getPicklist(id));
      setCompletion(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setError(null);
    setBusy(true);
    try {
      const orderIds = orderIdsInput.split(',').map((s) => s.trim()).filter(Boolean);
      const generated = await api.generatePicklists(orderIds);
      setPicklist(generated[0] ?? null);
      setCompletion(null);
      if (!generated[0]) setError('No picklist generated — has allocation run for this order?');
      await refreshList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLoad() {
    await loadById(picklistIdInput);
  }

  async function handleSavePick(lineId: string) {
    const qty = Number(pickedDrafts[lineId]);
    if (!Number.isFinite(qty)) return;
    setBusy(true);
    try {
      await api.recordPick(lineId, qty);
      if (picklist) setPicklist(await api.getPicklist(picklist.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (!picklist) return;
    setBusy(true);
    try {
      setCompletion(await api.completePicklist(picklist.id));
      await refreshList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Picklist</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Recent picklists</h2>
        {picklists.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No picklists yet.</p>
        ) : (
          <table>
            <thead><tr><th>Picklist</th><th>Warehouse</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {picklists.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.picklistNumber}</td>
                  <td>{p.warehouse.name}</td>
                  <td><span className="status-pill">{p.status}</span></td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td><button className="secondary" onClick={() => loadById(p.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="field">
          <label>Order IDs (comma-separated)</label>
          <input value={orderIdsInput} onChange={(e) => setOrderIdsInput(e.target.value)} />
        </div>
        <button onClick={handleGenerate} disabled={busy || !orderIdsInput}>Generate picklist</button>

        <div className="row" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Or load Picklist ID</label>
            <input value={picklistIdInput} onChange={(e) => setPicklistIdInput(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="secondary" onClick={handleLoad} disabled={busy || !picklistIdInput}>Load</button>
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      {picklist && (
        <div className="card">
          <h2 className="mono">{picklist.picklistNumber} <span className="status-pill">{picklist.status}</span></h2>
          <table>
            <thead>
              <tr><th>Batch</th><th>Expiry</th><th>Requested</th><th>Picked</th><th></th></tr>
            </thead>
            <tbody>
              {picklist.lines.map((line) => (
                <tr key={line.id}>
                  <td className="mono">{line.allocation.batch.batchNumber}</td>
                  <td>{line.allocation.batch.expiryDate.slice(0, 10)}</td>
                  <td className="mono">{line.quantity}</td>
                  <td style={{ width: 100 }}>
                    <input
                      defaultValue={line.pickedQty}
                      onChange={(e) => setPickedDrafts((d) => ({ ...d, [line.id]: e.target.value }))}
                    />
                  </td>
                  <td>
                    <button className="secondary" onClick={() => handleSavePick(line.id)} disabled={busy}>Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button style={{ marginTop: 16 }} onClick={handleComplete} disabled={busy}>Complete picklist</button>
        </div>
      )}

      {completion && (
        <div className="card">
          <h2>Completed — {completion.status}</h2>
          {completion.discrepancies.length === 0 ? (
            <p className="success-text">No discrepancies. Stock deducted.</p>
          ) : (
            <>
              <p className="error-text">Discrepancies found — review before dispatch:</p>
              <table>
                <thead><tr><th>Line</th><th>Requested</th><th>Picked</th></tr></thead>
                <tbody>
                  {completion.discrepancies.map((d) => (
                    <tr key={d.picklistLineId}>
                      <td className="mono">{d.picklistLineId}</td>
                      <td className="mono">{d.requested}</td>
                      <td className="mono">{d.picked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
