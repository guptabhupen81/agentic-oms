'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { InventoryStockDto } from '../../lib/types';

/** Inventory Agent visibility screen: where every unit of stock physically
 * is, right now, across every warehouse — not scoped to a single location.
 * This is what the Demand Agent and Order Agent are implicitly reasoning
 * over when they check availability; this page just makes it visible. */
export default function InventoryPage() {
  const [stock, setStock] = useState<InventoryStockDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAllInventory().then(setStock).catch((err) => {
      setError(err instanceof ApiError ? err.message : String(err));
    });
  }, []);

  return (
    <div>
      <h1>Inventory</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Real-time stock visibility across every warehouse, by batch — the same data the Order and Demand Agents check before making a decision.
      </p>
      {error && <p className="error-text">{error}</p>}
      <div className="card">
        {stock.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No stock recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Warehouse</th><th>Product</th><th>Batch</th><th>Expiry</th><th>On hand</th><th>Allocated</th><th>Free</th></tr>
            </thead>
            <tbody>
              {stock.map((s) => {
                const onHand = Number(s.quantityOnHand);
                const allocated = Number(s.quantityAllocated);
                return (
                  <tr key={s.id}>
                    <td>{s.warehouse.name} <span className="mono" style={{ color: 'var(--text-muted)' }}>({s.warehouse.code})</span></td>
                    <td>{s.product.name} <span className="mono" style={{ color: 'var(--text-muted)' }}>({s.product.sku})</span></td>
                    <td className="mono">{s.batch.batchNumber}</td>
                    <td className="mono">{s.batch.expiryDate.slice(0, 10)}</td>
                    <td className="mono">{s.quantityOnHand}</td>
                    <td className="mono">{s.quantityAllocated}</td>
                    <td className="mono">{(onHand - allocated).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
