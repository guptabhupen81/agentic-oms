'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { AgentEventDto } from '../../lib/types';

export default function TracePage() {
  const [events, setEvents] = useState<AgentEventDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setEvents(await api.listAgentEvents());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h1>Agent trace</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Real event log — every agent decision writes a row here the moment it happens, nothing pre-scripted.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {events.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No agent events yet — validate an order to generate some.</p>
        ) : (
          <table>
            <thead><tr><th>Agent</th><th>Entity</th><th>Message</th><th>When</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.agentName}</td>
                  <td className="mono">{e.entityType} {e.entityId.slice(0, 8)}…</td>
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
