'use client';

import { Fragment, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { ForecastDto, ForecastFactorDto, HierarchyNodeDto, ProductDto } from '../../lib/types';

function flattenHierarchy(nodes: HierarchyNodeDto[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${'—'.repeat(depth)} ${n.name}` },
    ...flattenHierarchy(n.children ?? [], depth + 1),
  ]);
}

const EMPTY_FACTOR = {
  name: '',
  factorType: 'PROMOTION',
  scope: 'category' as 'category' | 'product',
  hierarchyNodeId: '',
  productId: '',
  upliftPercent: '10',
  startDate: '',
  endDate: '',
  notes: '',
};

export default function ForecastingPage() {
  const [factors, setFactors] = useState<ForecastFactorDto[]>([]);
  const [forecasts, setForecasts] = useState<ForecastDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [hierarchyOptions, setHierarchyOptions] = useState<{ id: string; label: string }[]>([]);
  const [openForecastId, setOpenForecastId] = useState<string | null>(null);
  const [openForecastDetail, setOpenForecastDetail] = useState<ForecastDto | null>(null);

  const [factorForm, setFactorForm] = useState(EMPTY_FACTOR);
  const [quarterLabel, setQuarterLabel] = useState('');
  const [growthPercent, setGrowthPercent] = useState('7.5');
  const [lines, setLines] = useState<{ productId: string; baseQty: string }[]>([{ productId: '', baseQty: '' }]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [f, runs, prods, hierarchy] = await Promise.all([
        api.listForecastFactors(),
        api.listForecasts(),
        api.listProductsForMaster(true),
        api.getHierarchyTree(),
      ]);
      setFactors(f);
      setForecasts(runs);
      setProducts(prods);
      setHierarchyOptions(flattenHierarchy(hierarchy));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAddFactor(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.createForecastFactor({
        name: factorForm.name,
        factorType: factorForm.factorType,
        hierarchyNodeId: factorForm.scope === 'category' ? factorForm.hierarchyNodeId : undefined,
        productId: factorForm.scope === 'product' ? factorForm.productId : undefined,
        upliftPercent: Number(factorForm.upliftPercent),
        startDate: factorForm.startDate,
        endDate: factorForm.endDate,
        notes: factorForm.notes || undefined,
      });
      setFactorForm(EMPTY_FACTOR);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function updateLine(index: number, field: 'productId' | 'baseQty', value: string) {
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, { productId: '', baseQty: '' }]);
  }

  async function handleRunForecast(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const validLines = lines
        .filter((l) => l.productId && l.baseQty)
        .map((l) => ({ productId: l.productId, baseQty: Number(l.baseQty) }));
      if (validLines.length === 0) throw new Error('Add at least one product line');

      await api.runForecast({ quarterLabel, growthPercent: Number(growthPercent), lines: validLines });
      setLines([{ productId: '', baseQty: '' }]);
      setQuarterLabel('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function viewForecast(id: string) {
    if (openForecastId === id) {
      setOpenForecastId(null);
      setOpenForecastDetail(null);
      return;
    }
    setBusy(true);
    try {
      setOpenForecastDetail(await api.getForecast(id));
      setOpenForecastId(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Forecasting</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Base quantity, scaled by quarter growth, scaled again by any active named factor — every line shows which factor moved it and by how much.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Factors</h2>
        <form onSubmit={handleAddFactor}>
          <div className="row">
            <div className="field">
              <label>Name</label>
              <input
                value={factorForm.name}
                onChange={(e) => setFactorForm({ ...factorForm, name: e.target.value })}
                placeholder="Diwali promotion"
                required
              />
            </div>
            <div className="field">
              <label>Type</label>
              <select
                value={factorForm.factorType}
                onChange={(e) => setFactorForm({ ...factorForm, factorType: e.target.value })}
              >
                <option value="PROMOTION">Promotion</option>
                <option value="PRODUCT_LAUNCH">Product launch</option>
                <option value="COMPETITOR">Competitor</option>
                <option value="SPECIAL_EVENT">Special event</option>
              </select>
            </div>
            <div className="field">
              <label>Uplift %</label>
              <input
                type="number"
                value={factorForm.upliftPercent}
                onChange={(e) => setFactorForm({ ...factorForm, upliftPercent: e.target.value })}
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Applies to</label>
              <select
                value={factorForm.scope}
                onChange={(e) => setFactorForm({ ...factorForm, scope: e.target.value as 'category' | 'product' })}
              >
                <option value="category">Whole category</option>
                <option value="product">One product</option>
              </select>
            </div>
            {factorForm.scope === 'category' ? (
              <div className="field">
                <label>Category</label>
                <select
                  value={factorForm.hierarchyNodeId}
                  onChange={(e) => setFactorForm({ ...factorForm, hierarchyNodeId: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {hierarchyOptions.map((h) => (
                    <option key={h.id} value={h.id}>{h.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="field">
                <label>Product</label>
                <select
                  value={factorForm.productId}
                  onChange={(e) => setFactorForm({ ...factorForm, productId: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="row">
            <div className="field">
              <label>Start date</label>
              <input
                type="date"
                value={factorForm.startDate}
                onChange={(e) => setFactorForm({ ...factorForm, startDate: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>End date</label>
              <input
                type="date"
                value={factorForm.endDate}
                onChange={(e) => setFactorForm({ ...factorForm, endDate: e.target.value })}
                required
              />
            </div>
          </div>
          <button type="submit" disabled={busy}>Add factor</button>
        </form>

        {factors.length > 0 && (
          <table style={{ marginTop: 16 }}>
            <thead><tr><th>Name</th><th>Type</th><th>Uplift</th><th>Window</th></tr></thead>
            <tbody>
              {factors.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td><span className="status-pill">{f.factorType}</span></td>
                  <td className="mono">+{f.upliftPercent}%</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {f.startDate.slice(0, 10)} – {f.endDate.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Run a forecast</h2>
        <form onSubmit={handleRunForecast}>
          <div className="row">
            <div className="field">
              <label>Quarter label</label>
              <input
                value={quarterLabel}
                onChange={(e) => setQuarterLabel(e.target.value)}
                placeholder="Q3 FY27"
                required
              />
            </div>
            <div className="field">
              <label>Growth %</label>
              <input type="number" value={growthPercent} onChange={(e) => setGrowthPercent(e.target.value)} />
            </div>
          </div>

          {lines.map((line, i) => (
            <div className="row" key={i}>
              <div className="field">
                <label>Product</label>
                <select value={line.productId} onChange={(e) => updateLine(i, 'productId', e.target.value)}>
                  <option value="">Select…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Base qty (last quarter)</label>
                <input
                  type="number"
                  value={line.baseQty}
                  onChange={(e) => updateLine(i, 'baseQty', e.target.value)}
                />
              </div>
            </div>
          ))}
          <button type="button" className="secondary" onClick={addLine} style={{ marginBottom: 12 }}>+ Add product line</button>
          <div>
            <button type="submit" disabled={busy}>Run forecast</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Past forecasts</h2>
        {forecasts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No forecasts run yet.</p>
        ) : (
          <table>
            <thead><tr><th>Quarter</th><th>Growth</th><th>Lines</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {forecasts.map((f) => (
                <Fragment key={f.id}>
                  <tr>
                    <td className="mono">{f.quarterLabel}</td>
                    <td className="mono">+{f.growthPercent}%</td>
                    <td className="mono">{f.lines.length}</td>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(f.createdAt).toLocaleString()}
                    </td>
                    <td><button className="secondary" onClick={() => viewForecast(f.id)}>
                      {openForecastId === f.id ? 'Hide' : 'View'}
                    </button></td>
                  </tr>
                  {openForecastId === f.id && openForecastDetail && (
                    <tr>
                      <td colSpan={5}>
                        <table>
                          <thead><tr><th>Product</th><th>Base</th><th>Growth-adjusted</th><th>Final</th><th>Applied factors</th></tr></thead>
                          <tbody>
                            {openForecastDetail.lines.map((l) => (
                              <tr key={l.id}>
                                <td>{l.product?.name}</td>
                                <td className="mono">{l.baseQty}</td>
                                <td className="mono">{l.growthAdjustedQty}</td>
                                <td className="mono">{l.finalQty}</td>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.appliedFactors}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
