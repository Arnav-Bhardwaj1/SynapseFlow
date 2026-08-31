import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGraph } from '../context/GraphContext';
import {
  Brain,
  X,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Layers,
  Activity,
  Grid,
  Code,
  Gauge,
  Sliders
} from 'lucide-react';

import {
  NeuralNetwork,
  generateSyntheticDataset,
  datasetToTensors,
  generatePyTorchCode,
  generateTensorFlowCode,
  generateJSMathCode
} from '../utils/tensorComputeEngine';

import type {
  NetworkConfig,
  ActivationFunction,
  OptimizerType,
  DatasetType,
  DataPoint,
  GradientTraceNode
} from '../utils/tensorComputeEngine';

interface NeuralComputeStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NeuralComputeStudio: React.FC<NeuralComputeStudioProps> = ({ isOpen, onClose }) => {
  const { addNode, nodes } = useGraph();

  // Active Tab: 'workbench' | 'training' | 'boundary' | 'autograd' | 'exporter'
  const [activeTab, setActiveTab] = useState<'workbench' | 'training' | 'boundary' | 'autograd' | 'exporter'>('workbench');

  // Network Configuration State
  const [datasetType, setDatasetType] = useState<DatasetType>('circles');
  const [learningRate, setLearningRate] = useState<number>(0.05);
  const [optimizer, setOptimizer] = useState<OptimizerType>('adam');
  const [l2Reg, setL2Reg] = useState<number>(0.0001);

  const [layersConfig, setLayersConfig] = useState<Array<{ id: string; neurons: number; activation: ActivationFunction }>>([
    { id: 'layer-1', neurons: 6, activation: 'tanh' },
    { id: 'layer-2', neurons: 4, activation: 'tanh' },
    { id: 'layer-out', neurons: 1, activation: 'sigmoid' }
  ]);

  // Training Engine State
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [epochSpeedMs, setEpochSpeedMs] = useState<number>(80);
  const [currentEpoch, setCurrentEpoch] = useState<number>(0);
  const [currentLoss, setCurrentLoss] = useState<number>(0.693);
  const [currentAccuracy, setCurrentAccuracy] = useState<number>(50);

  // History logs for SVG chart
  const [lossHistory, setLossHistory] = useState<number[]>([]);
  const [accuracyHistory, setAccuracyHistory] = useState<number[]>([]);

  // Code synthesis state
  const [exporterLang, setExporterLang] = useState<'pytorch' | 'tensorflow' | 'javascript'>('pytorch');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trainTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Synthetic Dataset Points
  const datasetPoints = useMemo<DataPoint[]>(() => {
    return generateSyntheticDataset(datasetType, 160);
  }, [datasetType]);

  // Neural Network Instance Ref (persisted across re-renders)
  const networkRef = useRef<NeuralNetwork | null>(null);

  // Re-build neural network when topology / dataset changes
  const initNetwork = () => {
    const config: NetworkConfig = {
      inputDim: 2,
      layers: layersConfig,
      learningRate,
      optimizer,
      l2Regularization: l2Reg
    };
    const net = new NeuralNetwork(config);
    networkRef.current = net;
    setCurrentEpoch(0);
    setLossHistory([]);
    setAccuracyHistory([]);

    // Evaluate initial baseline
    const { X, Y } = datasetToTensors(datasetPoints);
    const preds = net.forward(X);
    const { loss } = net.computeLoss(preds, Y);
    setCurrentLoss(parseFloat(loss.toFixed(4)));

    let correct = 0;
    for (let r = 0; r < preds.rows; r++) {
      const predLabel = preds.data[r][0] >= 0.5 ? 1 : 0;
      if (predLabel === Y.data[r][0]) correct++;
    }
    const acc = Math.round((correct / preds.rows) * 100);
    setCurrentAccuracy(acc);
  };

  // Initialize network on mount & topology config updates
  useEffect(() => {
    initNetwork();
  }, [layersConfig, datasetType]);

  // Update hyperparameter settings live
  useEffect(() => {
    if (networkRef.current) {
      networkRef.current.config.learningRate = learningRate;
      networkRef.current.config.optimizer = optimizer;
      networkRef.current.config.l2Regularization = l2Reg;
    }
  }, [learningRate, optimizer, l2Reg]);

  // Single Epoch Training Step execution
  const executeTrainStep = () => {
    if (!networkRef.current) return;
    const { X, Y } = datasetToTensors(datasetPoints);
    const { loss, accuracy } = networkRef.current.trainStep(X, Y);

    setCurrentEpoch(prev => prev + 1);
    const roundLoss = parseFloat(loss.toFixed(4));
    setCurrentLoss(roundLoss);
    setCurrentAccuracy(accuracy);

    setLossHistory(prev => [...prev.slice(-49), roundLoss]);
    setAccuracyHistory(prev => [...prev.slice(-49), accuracy]);
  };

