'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { InvoiceDto, VanLoadDto } from '../../lib/types';

export default function VanPage() {
  const [vanId, setVanId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [loadQty, setLoadQty] = useState('');
  const [vanLoadIdInput, setVanLoadIdInput] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('Karnataka');

  const [vanLoad, setVanLoad] = useState<VanLoadDto | null>(null);
  const [lastInvoice, setLastInvoice] = useState<InvoiceDto | null>(null);
  const [saleDrafts, setSaleDrafts] = useState<Record<string, { qty: string; rate: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLoadVan() {
    setError(null);
    setBusy(true);
    try {
      const vl = await api.loadVan({
        vanId,
        warehouseId,
        operatorId,
        lines: [{ batchId, quantity: Number(loadQty) }],
      });
      setVanLoad(vl);
      setLastInvoice(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadExisting() {
    setError(null);
    setBusy(true);
    try {
      setVanLoad(await api.getVanLoad(vanLoadIdInput));
      setLastInvoice(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSell(lineId: string) {
    if (!vanLoad) return;
    const draft = saleDrafts[lineId];
    const qty = Number(draft?.qty);
    const rate = Number(draft?.rate);
    if (!Number.isFinite(qty) || !Number.isFinite(rate)) return;

    setBusy(true);
    try {
      const invoice = await api.recordVanSale(vanLoad.id, {
        lines: [{ vanLoadLineId: lineId, quantity: qty, rate }],
        isIgst: false,
        placeOfSupply,
      });
      setLastInvoice(invoice);
      setVanLoad(await api.getVanLoad(vanLoad.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnload() {
    if (!vanLoad) return;
    setBusy(true);
    try {
      setVanLoad(await api.unloadVan(vanLoad.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Van sales</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Load van</h2>
        <div className="row">
          <div className="field"><label>Van ID</label><input value={vanId} onChange={(e) => setVanId(e.target.value)} /></div>
          <div className="field"><label>Warehouse ID</label><input value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Operator (User) ID</label><input value={operatorId} onChange={(e) => setOperatorId(e.target.value)} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Batch ID</label><input value={batchId} onChange={(e) => setBatchId(e.target.value)} /></div>
          <div className="field"><label>Qty</label><input value={loadQty} onChange={(e) => setLoadQty(e.target.value)} type="number" /></div>
        </div>
        <button onClick={handleLoadVan} disabled={busy}>Load van</button>

        <div className="row" style={{ marginTop: 16 }}>
          <div className="field"><label>Or load Van Load ID</label><input value={vanLoadIdInput} onChange={(e) => setVanLoadIdInput(e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="secondary" onClick={handleLoadExisting} disabled={busy}>Load</button>
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      {vanLoad && (
        <div className="card">
          <h2 style={{ marginTop: 0 }} className="mono">{vanLoad.id} <span className="status-pill">{vanLoad.status}</span></h2>

          <div className="field" style={{ maxWidth: 240 }}>
            <label>Place of supply (state)</label>
            <input value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} />
          </div>

          <table>
            <thead>
              <tr><th>Batch</th><th>Loaded</th><th>Sold</th><th>Unloaded</th><th>Sell qty</th><th>Rate</th><th></th></tr>
            </thead>
            <tbody>
              {vanLoad.lines.map((line) => (
                <tr key={line.id}>
                  <td className="mono">{line.batchId}</td>
                  <td className="mono">{line.loadedQty}</td>
                  <td className="mono">{line.soldQty}</td>
                  <td className="mono">{line.unloadedQty}</td>
                  <td style={{ width: 80 }}>
                    <input onChange={(e) => setSaleDrafts((d) => ({ ...d, [line.id]: { ...d[line.id], qty: e.target.value } }))} />
                  </td>
                  <td style={{ width: 80 }}>
                    <input onChange={(e) => setSaleDrafts((d) => ({ ...d, [line.id]: { ...d[line.id], rate: e.target.value } }))} />
                  </td>
                  <td>
                    <button className="secondary" onClick={() => handleSell(line.id)} disabled={busy}>Sell</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button style={{ marginTop: 16 }} className="secondary" onClick={handleUnload} disabled={busy}>
            Unload (end of day)
          </button>
        </div>
      )}

      {lastInvoice && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Invoice generated</h2>
          <p className="mono">{lastInvoice.invoiceNumber} — total {lastInvoice.totalAmount}</p>
        </div>
      )}
    </div>
  );
}
