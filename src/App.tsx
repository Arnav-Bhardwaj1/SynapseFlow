import { GraphProvider } from './context/GraphContext';
import { Header } from './components/Header';
import { NodePalette } from './components/NodePalette';
import { GraphCanvas } from './components/GraphCanvas';
import { CodeSynthesizer } from './components/CodeSynthesizer';
import { ConsoleTerminal } from './components/ConsoleTerminal';
import { ScopeInspector } from './components/ScopeInspector';

function App() {
  return (
    <GraphProvider>
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 text-slate-100">
        {/* 1. Top Cyber-Control Header Bar */}
        <Header />

        {/* 2. Middle Interactive Graph Workspace Grid */}
        <div className="flex-1 flex min-h-0 relative">
          {/* Node Palette block drawer */}
          <NodePalette />

          {/* Interactive Canvas grid */}
          <GraphCanvas />
        </div>

        {/* 3. Bottom Unified Debugger Dock Dashboard (Takes ~35% height) */}
        <div className="h-[280px] border-t border-cyber-border glass-panel shrink-0 p-4 flex gap-4 overflow-hidden bg-slate-950/70 z-10">
          {/* Live Code Compiler Output */}
          <CodeSynthesizer />

          {/* Real-time Shell Log console */}
          <ConsoleTerminal />

          {/* Core scope memory state registers */}
          <ScopeInspector />
        </div>
      </div>
    </GraphProvider>
  );
}

export default App;
