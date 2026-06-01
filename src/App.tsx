import { useState } from 'react';
import { GraphProvider, useGraph } from './context/GraphContext';
import { MultiplayerProvider, useMultiplayer } from './context/MultiplayerContext';
import { useMultiplayerSimulator } from './utils/multiplayerSimulator';
import { Header } from './components/Header';
import { NodePalette } from './components/NodePalette';
import { GraphCanvas } from './components/GraphCanvas';
import { CodeSynthesizer } from './components/CodeSynthesizer';
import { ConsoleTerminal } from './components/ConsoleTerminal';
import { ScopeInspector } from './components/ScopeInspector';
import { AiAssistant } from './components/AiAssistant';
import { MultiplayerSidebar } from './components/MultiplayerSidebar';
import { GraphAnalyticsLab } from './components/GraphAnalyticsLab';

function AppWorkspace() {
  const graph = useGraph();
  const multiplayer = useMultiplayer();
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Spin up active bot synchronization loop timers
  useMultiplayerSimulator(graph, multiplayer);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* 1. Top Cyber-Control Header Bar */}
      <Header 
        onToggleAnalytics={() => setIsAnalyticsOpen(prev => !prev)} 
        isAnalyticsActive={isAnalyticsOpen} 
      />

      {/* 2. Middle Interactive Graph Workspace Grid */}
      <div className="flex-1 flex min-h-0 relative">
        {/* AI Copilot Prompt Panel */}
        <AiAssistant />

        {/* Node Palette block drawer */}
        <NodePalette />

        {/* Interactive Canvas grid */}
        <GraphCanvas />

        {/* Multiplayer Session active panel */}
        <MultiplayerSidebar />
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
      {/* Graph Analytics & Optimization Lab Slide-over */}
      <GraphAnalyticsLab isOpen={isAnalyticsOpen} onClose={() => setIsAnalyticsOpen(false)} />
    </div>
  );
}

function App() {
  return (
    <GraphProvider>
      <MultiplayerProvider>
        <AppWorkspace />
      </MultiplayerProvider>
    </GraphProvider>
  );
}

export default App;
