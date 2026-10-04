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
  { key: 'masters-distributors', label: 'Distributors' },
  { key: 'masters-retailers', label: 'Retailers' },
  { key: 'masters-products', label: 'Products' },
  { key: 'masters-vans', label: 'Vans (Secondary)' },
  { key: 'masters-trucks', label: 'Trucks (Primary)' },
  { key: 'masters-warehouses', label: 'Warehouses' },
  { key: 'masters-manufacturers', label: 'Manufacturers' },
  { key: 'masters-hierarchy', label: 'Product hierarchy' },
  { key: 'masters-salesmen', label: 'Salesmen' },
  { key: 'masters-channel-hierarchy', label: 'Channel hierarchy' },
];

// What each role sees.
//  MDM_ADMIN: Distributors, Products, Trucks (Primary), Warehouses, Manufacturers + both hierarchies,
//             and Agent Trace (oversight). No operational agents.
//  DB_ADMIN (and the other distributor-side roles): Retailers, Salesmen, Vans + every Agent EXCEPT Agent Trace.
const MDM_MASTER_KEYS = [
  'masters-distributors',
  'masters-products',
  'masters-trucks',
  'masters-warehouses',
  'masters-manufacturers',
  'masters-hierarchy',
  'masters-channel-hierarchy',
];
const DB_MASTER_KEYS = ['masters-retailers', 'masters-salesmen', 'masters-vans'];

export function linksForRole(role: string | null) {
  if (role === 'MDM_ADMIN') {
    return {
      agents: AGENT_LINKS.filter((l) => l.key === 'trace'),
      masters: MASTER_LINKS.filter((l) => MDM_MASTER_KEYS.includes(l.key)),
    };
  }
  return {
    agents: AGENT_LINKS.filter((l) => l.key !== 'trace'),
    masters: MASTER_LINKS.filter((l) => DB_MASTER_KEYS.includes(l.key)),
  };
}

interface SidebarNavProps {
  role: string | null;
  activeKey: string;
  onSelect: (key: string, label: string) => void;
  onLogout: () => void;
}

/** Every click opens (or switches to) a tab in the workspace shell — this is
 * no longer route-based navigation, since multiple tabs must stay mounted
 * simultaneously (a full page navigation would unmount everything). */
export function SidebarNav({ role, activeKey, onSelect, onLogout }: SidebarNavProps) {
  const { agents, masters } = linksForRole(role);
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
      {agents.map((link) => (
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
      {masters.map((link) => (
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
