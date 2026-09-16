'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { AgentEventDto, AgentTaskDto, OrderListItemDto, PurchaseOrderListItemDto } from '../../lib/types';

interface DashboardProps {
  onOpen?: (key: string) => void;
}

/** Landing page: one summary card per agent, each clickable to open that
 * agent. Numbers are real — pulled from the same list endpoints each agent
 * page itself uses, not a separate/parallel summary API. */
export function DashboardView({ onOpen }: DashboardProps) {
  const [orders, setOrders] = useState<OrderListItemDto[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderListItemDto[]>([]);
  const [tasks, setTasks] = useState<AgentTaskDto[]>([]);
  const [events, setEvents] = useState<AgentEventDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listOrders(), api.listPurchaseOrders(), api.listAgentTasks(), api.listAgentEvents()])
      .then(([o, po, t, e]) => {
        setOrders(o);
        setPurchaseOrders(po);
        setTasks(t);
        setEvents(e);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)));
  }, []);

  const validationHolds = orders.filter((o) => o.status === 'VALIDATION_HOLD').length;
  const poHolds = purchaseOrders.filter((po) => po.status === 'DRAFT').length;
  const pendingTasks = tasks.length;

  function go(key: string) {
    if (onOpen) onOpen(key);
  }

  const cards = [
    {
      key: 'orders',
      title: 'Order Agent',
      value: orders.length,
      label: 'orders total',
      detail: validationHolds > 0 ? `${validationHolds} on validation hold` : 'all validated',
      warn: validationHolds > 0,
    },
    {
      key: 'demand',
      title: 'Demand Agent',
      value: purchaseOrders.length,
      label: 'purchase orders',
      detail: poHolds > 0 ? `${poHolds} awaiting hold release` : 'none pending',
      warn: poHolds > 0,
    },
    {
      key: 'forecasting',
      title: 'Forecast Agent',
      value: '—',
      label: 'open Forecasting to view',
      detail: '',
      warn: false,
    },
    {
      key: 'inventory',
      title: 'Inventory Agent',
      value: '—',
      label: 'open Inventory to view stock',
      detail: '',
      warn: false,
    },
    {
      key: 'picklists',
      title: 'Fulfilment (Picklist)',
      value: '—',
      label: 'open Picklist to view',
      detail: '',
      warn: false,
    },
    {
      key: 'van',
      title: 'Van Sales (Secondary)',
      value: '—',
      label: 'open Van sales to view',
      detail: '',
      warn: false,
    },
    {
      key: 'approvals',
      title: 'Approvals',
      value: pendingTasks,
      label: 'pending tasks, any agent',
      detail: pendingTasks > 0 ? 'action needed' : 'all clear',
      warn: pendingTasks > 0,
    },
    {
      key: 'trace',
      title: 'Agent Trace',
      value: events.length,
      label: 'recent events logged',
      detail: '',
      warn: false,
    },
  ];

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        One summary per agent — click any card to open it.
      </p>
      {error && <p className="error-text">{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {cards.map((c) => (
          <div
            key={c.key}
            className="card"
            style={{ cursor: onOpen ? 'pointer' : 'default', marginBottom: 0 }}
            onClick={() => go(c.key)}
          >
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.title}</div>
            <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.label}</div>
            {c.detail && (
              <div style={{ fontSize: 12, marginTop: 6, color: c.warn ? 'var(--error)' : 'var(--success)' }}>
                {c.detail}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Recent agent activity</h2>
        {events.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No agent events yet.</p>
        ) : (
          <table>
            <thead><tr><th>Agent</th><th>Message</th><th>When</th></tr></thead>
            <tbody>
              {events.slice(0, 8).map((e) => (
                <tr key={e.id}>
                  <td>{e.agentName}</td>
                  <td style={{ fontSize: 13 }}>{e.message}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(e.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
