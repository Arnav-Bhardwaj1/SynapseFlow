import React, { useState } from 'react';
import { useGraph } from '../context/GraphContext';
import { synthesizeCode } from '../utils/graphAlgorithms';
import { Code, Copy, Check } from 'lucide-react';

export const CodeSynthesizer: React.FC = () => {
  const { nodes, connections } = useGraph();
  const [copied, setCopied] = useState(false);

  const rawCode = synthesizeCode(nodes, connections);

  // Highlighting javascript tokens with regex to create a premium custom IDE style editor
  const highlightCode = (code: string) => {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(\/\/.*)/g, '<span class="code-comment">$1</span>')
      .replace(/\b(let|const|function|return|if|else)\b/g, '<span class="code-keyword">$1</span>')
      .replace(/\b(console\.log)\b/g, '<span class="code-function">console.log</span>')
      .replace(/\b(\d+)\b/g, '<span class="code-number">$1</span>')
      .replace(/(['"`])(.*?)\1/g, '<span class="code-string">$1$2$1</span>');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 glass-panel border border-cyber-border rounded-lg overflow-hidden">
      {/* Compiler Header Bar */}
      <div className="px-4 py-2 border-b border-cyber-border bg-slate-900/60 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-neon-purple shrink-0 animate-pulse" />
          <span className="text-xs font-bold font-mono text-slate-200">synthesizer.js</span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1 text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 rounded-md transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
          title="Copy synthesized code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-neon-green" />
              <span className="text-[10px] font-mono text-neon-green">COPIED</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span className="text-[10px] font-mono">COPY</span>
            </>
          )}
        </button>
      </div>

      {/* Code Editor Screen */}
      <div className="flex-1 p-4 overflow-y-auto bg-slate-950/60 font-mono text-xs leading-relaxed select-text min-h-0">
        <pre className="m-0 select-text">
          <code
            className="select-text"
            dangerouslySetInnerHTML={{ __html: highlightCode(rawCode) }}
          />
        </pre>
      </div>
    </div>
  );
};
