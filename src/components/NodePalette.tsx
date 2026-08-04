import React, { useState } from 'react';
import { useGraph } from '../context/GraphContext';
import type { NodeType } from '../types/graph';
import { 
  PlusCircle, 
  LogIn, 
  Braces, 
  Binary, 
  GitFork, 
  Terminal, 
  Code2, 
  Trash2, 
  Sparkles, 
  Zap, 
  Cpu, 
  Settings, 
  Activity,
  Layers
} from 'lucide-react';
import { CustomNodeBuilder } from './CustomNodeBuilder';

interface NodeOption {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const mapIcon = (name: string) => {
  switch (name) {
    case 'Sparkles': return <Sparkles className="h-4 w-4" />;
    case 'Zap': return <Zap className="h-4 w-4" />;
    case 'Cpu': return <Cpu className="h-4 w-4" />;
    case 'Settings': return <Settings className="h-4 w-4" />;
    case 'Activity': return <Activity className="h-4 w-4" />;
    case 'Terminal': return <Terminal className="h-4 w-4" />;
    default: return <Code2 className="h-4 w-4" />;
  }
};

export const NodePalette: React.FC = () => {
  const { addNode, nodes, customTemplates, subgraphTemplates, deleteCustomTemplate, deleteSubgraphTemplate } = useGraph();
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const nodeOptions: NodeOption[] = [
    {
      type: 'input',
      label: 'Input Source',
      description: 'Holds a numeric literal value for mathematical computation steps.',
      icon: <LogIn className="h-4 w-4" />,
      color: 'from-violet-500/20 to-violet-500/5 hover:border-violet-500/50 text-violet-400'
    },
    {
      type: 'variable',
      label: 'String Literal',
      description: 'Holds a constant character string, ideal for console logs or labels.',
      icon: <Braces className="h-4 w-4" />,
      color: 'from-pink-500/20 to-pink-500/5 hover:border-pink-500/50 text-pink-400'
    },
    {
      type: 'operator',
      label: 'Math Operator',
      description: 'Executes mathematical (+,-,*,/,%) or comparison logic between ports.',
      icon: <Binary className="h-4 w-4" />,
      color: 'from-cyan-500/20 to-cyan-500/5 hover:border-cyan-500/50 text-cyan-400'
    },
    {
      type: 'conditional',
      label: 'Branch Router',
      description: 'Dynamic boolean switch routing True/False input values to a single result.',
      icon: <GitFork className="h-4 w-4" />,
      color: 'from-amber-500/20 to-amber-500/5 hover:border-amber-500/50 text-amber-400'
    },
    {
      type: 'logger',
      label: 'Terminal Logger',
      description: 'Evaluates the incoming connection port and prints it to the output terminal.',
      icon: <Terminal className="h-4 w-4" />,
      color: 'from-emerald-500/20 to-emerald-500/5 hover:border-emerald-500/50 text-emerald-400'
    }
  ];

  const handleSpawnNode = (type: NodeType, templateId?: string) => {
    const count = nodes.length;
    const x = 120 + (count % 3) * 30;
    const y = 150 + (count % 4) * 30;
    addNode(type, x, y, templateId);
  };

  return (
    <div className="w-64 border-r border-cyber-border glass-panel shrink-0 flex flex-col p-4 overflow-y-auto">
      <h2 className="text-xs font-bold tracking-tight text-white mb-3 font-mono flex items-center gap-2">
        <PlusCircle className="h-4 w-4 text-neon-purple animate-pulse" /> SPAWN BLOCK PALETTE
      </h2>
      <p className="text-[10px] text-slate-400 mb-4 leading-normal font-mono">
        Add programming blocks below to compile customized executable logic visual trees.
      </p>

      {/* Core Node Palette Options */}
      <div className="flex flex-col gap-2.5">
        {nodeOptions.map(option => (
          <button
            key={option.type}
            onClick={() => handleSpawnNode(option.type)}
            className={`w-full text-left p-2.5 rounded-lg border border-cyber-border/40 bg-linear-to-br ${option.color} transition-all duration-300 transform active:scale-98 cursor-pointer flex flex-col gap-1`}
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-slate-900/60 border border-slate-800">
                {option.icon}
              </div>
              <span className="text-xs font-bold font-mono text-slate-200">{option.label}</span>
            </div>
            <span className="text-[9px] text-slate-400 font-sans mt-0.5 leading-normal">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      {/* Subgraph Macros Section */}
      {subgraphTemplates.length > 0 && (
        <div className="mt-6 pt-4 border-t border-cyber-border/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-fuchsia-400 font-mono tracking-wider">SUBGRAPH MACROS</span>
          </div>

          <div className="flex flex-col gap-2">
            {subgraphTemplates.map(tmpl => (
              <div 
                key={tmpl.id}
                className={`relative w-full rounded-lg border border-fuchsia-500/30 bg-linear-to-br ${tmpl.color} p-2.5 transition-all duration-200 hover:border-fuchsia-500/60 group flex justify-between items-start`}
              >
                <button
                  onClick={() => handleSpawnNode('subgraph', tmpl.id)}
                  className="flex-1 text-left cursor-pointer flex flex-col gap-1 pr-4 min-w-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="p-1 rounded bg-slate-900/60 border border-slate-800">
                      {mapIcon(tmpl.iconName)}
                    </div>
                    <span className="text-xs font-bold font-mono text-slate-200 truncate">{tmpl.label}</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-sans mt-0.5 truncate w-full">
                    {tmpl.description}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSubgraphTemplate(tmpl.id);
                  }}
                  className="p-1 text-slate-600 hover:text-rose-400 hover:bg-slate-800 rounded absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                  title="Delete subgraph template"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom User Blocks Section */}
      <div className="mt-6 pt-4 border-t border-cyber-border/40 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider">CUSTOM USER BLOCKS</span>
          <button
            onClick={() => setIsBuilderOpen(true)}
            className="px-2 py-1 text-[9px] font-mono font-bold bg-linear-to-r from-neon-purple to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded cursor-pointer flex items-center gap-1 shadow-md shadow-purple-500/10"
          >
            <Layers className="h-3 w-3" /> NEW
          </button>
        </div>

        {customTemplates.length === 0 ? (
          <div className="p-6 border border-dashed border-slate-800 rounded-lg text-center">
            <span className="text-[9px] font-mono text-slate-600 leading-normal block">
              No custom blocks created yet. Click NEW to script one.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {customTemplates.map(tmpl => (
              <div 
                key={tmpl.id}
                className={`relative w-full rounded-lg border border-cyber-border/30 bg-linear-to-br ${tmpl.color} p-2.5 transition-all duration-200 hover:border-slate-700/50 group flex justify-between items-start`}
              >
                <button
                  onClick={() => handleSpawnNode('custom', tmpl.id)}
                  className="flex-1 text-left cursor-pointer flex flex-col gap-1 pr-4 min-w-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="p-1 rounded bg-slate-900/60 border border-slate-800">
                      {mapIcon(tmpl.iconName)}
                    </div>
                    <span className="text-xs font-bold font-mono text-slate-200 truncate">{tmpl.label}</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-sans mt-0.5 truncate w-full">
                    {tmpl.description}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCustomTemplate(tmpl.id);
                  }}
                  className="p-1 text-slate-600 hover:text-rose-400 hover:bg-slate-800 rounded absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                  title="Delete node template"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CustomNodeBuilder isOpen={isBuilderOpen} onClose={() => setIsBuilderOpen(false)} />
    </div>
  );
};
