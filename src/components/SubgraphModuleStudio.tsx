import React, { useState, useEffect } from 'react';
import { useGraph } from '../context/GraphContext';
import type { Node, Connection, Port, SubgraphTemplate } from '../types/graph';
import { 
  X, 
  Plus, 
  Trash2, 
  Play, 
  Box, 
  CheckCircle, 
  AlertCircle,
  Network
} from 'lucide-react';

interface SubgraphModuleStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEME_OPTIONS = [
  {
    name: 'Neon Fuchsia',
    color: 'from-fuchsia-500/20 to-fuchsia-500/5 hover:border-fuchsia-500/50 text-fuchsia-400',
    borderColor: 'border-fuchsia-500/30',
    badgeColor: 'bg-fuchsia-500/20 text-fuchsia-300'
  },
  {
    name: 'Neon Purple',
    color: 'from-purple-500/20 to-purple-500/5 hover:border-purple-500/50 text-purple-400',
    borderColor: 'border-purple-500/30',
    badgeColor: 'bg-purple-500/20 text-purple-300'
  },
  {
    name: 'Neon Cyan',
    color: 'from-cyan-500/20 to-cyan-500/5 hover:border-cyan-500/50 text-cyan-400',
    borderColor: 'border-cyan-500/30',
    badgeColor: 'bg-cyan-500/20 text-cyan-300'
  },
  {
    name: 'Neon Emerald',
    color: 'from-emerald-500/20 to-emerald-500/5 hover:border-emerald-500/50 text-emerald-400',
    borderColor: 'border-emerald-500/30',
    badgeColor: 'bg-emerald-500/20 text-emerald-300'
  }
];

