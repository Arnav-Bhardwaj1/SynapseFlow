/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  status: 'idle' | 'busy' | 'syncing';
  ping: number;
  activeNodeId: string | null;
}

export interface SyncLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warn';
}

interface MultiplayerContextProps {
  collaborators: Record<string, Collaborator>;
  latency: number;
  isSimulating: boolean;
  syncLogs: SyncLog[];
  setLatency: (latency: number) => void;
  setIsSimulating: (isSimulating: boolean) => void;
  triggerSyncTransaction: (message: string, type?: SyncLog['type']) => void;
  updateCollaboratorPosition: (id: string, targetX: number, targetY: number) => void;
  updateCollaboratorDetails: (id: string, details: Partial<Collaborator>) => void;
}

const MultiplayerContext = createContext<MultiplayerContextProps | undefined>(undefined);

const INITIAL_COLLABORATORS: Record<string, Collaborator> = {
  'alice': {
    id: 'alice',
    name: 'Dev_Alice',
    color: '#a78bfa', // neon purple
    x: 200,
    y: 200,
    targetX: 200,
    targetY: 200,
    status: 'idle',
    ping: 42,
    activeNodeId: null
  },
  'bob': {
    id: 'bob',
    name: 'Dev_Bob',
    color: '#f472b6', // neon pink
    x: 450,
    y: 350,
    targetX: 450,
    targetY: 350,
    status: 'idle',
    ping: 58,
    activeNodeId: null
  },
  'copilot': {
    id: 'copilot',
    name: 'AI_Copilot_9000',
    color: '#06b6d4', // neon cyan
    x: 750,
    y: 150,
    targetX: 750,
    targetY: 150,
    status: 'idle',
    ping: 15,
    activeNodeId: null
  }
};

const INITIAL_SYNC_LOGS: SyncLog[] = [
  { timestamp: new Date().toLocaleTimeString(), message: '⚡ Multiplayer Session Server initialized successfully.', type: 'info' },
  { timestamp: new Date().toLocaleTimeString(), message: '📡 Listening for incoming transaction delta stream packets...', type: 'info' },
  { timestamp: new Date().toLocaleTimeString(), message: '👥 Collaborators connected: Dev_Alice, Dev_Bob, AI_Copilot_9000', type: 'success' }
];

export const MultiplayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collaborators, setCollaborators] = useState<Record<string, Collaborator>>(INITIAL_COLLABORATORS);
  const [latency, setLatencyState] = useState<number>(150); // initial simulated lag 150ms
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>(INITIAL_SYNC_LOGS);

  const triggerSyncTransaction = (message: string, type: SyncLog['type'] = 'info') => {
    const newLog: SyncLog = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setSyncLogs(prev => [...prev.slice(-38), newLog]); // Keep max 40 logs in buffer
  };

  const setLatency = (ms: number) => {
    setLatencyState(ms);
    triggerSyncTransaction(`📡 Simulated network latency modified: ${ms}ms.`, 'warn');
  };

  const updateCollaboratorPosition = (id: string, targetX: number, targetY: number) => {
    setCollaborators(prev => {
      const peer = prev[id];
      if (!peer) return prev;
      return {
        ...prev,
        [id]: {
          ...peer,
          targetX,
          targetY
        }
      };
    });
  };

  const updateCollaboratorDetails = (id: string, details: Partial<Collaborator>) => {
    setCollaborators(prev => {
      const peer = prev[id];
      if (!peer) return prev;
      return {
        ...prev,
        [id]: {
          ...peer,
          ...details
        }
      };
    });
  };

  // High-Performance Cursor Linear Interpolation (Lerp) Frame Animation
  useEffect(() => {
    let frameId: number;

    const animateCursors = () => {
      setCollaborators(prev => {
        const next = { ...prev };
        let hasChanges = false;

        Object.keys(next).forEach(id => {
          const peer = next[id];
          const dx = peer.targetX - peer.x;
          const dy = peer.targetY - peer.y;

          // If close enough, snap to target coordinates
          if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) {
            if (peer.x !== peer.targetX || peer.y !== peer.targetY) {
              next[id] = { ...peer, x: peer.targetX, y: peer.targetY };
              hasChanges = true;
            }
          } else {
            // Apply Lerp formula: current + delta * factor (e.g. 0.08 for smooth drag-glide)
            const speedFactor = 0.08;
            next[id] = {
              ...peer,
              x: peer.x + dx * speedFactor,
              y: peer.y + dy * speedFactor
            };
            hasChanges = true;
          }
        });

        return hasChanges ? next : prev;
      });

      frameId = requestAnimationFrame(animateCursors);
    };

    frameId = requestAnimationFrame(animateCursors);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <MultiplayerContext.Provider value={{
      collaborators,
      latency,
      isSimulating,
      syncLogs,
      setLatency,
      setIsSimulating,
      triggerSyncTransaction,
      updateCollaboratorPosition,
      updateCollaboratorDetails
    }}>
      {children}
    </MultiplayerContext.Provider>
  );
};

export const useMultiplayer = () => {
  const context = useContext(MultiplayerContext);
  if (!context) throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  return context;
};
