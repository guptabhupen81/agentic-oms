'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { WarehouseDto } from '../../../lib/types';

const EMPTY_FORM = { name: '', code: '', address: '' };

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setWarehouses(await api.listWarehouses(false));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(w: WarehouseDto) {
    setEditingId(w.id);
    setForm({ name: w.name, code: w.code, address: w.address ?? '' });
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
      const payload = { name: form.name, code: form.code, address: form.address || undefined };
      if (editingId) {
        await api.updateWarehouse(editingId, payload);
      } else {
        await api.createWarehouse(payload);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(w: WarehouseDto) {
    setBusy(true);
    try {
      await api.toggleWarehouseActive(w.id, !w.isActive);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Warehouses</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit warehouse' : 'Add warehouse'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
          </div>
          <div className="field">
            <label>Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <button type="submit" disabled={busy}>{editingId ? 'Save changes' : 'Add warehouse'}</button>
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
          <thead><tr><th>Name</th><th>Code</th><th>Address</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id} style={{ opacity: w.isActive ? 1 : 0.5 }}>
                <td>{w.name}</td>
                <td className="mono">{w.code}</td>
                <td>{w.address || '—'}</td>
                <td><span className="status-pill">{w.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="secondary" onClick={() => startEdit(w)}>Edit</button>
                  <button className="secondary" style={{ marginLeft: 6 }} onClick={() => toggleActive(w)} disabled={busy}>
                    {w.isActive ? 'Deactivate' : 'Activate'}
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
