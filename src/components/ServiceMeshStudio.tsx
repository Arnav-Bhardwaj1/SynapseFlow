import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGraph } from '../context/GraphContext';
import {
  Server,
  X,
  Play,
  Pause,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Activity,
  ShieldAlert,
  Code,
  Gauge,
  Network,
  ChevronDown,
  ChevronRight,
  DollarSign
} from 'lucide-react';

import {
  ServiceMeshEngine,
  DEFAULT_SERVICES,
  DEFAULT_ROUTES,
  generateDockerComposeYaml,
  generateKubernetesManifests,
  generateExpressBoilerplate
} from '../utils/serviceMeshEngine';

import type {
  ServiceNodeConfig,
  RouteConfig,
  TrafficRequest,
  ClusterTelemetry
} from '../utils/serviceMeshEngine';

interface ServiceMeshStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServiceMeshStudio: React.FC<ServiceMeshStudioProps> = ({ isOpen, onClose }) => {
  const { addNode, nodes } = useGraph();

  // Active Tab: 'topology' | 'traffic' | 'chaos' | 'telemetry' | 'exporter'
  const [activeTab, setActiveTab] = useState<'topology' | 'traffic' | 'chaos' | 'telemetry' | 'exporter'>('topology');

  // Cluster State
  const [services, setServices] = useState<ServiceNodeConfig[]>(DEFAULT_SERVICES);
  const [routes] = useState<RouteConfig[]>(DEFAULT_ROUTES);

  // Traffic Loop State
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [streamSpeedMs, setStreamSpeedMs] = useState<number>(600);
  const [trafficStream, setTrafficStream] = useState<TrafficRequest[]>([]);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  // Chaos Settings
  const [latencySpikeMs, setLatencySpikeMs] = useState<number>(0);
  const [faultRatePercent, setFaultRatePercent] = useState<number>(0);
  const [networkPartitionActive, setNetworkPartitionActive] = useState<boolean>(false);
  const [crashedServiceId, setCrashedServiceId] = useState<string | null>(null);

  // Code Exporter State
  const [exporterLang, setExporterLang] = useState<'k8s' | 'docker' | 'express'>('k8s');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Engine Instance Ref
  const engineRef = useRef<ServiceMeshEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize engine instance
  useEffect(() => {
    engineRef.current = new ServiceMeshEngine(services, routes);
  }, [services, routes]);

