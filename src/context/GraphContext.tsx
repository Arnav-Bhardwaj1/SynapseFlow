/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { 
  Node, 
  Connection, 
  ExecutionState, 
  ExecutionLog, 
  PresetTemplate, 
  NodeType, 
  Port, 
  CustomNodeTemplate,
  SubgraphTemplate,
  TestCase,
  Assertion,
  TestResult
} from '../types/graph';
import { topologicalSort } from '../utils/graphAlgorithms';

interface GraphContextProps {
  nodes: Node[];
  connections: Connection[];
  executionState: ExecutionState;
  error: string | null;
  customTemplates: CustomNodeTemplate[];
  subgraphTemplates: SubgraphTemplate[];
  presetTemplates: PresetTemplate[];
  testCases: TestCase[];
  lastTestResults: TestResult[] | null;
  addNode: (type: NodeType, x: number, y: number, templateId?: string) => void;
  deleteNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<Node['data']>) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  addConnection: (fromNodeId: string, fromPortId: string, toNodeId: string, toPortId: string) => boolean;
  deleteConnection: (id: string) => void;
  clearGraph: () => void;
  startExecution: () => void;
  pauseExecution: () => void;
  stopExecution: () => void;
  stepExecution: () => void;
  setExecutionSpeed: (speed: number) => void;
  loadPreset: (presetName: string) => void;
  setGraphData: (nodes: Node[], connections: Connection[]) => void;
  setCurrentNodeId: (nodeId: string | null) => void;
  createCustomTemplate: (template: Omit<CustomNodeTemplate, 'id'>) => void;
  deleteCustomTemplate: (id: string) => void;
  createSubgraphTemplate: (template: Omit<SubgraphTemplate, 'id'>) => void;
  deleteSubgraphTemplate: (id: string) => void;
  addTestCase: (name: string, description?: string) => void;
  deleteTestCase: (id: string) => void;
  updateTestCase: (id: string, updates: Partial<TestCase>) => void;
  addAssertion: (testCaseId: string, assertion: Omit<Assertion, 'id'>) => void;
  deleteAssertion: (testCaseId: string, assertionId: string) => void;
  runTestSuite: () => void;
  clearTestResults: () => void;
}

const GraphContext = createContext<GraphContextProps | undefined>(undefined);

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Initial empty execution state
const initialExecutionState: ExecutionState = {
  currentNodeId: null,
  isRunning: false,
  isPaused: false,
  speed: 1000,
  variables: {},
  logs: [],
  history: [],
  stepIndex: 0
};

