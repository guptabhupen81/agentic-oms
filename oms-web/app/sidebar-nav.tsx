'use client';

export const AGENT_LINKS = [
  { key: 'orders', label: 'Order Agent' },
  { key: 'demand', label: 'Demand Agent' },
  { key: 'forecasting', label: 'Forecast Agent' },
  { key: 'inventory', label: 'Inventory Agent' },
  { key: 'picklists', label: 'Fulfilment (Picklist)' },
  { key: 'van', label: 'Van Sales (Secondary)' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'trace', label: 'Agent Trace' },
];

export const MASTER_LINKS = [
  { key: 'masters-retailers', label: 'Retailers' },
  { key: 'masters-products', label: 'Products' },
  { key: 'masters-vans', label: 'Vans (Secondary)' },
  { key: 'masters-trucks', label: 'Trucks (Primary)' },
  { key: 'masters-warehouses', label: 'Warehouses' },
  { key: 'masters-manufacturers', label: 'Manufacturers' },
  { key: 'masters-hierarchy', label: 'Product hierarchy' },
];

interface SidebarNavProps {
  activeKey: string;
  onSelect: (key: string, label: string) => void;
  onLogout: () => void;
}

/** Every click opens (or switches to) a tab in the workspace shell — this is
 * no longer route-based navigation, since multiple tabs must stay mounted
 * simultaneously (a full page navigation would unmount everything). */
export function SidebarNav({ activeKey, onSelect, onLogout }: SidebarNavProps) {
  return (
    <nav>
      <a
        className={`nav-link ${activeKey === 'dashboard' ? 'active' : ''}`}
        onClick={() => onSelect('dashboard', 'Dashboard')}
        style={{ cursor: 'pointer', fontWeight: 600 }}
      >
        Dashboard
      </a>

      <div style={{ padding: '14px 20px 6px 20px', fontSize: 12, color: 'var(--text-muted)' }}>Agents</div>
      {AGENT_LINKS.map((link) => (
        <a
          key={link.key}
          className={`nav-link ${activeKey === link.key ? 'active' : ''}`}
          onClick={() => onSelect(link.key, link.label)}
          style={{ cursor: 'pointer' }}
        >
          {link.label}
        </a>
      ))}

      <div style={{ padding: '14px 20px 6px 20px', fontSize: 12, color: 'var(--text-muted)' }}>Masters</div>
      {MASTER_LINKS.map((link) => (
        <a
          key={link.key}
          className={`nav-link ${activeKey === link.key ? 'active' : ''}`}
          onClick={() => onSelect(link.key, link.label)}
          style={{ cursor: 'pointer' }}
        >
          {link.label}
        </a>
      ))}

      <a onClick={onLogout} className="nav-link" style={{ marginTop: 14, cursor: 'pointer' }}>
        Log out
      </a>
    </nav>
  );
}
