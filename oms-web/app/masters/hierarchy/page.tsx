'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { HierarchyNodeDto } from '../../../lib/types';

function TreeNode({ node, depth }: { node: HierarchyNodeDto; depth: number }) {
  return (
    <>
      <tr>
        <td style={{ paddingLeft: 12 + depth * 20 }}>{node.name}</td>
        <td className="mono">{node.level}</td>
      </tr>
      {node.children?.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

/** View-only, as specified — product hierarchy is structural and changes
 * rarely; not exposed for editing from this screen. */
export default function HierarchyPage() {
  const [tree, setTree] = useState<HierarchyNodeDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getHierarchyTree().then(setTree).catch((err) => {
      setError(err instanceof ApiError ? err.message : String(err));
    });
  }, []);

  return (
    <div>
      <h1>Product hierarchy</h1>
      <p className="page-sub" style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        View-only — structural category tree used by the Products master.
      </p>
      {error && <p className="error-text">{error}</p>}
      <div className="card">
        <table>
          <thead><tr><th>Category</th><th>Level</th></tr></thead>
          <tbody>
            {tree.map((node) => (
              <TreeNode key={node.id} node={node} depth={0} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
