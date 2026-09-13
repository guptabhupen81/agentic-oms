'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { HierarchyNodeDto, ManufacturerDto, ProductDto } from '../../../lib/types';

const EMPTY_FORM = {
  sku: '',
  name: '',
  hierarchyNodeId: '',
  manufacturerId: '',
  uom: 'EACH',
  hsnCode: '',
  gstRatePercent: '5',
  defaultUnitPrice: '0',
  minOrderQty: '',
  maxOrderQty: '',
};

/** Flattens the hierarchy tree into a single list with indentation, so any
 * level can be picked in a plain <select> without a custom tree-picker. */
function flattenHierarchy(nodes: HierarchyNodeDto[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${'—'.repeat(depth)} ${n.name}` },
    ...flattenHierarchy(n.children ?? [], depth + 1),
  ]);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [hierarchyOptions, setHierarchyOptions] = useState<{ id: string; label: string }[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerDto[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [productList, hierarchy, mfrs] = await Promise.all([
        api.listProductsForMaster(false),
        api.getHierarchyTree(),
        api.listManufacturers(),
      ]);
      setProducts(productList);
      setHierarchyOptions(flattenHierarchy(hierarchy));
      setManufacturers(mfrs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(p: ProductDto) {
    setEditingId(p.id);
    setForm({
      sku: p.sku,
      name: p.name,
      hierarchyNodeId: p.hierarchyNodeId ?? '',
      manufacturerId: p.manufacturerId ?? '',
      uom: p.uom,
      hsnCode: p.hsnCode ?? '',
      gstRatePercent: p.gstRatePercent,
      defaultUnitPrice: p.defaultUnitPrice ?? '0',
      minOrderQty: p.minOrderQty ?? '',
      maxOrderQty: p.maxOrderQty ?? '',
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
        sku: form.sku,
        name: form.name,
        hierarchyNodeId: form.hierarchyNodeId,
        manufacturerId: form.manufacturerId,
        uom: form.uom,
        hsnCode: form.hsnCode || undefined,
        gstRatePercent: Number(form.gstRatePercent),
        defaultUnitPrice: Number(form.defaultUnitPrice),
        minOrderQty: form.minOrderQty ? Number(form.minOrderQty) : undefined,
        maxOrderQty: form.maxOrderQty ? Number(form.maxOrderQty) : undefined,
      };
      if (editingId) {
        await api.updateProduct(editingId, payload);
      } else {
        await api.createProduct(payload);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: ProductDto) {
    setBusy(true);
    try {
      await api.toggleProductActive(p.id, !p.isActive);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Products</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit product' : 'Add product'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label>SKU</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            </div>
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Category (hierarchy)</label>
              <select
                value={form.hierarchyNodeId}
                onChange={(e) => setForm({ ...form, hierarchyNodeId: e.target.value })}
                required
              >
                <option value="">Select…</option>
                {hierarchyOptions.map((h) => (
                  <option key={h.id} value={h.id}>{h.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Manufacturer</label>
              <select
                value={form.manufacturerId}
                onChange={(e) => setForm({ ...form, manufacturerId: e.target.value })}
                required
              >
                <option value="">Select…</option>
                {manufacturers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>UOM</label>
              <input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} required />
            </div>
            <div className="field">
              <label>HSN code</label>
              <input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} />
            </div>
            <div className="field">
              <label>GST rate %</label>
              <input
                type="number"
                value={form.gstRatePercent}
                onChange={(e) => setForm({ ...form, gstRatePercent: e.target.value })}
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>List price (₹)</label>
              <input
                type="number"
                value={form.defaultUnitPrice}
                onChange={(e) => setForm({ ...form, defaultUnitPrice: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Min order qty</label>
              <input
                type="number"
                value={form.minOrderQty}
                onChange={(e) => setForm({ ...form, minOrderQty: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Max order qty</label>
              <input
                type="number"
                value={form.maxOrderQty}
                onChange={(e) => setForm({ ...form, maxOrderQty: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" disabled={busy}>{editingId ? 'Save changes' : 'Add product'}</button>
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
            <tr><th>SKU</th><th>Name</th><th>Price</th><th>Min/Max qty</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ opacity: p.isActive ? 1 : 0.5 }}>
                <td className="mono">{p.sku}</td>
                <td>{p.name}</td>
                <td className="mono">₹{p.defaultUnitPrice}</td>
                <td className="mono">{p.minOrderQty ?? '—'} / {p.maxOrderQty ?? '—'}</td>
                <td><span className="status-pill">{p.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="secondary" onClick={() => startEdit(p)}>Edit</button>
                  <button className="secondary" style={{ marginLeft: 6 }} onClick={() => toggleActive(p)} disabled={busy}>
                    {p.isActive ? 'Deactivate' : 'Activate'}
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
