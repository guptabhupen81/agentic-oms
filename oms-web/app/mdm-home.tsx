'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/** Landing tab for MDM Admin — the operational agent dashboard belongs to the
 * distributor side, so MDM sees master-data counts and shortcuts instead. */
export function MdmHome({ onOpen }: { onOpen: (key: string) => void }) {
  const [counts, setCounts] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const load = (key: string, p: Promise<unknown[]>) =>
      p.then((rows) => setCounts((c) => ({ ...c, [key]: rows.length }))).catch(() => setCounts((c) => ({ ...c, [key]: null })));
    load('masters-distributors', api.listDistributors());
    load('masters-products', api.listProductsForMaster(false));
    load('masters-trucks', api.listTrucks(false));
    load('masters-warehouses', api.listWarehouses(false));
    load('masters-manufacturers', api.listManufacturers());
  }, []);

  const cards = [
    { key: 'masters-distributors', label: 'Distributors' },
    { key: 'masters-products', label: 'Products' },
    { key: 'masters-trucks', label: 'Trucks (Primary)' },
    { key: 'masters-warehouses', label: 'Warehouses' },
    { key: 'masters-manufacturers', label: 'Manufacturers' },
  ];

  return (
    <div>
      <h1>Master data</h1>
      <div className="row">
        {cards.map((c) => (
          <div key={c.key} className="card" style={{ cursor: 'pointer', minWidth: 160 }} onClick={() => onOpen(c.key)}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{counts[c.key] ?? '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
