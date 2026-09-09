'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/orders', label: 'Orders' },
  { href: '/picklists', label: 'Picklist' },
  { href: '/van', label: 'Van sales' },
  { href: '/login', label: 'Log in' },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={`nav-link ${pathname === link.href ? 'active' : ''}`}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
