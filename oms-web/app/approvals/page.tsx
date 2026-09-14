'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { AgentTaskDto } from '../../lib/types';

/** Renders a live "mm:ss" countdown computed from a REAL server timestamp —
 * not a client-side fake timer. Refreshing the page or opening the same
 * task on another device shows the same remaining time, because the truth
 * lives in the database (`dueAt`), not in this component's state. */
function Countdown({ dueAt }: { dueAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = new Date(dueAt).getTime() - now;
  if (remainingMs <= 0) return <span className="error-text">overdue</span>;

  const totalSeconds = Math.floor(remainingMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const urgent = remainingMs < 5 * 60 * 1000;

  return (
    <span className="mono" style={{ color: urgent ? 'var(--error)' : 'var(--accent)' }}>
      {m}:{s.toString().padStart(2, '0')}
    </span>
  );
}

export default function ApprovalsPage() {
  const [tasks, setTasks] = useState<AgentTaskDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      setTasks(await api.listAgentTasks());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000); // poll for tasks other users/agents create
    return () => clearInterval(id);
  }, []);

  async function resolve(task: AgentTaskDto, outcome: 'approved' | 'rejected') {
    setBusyId(task.id);
    setError(null);
    try {
      if (task.taskType === 'ORDER_VALIDATION') {
        await api.resolveValidation(task.entityId, outcome);
      } else if (task.taskType === 'PO_HOLD') {
        await api.resolvePOHold(task.entityId, outcome);
      } else {
        throw new Error(`Resolution for ${task.taskType} isn't wired up yet — next phase.`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>Approvals inbox</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Every task waiting on a human, from any agent, in one place. Countdown is computed from each task&apos;s real due timestamp.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {tasks.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No pending tasks.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Task</th><th>Entity</th><th>Detail</th><th>Due</th><th></th></tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td><span className="status-pill">{task.taskType}</span></td>
                  <td className="mono">{task.entityType} {task.entityId.slice(0, 8)}…</td>
                  <td style={{ fontSize: 12 }}>{task.reasonNote}</td>
                  <td><Countdown dueAt={task.dueAt} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button disabled={busyId === task.id} onClick={() => resolve(task, 'approved')}>Approve</button>
                    <button
                      className="secondary"
                      style={{ marginLeft: 6 }}
                      disabled={busyId === task.id}
                      onClick={() => resolve(task, 'rejected')}
                    >
                      Reject
                    </button>
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
