'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { ChannelHierarchyNodeDto, RetailerDto, RetailerSalesmanMappingDto, SalesmanDto } from '../../../lib/types';

const EMPTY_FORM = { code: '', name: '', gstin: '', pinCode: '', city: '', state: '', address: '', creditLimitAmount: '0', channelNodeId: '' };

/** Flattens the 2-level channel tree into Level-2 options only — retailers
 * map exclusively to a Level-2 node, never to the top-level Channel itself. */
function flattenLevel2(tree: ChannelHierarchyNodeDto[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const l1 of tree) {
    for (const l2 of l1.children ?? []) {
      out.push({ id: l2.id, label: `${l1.name} / ${l2.name}` });
    }
  }
  return out;
}

export default function RetailersPage() {
  const [retailers, setRetailers] = useState<RetailerDto[]>([]);
  const [channelOptions, setChannelOptions] = useState<{ id: string; label: string }[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinLookupStatus, setPinLookupStatus] = useState<string | null>(null);

  // Salesman mapping panel (shown once a retailer row is selected)
  const [mappingRetailer, setMappingRetailer] = useState<RetailerDto | null>(null);
  const [mappings, setMappings] = useState<RetailerSalesmanMappingDto[]>([]);
  const [salesmen, setSalesmen] = useState<SalesmanDto[]>([]);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState('');
  const [mappingError, setMappingError] = useState<string | null>(null);

  async function refresh() {
    try {
      setRetailers(await api.listRetailers(false));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
    api.getChannelHierarchyTree().then((tree) => setChannelOptions(flattenLevel2(tree))).catch(() => {});
    api.listSalesmen(true).then(setSalesmen).catch(() => {});
  }, []);

  function startEdit(r: RetailerDto) {
    setEditingId(r.id);
    setForm({
      code: r.code,
      name: r.name,
      gstin: r.gstin ?? '',
      pinCode: r.pinCode ?? '',
      city: r.city ?? '',
      state: r.state ?? '',
      address: r.address ?? '',
      creditLimitAmount: r.creditLimitAmount,
      channelNodeId: r.channelNodeId ?? '',
    });
    setPinLookupStatus(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPinLookupStatus(null);
  }

  async function handlePinBlur() {
    if (!form.pinCode) {
      setForm((f) => ({ ...f, city: '', state: '' }));
      return;
    }
    setPinLookupStatus('Looking up...');
    try {
      const result = await api.lookupPincode(form.pinCode);
      setForm((f) => ({ ...f, city: result.city, state: result.state }));
      setPinLookupStatus(`${result.city}, ${result.state}`);
    } catch (err) {
      setForm((f) => ({ ...f, city: '', state: '' }));
      setPinLookupStatus(err instanceof ApiError ? err.message : 'PIN code lookup failed');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        gstin: form.gstin || undefined,
        pinCode: form.pinCode || undefined,
        address: form.address || undefined,
        creditLimitAmount: Number(form.creditLimitAmount),
        channelNodeId: form.channelNodeId || undefined,
      };
      if (editingId) {
        await api.updateRetailer(editingId, payload);
      } else {
        await api.createRetailer(payload);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(r: RetailerDto) {
    setBusy(true);
    try {
      await api.toggleRetailerActive(r.id, !r.isActive);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function openMappings(r: RetailerDto) {
    setMappingRetailer(r);
    setMappingError(null);
    setSelectedSalesmanId('');
    try {
      setMappings(await api.listRetailerSalesmanMappings(r.id));
    } catch (err) {
      setMappingError(err instanceof ApiError ? err.message : String(err));
    }
  }

  async function handleMapSalesman() {
    if (!mappingRetailer || !selectedSalesmanId) return;
    setMappingError(null);
    setBusy(true);
    try {
      await api.mapSalesmanToRetailer(mappingRetailer.id, selectedSalesmanId);
      setMappings(await api.listRetailerSalesmanMappings(mappingRetailer.id));
      setSelectedSalesmanId('');
    } catch (err) {
      setMappingError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnmap(mappingId: string) {
    if (!mappingRetailer) return;
    setBusy(true);
    try {
      await api.unmapSalesmanFromRetailer(mappingId);
      setMappings(await api.listRetailerSalesmanMappings(mappingRetailer.id));
    } catch (err) {
      setMappingError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Retailers</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit retailer' : 'Add retailer'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label>Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="RET-0002"
                required
              />
            </div>
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>GSTIN</label>
              <input
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                placeholder="29ABCDE1234F1Z5"
                maxLength={15}
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>PIN code</label>
              <input
                value={form.pinCode}
                onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
                onBlur={handlePinBlur}
                placeholder="560001"
                maxLength={6}
              />
              {pinLookupStatus && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pinLookupStatus}</span>
              )}
            </div>
            <div className="field">
              <label>City (auto)</label>
              <input value={form.city} readOnly disabled />
            </div>
            <div className="field">
              <label>State (auto)</label>
              <input value={form.state} readOnly disabled />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="field">
              <label>Credit limit (₹)</label>
              <input
                type="number"
                value={form.creditLimitAmount}
                onChange={(e) => setForm({ ...form, creditLimitAmount: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Channel (Level-2)</label>
              <select value={form.channelNodeId} onChange={(e) => setForm({ ...form, channelNodeId: e.target.value })}>
                <option value="">— none —</option>
                {channelOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={busy}>{editingId ? 'Save changes' : 'Add retailer'}</button>
          {editingId && (
            <button type="button" className="secondary" style={{ marginLeft: 8 }} onClick={resetForm}>
              Cancel
            </button>
          )}
          {error && <p className="error-text">{error}</p>}
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Code</th><th>Name</th><th>GSTIN</th><th>City/State</th><th>Channel</th><th>Credit limit / used</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {retailers.map((r) => (
              <tr key={r.id} style={{ opacity: r.isActive ? 1 : 0.5 }}>
                <td className="mono">{r.code}</td>
                <td>{r.name}</td>
                <td className="mono">{r.gstin || '—'}</td>
                <td>{r.city ? `${r.city}, ${r.state}` : '—'}</td>
                <td>{r.channelNode ? r.channelNode.name : '—'}</td>
                <td className="mono">₹{r.creditLimitAmount} / ₹{r.creditUsedAmount}</td>
                <td><span className="status-pill">{r.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="secondary" onClick={() => startEdit(r)}>Edit</button>
                  <button className="secondary" style={{ marginLeft: 6 }} onClick={() => openMappings(r)}>Sellers</button>
                  <button className="secondary" style={{ marginLeft: 6 }} onClick={() => toggleActive(r)} disabled={busy}>
                    {r.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mappingRetailer && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Sellers mapped to {mappingRetailer.name}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            A Pre-Seller and a Delivery Boy may both be mapped together. A Van-Seller mapping is exclusive —
            it cannot coexist with any other seller on this retailer.
          </p>
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Seller type</th><th></th></tr></thead>
            <tbody>
              {mappings.length === 0 && (
                <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No sellers mapped yet.</td></tr>
              )}
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.salesman.code}</td>
                  <td>{m.salesman.name}</td>
                  <td><span className="status-pill">{m.salesman.sellerType}</span></td>
                  <td><button className="secondary" onClick={() => handleUnmap(m.id)} disabled={busy}>Unmap</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Add seller</label>
              <select value={selectedSalesmanId} onChange={(e) => setSelectedSalesmanId(e.target.value)}>
                <option value="">— select a salesman —</option>
                {salesmen.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name} ({s.sellerType})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={handleMapSalesman} disabled={busy || !selectedSalesmanId}>Map</button>
            </div>
          </div>
          {mappingError && <p className="error-text">{mappingError}</p>}
          <button className="secondary" style={{ marginTop: 12 }} onClick={() => setMappingRetailer(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
