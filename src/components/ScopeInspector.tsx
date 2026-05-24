import React from 'react';
import { useGraph } from '../context/GraphContext';
import { Eye } from 'lucide-react';

export const ScopeInspector: React.FC = () => {
  const { executionState, nodes } = useGraph();
  const { variables } = executionState;

  // Transform raw 'nodeId-portId' keys into human readable identifiers
  const scopeItems = Object.entries(variables).map(([key, val]) => {
    const [nodeId, portId] = key.split('-');
    const node = nodes.find(n => n.id === nodeId);
    const label = node ? node.label : nodeId;
    const type = typeof val;

    return {
      nodeId,
      portId,
      nodeLabel: label,
      value: val,
      type
    };
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 glass-panel border border-cyber-border rounded-lg overflow-hidden">
      {/* Inspector Header */}
      <div className="px-4 py-2 border-b border-cyber-border bg-slate-900/60 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-neon-cyan shrink-0 animate-pulse" />
          <span className="text-xs font-bold font-mono text-slate-200">scope_inspector.dll</span>
        </div>
      </div>

      {/* Variables List Panel */}
      <div className="flex-1 p-4 overflow-y-auto bg-slate-950/60 flex flex-col gap-2 min-h-0 select-text">
        {scopeItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-40 text-center select-none">
            <span className="text-xs font-mono">&gt; Scope stack empty. Run a simulation to populate active memory variables.</span>
          </div>
        ) : (
          <div className="w-full select-text">
            <table className="w-full text-[10px] font-mono text-left select-text">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 select-none">
                  <th className="pb-1.5 font-bold">SOURCE BLOCK</th>
                  <th className="pb-1.5 font-bold">PORT</th>
                  <th className="pb-1.5 font-bold">VALUE</th>
                  <th className="pb-1.5 font-bold text-right">TYPE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 select-text">
                {scopeItems.map((item, idx) => {
                  let typeColor = 'text-purple-400';
                  if (item.type === 'number') typeColor = 'text-amber-400';
                  if (item.type === 'boolean') typeColor = 'text-emerald-400';

                  return (
                    <tr key={idx} className="hover:bg-slate-900/40 select-text">
                      <td className="py-2 text-slate-300 font-bold truncate max-w-[120px] select-text">{item.nodeLabel}</td>
                      <td className="py-2 text-slate-500 select-text">{item.portId}</td>
                      <td className="py-2 text-slate-200 font-bold break-all select-text">
                        {JSON.stringify(item.value)}
                      </td>
                      <td className={`py-2 text-right ${typeColor} font-bold select-text`}>
                        {item.type.toUpperCase()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