// Initial preset configurations
const PRESETS: Record<string, PresetTemplate> = {
  fizzbuzz: {
    name: "FizzBuzz Brancher",
    description: "Evaluates standard FizzBuzz branching logic visually based on an input number.",
    nodes: [
      { id: 'in-num', type: 'input', label: 'Input Number (N)', x: 100, y: 250, inputs: [], outputs: [{ id: 'out', name: 'N', type: 'number' }], data: { value: 15 } },
      { id: 'mod3', type: 'operator', label: 'N % 3', x: 300, y: 150, inputs: [{ id: 'a', name: 'Val A', type: 'number' }, { id: 'b', name: 'Val B', type: 'number' }], outputs: [{ id: 'res', name: 'Mod', type: 'number' }], data: { operator: '%' } },
      { id: 'num3', type: 'input', label: 'Const 3', x: 100, y: 80, inputs: [], outputs: [{ id: 'out', name: '3', type: 'number' }], data: { value: 3 } },
      { id: 'mod5', type: 'operator', label: 'N % 5', x: 300, y: 400, inputs: [{ id: 'a', name: 'Val A', type: 'number' }, { id: 'b', name: 'Val B', type: 'number' }], outputs: [{ id: 'res', name: 'Mod', type: 'number' }], data: { operator: '%' } },
      { id: 'num5', type: 'input', label: 'Const 5', x: 100, y: 480, inputs: [], outputs: [{ id: 'out', name: '5', type: 'number' }], data: { value: 5 } },
      { id: 'const0', type: 'input', label: 'Zero', x: 300, y: 20, inputs: [], outputs: [{ id: 'out', name: '0', type: 'number' }], data: { value: 0 } },
      { id: 'is-div3', type: 'operator', label: 'Div 3?', x: 500, y: 100, inputs: [{ id: 'a', name: 'Mod', type: 'number' }, { id: 'b', name: 'Zero', type: 'number' }], outputs: [{ id: 'res', name: 'Bool', type: 'boolean' }], data: { operator: '===' } },
      { id: 'is-div5', type: 'operator', label: 'Div 5?', x: 500, y: 450, inputs: [{ id: 'a', name: 'Mod', type: 'number' }, { id: 'b', name: 'Zero', type: 'number' }], outputs: [{ id: 'res', name: 'Bool', type: 'boolean' }], data: { operator: '===' } },
      { id: 'fizzbuzz-cond', type: 'operator', label: 'Fizz & Buzz?', x: 700, y: 250, inputs: [{ id: 'a', name: 'Div3', type: 'boolean' }, { id: 'b', name: 'Div5', type: 'boolean' }], outputs: [{ id: 'res', name: 'Result', type: 'boolean' }], data: { operator: '&&' } },
      { id: 'log-fizzbuzz', type: 'logger', label: 'FizzBuzz Logger', x: 920, y: 100, inputs: [{ id: 'input_val', name: 'Val', type: 'any' }], outputs: [], data: { logPrefix: '🔥 FIZZBUZZ!' } },
      { id: 'log-div3', type: 'logger', label: 'Fizz Logger', x: 920, y: 250, inputs: [{ id: 'input_val', name: 'Val', type: 'any' }], outputs: [], data: { logPrefix: '✨ FIZZ' } },
      { id: 'log-div5', type: 'logger', label: 'Buzz Logger', x: 920, y: 400, inputs: [{ id: 'input_val', name: 'Val', type: 'any' }], outputs: [], data: { logPrefix: '💥 BUZZ' } }
    ],
    connections: [
      { id: 'c1', fromNodeId: 'in-num', fromPortId: 'out', toNodeId: 'mod3', toPortId: 'a' },
      { id: 'c2', fromNodeId: 'num3', fromPortId: 'out', toNodeId: 'mod3', toPortId: 'b' },
      { id: 'c3', fromNodeId: 'in-num', fromPortId: 'out', toNodeId: 'mod5', toPortId: 'a' },
      { id: 'c4', fromNodeId: 'num5', fromPortId: 'out', toNodeId: 'mod5', toPortId: 'b' },
      { id: 'c5', fromNodeId: 'mod3', fromPortId: 'res', toNodeId: 'is-div3', toPortId: 'a' },
      { id: 'c6', fromNodeId: 'const0', fromPortId: 'out', toNodeId: 'is-div3', toPortId: 'b' },
      { id: 'c7', fromNodeId: 'mod5', fromPortId: 'res', toNodeId: 'is-div5', toPortId: 'a' },
      { id: 'c8', fromNodeId: 'const0', fromPortId: 'out', toNodeId: 'is-div5', toPortId: 'b' },
      { id: 'c9', fromNodeId: 'is-div3', fromPortId: 'res', toNodeId: 'fizzbuzz-cond', toPortId: 'a' },
      { id: 'c10', fromNodeId: 'is-div5', fromPortId: 'res', toNodeId: 'fizzbuzz-cond', toPortId: 'b' },
      { id: 'c11', fromNodeId: 'in-num', fromPortId: 'out', toNodeId: 'log-fizzbuzz', toPortId: 'input_val' },
      { id: 'c12', fromNodeId: 'in-num', fromPortId: 'out', toNodeId: 'log-div3', toPortId: 'input_val' },
      { id: 'c13', fromNodeId: 'in-num', fromPortId: 'out', toNodeId: 'log-div5', toPortId: 'input_val' }
    ]
  },
  arithmetic: {
    name: "Standard Calculator",
    description: "Simple dynamic operations demonstrating connections, operators, and active variables.",
    nodes: [
      { id: 'a', type: 'input', label: 'Input A', x: 100, y: 150, inputs: [], outputs: [{ id: 'out', name: 'Val', type: 'number' }], data: { value: 12 } },
      { id: 'b', type: 'input', label: 'Input B', x: 100, y: 350, inputs: [], outputs: [{ id: 'out', name: 'Val', type: 'number' }], data: { value: 8 } },
      { id: 'op1', type: 'operator', label: 'A + B', x: 350, y: 220, inputs: [{ id: 'a', name: 'Val A', type: 'number' }, { id: 'b', name: 'Val B', type: 'number' }], outputs: [{ id: 'res', name: 'Result', type: 'number' }], data: { operator: '+' } },
      { id: 'log1', type: 'logger', label: 'Output Console', x: 600, y: 220, inputs: [{ id: 'input_val', name: 'Result', type: 'any' }], outputs: [], data: { logPrefix: 'Sum of A & B is:' } }
    ],
    connections: [
      { id: 'c1', fromNodeId: 'a', fromPortId: 'out', toNodeId: 'op1', toPortId: 'a' },
      { id: 'c2', fromNodeId: 'b', fromPortId: 'out', toNodeId: 'op1', toPortId: 'b' },
      { id: 'c3', fromNodeId: 'op1', fromPortId: 'res', toNodeId: 'log1', toPortId: 'input_val' }
    ]
  },
  conditional: {
    name: "Comparison Router",
    description: "Evaluates whether Input A is greater than B and displays different routing outputs.",
    nodes: [
      { id: 'a', type: 'input', label: 'Input A', x: 100, y: 120, inputs: [], outputs: [{ id: 'out', name: 'Val', type: 'number' }], data: { value: 25 } },
      { id: 'b', type: 'input', label: 'Input B', x: 100, y: 320, inputs: [], outputs: [{ id: 'out', name: 'Val', type: 'number' }], data: { value: 30 } },
      { id: 'comp', type: 'operator', label: 'A > B?', x: 320, y: 200, inputs: [{ id: 'a', name: 'A', type: 'number' }, { id: 'b', name: 'B', type: 'number' }], outputs: [{ id: 'res', name: 'Bool', type: 'boolean' }], data: { operator: '>' } },
      { id: 'cond', type: 'conditional', label: 'Branch Router', x: 550, y: 200, inputs: [{ id: 'condition', name: 'Cond', type: 'boolean' }, { id: 'if_true', name: 'True', type: 'any' }, { id: 'if_false', name: 'False', type: 'any' }], outputs: [{ id: 'result', name: 'Val', type: 'any' }], data: {} },
      { id: 'msg-true', type: 'variable', label: 'Msg True', x: 320, y: 50, inputs: [], outputs: [{ id: 'out', name: 'Str', type: 'string' }], data: { value: 'A is larger!' } },
      { id: 'msg-false', type: 'variable', label: 'Msg False', x: 320, y: 400, inputs: [], outputs: [{ id: 'out', name: 'Str', type: 'string' }], data: { value: 'B is larger or equal!' } },
      { id: 'log1', type: 'logger', label: 'Result Display', x: 800, y: 200, inputs: [{ id: 'input_val', name: 'Text', type: 'any' }], outputs: [], data: { logPrefix: 'Decision:' } }
    ],
    connections: [
      { id: 'c1', fromNodeId: 'a', fromPortId: 'out', toNodeId: 'comp', toPortId: 'a' },
      { id: 'c2', fromNodeId: 'b', fromPortId: 'out', toNodeId: 'comp', toPortId: 'b' },
      { id: 'c3', fromNodeId: 'comp', fromPortId: 'res', toNodeId: 'cond', toPortId: 'condition' },
      { id: 'c4', fromNodeId: 'msg-true', fromPortId: 'out', toNodeId: 'cond', toPortId: 'if_true' },
      { id: 'c5', fromNodeId: 'msg-false', fromPortId: 'out', toNodeId: 'cond', toPortId: 'if_false' },
      { id: 'c6', fromNodeId: 'cond', fromPortId: 'result', toNodeId: 'log1', toPortId: 'input_val' }
    ]
  }
};

