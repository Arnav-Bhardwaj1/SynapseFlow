import React, { useState, useEffect, useRef } from 'react';
import { useGraph } from '../context/GraphContext';
import { compileAiPrompt } from '../utils/aiPromptCompiler';
import { computeAutoLayout } from '../utils/aiLayoutEngine';
import type { Node, Connection, Port, NodeType } from '../types/graph';
import { Sparkles, Terminal, ArrowRight, Play, Compass, RefreshCw } from 'lucide-react';

interface PresetPrompt {
  label: string;
  text: string;
}

export const AiAssistant: React.FC = () => {
  const { setGraphData } = useGraph();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const presets: PresetPrompt[] = [
    {
      label: "Alert threshold system",
      text: "Create a system that adds 45 to 15, then checks if it is larger than 50, and logs the result"
    },
    {
      label: "Difference multiplier",
      text: "Multiply 25 by 4, subtract 20 from it, and log the final outcome"
    },
    {
      label: "Print verification literal",
      text: "Set string message 'Access Granted' and logs it"
    }
  ];

  // Helper to scroll logs to bottom
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleGenerate = async (targetPrompt: string) => {
    if (!targetPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setLogs([]);

    // 1. Compile and tokenize prompt
    const spec = compileAiPrompt(targetPrompt);
    
    // Simulate steps sequentially with realistic typing delay for deep visual wow effect
    for (let i = 0; i < spec.thoughtSteps.length; i++) {
      await new Promise(r => setTimeout(r, 450 + Math.random() * 200));
      setLogs(prev => [...prev, spec.thoughtSteps[i]]);
    }

    await new Promise(r => setTimeout(r, 600));

    // 2. Generate actual Node and Connection ID hashes
    const idMap: Record<string, string> = {};
    spec.nodes.forEach(n => {
      idMap[n.key] = `${n.type}-${Math.random().toString(36).substring(2, 9)}`;
    });

    // 3. Compute Auto-Layout coordinate spaces mathematically
    const layoutCoords = computeAutoLayout(
      spec.nodes,
      spec.connections.map(c => ({
        id: '',
        fromNodeId: '',
        fromPortId: '',
        toNodeId: '',
        toPortId: '',
        fromKey: c.fromKey,
        toKey: c.toKey
      } as any))
    );

    // 4. Construct complete, functional Node models
    const mappedNodes: Node[] = spec.nodes.map(sn => {
      const id = idMap[sn.key];
      const coords = layoutCoords[sn.key] || { x: 100, y: 100 };
      
      let inputs: Port[] = [];
      let outputs: Port[] = [];

      switch (sn.type) {
        case 'input':
          outputs = [{ id: 'out', name: 'Val', type: 'number' }];
          break;
        case 'variable':
          outputs = [{ id: 'out', name: 'Str', type: 'string' }];
          break;
        case 'operator':
          inputs = [
            { id: 'a', name: 'Val A', type: 'number' },
            { id: 'b', name: 'Val B', type: 'number' }
          ];
          outputs = [{ id: 'res', name: 'Result', type: 'number' }];
          break;
        case 'conditional':
          inputs = [
            { id: 'condition', name: 'Cond', type: 'boolean' },
            { id: 'if_true', name: 'True', type: 'any' },
            { id: 'if_false', name: 'False', type: 'any' }
          ];
          outputs = [{ id: 'result', name: 'Result', type: 'any' }];
          break;
        case 'logger':
          inputs = [{ id: 'input_val', name: 'Log Value', type: 'any' }];
          break;
      }

      return {
        id,
        type: sn.type,
        label: sn.label,
        x: coords.x,
        y: coords.y,
        inputs,
        outputs,
        data: sn.data
      };
    });

    // 5. Construct complete Connection models
    const mappedConnections: Connection[] = spec.connections.map(sc => {
      return {
        id: `conn-${Math.random().toString(36).substring(2, 9)}`,
        fromNodeId: idMap[sc.fromKey],
        fromPortId: sc.fromPortId,
        toNodeId: idMap[sc.toKey],
        toPortId: sc.toPortId
      };
    });

    setLogs(prev => [
      ...prev,
      `📐 [Auto-Layout] Positioned nodes topologically with coordinates centered on canvas.`,
      `📦 [Batch] Committing ${mappedNodes.length} nodes and ${mappedConnections.length} connection paths to system context...`,
      `🚀 [Done] AI Workflow generation successful! Visual workflow active on canvas.`
    ]);

    // 6. Push to React state context
    setGraphData(mappedNodes, mappedConnections);
    setIsGenerating(false);
  };

  return (
    <div className="w-80 border-r border-cyber-border glass-panel shrink-0 flex flex-col p-5 overflow-y-auto">
      {/* Brand Copilot Header */}
      <h2 className="text-xs font-bold tracking-tight text-white mb-3 font-mono flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-neon-cyan animate-pulse" /> AI CO PILOT SANDBOX
      </h2>
      <p className="text-[10px] text-slate-400 mb-4 leading-normal font-mono">
        Describe your business logic workflow in natural language to compile and auto-layout a customized active DAG workflow draft.
      </p>

      {/* Preset Prompts Buttons */}
      <div className="flex flex-col gap-2 mb-4">
        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5" /> SELECT AN NLP TEMPLATE
        </span>
        {presets.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => {
              setPrompt(preset.text);
              handleGenerate(preset.text);
            }}
            disabled={isGenerating}
            className="w-full text-left px-3 py-2 text-[10px] font-mono text-slate-300 bg-slate-900/60 border border-cyber-border/20 rounded-md hover:border-neon-purple/50 disabled:opacity-50 cursor-pointer transition-all duration-300 truncate"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Main Text Input Area */}
      <div className="flex flex-col gap-2.5 mb-4 shrink-0">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isGenerating}
          placeholder="Describe calculation paths (e.g. 'Adds 10 to 5, multiply by 4 and log it')"
          className="w-full h-24 p-3 text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-200 rounded-md focus:outline-hidden focus:border-neon-purple transition-all duration-300 resize-none"
        />
        <button
          onClick={() => handleGenerate(prompt)}
          disabled={isGenerating || !prompt.trim()}
          className="w-full bg-linear-to-r from-neon-purple to-neon-cyan hover:from-violet-500 hover:to-cyan-400 disabled:opacity-40 disabled:hover:from-neon-purple disabled:hover:to-neon-cyan text-white font-mono font-bold text-xs py-2 rounded-md transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-500/10"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4.5 w-4.5 animate-spin" />
              <span>COMPILING FLOW...</span>
            </>
          ) : (
            <>
              <span>GENERATE WORKFLOW</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {/* AI Reasoning Emulated Terminal */}
      <div className="flex-1 flex flex-col min-h-[140px] border border-cyber-border/40 rounded-lg overflow-hidden bg-slate-950/80">
        <div className="px-3.5 py-1.5 border-b border-cyber-border bg-slate-900/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-neon-cyan animate-pulse" />
            <span className="text-[9px] font-bold font-mono text-slate-400">copilot_agent.log</span>
          </div>
          <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan animate-ping"></span>
        </div>
        
        <div className="flex-1 p-3 overflow-y-auto font-mono text-[9px] leading-relaxed text-slate-300 flex flex-col gap-1.5">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 select-none text-center px-4">
              <span>&gt; Standby. Select a preset template or submit a custom prompt to trigger AI Agent reasoning loops.</span>
            </div>
          ) : (
            logs.map((log, idx) => {
              let logColor = 'text-slate-400';
              if (log.includes('[Match]')) logColor = 'text-neon-cyan font-bold';
              if (log.includes('[Extract]')) logColor = 'text-neon-yellow';
              if (log.includes('[Compile]')) logColor = 'text-purple-400 font-bold';
              if (log.includes('[Wiring]')) logColor = 'text-pink-400';
              if (log.includes('[Done]')) logColor = 'text-neon-green font-bold';

              return (
                <div key={idx} className={`${logColor} select-text break-words`}>
                  {log}
                </div>
              );
            })
          )}
          <div ref={consoleEndRef} />
        </div>
      </div>
    </div>
  );
};