  // Sync Chaos Settings
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.chaos = {
        latencySpikeMs,
        http500FaultRatePercent: faultRatePercent,
        networkPartitionActive,
        crashedServiceId
      };
    }
  }, [latencySpikeMs, faultRatePercent, networkPartitionActive, crashedServiceId]);

  // Traffic Stream Loop Ticker
  useEffect(() => {
    if (!isOpen || !isStreaming) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      if (engineRef.current) {
        const req = engineRef.current.dispatchRequest();
        setTrafficStream(prev => [req, ...prev.slice(0, 49)]);
      }
    }, streamSpeedMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isStreaming, streamSpeedMs]);

  // Telemetry Calculations
  const telemetry = useMemo<ClusterTelemetry>(() => {
    if (!engineRef.current) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        circuitBreakerTrips: 0,
        p95LatencyMs: 0,
        currentRps: 0,
        monthlyCostUsd: 0
      };
    }
    return engineRef.current.getTelemetry();
  }, [trafficStream, services]);

  // Reset Circuit Breakers
  const handleResetCircuits = () => {
    if (engineRef.current) {
      services.forEach(s => engineRef.current?.resetCircuitBreaker(s.id));
      alert('Reset all service circuit breaker states to CLOSED.');
    }
  };

  // Service Replica Update
  const handleUpdateReplicas = (svcId: string, replicas: number) => {
    setServices(prev => prev.map(s => s.id === svcId ? { ...s, replicas: Math.max(1, replicas) } : s));
  };

  // Add Custom Microservice
  const handleAddService = () => {
    const nameStr = prompt('Enter microservice name (e.g. notification-svc):', 'notification-svc');
    if (!nameStr) return;

    const newSvc: ServiceNodeConfig = {
      id: `svc-${Date.now()}`,
      name: nameStr.toLowerCase().replace(/\s+/g, '-'),
      type: 'microservice',
      replicas: 2,
      cpuCores: 1,
      memoryMb: 1024,
      port: 4000 + Math.floor(Math.random() * 900),
      rateLimitRps: 250,
      circuitBreakerThreshold: 4,
      color: '#10b981',
      description: 'Custom microservice workload container'
    };

    setServices(prev => [...prev, newSvc]);
  };

  const handleRemoveService = (id: string) => {
    if (services.length <= 2) {
      alert('Cluster must maintain at least 2 services.');
      return;
    }
    setServices(prev => prev.filter(s => s.id !== id));
  };

  // Bridge Mesh Topology to SynapseFlow Visual Canvas
  const handleBridgeToCanvas = () => {
    const startX = 220 + (nodes.length % 5) * 40;
    const startY = 160 + (nodes.length % 5) * 40;

    // Create Ingress Gateway
    addNode('input', startX, startY);

    // Create Microservice Processing Node
    addNode('custom', startX + 220, startY);

    // Create Output Logger Node
    addNode('logger', startX + 440, startY);

    alert(`Successfully generated Service Mesh Topology Node Pipeline on SynapseFlow Canvas!`);
  };

  // Synthesize Code
  const synthesizedCode = useMemo(() => {
    if (exporterLang === 'k8s') return generateKubernetesManifests(services);
    if (exporterLang === 'docker') return generateDockerComposeYaml(services);
    return generateExpressBoilerplate(services);
  }, [exporterLang, services]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(synthesizedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[640px] bg-slate-950/95 border-l border-cyber-border/80 backdrop-blur-2xl shadow-2xl z-50 flex flex-col transform transition-all duration-300 ease-in-out font-sans select-none">

      {/* 1. Header Bar */}
      <div className="p-5 border-b border-cyber-border/40 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-linear-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 animate-pulse-glow">
            <Server className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wider text-white uppercase font-mono">Service Mesh Studio</h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Kubernetes & RPC Mesh
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">Cloud Microservices Topology, Resiliency & Ingress Compiler</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBridgeToCanvas}
            title="Bridge Mesh Topology to Visual SynapseFlow Canvas"
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

      {/* 2. Top Telemetry Quick Stats */}
      <div className="grid grid-cols-4 border-b border-cyber-border/20 bg-slate-900/20 text-center py-2.5 px-4 font-mono text-[10px]">
        <div className="border-r border-slate-800/60">
          <span className="text-slate-500 block uppercase">Requests</span>
          <span className="text-sm font-bold text-cyan-400">{telemetry.totalRequests}</span>
        </div>
        <div className="border-r border-slate-800/60">
          <span className="text-slate-500 block uppercase">P95 Latency</span>
          <span className="text-sm font-bold text-emerald-400">{telemetry.p95LatencyMs}ms</span>
        </div>
        <div className="border-r border-slate-800/60">
          <span className="text-slate-500 block uppercase">Tripped Circuits</span>
          <span className={`text-sm font-bold ${telemetry.circuitBreakerTrips > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {telemetry.circuitBreakerTrips}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase">Est. Monthly Cost</span>
          <span className="text-sm font-bold text-purple-300">${telemetry.monthlyCostUsd}</span>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex px-3 border-b border-cyber-border/30 bg-slate-900/10 shrink-0">
        {[
          { id: 'topology', label: 'Cluster Topology', icon: Network },
          { id: 'traffic', label: 'Live Traffic', icon: Activity },
          { id: 'chaos', label: 'Chaos Resiliency', icon: ShieldAlert },
          { id: 'telemetry', label: 'Telemetry & Cost', icon: Gauge },
          { id: 'exporter', label: 'K8s / Compose Exporter', icon: Code }
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

      {/* 4. Main Tab Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ========================================================
            TAB 1: CLUSTER TOPOLOGY & SERVICE NODES
           ======================================================== */}
        {activeTab === 'topology' && (
          <div className="space-y-4 font-mono">
            {/* Control Banner */}
            <div className="p-4 border border-cyber-border/40 bg-slate-900/30 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase">Microservice Cluster Topology</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Configure replicas, CPU limits & circuit breaker threshold parameters.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetCircuits}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Reset Circuits
                </button>

                <button
                  onClick={handleAddService}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Service</span>
                </button>
              </div>
            </div>

            {/* Service Node Cards List */}
            <div className="space-y-3">
              {services.map(svc => {
                const cbState = engineRef.current?.circuitStates[svc.id]?.state || 'CLOSED';
                const isCrashed = crashedServiceId === svc.id;

                return (
                  <div
                    key={svc.id}
                    className={`p-4 border rounded-xl space-y-3 transition-all ${
                      isCrashed
                        ? 'bg-rose-950/20 border-rose-500/40'
                        : cbState === 'OPEN'
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-slate-900/30 border-cyber-border/30 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: svc.color }} />
                        <span className="text-xs font-bold text-white">{svc.name}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                          {svc.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Circuit Breaker Badge */}
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          cbState === 'CLOSED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                        }`}>
                          CB: {cbState}
                        </span>

                        <button
                          onClick={() => handleRemoveService(svc.id)}
                          className="p-1 rounded-md text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400">{svc.description}</p>

                    {/* Specification Grid */}
                    <div className="grid grid-cols-4 gap-2 text-[10px]">
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">Replicas</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <button
                            onClick={() => handleUpdateReplicas(svc.id, svc.replicas - 1)}
                            className="px-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-cyan-300 font-bold">{svc.replicas}</span>
                          <button
                            onClick={() => handleUpdateReplicas(svc.id, svc.replicas + 1)}
                            className="px-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">Port</span>
                        <span className="text-slate-200 font-bold">{svc.port}</span>
                      </div>

                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">Rate Limit</span>
                        <span className="text-purple-300 font-bold">{svc.rateLimitRps} RPS</span>
                      </div>

                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">CPU / RAM</span>
                        <span className="text-emerald-400 font-bold">{svc.cpuCores}c / {svc.memoryMb}M</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: LIVE RPC TRAFFIC INSPECTOR
           ======================================================== */}
        {activeTab === 'traffic' && (
          <div className="space-y-4 font-mono">
            {/* Quick Action Toolbar */}
            <div className="p-4 border border-cyber-border/40 bg-slate-900/30 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsStreaming(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    isStreaming
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  }`}
                >
                  {isStreaming ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span>{isStreaming ? 'STREAM ACTIVE' : 'PAUSED'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-400">Dispatch Speed: <strong className="text-cyan-400">{streamSpeedMs}ms</strong></span>
                <input
                  type="range"
                  min="200"
                  max="2000"
                  step="100"
                  value={streamSpeedMs}
                  onChange={(e) => setStreamSpeedMs(Number(e.target.value))}
                  className="w-24 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                />
              </div>
            </div>

            {/* Live Message Stream Grid */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {trafficStream.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
                  <Server className="h-8 w-8 text-slate-600 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-slate-400">Waiting for microservice RPC traffic events...</p>
                </div>
              ) : (
                trafficStream.map(req => {
                  const isExpanded = expandedTraceId === req.traceId;
                  const isError = req.statusCode >= 500;

                  return (
                    <div
                      key={req.traceId}
                      className={`border rounded-xl p-3 transition-all duration-200 font-mono text-xs ${
                        isError
                          ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500'
                          : 'bg-slate-900/40 border-cyber-border/30 hover:border-cyan-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedTraceId(isExpanded ? null : req.traceId)}
                            className="text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>

                          <span className="font-bold text-slate-200">{req.traceId}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 border border-slate-700">
                            {req.sourceName} &rarr; {req.targetName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                            req.statusCode === 200 || req.statusCode === 201 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            HTTP {req.statusCode}
                          </span>

                          <span className="text-[9px] text-slate-400">{req.latencyMs}ms</span>
                        </div>
                      </div>

                      {/* Expanded JSON Inspector */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Route: <strong className="text-cyan-300">{req.method} {req.path}</strong></span>
                            <span>Timestamp: {req.timestamp}</span>
                          </div>

                          <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-emerald-400 overflow-x-auto leading-relaxed">
                            {JSON.stringify(req.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: CHAOS ENGINEERING & RESILIENCY LAB
           ======================================================== */}
        {activeTab === 'chaos' && (
          <div className="space-y-4 font-mono">
            <div className="p-4 border border-rose-500/30 bg-rose-950/10 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-rose-400">
                <ShieldAlert className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase">Chaos Engineering & Fault Injection</h3>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Inject production network failures, pod crashes, latency degradation, and partition blackouts to verify circuit breaker failover logic.
              </p>
            </div>

            {/* Slider 1: Network Latency Spike */}
            <div className="p-4 border border-cyber-border/30 bg-slate-900/30 rounded-xl space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-bold">Network Transit Latency Spike</span>
                <span className="text-cyan-400 font-bold">+{latencySpikeMs}ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="2000"
                step="100"
                value={latencySpikeMs}
                onChange={(e) => setLatencySpikeMs(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
            </div>

            {/* Slider 2: HTTP 500 Fault Rate */}
            <div className="p-4 border border-cyber-border/30 bg-slate-900/30 rounded-xl space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-bold">Synthetic HTTP 500 Fault Injection</span>
                <span className="text-amber-400 font-bold">{faultRatePercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={faultRatePercent}
                onChange={(e) => setFaultRatePercent(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
            </div>

            {/* Network Partition Toggle */}
            <div className="p-4 border border-cyber-border/30 bg-slate-900/30 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-200 font-bold block">Network Partition Blackout</span>
                <span className="text-[10px] text-slate-400">Simulate subnet isolation between API Gateway & Postgres DB.</span>
              </div>

              <button
                onClick={() => setNetworkPartitionActive(prev => !prev)}
                className={`px-3.5 py-1.5 rounded-lg font-mono font-bold transition-all cursor-pointer ${
                  networkPartitionActive
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {networkPartitionActive ? 'PARTITION ACTIVE' : 'NOMINAL'}
              </button>
            </div>

            {/* Pod Crash Selector */}
            <div className="p-4 border border-cyber-border/30 bg-slate-900/30 rounded-xl space-y-2 text-xs">
              <span className="text-slate-200 font-bold block">Simulate Hard Pod Crash</span>
              <select
                value={crashedServiceId || ''}
                onChange={(e) => setCrashedServiceId(e.target.value ? e.target.value : null)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:border-rose-500 focus:outline-none"
              >
                <option value="">No Crashed Pods (Nominal Cluster)</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>Crash: {s.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: TELEMETRY & COST ESTIMATOR
           ======================================================== */}
        {activeTab === 'telemetry' && (
          <div className="space-y-4 font-mono">
            {/* AWS/GCP Cost Breakdown Card */}
            <div className="p-5 border border-purple-500/30 bg-purple-950/10 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300">
                  <DollarSign className="h-5 w-5" />
                  <h3 className="text-xs font-bold uppercase">Estimated Cloud Infrastructure Monthly Bill</h3>
                </div>
                <span className="text-xl font-bold text-purple-300">${telemetry.monthlyCostUsd} / mo</span>
              </div>

              <div className="space-y-2 pt-2 border-t border-purple-500/20 text-xs">
                {services.map(svc => (
                  <div key={svc.id} className="flex justify-between text-slate-400">
                    <span>{svc.name} ({svc.replicas} Replicas)</span>
                    <span className="text-slate-200 font-bold">
                      ${(15 * svc.replicas) + (8 * svc.cpuCores * svc.replicas) + (4 * (svc.memoryMb / 1024) * svc.replicas)} / mo
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cluster Performance Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 border border-cyan-500/30 bg-cyan-950/10 rounded-xl space-y-1">
                <span className="text-[9px] text-cyan-400 uppercase font-bold">Current Ingress Throughput</span>
                <div className="text-2xl font-bold text-cyan-300">{telemetry.currentRps} RPS</div>
                <p className="text-[9px] text-slate-400">Evaluated real-time request intake across cluster.</p>
              </div>

              <div className="p-4 border border-emerald-500/30 bg-emerald-950/10 rounded-xl space-y-1">
                <span className="text-[9px] text-emerald-400 uppercase font-bold">P95 Latency SLA</span>
                <div className="text-2xl font-bold text-emerald-300">{telemetry.p95LatencyMs} ms</div>
                <p className="text-[9px] text-slate-400">P95 transit delay threshold for cluster ingress.</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: INFRASTRUCTURE CODE EXPORTER
           ======================================================== */}
        {activeTab === 'exporter' && (
          <div className="space-y-4 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {(['k8s', 'docker', 'express'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setExporterLang(lang)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold capitalize transition-all cursor-pointer ${
                      exporterLang === lang
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lang === 'k8s' ? 'Kubernetes Manifests' : lang === 'docker' ? 'Docker Compose' : 'Express Proxy'}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all cursor-pointer"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCode ? 'Copied!' : 'Copy YAML'}</span>
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