export const GraphProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nodes, setNodes] = useState<Node[]>(PRESETS.fizzbuzz.nodes);
  const [connections, setConnections] = useState<Connection[]>(PRESETS.fizzbuzz.connections);
  const [executionState, setExecutionState] = useState<ExecutionState>(initialExecutionState);
  const [error, setError] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomNodeTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('synapse_custom_templates');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [subgraphTemplates, setSubgraphTemplates] = useState<SubgraphTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('synapse_subgraph_templates');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [testCases, setTestCases] = useState<TestCase[]>(() => {
    try {
      const stored = localStorage.getItem('synapse_test_cases');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [lastTestResults, setLastTestResults] = useState<TestResult[] | null>(null);

  useEffect(() => {
    localStorage.setItem('synapse_custom_templates', JSON.stringify(customTemplates));
  }, [customTemplates]);

  useEffect(() => {
    localStorage.setItem('synapse_subgraph_templates', JSON.stringify(subgraphTemplates));
  }, [subgraphTemplates]);

  useEffect(() => {
    localStorage.setItem('synapse_test_cases', JSON.stringify(testCases));
  }, [testCases]);

  // References for handling async timeout simulation loops
  const runTimerRef = useRef<any>(null);
  const executionStateRef = useRef<ExecutionState>(executionState);
  const nodesRef = useRef<Node[]>(nodes);
  const connectionsRef = useRef<Connection[]>(connections);

  // Keep refs synchronized
  useEffect(() => { executionStateRef.current = executionState; }, [executionState]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);

  // Clean timer on unmount
  useEffect(() => {
    return () => { if (runTimerRef.current) clearTimeout(runTimerRef.current); };
  }, []);

  // Validate cycles whenever structure changes
  useEffect(() => {
    const { hasCycle } = topologicalSort(nodes, connections);
    if (hasCycle) {
      setError("Cycle detected in logic flow! Please resolve infinite loops to run workflow.");
    } else {
      setError(null);
    }
  }, [nodes, connections]);

  // Node Actions
  const addNode = (type: NodeType, x: number, y: number, templateId?: string) => {
    const id = `${type}-${generateId()}`;
    let inputs: Port[] = [];
    let outputs: Port[] = [];
    let label = '';
    let data: Node['data'] = {};

    switch (type) {
      case 'input':
        label = 'Input Source';
        outputs = [{ id: 'out', name: 'Val', type: 'number' }];
        data = { value: 10 };
        break;
      case 'variable':
        label = 'String Literal';
        outputs = [{ id: 'out', name: 'Str', type: 'string' }];
        data = { value: 'Synapse' };
        break;
      case 'operator':
        label = 'Math Operator';
        inputs = [
          { id: 'a', name: 'Val A', type: 'number' },
          { id: 'b', name: 'Val B', type: 'number' }
        ];
        outputs = [{ id: 'res', name: 'Result', type: 'number' }];
        data = { operator: '+' };
        break;
      case 'conditional':
        label = 'Logical Branch';
        inputs = [
          { id: 'condition', name: 'Cond', type: 'boolean' },
          { id: 'if_true', name: 'True', type: 'any' },
          { id: 'if_false', name: 'False', type: 'any' }
        ];
        outputs = [{ id: 'result', name: 'Result', type: 'any' }];
        break;
      case 'logger':
        label = 'Terminal Logger';
        inputs = [{ id: 'input_val', name: 'Log Value', type: 'any' }];
        data = { logPrefix: 'Printed Output:' };
        break;
      case 'custom': {
        const tmpl = customTemplates.find(t => t.id === templateId);
        if (tmpl) {
          label = tmpl.label;
          inputs = tmpl.inputs.map(p => ({ ...p }));
          outputs = tmpl.outputs.map(p => ({ ...p }));
          data = {
            customNodeId: tmpl.id,
            code: tmpl.code,
            customColor: tmpl.color,
            customIcon: tmpl.iconName
          };
        } else {
          label = 'Custom Block';
          outputs = [{ id: 'out', name: 'out', type: 'any' }];
          data = { code: 'outputs.set("out", 0);' };
        }
        break;
      }
      case 'subgraph': {
        const tmpl = subgraphTemplates.find(t => t.id === templateId);
        if (tmpl) {
          label = tmpl.label;
          inputs = tmpl.inputs.map(p => ({ ...p }));
          outputs = tmpl.outputs.map(p => ({ ...p }));
          data = {
            subgraphTemplateId: tmpl.id,
            subgraphNodes: JSON.parse(JSON.stringify(tmpl.nodes)),
            subgraphConnections: JSON.parse(JSON.stringify(tmpl.connections)),
            customColor: tmpl.color,
            customIcon: tmpl.iconName
          };
        } else {
          label = 'Subgraph Macro';
          inputs = [{ id: 'in1', name: 'In', type: 'number' }];
          outputs = [{ id: 'out1', name: 'Out', type: 'number' }];
          data = {
            subgraphNodes: [],
            subgraphConnections: []
          };
        }
        break;
      }
    }

    const newNode: Node = { id, type, label, x, y, inputs, outputs, data };
    setNodes(prev => [...prev, newNode]);
  };

  const deleteNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.fromNodeId !== id && c.toNodeId !== id));
    if (executionState.currentNodeId === id) {
      stopExecution();
    }
  };

  const updateNodeData = (id: string, updatedData: Partial<Node['data']> & { label?: string }) => {
    setNodes(prev => prev.map(node => {
      if (node.id === id) {
        const newLabel = updatedData.label !== undefined ? updatedData.label : node.label;
        const { label: _ignored, ...cleanData } = updatedData;
        return {
          ...node,
          label: newLabel,
          data: { ...node.data, ...cleanData }
        };
      }
      return node;
    }));
  };

  const updateNodePosition = (id: string, x: number, y: number) => {
    setNodes(prev => prev.map(node => {
      if (node.id === id) {
        return { ...node, x, y };
      }
      return node;
    }));
  };

  // Connection Actions
  const addConnection = (fromNodeId: string, fromPortId: string, toNodeId: string, toPortId: string): boolean => {
    // 1. Prevent duplicate connections to the same input port
    const existing = connections.find(c => c.toNodeId === toNodeId && c.toPortId === toPortId);
    if (existing) return false;

    // 2. Prevent connecting a node to itself
    if (fromNodeId === toNodeId) return false;

    const newConn: Connection = {
      id: `conn-${generateId()}`,
      fromNodeId,
      fromPortId,
      toNodeId,
      toPortId
    };

    const nextConns = [...connections, newConn];
    const { hasCycle } = topologicalSort(nodes, nextConns);

    if (hasCycle) {
      setError("Cannot add connection: creates an infinite cycle.");
      return false;
    }

    setConnections(nextConns);
    return true;
  };

  const deleteConnection = (id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
  };

  const clearGraph = () => {
    stopExecution();
    setNodes([]);
    setConnections([]);
    setError(null);
  };

  // Preset loader
  const loadPreset = (presetName: string) => {
    const preset = PRESETS[presetName];
    if (preset) {
      stopExecution();
      setNodes(preset.nodes);
      setConnections(preset.connections);
      setError(null);
    }
  };

  const setGraphData = (newNodes: Node[], newConnections: Connection[]) => {
    stopExecution();
    setNodes(newNodes);
    setConnections(newConnections);
    setError(null);
  };

  // Core Simulation Interpreter Step Evaluator
  const executeNodeStep = (nodeId: string, vars: Record<string, any>): { evaluatedVars: Record<string, any>; log: ExecutionLog | null } => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    const updatedVars = { ...vars };
    let logEntry: ExecutionLog | null = null;

    if (!node) return { evaluatedVars: updatedVars, log: null };

    // Function to retrieve dynamic values entering this node
    const getInputValue = (portId: string, fallback: any = null): any => {
      const conn = connectionsRef.current.find(c => c.toNodeId === nodeId && c.toPortId === portId);
      if (conn) {
        const val = updatedVars[`${conn.fromNodeId}-${conn.fromPortId}`];
        return val !== undefined ? val : fallback;
      }
      return fallback;
    };

    switch (node.type) {
      case 'input':
      case 'variable': {
        const val = node.data.value !== undefined ? node.data.value : 0;
        const outPort = node.outputs[0]?.id;
        if (outPort) {
          updatedVars[`${node.id}-${outPort}`] = val;
        }
        logEntry = {
          timestamp: new Date().toLocaleTimeString(),
          nodeId: node.id,
          message: `Read variable '${node.label}': ${JSON.stringify(val)}`,
          type: 'info'
        };
        break;
      }

      case 'operator': {
        const valA = getInputValue('a', 0);
        const valB = getInputValue('b', 0);
        const op = node.data.operator || '+';
        let result: any = 0;

        try {
          switch (op) {
            case '+': result = Number(valA) + Number(valB); break;
            case '-': result = Number(valA) - Number(valB); break;
            case '*': result = Number(valA) * Number(valB); break;
            case '/': result = Number(valB) !== 0 ? Number(valA) / Number(valB) : 0; break;
            case '%': result = Number(valA) % Number(valB); break;
            case '>': result = valA > valB; break;
            case '<': result = valA < valB; break;
            case '===': result = valA === valB; break;
            case '&&': result = Boolean(valA) && Boolean(valB); break;
            case '||': result = Boolean(valA) || Boolean(valB); break;
            default: result = valA + valB;
          }
        } catch (e) {
          result = 0;
        }

        const outPort = node.outputs[0]?.id;
        if (outPort) {
          updatedVars[`${node.id}-${outPort}`] = result;
        }

        logEntry = {
          timestamp: new Date().toLocaleTimeString(),
          nodeId: node.id,
          message: `Evaluated ${node.label}: ${valA} ${op} ${valB} = ${JSON.stringify(result)}`,
          type: 'success'
        };
        break;
      }

      case 'conditional': {
        const cond = getInputValue('condition', false);
        const ifTrue = getInputValue('if_true', null);
        const ifFalse = getInputValue('if_false', null);
        const result = cond ? ifTrue : ifFalse;

        const outPort = node.outputs[0]?.id; // 'result' port
        if (outPort) {
          updatedVars[`${node.id}-${outPort}`] = result;
        }

        logEntry = {
          timestamp: new Date().toLocaleTimeString(),
          nodeId: node.id,
          message: `Branching condition evaluated to ${Boolean(cond)}. Outputting: ${JSON.stringify(result)}`,
          type: 'info'
        };
        break;
      }

      case 'logger': {
        const prefix = node.data.logPrefix || 'Output:';
        const val = getInputValue('input_val', 'undefined');

        logEntry = {
          timestamp: new Date().toLocaleTimeString(),
          nodeId: node.id,
          message: `📟 ${prefix} ${JSON.stringify(val)}`,
          type: 'success'
        };
        break;
      }

      case 'custom': {
        const inputsObj: Record<string, any> = {};
        node.inputs.forEach(p => {
          inputsObj[p.id] = getInputValue(p.id, null);
        });

        const outputsMap = new Map<string, any>();
        const outputsObj = {
          set: (portId: string, value: any) => {
            outputsMap.set(portId, value);
          }
        };

        const codeStr = node.data.code || '';
        let execError: string | null = null;

        try {
          const runScript = new Function('inputs', 'outputs', codeStr);
          runScript(inputsObj, outputsObj);

          node.outputs.forEach(p => {
            const outVal = outputsMap.get(p.id);
            updatedVars[`${node.id}-${p.id}`] = outVal !== undefined ? outVal : null;
          });
        } catch (err: any) {
          execError = err.message || String(err);
          node.outputs.forEach(p => {
            updatedVars[`${node.id}-${p.id}`] = null;
          });
        }

        if (execError) {
          logEntry = {
            timestamp: new Date().toLocaleTimeString(),
            nodeId: node.id,
            message: `❌ Custom block "${node.label}" execution error: ${execError}`,
            type: 'error'
          };
        } else {
          const outputsJson = JSON.stringify(Object.fromEntries(outputsMap));
          logEntry = {
            timestamp: new Date().toLocaleTimeString(),
            nodeId: node.id,
            message: `🛠️ Evaluated custom block "${node.label}" successfully. Outputs: ${outputsJson}`,
            type: 'success'
          };
        }
        break;
      }

      case 'subgraph': {
        const subNodes: Node[] = (node.data.subgraphNodes as Node[]) || [];
        const subConns: Connection[] = (node.data.subgraphConnections as Connection[]) || [];
        let execError: string | null = null;

        if (subNodes.length === 0) {
          node.outputs.forEach(p => {
            updatedVars[`${node.id}-${p.id}`] = null;
          });
        } else {
          try {
            const { order: subOrder } = topologicalSort(subNodes, subConns);
            const subVars: Record<string, any> = {};

            // Map inputs into subNodes
            node.inputs.forEach((p, idx) => {
              const inputVal = getInputValue(p.id, null);
              const targetInputNode = subNodes.find(sn => (sn.type === 'input' || sn.type === 'variable') && (sn.id === p.id || sn.label.toLowerCase().includes(p.name.toLowerCase())));
              if (targetInputNode) {
                const outPort = targetInputNode.outputs[0]?.id || 'out';
                subVars[`${targetInputNode.id}-${outPort}`] = inputVal;
              } else if (subNodes[idx]) {
                const outPort = subNodes[idx].outputs[0]?.id || 'out';
                subVars[`${subNodes[idx].id}-${outPort}`] = inputVal;
              }
            });

            subOrder.forEach(sId => {
              const sNode = subNodes.find(n => n.id === sId);
              if (!sNode) return;

              const getSubInputValue = (portId: string, fallback: any = null) => {
                const conn = subConns.find(c => c.toNodeId === sId && c.toPortId === portId);
                if (conn) {
                  const val = subVars[`${conn.fromNodeId}-${conn.fromPortId}`];
                  return val !== undefined ? val : fallback;
                }
                return fallback;
              };

              if (sNode.type === 'input' || sNode.type === 'variable') {
                const outPort = sNode.outputs[0]?.id;
                if (outPort && subVars[`${sNode.id}-${outPort}`] === undefined) {
                  subVars[`${sNode.id}-${outPort}`] = sNode.data.value !== undefined ? sNode.data.value : 0;
                }
              } else if (sNode.type === 'operator') {
                const valA = getSubInputValue('a', 0);
                const valB = getSubInputValue('b', 0);
                const op = sNode.data.operator || '+';
                let res: any = 0;
                switch (op) {
                  case '+': res = Number(valA) + Number(valB); break;
                  case '-': res = Number(valA) - Number(valB); break;
                  case '*': res = Number(valA) * Number(valB); break;
                  case '/': res = Number(valB) !== 0 ? Number(valA) / Number(valB) : 0; break;
                  case '%': res = Number(valA) % Number(valB); break;
                  case '>': res = valA > valB; break;
                  case '<': res = valA < valB; break;
                  case '===': res = valA === valB; break;
                  case '&&': res = Boolean(valA) && Boolean(valB); break;
                  case '||': res = Boolean(valA) || Boolean(valB); break;
                  default: res = valA + valB;
                }
                const outPort = sNode.outputs[0]?.id;
                if (outPort) subVars[`${sNode.id}-${outPort}`] = res;
              } else if (sNode.type === 'conditional') {
                const cond = getSubInputValue('condition', false);
                const ifTrue = getSubInputValue('if_true', null);
                const ifFalse = getSubInputValue('if_false', null);
                const res = cond ? ifTrue : ifFalse;
                const outPort = sNode.outputs[0]?.id;
                if (outPort) subVars[`${sNode.id}-${outPort}`] = res;
              }
            });

            node.outputs.forEach((p, idx) => {
              const lastNode = subNodes[subNodes.length - 1 - idx] || subNodes[subNodes.length - 1];
              if (lastNode) {
                const outPort = lastNode.outputs[0]?.id || 'res';
                updatedVars[`${node.id}-${p.id}`] = subVars[`${lastNode.id}-${outPort}`] !== undefined ? subVars[`${lastNode.id}-${outPort}`] : null;
              }
            });
          } catch (err: any) {
            execError = err.message || String(err);
          }
        }

        if (execError) {
          logEntry = {
            timestamp: new Date().toLocaleTimeString(),
            nodeId: node.id,
            message: `❌ Subgraph "${node.label}" execution error: ${execError}`,
            type: 'error'
          };
        } else {
          logEntry = {
            timestamp: new Date().toLocaleTimeString(),
            nodeId: node.id,
            message: `🧩 Evaluated Subgraph macro "${node.label}" successfully.`,
            type: 'success'
          };
        }
        break;
      }
    }

    return { evaluatedVars: updatedVars, log: logEntry };
  };

  // Action Controllers
  const startExecution = () => {
    const { order, hasCycle } = topologicalSort(nodes, connections);
    if (hasCycle || nodes.length === 0) return;

    if (runTimerRef.current) clearTimeout(runTimerRef.current);

    setExecutionState({
      currentNodeId: null,
      isRunning: true,
      isPaused: false,
      speed: executionState.speed,
      variables: {},
      logs: [{
        timestamp: new Date().toLocaleTimeString(),
        nodeId: 'system',
        message: '🚀 Starting Visual Execution Workflow...',
        type: 'info'
      }],
      history: order,
      stepIndex: 0
    });

    // Start evaluation loop
    setTimeout(() => runNextStep(), 50);
  };

  const runNextStep = () => {
    const state = executionStateRef.current;
    if (!state.isRunning || state.isPaused) return;

    const history = state.history;
    const stepIndex = state.stepIndex;

    // Completed execution
    if (stepIndex >= history.length) {
      setExecutionState(prev => ({
        ...prev,
        currentNodeId: null,
        isRunning: false,
        logs: [
          ...prev.logs,
          {
            timestamp: new Date().toLocaleTimeString(),
            nodeId: 'system',
            message: '🏁 Visual workflow execution successfully completed.',
            type: 'info'
          }
        ]
      }));
      return;
    }

    const nextNodeId = history[stepIndex];
    const { evaluatedVars, log } = executeNodeStep(nextNodeId, state.variables);

    setExecutionState(prev => ({
      ...prev,
      currentNodeId: nextNodeId,
      variables: evaluatedVars,
      logs: log ? [...prev.logs, log] : prev.logs,
      stepIndex: prev.stepIndex + 1
    }));

    // Queue next iteration based on speed
    runTimerRef.current = setTimeout(() => {
      runNextStep();
    }, executionStateRef.current.speed);
  };

  const pauseExecution = () => {
    if (runTimerRef.current) clearTimeout(runTimerRef.current);
    setExecutionState(prev => ({ ...prev, isPaused: true }));
  };

  const stopExecution = () => {
    if (runTimerRef.current) clearTimeout(runTimerRef.current);
    setExecutionState(initialExecutionState);
  };

  const stepExecution = () => {
    const state = executionStateRef.current;
    
    // If not running, initialize it
    if (!state.isRunning) {
      const { order, hasCycle } = topologicalSort(nodes, connections);
      if (hasCycle || nodes.length === 0) return;

      const firstNodeId = order[0];
      const { evaluatedVars, log } = executeNodeStep(firstNodeId, {});

      setExecutionState({
        currentNodeId: firstNodeId,
        isRunning: true,
        isPaused: true,
        speed: state.speed,
        variables: evaluatedVars,
        logs: [
          { timestamp: new Date().toLocaleTimeString(), nodeId: 'system', message: '👣 Commencing Step-by-Step execution...', type: 'info' },
          ...(log ? [log] : [])
        ],
        history: order,
        stepIndex: 1
      });
      return;
    }

    // Otherwise, advance one step
    const history = state.history;
    const stepIndex = state.stepIndex;

    if (stepIndex >= history.length) {
      setExecutionState(prev => ({
        ...prev,
        currentNodeId: null,
        isRunning: false,
        logs: [...prev.logs, { timestamp: new Date().toLocaleTimeString(), nodeId: 'system', message: '🏁 Visual execution complete.', type: 'info' }]
      }));
      return;
    }

    const nextNodeId = history[stepIndex];
    const { evaluatedVars, log } = executeNodeStep(nextNodeId, state.variables);

    setExecutionState(prev => ({
      ...prev,
      currentNodeId: nextNodeId,
      variables: evaluatedVars,
      logs: log ? [...prev.logs, log] : prev.logs,
      stepIndex: prev.stepIndex + 1
    }));
  };

  const setExecutionSpeed = (speed: number) => {
    setExecutionState(prev => ({ ...prev, speed }));
  };

  const setCurrentNodeId = (nodeId: string | null) => {
    setExecutionState(prev => ({ ...prev, currentNodeId: nodeId }));
  };

  const createCustomTemplate = (template: Omit<CustomNodeTemplate, 'id'>) => {
    const newTmpl: CustomNodeTemplate = {
      ...template,
      id: `tmpl-${generateId()}`
    };
    setCustomTemplates(prev => [...prev, newTmpl]);
  };

  const deleteCustomTemplate = (id: string) => {
    setCustomTemplates(prev => prev.filter(t => t.id !== id));
    const remainingNodes = nodesRef.current.filter(n => n.data.customNodeId !== id);
    const remainingNodeIds = new Set(remainingNodes.map(n => n.id));
    setNodes(remainingNodes);
    setConnections(prev => prev.filter(c => remainingNodeIds.has(c.fromNodeId) && remainingNodeIds.has(c.toNodeId)));
  };

  const createSubgraphTemplate = (template: Omit<SubgraphTemplate, 'id'>) => {
    const newTmpl: SubgraphTemplate = {
      ...template,
      id: `subtmpl-${generateId()}`
    };
    setSubgraphTemplates(prev => [...prev, newTmpl]);
  };

  const deleteSubgraphTemplate = (id: string) => {
    setSubgraphTemplates(prev => prev.filter(t => t.id !== id));
    const remainingNodes = nodesRef.current.filter(n => n.data.subgraphTemplateId !== id);
    const remainingNodeIds = new Set(remainingNodes.map(n => n.id));
    setNodes(remainingNodes);
    setConnections(prev => prev.filter(c => remainingNodeIds.has(c.fromNodeId) && remainingNodeIds.has(c.toNodeId)));
  };

  const addTestCase = (name: string, description: string = '') => {
    const newCase: TestCase = {
      id: `test-${generateId()}`,
      name,
      description,
      inputs: {},
      assertions: []
    };
    setTestCases(prev => [...prev, newCase]);
  };

  const deleteTestCase = (id: string) => {
    setTestCases(prev => prev.filter(c => c.id !== id));
  };

  const updateTestCase = (id: string, updates: Partial<TestCase>) => {
    setTestCases(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addAssertion = (testCaseId: string, assertion: Omit<Assertion, 'id'>) => {
    const newAssertion: Assertion = {
      ...assertion,
      id: `assert-${generateId()}`
    };
    setTestCases(prev => prev.map(c => {
      if (c.id === testCaseId) {
        return { ...c, assertions: [...c.assertions, newAssertion] };
      }
      return c;
    }));
  };

  const deleteAssertion = (testCaseId: string, assertionId: string) => {
    setTestCases(prev => prev.map(c => {
      if (c.id === testCaseId) {
        return { ...c, assertions: c.assertions.filter(a => a.id !== assertionId) };
      }
      return c;
    }));
  };

  const clearTestResults = () => {
    setLastTestResults(null);
  };

  const runTestSuite = () => {
    const results: TestResult[] = [];
    const { order, hasCycle } = topologicalSort(nodes, connections);

    if (hasCycle || nodes.length === 0) {
      setError("Cannot run test suite: cycle detected or graph is empty.");
      return;
    }

    testCases.forEach(tc => {
      const startTime = performance.now();
      const currentVars: Record<string, any> = {};
      const executedNodeIds: string[] = [];

      const getInputValue = (nodeId: string, portId: string, fallback: any = null): any => {
        const inputKey = `${nodeId}-${portId}`;
        if (tc.inputs[inputKey] !== undefined) return tc.inputs[inputKey];

        const conn = connections.find(c => c.toNodeId === nodeId && c.toPortId === portId);
        if (conn) {
          const val = currentVars[`${conn.fromNodeId}-${conn.fromPortId}`];
          return val !== undefined ? val : fallback;
        }
        return fallback;
      };

      order.forEach(nodeId => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        executedNodeIds.push(nodeId);

        switch (node.type) {
          case 'input':
          case 'variable': {
            const outPort = node.outputs[0]?.id;
            if (outPort) {
              const portKey = `${node.id}-${outPort}`;
              currentVars[portKey] = tc.inputs[portKey] !== undefined ? tc.inputs[portKey] : (node.data.value !== undefined ? node.data.value : 0);
            }
            break;
          }

          case 'operator': {
            const valA = getInputValue(node.id, 'a', 0);
            const valB = getInputValue(node.id, 'b', 0);
            const op = node.data.operator || '+';
            let result: any = 0;

            try {
              switch (op) {
                case '+': result = Number(valA) + Number(valB); break;
                case '-': result = Number(valA) - Number(valB); break;
                case '*': result = Number(valA) * Number(valB); break;
                case '/': result = Number(valB) !== 0 ? Number(valA) / Number(valB) : 0; break;
                case '%': result = Number(valA) % Number(valB); break;
                case '>': result = valA > valB; break;
                case '<': result = valA < valB; break;
                case '===': result = valA === valB; break;
                case '&&': result = Boolean(valA) && Boolean(valB); break;
                case '||': result = Boolean(valA) || Boolean(valB); break;
                default: result = valA + valB;
              }
            } catch {
              result = 0;
            }

            const outPort = node.outputs[0]?.id;
            if (outPort) {
              currentVars[`${node.id}-${outPort}`] = result;
            }
            break;
          }

          case 'conditional': {
            const cond = getInputValue(node.id, 'condition', false);
            const ifTrue = getInputValue(node.id, 'if_true', null);
            const ifFalse = getInputValue(node.id, 'if_false', null);
            const result = cond ? ifTrue : ifFalse;

            const outPort = node.outputs[0]?.id;
            if (outPort) {
              currentVars[`${node.id}-${outPort}`] = result;
            }
            break;
          }

          case 'logger': {
            const val = getInputValue(node.id, 'input_val', 'undefined');
            currentVars[`${node.id}-input_val`] = val;
            break;
          }

          case 'custom': {
            const inputsObj: Record<string, any> = {};
            node.inputs.forEach(p => {
              inputsObj[p.id] = getInputValue(node.id, p.id, null);
            });

            const outputsMap = new Map<string, unknown>();
            const outputsObj = {
              set: (portId: string, val: unknown) => {
                outputsMap.set(portId, val);
              }
            };

            try {
              const runScript = new Function('inputs', 'outputs', node.data.code || '');
              runScript(inputsObj, outputsObj);

              node.outputs.forEach(p => {
                currentVars[`${node.id}-${p.id}`] = outputsMap.get(p.id) !== undefined ? outputsMap.get(p.id) : null;
              });
            } catch {
              node.outputs.forEach(p => {
                currentVars[`${node.id}-${p.id}`] = null;
              });
            }
            break;
          }

          case 'subgraph': {
            const subNodes: Node[] = (node.data.subgraphNodes as Node[]) || [];
            const subConns: Connection[] = (node.data.subgraphConnections as Connection[]) || [];
            if (subNodes.length > 0) {
              const { order: subOrder } = topologicalSort(subNodes, subConns);
              const subVars: Record<string, any> = {};
              node.inputs.forEach((p, idx) => {
                const inputVal = getInputValue(node.id, p.id, null);
                const targetInputNode = subNodes.find(sn => (sn.type === 'input' || sn.type === 'variable') && (sn.id === p.id || sn.label.toLowerCase().includes(p.name.toLowerCase())));
                if (targetInputNode) {
                  const outPort = targetInputNode.outputs[0]?.id || 'out';
                  subVars[`${targetInputNode.id}-${outPort}`] = inputVal;
                } else if (subNodes[idx]) {
                  const outPort = subNodes[idx].outputs[0]?.id || 'out';
                  subVars[`${subNodes[idx].id}-${outPort}`] = inputVal;
                }
              });

              subOrder.forEach(sId => {
                const sNode = subNodes.find(n => n.id === sId);
                if (!sNode) return;
                const getSubVal = (pId: string, fallback: any = null) => {
                  const conn = subConns.find(c => c.toNodeId === sId && c.toPortId === pId);
                  return conn ? (subVars[`${conn.fromNodeId}-${conn.fromPortId}`] !== undefined ? subVars[`${conn.fromNodeId}-${conn.fromPortId}`] : fallback) : fallback;
                };
                if (sNode.type === 'input' || sNode.type === 'variable') {
                  const outPort = sNode.outputs[0]?.id;
                  if (outPort && subVars[`${sNode.id}-${outPort}`] === undefined) {
                    subVars[`${sNode.id}-${outPort}`] = sNode.data.value !== undefined ? sNode.data.value : 0;
                  }
                } else if (sNode.type === 'operator') {
                  const valA = getSubVal('a', 0);
                  const valB = getSubVal('b', 0);
                  const op = sNode.data.operator || '+';
                  let res: any = 0;
                  switch (op) {
                    case '+': res = Number(valA) + Number(valB); break;
                    case '-': res = Number(valA) - Number(valB); break;
                    case '*': res = Number(valA) * Number(valB); break;
                    case '/': res = Number(valB) !== 0 ? Number(valA) / Number(valB) : 0; break;
                    default: res = Number(valA) + Number(valB);
                  }
                  const outPort = sNode.outputs[0]?.id;
                  if (outPort) subVars[`${sNode.id}-${outPort}`] = res;
                }
              });

              node.outputs.forEach((p, idx) => {
                const lastNode = subNodes[subNodes.length - 1 - idx] || subNodes[subNodes.length - 1];
                if (lastNode) {
                  const outPort = lastNode.outputs[0]?.id || 'res';
                  currentVars[`${node.id}-${p.id}`] = subVars[`${lastNode.id}-${outPort}`] !== undefined ? subVars[`${lastNode.id}-${outPort}`] : null;
                }
              });
            }
            break;
          }
        }
      });

      const assertionResults = tc.assertions.map(assertion => {
        const varKey = `${assertion.nodeId}-${assertion.portId}`;
        const actualValue = currentVars[varKey];
        let passed = false;
        let message = '';
        const expStr = assertion.expectedValue;

        switch (assertion.operator) {
          case 'equals':
            passed = String(actualValue) === expStr;
            message = passed ? 'Passed' : `Expected "${expStr}", got "${actualValue}"`;
            break;
          case 'not_equals':
            passed = String(actualValue) !== expStr;
            message = passed ? 'Passed' : `Expected not equals to "${expStr}"`;
            break;
          case 'greater_than':
            passed = Number(actualValue) > Number(expStr);
            message = passed ? 'Passed' : `Expected > ${expStr}, got ${actualValue}`;
            break;
          case 'less_than':
            passed = Number(actualValue) < Number(expStr);
            message = passed ? 'Passed' : `Expected < ${expStr}, got ${actualValue}`;
            break;
          case 'contains':
            passed = String(actualValue).toLowerCase().includes(expStr.toLowerCase());
            message = passed ? 'Passed' : `Expected to contain "${expStr}", got "${actualValue}"`;
            break;
          case 'is_type': {
            const actualType = typeof actualValue;
            passed = actualType === expStr.toLowerCase();
            message = passed ? 'Passed' : `Expected type "${expStr}", got "${actualType}"`;
            break;
          }
        }

        return {
          assertionId: assertion.id,
          passed,
          actualValue,
          message
        };
      });

      const passed = assertionResults.every(r => r.passed);
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

      results.push({
        testCaseId: tc.id,
        passed,
        assertionResults,
        executedNodeIds,
        durationMs
      });
    });

    setLastTestResults(results);
  };

  const presetTemplates = Object.values(PRESETS);

  return (
    <GraphContext.Provider value={{
      nodes,
      connections,
      executionState,
      error,
      customTemplates,
      subgraphTemplates,
      presetTemplates,
      testCases,
      lastTestResults,
      addNode,
      deleteNode,
      updateNodeData,
      updateNodePosition,
      addConnection,
      deleteConnection,
      clearGraph,
      startExecution,
      pauseExecution,
      stopExecution,
      stepExecution,
      setExecutionSpeed,
      loadPreset,
      setGraphData,
      setCurrentNodeId,
      createCustomTemplate,
      deleteCustomTemplate,
      createSubgraphTemplate,
      deleteSubgraphTemplate,
      addTestCase,
      deleteTestCase,
      updateTestCase,
      addAssertion,
      deleteAssertion,
      runTestSuite,
      clearTestResults
    }}>
      {children}
    </GraphContext.Provider>
  );
};

export const useGraph = () => {
  const context = useContext(GraphContext);
  if (!context) throw new Error('useGraph must be used within a GraphProvider');
  return context;
};
