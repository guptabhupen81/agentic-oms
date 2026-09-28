'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { SalesmanDto, SellerType, VanDto } from '../../../lib/types';

const EMPTY_FORM: { code: string; name: string; phone: string; sellerType: SellerType } = {
  code: '',
  name: '',
  phone: '',
  sellerType: 'PRE_SELLER',
};

export default function SalesmenPage() {
  const [salesmen, setSalesmen] = useState<SalesmanDto[]>([]);
  const [vans, setVans] = useState<VanDto[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [vanChoice, setVanChoice] = useState<Record<string, string>>({});

  async function refresh() {
    try {
      const [s, v] = await Promise.all([api.listSalesmen(false), api.listVans(false)]);
      setSalesmen(s);
      setVans(v);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(s: SalesmanDto) {
    setEditingId(s.id);
    setForm({ code: s.code, name: s.name, phone: s.phone ?? '', sellerType: s.sellerType });
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
      const payload = { code: form.code, name: form.name, phone: form.phone || undefined, sellerType: form.sellerType };
      if (editingId) {
        await api.updateSalesman(editingId, payload);
      } else {
        await api.createSalesman(payload);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: SalesmanDto) {
    setBusy(true);
    try {
      await api.toggleSalesmanActive(s.id, !s.isActive);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignVan(s: SalesmanDto) {
    const vanId = vanChoice[s.id];
    if (!vanId) return;
    setBusy(true);
    setError(null);
    try {
      await api.assignSalesmanToVan(s.id, vanId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnassignVan(s: SalesmanDto) {
    if (!s.van) return;
    setBusy(true);
    setError(null);
    try {
      await api.unassignSalesmanFromVan(s.id, s.van.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Only unassigned vans can be offered — one van holds one salesman at a time.
  const availableVans = vans.filter((v) => !v.assignedSalesmanId);

  return (
    <div>
      <h1>Salesmen</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Pre-Seller, Van-Seller, or Delivery Boy. Only a Van-Seller or Delivery Boy can be mapped to a van, and a
        van holds one salesman at a time. Retailer↔seller mapping rules are managed from the Retailers screen.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit salesman' : 'Add salesman'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label>Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SM-0004" required />
            </div>
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>Seller type</label>
              <select value={form.sellerType} onChange={(e) => setForm({ ...form, sellerType: e.target.value as SellerType })}>
                <option value="PRE_SELLER">Pre-Seller</option>
                <option value="VAN_SELLER">Van-Seller</option>
                <option value="DELIVERY_BOY">Delivery Boy</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={busy}>{editingId ? 'Save changes' : 'Add salesman'}</button>
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
            <tr><th>Code</th><th>Name</th><th>Phone</th><th>Type</th><th>Van</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {salesmen.map((s) => (
              <tr key={s.id} style={{ opacity: s.isActive ? 1 : 0.5 }}>
                <td className="mono">{s.code}</td>
                <td>{s.name}</td>
                <td className="mono">{s.phone || '—'}</td>
                <td><span className="status-pill">{s.sellerType}</span></td>
                <td>
                  {s.sellerType === 'PRE_SELLER' ? (
                    <span style={{ color: 'var(--text-muted)' }}>n/a</span>
                  ) : s.van ? (
                    <>
                      <span className="mono">{s.van.registration}</span>
                      <button className="secondary" style={{ marginLeft: 6 }} onClick={() => handleUnassignVan(s)} disabled={busy}>
                        Unassign
                      </button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        value={vanChoice[s.id] ?? ''}
                        onChange={(e) => setVanChoice((c) => ({ ...c, [s.id]: e.target.value }))}
                      >
                        <option value="">— select van —</option>
                        {availableVans.map((v) => (
                          <option key={v.id} value={v.id}>{v.registration} — {v.name}</option>
                        ))}
                      </select>
                      <button className="secondary" onClick={() => handleAssignVan(s)} disabled={busy || !vanChoice[s.id]}>
                        Assign
                      </button>
                    </div>
                  )}
                </td>
                <td><span className="status-pill">{s.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="secondary" onClick={() => startEdit(s)}>Edit</button>
                  <button className="secondary" style={{ marginLeft: 6 }} onClick={() => toggleActive(s)} disabled={busy}>
                    {s.isActive ? 'Deactivate' : 'Activate'}
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
