import type { NodeType, Node, Connection } from '../types/graph';

export interface PromptSpec {
  nodes: { type: NodeType; label: string; data: Node['data']; key: string }[];
  connections: { fromKey: string; fromPortId: string; toKey: string; toPortId: string }[];
  thoughtSteps: string[];
}

/**
 * Robust rule-based NLP prompt compiler.
 * Analyzes natural language strings to engineer fully connected logic DAGs.
 */
export function compileAiPrompt(prompt: string): PromptSpec {
  const p = prompt.toLowerCase().trim();
  
  const spec: PromptSpec = {
    nodes: [],
    connections: [],
    thoughtSteps: [
      `🔍 [Triage] Commencing natural language compilation of user prompt: "${prompt}"`,
      `🧠 [Analyze] Tokenizing query and scanning for operational keywords...`
    ]
  };

  // Helper to push nodes easily
  const addSpecNode = (type: NodeType, label: string, data: Node['data'], key: string) => {
    spec.nodes.push({ type, label, data, key });
  };

  // Helper to connect specs
  const addSpecConnection = (fromKey: string, fromPortId: string, toKey: string, toPortId: string) => {
    spec.connections.push({ fromKey, fromPortId, toKey, toPortId });
  };

  // Case 1: Math Chaining with Condition Check ("adds 45 to 15, then checks if it is larger than 50, and logs the result")
  if (p.includes('add') && p.includes('larger') || p.includes('greater') && p.includes('log')) {
    spec.thoughtSteps.push(`📋 [Match] Matched complex math-comparison branching logic model.`);
    
    // Extract numbers
    const numbers = p.match(/\d+/g)?.map(Number) || [45, 15, 50];
    const valA = numbers[0] !== undefined ? numbers[0] : 45;
    const valB = numbers[1] !== undefined ? numbers[1] : 15;
    const limit = numbers[2] !== undefined ? numbers[2] : 50;

    spec.thoughtSteps.push(`🔢 [Extract] Captured key numeric values: InputA=${valA}, InputB=${valB}, LimitCheck=${limit}`);

    // Create Nodes
    addSpecNode('input', `Constant A (${valA})`, { value: valA }, 'inA');
    addSpecNode('input', `Constant B (${valB})`, { value: valB }, 'inB');
    addSpecNode('operator', `Sum (A + B)`, { operator: '+' }, 'opAdd');
    addSpecNode('input', `Limit Value (${limit})`, { value: limit }, 'inLimit');
    addSpecNode('operator', `Is Larger? (Sum > Limit)`, { operator: '>' }, 'opComp');
    addSpecNode('conditional', `Branch Decision`, {}, 'condRouter');
    addSpecNode('variable', `Success String`, { value: '⚠️ Limit exceeded!' }, 'strTrue');
    addSpecNode('variable', `Failure String`, { value: '✅ Safe threshold.' }, 'strFalse');
    addSpecNode('logger', `Terminal Output`, { logPrefix: '🔔 Sys Alert:' }, 'logOut');

    spec.thoughtSteps.push(`🏗️ [Compile] Generated 9 algorithmic visual nodes successfully.`);

    // Connect Nodes
    addSpecConnection('inA', 'out', 'opAdd', 'a');
    addSpecConnection('inB', 'out', 'opAdd', 'b');
    addSpecConnection('opAdd', 'res', 'opComp', 'a');
    addSpecConnection('inLimit', 'out', 'opComp', 'b');
    addSpecConnection('opComp', 'res', 'condRouter', 'condition');
    addSpecConnection('strTrue', 'out', 'condRouter', 'if_true');
    addSpecConnection('strFalse', 'out', 'condRouter', 'if_false');
    addSpecConnection('condRouter', 'result', 'logOut', 'input_val');

    spec.thoughtSteps.push(`🔗 [Wiring] Plotted 8 port connection cables safely without cycles.`);
    return spec;
  }

  // Case 2: Chain Arithmetic Math ("Multiply 25 by 4, subtract 20 from it, and log the final outcome")
  if (p.includes('multiply') && p.includes('subtract') && p.includes('log')) {
    spec.thoughtSteps.push(`📋 [Match] Matched chained arithmetic operations blueprint.`);

    const numbers = p.match(/\d+/g)?.map(Number) || [25, 4, 20];
    const valA = numbers[0] !== undefined ? numbers[0] : 25;
    const valB = numbers[1] !== undefined ? numbers[1] : 4;
    const valSub = numbers[2] !== undefined ? numbers[2] : 20;

    spec.thoughtSteps.push(`🔢 [Extract] Extracted constant operands: MulA=${valA}, MulB=${valB}, Subtractor=${valSub}`);

    addSpecNode('input', `Operand A (${valA})`, { value: valA }, 'inA');
    addSpecNode('input', `Operand B (${valB})`, { value: valB }, 'inB');
    addSpecNode('operator', `Product (A * B)`, { operator: '*' }, 'opMul');
    addSpecNode('input', `Operand C (${valSub})`, { value: valSub }, 'inSub');
    addSpecNode('operator', `Difference (Prod - C)`, { operator: '-' }, 'opSub');
    addSpecNode('logger', `Result Terminal`, { logPrefix: '🧮 Computation Result:' }, 'logOut');

    spec.thoughtSteps.push(`🏗️ [Compile] Instantiated 6 operational logic blocks.`);

    addSpecConnection('inA', 'out', 'opMul', 'a');
    addSpecConnection('inB', 'out', 'opMul', 'b');
    addSpecConnection('opMul', 'res', 'opSub', 'a');
    addSpecConnection('inSub', 'out', 'opSub', 'b');
    addSpecConnection('opSub', 'res', 'logOut', 'input_val');

    spec.thoughtSteps.push(`🔗 [Wiring] Routed 5 math pipelines successfully.`);
    return spec;
  }

  // Case 3: Simple Variable Logger ("Set string message 'Access Granted' and logs it")
  if (p.includes('string') || p.includes('message') || p.includes('text')) {
    spec.thoughtSteps.push(`📋 [Match] Matched literal string variable output model.`);

    // Extract quote strings or fallback
    const stringMatch = prompt.match(/['"](.*?)['"]/);
    const literalVal = stringMatch ? stringMatch[1] : 'Access Granted';

    spec.thoughtSteps.push(`📝 [Extract] Found string payload literal: "${literalVal}"`);

    addSpecNode('variable', `Literal Variable`, { value: literalVal }, 'strVar');
    addSpecNode('logger', `Print Monitor`, { logPrefix: '📟 Monitor Print:' }, 'logOut');

    spec.thoughtSteps.push(`🏗️ [Compile] Generated 2 terminal nodes.`);

    addSpecConnection('strVar', 'out', 'logOut', 'input_val');

    spec.thoughtSteps.push(`🔗 [Wiring] Connected literal register directly to printer input.`);
    return spec;
  }

  // Fallback Case: Dynamically assemble basic logic elements based on words detected
  spec.thoughtSteps.push(`⚠️ [Fallback] Custom request detected. Analyzing semantic keywords for dynamic graph layout assembly...`);

  // Extract numbers
  const detectedNums = p.match(/\d+/g)?.map(Number) || [10, 5];
  const num1 = detectedNums[0] !== undefined ? detectedNums[0] : 10;
  const num2 = detectedNums[1] !== undefined ? detectedNums[1] : 5;

  // Detect operator
  let matchedOp = '+';
  let opLabel = 'Addition';
  if (p.includes('sub') || p.includes('minus') || p.includes('-')) {
    matchedOp = '-';
    opLabel = 'Subtraction';
  } else if (p.includes('mul') || p.includes('times') || p.includes('*')) {
    matchedOp = '*';
    opLabel = 'Multiplication';
  } else if (p.includes('div') || p.includes('/') || p.includes('share')) {
    matchedOp = '/';
    opLabel = 'Division';
  }

  spec.thoughtSteps.push(`🎛️ [Semantic] Identified primary operation: ${opLabel} (${matchedOp})`);

  addSpecNode('input', `Val 1 (${num1})`, { value: num1 }, 'fA');
  addSpecNode('input', `Val 2 (${num2})`, { value: num2 }, 'fB');
  addSpecNode('operator', `${opLabel} Node`, { operator: matchedOp }, 'fOp');
  addSpecNode('logger', `Console Printer`, { logPrefix: '🖨️ Evaluated:' }, 'fLog');

  addSpecConnection('fA', 'out', 'fOp', 'a');
  addSpecConnection('fB', 'out', 'fOp', 'b');
  addSpecConnection('fOp', 'res', 'fLog', 'input_val');

  spec.thoughtSteps.push(`🏗️ [Compile] Successfully built dynamic fallback grid graph containing 4 nodes and 3 wires.`);
  return spec;
}
