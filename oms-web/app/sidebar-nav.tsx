'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const OPERATIONS_LINKS = [
  { href: '/orders', label: 'Orders' },
  { href: '/picklists', label: 'Picklist' },
  { href: '/van', label: 'Van sales' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/trace', label: 'Agent Trace' },
];

const MASTER_LINKS = [
  { href: '/masters/retailers', label: 'Retailers' },
  { href: '/masters/products', label: 'Products' },
  { href: '/masters/vans', label: 'Vans' },
  { href: '/masters/warehouses', label: 'Warehouses' },
  { href: '/masters/manufacturers', label: 'Manufacturers' },
  { href: '/masters/hierarchy', label: 'Product hierarchy' },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav>
      {OPERATIONS_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={`nav-link ${pathname === link.href ? 'active' : ''}`}>
          {link.label}
        </Link>
      ))}

      <div style={{ padding: '14px 20px 6px 20px', fontSize: 12, color: 'var(--text-muted)' }}>Masters</div>
      {MASTER_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={`nav-link ${pathname === link.href ? 'active' : ''}`}>
          {link.label}
        </Link>
      ))}

      <Link href="/login" className={`nav-link ${pathname === '/login' ? 'active' : ''}`} style={{ marginTop: 14 }}>
        Log in
      </Link>
    </nav>
  );
}
