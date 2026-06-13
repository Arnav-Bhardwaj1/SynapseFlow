import React, { useState, useEffect } from 'react';
import { useGraph } from '../context/GraphContext';
import type { Port, CustomNodeTemplate } from '../types/graph';
import { 
  X, 
  Plus, 
  Trash2, 
  Sparkles, 
  Play, 
  AlertCircle, 
  CheckCircle,
  Zap, 
  Cpu, 
  Settings, 
  Activity, 
  Terminal, 
  Layers
} from 'lucide-react';

interface CustomNodeBuilderProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEME_OPTIONS = [
  {
    name: 'Neon Emerald',
    color: 'from-emerald-500/20 to-emerald-500/5 hover:border-emerald-500/50 text-emerald-400',
    borderColor: 'border-emerald-500/30',
    badgeColor: 'bg-emerald-500/20 text-emerald-300'
  },
  {
    name: 'Neon Violet',
    color: 'from-violet-500/20 to-violet-500/5 hover:border-violet-500/50 text-violet-400',
    borderColor: 'border-violet-500/30',
    badgeColor: 'bg-violet-500/20 text-violet-300'
  },
  {
    name: 'Neon Pink',
    color: 'from-pink-500/20 to-pink-500/5 hover:border-pink-500/50 text-pink-400',
    borderColor: 'border-pink-500/30',
    badgeColor: 'bg-pink-500/20 text-pink-300'
  },
  {
    name: 'Neon Cyan',
    color: 'from-cyan-500/20 to-cyan-500/5 hover:border-cyan-500/50 text-cyan-400',
    borderColor: 'border-cyan-500/30',
    badgeColor: 'bg-cyan-500/20 text-cyan-300'
  },
  {
    name: 'Neon Amber',
    color: 'from-amber-500/20 to-amber-500/5 hover:border-amber-500/50 text-amber-400',
    borderColor: 'border-amber-500/30',
    badgeColor: 'bg-amber-500/20 text-amber-300'
  },
  {
    name: 'Neon Indigo',
    color: 'from-indigo-500/20 to-indigo-500/5 hover:border-indigo-500/50 text-indigo-400',
    borderColor: 'border-indigo-500/30',
    badgeColor: 'bg-indigo-500/20 text-indigo-300'
  }
];

const ICON_OPTIONS = [
  { name: 'Sparkles', icon: <Sparkles className="h-4 w-4" /> },
  { name: 'Zap', icon: <Zap className="h-4 w-4" /> },
  { name: 'Cpu', icon: <Cpu className="h-4 w-4" /> },
  { name: 'Settings', icon: <Settings className="h-4 w-4" /> },
  { name: 'Activity', icon: <Activity className="h-4 w-4" /> },
  { name: 'Terminal', icon: <Terminal className="h-4 w-4" /> }
];

const INITIAL_CODE = `// inputs contains values mapped by port ID, e.g. inputs.a\n// outputs.set('portName', value) to trigger connections.\n// Example:\nconst result = Number(inputs.val1 || 0) * 2;\noutputs.set('out1', result);\n`;

