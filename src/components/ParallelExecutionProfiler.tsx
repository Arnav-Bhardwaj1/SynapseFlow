import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useGraph } from '../context/GraphContext';
import type { Node, Connection } from '../types/graph';
import { 
  Cpu, 
  Play, 
  Pause, 
  RotateCcw, 
  Sliders, 
  X, 
  TrendingUp, 
  List, 
  Clock, 
  AlertTriangle
} from 'lucide-react';

interface ParallelExecutionProfilerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Configured execution latency (in ms) per node type
const NODE_LATENCIES: Record<string, number> = {
  input: 10,
  variable: 5,
  operator: 15,
  conditional: 25,
  logger: 20
};

interface ScheduledTask {
  nodeId: string;
  label: string;
  type: string;
  startTime: number;
  endTime: number;
  duration: number;
  workerId: number;
  predecessors: string[];
}

interface BenchmarkResult {
  workersCount: number;
  makespan: number;
  speedup: number;
  efficiency: number;
}

export const ParallelExecutionProfiler: React.FC<ParallelExecutionProfilerProps> = ({ isOpen, onClose }) => {
  const { nodes: rawNodes, connections: rawConns } = useGraph();
  
  // Cast raw nodes and connections to enforce Node and Connection types are fully utilized
  const nodes = rawNodes as Node[];
  const connections = rawConns as Connection[];
  
  const [numWorkers, setNumWorkers] = useState<number>(2);
  const [activeTab, setActiveTab] = useState<'gantt' | 'speedup' | 'playback'>('gantt');
  
  // Playback Simulation States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(100); // ms per tick
  const timerRef = useRef<any>(null);

  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // ==========================================
  // ALGORITHM 1: Compute Bottom-Levels (b-levels)
  // ==========================================
  // b-level(u) = weight(u) + max(b-level(v)) for all successors v of u.
  // It represents the length of the longest path from node u to a sink node.
  const bLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    
    const computeLevel = (nodeId: string): number => {
      if (levels[nodeId] !== undefined) return levels[nodeId];
      
      const node = nodes.find(n => n.id === nodeId);
      const duration = node ? (NODE_LATENCIES[node.type] || 10) : 10;
      
      // Find immediate child nodes
      const successors = connections
        .filter(c => c.fromNodeId === nodeId)
        .map(c => c.toNodeId);
        
      if (successors.length === 0) {
        levels[nodeId] = duration;
      } else {
        const maxChildLevel = Math.max(...successors.map(computeLevel));
        levels[nodeId] = duration + maxChildLevel;
      }
      
      return levels[nodeId];
    };

    nodes.forEach(n => computeLevel(n.id));
    return levels;
  }, [nodes, connections]);

  // ==========================================
  // ALGORITHM 2: Priority-Based List Scheduler
  // ==========================================
  // Schedules DAG tasks on K processors using b-levels as static level priorities.
  const scheduleData = useMemo(() => {
    if (nodes.length === 0) {
      return { tasks: [], makespan: 0, serialMakespan: 0, criticalPathLen: 0, isDeadlocked: false };
    }

    const tasks: ScheduledTask[] = [];
    const completed = new Set<string>();
    const unscheduled = new Set<string>(nodes.map(n => n.id));
    
    // Pred and succ adjacency lists
    const predecessorsList: Record<string, string[]> = {};
    const successorsList: Record<string, string[]> = {};
    
    nodes.forEach(n => {
      predecessorsList[n.id] = [];
      successorsList[n.id] = [];
    });
    
    connections.forEach(c => {
      if (predecessorsList[c.toNodeId]) {
        predecessorsList[c.toNodeId].push(c.fromNodeId);
      }
      if (successorsList[c.fromNodeId]) {
        successorsList[c.fromNodeId].push(c.toNodeId);
      }
    });

    const serialMakespan = nodes.reduce((sum, n) => sum + (NODE_LATENCIES[n.type] || 10), 0);
    const criticalPathLen = Math.max(...Object.values(bLevels), 0);

    let time = 0;
    const workerAvailableAt = Array(numWorkers).fill(0);
    const runningTasks: { nodeId: string; endTime: number; workerId: number }[] = [];

    let loopSafety = 0;
    const maxIterations = nodes.length * 10;
    let isDeadlocked = false;

    while (unscheduled.size > 0 || runningTasks.length > 0) {
      loopSafety++;
      if (loopSafety > maxIterations) {
        isDeadlocked = true;
        break; // Stop execution loop in case of deadlock/cyclic dependencies
      }

      // 1. Terminate running tasks that complete at or before 'time'
      for (let i = runningTasks.length - 1; i >= 0; i--) {
        const t = runningTasks[i];
        if (t.endTime <= time) {
          completed.add(t.nodeId);
          runningTasks.splice(i, 1);
        }
      }

      // 2. Identify ready tasks whose parents are all completed
      const readyQueue: string[] = [];
      unscheduled.forEach(nodeId => {
        const preds = predecessorsList[nodeId] || [];
        const allPredsDone = preds.every(p => completed.has(p));
        if (allPredsDone) {
          readyQueue.push(nodeId);
        }
      });

      // 3. Sort ready tasks by static b-level priority descending
      readyQueue.sort((a, b) => (bLevels[b] || 0) - (bLevels[a] || 0));

      // 4. Assign tasks greedily to available idle worker lanes
      let taskScheduledThisTick = false;
      for (let w = 0; w < numWorkers; w++) {
        if (workerAvailableAt[w] <= time && readyQueue.length > 0) {
          const nextNodeId = readyQueue.shift()!;
          const node = nodes.find(n => n.id === nextNodeId)!;
          const duration = NODE_LATENCIES[node.type] || 10;
          
          const startTime = time;
          const endTime = time + duration;
          
          workerAvailableAt[w] = endTime;
          unscheduled.delete(nextNodeId);
          
          tasks.push({
            nodeId: nextNodeId,
            label: node.label,
            type: node.type,
            startTime,
            endTime,
            duration,
            workerId: w,
            predecessors: predecessorsList[nextNodeId] || []
          });

          runningTasks.push({
            nodeId: nextNodeId,
            endTime,
            workerId: w
          });
          taskScheduledThisTick = true;
        }
      }

      // 5. Advance simulation clock to the next event time
      if (runningTasks.length > 0) {
        const nextEndTime = Math.min(...runningTasks.map(rt => rt.endTime));
        time = Math.max(time + 1, nextEndTime);
      } else if (!taskScheduledThisTick && unscheduled.size > 0) {
        // Unscheduled nodes exist but no tasks are running and none can be ready
        // (This indicates a cycle in the subgraph that escaped Kahn's validation)
        isDeadlocked = true;
        break;
      } else {
        time++;
      }
    }

    const makespan = tasks.length > 0 ? Math.max(...tasks.map(t => t.endTime)) : 0;

    return {
      tasks,
      makespan,
      serialMakespan,
      criticalPathLen,
      isDeadlocked
    };
  }, [nodes, connections, numWorkers, bLevels]);

  // ==========================================
  // ALGORITHM 3: Amdahl's Law Speedup Benchmarks
  // ==========================================
  // Evaluates scheduled performance under worker scales: 1, 2, 4, 8, and infinite (critical path).
  const benchmarks = useMemo<BenchmarkResult[]>(() => {
    if (nodes.length === 0) return [];

    const sizes = [1, 2, 4, 8];
    const results: BenchmarkResult[] = [];

    // Local scheduler helper that ignores state hook to run benchmark runs
    const runMockScheduler = (k: number): number => {
      const completed = new Set<string>();
      const unscheduled = new Set<string>(nodes.map(n => n.id));
      const predecessorsList: Record<string, string[]> = {};
      
      nodes.forEach(n => { predecessorsList[n.id] = []; });
      connections.forEach(c => {
        if (predecessorsList[c.toNodeId]) {
          predecessorsList[c.toNodeId].push(c.fromNodeId);
        }
      });

      const workerAvailableAt = Array(k).fill(0);
      const runningTasks: { nodeId: string; endTime: number }[] = [];
      let time = 0;
      let loopCap = 0;

      while (unscheduled.size > 0 || runningTasks.length > 0) {
        loopCap++;
        if (loopCap > nodes.length * 10) break;

        for (let i = runningTasks.length - 1; i >= 0; i--) {
          const t = runningTasks[i];
          if (t.endTime <= time) {
            completed.add(t.nodeId);
            runningTasks.splice(i, 1);
          }
        }

        const readyQueue: string[] = [];
        unscheduled.forEach(nodeId => {
          const preds = predecessorsList[nodeId] || [];
          if (preds.every(p => completed.has(p))) {
            readyQueue.push(nodeId);
          }
        });

        readyQueue.sort((a, b) => (bLevels[b] || 0) - (bLevels[a] || 0));

        let taskScheduled = false;
        for (let w = 0; w < k; w++) {
          if (workerAvailableAt[w] <= time && readyQueue.length > 0) {
            const nextNodeId = readyQueue.shift()!;
            const node = nodes.find(n => n.id === nextNodeId)!;
            const duration = NODE_LATENCIES[node.type] || 10;
            const endTime = time + duration;
            
            workerAvailableAt[w] = endTime;
            unscheduled.delete(nextNodeId);
            runningTasks.push({ nodeId: nextNodeId, endTime });
            taskScheduled = true;
          }
        }

        if (runningTasks.length > 0) {
          time = Math.max(time + 1, Math.min(...runningTasks.map(rt => rt.endTime)));
        } else if (!taskScheduled && unscheduled.size > 0) {
          break;
        } else {
          time++;
        }
      }

      return Math.max(...workerAvailableAt, 0);
    };

    const t1 = scheduleData.serialMakespan;
    
    sizes.forEach(k => {
      const tk = runMockScheduler(k);
      const speedup = tk > 0 ? parseFloat((t1 / tk).toFixed(2)) : 0;
      const efficiency = tk > 0 ? parseFloat((t1 / (k * tk) * 100).toFixed(1)) : 0;
      results.push({
        workersCount: k,
        makespan: tk,
        speedup,
        efficiency
      });
    });

    return results;
  }, [nodes, connections, bLevels, scheduleData.serialMakespan]);

  // Dynamic calculations for execution metrics
  const parallelEfficiency = useMemo(() => {
    const t1 = scheduleData.serialMakespan;
    const tk = scheduleData.makespan;
    if (tk === 0 || t1 === 0) return 0;
    // Efficiency = T1 / (K * Tk)
    return Math.round((t1 / (numWorkers * tk)) * 100);
  }, [scheduleData.serialMakespan, scheduleData.makespan, numWorkers]);

  const speedupCoefficient = useMemo(() => {
    const t1 = scheduleData.serialMakespan;
    const tk = scheduleData.makespan;
    if (tk === 0 || t1 === 0) return 0;
    return parseFloat((t1 / tk).toFixed(2));
  }, [scheduleData.serialMakespan, scheduleData.makespan]);

  // Compute parallelizable fraction of work (p) based on critical path
  const parallelizableFraction = useMemo(() => {
    const t1 = scheduleData.serialMakespan;
    const tInf = scheduleData.criticalPathLen;
    if (t1 === 0 || tInf === 0 || t1 === tInf) return 0;
    // p = (T1 - Tinf) / T1
    return parseFloat(((t1 - tInf) / t1).toFixed(2));
  }, [scheduleData.serialMakespan, scheduleData.criticalPathLen]);

  // ==========================================
  // PLAYBACK TICK TIMER EFFECT
  // ==========================================
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTick(prev => {
          const maxTime = scheduleData.makespan;
          if (prev >= maxTime) {
            setIsPlaying(false);
            return maxTime;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, playbackSpeed, scheduleData.makespan]);

  const handleResetPlayback = () => {
    setIsPlaying(false);
    setCurrentTick(0);
  };

  // Render SVG Gantt Chart layout variables
  const ganttLayout = useMemo(() => {
    const svgWidth = 440;
    const laneHeight = 35;
    const headerHeight = 25;
    const paddingX = 40;
    const scrollableWidth = svgWidth - paddingX;

    const makespan = scheduleData.makespan || 10;
    const scaleX = makespan > 0 ? (scrollableWidth - 10) / makespan : 1;

    return {
      svgWidth,
      laneHeight,
      headerHeight,
      paddingX,
      scaleX,
      makespan
    };
  }, [scheduleData.makespan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 left-0 w-[480px] bg-slate-950/95 border-r border-cyber-border/70 backdrop-blur-xl shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out font-sans select-none">
      
      {/* 1. Drawer Header */}
      <div className="p-5 border-b border-cyber-border/40 flex items-center justify-between bg-slate-900/30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-linear-to-tr from-neon-purple to-neon-cyan flex items-center justify-center shadow-md shadow-cyan-500/10">
            <Cpu className="h-4.5 w-4.5 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wider text-white uppercase font-mono">Parallel Execution Profiler</h2>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">Static List Scheduling & Gantt Benchmarks</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Controls Section */}
      <div className="p-4 border-b border-cyber-border/20 bg-slate-900/20 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-neon-cyan" /> WORKER THREAD COUNT
          </span>
          <span className="text-xs font-mono font-bold text-neon-cyan bg-neon-cyan/15 px-2.5 py-0.5 rounded border border-neon-cyan/25">
            {numWorkers} CPU Cores
          </span>
        </div>

        <div className="flex items-center gap-4">
          <input 
            type="range"
            min="1"
            max="8"
            value={numWorkers}
            onChange={(e) => {
              setNumWorkers(Number(e.target.value));
              handleResetPlayback();
            }}
            className="flex-1 accent-neon-cyan cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />
          <div className="flex gap-1.5 shrink-0">
            {[1, 2, 4, 8].map(cores => (
              <button
                key={cores}
                onClick={() => {
                  setNumWorkers(cores);
                  handleResetPlayback();
                }}
                className={`px-2 py-1 text-[9px] font-mono font-bold rounded border cursor-pointer transition-colors ${
                  numWorkers === cores
                    ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {cores}C
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex px-3 border-b border-cyber-border/20 bg-slate-900/10 shrink-0">
        {[
          { id: 'gantt', label: 'Gantt Schedule', icon: List },
          { id: 'speedup', label: 'Amdahl Benchmarks', icon: TrendingUp },
          { id: 'playback', label: 'Step Simulator', icon: Play }
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

      {/* 4. Main Scroll Container */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Deadlock Cycle Warning Banner */}
        {scheduleData.isDeadlocked && (
          <div className="p-3 border border-red-500/20 bg-red-500/5 rounded-lg flex items-start gap-2.5">
            <AlertTriangle className="h-4.5 w-4.5 text-neon-red shrink-0 mt-0.5" />
            <div className="text-[10px] font-mono text-neon-red leading-normal">
              <span className="font-bold uppercase">Scheduling Deadlock: </span>
              A dependency cycle or infinite loop was detected. List scheduling is suspended. Prune cyclic connections on the canvas.
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 1: GANTT CHART SCHEDULE
           ======================================================== */}
        {activeTab === 'gantt' && (
          <div className="space-y-4">
            
            {/* Efficiency Metric Summary */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-3.5 border border-cyber-border/20 bg-slate-900/30 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-slate-500 text-[9px] font-mono font-bold uppercase">
                  <span>Makespan (Tk)</span>
                  <Clock className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <div className="text-xl font-bold font-mono text-neon-cyan">
                  {nodes.length > 0 ? `${scheduleData.makespan} ms` : '--'}
                </div>
                <p className="text-[8px] text-slate-500 font-mono leading-none">Completion duration at {numWorkers} Cores</p>
              </div>

              <div className="p-3.5 border border-cyber-border/20 bg-slate-900/30 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-slate-500 text-[9px] font-mono font-bold uppercase">
                  <span>Speedup Ratio</span>
                  <TrendingUp className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <div className="text-xl font-bold font-mono text-neon-purple">
                  {nodes.length > 0 ? `${speedupCoefficient}x` : '--'}
                </div>
                <p className="text-[8px] text-slate-500 font-mono leading-none">T1 ({scheduleData.serialMakespan}ms) / Tk makespan</p>
              </div>
            </div>

            {/* Core Scheduling SVG Gantt Chart */}
            {nodes.length === 0 ? (
              <div className="p-12 border border-cyber-border/10 bg-slate-900/10 rounded-lg text-center text-[10px] font-mono text-slate-500">
                Workspace empty. Insert canvas nodes to schedule Gantt lanes.
              </div>
            ) : (
              <div className="relative border border-cyber-border/30 bg-slate-950 rounded-xl overflow-hidden shadow-inner p-3">
                <svg 
                  width="100%" 
                  height={ganttLayout.headerHeight + (numWorkers * ganttLayout.laneHeight)}
                  className="overflow-visible"
                >
                  {/* Grid background lines */}
                  {Array.from({ length: 9 }).map((_, idx) => {
                    const timeTick = Math.round((ganttLayout.makespan / 8) * idx);
                    const posX = ganttLayout.paddingX + (timeTick * ganttLayout.scaleX);
                    return (
                      <g key={idx}>
                        <line 
                          x1={posX} 
                          y1="0" 
                          x2={posX} 
                          y2={ganttLayout.headerHeight + (numWorkers * ganttLayout.laneHeight)} 
                          stroke="#1e293b" 
                          strokeWidth="1"
                          strokeDasharray="2, 2"
                        />
                        <text
                          x={posX}
                          y="12"
                          textAnchor="middle"
                          fill="#475569"
                          fontSize="7"
                          fontFamily="monospace"
                        >
                          {timeTick}
                        </text>
                      </g>
                    );
                  })}

                  {/* Lane labels (Worker rows) */}
                  {Array.from({ length: numWorkers }).map((_, wId) => {
                    const posY = ganttLayout.headerHeight + (wId * ganttLayout.laneHeight) + (ganttLayout.laneHeight / 2);
                    return (
                      <text
                        key={wId}
                        x="5"
                        y={posY + 3}
                        fill="#64748b"
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        W0{wId + 1}
                      </text>
                    );
                  })}

                  {/* Draw Scheduled Task Bars */}
                  {scheduleData.tasks.map(task => {
                    const width = task.duration * ganttLayout.scaleX;
                    const posX = ganttLayout.paddingX + (task.startTime * ganttLayout.scaleX);
                    const posY = ganttLayout.headerHeight + (task.workerId * ganttLayout.laneHeight) + 4;
                    const height = ganttLayout.laneHeight - 8;

                    const isHovered = hoveredTaskId === task.nodeId;

                    let barColor = 'rgba(6, 182, 212, 0.2)';
                    let strokeColor = '#06b6d4';
                    
                    if (task.type === 'input') { barColor = 'rgba(6, 182, 212, 0.15)'; strokeColor = '#06b6d4'; }
                    else if (task.type === 'variable') { barColor = 'rgba(139, 92, 246, 0.15)'; strokeColor = '#8b5cf6'; }
                    else if (task.type === 'operator') { barColor = 'rgba(16, 185, 129, 0.15)'; strokeColor = '#10b981'; }
                    else if (task.type === 'conditional') { barColor = 'rgba(245, 158, 11, 0.15)'; strokeColor = '#f59e0b'; }
                    else if (task.type === 'logger') { barColor = 'rgba(236, 72, 153, 0.15)'; strokeColor = '#ec4899'; }

                    if (isHovered) {
                      barColor = strokeColor + '50'; // Increase opacity on hover
                    }

                    return (
                      <g 
                        key={task.nodeId}
                        onMouseEnter={() => setHoveredTaskId(task.nodeId)}
                        onMouseLeave={() => setHoveredTaskId(null)}
                      >
                        {/* Task rectangle block */}
                        <rect
                          x={posX}
                          y={posY}
                          width={width}
                          height={height}
                          rx="4"
                          fill={barColor}
                          stroke={strokeColor}
                          strokeWidth={isHovered ? '2' : '1'}
                          className="transition-all duration-150 cursor-pointer"
                        />
                        {/* Task text label */}
                        {width > 22 && (
                          <text
                            x={posX + (width / 2)}
                            y={posY + (height / 2) + 3}
                            textAnchor="middle"
                            fill="#f8fafc"
                            fontSize="7"
                            fontFamily="monospace"
                            fontWeight="bold"
                            className="pointer-events-none select-none"
                          >
                            {task.label.length > 7 ? `${task.label.substring(0, 6)}.` : task.label}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Draw dependency vector lines on task hover */}
                  {hoveredTaskId && (() => {
                    const task = scheduleData.tasks.find(t => t.nodeId === hoveredTaskId);
                    if (!task) return null;

                    return task.predecessors.map(predId => {
                      const predTask = scheduleData.tasks.find(t => t.nodeId === predId);
                      if (!predTask) return null;

                      // Start coordinate: end of predecessor task bar
                      const startX = ganttLayout.paddingX + (predTask.endTime * ganttLayout.scaleX);
                      const startY = ganttLayout.headerHeight + (predTask.workerId * ganttLayout.laneHeight) + (ganttLayout.laneHeight / 2);

                      // End coordinate: start of hovered task bar
                      const endX = ganttLayout.paddingX + (task.startTime * ganttLayout.scaleX);
                      const endY = ganttLayout.headerHeight + (task.workerId * ganttLayout.laneHeight) + (ganttLayout.laneHeight / 2);

                      return (
                        <g key={predId} className="pointer-events-none">
                          <path
                            d={`M ${startX} ${startY} Q ${(startX + endX) / 2} ${(startY + endY) / 2 - 10}, ${endX} ${endY}`}
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="1.5"
                            strokeDasharray="3, 2"
                          />
                          <circle cx={startX} cy={startY} r="2.5" fill="#f59e0b" />
                          <circle cx={endX} cy={endY} r="2.5" fill="#f59e0b" />
                        </g>
                      );
                    });
                  })()}
                </svg>

                {/* Gantt Task Tooltip */}
                {hoveredTaskId && (() => {
                  const task = scheduleData.tasks.find(t => t.nodeId === hoveredTaskId);
                  if (!task) return null;
                  return (
                    <div className="absolute bottom-2 left-2 right-2 p-2.5 border border-cyber-border/40 bg-slate-950/95 rounded-lg backdrop-blur-md text-[9px] font-mono leading-normal z-20 space-y-0.5">
                      <div className="flex justify-between items-center text-slate-200 border-b border-cyber-border/10 pb-0.5">
                        <span className="font-bold">{task.label}</span>
                        <span className="text-slate-500 uppercase">{task.type}</span>
                      </div>
                      <div className="grid grid-cols-2 text-slate-400 gap-x-2">
                        <div>Start Clock: <span className="text-neon-cyan font-bold">{task.startTime} ms</span></div>
                        <div>End Clock: <span className="text-neon-cyan font-bold">{task.endTime} ms</span></div>
                        <div>Duration: <span className="text-neon-purple font-bold">{task.duration} ms</span></div>
                        <div>Worker Lane: <span className="text-neon-purple font-bold">Worker {task.workerId + 1}</span></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* List Schedule Timeline Text Detail */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">List Schedule Log</span>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-cyber-border/10 rounded-lg p-2 bg-slate-950/40">
                {scheduleData.tasks.length === 0 ? (
                  <div className="text-center text-[9px] font-mono text-slate-600 py-3">No scheduling events available.</div>
                ) : (
                  scheduleData.tasks
                    .sort((a, b) => a.startTime - b.startTime)
                    .map(task => (
                      <div key={task.nodeId} className="flex justify-between items-center text-[9px] font-mono py-1 px-2 hover:bg-slate-900/50 rounded transition-colors">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan"></span>
                          Clock <span className="text-neon-cyan font-bold">{task.startTime}ms</span>: Node &quot;{task.label}&quot; scheduled on W0{task.workerId + 1}
                        </span>
                        <span className="text-slate-500 font-bold">({task.duration}ms duration)</span>
                      </div>
                    ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* ========================================================
            TAB 2: SPEEDUP & AMDAHL'S LAW BENCHMARKS
           ======================================================== */}
        {activeTab === 'speedup' && (
          <div className="space-y-4">
            
            {/* Efficiency metrics overview */}
            <div className="p-4 border border-cyber-border/40 bg-slate-900/20 rounded-xl space-y-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono block leading-none">Parallelization Metrics</span>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <span className="text-[8px] font-mono text-slate-500 uppercase">Worker Core Efficiency</span>
                  <div className="text-2xl font-bold font-mono text-neon-green">{nodes.length > 0 ? `${parallelEfficiency}%` : '--'}</div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] font-mono text-slate-500 uppercase">Parallel Portion (p)</span>
                  <div className="text-2xl font-bold font-mono text-neon-purple">{nodes.length > 0 ? `${Math.round(parallelizableFraction * 100)}%` : '--'}</div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 font-mono leading-relaxed pt-1.5 border-t border-cyber-border/10">
                Amdahl&apos;s Law determines that speedup is limited by the serial part of the logic pipeline. Our current logic contains a parallel fraction of <span className="text-neon-purple font-bold">{Math.round(parallelizableFraction * 100)}%</span>, indicating potential latency reductions under multicore lanes.
              </p>
            </div>

            {/* Core Benchmark Table Comparison */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">Simulation Scaling Sweep</span>
              <div className="border border-cyber-border/20 rounded-lg overflow-hidden bg-slate-950/40">
                <table className="w-full text-left border-collapse text-[9px] font-mono">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-cyber-border/20 text-slate-400">
                      <th className="p-2">Cores</th>
                      <th className="p-2">Makespan</th>
                      <th className="p-2">Speedup</th>
                      <th className="p-2 text-right">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {benchmarks.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-600">No benchmark data.</td>
                      </tr>
                    ) : (
                      benchmarks.map(res => (
                        <tr 
                          key={res.workersCount} 
                          className={`border-b border-cyber-border/10 hover:bg-slate-900/20 transition-colors ${
                            numWorkers === res.workersCount ? 'bg-neon-cyan/5 text-neon-cyan' : 'text-slate-300'
                          }`}
                        >
                          <td className="p-2 font-bold">{res.workersCount} Core(s)</td>
                          <td className="p-2">{res.makespan} ms</td>
                          <td className="p-2 font-bold">{res.speedup}x</td>
                          <td className="p-2 text-right font-bold text-neon-green">{res.efficiency}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Amdahl's Law Speedup Curve SVG Chart */}
            {nodes.length > 0 && (
              <div className="p-4 border border-cyber-border/20 bg-slate-950 rounded-xl space-y-3">
                <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">Theoretical vs Actual Speedup</span>
                
                <div className="h-44 w-full flex items-center justify-center relative">
                  <svg width="100%" height="100%" viewBox="0 0 380 160" className="overflow-visible">
                    {/* SVG axes */}
                    <line x1="30" y1="130" x2="360" y2="130" stroke="#334155" strokeWidth="1" />
                    <line x1="30" y1="10" x2="30" y2="130" stroke="#334155" strokeWidth="1" />
                    
                    {/* Axes Ticks & Labels */}
                    {[1, 2, 4, 8].map((cores, idx) => {
                      const posX = 30 + (idx * 100);
                      return (
                        <g key={cores}>
                          <line x1={posX} y1="130" x2={posX} y2="134" stroke="#475569" strokeWidth="1" />
                          <text x={posX} y="145" textAnchor="middle" fill="#64748b" fontSize="7" fontFamily="monospace">
                            {cores}C
                          </text>
                        </g>
                      );
                    })}

                    {[1, 2, 3, 4].map(val => {
                      const posY = 130 - (val * 28);
                      return (
                        <g key={val}>
                          <line x1="26" y1={posY} x2="30" y2={posY} stroke="#475569" strokeWidth="1" />
                          <text x="18" y={posY + 3} textAnchor="end" fill="#64748b" fontSize="7" fontFamily="monospace">
                            {val}x
                          </text>
                        </g>
                      );
                    })}

                    {/* Amdahl's theoretical curve points (assuming ideal makespan projection) */}
                    {(() => {
                      const p = parallelizableFraction;
                      const points: { x: number; y: number }[] = [1, 2, 4, 8].map((cores, idx) => {
                        const theoreticalSpeedup = 1 / ((1 - p) + (p / cores));
                        const x = 30 + (idx * 100);
                        const y = 130 - (theoreticalSpeedup * 28);
                        return { x, y };
                      });

                      const pathData = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');

                      return (
                        <g>
                          {/* Theoretical line */}
                          <path d={pathData} fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="3,3" />
                          {points.map((pt, i) => (
                            <circle key={i} cx={pt.x} cy={pt.y} r="2.5" fill="#475569" />
                          ))}
                        </g>
                      );
                    })()}

                    {/* Real scheduled curve points */}
                    {(() => {
                      const points = benchmarks.map((res, idx) => {
                        const x = 30 + (idx * 100);
                        const y = 130 - (res.speedup * 28);
                        return { x, y };
                      });

                      const pathData = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');

                      return (
                        <g>
                          {/* Real path */}
                          <path d={pathData} fill="none" stroke="#06b6d4" strokeWidth="2" />
                          {points.map((pt, i) => (
                            <g key={i} className="group cursor-pointer">
                              <circle cx={pt.x} cy={pt.y} r="3.5" fill="#090a0f" stroke="#06b6d4" strokeWidth="2" />
                            </g>
                          ))}
                        </g>
                      );
                    })()}
                  </svg>
                </div>

                <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 px-2 pt-1 border-t border-cyber-border/10">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-3 bg-neon-cyan inline-block rounded-sm"></span>
                    <span>Actual List Speedup</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 border-t border-dashed border-slate-500 inline-block"></span>
                    <span>Theoretical Amdahl Limit</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 3: PLAYBACK SIMULATOR
           ======================================================== */}
        {activeTab === 'playback' && (
          <div className="space-y-4">
            
            {/* Playback simulation controls panel */}
            <div className="p-4 border border-cyber-border/40 bg-slate-900/20 rounded-xl space-y-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono block leading-none">Simulation Timeline Controller</span>
              
              {/* Playback Clock State */}
              <div className="flex justify-between items-baseline">
                <div className="space-y-0.5">
                  <span className="text-[8px] font-mono text-slate-500 uppercase">Clock Counter</span>
                  <div className="text-3xl font-extrabold font-mono text-neon-purple tracking-tighter">
                    {currentTick} / {scheduleData.makespan} <span className="text-xs text-slate-500 font-normal">ms</span>
                  </div>
                </div>
                
                {/* Active running tasks indicator */}
                <div className="text-right space-y-0.5">
                  <span className="text-[8px] font-mono text-slate-500 uppercase">Active Threads Load</span>
                  <div className="text-xs font-mono font-bold text-neon-green">
                    {scheduleData.tasks.filter(t => currentTick >= t.startTime && currentTick < t.endTime).length} Cores Busy
                  </div>
                </div>
              </div>

              {/* Progress Bar timeline */}
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-cyber-border/10">
                <div 
                  className="h-full bg-linear-to-r from-neon-purple to-neon-cyan transition-all duration-150"
                  style={{ width: `${scheduleData.makespan > 0 ? (currentTick / scheduleData.makespan) * 100 : 0}%` }}
                />
              </div>

              {/* Action play buttons */}
              <div className="flex gap-2">
                {isPlaying ? (
                  <button
                    onClick={() => setIsPlaying(false)}
                    className="flex-1 py-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-neon-yellow hover:bg-amber-500/20 transition-all font-mono font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Pause className="h-4.5 w-4.5" /> PAUSE TICKER
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (currentTick >= scheduleData.makespan) {
                        setCurrentTick(0);
                      }
                      setIsPlaying(true);
                    }}
                    disabled={scheduleData.makespan === 0 || scheduleData.isDeadlocked}
                    className="flex-1 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-neon-green hover:bg-emerald-500/20 disabled:opacity-40 disabled:hover:bg-emerald-500/10 transition-all font-mono font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 animate-pulse-glow"
                  >
                    <Play className="h-4.5 w-4.5 fill-emerald-500/15" /> RUN PLAYBACK
                  </button>
                )}
                
                {/* Reset button */}
                <button
                  onClick={handleResetPlayback}
                  disabled={currentTick === 0}
                  className="px-3.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center"
                >
                  <RotateCcw className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Playback Clock speed slider */}
              <div className="space-y-1.5 pt-2 border-t border-cyber-border/10">
                <div className="flex justify-between text-[8px] font-mono text-slate-500">
                  <span>PLAYBACK DISPATCH SPEED</span>
                  <span className="font-bold text-neon-cyan">{playbackSpeed}ms/ms</span>
                </div>
                <input 
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="w-full accent-neon-purple cursor-pointer h-1 bg-slate-800 rounded-lg appearance-none"
                />
              </div>
            </div>

            {/* Processor allocation board showing which node executes in which slot */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">Cores Allocation Matrix</span>
              <div className="space-y-2">
                {Array.from({ length: numWorkers }).map((_, wId) => {
                  // Find task currently executing on worker wId at currentTick
                  const activeTask = scheduleData.tasks.find(t => 
                    t.workerId === wId && 
                    currentTick >= t.startTime && 
                    currentTick < t.endTime
                  );

                  return (
                    <div 
                      key={wId}
                      className={`p-3.5 border rounded-xl flex justify-between items-center transition-colors duration-200 ${
                        activeTask 
                          ? 'border-neon-cyan/20 bg-neon-cyan/5 text-slate-100' 
                          : 'border-slate-900 bg-slate-950/40 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Cpu className={`h-4.5 w-4.5 ${activeTask ? 'text-neon-cyan animate-pulse' : 'text-slate-700'}`} />
                        <span className="text-[10px] font-mono font-bold">Worker Thread 0{wId + 1}</span>
                      </div>
                      <div className="text-right">
                        {activeTask ? (
                          <div className="space-y-0.5">
                            <div className="text-[10px] font-bold font-mono text-neon-cyan">{activeTask.label}</div>
                            <div className="text-[8px] font-mono text-slate-400 uppercase leading-none">
                              {activeTask.type} &bull; {activeTask.endTime - currentTick}ms remaining
                            </div>
                          </div>
                        ) : (
                          <span className="text-[9px] font-mono italic">Thread Idle</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* 5. Bottom footer */}
      <div className="p-4 border-t border-cyber-border/30 bg-slate-950 shrink-0 text-center">
        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1.5">
          <Cpu className="h-3 w-3 text-neon-cyan animate-pulse" />
          SynapseFlow Gantt Scheduler & Profiler v1.0.0
        </span>
      </div>
    </div>
  );
};
