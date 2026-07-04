import React from 'react';
import { useGraph } from '../context/GraphContext';
import { Play, Pause, RotateCcw, SkipForward, Trash2, Layers, Brain, Cpu, Clock, Beaker, Binary } from 'lucide-react';

interface HeaderProps {
  onToggleAnalytics: () => void;
  isAnalyticsActive: boolean;
  onToggleProfiler: () => void;
  isProfilerActive: boolean;
  onToggleDebugger: () => void;
  isDebuggerActive: boolean;
  onToggleTestLab: () => void;
  isTestLabActive: boolean;
  onToggleAstExplorer: () => void;
  isAstExplorerActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  onToggleAnalytics, 
  isAnalyticsActive,
  onToggleProfiler,
  isProfilerActive,
  onToggleDebugger,
  isDebuggerActive,
  onToggleTestLab,
  isTestLabActive,
  onToggleAstExplorer,
  isAstExplorerActive
}) => {
  const {
    executionState,
    startExecution,
    pauseExecution,
    stopExecution,
    stepExecution,
    setExecutionSpeed,
    loadPreset,
    clearGraph,
    error
  } = useGraph();

  const { isRunning, isPaused, speed } = executionState;

  return (
    <header className="glass-panel w-full border-b border-cyber-border py-4 px-6 flex flex-col md:flex-row justify-between items-center gap-4 z-10 shrink-0">
      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-linear-to-tr from-neon-purple to-neon-cyan flex items-center justify-center shadow-lg shadow-purple-500/20 animate-pulse-glow">
          <Layers className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white m-0 leading-none">Synapse<span className="text-neon-cyan font-light">Flow</span></h1>
          <p className="text-xs text-slate-400 mt-1 leading-none">Visual AST Logic Compiler & Interpreter</p>
        </div>
      </div>

      {/* Control Panel */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {/* Preset Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-mono">Preset Template:</label>
          <select
            onChange={(e) => loadPreset(e.target.value)}
            disabled={isRunning && !isPaused}
            className="text-xs font-mono bg-cyber-bg border border-cyber-border text-slate-200 px-3 py-1.5 rounded-md focus:outline-hidden focus:border-neon-purple transition-all duration-300"
            defaultValue="fizzbuzz"
          >
            <option value="fizzbuzz">FizzBuzz logic flow</option>
            <option value="arithmetic">Standard Calculator</option>
            <option value="conditional">Comparison Router</option>
          </select>
        </div>

        {/* Simulation Speed Slider */}
        <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
          <label className="text-xs text-slate-400 font-mono">Speed: <span className="text-neon-cyan font-bold">{speed}ms</span></label>
          <input
            type="range"
            min="200"
            max="2000"
            step="100"
            value={speed}
            onChange={(e) => setExecutionSpeed(Number(e.target.value))}
            className="w-24 accent-neon-purple cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />
        </div>

        {/* Actions Button Group */}
        <div className="flex items-center bg-slate-900/80 border border-cyber-border p-1 rounded-lg shadow-inner gap-1">
          {/* Play / Resume */}
          {(!isRunning || isPaused) ? (
            <button
              onClick={startExecution}
              disabled={!!error}
              title="Run visual simulation"
              className="p-2 text-neon-green hover:bg-emerald-500/10 rounded-md disabled:text-slate-600 disabled:hover:bg-transparent transition-all duration-200"
            >
              <Play className="h-4 w-4 fill-emerald-500/10" />
            </button>
          ) : (
            <button
              onClick={pauseExecution}
              title="Pause simulation"
              className="p-2 text-neon-yellow hover:bg-amber-500/10 rounded-md transition-all duration-200"
            >
              <Pause className="h-4 w-4 fill-amber-500/10" />
            </button>
          )}

          {/* Single Step */}
          <button
            onClick={stepExecution}
            disabled={isRunning && !isPaused}
            title="Step next execution node"
            className="p-2 text-neon-cyan hover:bg-cyan-500/10 rounded-md disabled:text-slate-600 disabled:hover:bg-transparent transition-all duration-200"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          {/* Reset / Stop */}
          <button
            onClick={stopExecution}
            disabled={!isRunning}
            title="Reset and clear execution stack"
            className="p-2 text-neon-pink hover:bg-pink-500/10 rounded-md disabled:text-slate-600 disabled:hover:bg-transparent transition-all duration-200"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Clear Graph */}
          <button
            onClick={clearGraph}
            title="Purge graph canvas"
            className="p-2 text-neon-red hover:bg-red-500/10 rounded-md border-l border-slate-800 pl-3 transition-all duration-200"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Time-Travel Debugger Toggle Button */}
        <button
          onClick={onToggleDebugger}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono rounded-lg border transition-all duration-300 cursor-pointer ${
            isDebuggerActive
              ? 'bg-neon-pink/20 border-neon-pink text-neon-pink shadow-lg shadow-pink-500/10'
              : 'bg-slate-900/80 border-cyber-border hover:border-neon-pink/50 text-slate-300 hover:bg-slate-900'
          }`}
        >
          <Clock className={`h-4 w-4 ${isDebuggerActive ? 'animate-pulse text-neon-pink' : 'text-slate-400'}`} />
          <span>Debugger Studio</span>
        </button>

        {/* Parallel Profiler Toggle Button */}
        <button
          onClick={onToggleProfiler}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono rounded-lg border transition-all duration-300 cursor-pointer ${
            isProfilerActive
              ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan shadow-lg shadow-cyan-500/10'
              : 'bg-slate-900/80 border-cyber-border hover:border-neon-cyan/50 text-slate-300 hover:bg-slate-900'
          }`}
        >
          <Cpu className={`h-4 w-4 ${isProfilerActive ? 'animate-pulse text-neon-cyan' : 'text-slate-400'}`} />
          <span>Parallel Profiler</span>
        </button>

        {/* Analytics Lab Toggle Button */}
        <button
          onClick={onToggleAnalytics}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono rounded-lg border transition-all duration-300 cursor-pointer ${
            isAnalyticsActive
              ? 'bg-neon-purple/20 border-neon-purple text-neon-purple shadow-lg shadow-purple-500/10'
              : 'bg-slate-900/80 border-cyber-border hover:border-neon-purple/50 text-slate-300 hover:bg-slate-900'
          }`}
        >
          <Brain className={`h-4 w-4 ${isAnalyticsActive ? 'animate-pulse text-neon-purple' : 'text-slate-400'}`} />
          <span>Analytics Lab</span>
        </button>

        {/* Test Suite Lab Toggle Button */}
        <button
          onClick={onToggleTestLab}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono rounded-lg border transition-all duration-300 cursor-pointer ${
            isTestLabActive
              ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/80 border-cyber-border hover:border-amber-500/50 text-slate-300 hover:bg-slate-900'
          }`}
        >
          <Beaker className={`h-4 w-4 ${isTestLabActive ? 'animate-pulse text-amber-400' : 'text-slate-400'}`} />
          <span>Test Studio</span>
        </button>

        {/* AST Explorer Toggle Button */}
        <button
          onClick={onToggleAstExplorer}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono rounded-lg border transition-all duration-300 cursor-pointer ${
            isAstExplorerActive
              ? 'bg-neon-pink/20 border-neon-pink text-neon-pink shadow-lg shadow-pink-500/10'
              : 'bg-slate-900/80 border-cyber-border hover:border-neon-pink/50 text-slate-300 hover:bg-slate-900'
          }`}
        >
          <Binary className={`h-4 w-4 ${isAstExplorerActive ? 'animate-pulse text-neon-pink' : 'text-slate-400'}`} />
          <span>AST Explorer</span>
        </button>

        {/* Debugger Active Badge */}
        <div className="hidden lg:flex items-center gap-3 bg-slate-950/80 border border-cyber-border/40 py-1.5 px-3 rounded-full">
          <span className={`h-2.5 w-2.5 rounded-full ${isRunning ? (isPaused ? 'bg-neon-yellow animate-pulse' : 'bg-neon-green animate-ping') : 'bg-slate-600'}`}></span>
          <span className="text-xs font-mono text-slate-300">
            {isRunning ? (isPaused ? 'SIMULATION PAUSED' : 'INTERPRETER ACTIVE') : 'ENGINE READY'}
          </span>
        </div>
      </div>
    </header>
  );
};
