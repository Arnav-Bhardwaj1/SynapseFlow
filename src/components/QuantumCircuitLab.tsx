import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Atom, 
  Play, 
  RotateCcw, 
  Eye, 
  Sparkles, 
  Plus, 
  Trash2, 
  Sliders, 
  Share2
} from 'lucide-react';
import { 
  QuantumCircuitEngine, 
  formatComplex, 
  cAbsSq
} from '../utils/quantumComputeEngine';
import type { 
  QuantumGate, 
  GateType, 
  BlochCoords 
} from '../utils/quantumComputeEngine';
import { useGraph } from '../context/GraphContext';

interface QuantumCircuitLabProps {
  onClose: () => void;
}

type TabType = 'timeline' | 'bloch';

const GATES_PALETTE: { type: GateType; label: string; desc: string }[] = [
  { type: 'H', label: 'H', desc: 'Hadamard Superposition' },
  { type: 'X', label: 'X', desc: 'Pauli-X NOT' },
  { type: 'Z', label: 'Z', desc: 'Pauli-Z Phase Flip' },
  { type: 'S', label: 'S', desc: 'Sqrt-Z Phase' },
  { type: 'CNOT', label: 'CX', desc: 'Controlled-NOT' },
  { type: 'CZ', label: 'CZ', desc: 'Controlled-Z' },
  { type: 'SWAP', label: 'SWAP', desc: 'Swap Qubits' },
];

