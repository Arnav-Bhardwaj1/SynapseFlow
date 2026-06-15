export type NodeType = 'input' | 'variable' | 'operator' | 'conditional' | 'logger' | 'custom';

export interface Port {
  id: string;
  name: string;
  type: 'number' | 'string' | 'boolean' | 'any';
}

export interface CustomNodeTemplate {
  id: string;
  label: string;
  description: string;
  code: string;
  inputs: Port[];
  outputs: Port[];
  color: string;       // Palette gradient classes
  borderColor: string; // Canvas card border classes
  badgeColor: string;  // Label badge classes
  iconName: string;    // Lucide icon name string
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
    customNodeId?: string; // Used by custom nodes to map template
    code?: string;        // Contains custom JS script body
    customColor?: string; // Color config for custom nodes
    customIcon?: string;  // Icon config for custom nodes
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

export interface Assertion {
  id: string;
  nodeId: string;
  portId: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_type';
  expectedValue: string;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  inputs: Record<string, any>; // maps "nodeId-portId" to value
  assertions: Assertion[];
}

export interface AssertionResult {
  assertionId: string;
  passed: boolean;
  actualValue: any;
  message: string;
}

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  assertionResults: AssertionResult[];
  executedNodeIds: string[];
  durationMs: number;
}
