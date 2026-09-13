'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { RetailerDto } from '../../../lib/types';

const EMPTY_FORM = { name: '', gstin: '', address: '', creditLimitAmount: '0' };

export default function RetailersPage() {
  const [retailers, setRetailers] = useState<RetailerDto[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setRetailers(await api.listRetailers(false));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(r: RetailerDto) {
    setEditingId(r.id);
    setForm({
      name: r.name,
      gstin: r.gstin ?? '',
      address: r.address ?? '',
      creditLimitAmount: r.creditLimitAmount,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        gstin: form.gstin || undefined,
        address: form.address || undefined,
        creditLimitAmount: Number(form.creditLimitAmount),
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

  return (
    <div>
      <h1>Retailers</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit retailer' : 'Add retailer'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>GSTIN</label>
              <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
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
            <tr><th>Name</th><th>GSTIN</th><th>Credit limit / used</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {retailers.map((r) => (
              <tr key={r.id} style={{ opacity: r.isActive ? 1 : 0.5 }}>
                <td>{r.name}</td>
                <td className="mono">{r.gstin || '—'}</td>
                <td className="mono">₹{r.creditLimitAmount} / ₹{r.creditUsedAmount}</td>
                <td><span className="status-pill">{r.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="secondary" onClick={() => startEdit(r)}>Edit</button>
                  <button className="secondary" style={{ marginLeft: 6 }} onClick={() => toggleActive(r)} disabled={busy}>
                    {r.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
