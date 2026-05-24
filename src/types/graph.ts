export type NodeType = 'input' | 'variable' | 'operator' | 'conditional' | 'logger';

export interface Port {
  id: string;
  name: string;
  type: 'number' | 'string' | 'boolean' | 'any';
}

export interface Node {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  inputs: Port[];
  outputs: Port[];
  data: {
    value?: any;          // Used by input / variable nodes
    operator?: string;     // Used by operator (+, -, *, /, >, <, ===)
    logPrefix?: string;    // Used by logger nodes
    [key: string]: any;
  };
}

export interface Connection {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
}

export interface ExecutionLog {
  timestamp: string;
  nodeId: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface ExecutionState {
  currentNodeId: string | null;
  isRunning: boolean;
  isPaused: boolean;
  speed: number; // in ms
  variables: Record<string, any>; // maps 'nodeId-portId' to value
  logs: ExecutionLog[];
  history: string[]; // stack of executed node IDs
}

export interface PresetTemplate {
  name: string;
  description: string;
  nodes: Node[];
  connections: Connection[];
}
