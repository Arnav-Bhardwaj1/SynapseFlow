import React, { useState, useMemo } from 'react';
import { useGraph } from '../context/GraphContext';
import type { Node, Connection } from '../types/graph';
import {
  X,
  GitCompare,
  GitCommit,
  GitMerge,
  RefreshCw,
  Plus,
  Minus,
  Sliders,
  FileCode2,
  Layers,
  Sparkles,
  Info,
  CheckCircle2
} from 'lucide-react';

interface VisualDiffLabProps {
  isOpen: boolean;
  onClose: () => void;
}

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface NodeDiffItem {
  id: string;
  baseNode?: Node;
  targetNode?: Node;
  status: DiffStatus;
  changes: string[]; // List of property field names that differ
}

export interface ConnectionDiffItem {
  id: string;
  baseConn?: Connection;
  targetConn?: Connection;
  status: DiffStatus;
}

export const VisualDiffLab: React.FC<VisualDiffLabProps> = ({ isOpen, onClose }) => {
  const { nodes: currentNodes, connections: currentConnections, presetTemplates, setGraphData } = useGraph();

  // Snapshot State
  const [selectedTargetId, setSelectedTargetId] = useState<string>('preset-0'); // index or preset name
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mergeSuccessMsg, setMergeSuccessMsg] = useState<string | null>(null);

  // Available comparison targets (Preset templates + simulated historical snapshots)
  const comparisonTargets = useMemo(() => {
    const safePresets = presetTemplates || [];
    const presets = safePresets.map((p, idx) => ({
      id: `preset-${idx}`,
      name: `Preset: ${p.name}`,
      description: p.description,
      nodes: p.nodes,
      connections: p.connections
    }));

    // Simulated historical checkpoint
    const initialCheckpoint = {
      id: 'checkpoint-v1',
      name: 'Snapshot v1.0 (Initial Pipeline)',
      description: 'Initial state before visual edits',
      nodes: currentNodes.slice(0, Math.max(1, Math.floor(currentNodes.length / 2))),
      connections: currentConnections.slice(0, Math.max(0, currentConnections.length - 1))
    };

    return [...presets, initialCheckpoint];
  }, [presetTemplates, currentNodes, currentConnections]);

  const activeTarget = useMemo(() => {
    return comparisonTargets.find(t => t.id === selectedTargetId) || comparisonTargets[0];
  }, [comparisonTargets, selectedTargetId]);

  // --- DIFF COMPUTATION ENGINE ---
  const nodeDiffs = useMemo((): NodeDiffItem[] => {
    if (!activeTarget) return [];

    const baseMap = new Map(currentNodes.map(n => [n.id, n]));
    const targetMap = new Map(activeTarget.nodes.map(n => [n.id, n]));
    const allIds = new Set([...baseMap.keys(), ...targetMap.keys()]);

    const result: NodeDiffItem[] = [];

    allIds.forEach(id => {
      const baseNode = baseMap.get(id);
      const targetNode = targetMap.get(id);

      if (baseNode && !targetNode) {
        result.push({ id, baseNode, status: 'removed', changes: ['node_removed'] });
      } else if (!baseNode && targetNode) {
        result.push({ id, targetNode, status: 'added', changes: ['node_added'] });
      } else if (baseNode && targetNode) {
        const changes: string[] = [];
        if (baseNode.label !== targetNode.label) changes.push('label');
        if (baseNode.x !== targetNode.x || baseNode.y !== targetNode.y) changes.push('position');
        if (baseNode.inputs.length !== targetNode.inputs.length) changes.push('inputs');
        if (baseNode.outputs.length !== targetNode.outputs.length) changes.push('outputs');
        if (JSON.stringify(baseNode.data) !== JSON.stringify(targetNode.data)) changes.push('data');

        const status: DiffStatus = changes.length > 0 ? 'modified' : 'unchanged';
        result.push({ id, baseNode, targetNode, status, changes });
      }
    });

    return result;
  }, [currentNodes, activeTarget]);

  const connectionDiffs = useMemo((): ConnectionDiffItem[] => {
    if (!activeTarget) return [];

    const baseConnMap = new Map(currentConnections.map(c => [c.id, c]));
    const targetConnMap = new Map(activeTarget.connections.map(c => [c.id, c]));
    const allIds = new Set([...baseConnMap.keys(), ...targetConnMap.keys()]);

    const result: ConnectionDiffItem[] = [];

    allIds.forEach(id => {
      const baseConn = baseConnMap.get(id);
      const targetConn = targetConnMap.get(id);

      if (baseConn && !targetConn) {
        result.push({ id, baseConn, status: 'removed' });
      } else if (!baseConn && targetConn) {
        result.push({ id, targetConn, status: 'added' });
      } else if (baseConn && targetConn) {
        const isModified = baseConn.fromPortId !== targetConn.fromPortId || baseConn.toPortId !== targetConn.toPortId;
        result.push({ id, baseConn, targetConn, status: isModified ? 'modified' : 'unchanged' });
      }
    });

    return result;
  }, [currentConnections, activeTarget]);

  // --- AST STRUCTURAL DISTANCE METRIC ---
  const similarityScore = useMemo(() => {
    const totalItems = nodeDiffs.length + connectionDiffs.length;
    if (totalItems === 0) return 100;

    const unchangedItems = nodeDiffs.filter(d => d.status === 'unchanged').length +
      connectionDiffs.filter(d => d.status === 'unchanged').length;

    return Math.round((unchangedItems / totalItems) * 100);
  }, [nodeDiffs, connectionDiffs]);

  // Counts summary
  const addedCount = nodeDiffs.filter(d => d.status === 'added').length + connectionDiffs.filter(d => d.status === 'added').length;
  const removedCount = nodeDiffs.filter(d => d.status === 'removed').length + connectionDiffs.filter(d => d.status === 'removed').length;
  const modifiedCount = nodeDiffs.filter(d => d.status === 'modified').length;

  // Currently selected node diff item for detailed inspection
  const activeSelectedDiff = useMemo(() => {
    return nodeDiffs.find(d => d.id === selectedNodeId) || null;
  }, [nodeDiffs, selectedNodeId]);

  // --- 3-WAY MERGE RESOLUTION ACTIONS ---
  const handleAcceptTarget = () => {
    if (!activeTarget) return;
    setGraphData(activeTarget.nodes, activeTarget.connections);
    setMergeSuccessMsg(`Successfully overwritten workspace with target snapshot: "${activeTarget.name}".`);
    setTimeout(() => setMergeSuccessMsg(null), 3500);
  };

  const handleMergeAddedNodes = () => {
    if (!activeTarget) return;
    const addedNodes = nodeDiffs.filter(d => d.status === 'added' && d.targetNode).map(d => d.targetNode!);
    const addedConns = connectionDiffs.filter(d => d.status === 'added' && d.targetConn).map(d => d.targetConn!);

    if (addedNodes.length === 0 && addedConns.length === 0) {
      setMergeSuccessMsg('No missing nodes or wires found to merge.');
      setTimeout(() => setMergeSuccessMsg(null), 3000);
      return;
    }

    setGraphData([...currentNodes, ...addedNodes], [...currentConnections, ...addedConns]);
    setMergeSuccessMsg(`Merged +${addedNodes.length} new nodes & +${addedConns.length} connections into active workspace.`);
    setTimeout(() => setMergeSuccessMsg(null), 3500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-7xl h-[92vh] bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* TOP HEADER CONTROLS */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <GitCompare className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-100 tracking-wide">Visual AST Graph Diff Engine</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  v2.4
                </span>
              </div>
              <p className="text-xs text-slate-400">Compare topological DAG AST nodes, cable connectivity & parameter deltas</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Snapshot Target Selector */}
            <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <GitCommit className="w-4 h-4 text-cyan-400" />
              <label className="text-xs text-slate-400">Compare vs:</label>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer"
              >
                {comparisonTargets.map(target => (
                  <option key={target.id} value={target.id} className="bg-slate-900 text-slate-200">
                    {target.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NOTIFICATION FEEDBACK BAR */}
        {mergeSuccessMsg && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-6 py-2 flex items-center space-x-2 text-emerald-300 text-xs animate-in slide-in-from-top duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{mergeSuccessMsg}</span>
          </div>
        )}

        {/* METRICS & STATS BANNER */}
        <div className="grid grid-cols-4 gap-4 px-6 py-4 bg-slate-950/50 border-b border-slate-800/80">
          <div className="flex items-center space-x-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">AST Structural Match</p>
              <p className="text-lg font-bold text-cyan-400">{similarityScore}% <span className="text-xs text-slate-500 font-normal">similarity</span></p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Added Elements</p>
              <p className="text-lg font-bold text-emerald-400">+{addedCount} <span className="text-xs text-slate-500 font-normal">nodes & wires</span></p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Minus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Removed Elements</p>
              <p className="text-lg font-bold text-rose-400">-{removedCount} <span className="text-xs text-slate-500 font-normal">severed paths</span></p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Modified Properties</p>
              <p className="text-lg font-bold text-amber-400">~{modifiedCount} <span className="text-xs text-slate-500 font-normal">nodes changed</span></p>
            </div>
          </div>
        </div>

        {/* MAIN SPLIT DUAL-CANVAS BODY */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT PANEL: ACTIVE WORKSPACE (BASE) */}
          <div className="w-1/2 flex flex-col border-r border-slate-800 bg-slate-950/30">
            <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">Base: Active Workspace</span>
                <span className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-400 rounded-md">
                  {currentNodes.length} nodes
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {nodeDiffs.filter(d => d.baseNode).map(diff => {
                const node = diff.baseNode!;
                const isSelected = selectedNodeId === diff.id;

                let borderClass = 'border-slate-800 hover:border-slate-700';
                let badgeBg = 'bg-slate-800 text-slate-400';
                let tagText = 'MATCH';

                if (diff.status === 'removed') {
                  borderClass = 'border-rose-500/50 bg-rose-950/10 shadow-[0_0_12px_rgba(244,63,94,0.15)]';
                  badgeBg = 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
                  tagText = 'REMOVED IN TARGET';
                } else if (diff.status === 'modified') {
                  borderClass = 'border-amber-500/50 bg-amber-950/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]';
                  badgeBg = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
                  tagText = `MODIFIED (${diff.changes.join(', ')})`;
                }

                return (
                  <div
                    key={`base-${node.id}`}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`p-3.5 rounded-xl border ${borderClass} transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-cyan-500/50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-slate-200">{node.label}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                          {node.type}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeBg}`}>
                        {tagText}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-900/80 px-2.5 py-1.5 rounded-lg">
                      <span>Coords: ({node.x}, {node.y})</span>
                      <span>In: {node.inputs.length} | Out: {node.outputs.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANEL: TARGET SNAPSHOT (PRESET / CHECKPOINT) */}
          <div className="w-1/2 flex flex-col bg-slate-950/10">
            <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileCode2 className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-slate-200">Target: {activeTarget.name}</span>
                <span className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-400 rounded-md">
                  {activeTarget.nodes.length} nodes
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {nodeDiffs.filter(d => d.targetNode).map(diff => {
                const node = diff.targetNode!;
                const isSelected = selectedNodeId === diff.id;

                let borderClass = 'border-slate-800 hover:border-slate-700';
                let badgeBg = 'bg-slate-800 text-slate-400';
                let tagText = 'MATCH';

                if (diff.status === 'added') {
                  borderClass = 'border-emerald-500/50 bg-emerald-950/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]';
                  badgeBg = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                  tagText = '+ NEW IN TARGET';
                } else if (diff.status === 'modified') {
                  borderClass = 'border-amber-500/50 bg-amber-950/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]';
                  badgeBg = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
                  tagText = `MODIFIED (${diff.changes.join(', ')})`;
                }

                return (
                  <div
                    key={`target-${node.id}`}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`p-3.5 rounded-xl border ${borderClass} transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-cyan-500/50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-slate-200">{node.label}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                          {node.type}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeBg}`}>
                        {tagText}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-900/80 px-2.5 py-1.5 rounded-lg">
                      <span>Coords: ({node.x}, {node.y})</span>
                      <span>In: {node.inputs.length} | Out: {node.outputs.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BOTTOM INSPECTOR & MERGE CONTROL DRAWER */}
        <div className="h-44 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between px-6 py-3">
          
          {/* INSPECTOR VIEW */}
          <div className="flex-1 pr-6 border-r border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Node Property Comparison Inspector</span>
            </h4>

            {activeSelectedDiff ? (
              <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div>
                  <p className="text-[10px] text-slate-500 font-sans mb-1 font-bold">BASE WORKSPACE STATE</p>
                  {activeSelectedDiff.baseNode ? (
                    <div className="space-y-0.5 text-slate-300">
                      <p><span className="text-slate-500">Label:</span> {activeSelectedDiff.baseNode.label}</p>
                      <p><span className="text-slate-500">Position:</span> ({activeSelectedDiff.baseNode.x}, {activeSelectedDiff.baseNode.y})</p>
                      <p><span className="text-slate-500">Data:</span> {JSON.stringify(activeSelectedDiff.baseNode.data)}</p>
                    </div>
                  ) : (
                    <p className="text-slate-600 italic">Node does not exist in Base workspace</p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 font-sans mb-1 font-bold">TARGET SNAPSHOT STATE</p>
                  {activeSelectedDiff.targetNode ? (
                    <div className="space-y-0.5 text-slate-300">
                      <p><span className="text-slate-500">Label:</span> {activeSelectedDiff.targetNode.label}</p>
                      <p><span className="text-slate-500">Position:</span> ({activeSelectedDiff.targetNode.x}, {activeSelectedDiff.targetNode.y})</p>
                      <p><span className="text-slate-500">Data:</span> {JSON.stringify(activeSelectedDiff.targetNode.data)}</p>
                    </div>
                  ) : (
                    <p className="text-slate-600 italic">Node does not exist in Target snapshot</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-20 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
                Click any node card above to inspect granular property differences
              </div>
            )}
          </div>

          {/* 3-WAY MERGE RESOLUTION BUTTONS */}
          <div className="w-80 pl-6 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <GitMerge className="w-3.5 h-3.5 text-purple-400" />
              <span>3-Way Graph Merge Resolution</span>
            </h4>

            <button
              onClick={handleMergeAddedNodes}
              className="w-full py-2 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Merge Missing Nodes (+{addedCount})</span>
            </button>

            <button
              onClick={handleAcceptTarget}
              className="w-full py-2 px-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Overwrite Graph with Target</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
