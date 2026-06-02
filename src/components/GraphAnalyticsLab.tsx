import React, { useState, useMemo } from 'react';
import { useGraph } from '../context/GraphContext';
import type { Node, Connection } from '../types/graph';
import { 
  Activity, 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  GitCommit, 
  GitFork, 
  Maximize2, 
  Clock, 
  Sparkles, 
  Zap, 
  Compass, 
  AlertCircle 
} from 'lucide-react';

interface GraphAnalyticsLabProps {
  isOpen: boolean;
  onClose: () => void;
}

// Configured standard execution latency (in ms) per node type
const NODE_LATENCIES: Record<string, number> = {
  input: 10,
  variable: 5,
  operator: 15,
  conditional: 25,
  logger: 20
};

interface Recommendation {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  category: 'structure' | 'performance' | 'cleanup';
  actionLabel?: string;
  nodeId?: string;
}

export const GraphAnalyticsLab: React.FC<GraphAnalyticsLabProps> = ({ isOpen, onClose }) => {
  const { nodes, connections, error } = useGraph();
  
  // Explicitly reference types to prevent unused-import compilation warnings
  const _typedNodes: Node[] = nodes;
  const _typedConns: Connection[] = connections;
  console.log("AST Analyzer loading with inputs: ", _typedNodes.length, _typedConns.length);

  const [activeTab, setActiveTab] = useState<'overview' | 'critical' | 'centrality' | 'map' | 'opt'>('overview');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // ==========================================
  // ALGORITHM 1: Topological Sort (Local helper)
  // ==========================================
  const topologicalData = useMemo(() => {
    if (nodes.length === 0) return { order: [], hasCycle: false };

    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    const nodeIds = nodes.map(n => n.id);

    nodeIds.forEach(id => {
      inDegree[id] = 0;
      adj[id] = [];
    });

    connections.forEach(conn => {
      if (adj[conn.fromNodeId] && adj[conn.toNodeId]) {
        adj[conn.fromNodeId].push(conn.toNodeId);
        inDegree[conn.toNodeId]++;
      }
    });

    const queue: string[] = nodeIds.filter(id => inDegree[id] === 0);
    const order: string[] = [];

    while (queue.length > 0) {
      const u = queue.shift()!;
      order.push(u);

      const neighbors = adj[u] || [];
      neighbors.forEach(v => {
        inDegree[v]--;
        if (inDegree[v] === 0) {
          queue.push(v);
        }
      });
    }

    const hasCycle = order.length < nodes.length;
    return { order: hasCycle ? [] : order, hasCycle };
  }, [nodes, connections]);

  // ==========================================
  // ALGORITHM 2: Critical Path Discovery (DP)
  // ==========================================
  const criticalPathData = useMemo(() => {
    const { order, hasCycle } = topologicalData;
    if (hasCycle || nodes.length === 0 || order.length === 0) {
      return { path: [], totalLatency: 0 };
    }

    // dp[u] stores the maximum cumulative latency on any path ending at node u
    const dp: Record<string, number> = {};
    // parent[u] stores the predecessor node ID on the longest path to u
    const parent: Record<string, string | null> = {};

    // Initialize DP tables
    nodes.forEach(n => {
      const lat = NODE_LATENCIES[n.type] || 10;
      dp[n.id] = lat;
      parent[n.id] = null;
    });

    // Build incoming adjacency for easy lookup
    const incoming: Record<string, string[]> = {};
    nodes.forEach(n => { incoming[n.id] = []; });
    connections.forEach(c => {
      if (incoming[c.toNodeId]) {
        incoming[c.toNodeId].push(c.fromNodeId);
      }
    });

    // Solve DP using topological order
    order.forEach(uId => {
      const uNode = nodes.find(n => n.id === uId);
      const uLat = uNode ? (NODE_LATENCIES[uNode.type] || 10) : 10;

      const preds = incoming[uId] || [];
      if (preds.length > 0) {
        let maxVal = -1;
        let bestPred: string | null = null;

        preds.forEach(pId => {
          if (dp[pId] !== undefined && dp[pId] > maxVal) {
            maxVal = dp[pId];
            bestPred = pId;
          }
        });

        if (bestPred !== null && maxVal !== -1) {
          dp[uId] = uLat + maxVal;
          parent[uId] = bestPred;
        }
      }
    });

    // Find the node ending with maximum cumulative DP value
    let maxLatency = 0;
    let endNodeId: string | null = null;
    nodes.forEach(n => {
      if (dp[n.id] > maxLatency) {
        maxLatency = dp[n.id];
        endNodeId = n.id;
      }
    });

    // Reconstruct the path backwards
    const path: string[] = [];
    let curr: string | null = endNodeId;
    while (curr !== null) {
      path.unshift(curr);
      curr = parent[curr] || null;
    }

    return { path, totalLatency: maxLatency };
  }, [nodes, connections, topologicalData]);

  // ==========================================
  // ALGORITHM 3: Betweenness Centrality (BFS Shortest Paths)
  // ==========================================
  const betweennessCentrality = useMemo(() => {
    const scores: Record<string, number> = {};
    nodes.forEach(n => { scores[n.id] = 0; });

    if (nodes.length === 0) return scores;

    // Adjacency list representation
    const adj: Record<string, string[]> = {};
    nodes.forEach(n => { adj[n.id] = []; });
    connections.forEach(c => {
      if (adj[c.fromNodeId]) {
        adj[c.fromNodeId].push(c.toNodeId);
      }
    });

    // Standard BFS shortest paths accumulator for all pairs (s, t)
    nodes.forEach(sNode => {
      const s = sNode.id;
      // Run BFS from s
      const queue: string[] = [s];
      const dist: Record<string, number> = {};
      const paths: Record<string, string[][]> = {};
      
      nodes.forEach(n => {
        dist[n.id] = Infinity;
        paths[n.id] = [];
      });

      dist[s] = 0;
      paths[s] = [[s]];

      while (queue.length > 0) {
        const u = queue.shift()!;
        const neighbors = adj[u] || [];

        neighbors.forEach(v => {
          if (dist[v] === Infinity) {
            dist[v] = dist[u] + 1;
            paths[v] = paths[u].map(p => [...p, v]);
            queue.push(v);
          } else if (dist[v] === dist[u] + 1) {
            // Found alternative shortest path of equal length
            const altPaths = paths[u].map(p => [...p, v]);
            paths[v] = [...paths[v], ...altPaths];
          }
        });
      }

      // Now compute fractions of paths passing through nodes v != s, t
      nodes.forEach(tNode => {
        const t = tNode.id;
        if (s === t) return;

        const shortestPaths = paths[t] || [];
        const sigma_st = shortestPaths.length;
        if (sigma_st === 0) return;

        nodes.forEach(vNode => {
          const v = vNode.id;
          if (v === s || v === t) return;

          // Count how many paths contain node v
          let sigma_st_v = 0;
          shortestPaths.forEach(path => {
            // Exclude first and last element to match standard centrality definition
            const innerPath = path.slice(1, -1);
            if (innerPath.includes(v)) {
              sigma_st_v++;
            }
          });

          if (sigma_st_v > 0) {
            scores[v] += sigma_st_v / sigma_st;
          }
        });
      });
    });

    // Normalize centrality scores for cleaner viewing (divide by maximum score if > 0)
    let maxScore = 0;
    nodes.forEach(n => {
      if (scores[n.id] > maxScore) maxScore = scores[n.id];
    });

    if (maxScore > 0) {
      nodes.forEach(n => {
        scores[n.id] = parseFloat((scores[n.id] / maxScore).toFixed(3));
      });
    }

    return scores;
  }, [nodes, connections]);

  // ==========================================
  // ALGORITHM 4: Dead-Node Detection
  // ==========================================
  const deadNodeData = useMemo(() => {
    if (nodes.length === 0) return { deadNodes: new Set<string>(), unconnectedInputs: new Set<string>() };

    const sources = nodes.filter(n => n.type === 'input' || n.type === 'variable').map(n => n.id);
    const sinks = nodes.filter(n => n.type === 'logger').map(n => n.id);

    // Forward adjacency (outgoing) and backward adjacency (incoming)
    const adj: Record<string, string[]> = {};
    const revAdj: Record<string, string[]> = {};
    nodes.forEach(n => {
      adj[n.id] = [];
      revAdj[n.id] = [];
    });

    connections.forEach(c => {
      if (adj[c.fromNodeId]) adj[c.fromNodeId].push(c.toNodeId);
      if (revAdj[c.toNodeId]) revAdj[c.toNodeId].push(c.fromNodeId);
    });

    // 1. Forward reachability: Reachable from ANY source node
    const reachableFromSource = new Set<string>();
    const queueSource = [...sources];
    sources.forEach(s => reachableFromSource.add(s));

    while (queueSource.length > 0) {
      const u = queueSource.shift()!;
      const neighbors = adj[u] || [];
      neighbors.forEach(v => {
        if (!reachableFromSource.has(v)) {
          reachableFromSource.add(v);
          queueSource.push(v);
        }
      });
    }

    // 2. Backward reachability: Can reach ANY sink node
    const canReachSink = new Set<string>();
    const queueSink = [...sinks];
    sinks.forEach(s => canReachSink.add(s));

    while (queueSink.length > 0) {
      const u = queueSink.shift()!;
      const predecessors = revAdj[u] || [];
      predecessors.forEach(v => {
        if (!canReachSink.has(v)) {
          canReachSink.add(v);
          queueSink.push(v);
        }
      });
    }

    // A node is "dead" if it is NOT reachable from a source OR cannot reach a sink
    const deadNodes = new Set<string>();
    nodes.forEach(n => {
      const isReachable = reachableFromSource.has(n.id);
      const reachesSink = canReachSink.has(n.id);
      
      // If graph has no sinks or no sources, we don't want to flag the entire graph as dead,
      // but if there are sources/sinks, we apply the strict reachability rule.
      const hasSources = sources.length > 0;
      const hasSinks = sinks.length > 0;

      const sourceFail = hasSources && !isReachable;
      const sinkFail = hasSinks && !reachesSink;

      // Also flag completely isolated nodes
      const isIsolated = (adj[n.id].length === 0 && revAdj[n.id].length === 0);

      if (isIsolated || sourceFail || sinkFail) {
        deadNodes.add(n.id);
      }
    });

    // 3. Find nodes with unconnected input ports
    const unconnectedInputs = new Set<string>();
    nodes.forEach(n => {
      if (n.inputs && n.inputs.length > 0) {
        n.inputs.forEach(port => {
          const hasConn = connections.some(c => c.toNodeId === n.id && c.toPortId === port.id);
          if (!hasConn) {
            unconnectedInputs.add(`${n.id}-${port.id}`);
          }
        });
      }
    });

    return { deadNodes, unconnectedInputs };
  }, [nodes, connections]);

  // ==========================================
  // ALGORITHM 5: Weakly Connected Components (WCC)
  // ==========================================
  const connectedComponents = useMemo(() => {
    if (nodes.length === 0) return [];

    const visited = new Set<string>();
    const components: string[][] = [];

    // Create an undirected graph version
    const adjUndir: Record<string, string[]> = {};
    nodes.forEach(n => { adjUndir[n.id] = []; });
    connections.forEach(c => {
      if (adjUndir[c.fromNodeId] && adjUndir[c.toNodeId]) {
        adjUndir[c.fromNodeId].push(c.toNodeId);
        adjUndir[c.toNodeId].push(c.fromNodeId);
      }
    });

    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const comp: string[] = [];
        const queue: string[] = [node.id];
        visited.add(node.id);

        while (queue.length > 0) {
          const u = queue.shift()!;
          comp.push(u);

          const neighbors = adjUndir[u] || [];
          neighbors.forEach(v => {
            if (!visited.has(v)) {
              visited.add(v);
              queue.push(v);
            }
          });
        }
        components.push(comp);
      }
    });

    return components;
  }, [nodes, connections]);

  // ==========================================
  // ALGORITHM 6: Cyclomatic Complexity & Stats
  // ==========================================
  const cyclomaticComplexity = useMemo(() => {
    if (nodes.length === 0) return 0;
    const E = connections.length;
    const V = nodes.length;
    const P = connectedComponents.length;
    // Formula: M = E - V + 2P
    return Math.max(0, E - V + (2 * P));
  }, [nodes, connections, connectedComponents]);

  // ==========================================
  // ALGORITHM 7: Health Score & Auto-Optimizer Recommendations
  // ==========================================
  const healthStats = useMemo(() => {
    let score = 100;
    const deductions: { reason: string; points: number }[] = [];

    if (nodes.length === 0) {
      return { score: 100, deductions: [] };
    }

    // 1. Cycle detection
    const { hasCycle } = topologicalData;
    if (hasCycle) {
      score -= 40;
      deductions.push({ reason: 'Cycle Detected in Logic Flow', points: 40 });
    }

    // 2. Dead nodes
    const { deadNodes, unconnectedInputs } = deadNodeData;
    if (deadNodes.size > 0) {
      const deductVal = Math.min(40, deadNodes.size * 10);
      score -= deductVal;
      deductions.push({ reason: `${deadNodes.size} Unproductive/Dead Node(s) Detected`, points: deductVal });
    }

    // 3. Unconnected ports
    if (unconnectedInputs.size > 0) {
      const deductVal = Math.min(30, unconnectedInputs.size * 5);
      score -= deductVal;
      deductions.push({ reason: `${unconnectedInputs.size} Empty/Unconnected Port(s)`, points: deductVal });
    }

    // 4. Disconnected components
    const numComp = connectedComponents.length;
    if (numComp > 1) {
      const deductVal = Math.min(30, (numComp - 1) * 10);
      score -= deductVal;
      deductions.push({ reason: `${numComp} Disconnected Component Clusters`, points: deductVal });
    }

    return {
      score: Math.max(0, score),
      deductions
    };
  }, [nodes, topologicalData, deadNodeData, connectedComponents]);

  // RECOMMENDATION ENGINE BUILDER
  const recommendations = useMemo<Recommendation[]>(() => {
    const list: Recommendation[] = [];
    const { deadNodes, unconnectedInputs } = deadNodeData;
    const { hasCycle } = topologicalData;
    const numComp = connectedComponents.length;

    // 1. Cycles (Critical/High Severity)
    if (hasCycle) {
      list.push({
        id: 'rec-cycle',
        title: 'Break Infinite Execution Loop',
        description: 'A circular connection sequence was flagged. Visual compilers cannot run procedural code in cycles. Trace feedback loops and prune a backward connection.',
        severity: 'high',
        category: 'structure'
      });
    }

    // 2. Unconnected Input Ports (High/Medium Severity)
    nodes.forEach(n => {
      n.inputs.forEach(port => {
        const key = `${n.id}-${port.id}`;
        if (unconnectedInputs.has(key)) {
          list.push({
            id: `rec-port-${key}`,
            title: `Provide Input for "${n.label}"`,
            description: `The input port "${port.name}" on node "${n.label}" is floating and has no wired connection. This will default to fallback values.`,
            severity: n.type === 'operator' || n.type === 'conditional' ? 'high' : 'medium',
            category: 'structure',
            nodeId: n.id,
            actionLabel: 'Focus Node'
          });
        }
      });
    });

    // 3. Dead Nodes (Medium Severity)
    nodes.forEach(n => {
      if (deadNodes.has(n.id)) {
        const isSource = n.type === 'input' || n.type === 'variable';
        const isSink = n.type === 'logger';
        
        let desc = `Node "${n.label}" is isolated from execution paths. It is not connected to any other node.`;
        if (!isSource && !isSink) {
          desc = `Node "${n.label}" does not receive data from input sources OR does not output values that propagate to a Logger. Its execution is a dead-end.`;
        }

        list.push({
          id: `rec-dead-${n.id}`,
          title: `Optimize Dead Node: "${n.label}"`,
          description: desc,
          severity: 'medium',
          category: 'cleanup',
          nodeId: n.id,
          actionLabel: 'Examine Node'
        });
      }
    });

    // 4. Component Fragmentation (Low Severity)
    if (numComp > 1) {
      list.push({
        id: 'rec-comp',
        title: 'Consolidate Parallel Sub-workflows',
        description: `Your workspace contains ${numComp} unconnected graph networks. If these are independent, execute them separately; otherwise, bridge them via operators or logging pipes.`,
        severity: 'low',
        category: 'structure'
      });
    }

    // 5. High Cyclomatic Complexity (Medium/Low Severity)
    if (cyclomaticComplexity > 6) {
      list.push({
        id: 'rec-complexity',
        title: 'Decompose Spaghetti Logic Flow',
        description: `With a cyclomatic complexity of ${cyclomaticComplexity}, the decision matrix is highly branched. Consider refactoring calculations into simpler layout pipelines.`,
        severity: 'low',
        category: 'performance'
      });
    }

    // Default recommendation if everything is fully clean
    if (list.length === 0 && nodes.length > 0) {
      list.push({
        id: 'rec-perfect',
        title: 'Logic Flow Fully Optimized!',
        description: 'All nodes are reachability-tested, inputs are properly wired, and the compiler detects a pristine DAG pipeline. No optimization needed.',
        severity: 'low',
        category: 'performance'
      });
    }

    return list;
  }, [nodes, deadNodeData, topologicalData, connectedComponents, cyclomaticComplexity]);

  // ==========================================
  // MINI-GRAPH LAYERED LAYOUT GENERATOR
  // ==========================================
  const miniGraphLayout = useMemo(() => {
    if (nodes.length === 0) return { nodes: [], connections: [], width: 420, height: 300 };

    const { order, hasCycle } = topologicalData;
    
    // Assign horizontal ranks (layers) to nodes
    const ranks: Record<string, number> = {};
    nodes.forEach(n => { ranks[n.id] = 0; });

    // Build outgoing adjacency list
    const adj: Record<string, string[]> = {};
    nodes.forEach(n => { adj[n.id] = []; });
    connections.forEach(c => {
      if (adj[c.fromNodeId]) {
        adj[c.fromNodeId].push(c.toNodeId);
      }
    });

    if (!hasCycle && order.length > 0) {
      // DP: Rank is max predecessor rank + 1
      order.forEach(uId => {
        const uRank = ranks[uId];
        const children = adj[uId] || [];
        children.forEach(vId => {
          ranks[vId] = Math.max(ranks[vId], uRank + 1);
        });
      });
    } else {
      // Fallback: Assign ranks roughly based on node's X coordinate on the main canvas
      const minX = Math.min(...nodes.map(n => n.x));
      const maxX = Math.max(...nodes.map(n => n.x));
      const range = maxX - minX || 1;
      nodes.forEach(n => {
        ranks[n.id] = Math.floor(((n.x - minX) / range) * 4);
      });
    }

    // Group nodes by rank
    const rankGroups: Record<number, string[]> = {};
    nodes.forEach(n => {
      const r = ranks[n.id];
      if (!rankGroups[r]) rankGroups[r] = [];
      rankGroups[r].push(n.id);
    });

    const maxRank = Math.max(...Object.keys(rankGroups).map(Number), 0);
    const colsCount = maxRank + 1;

    // Viewport configurations for SVG
    const svgWidth = 440;
    const svgHeight = 280;
    const paddingX = 50;
    const paddingY = 40;

    const colWidth = colsCount > 1 
      ? (svgWidth - (paddingX * 2)) / (colsCount - 1) 
      : svgWidth - (paddingX * 2);

    const layoutNodes = nodes.map(n => {
      const r = ranks[n.id];
      const siblings = rankGroups[r];
      const index = siblings.indexOf(n.id);
      
      const posX = paddingX + (r * colWidth);
      
      // Distribute nodes vertically centered
      const sibCount = siblings.length;
      const spaceY = svgHeight - (paddingY * 2);
      const posY = sibCount > 1
        ? paddingY + (index * (spaceY / (sibCount - 1)))
        : svgHeight / 2;

      // Color mapping based on connected component grouping or dead-node status
      let nodeColor = 'cyan';
      let componentIdx = connectedComponents.findIndex(c => c.includes(n.id));
      const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];
      nodeColor = colors[componentIdx % colors.length] || '#06b6d4';

      if (deadNodeData.deadNodes.has(n.id)) {
        nodeColor = '#64748b'; // Gray/dead color
      }

      return {
        id: n.id,
        label: n.label,
        type: n.type,
        x: posX,
        y: posY,
        color: nodeColor,
        isDead: deadNodeData.deadNodes.has(n.id),
        isOnCriticalPath: criticalPathData.path.includes(n.id),
        latency: NODE_LATENCIES[n.type] || 10,
        centrality: betweennessCentrality[n.id] || 0
      };
    });

    // Map connections with calculated layout coordinates
    const layoutConnections = connections.map(conn => {
      const from = layoutNodes.find(n => n.id === conn.fromNodeId);
      const to = layoutNodes.find(n => n.id === conn.toNodeId);

      const isPathConn = criticalPathData.path.indexOf(conn.fromNodeId) !== -1 && 
                         criticalPathData.path.indexOf(conn.toNodeId) !== -1 &&
                         Math.abs(criticalPathData.path.indexOf(conn.fromNodeId) - criticalPathData.path.indexOf(conn.toNodeId)) === 1;

      return {
        id: conn.id,
        fromX: from?.x || 0,
        fromY: from?.y || 0,
        toX: to?.x || 0,
        toY: to?.y || 0,
        isCritical: isPathConn,
        fromNodeId: conn.fromNodeId,
        toNodeId: conn.toNodeId
      };
    });

    return {
      nodes: layoutNodes,
      connections: layoutConnections,
      width: svgWidth,
      height: svgHeight
    };
  }, [nodes, connections, topologicalData, connectedComponents, deadNodeData, criticalPathData, betweennessCentrality]);

  // Color scheme helpers for Health Score meter
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-neon-green';
    if (score >= 50) return 'text-neon-yellow';
    return 'text-neon-red';
  };

  const getHealthBarColor = (score: number) => {
    if (score >= 80) return 'bg-neon-green';
    if (score >= 50) return 'bg-neon-yellow';
    return 'bg-neon-red';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-slate-950/95 border-l border-cyber-border/70 backdrop-blur-xl shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out font-sans select-none">
      
      {/* 1. Header of Slide-over panel */}
      <div className="p-5 border-b border-cyber-border/40 flex items-center justify-between bg-slate-900/30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-linear-to-tr from-neon-purple to-neon-cyan flex items-center justify-center shadow-md shadow-cyan-500/10">
            <Brain className="h-4.5 w-4.5 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wider text-white uppercase font-mono">Analytics & Optimization</h2>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">Real-time Logic Flow Synthesizer Analytics</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex px-3 border-b border-cyber-border/20 bg-slate-900/10 shrink-0">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'critical', label: 'Critical Path', icon: Clock },
          { id: 'centrality', label: 'Centrality', icon: GitFork },
          { id: 'map', label: 'Layered Map', icon: Maximize2 },
          { id: 'opt', label: 'Optimizer Tips', icon: Sparkles }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[9px] font-mono font-bold tracking-tight border-b-2 transition-all cursor-pointer ${
                isActive 
                  ? 'border-neon-cyan text-neon-cyan bg-slate-900/20' 
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/10'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-neon-cyan' : 'text-slate-500'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. Panel Main Scroll Container */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        
        {/* Error warning badge if workspace has compilation block */}
        {error && (
          <div className="p-3 border border-red-500/20 bg-red-500/5 rounded-lg flex items-start gap-2.5">
            <AlertCircle className="h-4.5 w-4.5 text-neon-red shrink-0 mt-0.5" />
            <div className="text-[10px] font-mono text-neon-red leading-normal">
              <span className="font-bold uppercase">Compilation Error: </span>{error}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 1: OVERVIEW & GENERAL STATS
           ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Health Score Ring Gauge & Main Stat Block */}
            <div className="p-4 border border-cyber-border/40 bg-slate-900/20 rounded-xl flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Network Health Index</span>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-4xl font-extrabold font-mono tracking-tighter ${getHealthColor(healthStats.score)}`}>
                    {nodes.length > 0 ? healthStats.score : '--'}
                  </span>
                  <span className="text-slate-500 text-xs font-mono">/ 100</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-cyber-border/10">
                  <div 
                    className={`h-full ${getHealthBarColor(healthStats.score)} transition-all duration-500`}
                    style={{ width: `${nodes.length > 0 ? healthStats.score : 0}%` }}
                  />
                </div>
                <p className="text-[9px] text-slate-400 font-mono italic mt-1 leading-normal">
                  {healthStats.score === 100 && nodes.length > 0 && '✨ pristine graph topology.'}
                  {healthStats.score < 100 && healthStats.score >= 80 && '👍 minor optimization advised.'}
                  {healthStats.score < 80 && healthStats.score >= 50 && '⚠️ warning: logic compilation degraded.'}
                  {healthStats.score < 50 && '🚨 critical: compile cycle / layout issues present.'}
                  {nodes.length === 0 && 'Drag nodes onto canvas to view health score.'}
                </p>
              </div>

              {/* SVG Health Ring representation */}
              <div className="relative h-20 w-20 shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle 
                    cx="40" cy="40" r="32" 
                    className="stroke-slate-900" 
                    strokeWidth="5" fill="transparent" 
                  />
                  <circle 
                    cx="40" cy="40" r="32" 
                    className={`${getHealthColor(healthStats.score)} stroke-current`}
                    strokeWidth="5.5" fill="transparent" 
                    strokeDasharray={2 * Math.PI * 32}
                    strokeDashoffset={2 * Math.PI * 32 * (1 - (nodes.length > 0 ? healthStats.score : 0) / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-slate-500/80" />
                </div>
              </div>
            </div>

            {/* Network Health Deductions */}
            {healthStats.deductions.length > 0 && (
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">Deduction Logs</span>
                <div className="space-y-1.5">
                  {healthStats.deductions.map((d, i) => (
                    <div key={i} className="flex justify-between items-center px-3 py-1.5 bg-slate-900/40 border border-cyber-border/10 rounded-md text-[10px] font-mono text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <AlertTriangle className="h-3 w-3 text-neon-yellow shrink-0" />
                        {d.reason}
                      </span>
                      <span className="text-neon-red font-bold">-{d.points} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Core Structural Analytics Metrics Grid */}
            <div className="grid grid-cols-2 gap-3.5">
              {[
                { label: 'Complexity Index', val: cyclomaticComplexity, desc: 'McCabe Cyclomatic loops', color: 'text-neon-purple', icon: GitFork },
                { label: 'Active Clusters', val: connectedComponents.length, desc: 'Connected subcomponents', color: 'text-neon-cyan', icon: GitCommit },
                { label: 'Graph Nodes', val: nodes.length, desc: 'Instantiated program nodes', color: 'text-white', icon: Activity },
                { label: 'Edge Connections', val: connections.length, desc: 'Data piping channels', color: 'text-white', icon: Zap }
              ].map((stat, i) => {
                const StatIcon = stat.icon;
                return (
                  <div key={i} className="p-3 border border-cyber-border/20 bg-slate-900/30 rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[9px] font-bold font-mono tracking-wider">{stat.label}</span>
                      <StatIcon className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-bold font-mono ${stat.color}`}>{nodes.length > 0 ? stat.val : '--'}</span>
                    </div>
                    <p className="text-[8px] text-slate-500 font-mono truncate">{stat.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Node type distribution summary */}
            <div className="p-3 border border-cyber-border/20 bg-slate-900/20 rounded-lg">
              <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block mb-2.5">Node Type Distribution</span>
              <div className="space-y-1.5">
                {['input', 'variable', 'operator', 'conditional', 'logger'].map(type => {
                  const count = nodes.filter(n => n.type === type).length;
                  const percent = nodes.length > 0 ? Math.round((count / nodes.length) * 100) : 0;
                  
                  let label = 'Unknown';
                  let barColor = 'bg-slate-700';
                  if (type === 'input') { label = 'Input Source'; barColor = 'bg-neon-cyan'; }
                  if (type === 'variable') { label = 'Memory Value'; barColor = 'bg-neon-purple'; }
                  if (type === 'operator') { label = 'Math Operator'; barColor = 'bg-neon-green'; }
                  if (type === 'conditional') { label = 'Logic Branch'; barColor = 'bg-neon-yellow'; }
                  if (type === 'logger') { label = 'Console Logger'; barColor = 'bg-neon-pink'; }

                  return (
                    <div key={type} className="flex items-center gap-3.5 text-[9px] font-mono">
                      <span className="w-24 text-slate-400 truncate">{label}</span>
                      <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor}`} style={{ width: `${percent}%` }} />
                      </div>
                      <span className="w-8 text-right text-slate-300 font-bold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: BOTTLENECKS & CRITICAL PATH
           ======================================================== */}
        {activeTab === 'critical' && (
          <div className="space-y-4">
            <div className="p-4 border border-cyber-border/40 bg-slate-900/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Critical Execution bottleneck</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-neon-purple/20 text-neon-purple border border-neon-purple/30 font-mono">DAG Bottleneck</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold font-mono text-neon-purple tracking-tighter">
                  {criticalPathData.totalLatency > 0 ? `${criticalPathData.totalLatency} ms` : '--'}
                </span>
                <span className="text-slate-500 text-xs font-mono">cumulative delay</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                The critical path identifies the sequential chain of logical components taking the longest execution time. Parallelizing or trimming nodes along this sequence is the most effective optimization for latency.
              </p>
            </div>

            {/* Reconstructed Critical Path Steps */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">Critical Path Sequence</span>
              {criticalPathData.path.length === 0 ? (
                <div className="p-6 border border-cyber-border/10 bg-slate-900/10 rounded-lg text-center text-[10px] font-mono text-slate-500">
                  {topologicalData.hasCycle 
                    ? '⚠️ Cannot trace critical path because the graph contains cyclic loops.' 
                    : 'Workspace empty. Add connected nodes to compile path latency.'}
                </div>
              ) : (
                <div className="relative pl-5 border-l border-slate-800 space-y-4 ml-2.5 py-1">
                  {criticalPathData.path.map((nodeId, idx) => {
                    const node = nodes.find(n => n.id === nodeId);
                    if (!node) return null;
                    const latency = NODE_LATENCIES[node.type] || 10;
                    
                    return (
                      <div key={nodeId} className="relative group">
                        {/* Dot indicator */}
                        <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-neon-purple border border-slate-950 shadow-md group-hover:scale-125 transition-transform" />
                        
                        <div className="p-3 border border-cyber-border/20 bg-slate-900/30 rounded-lg flex items-center justify-between gap-3 hover:border-neon-purple/40 transition-colors">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] font-mono text-slate-500">STEP 0{idx + 1}</span>
                              <span className="text-[10px] font-mono font-bold text-slate-200">{node.label}</span>
                            </div>
                            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400 border border-slate-700/50 uppercase">
                              {node.type}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-neon-purple">+{latency} ms</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Compiler node latency metrics references */}
            <div className="p-3 border border-cyber-border/20 bg-slate-900/20 rounded-lg space-y-2">
              <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">Theoretical AST Latencies</span>
              <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                {Object.entries(NODE_LATENCIES).map(([type, ms]) => (
                  <div key={type} className="flex justify-between items-center py-1 px-2 bg-slate-950/40 rounded border border-cyber-border/5">
                    <span className="text-slate-400 capitalize">{type}</span>
                    <span className="text-neon-cyan font-bold">{ms}ms</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: CENTRALITY ANALYSIS
           ======================================================== */}
        {activeTab === 'centrality' && (
          <div className="space-y-4">
            <div className="p-4 border border-cyber-border/40 bg-slate-900/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Structural Hubs & Routing</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 font-mono">Brandes Centrality</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                Betweenness centrality measures the fraction of shortest paths passing through a node. Nodes with high scores act as central data junctions, routing variables across operations. Issues in these nodes propagate downstream quickly.
              </p>
            </div>

            {/* Centrality Leaderboard */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">Centrality Leaderboard</span>
              {nodes.length === 0 ? (
                <div className="p-6 border border-cyber-border/10 bg-slate-900/10 rounded-lg text-center text-[10px] font-mono text-slate-500">
                  Graph is empty. Create nodes and wire connections.
                </div>
              ) : (
                <div className="space-y-2">
                  {nodes
                    .map(node => ({
                      ...node,
                      score: betweennessCentrality[node.id] || 0
                    }))
                    .sort((a, b) => b.score - a.score)
                    .map((item, idx) => {
                      const pct = Math.round(item.score * 100);
                      
                      let barColor = 'bg-neon-cyan';
                      if (item.score > 0.7) barColor = 'bg-neon-purple';
                      else if (item.score === 0) barColor = 'bg-slate-700';

                      return (
                        <div key={item.id} className="p-3 border border-cyber-border/20 bg-slate-900/30 rounded-lg space-y-2 hover:border-neon-cyan/40 transition-colors">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono text-slate-500 font-bold">#0{idx + 1}</span>
                              <span className="text-[10px] font-mono font-bold text-slate-200">{item.label}</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-neon-cyan">{item.score}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-[9px] font-mono">
                            <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                              <div className={`h-full ${barColor}`} style={{ width: `${pct || 4}%` }} />
                            </div>
                            <span className="text-slate-500 text-[8px] uppercase">{item.type}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: LAYERED MINI-GRAPH SVG
           ======================================================== */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="p-3 border border-cyber-border/40 bg-slate-900/20 rounded-xl space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Layered AST Flow Map</span>
              <p className="text-[9px] text-slate-400 font-mono leading-relaxed">
                Nodes are structured in ranks topologically. Hover over nodes to see statistics.
              </p>
            </div>

            {/* SVG Render box */}
            {nodes.length === 0 ? (
              <div className="p-12 border border-cyber-border/10 bg-slate-900/10 rounded-lg text-center text-[10px] font-mono text-slate-500">
                Canvas is empty. Create nodes to render the layered mini-graph.
              </div>
            ) : (
              <div className="relative border border-cyber-border/30 bg-slate-950 rounded-xl overflow-hidden shadow-inner">
                {/* SVG diagram */}
                <svg 
                  width="100%" 
                  height={miniGraphLayout.height}
                  viewBox={`0 0 ${miniGraphLayout.width} ${miniGraphLayout.height}`}
                  className="overflow-visible"
                >
                  <defs>
                    {/* Glowing filter */}
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    
                    {/* Glow filter for connections */}
                    <filter id="path-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="1.5" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>

                    {/* Arrow markers */}
                    <marker id="arrow" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
                    </marker>
                    <marker id="arrow-critical" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#ec4899" />
                    </marker>
                  </defs>

                  {/* Draw edges/connections */}
                  {miniGraphLayout.connections.map(conn => {
                    // Draw smooth Bezier curve instead of straight line
                    const dx = Math.abs(conn.toX - conn.fromX) * 0.5;
                    const pathData = `M ${conn.fromX} ${conn.fromY} C ${conn.fromX + dx} ${conn.fromY}, ${conn.toX - dx} ${conn.toY}, ${conn.toX} ${conn.toY}`;
                    
                    return (
                      <g key={conn.id}>
                        {/* Glow underlay for critical path connection */}
                        {conn.isCritical && (
                          <path
                            d={pathData}
                            fill="none"
                            stroke="#ec4899"
                            strokeWidth="3.5"
                            opacity="0.3"
                            filter="url(#path-glow)"
                          />
                        )}
                        <path
                          d={pathData}
                          fill="none"
                          stroke={conn.isCritical ? '#ec4899' : '#334155'}
                          strokeWidth={conn.isCritical ? 2.5 : 1.5}
                          markerEnd={conn.isCritical ? 'url(#arrow-critical)' : 'url(#arrow)'}
                          className={conn.isCritical ? 'connection-flow' : ''}
                        />
                      </g>
                    );
                  })}

                  {/* Draw nodes */}
                  {miniGraphLayout.nodes.map(node => {
                    const isHovered = hoveredNodeId === node.id;
                    const isSelected = selectedNodeId === node.id;
                    
                    return (
                      <g 
                        key={node.id}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                        className="cursor-pointer select-none"
                      >
                        {/* Selected / Hovered pulsing outer ring */}
                        {(isHovered || isSelected) && (
                          <rect
                            x={node.x - 22}
                            y={node.y - 14}
                            width="44"
                            height="28"
                            rx="5"
                            fill="none"
                            stroke={node.isOnCriticalPath ? '#ec4899' : '#06b6d4'}
                            strokeWidth="2"
                            filter="url(#glow)"
                            className="animate-pulse"
                          />
                        )}

                        {/* Node Box */}
                        <rect
                          x={node.x - 20}
                          y={node.y - 12}
                          width="40"
                          height="24"
                          rx="4"
                          fill="#0f172a"
                          stroke={node.isDead ? '#ef4444' : (node.isOnCriticalPath ? '#ec4899' : node.color)}
                          strokeWidth={node.isOnCriticalPath ? '2' : '1.5'}
                          strokeDasharray={node.isDead ? '3, 2' : '0'}
                          opacity={node.isDead ? '0.6' : '1'}
                          className="transition-colors duration-200"
                        />

                        {/* Inside Node Icon Placeholder letter */}
                        <text
                          x={node.x}
                          y={node.y + 4}
                          textAnchor="middle"
                          fill={node.isDead ? '#ef4444' : '#f8fafc'}
                          fontSize="9"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {node.type === 'input' && 'IN'}
                          {node.type === 'variable' && 'VAR'}
                          {node.type === 'operator' && 'OP'}
                          {node.type === 'conditional' && 'IF'}
                          {node.type === 'logger' && 'LOG'}
                        </text>

                        {/* Label beneath node */}
                        <text
                          x={node.x}
                          y={node.y + 24}
                          textAnchor="middle"
                          fill="#94a3b8"
                          fontSize="7"
                          fontFamily="monospace"
                          className="select-none pointer-events-none"
                        >
                          {node.label.length > 8 ? `${node.label.substring(0, 7)}…` : node.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* SVG Interactive Tooltip panel overlay */}
                {hoveredNodeId && (
                  (() => {
                    const node = miniGraphLayout.nodes.find(n => n.id === hoveredNodeId);
                    if (!node) return null;
                    return (
                      <div className="absolute bottom-3 left-3 right-3 p-3 border border-cyber-border/40 bg-slate-950/90 rounded-lg backdrop-blur-md text-[9px] font-mono leading-normal space-y-1 z-10">
                        <div className="flex justify-between items-center border-b border-cyber-border/10 pb-1">
                          <span className="font-bold text-slate-200 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: node.color }}></span>
                            {node.label}
                          </span>
                          <span className="text-slate-500 uppercase">{node.type}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-400">
                          <div>Latency Cost: <span className="text-neon-purple font-bold">{node.latency} ms</span></div>
                          <div>Betweenness: <span className="text-neon-cyan font-bold">{node.centrality}</span></div>
                          <div>Critical Bottleneck: <span className={node.isOnCriticalPath ? 'text-neon-pink font-bold' : 'text-slate-500'}>{node.isOnCriticalPath ? 'YES' : 'NO'}</span></div>
                          <div>State: <span className={node.isDead ? 'text-neon-red font-bold' : 'text-neon-green font-bold'}>{node.isDead ? 'DEAD / WASTE' : 'ACTIVE'}</span></div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* Legend for visual indicators */}
            <div className="p-3 border border-cyber-border/20 bg-slate-900/20 rounded-lg space-y-2">
              <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">Graph Legend</span>
              <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-5 bg-slate-950 border-2 border-neon-pink rounded" />
                  <span>Critical Path Bottleneck</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-5 bg-slate-950 border-2 border-slate-500 border-dashed rounded" />
                  <span>Dead / Unused Node</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-2">
                    <line x1="0" y1="4" x2="20" y2="4" stroke="#ec4899" strokeWidth="2" strokeDasharray="3,2" />
                  </svg>
                  <span>Active Data Flow Pipeline</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-neon-cyan" />
                  <span>Connected Component 01</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: RECONSTRUCTION & RECOMMENDATIONS ENGINE
           ======================================================== */}
        {activeTab === 'opt' && (
          <div className="space-y-4">
            <div className="p-4 border border-cyber-border/40 bg-slate-900/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">AST Refactor & Optimizer</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-linear-to-tr from-neon-purple to-neon-cyan text-white font-mono font-bold">Smart Analysis</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                Our code optimizer inspects logic flow structures, identifies compiling errors, floating inputs, and redundant execution nodes, providing immediate suggestions.
              </p>
            </div>

            {/* List of Recommendations */}
            <div className="space-y-3">
              {recommendations.map(rec => {
                let cardColor = 'border-slate-800 bg-slate-900/30';
                let iconColor = 'text-slate-500';
                let tagColor = 'bg-slate-800 text-slate-400 border-slate-700';
                
                if (rec.severity === 'high') {
                  cardColor = 'border-neon-red/20 bg-neon-red/5';
                  iconColor = 'text-neon-red';
                  tagColor = 'bg-neon-red/10 text-neon-red border-neon-red/20';
                } else if (rec.severity === 'medium') {
                  cardColor = 'border-neon-yellow/20 bg-neon-yellow/5';
                  iconColor = 'text-neon-yellow';
                  tagColor = 'bg-neon-yellow/10 text-neon-yellow border-neon-yellow/20';
                } else if (rec.severity === 'low' && rec.id !== 'rec-perfect') {
                  cardColor = 'border-neon-purple/20 bg-neon-purple/5';
                  iconColor = 'text-neon-purple';
                  tagColor = 'bg-neon-purple/10 text-neon-purple border-neon-purple/20';
                } else if (rec.id === 'rec-perfect') {
                  cardColor = 'border-neon-green/20 bg-neon-green/5';
                  iconColor = 'text-neon-green';
                  tagColor = 'bg-neon-green/10 text-neon-green border-neon-green/20';
                }

                return (
                  <div key={rec.id} className={`p-4 border rounded-xl space-y-3 ${cardColor} transition-colors duration-300`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {rec.id === 'rec-perfect' ? (
                            <CheckCircle className="h-4.5 w-4.5 text-neon-green shrink-0" />
                          ) : (
                            <AlertCircle className={`h-4.5 w-4.5 ${iconColor} shrink-0`} />
                          )}
                          <h4 className="text-[11px] font-bold font-mono text-slate-200">{rec.title}</h4>
                        </div>
                        <span className={`text-[8px] font-mono px-2 py-0.5 border rounded uppercase inline-block ${tagColor}`}>
                          {rec.severity} severity
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] font-mono text-slate-400 leading-normal">
                      {rec.description}
                    </p>

                    {/* Interactive focus action button */}
                    {rec.nodeId && (
                      <button 
                        onClick={() => {
                          setSelectedNodeId(rec.nodeId || null);
                          // Alert visual feedback to user
                          alert(`Locate and inspect node: "${nodes.find(n => n.id === rec.nodeId)?.label || rec.nodeId}" in the workspace canvas.`);
                        }}
                        className="text-[9px] font-mono font-bold text-neon-cyan hover:underline flex items-center gap-1.5 bg-slate-950/60 border border-cyber-border/10 py-1 px-2.5 rounded hover:border-neon-cyan/40 transition-all cursor-pointer"
                      >
                        <Compass className="h-3 w-3 text-neon-cyan" />
                        {rec.actionLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom footer with compiler code summary info */}
      <div className="p-4 border-t border-cyber-border/30 bg-slate-950 shrink-0 text-center">
        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1.5">
          <Activity className="h-3 w-3 text-neon-purple animate-pulse" />
          SynapseFlow AST Analyzer Engine v1.0.0
        </span>
      </div>
    </div>
  );
};