export const SubgraphModuleStudio: React.FC<SubgraphModuleStudioProps> = ({ isOpen, onClose }) => {
  const { createSubgraphTemplate } = useGraph();

  // Template Form State
  const [label, setLabel] = useState('Clamped Scale Macro');
  const [description, setDescription] = useState('Scales numerical input and clamps output bounds.');
  const [inputs, setInputs] = useState<Port[]>([
    { id: 'in_val', name: 'Value', type: 'number' },
    { id: 'in_factor', name: 'Factor', type: 'number' }
  ]);
  const [outputs, setOutputs] = useState<Port[]>([
    { id: 'out_result', name: 'Scaled Val', type: 'number' }
  ]);
  const [selectedThemeIdx, setSelectedThemeIdx] = useState(0);

  // Internal Subgraph Nodes & Connections State
  const [subNodes, setSubNodes] = useState<Node[]>([
    { id: 'sub-in1', type: 'input', label: 'Input A', x: 50, y: 60, inputs: [], outputs: [{ id: 'out', name: 'Val', type: 'number' }], data: { value: 12 } },
    { id: 'sub-in2', type: 'input', label: 'Input B', x: 50, y: 180, inputs: [], outputs: [{ id: 'out', name: 'Val', type: 'number' }], data: { value: 3 } },
    { id: 'sub-op1', type: 'operator', label: 'A * B', x: 260, y: 120, inputs: [{ id: 'a', name: 'Val A', type: 'number' }, { id: 'b', name: 'Val B', type: 'number' }], outputs: [{ id: 'res', name: 'Result', type: 'number' }], data: { operator: '*' } }
  ]);

  const [subConnections, setSubConnections] = useState<Connection[]>([
    { id: 'sc-1', fromNodeId: 'sub-in1', fromPortId: 'out', toNodeId: 'sub-op1', toPortId: 'a' },
    { id: 'sc-2', fromNodeId: 'sub-in2', fromPortId: 'out', toNodeId: 'sub-op1', toPortId: 'b' }
  ]);

  // Sandbox Test Runner State
  const [testInputs, setTestInputs] = useState<Record<string, string>>({ in_val: '12', in_factor: '3' });
  const [testOutputs, setTestOutputs] = useState<Record<string, any>>({});
  const [testSuccess, setTestSuccess] = useState<boolean>(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Sync test inputs keys when input ports list changes
  useEffect(() => {
    const nextInputs: Record<string, string> = {};
    inputs.forEach(port => {
      nextInputs[port.id] = testInputs[port.id] !== undefined ? testInputs[port.id] : '10';
    });
    setTestInputs(nextInputs);
  }, [inputs]);

  // Port manipulation handlers
  const handleAddPort = (direction: 'in' | 'out') => {
    const defaultId = `port_${Math.random().toString(36).substring(2, 6)}`;
    const newPort: Port = { id: defaultId, name: `Port ${defaultId.toUpperCase()}`, type: 'number' };
    
    if (direction === 'in') {
      setInputs(prev => [...prev, newPort]);
    } else {
      setOutputs(prev => [...prev, newPort]);
    }
  };

  const handleRemovePort = (direction: 'in' | 'out', idx: number) => {
    if (direction === 'in') {
      setInputs(prev => prev.filter((_, i) => i !== idx));
    } else {
      setOutputs(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleUpdatePort = (direction: 'in' | 'out', idx: number, fields: Partial<Port>) => {
    const updater = (prev: Port[]) => prev.map((p, i) => i === idx ? { ...p, ...fields } : p);
    if (direction === 'in') {
      setInputs(updater);
    } else {
      setOutputs(updater);
    }
  };

  // Quick internal sub-node spawner
  const handleSpawnSubNode = (type: 'input' | 'operator' | 'conditional') => {
    const id = `sub-${type}-${Math.random().toString(36).substring(2, 6)}`;
    let label = 'Sub Node';
    let inPorts: Port[] = [];
    let outPorts: Port[] = [{ id: 'out', name: 'Val', type: 'number' }];
    let data: Node['data'] = {};

    if (type === 'input') {
      label = 'Sub Input';
      data = { value: 5 };
    } else if (type === 'operator') {
      label = 'Sub Op';
      inPorts = [{ id: 'a', name: 'A', type: 'number' }, { id: 'b', name: 'B', type: 'number' }];
      outPorts = [{ id: 'res', name: 'Result', type: 'number' }];
      data = { operator: '+' };
    } else if (type === 'conditional') {
      label = 'Sub Router';
      inPorts = [{ id: 'condition', name: 'Cond', type: 'boolean' }, { id: 'if_true', name: 'True', type: 'any' }, { id: 'if_false', name: 'False', type: 'any' }];
      outPorts = [{ id: 'result', name: 'Result', type: 'any' }];
    }

    const newNode: Node = {
      id,
      type,
      label,
      x: 100 + (subNodes.length % 3) * 40,
      y: 80 + (subNodes.length % 3) * 40,
      inputs: inPorts,
      outputs: outPorts,
      data
    };

    setSubNodes(prev => [...prev, newNode]);
  };

  const handleDeleteSubNode = (id: string) => {
    setSubNodes(prev => prev.filter(n => n.id !== id));
    setSubConnections(prev => prev.filter(c => c.fromNodeId !== id && c.toNodeId !== id));
  };

  // Run Subgraph Simulation Test Pass
  const handleRunSubTest = () => {
    setTestError(null);
    setTestSuccess(false);

    try {
      const logs: string[] = [];
      logs.push(`[${new Date().toLocaleTimeString()}] Validating subgraph DAG topology...`);

      if (subNodes.length === 0) {
        throw new Error('Subgraph must contain at least 1 internal node.');
      }

      // Step-by-step evaluation over internal nodes
      const currentVars: Record<string, any> = {};

      // Map test inputs to internal input nodes
      inputs.forEach((p, idx) => {
        const valStr = testInputs[p.id] || '0';
        const numVal = isNaN(Number(valStr)) ? valStr : Number(valStr);
        if (subNodes[idx]) {
          const outPort = subNodes[idx].outputs[0]?.id || 'out';
          currentVars[`${subNodes[idx].id}-${outPort}`] = numVal;
          logs.push(`[Input Port "${p.name}"] Loaded value: ${JSON.stringify(numVal)}`);
        }
      });

      // Internal nodes evaluation
      subNodes.forEach(node => {
        const getVal = (portId: string, fallback: any = 0) => {
          const conn = subConnections.find(c => c.toNodeId === node.id && c.toPortId === portId);
          if (conn) {
            const val = currentVars[`${conn.fromNodeId}-${conn.fromPortId}`];
            return val !== undefined ? val : fallback;
          }
          return fallback;
        };

        if (node.type === 'input') {
          const outPort = node.outputs[0]?.id;
          if (outPort && currentVars[`${node.id}-${outPort}`] === undefined) {
            currentVars[`${node.id}-${outPort}`] = node.data.value !== undefined ? node.data.value : 0;
          }
        } else if (node.type === 'operator') {
          const a = getVal('a', 0);
          const b = getVal('b', 0);
          const op = node.data.operator || '+';
          let res: any = 0;
          switch (op) {
            case '+': res = Number(a) + Number(b); break;
            case '-': res = Number(a) - Number(b); break;
            case '*': res = Number(a) * Number(b); break;
            case '/': res = Number(b) !== 0 ? Number(a) / Number(b) : 0; break;
            default: res = Number(a) + Number(b);
          }
          const outPort = node.outputs[0]?.id;
          if (outPort) currentVars[`${node.id}-${outPort}`] = res;
          logs.push(`[Op "${node.label}"] ${a} ${op} ${b} = ${res}`);
        }
      });

      // Map output results
      const resOutputs: Record<string, any> = {};
      outputs.forEach((p, idx) => {
        const lastNode = subNodes[subNodes.length - 1 - idx] || subNodes[subNodes.length - 1];
        if (lastNode) {
          const outPort = lastNode.outputs[0]?.id || 'res';
          const outVal = currentVars[`${lastNode.id}-${outPort}`];
          resOutputs[p.id] = outVal !== undefined ? outVal : 0;
        }
      });

      setTestOutputs(resOutputs);
      setTestSuccess(true);
    } catch (err: any) {
      setTestError(err.message || String(err));
    }
  };

  // Submit and create Subgraph Template
  const handleSaveSubgraph = () => {
    if (!label.trim()) return;

    const theme = THEME_OPTIONS[selectedThemeIdx];
    const newTemplate: Omit<SubgraphTemplate, 'id'> = {
      label,
      description,
      nodes: subNodes,
      connections: subConnections,
      inputs: inputs.map(p => ({ ...p, id: p.id.trim() })),
      outputs: outputs.map(p => ({ ...p, id: p.id.trim() })),
      color: theme.color,
      borderColor: theme.borderColor,
      badgeColor: theme.badgeColor,
      iconName: 'Network'
    };

    createSubgraphTemplate(newTemplate);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-[920px] max-w-full h-[650px] max-h-[92vh] glass-panel border border-fuchsia-500/40 rounded-xl shadow-2xl flex flex-col overflow-hidden bg-slate-950/95">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-cyber-border/40 bg-slate-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded bg-linear-to-tr from-fuchsia-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
              <Network className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider text-slate-100 uppercase font-mono">Subgraph Composability Studio</h2>
              <p className="text-[10px] text-slate-400 font-mono">Design reusable modular Sub-Flow macros and logic components</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Body grid */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          
          {/* Left panel: Subgraph configurations */}
          <div className="w-1/2 border-r border-cyber-border/20 p-5 overflow-y-auto space-y-4">
            
            {/* General Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">SUBGRAPH LABEL</label>
                <input 
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-hidden focus:border-fuchsia-500 text-slate-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">DESCRIPTION</label>
                <input 
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-hidden focus:border-fuchsia-500 text-slate-200"
                />
              </div>
            </div>

            {/* Subgraph Input/Output Interface Ports */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              
              {/* Inputs */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Input Interface Ports</span>
                  <button 
                    onClick={() => handleAddPort('in')}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-neon-cyan flex items-center cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {inputs.map((port, idx) => (
                    <div key={idx} className="flex gap-1 items-center bg-slate-900/60 p-1 border border-slate-800/40 rounded">
                      <input 
                        type="text"
                        value={port.id}
                        placeholder="id"
                        onChange={(e) => handleUpdatePort('in', idx, { id: e.target.value })}
                        className="w-16 text-[9px] font-mono bg-slate-950 border border-slate-800 px-1 py-0.5 rounded text-slate-300 focus:outline-hidden"
                      />
                      <input 
                        type="text"
                        value={port.name}
                        placeholder="name"
                        onChange={(e) => handleUpdatePort('in', idx, { name: e.target.value })}
                        className="w-20 text-[9px] font-mono bg-slate-950 border border-slate-800 px-1 py-0.5 rounded text-slate-300 focus:outline-hidden"
                      />
                      <button 
                        onClick={() => handleRemovePort('in', idx)}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outputs */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Output Interface Ports</span>
                  <button 
                    onClick={() => handleAddPort('out')}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-fuchsia-400 flex items-center cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {outputs.map((port, idx) => (
                    <div key={idx} className="flex gap-1 items-center bg-slate-900/60 p-1 border border-slate-800/40 rounded">
                      <input 
                        type="text"
                        value={port.id}
                        placeholder="id"
                        onChange={(e) => handleUpdatePort('out', idx, { id: e.target.value })}
                        className="w-16 text-[9px] font-mono bg-slate-950 border border-slate-800 px-1 py-0.5 rounded text-slate-300 focus:outline-hidden"
                      />
                      <input 
                        type="text"
                        value={port.name}
                        placeholder="name"
                        onChange={(e) => handleUpdatePort('out', idx, { name: e.target.value })}
                        className="w-20 text-[9px] font-mono bg-slate-950 border border-slate-800 px-1 py-0.5 rounded text-slate-300 focus:outline-hidden"
                      />
                      <button 
                        onClick={() => handleRemovePort('out', idx)}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Styling choices */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Neon Palette Accent</span>
              <div className="grid grid-cols-2 gap-2">
                {THEME_OPTIONS.map((theme, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedThemeIdx(idx)}
                    className={`text-[10px] font-mono font-bold py-1.5 px-2.5 rounded border text-left cursor-pointer transition-colors ${
                      selectedThemeIdx === idx
                        ? 'bg-slate-900 border-fuchsia-500 text-slate-200'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right panel: Sub-flow DAG builder canvas & local test runner */}
          <div className="w-1/2 flex flex-col min-h-0 bg-slate-950/40">
            
            {/* Sub-canvas title bar */}
            <div className="px-4 py-2 border-b border-cyber-border/10 bg-slate-900/60 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-mono text-slate-300 font-bold">INTERNAL SUB-FLOW GRAPH ({subNodes.length} NODES)</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleSpawnSubNode('input')}
                  className="px-2 py-0.5 text-[9px] font-mono bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700 cursor-pointer"
                >
                  + IN
                </button>
                <button
                  onClick={() => handleSpawnSubNode('operator')}
                  className="px-2 py-0.5 text-[9px] font-mono bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700 cursor-pointer"
                >
                  + OP
                </button>
                <button
                  onClick={() => handleSpawnSubNode('conditional')}
                  className="px-2 py-0.5 text-[9px] font-mono bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-slate-700 cursor-pointer"
                >
                  + COND
                </button>
              </div>
            </div>

            {/* Sub-canvas nodes preview */}
            <div className="flex-1 p-3 overflow-y-auto bg-slate-950 space-y-2 border-b border-cyber-border/20">
              {subNodes.map(node => (
                <div key={node.id} className="p-2.5 rounded-lg border border-fuchsia-500/20 bg-slate-900/40 flex items-center justify-between text-xs font-mono text-slate-300">
                  <div className="flex items-center gap-2">
                    <Box className="h-3.5 w-3.5 text-fuchsia-400 shrink-0" />
                    <span className="font-bold">{node.label}</span>
                    <span className="text-[9px] text-slate-500 uppercase">({node.type})</span>
                  </div>
                  <button
                    onClick={() => handleDeleteSubNode(node.id)}
                    className="p-1 text-slate-600 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Sandbox execution tester */}
            <div className="h-[210px] flex flex-col shrink-0 bg-slate-950 p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">SUB-FLOW SANDBOX TEST</span>
                <button 
                  onClick={handleRunSubTest}
                  className="px-2.5 py-1 text-[9px] font-mono font-bold bg-linear-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white rounded flex items-center gap-1 cursor-pointer"
                >
                  <Play className="h-2.5 w-2.5 fill-white" /> TEST SUB-FLOW
                </button>
              </div>

              <div className="flex-1 flex gap-3 text-[9.5px] font-mono overflow-y-auto">
                <div className="w-1/2 space-y-1 overflow-y-auto">
                  {inputs.map(p => (
                    <div key={p.id} className="flex justify-between items-center gap-1">
                      <span className="text-slate-400 truncate">{p.name}:</span>
                      <input 
                        type="text"
                        value={testInputs[p.id] || ''}
                        onChange={(e) => setTestInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                        className="w-16 text-[9px] font-mono bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-slate-200"
                      />
                    </div>
                  ))}
                </div>

                <div className="w-1/2 space-y-1 border-l border-slate-900 pl-2.5 overflow-y-auto">
                  {testSuccess && (
                    <div className="text-neon-green font-bold flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Outputs Emitted:
                    </div>
                  )}
                  {testError && (
                    <div className="text-neon-red font-bold flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {testError}
                    </div>
                  )}
                  {Object.entries(testOutputs).map(([k, v]) => (
                    <div key={k} className="text-slate-300">
                      {k} ➜ <span className="text-neon-cyan font-bold">{JSON.stringify(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-cyber-border/40 bg-slate-900/40 flex items-center justify-between shrink-0">
          <p className="text-[9px] font-mono text-slate-500">
            Registered Subgraph Macros are compiled as nested AST function declarations.
          </p>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-mono border border-slate-800 hover:border-slate-700 bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              DISCARD
            </button>
            <button 
              onClick={handleSaveSubgraph}
              disabled={!label.trim()}
              className="px-4 py-1.5 text-xs font-mono font-bold bg-linear-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white rounded-lg cursor-pointer disabled:opacity-50"
            >
              SAVE SUBGRAPH MACRO
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
