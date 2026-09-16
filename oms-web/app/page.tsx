'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { session } from '../lib/api';
import { AGENT_LINKS, MASTER_LINKS, SidebarNav } from './sidebar-nav';
import { DashboardView } from './dashboard/dashboard-view';
import OrdersPage from './orders/page';
import DemandPage from './demand/page';
import ForecastingPage from './forecasting/page';
import InventoryPage from './inventory/page';
import PicklistsPage from './picklists/page';
import VanPage from './van/page';
import ApprovalsPage from './approvals/page';
import TracePage from './trace/page';
import RetailersPage from './masters/retailers/page';
import ProductsPage from './masters/products/page';
import VansMasterPage from './masters/vans/page';
import TrucksPage from './masters/trucks/page';
import WarehousesPage from './masters/warehouses/page';
import ManufacturersPage from './masters/manufacturers/page';
import HierarchyPage from './masters/hierarchy/page';

const ALL_LINKS = [{ key: 'dashboard', label: 'Dashboard' }, ...AGENT_LINKS, ...MASTER_LINKS];
const MAX_TABS = 6;

interface Tab {
  key: string;
  label: string;
}

function renderView(key: string, openTab: (key: string, label: string) => void) {
  switch (key) {
    case 'dashboard':
      return <DashboardView onOpen={(k) => {
        const link = ALL_LINKS.find((l) => l.key === k);
        if (link) openTab(link.key, link.label);
      }} />;
    case 'orders': return <OrdersPage />;
    case 'demand': return <DemandPage />;
    case 'forecasting': return <ForecastingPage />;
    case 'inventory': return <InventoryPage />;
    case 'picklists': return <PicklistsPage />;
    case 'van': return <VanPage />;
    case 'approvals': return <ApprovalsPage />;
    case 'trace': return <TracePage />;
    case 'masters-retailers': return <RetailersPage />;
    case 'masters-products': return <ProductsPage />;
    case 'masters-vans': return <VansMasterPage />;
    case 'masters-trucks': return <TrucksPage />;
    case 'masters-warehouses': return <WarehousesPage />;
    case 'masters-manufacturers': return <ManufacturersPage />;
    case 'masters-hierarchy': return <HierarchyPage />;
    default: return null;
  }
}

/**
 * The workspace shell — the ONE real page authenticated users interact
 * with. Every "menu item" opens or switches to a tab here rather than doing
 * a full route navigation, because a route change would unmount the whole
 * tree and lose every other open tab's state. Dashboard is permanently
 * pinned as tab zero and cannot be closed; up to 5 more tabs can be open
 * alongside it (6 total), matching the stated limit.
 */
export default function WorkspaceShell() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([{ key: 'dashboard', label: 'Dashboard' }]);
  const [activeKey, setActiveKey] = useState('dashboard');

  useEffect(() => {
    if (!session.getToken()) {
      router.push('/login');
      return;
    }
    setReady(true);
  }, [router]);

  function openTab(key: string, label: string) {
    setTabs((current) => {
      if (current.some((t) => t.key === key)) return current;
      if (current.length >= MAX_TABS) {
        alert(`Maximum ${MAX_TABS} tabs allowed (Dashboard plus 5 others) — close a tab first.`);
        return current;
      }
      return [...current, { key, label }];
    });
    setActiveKey(key);
  }

  function closeTab(key: string) {
    if (key === 'dashboard') return; // permanently pinned
    if (!window.confirm('Close this tab? Any unsaved work in it will be lost.')) return;

    setTabs((current) => {
      const index = current.findIndex((t) => t.key === key);
      const next = current.filter((t) => t.key !== key);
      if (activeKey === key) {
        const fallback = next[index - 1] ?? next[0];
        setActiveKey(fallback ? fallback.key : 'dashboard');
      }
      return next;
    });
  }

  function handleLogout() {
    session.clear();
    router.push('/login');
  }

  if (!ready) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Agentic OMS<span className="sub">FMCG distribution</span></div>
        <SidebarNav activeKey={activeKey} onSelect={openTab} onLogout={handleLogout} />
      </aside>

      <div className="workspace-shell">
        <div className="tab-bar">
          {tabs.map((t) => (
            <div
              key={t.key}
              className={`tab-pill ${activeKey === t.key ? 'active' : ''}`}
              onClick={() => setActiveKey(t.key)}
            >
              {t.label}
              {t.key !== 'dashboard' && (
                <span
                  className="tab-close"
                  onClick={(e) => { e.stopPropagation(); closeTab(t.key); }}
                >
                  ×
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="tab-content-area">
          {tabs.map((t) => (
            <div key={t.key} style={{ display: activeKey === t.key ? 'block' : 'none' }}>
              {renderView(t.key, openTab)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
