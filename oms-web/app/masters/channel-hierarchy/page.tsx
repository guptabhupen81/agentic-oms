'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { ChannelHierarchyNodeDto } from '../../../lib/types';

function flatten(nodes: ChannelHierarchyNodeDto[], depth = 0, out: { node: ChannelHierarchyNodeDto; depth: number }[] = []) {
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children?.length) flatten(node.children, depth + 1, out);
  }
  return out;
}

export default function ChannelHierarchyPage() {
  const [tree, setTree] = useState<ChannelHierarchyNodeDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refresh() {
    try {
      setTree(await api.getChannelHierarchyTree());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const flat = flatten(tree);
  const level1Options = flat.filter((f) => f.node.level === 1);

  function startEdit(node: ChannelHierarchyNodeDto) {
    setEditingId(node.id);
    setName(node.name);
    setParentId(node.parentId ?? '');
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setParentId('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (editingId) {
        // Rename only — level/parent are immutable once created, to keep
        // the "exactly 2 levels" invariant simple.
        await api.updateChannelNode(editingId, { name });
      } else {
        await api.createChannelNode({ name, parentId: parentId || undefined });
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this node? Only allowed if it has no children and no retailers mapped.')) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteChannelNode(id);
      if (editingId === id) resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Channel hierarchy</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Exactly 2 levels — Channel (Level 1) and Sub-Channel (Level 2). Retailers map only to a Level-2 node.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Rename node' : 'Add node'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {!editingId && (
              <div className="field">
                <label>Parent (blank = Level 1 / Channel)</label>
                <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">— none (new top-level Channel) —</option>
                  {level1Options.map((f) => (
                    <option key={f.node.id} value={f.node.id}>{f.node.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button type="submit" disabled={busy}>{editingId ? 'Save name' : 'Add node'}</button>
          {editingId && (
            <button type="button" className="secondary" style={{ marginLeft: 8 }} onClick={resetForm}>
              Cancel
            </button>
          )}
          {error && <p className="error-text">{error}</p>}
        </form>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Channel / Sub-Channel</th><th>Level</th><th></th></tr></thead>
          <tbody>
            {flat.map(({ node, depth }) => (
              <tr key={node.id}>
                <td style={{ paddingLeft: 12 + depth * 20 }}>{node.name}</td>
                <td className="mono">{node.level}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="secondary" onClick={() => startEdit(node)}>Rename</button>
                  <button className="secondary" style={{ marginLeft: 6 }} onClick={() => handleDelete(node.id)} disabled={busy}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
