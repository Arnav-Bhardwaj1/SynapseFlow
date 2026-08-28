import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGraph } from '../context/GraphContext';
import { 
  Radio, 
  Activity, 
  ShieldAlert, 
  Database, 
  Send, 
  X, 
  Trash2, 
  Play, 
  Pause, 
  ArrowRight,
  ChevronDown,
  ChevronRight,
  AlertOctagon,
  Gauge
} from 'lucide-react';

interface EventStreamStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface StreamMessage {
  id: string;
  topic: string;
  partition: number;
  key: string;
  timestamp: string;
  payload: Record<string, any>;
  status: 'ACK' | 'PROCESSING' | 'RETRY' | 'DLQ' | 'DROPPED';
  latencyMs: number;
  isPoisonPill?: boolean;
}

export interface TopicConfig {
  id: string;
  name: string;
  partitions: number;
  retentionHours: number;
  color: string;
  description: string;
}

const DEFAULT_TOPICS: TopicConfig[] = [
  {
    id: 'topic-1',
    name: 'user.events',
    partitions: 4,
    retentionHours: 24,
    color: '#06b6d4', // cyan
    description: 'Real-time user telemetry & clickstream payload events'
  },
  {
    id: 'topic-2',
    name: 'payment.transactions',
    partitions: 2,
    retentionHours: 72,
    color: '#10b981', // emerald
    description: 'Financial ledger & transaction authorization stream'
  },
  {
    id: 'topic-3',
    name: 'telemetry.sensors',
    partitions: 8,
    retentionHours: 12,
    color: '#f59e0b', // amber
    description: 'IoT sensor array metrics & environmental signals'
  },
  {
    id: 'topic-4',
    name: 'ai.inference_stream',
    partitions: 3,
    retentionHours: 48,
    color: '#ec4899', // pink
    description: 'Multi-agent prompt tokens & neural inference outputs'
  }
];