export const CustomNodeBuilder: React.FC<CustomNodeBuilderProps> = ({ isOpen, onClose }) => {
  const { createCustomTemplate } = useGraph();

  // Template Form state
  const [label, setLabel] = useState('My Custom Block');
  const [description, setDescription] = useState('Executes a custom JavaScript script.');
  const [code, setCode] = useState(INITIAL_CODE);
  const [inputs, setInputs] = useState<Port[]>([{ id: 'val1', name: 'Val A', type: 'number' }]);
  const [outputs, setOutputs] = useState<Port[]>([{ id: 'out1', name: 'Result', type: 'number' }]);
  const [selectedThemeIdx, setSelectedThemeIdx] = useState(0);
  const [selectedIconName, setSelectedIconName] = useState('Sparkles');

  // Test Runner Console States
  const [testInputs, setTestInputs] = useState<Record<string, string>>({ val1: '15' });
  const [testOutputs, setTestOutputs] = useState<Record<string, any>>({});
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<boolean>(false);

  // Sync testInputs state keys when input ports list changes
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

  // Safe compiler validation & local runner simulation
  const handleRunTest = () => {
    setConsoleLogs([]);
    setRunError(null);
    setTestSuccess(false);

    const inputsObj: Record<string, any> = {};
    inputs.forEach(p => {
      let rawVal = testInputs[p.id] || '';
      // Cast input values for convenience
      if (p.type === 'number') inputsObj[p.id] = Number(rawVal);
      else if (p.type === 'boolean') inputsObj[p.id] = rawVal.toLowerCase() === 'true';
      else inputsObj[p.id] = rawVal;
    });

    const logsBuffer: string[] = [];
    const outputsMap = new Map<string, any>();
    
    const mockOutputs = {
      set: (portId: string, val: any) => {
        outputsMap.set(portId, val);
      }
    };

    try {
      logsBuffer.push(`[${new Date().toLocaleTimeString()}] Compile script block...`);
      // Inject user script
      const testFunc = new Function('inputs', 'outputs', code);
      
      logsBuffer.push(`[${new Date().toLocaleTimeString()}] Run step evaluator...`);
      testFunc(inputsObj, mockOutputs);

      logsBuffer.push(`[${new Date().toLocaleTimeString()}] Step finished with success.`);
      setConsoleLogs(logsBuffer);
      setTestOutputs(Object.fromEntries(outputsMap));
      setTestSuccess(true);
    } catch (err: any) {
      const errMsg = err.message || String(err);
      setRunError(errMsg);
      setConsoleLogs(prev => [...prev, `[ERROR] ${errMsg}`]);
    }
  };

  // Submit and create custom template
  const handleCreateNode = () => {
    if (!label.trim()) return;

    const theme = THEME_OPTIONS[selectedThemeIdx];
    const newTemplate: Omit<CustomNodeTemplate, 'id'> = {
      label,
      description,
      code,
      inputs: inputs.map(p => ({ ...p, id: p.id.trim() })),
      outputs: outputs.map(p => ({ ...p, id: p.id.trim() })),
      color: theme.color,
      borderColor: theme.borderColor,
      badgeColor: theme.badgeColor,
      iconName: selectedIconName
    };

    createCustomTemplate(newTemplate);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-[880px] max-w-full h-[620px] max-h-[90vh] glass-panel border border-cyber-border rounded-xl shadow-2xl flex flex-col overflow-hidden bg-slate-950/95">
        
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-cyber-border/40 bg-slate-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-linear-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider text-slate-100 uppercase font-mono">Custom Node Scripting Lab</h2>
              <p className="text-[10px] text-slate-400 font-mono">Create bespoke programming blocks with JS scripts</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          
          {/* Left panel: configurations */}
          <div className="w-1/2 border-r border-cyber-border/20 p-5 overflow-y-auto space-y-4">
            
            {/* General Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">NODE LABEL</label>
                <input 
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-900 border border-slate-800 rounded px-2 py-1.5 focus:outline-hidden focus:border-neon-purple text-slate-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">DESCRIPTION</label>
                <input 
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-900 border border-slate-800 rounded px-2 py-1.5 focus:outline-hidden focus:border-neon-purple text-slate-200"
                />
              </div>
            </div>

            {/* Ports Configurator */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              
              {/* Inputs configurator */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Input Ports</span>
                  <button 
                    onClick={() => handleAddPort('in')}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-neon-cyan transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {inputs.length === 0 ? (
                    <p className="text-[9px] font-mono text-slate-600">No input ports defined.</p>
                  ) : (
                    inputs.map((port, idx) => (
                      <div key={idx} className="flex gap-1 items-center bg-slate-900/60 p-1 border border-slate-800/40 rounded">
                        <input 
                          type="text"
                          value={port.id}
                          placeholder="id"
                          title="Port identifier (used in script inputs.id)"
                          onChange={(e) => handleUpdatePort('in', idx, { id: e.target.value })}
                          className="w-16 text-[9px] font-mono bg-slate-950 border border-slate-800 px-1 py-0.5 rounded text-slate-300 focus:outline-hidden"
                        />
                        <input 
                          type="text"
                          value={port.name}
                          placeholder="label"
                          title="Port user-facing label text"
                          onChange={(e) => handleUpdatePort('in', idx, { name: e.target.value })}
                          className="w-20 text-[9px] font-mono bg-slate-950 border border-slate-800 px-1 py-0.5 rounded text-slate-300 focus:outline-hidden"
                        />
                        <select
                          value={port.type}
                          onChange={(e) => handleUpdatePort('in', idx, { type: e.target.value as any })}
                          className="w-16 text-[9px] font-mono bg-slate-950 border border-slate-800 px-0.5 py-0.5 rounded text-slate-300 focus:outline-hidden"
                        >
                          <option value="number">num</option>
                          <option value="string">str</option>
                          <option value="boolean">bool</option>
                          <option value="any">any</option>
                        </select>
                        <button 
                          onClick={() => handleRemovePort('in', idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Outputs configurator */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Output Ports</span>
                  <button 
                    onClick={() => handleAddPort('out')}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-neon-purple transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {outputs.length === 0 ? (
                    <p className="text-[9px] font-mono text-slate-600">No output ports defined.</p>
                  ) : (
                    outputs.map((port, idx) => (
                      <div key={idx} className="flex gap-1 items-center bg-slate-900/60 p-1 border border-slate-800/40 rounded">
                        <input 
                          type="text"
                          value={port.id}
                          placeholder="id"
                          title="Port identifier (used in outputs.set('id', val))"
                          onChange={(e) => handleUpdatePort('out', idx, { id: e.target.value })}
                          className="w-16 text-[9px] font-mono bg-slate-950 border border-slate-800 px-1 py-0.5 rounded text-slate-300 focus:outline-hidden"
                        />
                        <input 
                          type="text"
                          value={port.name}
                          placeholder="label"
                          title="Port user-facing label text"
                          onChange={(e) => handleUpdatePort('out', idx, { name: e.target.value })}
                          className="w-20 text-[9px] font-mono bg-slate-950 border border-slate-800 px-1 py-0.5 rounded text-slate-300 focus:outline-hidden"
                        />
                        <select
                          value={port.type}
                          onChange={(e) => handleUpdatePort('out', idx, { type: e.target.value as any })}
                          className="w-16 text-[9px] font-mono bg-slate-950 border border-slate-800 px-0.5 py-0.5 rounded text-slate-300 focus:outline-hidden"
                        >
                          <option value="number">num</option>
                          <option value="string">str</option>
                          <option value="boolean">bool</option>
                          <option value="any">any</option>
                        </select>
                        <button 
                          onClick={() => handleRemovePort('out', idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Stylings selector */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Neon Color Theme</span>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((theme, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedThemeIdx(idx)}
                    className={`text-[10px] font-mono font-bold py-1.5 px-2.5 rounded border text-left cursor-pointer transition-colors ${
                      selectedThemeIdx === idx
                        ? 'bg-slate-900 border-neon-cyan text-slate-200'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="inline-block h-2 w-2 rounded-full bg-slate-100 mr-2 shrink-0" style={{ background: theme.color.includes('text-emerald-400') ? '#10b981' : theme.color.includes('text-violet-400') ? '#8b5cf6' : theme.color.includes('text-pink-400') ? '#ec4899' : theme.color.includes('text-cyan-400') ? '#06b6d4' : theme.color.includes('text-amber-400') ? '#f59e0b' : '#6366f1' }} />
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon option selector */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Workspace Node Icon</span>
              <div className="grid grid-cols-6 gap-2">
                {ICON_OPTIONS.map((ico, idx) => (
                  <button
                    key={idx}
                    type="button"
                    title={ico.name}
                    onClick={() => setSelectedIconName(ico.name)}
                    className={`p-2 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                      selectedIconName === ico.name
                        ? 'bg-slate-900 border-neon-purple text-neon-purple'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {ico.icon}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right panel: code editor and compiler test simulation */}
          <div className="w-1/2 flex flex-col min-h-0 bg-slate-950/40">
            
            {/* JavaScript IDE workspace */}
            <div className="flex-1 flex flex-col min-h-0 border-b border-cyber-border/20">
              <div className="px-4 py-2 border-b border-cyber-border/10 bg-slate-900/60 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-mono text-slate-400 font-bold">SCRIPT COMPILER (JS)</span>
                <span className="text-[8px] font-mono text-slate-500 italic">outputs.set(port, value)</span>
              </div>
              
              <div className="flex-1 relative font-mono text-xs overflow-hidden flex bg-slate-950">
                {/* Simulated line numbers sidebar */}
                <div className="w-8 select-none py-3 border-r border-slate-900 bg-slate-950/80 text-right pr-2 text-[9px] text-slate-700 leading-normal font-sans">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 bg-transparent p-3 resize-none focus:outline-hidden text-slate-200 border-0 leading-normal font-mono text-[11px] overflow-y-auto"
                />
              </div>
            </div>

            {/* Test Run simulator screen */}
            <div className="h-[210px] flex flex-col shrink-0 bg-slate-950">
              <div className="px-4 py-1.5 border-b border-cyber-border/10 bg-slate-900/40 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Sandbox Test Sweep</span>
                <button 
                  onClick={handleRunTest}
                  className="px-2.5 py-1 text-[9px] font-mono font-bold bg-linear-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/10"
                >
                  <Play className="h-2.5 w-2.5 fill-white" /> RUN TESTS
                </button>
              </div>

              <div className="flex-1 flex min-h-0">
                {/* Inputs mock value panel */}
                <div className="w-[170px] border-r border-cyber-border/10 p-3 overflow-y-auto space-y-2 bg-slate-900/20">
                  <span className="text-[9px] font-mono text-slate-500 font-bold block uppercase tracking-wide">Test Inputs</span>
                  {inputs.length === 0 ? (
                    <span className="text-[8px] font-mono text-slate-600 block">No inputs.</span>
                  ) : (
                    inputs.map(p => (
                      <div key={p.id} className="space-y-0.5">
                        <span className="text-[9px] font-mono text-slate-400 block">{p.name} ({p.id})</span>
                        <input 
                          type="text"
                          value={testInputs[p.id] || ''}
                          onChange={(e) => setTestInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className="w-full text-[10px] font-mono bg-slate-950 border border-slate-800/60 rounded px-1.5 py-0.5 text-slate-300 focus:outline-hidden"
                        />
                      </div>
                    ))
                  )}
                </div>

                {/* Outputs results & terminal logs panel */}
                <div className="flex-1 flex flex-col min-w-0 p-3 bg-slate-950/70 font-mono text-[9px] space-y-2 leading-tight">
                  <div className="flex justify-between items-center text-slate-500 pb-1 border-b border-slate-900">
                    <span>TEST RUN CONSOLE LOGS</span>
                    {testSuccess && <span className="text-neon-green font-bold flex items-center gap-1"><CheckCircle className="h-2.5 w-2.5" /> SUCCESS</span>}
                    {runError && <span className="text-neon-red font-bold flex items-center gap-1"><AlertCircle className="h-2.5 w-2.5" /> ERROR</span>}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin text-slate-400">
                    {consoleLogs.map((log, idx) => (
                      <div key={idx} className={log.startsWith('[ERROR]') ? 'text-rose-400' : 'text-slate-500'}>{log}</div>
                    ))}
                    
                    {testSuccess && (
                      <div className="mt-2 space-y-1">
                        <div className="text-neon-green font-bold">[OUTPUTS EMITTED]:</div>
                        {Object.entries(testOutputs).map(([k, v]) => (
                          <div key={k} className="pl-2.5 text-slate-300">
                            port &quot;{k}&quot; ➜ <span className="text-neon-cyan font-bold">{JSON.stringify(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-cyber-border/40 bg-slate-900/40 flex items-center justify-between shrink-0">
          <p className="text-[9px] font-mono text-slate-500 leading-normal max-w-[450px]">
            Ensure logic variables set values on correct output port strings. Registered block templates appear in node drawer.
          </p>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-mono border border-slate-800 hover:border-slate-700 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
            >
              DISCARD
            </button>
            <button 
              onClick={handleCreateNode}
              disabled={!label.trim() || inputs.some(i => !i.id.trim()) || outputs.some(o => !o.id.trim())}
              className="px-4 py-1.5 text-xs font-mono font-bold bg-linear-to-r from-neon-purple to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg cursor-pointer transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              SAVE NODE TEMPLATE
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
