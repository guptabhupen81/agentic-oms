'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { DistributorDto } from '../../../lib/types';

const EMPTY_FORM = { code: '', name: '', gstin: '', pinCode: '', city: '', state: '', address: '', initialPassword: '' };

/** MDM Admin only. Creating a distributor also creates its DB Admin login —
 * the login ID is the distributor code (so the code cannot be edited later). */
export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<DistributorDto[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinStatus, setPinStatus] = useState<string | null>(null);

  async function refresh() {
    try {
      setDistributors(await api.listDistributors());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(d: DistributorDto) {
    setEditingId(d.id);
    setForm({
      code: d.code, name: d.name, gstin: d.gstin ?? '', pinCode: d.pinCode ?? '',
      city: d.city ?? '', state: d.state ?? '', address: d.address ?? '', initialPassword: '',
    });
    setPinStatus(null);
    setNotice(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPinStatus(null);
  }

  async function handlePinBlur() {
    if (!form.pinCode) {
      setForm((f) => ({ ...f, city: '', state: '' }));
      return;
    }
    setPinStatus('Looking up...');
    try {
      const r = await api.lookupPincode(form.pinCode);
      setForm((f) => ({ ...f, city: r.city, state: r.state }));
      setPinStatus(`${r.city}, ${r.state}`);
    } catch (err) {
      setForm((f) => ({ ...f, city: '', state: '' }));
      setPinStatus(err instanceof ApiError ? err.message : 'PIN code lookup failed');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (editingId) {
        await api.updateDistributor(editingId, {
          name: form.name, gstin: form.gstin, pinCode: form.pinCode, address: form.address,
        });
        setNotice('Distributor updated.');
      } else {
        await api.createDistributor({
          code: form.code,
          name: form.name,
          gstin: form.gstin || undefined,
          pinCode: form.pinCode || undefined,
          address: form.address || undefined,
          initialPassword: form.initialPassword,
        });
        setNotice(`Distributor created. DB Admin login: ${form.code.trim().toUpperCase()} (with the password you set).`);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(d: DistributorDto) {
    setBusy(true);
    setError(null);
    try {
      await api.toggleDistributorActive(d.id, !d.isActive);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(d: DistributorDto) {
    const pw = window.prompt(`New password for ${d.code} (min 8 characters):`);
    if (!pw) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.resetDistributorPassword(d.id, pw);
      setNotice(`Password reset for ${d.code}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Distributors</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Each distributor gets one DB Admin login whose Login ID is the distributor code. Retailers, Salesmen,
        Vans and the Agents are then managed by that DB Admin, under this distributor only.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit distributor' : 'Add distributor'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label>Code (= DB Admin login ID)</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="DIST002"
                disabled={!!editingId}
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
                maxLength={6}
              />
              {pinStatus && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pinStatus}</span>}
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
            {!editingId && (
              <div className="field">
                <label>Initial DB Admin password (min 8)</label>
                <input
                  type="password"
                  value={form.initialPassword}
                  onChange={(e) => setForm({ ...form, initialPassword: e.target.value })}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}
          </div>
          <button type="submit" disabled={busy}>{editingId ? 'Save changes' : 'Add distributor'}</button>
          {editingId && (
            <button type="button" className="secondary" style={{ marginLeft: 8 }} onClick={resetForm}>Cancel</button>
          )}
          {error && <p className="error-text">{error}</p>}
          {notice && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{notice}</p>}
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Code / login</th><th>Name</th><th>GSTIN</th><th>City/State</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {distributors.map((d) => (
              <tr key={d.id} style={{ opacity: d.isActive ? 1 : 0.5 }}>
                <td className="mono">{d.code}</td>
                <td>{d.name}</td>
                <td className="mono">{d.gstin || '—'}</td>
                <td>{d.city ? `${d.city}, ${d.state}` : '—'}</td>
                <td><span className="status-pill">{d.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="secondary" onClick={() => startEdit(d)}>Edit</button>
                  <button className="secondary" style={{ marginLeft: 6 }} onClick={() => handleResetPassword(d)} disabled={busy}>Reset password</button>
                  <button className="secondary" style={{ marginLeft: 6 }} onClick={() => toggleActive(d)} disabled={busy}>
                    {d.isActive ? 'Deactivate' : 'Activate'}
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
