import React from 'react';
import { useGraph } from '../context/GraphContext';
import type { NodeType } from '../types/graph';
import { PlusCircle, LogIn, Braces, Binary, GitFork, Terminal } from 'lucide-react';

interface NodeOption {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export const NodePalette: React.FC = () => {
  const { addNode, nodes } = useGraph();

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

  const handleSpawnNode = (type: NodeType) => {
    // Generate center coordinates with random noise to prevent overlaps
    const count = nodes.length;
    const x = 120 + (count % 3) * 30;
    const y = 150 + (count % 4) * 30;
    addNode(type, x, y);
  };

  return (
    <div className="w-64 border-r border-cyber-border glass-panel shrink-0 flex flex-col p-4 overflow-y-auto">
      <h2 className="text-xs font-bold tracking-tight text-white mb-3 font-mono flex items-center gap-2">
        <PlusCircle className="h-4 w-4 text-neon-purple animate-pulse" /> SPAWN BLOCK PALETTE
      </h2>
      <p className="text-[10px] text-slate-400 mb-4 leading-normal font-mono">
        Add programming blocks below to compile customized executable logic visual trees.
      </p>

      <div className="flex flex-col gap-3">
        {nodeOptions.map(option => (
          <button
            key={option.type}
            onClick={() => handleSpawnNode(option.type)}
            className={`w-full text-left p-3 rounded-lg border border-cyber-border/40 bg-linear-to-br ${option.color} transition-all duration-300 transform active:scale-98 cursor-pointer flex flex-col gap-1`}
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-slate-900/60 border border-slate-800">
                {option.icon}
              </div>
              <span className="text-xs font-bold font-mono text-slate-200">{option.label}</span>
            </div>
            <span className="text-[9px] text-slate-400 font-sans mt-1 leading-relaxed">
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
