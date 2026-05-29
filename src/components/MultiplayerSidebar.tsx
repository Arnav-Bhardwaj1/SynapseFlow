import React, { useEffect, useRef } from 'react';
import { useMultiplayer } from '../context/MultiplayerContext';
import { Users, Wifi, RefreshCw } from 'lucide-react';

export const MultiplayerSidebar: React.FC = () => {
  const {
    collaborators,
    latency,
    isSimulating,
    syncLogs,
    setLatency,
    setIsSimulating
  } = useMultiplayer();

  const journalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll synchronization logs
  useEffect(() => {
    journalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [syncLogs]);

  return (
    <div className="w-64 border-l border-cyber-border glass-panel shrink-0 flex flex-col p-4 overflow-y-auto">
      {/* 1. Header Section */}
      <h2 className="text-xs font-bold tracking-tight text-white mb-3 font-mono flex items-center gap-2">
        <Users className="h-4 w-4 text-neon-pink animate-pulse" /> COLLABORATION HUB
      </h2>
      <p className="text-[10px] text-slate-400 mb-4 leading-normal font-mono">
        Active P2P multiplayer session. Track remote workspace deltas and latency updates.
      </p>

      {/* 2. Simulation Controls */}
      <div className="flex flex-col gap-3.5 mb-5 p-3 rounded-lg bg-slate-900/60 border border-cyber-border/20">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] font-mono text-slate-300 font-bold uppercase flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5 text-neon-pink" /> NETWORK SIMULATOR
          </label>
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded-sm cursor-pointer transition-colors duration-200 ${
              isSimulating 
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-neon-green' 
                : 'bg-slate-800 border border-slate-700 text-slate-400'
            }`}
          >
            {isSimulating ? 'SIMULATOR ACTIVE' : 'SIMULATOR PAUSED'}
          </button>
        </div>

        {/* Latency Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[9px] font-mono text-slate-400 leading-none">
            <span>Ping Delay:</span>
            <span className="text-neon-pink font-bold">{latency}ms</span>
          </div>
          <input
            type="range"
            min="20"
            max="800"
            step="20"
            value={latency}
            onChange={(e) => setLatency(Number(e.target.value))}
            className="w-full accent-neon-pink cursor-pointer h-1.5 bg-slate-950 rounded-lg appearance-none border border-slate-800 mt-1"
          />
        </div>
      </div>

      {/* 3. Collaborators List Stack */}
      <div className="flex flex-col gap-2.5 mb-5">
        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">ACTIVE SESSION PEERS</span>
        {Object.values(collaborators).map(peer => {
          let statusBadge = 'bg-slate-500/20 text-slate-400';
          if (peer.status === 'busy') statusBadge = 'bg-amber-500/20 text-amber-300';
          if (peer.status === 'syncing') statusBadge = 'bg-emerald-500/20 text-emerald-300';

          return (
            <div
              key={peer.id}
              className="p-2.5 border border-cyber-border/10 rounded-md bg-slate-950/40 flex items-center justify-between gap-3 hover:border-cyber-border/40 transition-colors"
            >
              {/* Profile Block */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  style={{
                    backgroundColor: `${peer.color}20`,
                    border: `1.5px solid ${peer.color}`,
                    boxShadow: `0 0 5px ${peer.color}30`
                  }}
                  className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
                >
                  <span className="text-[10px] font-mono font-bold text-slate-100 uppercase">
                    {peer.name[4]}
                  </span>
                </div>
                <div className="min-w-0 leading-tight">
                  <span className="text-[10px] font-bold font-mono text-slate-200 block truncate">{peer.name}</span>
                  <span className={`text-[7px] font-mono font-bold px-1.5 py-0.5 rounded-sm inline-block mt-1 ${statusBadge}`}>
                    {peer.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Ping Meter */}
              <div className="text-right leading-none shrink-0">
                <span className="text-[9px] font-mono text-slate-400 block">{peer.ping}ms</span>
                <span className="text-[6px] font-mono text-slate-500 block mt-1 uppercase">P2P PING</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Sync Log Stream Terminal */}
      <div className="flex-1 flex flex-col min-h-[160px] border border-cyber-border/40 rounded-lg overflow-hidden bg-slate-950/80">
        <div className="px-3 py-1.5 border-b border-cyber-border bg-slate-900/40 flex items-center gap-1.5 shrink-0">
          <RefreshCw className="h-3.5 w-3.5 text-neon-pink shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
          <span className="text-[9px] font-bold font-mono text-slate-400">p2p_sync_stream.log</span>
        </div>

        <div className="flex-1 p-3 overflow-y-auto font-mono text-[9px] leading-relaxed text-slate-300 flex flex-col gap-2 min-h-0 select-text">
          {syncLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 select-none text-center px-4">
              <span>&gt; Standby. Listening for active peer synchronization packets...</span>
            </div>
          ) : (
            syncLogs.map((log, idx) => {
              let logColor = 'text-slate-400';
              if (log.type === 'success') logColor = 'text-neon-green';
              if (log.type === 'warn') logColor = 'text-neon-pink font-bold';
              if (log.type === 'info' && log.message.includes('[Sync]')) logColor = 'text-neon-cyan';

              return (
                <div key={idx} className="flex gap-1.5 select-text">
                  <span className="text-slate-600 select-none shrink-0">[{log.timestamp}]</span>
                  <span className={`${logColor} select-text break-words`}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={journalEndRef} />
        </div>
      </div>
    </div>
  );
};