export const QuantumCircuitLab: React.FC<QuantumCircuitLabProps> = ({ onClose }) => {
  const { addNode } = useGraph();
  const engineRef = useRef<QuantumCircuitEngine>(new QuantumCircuitEngine(3));
  const [, setForceUpdate] = useState(0);
  const triggerReRender = () => setForceUpdate(n => n + 1);

  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [numQubits, setNumQubits] = useState<number>(3);
  const [currentStep, setCurrentStep] = useState<number>(8);
  const [selectedGateType, setSelectedGateType] = useState<GateType>('H');
  const [controlQubitSelection, setControlQubitSelection] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    engineRef.current.setNumQubits(numQubits);
    triggerReRender();
  }, [numQubits]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= 8) {
            setIsPlaying(false);
            return 8;
          }
          return prev + 1;
        });
      }, 600);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const engine = engineRef.current;

  const currentStateVector = useMemo(() => {
    return engine.simulateToStep(currentStep);
  }, [engine, engine.gates, currentStep]);

  const blochCoordsList: BlochCoords[] = useMemo(() => {
    return Array.from({ length: numQubits }).map((_, q) => 
      engine.computeBlochCoords(currentStateVector, q)
    );
  }, [engine, currentStateVector, numQubits]);

  const handleGridCellClick = (qubit: number, step: number) => {
    const existing = engine.gates.find(g => g.qubit === qubit && g.step === step);
    if (existing) {
      engine.removeGate(existing.id);
      triggerReRender();
      return;
    }

    const isMulti = ['CNOT', 'CZ', 'SWAP'].includes(selectedGateType);
    let ctrl: number | undefined;
    if (isMulti) {
      ctrl = controlQubitSelection === qubit ? (qubit + 1) % numQubits : controlQubitSelection;
    }

    const newGate: QuantumGate = {
      id: Math.random().toString(36).substring(2, 9),
      type: selectedGateType,
      qubit,
      step,
      controlQubit: ctrl
    };

    engine.addGate(newGate);
    triggerReRender();
  };

  const handleLoadPreset = (presetKey: 'bell' | 'teleport') => {
    engine.loadPreset(presetKey);
    setNumQubits(engine.numQubits);
    setCurrentStep(8);
    triggerReRender();
  };

  const handleExportToCanvas = () => {
    const sortedSteps = Array.from(new Set(engine.gates.map(g => g.step))).sort((a, b) => a - b);
    let startX = 250;
    let startY = 150;

    addNode('variable', startX, startY);
    sortedSteps.forEach((step, idx) => {
      const stepGates = engine.gates.filter(g => g.step === step);
      stepGates.forEach((_, gIdx) => {
        addNode('custom', startX + (idx + 1) * 220, startY + gIdx * 120);
      });
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col justify-between overflow-hidden text-slate-100 font-sans border border-cyber-border shadow-2xl">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-cyber-border bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-linear-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 text-cyan-400">
            <Atom className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-wide text-transparent bg-clip-text bg-linear-to-r from-cyan-400 via-purple-300 to-pink-400">
              Quantum Circuit Studio (Part 1 of 2)
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              State Vector Simulator & Qubit Matrix Editor
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'timeline'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Circuit Wire Matrix
          </button>
          <button
            onClick={() => setActiveTab('bloch')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'bloch'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Bloch Spheres
          </button>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportToCanvas}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-linear-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white text-xs font-medium shadow-md transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            Export to Canvas
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
          >
            Close Studio
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {activeTab === 'timeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Controls */}
            <div className="lg:col-span-1 space-y-6">
              {/* Qubit Counter */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-400">Qubits:</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setNumQubits(n)}
                        className={`w-7 h-7 rounded-md text-xs font-mono font-bold transition-all ${
                          numQubits === n
                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <label className="text-xs font-mono text-slate-400">Step Scrubber:</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                        isPlaying
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      }`}
                    >
                      {isPlaying ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button
                      onClick={() => { engine.clear(); triggerReRender(); }}
                      className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Gate Palette */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-4">
                <h3 className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Atom className="w-4 h-4 text-cyan-400" />
                  Gates Palette
                </h3>

                <div className="grid grid-cols-4 gap-2">
                  {GATES_PALETTE.map(g => (
                    <button
                      key={g.type}
                      onClick={() => setSelectedGateType(g.type)}
                      title={g.desc}
                      className={`p-2 rounded-xl flex flex-col items-center justify-center border text-xs font-bold font-mono transition-all ${
                        selectedGateType === g.type
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/20 scale-105'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span>{g.label}</span>
                    </button>
                  ))}
                </div>

                {['CNOT', 'CZ', 'SWAP'].includes(selectedGateType) && (
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
                    <label className="text-slate-400 font-mono block mb-1">Control Qubit:</label>
                    <select
                      value={controlQubitSelection}
                      onChange={e => setControlQubitSelection(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                    >
                      {Array.from({ length: numQubits }).map((_, i) => (
                        <option key={i} value={i}>Qubit q[{i}]</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Presets */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                  Presets
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleLoadPreset('bell')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3 h-3" />
                    Bell State
                  </button>
                  <button
                    onClick={() => handleLoadPreset('teleport')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-purple-300 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3 h-3" />
                    Teleportation
                  </button>
                </div>
              </div>
            </div>

            {/* Right Wire Grid */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-x-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 font-mono flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    Quantum Circuit Timeline Grid
                  </h3>
                </div>

                <div className="space-y-6 py-4 min-w-[500px] relative">
                  {Array.from({ length: numQubits }).map((_, qIndex) => (
                    <div key={qIndex} className="flex items-center gap-4 relative">
                      <div className="w-16 font-mono text-xs font-bold text-cyan-400 flex items-center gap-2 shrink-0">
                        <span className="p-1 rounded bg-cyan-950/50 border border-cyan-800/50">|0&gt;</span>
                        <span>q[{qIndex}]</span>
                      </div>

                      <div className="absolute left-20 right-4 top-1/2 -translate-y-1/2 h-[2px] bg-slate-800 -z-0" />

                      <div className="flex-1 grid grid-cols-9 gap-4 relative z-10">
                        {Array.from({ length: 9 }).map((_, sIndex) => {
                          const gate = engine.gates.find(g => g.qubit === qIndex && g.step === sIndex);
                          const isControl = engine.gates.some(g => g.step === sIndex && g.controlQubit === qIndex);

                          return (
                            <button
                              key={sIndex}
                              onClick={() => handleGridCellClick(qIndex, sIndex)}
                              className={`h-12 rounded-xl flex items-center justify-center border font-mono text-xs font-bold transition-all relative group ${
                                gate
                                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20'
                                  : isControl
                                  ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                                  : 'bg-slate-950/80 border-slate-800/80 text-slate-600 hover:border-slate-600'
                              }`}
                            >
                              {gate ? (
                                <span>{gate.type}</span>
                              ) : isControl ? (
                                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                              ) : (
                                <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* State Vector Amplitudes */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  State Vector Amplitudes (|&psi;&gt;)
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {currentStateVector.map((amp, idx) => {
                    const prob = cAbsSq(amp);
                    const bitstring = idx.toString(2).padStart(numQubits, '0');

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border font-mono text-xs space-y-1 transition-all ${
                          prob > 1e-4
                            ? 'bg-slate-900 border-cyan-500/40 shadow-sm'
                            : 'bg-slate-950/40 border-slate-900 text-slate-600'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-cyan-300">|{bitstring}&gt;</span>
                          <span className="text-slate-400">{(prob * 100).toFixed(1)}%</span>
                        </div>

                        <div className="text-slate-400 truncate text-[11px]">
                          c = {formatComplex(amp)}
                        </div>

                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-linear-to-r from-cyan-400 to-purple-500 h-full transition-all duration-300"
                            style={{ width: `${prob * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bloch' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {blochCoordsList.map((coords, qIdx) => (
              <BlochSphereCanvas key={qIdx} qubitIndex={qIdx} coords={coords} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const BlochSphereCanvas: React.FC<{ qubitIndex: number; coords: BlochCoords }> = ({ qubitIndex, coords }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.35;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.6)';
    ctx.stroke();

    const px = cx + (coords.x - coords.y * 0.4) * r;
    const py = cy - coords.z * r + (coords.y * 0.2) * r;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f43f5e';
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('|0>', cx - 8, cy - r - 6);
    ctx.fillText('|1>', cx - 8, cy + r + 14);
  }, [coords]);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col items-center space-y-3">
      <div className="flex justify-between w-full font-mono text-xs">
        <span className="text-cyan-400 font-bold">Qubit q[{qubitIndex}]</span>
        <span className="text-slate-400">
          &theta;: {(coords.theta / Math.PI).toFixed(2)}&pi;
        </span>
      </div>

      <canvas ref={canvasRef} width={260} height={220} className="bg-slate-950/60 rounded-xl border border-slate-800" />

      <div className="grid grid-cols-3 gap-2 w-full font-mono text-[11px] text-center">
        <div className="bg-slate-950 p-1.5 rounded border border-slate-800 text-slate-300">
          X: {coords.x.toFixed(2)}
        </div>
        <div className="bg-slate-950 p-1.5 rounded border border-slate-800 text-slate-300">
          Y: {coords.y.toFixed(2)}
        </div>
        <div className="bg-slate-950 p-1.5 rounded border border-slate-800 text-slate-300">
          Z: {coords.z.toFixed(2)}
        </div>
      </div>
    </div>
  );
};
