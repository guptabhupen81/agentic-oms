'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { TruckDto } from '../../../lib/types';

const EMPTY_FORM = { registration: '', name: '', capacityWeightKg: '', capacityVolumeCbm: '' };

/** Primary (Manufacturer -> Distributor) inbound fleet — kept as its own
 * master, separate from Vans (secondary, Distributor -> Retailer), since the
 * two fleets are sized, scheduled, and managed completely differently. */
export default function TrucksPage() {
  const [trucks, setTrucks] = useState<TruckDto[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setTrucks(await api.listTrucks(false));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(t: TruckDto) {
    setEditingId(t.id);
    setForm({
      registration: t.registration,
      name: t.name,
      capacityWeightKg: t.capacityWeightKg ?? '',
      capacityVolumeCbm: t.capacityVolumeCbm ?? '',
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
        registration: form.registration,
        name: form.name,
        capacityWeightKg: form.capacityWeightKg ? Number(form.capacityWeightKg) : undefined,
        capacityVolumeCbm: form.capacityVolumeCbm ? Number(form.capacityVolumeCbm) : undefined,
      };
      if (editingId) {
        await api.updateTruck(editingId, payload);
      } else {
        await api.createTruck(payload);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(t: TruckDto) {
    setBusy(true);
    try {
      await api.toggleTruckActive(t.id, !t.isActive);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Trucks (Primary)</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Inbound fleet — Manufacturer to Distributor. Separate from Vans, which handle Distributor to Retailer.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit truck' : 'Add truck'}</h2>
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
          <div className="row">
            <div className="field">
              <label>Capacity — weight (kg)</label>
              <input
                type="number"
                value={form.capacityWeightKg}
                onChange={(e) => setForm({ ...form, capacityWeightKg: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Capacity — volume (m³)</label>
              <input
                type="number"
                value={form.capacityVolumeCbm}
                onChange={(e) => setForm({ ...form, capacityVolumeCbm: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" disabled={busy}>{editingId ? 'Save changes' : 'Add truck'}</button>
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
          <thead><tr><th>Registration</th><th>Name</th><th>Capacity (kg / m³)</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {trucks.map((t) => (
              <tr key={t.id} style={{ opacity: t.isActive ? 1 : 0.5 }}>
                <td className="mono">{t.registration}</td>
                <td>{t.name}</td>
                <td className="mono">{t.capacityWeightKg ?? '—'} / {t.capacityVolumeCbm ?? '—'}</td>
                <td><span className="status-pill">{t.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="secondary" onClick={() => startEdit(t)}>Edit</button>
                  <button className="secondary" style={{ marginLeft: 6 }} onClick={() => toggleActive(t)} disabled={busy}>
                    {t.isActive ? 'Deactivate' : 'Activate'}
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
