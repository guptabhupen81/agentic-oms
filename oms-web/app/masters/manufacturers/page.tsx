'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { ManufacturerDto } from '../../../lib/types';

/** View-only, as specified — manufacturers are onboarded through the
 * Purchase process elsewhere, not created/edited from this screen. */
export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<ManufacturerDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listManufacturers().then(setManufacturers).catch((err) => {
      setError(err instanceof ApiError ? err.message : String(err));
    });
  }, []);

  return (
    <div>
      <h1>Manufacturers</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        View-only — manufacturers are added as part of Purchase onboarding, not managed here.
      </p>
      {error && <p className="error-text">{error}</p>}
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>GSTIN</th></tr></thead>
          <tbody>
            {manufacturers.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td className="mono">{m.gstin || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
