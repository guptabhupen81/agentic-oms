'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { CompletePicklistResponse, PicklistDto } from '../../lib/types';

export default function PicklistsPage() {
  const [orderIdsInput, setOrderIdsInput] = useState('');
  const [picklistIdInput, setPicklistIdInput] = useState('');
  const [picklist, setPicklist] = useState<PicklistDto | null>(null);
  const [pickedDrafts, setPickedDrafts] = useState<Record<string, string>>({});
  const [completion, setCompletion] = useState<CompletePicklistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    setError(null);
    setBusy(true);
    try {
      const orderIds = orderIdsInput.split(',').map((s) => s.trim()).filter(Boolean);
      const picklists = await api.generatePicklists(orderIds);
      setPicklist(picklists[0] ?? null);
      setCompletion(null);
      if (!picklists[0]) setError('No picklist generated — has allocation run for this order?');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLoad() {
    setError(null);
    setBusy(true);
    try {
      setPicklist(await api.getPicklist(picklistIdInput));
      setCompletion(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
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
