import { useEffect, useRef } from 'react';
import type { Node, Connection, NodeType } from '../types/graph';

interface GraphActions {
  nodes: Node[];
  connections: Connection[];
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeData: (id: string, data: Partial<Node['data']>) => void;
  addNode: (type: NodeType, x: number, y: number) => void;
  addConnection: (fromNodeId: string, fromPortId: string, toNodeId: string, toPortId: string) => boolean;
}

interface MultiplayerActions {
  collaborators: Record<string, unknown>;
  latency: number;
  isSimulating: boolean;
  triggerSyncTransaction: (message: string, type?: 'info' | 'success' | 'warn') => void;
  updateCollaboratorPosition: (id: string, targetX: number, targetY: number) => void;
  updateCollaboratorDetails: (id: string, details: Record<string, unknown>) => void;
}

/**
 * High-performance multiplayer logic bot emulator loop.
 * Simulates concurrent developers editing the graph visually on background threads.
 */
export function useMultiplayerSimulator(
  graph: GraphActions,
  multiplayer: MultiplayerActions
) {
  const { nodes, connections } = graph;
  const { isSimulating, latency } = multiplayer;

  // Store ref locks to prevent concurrent loop collisions
  const isSimulatingRef = useRef(isSimulating);
  const latencyRef = useRef(latency);
  const nodesRef = useRef(nodes);
  const connectionsRef = useRef(connections);
  const graphRef = useRef(graph);
  const multiplayerRef = useRef(multiplayer);
  
  // Track active loop timers for clean teardown
  const activeTimersRef = useRef<number[]>([]);

  useEffect(() => { isSimulatingRef.current = isSimulating; }, [isSimulating]);
  useEffect(() => { latencyRef.current = latency; }, [latency]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
  useEffect(() => { graphRef.current = graph; }, [graph]);
  useEffect(() => { multiplayerRef.current = multiplayer; }, [multiplayer]);

  // Collaborator Routine Timer Loops
  useEffect(() => {
    if (!isSimulating) return;

    const registerTimeout = (fn: () => void, ms: number) => {
      if (!isSimulatingRef.current) return 0;
      const handle = window.setTimeout(() => {
        activeTimersRef.current = activeTimersRef.current.filter(t => t !== handle);
        if (isSimulatingRef.current) {
          fn();
        }
      }, ms);
      activeTimersRef.current.push(handle);
      return handle;
    };

    // --- Peer 1: Alice (Specialist in Math & Logic Operations) ---
    const runAliceLoop = () => {
      if (!isSimulatingRef.current) return;

      const randomAction = Math.random();
      
      // Action A: Nudge/Drag existing operator or input node visually
      if (randomAction < 0.4 && nodesRef.current.length > 0) {
        const opNodes = nodesRef.current.filter(n => n.type === 'operator' || n.type === 'input');
        if (opNodes.length > 0) {
          const target = opNodes[Math.floor(Math.random() * opNodes.length)];
          const deltaX = Math.round((Math.random() - 0.5) * 80);
          const deltaY = Math.round((Math.random() - 0.5) * 60);
          const finalX = Math.max(target.x + deltaX, 40);
          const finalY = Math.max(target.y + deltaY, 60);

          // Phase 1: Move cursor to node position
          multiplayerRef.current.updateCollaboratorPosition('alice', target.x, target.y);
          multiplayerRef.current.updateCollaboratorDetails('alice', { status: 'syncing', activeNodeId: target.id });
          
          // Phase 2: Simulating drag transaction with latency buffer
          registerTimeout(() => {
            if (isSimulatingRef.current) {
              multiplayerRef.current.updateCollaboratorPosition('alice', finalX, finalY);
              graphRef.current.updateNodePosition(target.id, finalX, finalY);
              multiplayerRef.current.triggerSyncTransaction(`🔄 [Sync] Dev_Alice relocated block '${target.label}' to (${finalX}, ${finalY}).`, 'info');
              
              // Phase 3: Return to idle
              registerTimeout(() => {
                multiplayerRef.current.updateCollaboratorDetails('alice', { status: 'idle', activeNodeId: null });
              }, 400);
            }
          }, latencyRef.current);
        }
      }
      
      // Action B: Random walk cursor hover simulation
      else {
        const randX = 100 + Math.random() * 600;
        const randY = 100 + Math.random() * 450;
        multiplayerRef.current.updateCollaboratorPosition('alice', randX, randY);
        
        // Simulates ping pings
        const updatedPing = Math.max(30, Math.round(42 + (Math.random() - 0.5) * 12));
        multiplayerRef.current.updateCollaboratorDetails('alice', { ping: updatedPing });
      }

      // Schedule next event (latency factored in)
      const nextDelay = 3000 + Math.random() * 2500 + latencyRef.current;
      registerTimeout(runAliceLoop, nextDelay);
    };

    // --- Peer 2: Bob (Specialist in variables & printing telemetry) ---
    const runBobLoop = () => {
      if (!isSimulatingRef.current) return;

      const randomAction = Math.random();

      // Action A: Edit parameter values inside constant / logger cards
      if (randomAction < 0.35 && nodesRef.current.length > 0) {
        const editableNodes = nodesRef.current.filter(n => n.type === 'input' || n.type === 'variable');
        if (editableNodes.length > 0) {
          const target = editableNodes[Math.floor(Math.random() * editableNodes.length)];
          const newValue = target.type === 'input' 
            ? Math.round(Math.random() * 100) 
            : ['Matrix', 'Telemetry', 'P2PStream', 'Vertex'][Math.floor(Math.random() * 4)];

          multiplayerRef.current.updateCollaboratorPosition('bob', target.x + 100, target.y + 40);
          multiplayerRef.current.updateCollaboratorDetails('bob', { status: 'busy', activeNodeId: target.id });

          registerTimeout(() => {
            if (isSimulatingRef.current) {
              graphRef.current.updateNodeData(target.id, { value: newValue });
              multiplayerRef.current.triggerSyncTransaction(`📝 [Edit] Dev_Bob updated value of '${target.label}' to ${JSON.stringify(newValue)}.`, 'success');
              
              registerTimeout(() => {
                multiplayerRef.current.updateCollaboratorDetails('bob', { status: 'idle', activeNodeId: null });
              }, 500);
            }
          }, latencyRef.current + 200);
        }
      }
      
      // Action B: Standard cursor hovering
      else {
        const randX = 150 + Math.random() * 700;
        const randY = 150 + Math.random() * 500;
        multiplayerRef.current.updateCollaboratorPosition('bob', randX, randY);

        const updatedPing = Math.max(40, Math.round(58 + (Math.random() - 0.5) * 18));
        multiplayerRef.current.updateCollaboratorDetails('bob', { ping: updatedPing });
      }

      const nextDelay = 4000 + Math.random() * 3000 + latencyRef.current;
      registerTimeout(runBobLoop, nextDelay);
    };

    // --- Peer 3: AI Copilot Bot (Validates graph topological states) ---
    const runCopilotLoop = () => {
      if (!isSimulatingRef.current) return;

      const randomAction = Math.random();

      // Action A: Evaluate graph topology and print diagnostics
      if (randomAction < 0.3) {
        const nodeCount = nodesRef.current.length;
        const connCount = connectionsRef.current.length;

        // Hover over logger node or center area
        multiplayerRef.current.updateCollaboratorPosition('copilot', 500, 250);
        multiplayerRef.current.updateCollaboratorDetails('copilot', { status: 'syncing' });

        registerTimeout(() => {
          if (isSimulatingRef.current) {
            multiplayerRef.current.triggerSyncTransaction(`🤖 [AI Agent] Diagnostic checklist: NodeCount=${nodeCount}, Wires=${connCount}. Verifying top-sort pathways...`, 'info');
            multiplayerRef.current.triggerSyncTransaction(`✅ [AI Agent] Dynamic execution graph satisfies Kahn's topological DAG bounds.`, 'success');
            
            multiplayerRef.current.updateCollaboratorDetails('copilot', { status: 'idle' });
          }
        }, latencyRef.current);
      }
      
      // Action B: Cursor roaming
      else {
        const randX = 200 + Math.random() * 600;
        const randY = 80 + Math.random() * 400;
        multiplayerRef.current.updateCollaboratorPosition('copilot', randX, randY);

        const updatedPing = Math.max(10, Math.round(15 + (Math.random() - 0.5) * 4));
        multiplayerRef.current.updateCollaboratorDetails('copilot', { ping: updatedPing });
      }

      const nextDelay = 5000 + Math.random() * 4000 + latencyRef.current;
      registerTimeout(runCopilotLoop, nextDelay);
    };

    // Start collaborator timers
    registerTimeout(runAliceLoop, 1000);
    registerTimeout(runBobLoop, 2200);
    registerTimeout(runCopilotLoop, 3500);

    return () => {
      activeTimersRef.current.forEach(t => clearTimeout(t));
      activeTimersRef.current = [];
    };
  }, [isSimulating]);
}
