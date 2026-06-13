import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useGraph } from '../context/GraphContext';
import type { ExecutionLog } from '../types/graph';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  ChevronsLeft, 
  ChevronsRight, 
  Plus, 
  Trash2, 
  AlertCircle, 
  X, 
  Clock, 
  Sparkles, 
  Terminal, 
  Zap, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  Cpu
} from 'lucide-react';

interface TimeTravelDebuggerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Configured standard latency representation (for visual timeline references)
const NODE_LATENCIES: Record<string, number> = {
  input: 10,
  variable: 5,
  operator: 15,
  conditional: 25,
  logger: 20,
  custom: 30
};

interface Breakpoint {
  id: string;
  type: 'node' | 'condition';
  nodeId: string;
  portId?: string;
  operator?: '==' | '!=' | '>' | '<' | 'contains';
  value?: string;
  isEnabled: boolean;
}

interface StateOverride {
  id: string;
  portKey: string; // "nodeId-portId"
  value: any;
}

interface TraceTick {
  tick: number;
  nodeId: string | null;
  nodeLabel: string;
  nodeType: string;
  variables: Record<string, any>;
  logs: ExecutionLog[];
  latencyOffset: number;
  message: string;
}

export const TimeTravelDebugger: React.FC<TimeTravelDebuggerProps> = ({ isOpen, onClose }) => {
  const { nodes, connections, setCurrentNodeId } = useGraph();

  // Debugger local states
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(600); // ms per step
  const [hoveredTick, setHoveredTick] = useState<number | null>(null);

  // Overrides & Breakpoints state
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [overrides, setOverrides] = useState<StateOverride[]>([]);
  const [breakpointAlert, setBreakpointAlert] = useState<string | null>(null);

  // Panel Collapsible UI states
  const [isBreakpointsCollapsed, setIsBreakpointsCollapsed] = useState<boolean>(false);
  const [isOverridesCollapsed, setIsOverridesCollapsed] = useState<boolean>(false);
  const [isCallStackCollapsed, setIsCallStackCollapsed] = useState<boolean>(false);

  // Add Breakpoint form states
  const [bpType, setBpType] = useState<'node' | 'condition'>('node');
  const [bpNodeId, setBpNodeId] = useState<string>('');
  const [bpPortId, setBpPortId] = useState<string>('');
  const [bpOperator, setBpOperator] = useState<'==' | '!=' | '>' | '<' | 'contains'>('==');
  const [bpValue, setBpValue] = useState<string>('');

  // Add Override form states
  const [ovPortKey, setOvPortKey] = useState<string>('');
  const [ovValue, setOvValue] = useState<string>('');

  // Playback timer reference
  const playbackTimerRef = useRef<any>(null);

  // Synchronize canvas highlight when currentTick or trace changes
  useEffect(() => {
    if (!isOpen) return;
    const activeNodeId = trace[currentTick]?.nodeId || null;
    setCurrentNodeId(activeNodeId);
  }, [currentTick, isOpen]);

  // Clean canvas node highlight when debugger is closed
  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCurrentNodeId(null);
    }
  }, [isOpen]);

  // Clean playback timer on unmount
  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, []);

  // =========================================================
  // ALGORITHM 1: Kahn's Topological Sort (Local copy for tracer)
  // =========================================================
  const topologicalOrder = useMemo((): { order: string[]; hasCycle: boolean } => {
    if (nodes.length === 0) return { order: [], hasCycle: false };

    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    const nodeIds = nodes.map(n => n.id);

    nodeIds.forEach(id => {
      inDegree[id] = 0;
      adj[id] = [];
    });

    connections.forEach(conn => {
      if (adj[conn.fromNodeId] && adj[conn.toNodeId]) {
        adj[conn.fromNodeId].push(conn.toNodeId);
        inDegree[conn.toNodeId]++;
      }
    });

    const queue: string[] = nodeIds.filter(id => inDegree[id] === 0);
    const order: string[] = [];

    while (queue.length > 0) {
      const u = queue.shift()!;
      order.push(u);

      const neighbors = adj[u] || [];
      neighbors.forEach(v => {
        inDegree[v]--;
        if (inDegree[v] === 0) {
          queue.push(v);
        }
      });
    }

    const hasCycle = order.length < nodes.length;
    return { order: hasCycle ? [] : order, hasCycle };
  }, [nodes, connections]);

  // =========================================================
  // ALGORITHM 2: Graph Step Interpreter with Value Injection
  // =========================================================
  const trace = useMemo((): TraceTick[] => {
    const { order, hasCycle } = topologicalOrder;
    if (hasCycle || nodes.length === 0 || order.length === 0) {
      return [{
        tick: 0,
        nodeId: null,
        nodeLabel: 'System',
        nodeType: 'system',
        variables: {},
        logs: [{
          timestamp: new Date().toLocaleTimeString(),
          nodeId: 'system',
          message: '❌ Compilation blocked: Cycle or empty graph detected.',
          type: 'error'
        }],
        latencyOffset: 0,
        message: 'Compilation Failed'
      }];
    }

    const resultTrace: TraceTick[] = [];
    let currentVars: Record<string, any> = {};
    let accumulatedLogs: ExecutionLog[] = [];
    let timeAccumulator = 0;

    // Tick 0: Initial State
    accumulatedLogs.push({
      timestamp: new Date().toLocaleTimeString(),
      nodeId: 'system',
      message: '⚙️ Initializing Time-Travel Debugger Engine...',
      type: 'info'
    });

    // Populate initial inputs and constants
    nodes.forEach(n => {
      if (n.type === 'input' || n.type === 'variable') {
        const val = n.data.value !== undefined ? n.data.value : 0;
        const outPort = n.outputs[0]?.id;
        if (outPort) {
          const portKey = `${n.id}-${outPort}`;
          // Check if there is an injection override
          const ov = overrides.find(o => o.portKey === portKey);
          currentVars[portKey] = ov ? ov.value : val;
        }
      }
    });

    resultTrace.push({
      tick: 0,
      nodeId: null,
      nodeLabel: 'Simulation Start',
      nodeType: 'system',
      variables: { ...currentVars },
      logs: [...accumulatedLogs],
      latencyOffset: 0,
      message: 'System variables loaded.'
    });

    // Run each node in topological sequence and record state snapshots
    order.forEach((nodeId, idx) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      const latency = NODE_LATENCIES[node.type] || 10;
      timeAccumulator += latency;

      const getInputValue = (portId: string, fallback: any = null): any => {
        // If an override is set on this input port, prioritize it
        const inputKey = `${nodeId}-${portId}`;
        const ovInput = overrides.find(o => o.portKey === inputKey);
        if (ovInput) return ovInput.value;

        // Check connected output
        const conn = connections.find(c => c.toNodeId === nodeId && c.toPortId === portId);
        if (conn) {
          const sourceKey = `${conn.fromNodeId}-${conn.fromPortId}`;
          
          // Check if there is an override on the source output port
          const ovSource = overrides.find(o => o.portKey === sourceKey);
          if (ovSource) return ovSource.value;

          const val = currentVars[sourceKey];
          return val !== undefined ? val : fallback;
        }
        return fallback;
      };

      let stepMessage = '';
      let logType: ExecutionLog['type'] = 'info';

      switch (node.type) {
        case 'input':
        case 'variable': {
          const val = node.data.value !== undefined ? node.data.value : 0;
          const outPort = node.outputs[0]?.id;
          if (outPort) {
            const portKey = `${node.id}-${outPort}`;
            const ov = overrides.find(o => o.portKey === portKey);
            currentVars[portKey] = ov ? ov.value : val;
          }
          const activeVal = currentVars[`${node.id}-${node.outputs[0]?.id}`];
          stepMessage = `Constant literal loaded: ${JSON.stringify(activeVal)}`;
          logType = 'info';
          break;
        }

        case 'operator': {
          const valA = getInputValue('a', 0);
          const valB = getInputValue('b', 0);
          const op = node.data.operator || '+';
          let result: any = 0;

          try {
            switch (op) {
              case '+': result = Number(valA) + Number(valB); break;
              case '-': result = Number(valA) - Number(valB); break;
              case '*': result = Number(valA) * Number(valB); break;
              case '/': result = Number(valB) !== 0 ? Number(valA) / Number(valB) : 0; break;
              case '%': result = Number(valA) % Number(valB); break;
              case '>': result = valA > valB; break;
              case '<': result = valA < valB; break;
              case '===': result = valA === valB; break;
              case '&&': result = Boolean(valA) && Boolean(valB); break;
              case '||': result = Boolean(valA) || Boolean(valB); break;
              default: result = valA + valB;
            }
          } catch (e) {
            result = 0;
          }

          const outPort = node.outputs[0]?.id;
          if (outPort) {
            const portKey = `${node.id}-${outPort}`;
            const ov = overrides.find(o => o.portKey === portKey);
            currentVars[portKey] = ov ? ov.value : result;
          }
          
          const finalResult = currentVars[`${node.id}-${outPort}`];
          stepMessage = `Operator evaluated: ${valA} ${op} ${valB} = ${JSON.stringify(finalResult)}`;
          logType = 'success';
          break;
        }

        case 'conditional': {
          const cond = getInputValue('condition', false);
          const ifTrue = getInputValue('if_true', null);
          const ifFalse = getInputValue('if_false', null);
          const result = cond ? ifTrue : ifFalse;

          const outPort = node.outputs[0]?.id; // 'result' port
          if (outPort) {
            const portKey = `${node.id}-${outPort}`;
            const ov = overrides.find(o => o.portKey === portKey);
            currentVars[portKey] = ov ? ov.value : result;
          }

          const finalResult = currentVars[`${node.id}-${outPort}`];
          stepMessage = `Branch conditional routing (if ${Boolean(cond)}): Selected ${JSON.stringify(finalResult)}`;
          logType = 'info';
          break;
        }

        case 'logger': {
          const prefix = node.data.logPrefix || 'Logger:';
          const val = getInputValue('input_val', 'undefined');
          stepMessage = `Log flushed to console: "${prefix} ${JSON.stringify(val)}"`;
          logType = 'success';
          break;
        }

        case 'custom': {
          const inputsObj: Record<string, any> = {};
          node.inputs.forEach(p => {
            inputsObj[p.id] = getInputValue(p.id, null);
          });

          const outputsMap = new Map<string, any>();
          const outputsObj = {
            set: (portId: string, val: any) => {
              outputsMap.set(portId, val);
            }
          };

          const userCode = node.data.code || '';
          let executionError: string | null = null;
          try {
            const func = new Function('inputs', 'outputs', userCode);
            func(inputsObj, outputsObj);

            node.outputs.forEach(p => {
              const portKey = `${node.id}-${p.id}`;
              const ov = overrides.find(o => o.portKey === portKey);
              currentVars[portKey] = ov ? ov.value : (outputsMap.get(p.id) !== undefined ? outputsMap.get(p.id) : null);
            });
          } catch (e: any) {
            executionError = e.message || String(e);
            node.outputs.forEach(p => {
              currentVars[`${node.id}-${p.id}`] = null;
            });
          }

          if (executionError) {
            stepMessage = `Script execution error: ${executionError}`;
            logType = 'error';
          } else {
            const outputsJson = JSON.stringify(Object.fromEntries(outputsMap));
            stepMessage = `Evaluated custom script successfully. Outputs: ${outputsJson}`;
            logType = 'success';
          }
          break;
        }
      }

      accumulatedLogs.push({
        timestamp: new Date().toLocaleTimeString(),
        nodeId: node.id,
        message: `[Step ${idx + 1}] ${node.label}: ${stepMessage}`,
        type: logType
      });

      resultTrace.push({
        tick: idx + 1,
        nodeId: node.id,
        nodeLabel: node.label,
        nodeType: node.type,
        variables: { ...currentVars },
        logs: [...accumulatedLogs],
        latencyOffset: timeAccumulator,
        message: stepMessage
      });
    });

    return resultTrace;
  }, [nodes, connections, overrides, topologicalOrder]);

  // Set default form dropdown selection when nodes populate
  useEffect(() => {
    if (nodes.length > 0 && !bpNodeId) {
      setBpNodeId(nodes[0].id);
    }
  }, [nodes]);

  // Sync inputs/outputs when selected node inside breakpoint form changes
  const activeBpNode = useMemo(() => {
    return nodes.find(n => n.id === bpNodeId);
  }, [bpNodeId, nodes]);

  useEffect(() => {
    if (activeBpNode) {
      const allPorts = [...activeBpNode.inputs, ...activeBpNode.outputs];
      if (allPorts.length > 0) {
        setBpPortId(allPorts[0].id);
      } else {
        setBpPortId('');
      }
    }
  }, [activeBpNode]);

  // Populate first port key for injection overrides form
  const availablePortsList = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    nodes.forEach(n => {
      n.inputs.forEach(p => list.push({ key: `${n.id}-${p.id}`, label: `${n.label} ➜ In: ${p.name}` }));
      n.outputs.forEach(p => list.push({ key: `${n.id}-${p.id}`, label: `${n.label} ➜ Out: ${p.name}` }));
    });
    return list;
  }, [nodes]);

  useEffect(() => {
    if (availablePortsList.length > 0 && !ovPortKey) {
      setOvPortKey(availablePortsList[0].key);
    }
  }, [availablePortsList]);

  // =========================================================
  // ALGORITHM 3: Breakpoint Evaluator during Simulation Play
  // =========================================================
  const checkBreakpoints = (tickIndex: number): Breakpoint | null => {
    if (tickIndex <= 0 || tickIndex >= trace.length) return null;
    const targetState = trace[tickIndex];
    const targetNodeId = targetState.nodeId;

    for (const bp of breakpoints) {
      if (!bp.isEnabled) continue;

      // 1. Node Breakpoint: stops when a node is evaluated
      if (bp.type === 'node' && bp.nodeId === targetNodeId) {
        return bp;
      }

      // 2. Conditional Breakpoint: stops when a port variable matches values
      if (bp.type === 'condition' && bp.nodeId === targetNodeId && bp.portId) {
        const varKey = `${bp.nodeId}-${bp.portId}`;
        const val = targetState.variables[varKey];

        if (val !== undefined) {
          const targetValStr = bp.value || '';
          let match = false;

          switch (bp.operator) {
            case '==':
              match = String(val) === targetValStr;
              break;
            case '!=':
              match = String(val) !== targetValStr;
              break;
            case '>':
              match = Number(val) > Number(targetValStr);
              break;
            case '<':
              match = Number(val) < Number(targetValStr);
              break;
            case 'contains':
              match = String(val).toLowerCase().includes(targetValStr.toLowerCase());
              break;
          }

          if (match) return bp;
        }
      }
    }

    return null;
  };

  // Playback Loop Effect
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(() => {
        setCurrentTick(prev => {
          const nextTick = prev + 1;
          if (nextTick >= trace.length) {
            setIsPlaying(false);
            return prev;
          }

          // Evaluate breakpoints
          const hitBreakpoint = checkBreakpoints(nextTick);
          if (hitBreakpoint) {
            setIsPlaying(false);
            const nodeName = nodes.find(n => n.id === hitBreakpoint.nodeId)?.label || hitBreakpoint.nodeId;
            const message = hitBreakpoint.type === 'node'
              ? `Reached node "${nodeName}"`
              : `Condition met: variable ${hitBreakpoint.portId} (${hitBreakpoint.operator} ${hitBreakpoint.value})`;
            setBreakpointAlert(`🛑 Breakpoint Triggered: ${message}`);
            return nextTick;
          }

          return nextTick;
        });
      }, playbackSpeed);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, playbackSpeed, trace, breakpoints]);

  // =========================================================
  // ACTIONS / HANDLERS
  // =========================================================
  const handlePlayPause = () => {
    setBreakpointAlert(null);
    if (currentTick >= trace.length - 1) {
      setCurrentTick(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleStepForward = () => {
    setBreakpointAlert(null);
    setCurrentTick(prev => {
      const nextTick = Math.min(prev + 1, trace.length - 1);
      const hitBp = checkBreakpoints(nextTick);
      if (hitBp) {
        const name = nodes.find(n => n.id === hitBp.nodeId)?.label || hitBp.nodeId;
        setBreakpointAlert(`🛑 Breakpoint Triggered (Single-Step) at node "${name}"`);
      }
      return nextTick;
    });
  };

  const handleStepBackward = () => {
    setBreakpointAlert(null);
    setCurrentTick(prev => Math.max(prev - 1, 0));
  };

  const handleJumpToStart = () => {
    setBreakpointAlert(null);
    setIsPlaying(false);
    setCurrentTick(0);
  };

  const handleJumpToEnd = () => {
    setBreakpointAlert(null);
    setIsPlaying(false);
    setCurrentTick(trace.length - 1);
  };

  // Breakpoint Add/Remove
  const handleAddBreakpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bpNodeId) return;

    const newBp: Breakpoint = {
      id: `bp-${Math.random().toString(36).substring(2, 9)}`,
      type: bpType,
      nodeId: bpNodeId,
      portId: bpType === 'condition' ? bpPortId : undefined,
      operator: bpType === 'condition' ? bpOperator : undefined,
      value: bpType === 'condition' ? bpValue : undefined,
      isEnabled: true
    };

    setBreakpoints(prev => [...prev, newBp]);
    // reset form fields
    setBpValue('');
  };

  const handleDeleteBreakpoint = (id: string) => {
    setBreakpoints(prev => prev.filter(b => b.id !== id));
  };

  const handleToggleBreakpoint = (id: string) => {
    setBreakpoints(prev => prev.map(b => b.id === id ? { ...b, isEnabled: !b.isEnabled } : b));
  };

  // Override State Add/Remove
  const handleAddOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ovPortKey) return;

    // Parse value according to its type (number, boolean, or string)
    let parsedVal: any = ovValue;
    if (ovValue.toLowerCase() === 'true') parsedVal = true;
    else if (ovValue.toLowerCase() === 'false') parsedVal = false;
    else if (!isNaN(Number(ovValue)) && ovValue.trim() !== '') parsedVal = Number(ovValue);

    const existingIndex = overrides.findIndex(o => o.portKey === ovPortKey);
    if (existingIndex > -1) {
      setOverrides(prev => {
        const next = [...prev];
        next[existingIndex] = { id: next[existingIndex].id, portKey: ovPortKey, value: parsedVal };
        return next;
      });
    } else {
      const newOv: StateOverride = {
        id: `ov-${Math.random().toString(36).substring(2, 9)}`,
        portKey: ovPortKey,
        value: parsedVal
      };
      setOverrides(prev => [...prev, newOv]);
    }

    setOvValue('');
  };

  const handleDeleteOverride = (id: string) => {
    setOverrides(prev => prev.filter(o => o.id !== id));
  };

  const handleClearAllOverrides = () => {
    setOverrides([]);
  };

  // Compute Variable Diffs between current tick (T) and previous tick (T-1)
  const variableDiffs = useMemo(() => {
    if (currentTick === 0) {
      const vars = trace[0]?.variables || {};
      return Object.entries(vars).map(([key, val]) => ({
        key,
        status: 'added' as const,
        before: undefined,
        after: val
      }));
    }

    const prevVars = trace[currentTick - 1]?.variables || {};
    const currVars = trace[currentTick]?.variables || {};
    const diffList: { key: string; status: 'added' | 'changed' | 'unchanged'; before: any; after: any }[] = [];

    // Find variables updated or modified in this tick
    Object.entries(currVars).forEach(([key, val]) => {
      const prevVal = prevVars[key];
      if (prevVal === undefined) {
        diffList.push({ key, status: 'added', before: undefined, after: val });
      } else if (prevVal !== val) {
        diffList.push({ key, status: 'changed', before: prevVal, after: val });
      } else {
        diffList.push({ key, status: 'unchanged', before: prevVal, after: val });
      }
    });

    return diffList;
  }, [currentTick, trace]);

  // Format node type string
  const formatNodeType = (type: string) => {
    return type.toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-slate-950/95 border-l border-cyber-border/70 backdrop-blur-xl shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out font-sans select-none">
      
      {/* 1. Debugger Header */}
      <div className="p-5 border-b border-cyber-border/40 flex items-center justify-between bg-slate-900/30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-linear-to-tr from-pink-500 to-neon-purple flex items-center justify-center shadow-md shadow-pink-500/10">
            <Clock className="h-4.5 w-4.5 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wider text-white uppercase font-mono">Debugger Studio</h2>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">Time-Travel Replay & Breakpoint Engine</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Main Timeline Playback Controls */}
      <div className="p-4 border-b border-cyber-border/20 bg-slate-900/20 space-y-3.5">
        
        {/* Playback Buttons row */}
        <div className="flex items-center justify-between gap-2">
          
          {/* Play/Pause step group */}
          <div className="flex items-center bg-slate-950/80 border border-cyber-border/30 p-1.5 rounded-lg shadow-inner gap-1 shrink-0">
            <button
              onClick={handleJumpToStart}
              title="Jump to timeline start"
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-md transition-all cursor-pointer"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleStepBackward}
              disabled={currentTick === 0}
              title="Step backward one tick"
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-900 disabled:text-slate-700 disabled:hover:bg-transparent rounded-md transition-all cursor-pointer"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={handlePlayPause}
              title={isPlaying ? 'Pause replay' : 'Play replay simulation'}
              className={`p-2 rounded-md transition-all cursor-pointer ${
                isPlaying 
                  ? 'text-pink-400 bg-pink-500/10 hover:bg-pink-500/20' 
                  : 'text-neon-green bg-emerald-500/10 hover:bg-emerald-500/20'
              }`}
            >
              {isPlaying ? <Pause className="h-4.5 w-4.5 fill-pink-500/10" /> : <Play className="h-4.5 w-4.5 fill-emerald-500/10" />}
            </button>

            <button
              onClick={handleStepForward}
              disabled={currentTick >= trace.length - 1}
              title="Step forward one tick"
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-900 disabled:text-slate-700 disabled:hover:bg-transparent rounded-md transition-all cursor-pointer"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              onClick={handleJumpToEnd}
              title="Jump to timeline end"
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-md transition-all cursor-pointer"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>

          {/* Speed Selector Slider */}
          <div className="flex items-center gap-2 border border-cyber-border/20 px-3 py-1.5 rounded-lg bg-slate-950/30">
            <span className="text-[9px] font-mono text-slate-500">DELAY:</span>
            <span className="text-[10px] font-mono font-bold text-pink-400 w-12 text-right">{playbackSpeed}ms</span>
            <input 
              type="range"
              min="100"
              max="2000"
              step="50"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="w-16 h-1 accent-pink-500 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Active Tick Badge */}
          <div className="px-3 py-1.5 bg-pink-500/15 border border-pink-500/35 rounded-lg font-mono text-[10px] font-bold text-pink-400 shrink-0">
            TICK {currentTick} / {trace.length - 1}
          </div>
        </div>

        {/* Timeline Slider Track */}
        <div className="space-y-1">
          <div className="flex justify-between text-[8px] font-mono text-slate-500">
            <span>Tick 00 (Start)</span>
            <span className="text-pink-400 font-bold">
              {trace[currentTick]?.nodeLabel ? `Active: ${trace[currentTick]?.nodeLabel}` : 'Initial Config'}
            </span>
            <span>Tick {trace.length - 1} (End)</span>
          </div>

          <div className="relative flex items-center group h-6">
            <input 
              type="range"
              min="0"
              max={trace.length - 1}
              value={currentTick}
              onChange={(e) => {
                setBreakpointAlert(null);
                setCurrentTick(Number(e.target.value));
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                const approxTick = Math.max(0, Math.min(trace.length - 1, Math.round(pos * (trace.length - 1))));
                setHoveredTick(approxTick);
              }}
              onMouseLeave={() => setHoveredTick(null)}
              className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none accent-pink-500 cursor-pointer border border-slate-800"
            />

            {/* Breakpoint markers overlay on timeline track */}
            {breakpoints.map(bp => {
              if (!bp.isEnabled) return null;
              // Find all ticks matching this breakpoint node ID
              const matchingTicks = trace
                .map((t, idx) => t.nodeId === bp.nodeId ? idx : -1)
                .filter(idx => idx !== -1);

              return matchingTicks.map(tickIndex => {
                const percent = (tickIndex / (trace.length - 1 || 1)) * 100;
                return (
                  <div 
                    key={`${bp.id}-${tickIndex}`}
                    className="absolute h-3.5 w-1 bg-neon-red border border-red-500 rounded-full pointer-events-none"
                    style={{ left: `calc(${percent}% - 2px)` }}
                    title={`Breakpoint marker at step ${tickIndex}`}
                  />
                );
              });
            })}

            {/* Hover Tooltip displaying Node metadata */}
            {hoveredTick !== null && hoveredTick !== currentTick && (
              <div 
                className="absolute bottom-6 p-1.5 bg-slate-900 border border-cyber-border rounded text-[9px] font-mono text-slate-300 pointer-events-none z-30 shadow-xl whitespace-nowrap"
                style={{ left: `${(hoveredTick / (trace.length - 1 || 1)) * 90}%` }}
              >
                Tick {hoveredTick}: {trace[hoveredTick]?.nodeLabel || 'System'}
              </div>
            )}
          </div>
        </div>

        {/* Breakpoint triggers alert banners */}
        {breakpointAlert && (
          <div className="p-2.5 border border-red-500/20 bg-red-500/5 rounded-lg flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4.5 w-4.5 text-neon-red shrink-0" />
              <div className="text-[10px] font-mono text-neon-red leading-tight font-bold">
                {breakpointAlert}
              </div>
            </div>
            <button 
              onClick={() => setBreakpointAlert(null)}
              className="text-[9px] font-mono text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

      </div>

      {/* 3. Panel Main scroll container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* COLLAPSIBLE 1: BREAKPOINT MANAGER */}
        <div className="border border-cyber-border/20 rounded-xl overflow-hidden bg-slate-950/20">
          <div 
            onClick={() => setIsBreakpointsCollapsed(!isBreakpointsCollapsed)}
            className="p-3 border-b border-cyber-border/10 bg-slate-900/10 flex items-center justify-between cursor-pointer hover:bg-slate-900/20 transition-colors"
          >
            <span className="text-[10px] font-bold font-mono tracking-wider text-slate-300 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-pink-400" /> BREAKPOINT MANAGER ({breakpoints.length})
            </span>
            {isBreakpointsCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
          </div>

          {!isBreakpointsCollapsed && (
            <div className="p-3.5 space-y-3.5">
              {/* Form to add a new breakpoint */}
              <form onSubmit={handleAddBreakpoint} className="space-y-2.5 border-b border-cyber-border/10 pb-3.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono text-slate-500">BREAKPOINT TYPE</label>
                    <select
                      value={bpType}
                      onChange={(e) => setBpType(e.target.value as any)}
                      className="w-full text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded focus:outline-hidden focus:border-pink-500"
                    >
                      <option value="node">On Node Hit</option>
                      <option value="condition">Port Condition</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-mono text-slate-500">TARGET NODE</label>
                    <select
                      value={bpNodeId}
                      onChange={(e) => setBpNodeId(e.target.value)}
                      className="w-full text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded focus:outline-hidden focus:border-pink-500"
                    >
                      {nodes.map(n => (
                        <option key={n.id} value={n.id}>{n.label}</option>
                      ))}
                      {nodes.length === 0 && <option value="">No nodes available</option>}
                    </select>
                  </div>
                </div>

                {bpType === 'condition' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[8px] font-mono text-slate-500">PORT</label>
                      <select
                        value={bpPortId}
                        onChange={(e) => setBpPortId(e.target.value)}
                        className="w-full text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded focus:outline-hidden focus:border-pink-500"
                      >
                        {activeBpNode?.inputs.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (In)</option>
                        ))}
                        {activeBpNode?.outputs.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (Out)</option>
                        ))}
                        {(!activeBpNode || [...activeBpNode.inputs, ...activeBpNode.outputs].length === 0) && (
                          <option value="">No ports</option>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] font-mono text-slate-500">RELATION</label>
                      <select
                        value={bpOperator}
                        onChange={(e) => setBpOperator(e.target.value as any)}
                        className="w-full text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded focus:outline-hidden focus:border-pink-500"
                      >
                        <option value="==">equals (==)</option>
                        <option value="!=">not equals (!=)</option>
                        <option value=">">greater than (&gt;)</option>
                        <option value="<">less than (&lt;)</option>
                        <option value="contains">contains</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] font-mono text-slate-500">EXPECTED VALUE</label>
                      <input
                        type="text"
                        placeholder="val"
                        value={bpValue}
                        onChange={(e) => setBpValue(e.target.value)}
                        className="w-full text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-200 px-2 py-1 rounded focus:outline-hidden focus:border-pink-500"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={nodes.length === 0}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-mono font-bold text-white bg-linear-to-r from-pink-600 to-neon-purple rounded-md hover:from-pink-500 hover:to-purple-500 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Breakpoint Rule
                </button>
              </form>

              {/* Breakpoint rules listing */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {breakpoints.length === 0 ? (
                  <div className="text-center text-[9px] font-mono text-slate-600 py-3">No active breakpoints. Set rule inputs above to capture state.</div>
                ) : (
                  breakpoints.map(bp => {
                    const nodeName = nodes.find(n => n.id === bp.nodeId)?.label || bp.nodeId;
                    return (
                      <div key={bp.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 border border-cyber-border/10 text-[9px] font-mono">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleBreakpoint(bp.id)}
                            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {bp.isEnabled ? (
                              <span className="h-2 w-2 rounded-full bg-neon-red inline-block animate-pulse"></span>
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-slate-700 inline-block"></span>
                            )}
                          </button>
                          <span className={`font-bold ${bp.isEnabled ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                            {bp.type === 'node' ? (
                              <span>Pause at Node &quot;{nodeName}&quot;</span>
                            ) : (
                              <span>Pause when &quot;{nodeName}&quot;.{bp.portId} {bp.operator} &quot;{bp.value}&quot;</span>
                            )}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteBreakpoint(bp.id)}
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* COLLAPSIBLE 2: STATE INJECTION OVERRIDES */}
        <div className="border border-cyber-border/20 rounded-xl overflow-hidden bg-slate-950/20">
          <div 
            onClick={() => setIsOverridesCollapsed(!isOverridesCollapsed)}
            className="p-3 border-b border-cyber-border/10 bg-slate-900/10 flex items-center justify-between cursor-pointer hover:bg-slate-900/20 transition-colors"
          >
            <span className="text-[10px] font-bold font-mono tracking-wider text-slate-300 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-pink-400" /> STATE OVERRIDES & INJECTIONS ({overrides.length})
            </span>
            {isOverridesCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
          </div>

          {!isOverridesCollapsed && (
            <div className="p-3.5 space-y-3.5">
              {/* Form to inject a custom variable value */}
              <form onSubmit={handleAddOverride} className="space-y-2.5 border-b border-cyber-border/10 pb-3.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono text-slate-500">TARGET PORT</label>
                    <select
                      value={ovPortKey}
                      onChange={(e) => setOvPortKey(e.target.value)}
                      className="w-full text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded focus:outline-hidden focus:border-pink-500"
                    >
                      {availablePortsList.map(item => (
                        <option key={item.key} value={item.key}>{item.label}</option>
                      ))}
                      {availablePortsList.length === 0 && <option value="">No ports available</option>}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-mono text-slate-500">OVERRIDE VALUE</label>
                    <input
                      type="text"
                      placeholder="e.g. 42 or Fizz"
                      value={ovValue}
                      onChange={(e) => setOvValue(e.target.value)}
                      className="w-full text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-200 px-2 py-1 rounded focus:outline-hidden focus:border-pink-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={availablePortsList.length === 0}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-mono font-bold text-white bg-linear-to-r from-pink-600 to-neon-purple rounded-md hover:from-pink-500 hover:to-purple-500 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Plus className="h-3.5 w-3.5" /> Inject Custom Override Value
                </button>
              </form>

              {/* Overrides list */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {overrides.length === 0 ? (
                  <div className="text-center text-[9px] font-mono text-slate-600 py-3">No custom value injections active. Variables evaluate automatically.</div>
                ) : (
                  <div className="space-y-1.5">
                    {overrides.map(ov => {
                      // Lookup port label
                      const label = availablePortsList.find(p => p.key === ov.portKey)?.label || ov.portKey;
                      return (
                        <div key={ov.id} className="flex items-center justify-between p-2 rounded-lg bg-pink-500/5 border border-pink-500/20 text-[9px] font-mono">
                          <span className="text-pink-300 font-bold">
                            Override {label} = <span className="text-slate-100 font-mono bg-slate-950 px-1.5 py-0.5 rounded">{JSON.stringify(ov.value)}</span>
                          </span>
                          <button
                            onClick={() => handleDeleteOverride(ov.id)}
                            className="p-1 text-slate-500 hover:text-pink-400 hover:bg-slate-900 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    <button
                      onClick={handleClearAllOverrides}
                      className="w-full py-1 border border-pink-500/20 bg-pink-500/5 text-[9px] font-mono text-pink-400 rounded hover:bg-pink-500/10 transition-colors cursor-pointer mt-2"
                    >
                      Clear All Injected Values
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PORT VARIABLE STATE INSPECTOR & DIFF VIEWER */}
        <div className="space-y-2">
          <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">Variable State Inspector & Diff (Tick T vs T-1)</span>
          <div className="border border-cyber-border/20 rounded-xl overflow-hidden bg-slate-950/40">
            <table className="w-full text-left border-collapse text-[9px] font-mono">
              <thead>
                <tr className="bg-slate-900/80 border-b border-cyber-border/20 text-slate-400">
                  <th className="p-2">Variable / Port Key</th>
                  <th className="p-2">T-1 Value</th>
                  <th className="p-2">Current Value</th>
                  <th className="p-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {variableDiffs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-600">No variables declared yet in timeline. Initialize values.</td>
                  </tr>
                ) : (
                  variableDiffs.map(diff => {
                    const portName = availablePortsList.find(p => p.key === diff.key)?.label || diff.key;
                    
                    let rowBg = '';
                    let statusLabel = 'Unchanged';
                    let statusColor = 'text-slate-500';

                    if (diff.status === 'added') {
                      rowBg = 'bg-emerald-500/5';
                      statusLabel = 'LOADED';
                      statusColor = 'text-neon-green font-bold';
                    } else if (diff.status === 'changed') {
                      rowBg = 'bg-amber-500/5';
                      statusLabel = 'MUTATED';
                      statusColor = 'text-neon-yellow font-bold';
                    }

                    return (
                      <tr key={diff.key} className={`border-b border-cyber-border/10 hover:bg-slate-900/20 transition-colors ${rowBg}`}>
                        <td className="p-2 font-bold text-slate-300 max-w-[160px] truncate" title={portName}>
                          {portName}
                        </td>
                        <td className="p-2 text-slate-500">
                          {diff.before === undefined ? '—' : JSON.stringify(diff.before)}
                        </td>
                        <td className="p-2 font-bold text-slate-200">
                          {JSON.stringify(diff.after)}
                        </td>
                        <td className={`p-2 text-right ${statusColor}`}>
                          {statusLabel}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* COLLAPSIBLE 3: CALL STACK FLOW */}
        <div className="border border-cyber-border/20 rounded-xl overflow-hidden bg-slate-950/20">
          <div 
            onClick={() => setIsCallStackCollapsed(!isCallStackCollapsed)}
            className="p-3 border-b border-cyber-border/10 bg-slate-900/10 flex items-center justify-between cursor-pointer hover:bg-slate-900/20 transition-colors"
          >
            <span className="text-[10px] font-bold font-mono tracking-wider text-slate-300 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-pink-400" /> CALL STACK & EXECUTION SEQUENCE
            </span>
            {isCallStackCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
          </div>

          {!isCallStackCollapsed && (
            <div className="p-3.5 space-y-3">
              {trace.filter(t => t.nodeId !== null).length === 0 ? (
                <div className="text-center text-[9px] font-mono text-slate-600 py-2">Call stack empty. Trace execution.</div>
              ) : (
                <div className="relative border border-cyber-border/10 rounded-lg p-3 bg-slate-950/40">
                  <div className="absolute top-4 bottom-4 left-[21px] w-0.5 bg-slate-900"></div>

                  <div className="space-y-3.5 relative">
                    {trace
                      .filter(t => t.nodeId !== null)
                      .map((t, idx) => {
                        const isExecuted = currentTick >= t.tick;
                        const isActive = currentTick === t.tick;

                        let bulletColor = 'bg-slate-950 border-slate-800 text-slate-600';
                        let textColor = 'text-slate-500';

                        if (isActive) {
                          bulletColor = 'bg-pink-500/10 border-pink-500 text-pink-400 ring-4 ring-pink-500/20 animate-pulse';
                          textColor = 'text-pink-300 font-bold';
                        } else if (isExecuted) {
                          bulletColor = 'bg-emerald-500/10 border-neon-green text-neon-green';
                          textColor = 'text-slate-300';
                        }

                        return (
                          <div 
                            key={t.nodeId} 
                            onClick={() => setCurrentTick(t.tick)}
                            className="flex items-start gap-4 text-[9px] font-mono cursor-pointer group hover:bg-slate-900/10 py-1 px-1.5 rounded transition-all"
                          >
                            <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center shrink-0 font-bold text-[8px] z-10 transition-all ${bulletColor}`}>
                              {idx + 1}
                            </div>
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex justify-between items-center">
                                <span className={`${textColor} truncate font-bold text-xs`}>{t.nodeLabel}</span>
                                <span className="text-slate-500 uppercase text-[8px]">{formatNodeType(t.nodeType)}</span>
                              </div>
                              <p className="text-slate-400 truncate leading-relaxed group-hover:text-slate-200">
                                {t.message}
                              </p>
                              <div className="text-[8px] text-slate-600">
                                Latency offset: {t.latencyOffset}ms
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SIMULATION LIVE LOGGER FEED */}
        <div className="space-y-2">
          <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-slate-600" /> SIMULATION SHELL FEED
          </span>
          <div className="h-44 overflow-y-auto space-y-1.5 border border-cyber-border/15 rounded-lg p-3 bg-slate-950 font-mono text-[9px] leading-relaxed">
            {trace[currentTick]?.logs.length === 0 ? (
              <div className="text-slate-600 text-center py-4">No output flushed. Replay nodes.</div>
            ) : (
              trace[currentTick]?.logs.map((log, idx) => {
                let badgeColor = 'text-slate-500';
                if (log.type === 'success') badgeColor = 'text-neon-green font-bold';
                else if (log.type === 'error') badgeColor = 'text-neon-red font-bold';
                else if (log.type === 'warning') badgeColor = 'text-neon-yellow font-bold';

                // Highlight log generated at the exact current tick
                const isCurrentTickLog = log.nodeId === trace[currentTick]?.nodeId && log.nodeId !== 'system';

                return (
                  <div 
                    key={idx} 
                    className={`p-1.5 rounded transition-all flex items-start gap-2.5 ${
                      isCurrentTickLog ? 'bg-pink-500/5 border border-pink-500/15 shadow-[0_0_10px_rgba(236,72,153,0.05)]' : ''
                    }`}
                  >
                    <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                    <div className="flex-1 min-w-0">
                      <span className={`${badgeColor} mr-1.5 font-bold uppercase`}>[{log.type}]</span>
                      <span className="text-slate-200 break-words">{log.message}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 4. Bottom sync stats panel */}
      <div className="p-3 border-t border-cyber-border/30 bg-slate-900/30 flex justify-between items-center text-[9px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-pink-400" />
          <span>DAG status: Clean compilation</span>
        </div>
        <div>
          <span>Total latency: {trace[trace.length - 1]?.latencyOffset || 0} ms</span>
        </div>
      </div>

    </div>
  );
};
