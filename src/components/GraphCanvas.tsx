import React, { useState, useRef } from 'react';
import { useGraph } from '../context/GraphContext';
import type { Node, Port } from '../types/graph';
import { X, Cpu, Settings, HelpCircle, Sparkles, Zap, Activity, Terminal, Code2 } from 'lucide-react';
import { CollaboratorCursors } from './CollaboratorCursors';

interface DraggingConnection {
  fromNodeId: string;
  fromPortId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const mapNodeIcon = (type: string, customIconName?: string) => {
  if (type === 'custom') {
    switch (customIconName) {
      case 'Sparkles': return <Sparkles className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
      case 'Zap': return <Zap className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
      case 'Cpu': return <Cpu className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
      case 'Settings': return <Settings className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
      case 'Activity': return <Activity className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
      case 'Terminal': return <Terminal className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
      default: return <Code2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
    }
  }
  return <Cpu className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
};

export const GraphCanvas: React.FC = () => {
  const {
    nodes,
    connections,
    executionState,
    addConnection,
    deleteConnection,
    deleteNode,
    updateNodePosition,
    updateNodeData,
    customTemplates,
    lastTestResults,
    testCases
  } = useGraph();

  // Selected Node for editing attributes in context
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Canvas Pan & Zoom States
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Dragging Node state
  const [draggedNode, setDraggedNode] = useState<{ id: string; startX: number; startY: number } | null>(null);

  // Connection dragging state
  const [activeLink, setActiveLink] = useState<DraggingConnection | null>(null);

  // Port Calculations (Width = 200px, Header = 40px)
  const getNodePortCoords = (node: Node, portId: string, isInput: boolean): { x: number; y: number } => {
    if (isInput) {
      const idx = node.inputs.findIndex(p => p.id === portId);
      return {
        x: node.x,
        y: node.y + 60 + (idx >= 0 ? idx : 0) * 36
      };
    } else {
      const idx = node.outputs.findIndex(p => p.id === portId);
      return {
        x: node.x + 200,
        y: node.y + 60 + (idx >= 0 ? idx : 0) * 36
      };
    }
  };

  // Canvas Mouse Events (Pan)
  const handleBgMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-grid')) {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 1. Handle Canvas Panning
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y
      });
      return;
    }

    // 2. Handle Node Dragging
    if (draggedNode) {
      // Scale movement according to current zoom level
      const deltaX = (e.clientX - draggedNode.startX) / zoom;
      const deltaY = (e.clientY - draggedNode.startY) / zoom;
      
      // Snap to Grid (10px)
      const snapGrid = (val: number) => Math.round(val / 10) * 10;

      const node = nodes.find(n => n.id === draggedNode.id);
      if (node) {
        updateNodePosition(
          draggedNode.id,
          snapGrid(node.x + deltaX),
          snapGrid(node.y + deltaY)
        );
        // Reset start anchors
        setDraggedNode({
          id: draggedNode.id,
          startX: e.clientX,
          startY: e.clientY
        });
      }
      return;
    }

    // 3. Handle Port Connection Dragging
    if (activeLink) {
      // Calculate cursor relative to transformed canvas
      const localX = (e.clientX - rect.left - pan.x) / zoom;
      const localY = (e.clientY - rect.top - pan.y) / zoom;
      
      setActiveLink(prev => prev ? {
        ...prev,
        currentX: localX,
        currentY: localY
      } : null);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNode(null);
    setActiveLink(null);
  };

  // Zoom Handler (Wheel)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.05;
    const nextZoom = e.deltaY < 0 ? Math.min(zoom + zoomFactor, 1.5) : Math.max(zoom - zoomFactor, 0.6);
    setZoom(nextZoom);
  };

  // Node Drag Trigger
  const handleNodeHeaderMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggedNode({
      id: nodeId,
      startX: e.clientX,
      startY: e.clientY
    });
  };

  // Port Drag Initiator
  const handlePortMouseDown = (node: Node, port: Port, isInput: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isInput) return; // Connections start at Outputs

    const coords = getNodePortCoords(node, port.id, false);
    setActiveLink({
      fromNodeId: node.id,
      fromPortId: port.id,
      startX: coords.x,
      startY: coords.y,
      currentX: coords.x,
      currentY: coords.y
    });
  };

  // Port Release (Link Creation)
  const handlePortMouseUp = (toNode: Node, toPort: Port, isInput: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeLink || !isInput) return;

    addConnection(
      activeLink.fromNodeId,
      activeLink.fromPortId,
      toNode.id,
      toPort.id
    );
    setActiveLink(null);
  };

  // Calculate Curve Math
  const getBezierPath = (startX: number, startY: number, endX: number, endY: number) => {
    const ctrlX = startX + Math.max(Math.abs(endX - startX) * 0.5, 40);
    return `M ${startX} ${startY} C ${ctrlX} ${startY}, ${endX - Math.max(Math.abs(endX - startX) * 0.5, 40)} ${endY}, ${endX} ${endY}`;
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="flex-1 flex overflow-hidden relative min-h-0 bg-slate-950/40">
      {/* 1. Canvas Area */}
      <div
        ref={canvasRef}
        onMouseDown={handleBgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="flex-1 overflow-hidden relative cursor-grab bg-dot-grid"
        style={{
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* Pan and Zoom Container */}
        <div
          className="absolute inset-0 origin-top-left canvas-grid pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: '3000px',
            height: '3000px'
          }}
        >
          {/* SVG Connection Cables Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-auto overflow-visible">
            <defs>
              <linearGradient id="neon-glow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>

            {/* Active Connections */}
            {connections.map(conn => {
              const fromNode = nodes.find(n => n.id === conn.fromNodeId);
              const toNode = nodes.find(n => n.id === conn.toNodeId);
              if (!fromNode || !toNode) return null;

              const start = getNodePortCoords(fromNode, conn.fromPortId, false);
              const end = getNodePortCoords(toNode, conn.toPortId, true);
              const path = getBezierPath(start.x, start.y, end.x, end.y);

              // Highlights connection if source node is active or executed
              const isSourceExecuted = executionState.variables[`${conn.fromNodeId}-${conn.fromPortId}`] !== undefined;
              const isTargetActive = executionState.currentNodeId === conn.toNodeId;
              const isHighlight = isSourceExecuted || isTargetActive;

              return (
                <g key={conn.id} className="group cursor-pointer">
                  {/* Hover detector overlay */}
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="10"
                    onDoubleClick={() => deleteConnection(conn.id)}
                    className="hover:stroke-rose-500/20"
                  />
                  {/* Visual Line */}
                  <path
                    d={path}
                    fill="none"
                    stroke={isHighlight ? 'url(#neon-glow)' : 'rgba(71, 85, 105, 0.4)'}
                    strokeWidth={isHighlight ? '3' : '2'}
                    className={`transition-all duration-300 ${isHighlight ? 'connection-flow shadow-lg' : ''}`}
                  />
                </g>
              );
            })}

            {/* Temporary Dragging Cable */}
            {activeLink && (
              <path
                d={getBezierPath(activeLink.startX, activeLink.startY, activeLink.currentX, activeLink.currentY)}
                fill="none"
                stroke="#a78bfa"
                strokeWidth="2.5"
                strokeDasharray="5,5"
                className="opacity-70"
              />
            )}
          </svg>

          {/* Interactive HTML Node Cards Layer */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Remote Multiplayer Pointers */}
            <CollaboratorCursors />

            {nodes.map(node => {
              const isActiveNode = executionState.currentNodeId === node.id;
              
              // Define node background styling matching its type
              let typeStyles = 'border-violet-500/30';
              let badgeText = 'SOURCE';
              let badgeColor = 'bg-violet-500/20 text-violet-300';
              
              if (node.type === 'variable') {
                typeStyles = 'border-pink-500/30';
                badgeText = 'VARIABLE';
                badgeColor = 'bg-pink-500/20 text-pink-300';
              } else if (node.type === 'operator') {
                typeStyles = 'border-cyan-500/30';
                badgeText = 'OPERATOR';
                badgeColor = 'bg-cyan-500/20 text-cyan-300';
              } else if (node.type === 'conditional') {
                typeStyles = 'border-amber-500/30';
                badgeText = 'ROUTER';
                badgeColor = 'bg-amber-500/20 text-amber-300';
              } else if (node.type === 'logger') {
                typeStyles = 'border-emerald-500/30';
                badgeText = 'CONSOLE';
                badgeColor = 'bg-emerald-500/20 text-emerald-300';
              } else if (node.type === 'custom') {
                const tmpl = customTemplates.find(t => t.id === node.data.customNodeId);
                typeStyles = tmpl ? tmpl.borderColor : 'border-indigo-500/30';
                badgeText = 'CUSTOM';
                badgeColor = tmpl ? tmpl.badgeColor : 'bg-indigo-500/20 text-indigo-300';
              }

              const nodeAssertions = testCases.flatMap(tc => tc.assertions.filter(a => a.nodeId === node.id));
              const hasAssertions = nodeAssertions.length > 0;

              const nodeAssertionResults = lastTestResults
                ? lastTestResults.flatMap(r => r.assertionResults.filter(ar => {
                    const tc = testCases.find(t => t.id === r.testCaseId);
                    const ass = tc?.assertions.find(a => a.id === ar.assertionId);
                    return ass?.nodeId === node.id;
                  }))
                : [];

              const hasFailedAssert = nodeAssertionResults.some(r => !r.passed);

              const isCovered = lastTestResults && lastTestResults.length > 0
                ? lastTestResults.some(r => r.executedNodeIds.includes(node.id))
                : true;

              const showTestBadge = lastTestResults && lastTestResults.length > 0 && hasAssertions;
              
              const tooltipText = lastTestResults 
                ? lastTestResults.flatMap(r => {
                    const tc = testCases.find(t => t.id === r.testCaseId);
                    return r.assertionResults
                      .filter(ar => tc?.assertions.find(a => a.id === ar.assertionId)?.nodeId === node.id)
                      .map(ar => `[${tc?.name}] ${ar.passed ? '✓ Passed' : `✗ Failed: ${ar.message}`}`);
                  }).join('\n')
                : '';

              return (
                <div
                  key={node.id}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: '200px',
                  }}
                  className={`absolute pointer-events-auto glass-panel select-none rounded-lg border-2 ${typeStyles} ${
                    isActiveNode
                      ? 'border-neon-cyan ring-4 ring-cyan-500/20 animate-pulse'
                      : selectedNodeId === node.id
                      ? 'border-neon-purple shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                      : ''
                  } ${
                    lastTestResults && lastTestResults.length > 0 && !isCovered
                      ? 'opacity-40 hover:opacity-100 transition-all duration-300'
                      : ''
                  } ${
                    lastTestResults && lastTestResults.length > 0 && isCovered && hasAssertions
                      ? (hasFailedAssert ? 'border-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.2)]')
                      : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                >
                  {/* Node Header */}
                  <div
                    onMouseDown={(e) => handleNodeHeaderMouseDown(node.id, e)}
                    className="cursor-grab active:cursor-grabbing px-3 py-2 border-b border-cyber-border bg-slate-900/60 rounded-t-lg flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {mapNodeIcon(node.type, node.data.customIcon)}
                      <span className="text-xs font-bold text-slate-100 truncate">{node.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {showTestBadge && (
                        <span 
                          title={tooltipText}
                          className={`text-[8px] font-bold font-mono px-1 rounded-sm cursor-help ${
                            hasFailedAssert ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {hasFailedAssert ? `✗ FAIL` : `✓ PASS`}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNode(node.id);
                        }}
                        className="p-0.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-sm"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Body Ports Panel */}
                  <div className="px-3 py-3 flex flex-col gap-3.5 bg-slate-950/20">
                    <span className={`self-start text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${badgeColor}`}>
                      {badgeText}
                    </span>

                    {/* Dynamic Port Connections */}
                    <div className="flex justify-between items-start gap-4">
                      {/* Left: Inputs Stack */}
                      <div className="flex flex-col gap-2.5">
                        {node.inputs.map(input => {
                          const isConnected = connections.some(c => c.toNodeId === node.id && c.toPortId === input.id);
                          return (
                            <div
                              key={input.id}
                              onMouseUp={(e) => handlePortMouseUp(node, input, true, e)}
                              className="flex items-center gap-1.5 group relative"
                            >
                              <div
                                className={`h-3 w-3 rounded-full border border-slate-700 bg-slate-950 transition-colors ${
                                  isConnected ? 'bg-neon-cyan border-neon-cyan shadow-[0_0_5px_rgba(6,182,212,0.8)]' : 'group-hover:border-cyan-400'
                                }`}
                              />
                              <span className="text-[10px] font-mono text-slate-400">{input.name}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right: Outputs Stack */}
                      <div className="flex flex-col items-end gap-2.5 ml-auto">
                        {node.outputs.map(output => {
                          return (
                            <div
                              key={output.id}
                              onMouseDown={(e) => handlePortMouseDown(node, output, false, e)}
                              className="flex items-center gap-1.5 group cursor-crosshair"
                            >
                              <span className="text-[10px] font-mono text-slate-400">{output.name}</span>
                              <div
                                className="h-3 w-3 rounded-full border border-slate-700 bg-slate-950 transition-colors group-hover:bg-neon-purple group-hover:border-neon-purple group-hover:shadow-[0_0_8px_rgba(139,92,246,0.8)]"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Side Inspector Detail Drawer */}
      <div className="w-72 border-l border-cyber-border glass-panel shrink-0 flex flex-col p-5 overflow-y-auto">
        <h2 className="text-sm font-bold tracking-tight text-white mb-4 flex items-center gap-2 font-mono">
          <Settings className="h-4 w-4 text-neon-cyan" /> NODE INSPECTOR
        </h2>

        {selectedNode ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">NODE ID</label>
              <div className="text-xs font-mono bg-slate-950 px-2.5 py-1.5 rounded-md border border-slate-800 text-slate-300">
                {selectedNode.id}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">LABEL TITLE</label>
              <input
                type="text"
                value={selectedNode.label}
                onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                className="w-full text-xs font-mono bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-md focus:outline-hidden focus:border-neon-purple"
              />
            </div>

            {/* Type Specific Fields */}
            {(selectedNode.type === 'input' || selectedNode.type === 'variable') && (
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">
                  {selectedNode.type === 'input' ? 'NUMBER VALUE' : 'STRING VALUE'}
                </label>
                <input
                  type={selectedNode.type === 'input' ? 'number' : 'text'}
                  value={selectedNode.data.value !== undefined ? selectedNode.data.value : ''}
                  onChange={(e) => {
                    const val = selectedNode.type === 'input' ? Number(e.target.value) : e.target.value;
                    updateNodeData(selectedNode.id, { value: val });
                  }}
                  className="w-full text-xs font-mono bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-md focus:outline-hidden focus:border-neon-purple"
                />
              </div>
            )}

            {selectedNode.type === 'operator' && (
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">OPERATOR</label>
                <select
                  value={selectedNode.data.operator || '+'}
                  onChange={(e) => updateNodeData(selectedNode.id, { operator: e.target.value })}
                  className="w-full text-xs font-mono bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-md focus:outline-hidden focus:border-neon-purple"
                >
                  <option value="+">Addition (+)</option>
                  <option value="-">Subtraction (-)</option>
                  <option value="*">Multiplication (*)</option>
                  <option value="/">Division (/)</option>
                  <option value="%">Modulo (%)</option>
                  <option value="===">Strict Equals (===)</option>
                  <option value=">">Greater Than (&gt;)</option>
                  <option value="<">Less Than (&lt;)</option>
                  <option value="&&">Logical AND (&&)</option>
                  <option value="||">Logical OR (||)</option>
                </select>
              </div>
            )}

            {selectedNode.type === 'logger' && (
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">TERMINAL PREFIX</label>
                <input
                  type="text"
                  value={selectedNode.data.logPrefix || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, { logPrefix: e.target.value })}
                  className="w-full text-xs font-mono bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-md focus:outline-hidden focus:border-neon-purple"
                />
              </div>
            )}

            {selectedNode.type === 'custom' && (
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">NODE SCRIPT BODY (JS)</label>
                <textarea
                  value={selectedNode.data.code || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, { code: e.target.value })}
                  rows={8}
                  className="w-full text-[10.5px] font-mono bg-slate-950 border border-slate-800 text-slate-200 p-2 rounded-md focus:outline-hidden focus:border-neon-purple resize-none leading-normal"
                />
              </div>
            )}

            <button
              onClick={() => deleteNode(selectedNode.id)}
              className="mt-4 w-full bg-linear-to-r from-red-600 to-rose-700 text-white font-mono font-bold text-xs py-2 rounded-md hover:from-red-500 hover:to-rose-600 transition-all duration-300"
            >
              PURGE NODE
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
            <HelpCircle className="h-8 w-8 mb-2" />
            <p className="text-xs">Click a node cards inside workspace grid to inspect attributes.</p>
          </div>
        )}
      </div>
    </div>
  );
};
