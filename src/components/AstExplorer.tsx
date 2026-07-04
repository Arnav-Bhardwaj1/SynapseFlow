import React, { useState, useMemo } from 'react';
import { useGraph } from '../context/GraphContext';
import { 
  compileGraphToAST, 
  optimizeAST, 
  generateCodeFromAST, 
  getASTDepth, 
  getASTNodeCount
} from '../utils/astCompiler';
import { synthesizeCode } from '../utils/graphAlgorithms';
import { 
  Binary, 
  X, 
  Sparkles, 
  FolderTree, 
  Code2, 
  TrendingUp, 
  ChevronRight, 
  ChevronDown, 
  Zap, 
  FileJson,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface AstExplorerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AstExplorer: React.FC<AstExplorerProps> = ({ isOpen, onClose }) => {
  const { nodes, connections, setCurrentNodeId, error } = useGraph();

  // Optimizations toggles
  const [foldConstants, setFoldConstants] = useState(true);
  const [removeDeadCode, setRemoveDeadCode] = useState(true);
  const [minifyNames, setMinifyNames] = useState(false);

  const [activeTab, setActiveTab] = useState<'tree' | 'code' | 'metrics'>('tree');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Expand root path by default
    return new Set<string>(['Program', 'Program.body']);
  });

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Compile and Optimize
  const compilerData = useMemo(() => {
    if (nodes.length === 0) {
      return {
        rawAST: null,
        optimizedAST: null,
        optimizedCode: '',
        logs: ['Workspace is empty. Drag nodes onto the canvas to compile AST.'],
        rawNodeCount: 0,
        optNodeCount: 0,
        rawDepth: 0,
        optDepth: 0
      };
    }

    try {
      const rawAST = compileGraphToAST(nodes, connections);
      const { ast: optimizedAST, logs } = optimizeAST(rawAST, {
        foldConstants,
        removeDeadCode,
        minifyNames
      });
      const optimizedCode = generateCodeFromAST(optimizedAST);

      return {
        rawAST,
        optimizedAST,
        optimizedCode,
        logs: logs.length > 0 ? logs : ['No optimizations applied. Compilation clean.'],
        rawNodeCount: getASTNodeCount(rawAST),
        optNodeCount: getASTNodeCount(optimizedAST),
        rawDepth: getASTDepth(rawAST),
        optDepth: getASTDepth(optimizedAST)
      };
    } catch (err: any) {
      return {
        rawAST: null,
        optimizedAST: null,
        optimizedCode: '',
        logs: [`Compilation failed: ${err.message || String(err)}`],
        rawNodeCount: 0,
        optNodeCount: 0,
        rawDepth: 0,
        optDepth: 0
      };
    }
  }, [nodes, connections, foldConstants, removeDeadCode, minifyNames]);

  const {
    rawAST,
    optimizedAST,
    optimizedCode,
    logs,
    rawNodeCount,
    optNodeCount,
    rawDepth,
    optDepth
  } = compilerData;

  // Code size comparison
  const sizeComparison = useMemo(() => {
    if (nodes.length === 0) return { rawSize: 0, optSize: 0, ratio: 0 };
    const rawJS = synthesizeCode(nodes, connections);
    const rawSize = rawJS.length;
    const optSize = optimizedCode.length;
    const ratio = rawSize > 0 ? Math.round(((rawSize - optSize) / rawSize) * 100) : 0;
    return { rawSize, optSize, ratio };
  }, [nodes, connections, optimizedCode]);

  // Highlighting javascript tokens with regex to create syntax matching CodeSynthesizer
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

  // Node highlight handlers
  const handleNodeMouseEnter = (nodeId?: string) => {
    if (nodeId) {
      setCurrentNodeId(nodeId);
    }
  };

  const handleNodeMouseLeave = () => {
    setCurrentNodeId(null);
  };

  // JSON AST Node Interactive Tree Renderer
  const RenderTree = ({ val, path, name }: { val: any; path: string; name?: string }) => {
    const isObject = typeof val === 'object' && val !== null;
    const isArray = Array.isArray(val);
    const hasChildren = isObject && Object.keys(val).length > 0;
    const isExpanded = expandedPaths.has(path);

    const hasNodeLink = isObject && val.nodeId && typeof val.nodeId === 'string' && val.nodeId.includes('-');

    if (!isObject) {
      // Primitive types (strings, numbers, booleans)
      let colorClass = 'text-emerald-400'; // literal / values
      if (typeof val === 'boolean') colorClass = 'text-amber-400';
      if (typeof val === 'number') colorClass = 'text-yellow-500';
      if (name === 'type') colorClass = 'text-violet-400 font-bold';
      if (name === 'operator') colorClass = 'text-sky-400 font-bold';
      if (name === 'name') colorClass = 'text-cyan-400 font-medium';

      return (
        <div className="flex items-baseline py-0.5 pl-6 text-[11px] font-mono hover:bg-slate-900/40 rounded px-1 transition-colors">
          {name && <span className="text-slate-400 mr-2">{name}:</span>}
          <span className={colorClass}>{JSON.stringify(val)}</span>
        </div>
      );
    }

    return (
      <div className="pl-4 border-l border-slate-900/60 my-0.5">
        <div 
          onClick={() => hasChildren && toggleExpand(path)}
          onMouseEnter={() => hasNodeLink && handleNodeMouseEnter(val.nodeId)}
          onMouseLeave={() => hasNodeLink && handleNodeMouseLeave()}
          className={`flex items-center gap-1.5 py-1 px-1.5 rounded transition-all cursor-pointer select-none group text-[11px] font-mono ${
            hasChildren ? 'hover:bg-slate-900/50' : ''
          } ${
            hasNodeLink ? 'hover:border-l-2 hover:border-cyan-500 bg-cyan-950/5 border-l border-transparent' : ''
          }`}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" /> : <ChevronRight className="h-3 w-3 text-slate-500 shrink-0" />
          ) : (
            <span className="w-3" />
          )}

          <div className="flex items-center gap-1.5 min-w-0">
            {name && <span className="text-slate-400 shrink-0">{name}:</span>}
            
            <span className="text-slate-300 font-bold truncate">
              {isArray ? `Array [${val.length}]` : (val.type || 'Object')}
            </span>

            {hasNodeLink && (
              <span className="text-[7.5px] font-bold tracking-widest bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-1 rounded-sm uppercase shrink-0 scale-90 origin-left opacity-60 group-hover:opacity-100 transition-opacity">
                Link
              </span>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-0.5">
            {Object.keys(val).map(key => {
              if (key === 'nodeId' && hasNodeLink) return null; // skip referencing raw id inside tree for cleaner aesthetics
              return (
                <RenderTree
                  key={key}
                  val={val[key]}
                  path={`${path}.${key}`}
                  name={key}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-slate-950/95 border-l border-cyber-border/70 backdrop-blur-xl shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out font-sans select-none">
      
      {/* 1. Header block */}
      <div className="p-5 border-b border-cyber-border/40 flex items-center justify-between bg-slate-900/30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-linear-to-tr from-neon-pink to-neon-purple flex items-center justify-center shadow-md shadow-pink-500/10">
            <Binary className="h-4.5 w-4.5 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wider text-white uppercase font-mono">AST Explorer Studio</h2>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">Abstract Syntax Tree Compiler & Optimizer</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Optimization controls */}
      <div className="p-4 border-b border-cyber-border/20 bg-slate-900/20 space-y-3.5">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-neon-pink" /> COMPILER OPTIMIZATIONS
          </span>
          {nodes.length > 0 && (
            <span className="text-[8.5px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> ENGINE COMPILED
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Constant folding switch */}
          <button
            onClick={() => setFoldConstants(prev => !prev)}
            className={`py-2 px-2.5 rounded-lg border text-left cursor-pointer transition-all duration-300 ${
              foldConstants 
                ? 'bg-neon-purple/10 border-neon-purple/50 text-purple-300' 
                : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'
            }`}
          >
            <div className="text-[9.5px] font-bold font-mono">Constant Folding</div>
            <div className="text-[7.5px] text-slate-400 mt-0.5 truncate leading-none">Evaluate static arithmetic</div>
          </button>

          {/* Dead code elimination switch */}
          <button
            onClick={() => setRemoveDeadCode(prev => !prev)}
            className={`py-2 px-2.5 rounded-lg border text-left cursor-pointer transition-all duration-300 ${
              removeDeadCode 
                ? 'bg-neon-purple/10 border-neon-purple/50 text-purple-300' 
                : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'
            }`}
          >
            <div className="text-[9.5px] font-bold font-mono">Dead Code Elim.</div>
            <div className="text-[7.5px] text-slate-400 mt-0.5 truncate leading-none">Remove unused variables</div>
          </button>

          {/* Identifier minification switch */}
          <button
            onClick={() => setMinifyNames(prev => !prev)}
            className={`py-2 px-2.5 rounded-lg border text-left cursor-pointer transition-all duration-300 ${
              minifyNames 
                ? 'bg-neon-purple/10 border-neon-purple/50 text-purple-300' 
                : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'
            }`}
          >
            <div className="text-[9.5px] font-bold font-mono">Minify Names</div>
            <div className="text-[7.5px] text-slate-400 mt-0.5 truncate leading-none">Obfuscate variables</div>
          </button>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex px-3 border-b border-cyber-border/20 bg-slate-900/10 shrink-0">
        {[
          { id: 'tree', label: 'AST JSON Tree', icon: FolderTree },
          { id: 'code', label: 'Optimized Code', icon: Code2 },
          { id: 'metrics', label: 'Optimizer Metrics', icon: TrendingUp }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[9px] font-mono font-bold tracking-tight border-b-2 transition-all cursor-pointer ${
                isActive 
                  ? 'border-neon-pink text-neon-pink bg-slate-900/20' 
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/10'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-neon-pink' : 'text-slate-500'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 4. Panel Main Scroll Container */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        
        {/* Compilation Error warnings */}
        {error && (
          <div className="p-3 border border-red-500/20 bg-red-500/5 rounded-lg flex items-start gap-2.5">
            <X className="h-4.5 w-4.5 text-neon-red shrink-0 mt-0.5" />
            <div className="text-[10px] font-mono text-neon-red leading-normal">
              <span className="font-bold uppercase">Workspace Error: </span>{error}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 1: AST JSON TREE VIEWER
           ======================================================== */}
        {activeTab === 'tree' && (
          <div className="space-y-4">
            
            {/* Quick summary alert */}
            <div className="p-3 border border-cyber-border/20 bg-slate-900/10 rounded-lg flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FileJson className="h-4.5 w-4.5 text-neon-purple shrink-0" />
                <span className="text-[10px] font-mono text-slate-300 leading-normal">
                  Hover over tree object nodes to highlight their originating visual nodes on the canvas.
                </span>
              </div>
            </div>

            {/* Tree Container */}
            {nodes.length === 0 ? (
              <div className="p-16 border border-cyber-border/10 bg-slate-900/10 rounded-xl text-center text-[10px] font-mono text-slate-500 flex flex-col items-center justify-center gap-2">
                <HelpCircle className="h-8 w-8 opacity-40 text-slate-400" />
                No compiled AST. Place nodes on canvas to inspect syntax branches.
              </div>
            ) : rawAST ? (
              <div className="p-4 border border-cyber-border/30 bg-slate-950/70 rounded-xl overflow-x-auto shadow-inner">
                <RenderTree val={optimizedAST} path="Program" />
              </div>
            ) : (
              <div className="p-4 border border-red-500/20 bg-red-500/5 text-neon-red text-xs font-mono rounded-lg">
                AST Construction unavailable due to circular workspace connection loops.
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: SYNTAX CODE HIGHLIGHT VIEW
           ======================================================== */}
        {activeTab === 'code' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 px-1">
              <span>GENERATED SCRIPTS</span>
              <span>SYNTAX COMPILED OK</span>
            </div>

            {nodes.length === 0 ? (
              <div className="p-16 border border-cyber-border/10 bg-slate-900/10 rounded-xl text-center text-[10px] font-mono text-slate-500">
                Workspace empty. No optimized code generated.
              </div>
            ) : (
              <div className="p-4 border border-cyber-border/30 bg-slate-950/70 rounded-xl overflow-auto max-h-96 font-mono text-xs leading-relaxed text-slate-200 select-text">
                <pre className="m-0 select-text">
                  <code 
                    className="select-text"
                    dangerouslySetInnerHTML={{ __html: highlightCode(optimizedCode) }}
                  />
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 3: METRICS DASHBOARD
           ======================================================== */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            
            {/* Grid of stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 border border-cyber-border/20 bg-slate-900/30 rounded-xl space-y-1">
                <span className="text-[8px] font-mono font-bold text-slate-500 uppercase block">AST Nodes</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold font-mono text-neon-pink">{optNodeCount}</span>
                  <span className="text-slate-500 text-[9px] font-mono">/ {rawNodeCount}</span>
                </div>
                <div className="text-[7.5px] text-slate-400 font-mono leading-none">
                  {rawNodeCount > 0 ? `${Math.round(((rawNodeCount - optNodeCount) / rawNodeCount) * 100)}% pruned` : '0%'}
                </div>
              </div>

              <div className="p-3 border border-cyber-border/20 bg-slate-900/30 rounded-xl space-y-1">
                <span className="text-[8px] font-mono font-bold text-slate-500 uppercase block">Tree Depth</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold font-mono text-neon-purple">{optDepth}</span>
                  <span className="text-slate-500 text-[9px] font-mono">/ {rawDepth}</span>
                </div>
                <div className="text-[7.5px] text-slate-400 font-mono leading-none">
                  {rawDepth > 0 ? `${Math.round(((rawDepth - optDepth) / rawDepth) * 100)}% shallower` : '0%'}
                </div>
              </div>

              <div className="p-3 border border-cyber-border/20 bg-slate-900/30 rounded-xl space-y-1">
                <span className="text-[8px] font-mono font-bold text-slate-500 uppercase block">Code Size</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold font-mono text-neon-cyan">{sizeComparison.optSize} B</span>
                </div>
                <div className="text-[7.5px] text-slate-400 font-mono leading-none">
                  {sizeComparison.ratio > 0 ? `${sizeComparison.ratio}% shorter script` : '0% reduction'}
                </div>
              </div>
            </div>

            {/* Optimization compilation log */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">Optimizer Optimization Logs</span>
              <div className="border border-cyber-border/10 rounded-lg p-3 bg-slate-950/40 space-y-1.5 max-h-48 overflow-y-auto">
                {logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2 text-[9.5px] font-mono text-slate-400 leading-normal">
                    <Zap className="h-3.5 w-3.5 text-neon-pink shrink-0 mt-0.5" />
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Optimization description panel */}
            <div className="p-4 border border-cyber-border/40 bg-slate-900/10 rounded-xl space-y-2 text-[10.5px] font-mono leading-normal text-slate-400">
              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider block">How optimizations operate:</span>
              <p>
                <strong className="text-neon-pink">Constant Folding:</strong> Scans Binary and Conditional branches to pre-evaluate calculations containing static variables, replacing expressions directly with static Literals.
              </p>
              <p>
                <strong className="text-neon-purple">Dead Code Elimination:</strong> Performs dependency checking starting from terminal log sinks. Any math or variables whose outputs do not propagate downstream are purged from the AST.
              </p>
              <p>
                <strong className="text-neon-cyan">Identifier Minification:</strong> Maps long visual labels to single character names (`a`, `b`, `c`) reducing JavaScript bundle size and memory allocation footprint.
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