  // Continuous Training Loop Timer
  useEffect(() => {
    if (!isOpen || !isTraining) {
      if (trainTimerRef.current) clearInterval(trainTimerRef.current);
      return;
    }

    trainTimerRef.current = setInterval(() => {
      executeTrainStep();
    }, epochSpeedMs);

    return () => {
      if (trainTimerRef.current) clearInterval(trainTimerRef.current);
    };
  }, [isOpen, isTraining, epochSpeedMs, datasetPoints]);

  // Render 2D Decision Boundary on HTML5 Canvas
  useEffect(() => {
    if (activeTab !== 'boundary' || !canvasRef.current || !networkRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const resolution = 40; // 40x40 grid rendering
    const cellW = width / resolution;
    const cellH = height / resolution;

    // 1. Draw Shaded Decision Regions
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        // Map grid cell to domain [-1.2, 1.2]
        const nx = (i / resolution) * 2.4 - 1.2;
        const ny = (j / resolution) * 2.4 - 1.2;

        const inputTensor = { rows: 1, cols: 2, data: [[nx, ny]], grad: [[0, 0]] };
        const predTensor = networkRef.current.forward(inputTensor as any);
        const probability = predTensor.data[0][0]; // [0, 1]

        // Color interpolate: class 0 (orange #f97316) to class 1 (cyan #06b6d4)
        if (probability >= 0.5) {
          const intensity = Math.min(1, (probability - 0.5) * 2);
          ctx.fillStyle = `rgba(6, 182, 212, ${0.15 + intensity * 0.5})`;
        } else {
          const intensity = Math.min(1, (0.5 - probability) * 2);
          ctx.fillStyle = `rgba(249, 115, 22, ${0.15 + intensity * 0.5})`;
        }
        ctx.fillRect(i * cellW, (resolution - 1 - j) * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // 2. Draw Decision Boundary Contour Line (p = 0.5 threshold)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;

    // 3. Draw Dataset Scatter Points
    datasetPoints.forEach(pt => {
      // Map domain [-1.2, 1.2] to Canvas pixel coordinates
      const px = ((pt.x + 1.2) / 2.4) * width;
      const py = height - ((pt.y + 1.2) / 2.4) * height;

      ctx.beginPath();
      ctx.arc(px, py, pt.label === 1 ? 5 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = pt.label === 1 ? '#06b6d4' : '#f97316';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

  }, [activeTab, currentEpoch, datasetPoints]);

  // Topology Layer Management
  const handleAddLayer = () => {
    if (layersConfig.length >= 5) {
      alert('Maximum layer depth reached (5 layers).');
      return;
    }
    const newId = `layer-${Date.now()}`;
    const newLayers = [...layersConfig];
    // Insert before output layer
    newLayers.splice(newLayers.length - 1, 0, { id: newId, neurons: 4, activation: 'relu' });
    setLayersConfig(newLayers);
  };

  const handleRemoveLayer = (id: string) => {
    if (layersConfig.length <= 2) {
      alert('Network must maintain at least 1 hidden layer and 1 output layer.');
      return;
    }
    setLayersConfig(prev => prev.filter(l => l.id !== id));
  };

  const handleUpdateLayer = (id: string, updates: Partial<{ neurons: number; activation: ActivationFunction }>) => {
    setLayersConfig(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  // Bridge Model to Visual SynapseFlow Canvas Nodes
  const handleBridgeToCanvas = () => {
    const startX = 250 + (nodes.length % 5) * 40;
    const startY = 180 + (nodes.length % 5) * 40;

    // Create Input Node
    addNode('input', startX, startY);

    // Create Neural Process Custom Node
    addNode('custom', startX + 220, startY);

    // Create Output Logger Inspector Node
    addNode('logger', startX + 440, startY);

    alert(`Successfully generated Neural Network AST Node Pipeline on SynapseFlow Canvas!`);
  };

  // Exporter Code Generator Text
  const synthesizedCode = useMemo(() => {
    const config: NetworkConfig = {
      inputDim: 2,
      layers: layersConfig,
      learningRate,
      optimizer,
      l2Regularization: l2Reg
    };
    if (exporterLang === 'pytorch') return generatePyTorchCode(config);
    if (exporterLang === 'tensorflow') return generateTensorFlowCode(config);
    return generateJSMathCode(config);
  }, [exporterLang, layersConfig, learningRate, optimizer, l2Reg]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(synthesizedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Inspect Autograd Gradients
  const gradientTraces = useMemo<GradientTraceNode[]>(() => {
    if (!networkRef.current) return [];
    return networkRef.current.inspectGradients();
  }, [currentEpoch, layersConfig]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[620px] bg-slate-950/95 border-l border-cyber-border/80 backdrop-blur-2xl shadow-2xl z-50 flex flex-col transform transition-all duration-300 ease-in-out font-sans select-none">

      {/* 1. Header Bar */}
      <div className="p-5 border-b border-cyber-border/40 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-linear-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 animate-pulse-glow">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wider text-white uppercase font-mono">Neural Compute Studio</h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Autograd & Tensor Math
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">Deep Learning Computational Graph & Decision Boundary Workbench</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBridgeToCanvas}
            title="Bridge Neural Model to SynapseFlow Visual Canvas"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Bridge Canvas</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. Top Telemetry Stats */}
      <div className="grid grid-cols-4 border-b border-cyber-border/20 bg-slate-900/20 text-center py-2.5 px-4 font-mono text-[10px]">
        <div className="border-r border-slate-800/60">
          <span className="text-slate-500 block uppercase">Epoch</span>
          <span className="text-sm font-bold text-cyan-400">{currentEpoch}</span>
        </div>
        <div className="border-r border-slate-800/60">
          <span className="text-slate-500 block uppercase">Loss (BCE)</span>
          <span className="text-sm font-bold text-rose-400">{currentLoss}</span>
        </div>
        <div className="border-r border-slate-800/60">
          <span className="text-slate-500 block uppercase">Accuracy</span>
          <span className={`text-sm font-bold ${currentAccuracy >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {currentAccuracy}%
          </span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase">Optimizer</span>
          <span className="text-sm font-bold text-purple-300 uppercase">{optimizer}</span>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex px-3 border-b border-cyber-border/30 bg-slate-900/10 shrink-0">
        {[
          { id: 'workbench', label: 'Topology & Weights', icon: Layers },
          { id: 'training', label: 'Training Lab', icon: Activity },
          { id: 'boundary', label: '2D Decision Regions', icon: Grid },
          { id: 'autograd', label: 'Autograd Trace', icon: Gauge },
          { id: 'exporter', label: 'Code Exporter', icon: Code }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1 py-3 text-[10px] font-mono font-bold tracking-wide border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-cyan-400 text-cyan-300 bg-slate-900/30'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/10'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 4. Tab Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ========================================================
            TAB 1: WORKBENCH (TOPOLOGY BUILDER & WEIGHT HEATMAPS)
           ======================================================== */}
        {activeTab === 'workbench' && (
          <div className="space-y-4 font-mono">
            {/* Top Info Banner */}
            <div className="p-4 border border-cyber-border/40 bg-slate-900/30 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase">Neural Architecture Builder</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Define layer dimensions, activation functions & inspect weight matrices live.</p>
              </div>

              <button
                onClick={handleAddLayer}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Layer</span>
              </button>
            </div>

            {/* Layer Topology Stack */}
            <div className="space-y-3">
              {/* Input Layer Display */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                  <span className="font-bold text-slate-200">Input Layer (X1, X2)</span>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">2 Features</span>
              </div>

              {/* Hidden & Output Layers */}
              {layersConfig.map((layer, idx) => {
                const isOutput = idx === layersConfig.length - 1;
                return (
                  <div
                    key={layer.id}
                    className={`p-4 border rounded-xl space-y-3 transition-all ${
                      isOutput ? 'bg-purple-950/20 border-purple-500/40' : 'bg-slate-900/30 border-cyber-border/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {isOutput ? 'Output Layer' : `Hidden Layer ${idx + 1}`}
                        </span>
                        <span className="text-[9px] px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 border border-slate-700">
                          {layer.activation.toUpperCase()}
                        </span>
                      </div>

                      {!isOutput && (
                        <button
                          onClick={() => handleRemoveLayer(layer.id)}
                          className="p-1 rounded-md text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Neuron Units</label>
                        <input
                          type="number"
                          min="1"
                          max="16"
                          value={layer.neurons}
                          disabled={isOutput}
                          onChange={(e) => handleUpdateLayer(layer.id, { neurons: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Activation Function</label>
                        <select
                          value={layer.activation}
                          disabled={isOutput}
                          onChange={(e) => handleUpdateLayer(layer.id, { activation: e.target.value as ActivationFunction })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
                        >
                          <option value="relu">ReLU</option>
                          <option value="tanh">Tanh</option>
                          <option value="sigmoid">Sigmoid</option>
                          <option value="linear">Linear</option>
                        </select>
                      </div>
                    </div>

                    {/* Weight Matrix Heatmap Visualizer */}
                    {networkRef.current && networkRef.current.layers[idx] && (
                      <div className="pt-2 border-t border-slate-800/60 space-y-1">
                        <span className="text-[9px] text-slate-500 block uppercase">
                          Weight Matrix W ({networkRef.current.layers[idx].weights.rows}x{networkRef.current.layers[idx].weights.cols})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {networkRef.current.layers[idx].weights.data.flatMap((row, r) =>
                            row.map((val, c) => {
                              // Color scale: negative = orange, positive = cyan
                              const normVal = Math.max(-1, Math.min(1, val));
                              const bgStyle = normVal >= 0
                                ? `rgba(6, 182, 212, ${Math.abs(normVal) * 0.8 + 0.1})`
                                : `rgba(249, 115, 22, ${Math.abs(normVal) * 0.8 + 0.1})`;

                              return (
                                <div
                                  key={`${r}-${c}`}
                                  title={`W[${r}][${c}] = ${val.toFixed(4)}`}
                                  style={{ backgroundColor: bgStyle }}
                                  className="h-5 w-7 rounded-sm border border-slate-900 flex items-center justify-center text-[8px] text-white font-mono cursor-pointer hover:border-white transition-all"
                                >
                                  {val > 0 ? '+' : ''}{val.toFixed(1)}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: TRAINING LAB (CONTROLLER & LOSS CHART)
           ======================================================== */}
        {activeTab === 'training' && (
          <div className="space-y-5 font-mono">
            {/* Control Bay Toolbar */}
            <div className="p-4 border border-cyber-border/40 bg-slate-900/30 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTraining(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    isTraining
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                  }`}
                >
                  {isTraining ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span>{isTraining ? 'PAUSE TRAINING' : 'START TRAINING'}</span>
                </button>

                <button
                  onClick={executeTrainStep}
                  disabled={isTraining}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  <span>Step Epoch</span>
                </button>

                <button
                  onClick={initNetwork}
                  className="p-1.5 rounded-lg text-slate-400 bg-slate-800/50 hover:text-slate-200 transition-all cursor-pointer"
                  title="Reset Weight Matrices & Epoch Counter"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>

              {/* Speed Slider */}
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-400">Epoch Delay: <strong className="text-cyan-400">{epochSpeedMs}ms</strong></span>
                <input
                  type="range"
                  min="20"
                  max="500"
                  step="20"
                  value={epochSpeedMs}
                  onChange={(e) => setEpochSpeedMs(Number(e.target.value))}
                  className="w-24 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                />
              </div>
            </div>

            {/* Live SVG Loss & Accuracy Curve Plotter */}
            <div className="p-4 border border-cyber-border/40 bg-slate-900/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200 uppercase">Real-Time Optimization Trajectory</span>
                <div className="flex items-center gap-4 text-[10px]">
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="h-2 w-2 rounded-full bg-rose-400 inline-block" /> Loss (BCE)
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Accuracy (%)
                  </span>
                </div>
              </div>

              <div className="h-44 w-full bg-slate-950 border border-slate-800 rounded-xl p-2 relative">
                {lossHistory.length < 2 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                    Press "START TRAINING" to record optimization trajectory...
                  </div>
                ) : (
                  <svg className="w-full h-full overflow-visible">
                    {/* Grid lines */}
                    {[0.25, 0.5, 0.75].map(ratio => (
                      <line
                        key={ratio}
                        x1="0"
                        y1={ratio * 150}
                        x2="100%"
                        y2={ratio * 150}
                        stroke="#1e293b"
                        strokeDasharray="4 4"
                      />
                    ))}

                    {/* Loss Line (Rose) */}
                    <polyline
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="2"
                      points={lossHistory.map((val, idx) => {
                        const x = (idx / (lossHistory.length - 1)) * 520;
                        const y = Math.max(10, Math.min(150, (val / 1.0) * 150));
                        return `${x},${y}`;
                      }).join(' ')}
                    />

                    {/* Accuracy Line (Emerald) */}
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      points={accuracyHistory.map((val, idx) => {
                        const x = (idx / (accuracyHistory.length - 1)) * 520;
                        const y = Math.max(10, Math.min(150, 150 - (val / 100) * 140));
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Hyperparameter Controls */}
            <div className="p-4 border border-cyber-border/30 bg-slate-900/30 rounded-xl space-y-4 text-xs">
              <h3 className="font-bold text-slate-200 uppercase flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-purple-400" />
                Hyperparameter Matrix
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Learning Rate */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Learning Rate (\(\eta\))</span>
                    <span className="text-cyan-400 font-bold">{learningRate}</span>
                  </div>
                  <input
                    type="range"
                    min="0.001"
                    max="0.3"
                    step="0.005"
                    value={learningRate}
                    onChange={(e) => setLearningRate(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                  />
                </div>

                {/* Optimizer Choice */}
                <div className="space-y-1">
                  <span className="text-slate-400 block">Optimizer Engine</span>
                  <select
                    value={optimizer}
                    onChange={(e) => setOptimizer(e.target.value as OptimizerType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="adam">Adam (Adaptive Moments)</option>
                    <option value="sgd">SGD (Stochastic Gradient Descent)</option>
                  </select>
                </div>

                {/* L2 Regularization */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">L2 Weight Decay (\(\lambda\))</span>
                    <span className="text-purple-400 font-bold">{l2Reg}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.01"
                    step="0.0005"
                    value={l2Reg}
                    onChange={(e) => setL2Reg(Number(e.target.value))}
                    className="w-full accent-purple-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                  />
                </div>

                {/* Dataset Choice */}
                <div className="space-y-1">
                  <span className="text-slate-400 block">Synthetic Benchmark Dataset</span>
                  <select
                    value={datasetType}
                    onChange={(e) => setDatasetType(e.target.value as DatasetType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="circles">Concentric Circles</option>
                    <option value="spirals">Two Intertwined Spirals</option>
                    <option value="xor">XOR Non-Linear Problem</option>
                    <option value="moons">Dual Moons</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: 2D DECISION BOUNDARY CANVAS VISUALIZER
           ======================================================== */}
        {activeTab === 'boundary' && (
          <div className="space-y-4 font-mono">
            <div className="p-4 border border-cyber-border/40 bg-slate-900/30 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase">Non-Linear Manifold & Decision Regions</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Real-time classification boundary shaded across 2D feature space (\(x_1, x_2\)).</p>
              </div>

              <select
                value={datasetType}
                onChange={(e) => setDatasetType(e.target.value as DatasetType)}
                className="bg-slate-950 border border-slate-800 text-xs text-cyan-300 rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="circles">Circles</option>
                <option value="spirals">Spirals</option>
                <option value="xor">XOR</option>
                <option value="moons">Moons</option>
              </select>
            </div>

            {/* Canvas Renderer */}
            <div className="flex justify-center bg-slate-950 p-4 border border-slate-800 rounded-2xl relative shadow-inner">
              <canvas
                ref={canvasRef}
                width={380}
                height={380}
                className="rounded-xl border border-slate-800 shadow-2xl"
              />

              {/* Legend overlay */}
              <div className="absolute bottom-6 right-6 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-2.5 rounded-lg text-[9px] space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Class 1 (\(p \ge 0.5\))
                </div>
                <div className="flex items-center gap-1.5 text-orange-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> Class 0 (\(p &lt; 0.5\))
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: AUTOGRAD & GRADIENT FLOW INSPECTOR
           ======================================================== */}
        {activeTab === 'autograd' && (
          <div className="space-y-4 font-mono">
            <div className="p-4 border border-cyber-border/40 bg-slate-900/30 rounded-xl space-y-1">
              <h3 className="text-xs font-bold text-slate-200 uppercase">Backpropagation Gradient Flow Inspector</h3>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Monitors gradient norms (\(\|\nabla W\|\), \(\|\nabla b\|\)) across layers to detect vanishing or exploding gradients during training.
              </p>
            </div>

            <div className="space-y-3">
              {gradientTraces.map(trace => (
                <div
                  key={trace.layerIndex}
                  className="p-4 border border-cyber-border/30 bg-slate-900/40 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{trace.layerName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      trace.status === 'NOMINAL' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      trace.status === 'VANISHING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {trace.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Weight Grad Norm</span>
                      <span className="text-cyan-400 font-bold">{trace.weightGradNorm}</span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Bias Grad Norm</span>
                      <span className="text-purple-400 font-bold">{trace.biasGradNorm}</span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Activation Mean</span>
                      <span className="text-emerald-400 font-bold">{trace.activationMean}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: DEEP LEARNING CODE SYNTHESIZER EXPORTER
           ======================================================== */}
        {activeTab === 'exporter' && (
          <div className="space-y-4 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {(['pytorch', 'tensorflow', 'javascript'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setExporterLang(lang)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold capitalize transition-all cursor-pointer ${
                      exporterLang === lang
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all cursor-pointer"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 overflow-x-auto leading-relaxed max-h-[380px]">
              {synthesizedCode}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
};
