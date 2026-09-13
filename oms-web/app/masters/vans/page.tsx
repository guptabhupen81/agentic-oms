'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { VanDto } from '../../../lib/types';

const EMPTY_FORM = { registration: '', name: '' };

export default function VansPage() {
  const [vans, setVans] = useState<VanDto[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setVans(await api.listVans(false));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(v: VanDto) {
    setEditingId(v.id);
    setForm({ registration: v.registration, name: v.name });
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
      if (editingId) {
        await api.updateVan(editingId, form);
      } else {
        await api.createVan(form);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(v: VanDto) {
    setBusy(true);
    try {
      await api.toggleVanActive(v.id, !v.isActive);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Vans</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit van' : 'Add van'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label>Registration number</label>
              <input
                value={form.registration}
                onChange={(e) => setForm({ ...form, registration: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Name / label</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </div>
          <button type="submit" disabled={busy}>{editingId ? 'Save changes' : 'Add van'}</button>
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
          <thead><tr><th>Registration</th><th>Name</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {vans.map((v) => (
              <tr key={v.id} style={{ opacity: v.isActive ? 1 : 0.5 }}>
                <td className="mono">{v.registration}</td>
                <td>{v.name}</td>
                <td><span className="status-pill">{v.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="secondary" onClick={() => startEdit(v)}>Edit</button>
                  <button className="secondary" style={{ marginLeft: 6 }} onClick={() => toggleActive(v)} disabled={busy}>
                    {v.isActive ? 'Deactivate' : 'Activate'}
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