export const EventStreamStudio: React.FC<EventStreamStudioProps> = ({ isOpen, onClose }) => {
  const { nodes, updateNodeData } = useGraph();

  // Tab State
  const [activeTab, setActiveTab] = useState<'stream' | 'topics' | 'faults' | 'metrics'>('stream');

  // Streaming Engine State
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [streamSpeedMs, setStreamSpeedMs] = useState<number>(800);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('topic-1');
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fault Injection Settings
  const [latencySpikeMs, setLatencySpikeMs] = useState<number>(0);
  const [packetLossPercent, setPacketLossPercent] = useState<number>(0);
  const [autoPoisonPillRate, setAutoPoisonPillRate] = useState<number>(0);

  // Metrics Accumulators
  const [totalProcessed, setTotalProcessed] = useState<number>(142);
  const [dlqCount, setDlqCount] = useState<number>(3);
  const [droppedCount, setDroppedCount] = useState<number>(0);
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize Sample Stream Messages
  useEffect(() => {
    const initialMsgs: StreamMessage[] = [
      {
        id: 'msg-101',
        topic: 'user.events',
        partition: 0,
        key: 'usr_7721',
        timestamp: new Date(Date.now() - 4000).toLocaleTimeString(),
        payload: { userId: 'usr_7721', action: 'BUTTON_CLICK', target: 'checkout_btn', sessionTimeSec: 342 },
        status: 'ACK',
        latencyMs: 14
      },
      {
        id: 'msg-102',
        topic: 'payment.transactions',
        partition: 1,
        key: 'txn_9012',
        timestamp: new Date(Date.now() - 3200).toLocaleTimeString(),
        payload: { txnId: 'txn_9012', amount: 149.99, currency: 'USD', cardType: 'VISA', status: 'AUTHORIZED' },
        status: 'ACK',
        latencyMs: 22
      },
      {
        id: 'msg-103',
        topic: 'ai.inference_stream',
        partition: 2,
        key: 'prompt_441',
        timestamp: new Date(Date.now() - 2500).toLocaleTimeString(),
        payload: { model: 'gpt-4o', promptTokens: 412, completionTokens: 128, costUsd: 0.0042 },
        status: 'ACK',
        latencyMs: 180
      },
      {
        id: 'msg-104',
        topic: 'telemetry.sensors',
        partition: 5,
        key: 'sensor_alpha_9',
        timestamp: new Date(Date.now() - 1100).toLocaleTimeString(),
        payload: { sensorId: 'SN-904', temperatureC: 68.4, voltage: 12.1, status: 'NOMINAL' },
        status: 'ACK',
        latencyMs: 9
      },
      {
        id: 'msg-105',
        topic: 'user.events',
        partition: 2,
        key: 'usr_8830',
        timestamp: new Date(Date.now() - 400).toLocaleTimeString(),
        payload: { userId: 'usr_8830', action: 'PAGE_VIEW', path: '/dashboard/analytics' },
        status: 'PROCESSING',
        latencyMs: 35
      }
    ];
    setMessages(initialMsgs);
  }, []);

  // Helper Generator for synthetic stream events
  const generateNewMessage = (topicIdName?: string, forcePoison: boolean = false): StreamMessage => {
    const topicObj = DEFAULT_TOPICS.find(t => t.id === selectedTopicId) || DEFAULT_TOPICS[0];
    const topicName = topicIdName || topicObj.name;
    const partition = Math.floor(Math.random() * topicObj.partitions);
    const id = `msg-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowStr = new Date().toLocaleTimeString();

    // Check packet loss simulation
    const isDropped = Math.random() * 100 < packetLossPercent;
    if (isDropped) {
      setDroppedCount(prev => prev + 1);
      return {
        id,
        topic: topicName,
        partition,
        key: `key_${Math.floor(Math.random() * 1000)}`,
        timestamp: nowStr,
        payload: { error: 'PACKET_LOSS_SIMULATED', dropReason: 'Network buffer overflow' },
        status: 'DROPPED',
        latencyMs: 0
      };
    }

    const isPoison = forcePoison || (Math.random() * 100 < autoPoisonPillRate);
    let payload: Record<string, any> = {};
    let status: StreamMessage['status'] = 'ACK';
    const computedLatency = 12 + Math.floor(Math.random() * 40) + latencySpikeMs;

    if (isPoison) {
      status = 'DLQ';
      setDlqCount(prev => prev + 1);
      payload = {
        corruptedPayload: '0xBAD000192F_STACK_OVERFLOW',
        syntaxError: 'Unexpected token at position 0 in JSON response',
        expectedType: 'JSON_SCHEMA_V2',
        poisonPillFlag: true
      };
    } else {
      setTotalProcessed(prev => prev + 1);
      if (topicName.includes('user')) {
        payload = {
          userId: `usr_${Math.floor(1000 + Math.random() * 8000)}`,
          action: ['CLICK', 'SCROLL', 'SEARCH', 'SUBMIT'][Math.floor(Math.random() * 4)],
          sessionTimeSec: Math.floor(Math.random() * 900)
        };
      } else if (topicName.includes('payment')) {
        payload = {
          txnId: `txn_${Math.floor(10000 + Math.random() * 90000)}`,
          amount: parseFloat((Math.random() * 500).toFixed(2)),
          currency: 'USD',
          status: 'SUCCESS'
        };
      } else if (topicName.includes('telemetry')) {
        payload = {
          sensorId: `SN-${Math.floor(100 + Math.random() * 900)}`,
          temperatureC: parseFloat((50 + Math.random() * 30).toFixed(1)),
          voltage: parseFloat((11.5 + Math.random() * 1.5).toFixed(2))
        };
      } else {
        payload = {
          promptId: `prompt_${Math.floor(100 + Math.random() * 900)}`,
          promptTokens: Math.floor(100 + Math.random() * 500),
          completionTokens: Math.floor(50 + Math.random() * 200),
          latencyMs: computedLatency
        };
      }
    }

    return {
      id,
      topic: topicName,
      partition,
      key: `key_${Math.floor(100 + Math.random() * 900)}`,
      timestamp: nowStr,
      payload,
      status,
      latencyMs: computedLatency,
      isPoisonPill: isPoison
    };
  };

  // Real-time Event Stream Loop Ticker
  useEffect(() => {
    if (!isOpen || !isStreaming) {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      return;
    }

    streamTimerRef.current = setInterval(() => {
      const newMsg = generateNewMessage();
      setMessages(prev => [newMsg, ...prev.slice(0, 49)]); // Keep last 50
    }, streamSpeedMs);

    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, [isOpen, isStreaming, streamSpeedMs, selectedTopicId, latencySpikeMs, packetLossPercent, autoPoisonPillRate]);

  // Manual Trigger: Publish Burst of 5 Messages
  const handlePublishBurst = () => {
    const burstMsgs: StreamMessage[] = [];
    for (let i = 0; i < 5; i++) {
      burstMsgs.push(generateNewMessage());
    }
    setMessages(prev => [...burstMsgs, ...prev.slice(0, 45)]);
  };

  // Manual Trigger: Inject Single Poison Pill Event
  const handleInjectPoisonPill = () => {
    const poisonMsg = generateNewMessage(undefined, true);
    setMessages(prev => [poisonMsg, ...prev.slice(0, 49)]);
  };

  // Bridge Stream Payload to Canvas Input Node
  const handleFeedToGraphInput = (msg: StreamMessage) => {
    const inputNode = nodes.find(n => n.type === 'input' || n.type === 'variable');
    if (!inputNode) {
      alert('No Input or Variable node found on canvas! Add an Input node to bridge stream payload.');
      return;
    }
    const valString = typeof msg.payload === 'object' ? JSON.stringify(msg.payload) : String(msg.payload);
    updateNodeData(inputNode.id, { value: valString });
    alert(`Fed stream event payload [${msg.id}] into Canvas node: "${inputNode.label}"`);
  };

  // Clear Stream Buffer Logs
  const handleClearBuffer = () => {
    setMessages([]);
  };

  // Computed Backpressure & Buffer Metrics
  const bufferCapacityPercent = useMemo(() => {
    const activeQueueLength = messages.filter(m => m.status === 'PROCESSING' || m.status === 'RETRY').length;
    return Math.min(100, Math.round((activeQueueLength / 15) * 100 + (latencySpikeMs > 500 ? 40 : 0)));
  }, [messages, latencySpikeMs]);

  // Filtered Message Stream
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      const matchStatus = statusFilter === 'ALL' || msg.status === statusFilter;
      const matchQuery = searchQuery === '' || 
        msg.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        JSON.stringify(msg.payload).toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchQuery;
    });
  }, [messages, statusFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[540px] bg-slate-950/95 border-l border-cyber-border/80 backdrop-blur-2xl shadow-2xl z-50 flex flex-col transform transition-all duration-300 ease-in-out font-sans select-none">
      
      {/* 1. Header Control Bar */}
      <div className="p-5 border-b border-cyber-border/40 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-linear-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 animate-pulse-glow">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wider text-white uppercase font-mono">Stream Studio</h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                Kafka / EventBus Mode
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">Distributed Stream Processing & Backpressure Lab</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Top Quick Telemetry Stats */}
      <div className="grid grid-cols-4 border-b border-cyber-border/20 bg-slate-900/20 text-center py-2.5 px-4 font-mono text-[10px]">
        <div className="border-r border-slate-800/60">
          <span className="text-slate-500 block uppercase">Total Events</span>
          <span className="text-sm font-bold text-cyan-400">{totalProcessed}</span>
        </div>
        <div className="border-r border-slate-800/60">
          <span className="text-slate-500 block uppercase">Backpressure</span>
          <span className={`text-sm font-bold ${bufferCapacityPercent > 70 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
            {bufferCapacityPercent}%
          </span>
        </div>
        <div className="border-r border-slate-800/60">
          <span className="text-slate-500 block uppercase">DLQ Queue</span>
          <span className={`text-sm font-bold ${dlqCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{dlqCount}</span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase">Packet Loss</span>
          <span className="text-sm font-bold text-slate-300">{packetLossPercent}%</span>
        </div>
      </div>

      {/* 3. Sliding Navigation Tabs */}
      <div className="flex px-3 border-b border-cyber-border/30 bg-slate-900/10 shrink-0">
        {[
          { id: 'stream', label: 'Live Stream', icon: Activity },
          { id: 'topics', label: 'Topics & Partitions', icon: Database },
          { id: 'faults', label: 'Fault Injection', icon: ShieldAlert },
          { id: 'metrics', label: 'Backpressure Lab', icon: Gauge }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] font-mono font-bold tracking-wide border-b-2 transition-all cursor-pointer ${
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
            TAB 1: LIVE EVENT STREAM INSPECTOR
           ======================================================== */}
        {activeTab === 'stream' && (
          <div className="space-y-4">

            {/* Quick Action Toolbar */}
            <div className="p-3 border border-cyber-border/40 bg-slate-900/30 rounded-xl flex flex-wrap items-center justify-between gap-3">
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

                <button
                  onClick={handlePublishBurst}
                  title="Inject burst of 5 stream messages"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Publish Burst (+5)</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleInjectPoisonPill}
                  title="Inject malformed poison pill message"
                  className="p-1.5 rounded-lg text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all cursor-pointer"
                >
                  <ShieldAlert className="h-4 w-4" />
                </button>

                <button
                  onClick={handleClearBuffer}
                  title="Clear stream logs buffer"
                  className="p-1.5 rounded-lg text-slate-400 bg-slate-800/50 hover:text-slate-200 transition-all cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Stream Speed Slider */}
            <div className="flex items-center justify-between px-1 font-mono text-[10px]">
              <span className="text-slate-400">Stream Tick Speed: <strong className="text-cyan-400">{streamSpeedMs}ms</strong></span>
              <input 
                type="range" 
                min="200" 
                max="2000" 
                step="100" 
                value={streamSpeedMs} 
                onChange={(e) => setStreamSpeedMs(Number(e.target.value))}
                className="w-32 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
            </div>

            {/* Filter & Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="text"
                  placeholder="Filter payload key, topic or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/80 border border-cyber-border/40 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900/80 border border-cyber-border/40 rounded-lg px-2 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500/60"
              >
                <option value="ALL">All Status</option>
                <option value="ACK">ACK (Delivered)</option>
                <option value="PROCESSING">Processing</option>
                <option value="DLQ">DLQ (Poison Pill)</option>
                <option value="DROPPED">Dropped</option>
              </select>
            </div>

            {/* Live Message Grid Stream */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredMessages.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
                  <Radio className="h-8 w-8 text-slate-600 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-slate-400 font-mono">No stream events in buffer matching filters.</p>
                </div>
              ) : (
                filteredMessages.map(msg => {
                  const isExpanded = expandedMsgId === msg.id;
                  const isDlq = msg.status === 'DLQ';
                  const isDropped = msg.status === 'DROPPED';

                  return (
                    <div 
                      key={msg.id}
                      className={`border rounded-xl p-3 transition-all duration-200 font-mono text-xs ${
                        isDlq 
                          ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500' 
                          : isDropped
                          ? 'bg-slate-900/40 border-slate-800 text-slate-500'
                          : 'bg-slate-900/40 border-cyber-border/30 hover:border-cyan-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setExpandedMsgId(isExpanded ? null : msg.id)}
                            className="text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>

                          <span className="font-bold text-slate-200">{msg.id}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            {msg.topic}
                          </span>
                          <span className="text-[9px] text-slate-500">P{msg.partition}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Status Badge */}
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            msg.status === 'ACK' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            msg.status === 'PROCESSING' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse' :
                            msg.status === 'DLQ' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            'bg-slate-800 text-slate-500'
                          }`}>
                            {msg.status}
                          </span>

                          <span className="text-[9px] text-slate-400">{msg.latencyMs}ms</span>

                          {/* Feed payload to canvas button */}
                          <button
                            onClick={() => handleFeedToGraphInput(msg)}
                            title="Feed payload to Canvas Node Input"
                            className="p-1 rounded-md hover:bg-cyan-500/20 text-cyan-400 transition-colors cursor-pointer"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded JSON Inspector */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Partition Key: <strong className="text-cyan-300">{msg.key}</strong></span>
                            <span>Timestamp: {msg.timestamp}</span>
                          </div>

                          <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-emerald-400 overflow-x-auto leading-relaxed">
                            {JSON.stringify(msg.payload, null, 2)}
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
            TAB 2: TOPICS & PARTITION CONFIGURATION
           ======================================================== */}
        {activeTab === 'topics' && (
          <div className="space-y-4">
            <div className="p-4 border border-cyber-border/40 bg-slate-900/30 rounded-xl space-y-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase font-mono">Stream Topic Cluster Manager</h3>
              <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                Partitioned event streams distribute payload load across parallel worker threads. Select a topic to monitor partition hash distribution.
              </p>
            </div>

            <div className="space-y-3">
              {DEFAULT_TOPICS.map(topic => {
                const isSelected = selectedTopicId === topic.id;
                return (
                  <div
                    key={topic.id}
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={`p-4 border rounded-xl transition-all cursor-pointer space-y-3 ${
                      isSelected 
                        ? 'bg-cyan-950/20 border-cyan-500/60 shadow-lg shadow-cyan-500/10' 
                        : 'bg-slate-900/30 border-cyber-border/30 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: topic.color }}
                        />
                        <span className="text-xs font-bold text-white">{topic.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                        {topic.partitions} Partitions
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 font-mono">{topic.description}</p>

                    {/* Partition Load Balance Visualization */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                        <span>Partition Distribution (Round-Robin Key Hash)</span>
                        <span>Retention: {topic.retentionHours}h</span>
                      </div>

                      <div className="grid grid-cols-8 gap-1.5 pt-1">
                        {Array.from({ length: topic.partitions }).map((_, idx) => (
                          <div 
                            key={idx} 
                            className="h-6 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center text-[9px] font-mono text-cyan-400 font-bold hover:border-cyan-500 transition-colors"
                          >
                            P{idx}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: FAULT INJECTION & RESILIENCY LAB
           ======================================================== */}
        {activeTab === 'faults' && (
          <div className="space-y-4 font-mono">
            <div className="p-4 border border-rose-500/30 bg-rose-950/10 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertOctagon className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase">Chaos & Resiliency Tester</h3>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Simulate production failure scenarios, latency degradation, packet drops, and poison pill payloads to verify graph fallback pipelines.
              </p>
            </div>

            {/* Slider 1: Network Latency Spike */}
            <div className="p-4 border border-cyber-border/30 bg-slate-900/30 rounded-xl space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-bold">Network Latency Spike</span>
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
              <p className="text-[9px] text-slate-500">Adds synthetic network transit delay to evaluated stream consumer handlers.</p>
            </div>

            {/* Slider 2: Packet Loss Probability */}
            <div className="p-4 border border-cyber-border/30 bg-slate-900/30 rounded-xl space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-bold">Packet Drop Rate</span>
                <span className="text-amber-400 font-bold">{packetLossPercent}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="50" 
                step="5" 
                value={packetLossPercent} 
                onChange={(e) => setPacketLossPercent(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
              <p className="text-[9px] text-slate-500">Randomly drops incoming payloads to evaluate stream retry & acknowledgment logic.</p>
            </div>

            {/* Slider 3: Auto Poison Pill Rate */}
            <div className="p-4 border border-cyber-border/30 bg-slate-900/30 rounded-xl space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-bold">Poison Pill Rate (DLQ Routing)</span>
                <span className="text-rose-400 font-bold">{autoPoisonPillRate}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="40" 
                step="5" 
                value={autoPoisonPillRate} 
                onChange={(e) => setAutoPoisonPillRate(Number(e.target.value))}
                className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
              <p className="text-[9px] text-slate-500">Injects corrupt payload schemas automatically into the incoming event pipeline.</p>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: BACKPRESSURE & THROUGHPUT ANALYTICS
           ======================================================== */}
        {activeTab === 'metrics' && (
          <div className="space-y-4 font-mono">
            
            {/* Backpressure Saturation Gauge Card */}
            <div className="p-5 border border-cyber-border/40 bg-slate-900/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase">Stream Consumer Backpressure</span>
                <span className={`text-xs font-bold ${bufferCapacityPercent > 70 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {bufferCapacityPercent}% Capacity
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className={`h-full transition-all duration-500 ${
                    bufferCapacityPercent > 75 ? 'bg-rose-500' :
                    bufferCapacityPercent > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${bufferCapacityPercent}%` }}
                />
              </div>

              <div className="flex justify-between text-[9px] text-slate-500">
                <span>0% (Optimal Intake)</span>
                <span>50% (High Watermark)</span>
                <span>100% (Queue Saturation)</span>
              </div>
            </div>

            {/* DLQ & Failure Counter Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 border border-amber-500/30 bg-amber-950/10 rounded-xl space-y-1">
                <span className="text-[9px] text-amber-400 uppercase font-bold">Dead Letter Queue (DLQ)</span>
                <div className="text-2xl font-bold text-amber-300">{dlqCount} Events</div>
                <p className="text-[9px] text-slate-400">Failed schema authorizations redirected to DLQ inspection.</p>
              </div>

              <div className="p-4 border border-rose-500/30 bg-rose-950/10 rounded-xl space-y-1">
                <span className="text-[9px] text-rose-400 uppercase font-bold">Dropped Messages</span>
                <div className="text-2xl font-bold text-rose-300">{droppedCount} Packets</div>
                <p className="text-[9px] text-slate-400">Simulated network drops during transport bursts.</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
