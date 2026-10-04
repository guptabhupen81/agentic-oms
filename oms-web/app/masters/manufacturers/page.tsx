'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { ManufacturerDto } from '../../../lib/types';

/** MDM Admin creates and edits manufacturers (GSTIN checksum-validated by the API). */
export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<ManufacturerDto[]>([]);
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setManufacturers(await api.listManufacturers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName('');
    setGstin('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (editingId) {
        await api.updateManufacturer(editingId, { name, gstin });
      } else {
        await api.createManufacturer({ name, gstin: gstin || undefined });
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Manufacturers</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit manufacturer' : 'Add manufacturer'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>GSTIN</label>
              <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} />
            </div>
          </div>
          <button type="submit" disabled={busy}>{editingId ? 'Save changes' : 'Add manufacturer'}</button>
          {editingId && (
            <button type="button" className="secondary" style={{ marginLeft: 8 }} onClick={resetForm}>Cancel</button>
          )}
          {error && <p className="error-text">{error}</p>}
        </form>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>GSTIN</th><th></th></tr></thead>
          <tbody>
            {manufacturers.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td className="mono">{m.gstin || '—'}</td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => { setEditingId(m.id); setName(m.name); setGstin(m.gstin ?? ''); }}
                  >
                    Edit
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
