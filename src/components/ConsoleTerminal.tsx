import React, { useEffect, useRef } from 'react';
import { useGraph } from '../context/GraphContext';
import { Terminal, ShieldAlert } from 'lucide-react';

export const ConsoleTerminal: React.FC = () => {
  const { executionState, error } = useGraph();
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [executionState.logs, error]);

  return (
    <div className="flex-1 flex flex-col min-w-0 glass-panel border border-cyber-border rounded-lg overflow-hidden">
      {/* Shell Header */}
      <div className="px-4 py-2 border-b border-cyber-border bg-slate-900/60 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-neon-green shrink-0 animate-pulse" />
          <span className="text-xs font-bold font-mono text-slate-200">execution_console.sh</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500"></span>
          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
          <span className="h-2 w-2 rounded-full bg-green-500"></span>
        </div>
      </div>

      {/* Terminal Screen */}
      <div className="flex-1 p-4 overflow-y-auto bg-slate-950/90 font-mono text-xs leading-relaxed flex flex-col gap-2 min-h-0 select-text">
        {/* Cycle Error Display */}
        {error && (
          <div className="p-3 border border-red-500/30 bg-red-950/20 text-neon-red rounded-md flex gap-2 items-start shrink-0">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="text-[10px] leading-relaxed">
              <span className="font-bold block">DYNAMIC VALIDATION ERROR</span>
              {error}
            </div>
          </div>
        )}

        {/* Dynamic Log Lines */}
        {executionState.logs.length === 0 && !error ? (
          <div className="flex-1 flex items-center justify-center opacity-40 select-none">
            <span className="blink-text">&gt; Idle. Press Play above to compile and run simulation...</span>
          </div>
        ) : (
          executionState.logs.map((log, index) => {
            let logColor = 'text-slate-300';
            if (log.type === 'success') logColor = 'text-neon-green';
            if (log.type === 'warning') logColor = 'text-neon-yellow';
            if (log.type === 'error') logColor = 'text-neon-red';
            if (log.nodeId === 'system') logColor = 'text-neon-cyan font-bold';

            return (
              <div key={index} className="flex gap-2 select-text">
                <span className="text-slate-600 select-none">[{log.timestamp}]</span>
                <span className="text-slate-500 select-none">&gt;</span>
                <span className={`${logColor} select-text break-words`}>{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
