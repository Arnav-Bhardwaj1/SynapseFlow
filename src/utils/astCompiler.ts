import type { Node, Connection } from '../types/graph';
import { topologicalSort } from './graphAlgorithms';

// ESTree-like AST node definitions
export interface ASTNode {
  type: string;
  nodeId?: string; // Links back to the canvas Node ID that generated this AST node
  [key: string]: any;
}

export interface ProgramNode extends ASTNode {
  type: 'Program';
  body: ASTNode[];
}

export interface VariableDeclarationNode extends ASTNode {
  type: 'VariableDeclaration';
  kind: 'let' | 'const';
  declarations: VariableDeclaratorNode[];
}

export interface VariableDeclaratorNode extends ASTNode {
  type: 'VariableDeclarator';
  id: IdentifierNode;
  init: ASTNode;
}

export interface IdentifierNode extends ASTNode {
  type: 'Identifier';
  name: string;
}

export interface LiteralNode extends ASTNode {
  type: 'Literal';
  value: any;
  raw: string;
}

export interface BinaryExpressionNode extends ASTNode {
  type: 'BinaryExpression';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface ConditionalExpressionNode extends ASTNode {
  type: 'ConditionalExpression';
  test: ASTNode;
  consequent: ASTNode;
  alternate: ASTNode;
}

export interface ExpressionStatementNode extends ASTNode {
  type: 'ExpressionStatement';
  expression: ASTNode;
}

export interface CallExpressionNode extends ASTNode {
  type: 'CallExpression';
  callee: ASTNode;
  arguments: ASTNode[];
}

export interface MemberExpressionNode extends ASTNode {
  type: 'MemberExpression';
  object: ASTNode;
  property: ASTNode;
}

export interface BlockStatementNode extends ASTNode {
  type: 'BlockStatement';
  body: ASTNode[];
}

export interface CustomScriptBlockNode extends ASTNode {
  type: 'CustomScriptBlock';
  inputs: { name: string; value: ASTNode }[];
  outputs: string[];
  code: string;
}

/**
 * Compile the visual graph structure into a structured ESTree-like AST representation.
 */
export function compileGraphToAST(nodes: Node[], connections: Connection[]): ProgramNode {
  const { order, hasCycle } = topologicalSort(nodes, connections);

  if (hasCycle) {
    return {
      type: 'Program',
      body: [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: { type: 'Identifier', name: 'console' },
              property: { type: 'Identifier', name: 'error' }
            },
            arguments: [{ type: 'Literal', value: 'Cycle detected in visual graph!', raw: '"Cycle detected in visual graph!"' }]
          }
        }
      ]
    };
  }

  const body: ASTNode[] = [];
  const portToVar: Record<string, string> = {};

  // Traverses connections entering a node port
  const getInputValueAST = (nodeId: string, portId: string, fallback: any = 0): ASTNode => {
    const conn = connections.find(c => c.toNodeId === nodeId && c.toPortId === portId);
    if (conn) {
      const varName = portToVar[`${conn.fromNodeId}-${conn.fromPortId}`];
      if (varName) {
        return { type: 'Identifier', name: varName };
      }
    }
    return { type: 'Literal', value: fallback, raw: JSON.stringify(fallback) };
  };

  order.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const shortId = node.id.substring(0, 4);

    switch (node.type) {
      case 'input':
      case 'variable': {
        const val = node.data.value !== undefined ? node.data.value : (node.type === 'input' ? 0 : '');
        const cleanLabel = node.label.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        const varName = `var_${cleanLabel}_${shortId}`;

        // Map output port
        const outPort = node.outputs[0]?.id;
        if (outPort) {
          portToVar[`${node.id}-${outPort}`] = varName;
        }

        body.push({
          type: 'VariableDeclaration',
          kind: 'let',
          nodeId: node.id, // reference to canvas ID
          declarations: [
            {
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name: varName },
              init: { type: 'Literal', value: val, raw: JSON.stringify(val) }
            }
          ]
        } as VariableDeclarationNode);
        break;
      }

      case 'operator': {
        const valA = getInputValueAST(node.id, 'a', 0);
        const valB = getInputValueAST(node.id, 'b', 0);
        const op = node.data.operator || '+';
        const varName = `res_${shortId}`;

        const outPort = node.outputs[0]?.id;
        if (outPort) {
          portToVar[`${node.id}-${outPort}`] = varName;
        }

        body.push({
          type: 'VariableDeclaration',
          kind: 'const',
          nodeId: node.id,
          declarations: [
            {
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name: varName },
              init: {
                type: 'BinaryExpression',
                operator: op,
                left: valA,
                right: valB
              }
            }
          ]
        } as VariableDeclarationNode);
        break;
      }

      case 'conditional': {
        const condVal = getInputValueAST(node.id, 'condition', false);
        const trueVal = getInputValueAST(node.id, 'if_true', null);
        const falseVal = getInputValueAST(node.id, 'if_false', null);
        const varName = `cond_${shortId}`;

        const outPort = node.outputs.find(o => o.id === 'result')?.id;
        if (outPort) {
          portToVar[`${node.id}-${outPort}`] = varName;
        }

        body.push({
          type: 'VariableDeclaration',
          kind: 'const',
          nodeId: node.id,
          declarations: [
            {
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name: varName },
              init: {
                type: 'ConditionalExpression',
                test: condVal,
                consequent: trueVal,
                alternate: falseVal
              }
            }
          ]
        } as VariableDeclarationNode);
        break;
      }

      case 'logger': {
        const prefix = node.data.logPrefix || 'Output:';
        const val = getInputValueAST(node.id, 'input_val', '');

        body.push({
          type: 'ExpressionStatement',
          nodeId: node.id,
          expression: {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: { type: 'Identifier', name: 'console' },
              property: { type: 'Identifier', name: 'log' }
            },
            arguments: [
              { type: 'Literal', value: prefix, raw: JSON.stringify(prefix) },
              val
            ]
          }
        } as ExpressionStatementNode);
        break;
      }

      case 'custom': {
        const inputsMapping = node.inputs.map(p => ({
          name: p.id,
          value: getInputValueAST(node.id, p.id, null)
        }));

        const outputsList = node.outputs.map(p => p.id);

        outputsList.forEach(pId => {
          portToVar[`${node.id}-${pId}`] = `res_${shortId}_${pId}`;
        });

        body.push({
          type: 'CustomScriptBlock',
          nodeId: node.id,
          inputs: inputsMapping,
          outputs: outputsList,
          code: node.data.code || ''
        } as CustomScriptBlockNode);
        break;
      }
    }
  });

  return {
    type: 'Program',
    body
  };
}

/**
 * Evaluates binary expressions with literal operands
 */
function evaluateOperation(leftVal: any, rightVal: any, operator: string): any {
  switch (operator) {
    case '+': return Number(leftVal) + Number(rightVal);
    case '-': return Number(leftVal) - Number(rightVal);
    case '*': return Number(leftVal) * Number(rightVal);
    case '/': return Number(rightVal) !== 0 ? Number(leftVal) / Number(rightVal) : 0;
    case '%': return Number(leftVal) % Number(rightVal);
    case '>': return leftVal > rightVal;
    case '<': return leftVal < rightVal;
    case '===': return leftVal === rightVal;
    case '&&': return Boolean(leftVal) && Boolean(rightVal);
    case '||': return Boolean(leftVal) || Boolean(rightVal);
    default: return leftVal + rightVal;
  }
}

/**
 * Execute optimization passes over the compiled AST.
 */
export function optimizeAST(
  program: ProgramNode,
  passes: { foldConstants: boolean; removeDeadCode: boolean; minifyNames: boolean }
): { ast: ProgramNode; logs: string[] } {
  let currentBody = JSON.parse(JSON.stringify(program.body)) as ASTNode[];
  const logs: string[] = [];

  // 1. Constant Propagation & Constant Folding
  if (passes.foldConstants) {
    const constants: Record<string, any> = {};
    let foldedCount = 0;
    let propCount = 0;

    const foldNode = (node: ASTNode): ASTNode => {
      if (!node) return node;

      if (node.type === 'Identifier') {
        if (constants[node.name] !== undefined) {
          propCount++;
          return {
            type: 'Literal',
            value: constants[node.name],
            raw: JSON.stringify(constants[node.name])
          };
        }
        return node;
      }

      if (node.type === 'BinaryExpression') {
        const left = foldNode(node.left);
        const right = foldNode(node.right);

        if (left.type === 'Literal' && right.type === 'Literal') {
          try {
            const res = evaluateOperation(left.value, right.value, node.operator);
            foldedCount++;
            return {
              type: 'Literal',
              value: res,
              raw: JSON.stringify(res)
            };
          } catch {
            // fallback
          }
        }
        return { ...node, left, right };
      }

      if (node.type === 'ConditionalExpression') {
        const test = foldNode(node.test);
        const consequent = foldNode(node.consequent);
        const alternate = foldNode(node.alternate);

        if (test.type === 'Literal') {
          foldedCount++;
          return test.value ? consequent : alternate;
        }

        return { ...node, test, consequent, alternate };
      }

      if (node.type === 'CallExpression') {
        return {
          ...node,
          arguments: node.arguments.map((arg: ASTNode) => foldNode(arg))
        };
      }

      if (node.type === 'CustomScriptBlock') {
        return {
          ...node,
          inputs: node.inputs.map((input: any) => ({
            ...input,
            value: foldNode(input.value)
          }))
        };
      }

      return node;
    };

    // Traverse list of statements
    currentBody = currentBody.map(stmt => {
      if (stmt.type === 'VariableDeclaration') {
        const decl = stmt.declarations[0];
        const newInit = foldNode(decl.init);
        decl.init = newInit;

        if (newInit.type === 'Literal') {
          constants[decl.id.name] = newInit.value;
        }
        return stmt;
      }

      if (stmt.type === 'ExpressionStatement') {
        if (stmt.expression.type === 'CallExpression') {
          stmt.expression.arguments = stmt.expression.arguments.map((arg: ASTNode) => foldNode(arg));
        }
        return stmt;
      }

      if (stmt.type === 'CustomScriptBlock') {
        stmt.inputs = stmt.inputs.map((input: any) => ({
          ...input,
          value: foldNode(input.value)
        }));
        return stmt;
      }

      return stmt;
    });

    if (foldedCount > 0) logs.push(`Constant Folding: Folded ${foldedCount} operations to static values.`);
    if (propCount > 0) logs.push(`Constant Propagation: Substituted ${propCount} variables with static constants.`);
  }

  // 2. Dead Code Elimination (Mark and Sweep)
  if (passes.removeDeadCode) {
    const graphMap: Record<string, { stmt: ASTNode; refs: string[]; outputs: string[] }> = {};

    // Collect references in nodes helper
    const collectRefs = (node: ASTNode, refSet: Set<string>) => {
      if (!node) return;
      if (node.type === 'Identifier') {
        refSet.add(node.name);
      } else if (node.type === 'BinaryExpression') {
        collectRefs(node.left, refSet);
        collectRefs(node.right, refSet);
      } else if (node.type === 'ConditionalExpression') {
        collectRefs(node.test, refSet);
        collectRefs(node.consequent, refSet);
        collectRefs(node.alternate, refSet);
      } else if (node.type === 'CallExpression') {
        node.arguments.forEach((arg: ASTNode) => collectRefs(arg, refSet));
      } else if (node.type === 'CustomScriptBlock') {
        node.inputs.forEach((input: any) => collectRefs(input.value, refSet));
      }
    };

    // Analyze statements
    currentBody.forEach((stmt, idx) => {
      const key = `stmt-${idx}`;
      const refs = new Set<string>();
      let outputs: string[] = [];

      if (stmt.type === 'VariableDeclaration') {
        const decl = stmt.declarations[0];
        outputs = [decl.id.name];
        collectRefs(decl.init, refs);
      } else if (stmt.type === 'ExpressionStatement') {
        collectRefs(stmt.expression, refs);
      } else if (stmt.type === 'CustomScriptBlock') {
        outputs = stmt.outputs.map((p: string) => `res_${(stmt.nodeId || '').substring(0, 4)}_${p}`);
        stmt.inputs.forEach((input: any) => collectRefs(input.value, refs));
      }

      graphMap[key] = {
        stmt,
        refs: Array.from(refs),
        outputs
      };
    });

    // Mark active nodes
    // Side effect statements are critical: console.log (logger) and custom scripts
    const activeStatementKeys = new Set<string>();
    const activeVariables = new Set<string>();

    // Initial critical nodes
    Object.keys(graphMap).forEach(key => {
      const { stmt } = graphMap[key];
      if (stmt.type === 'ExpressionStatement' || stmt.type === 'CustomScriptBlock') {
        activeStatementKeys.add(key);
      }
    });

    // Propagate live dependencies recursively
    let changed = true;
    while (changed) {
      changed = false;

      // 1. Accumulate variables referenced by active statements
      activeStatementKeys.forEach(key => {
        const { refs } = graphMap[key];
        refs.forEach(varName => {
          if (!activeVariables.has(varName)) {
            activeVariables.add(varName);
            changed = true;
          }
        });
      });

      // 2. Activate declarations that produce active variables
      Object.keys(graphMap).forEach(key => {
        if (!activeStatementKeys.has(key)) {
          const { outputs } = graphMap[key];
          const outputsActive = outputs.some(v => activeVariables.has(v));
          if (outputsActive) {
            activeStatementKeys.add(key);
            changed = true;
          }
        }
      });
    }

    // Sweep: filter body to only active statements
    const initialCount = currentBody.length;
    currentBody = currentBody.filter((_, idx) => activeStatementKeys.has(`stmt-${idx}`));
    const removedCount = initialCount - currentBody.length;

    if (removedCount > 0) {
      logs.push(`Dead Code Elimination: Removed ${removedCount} unused variables/operators.`);
    }
  }

  // 3. Identifier Minification
  if (passes.minifyNames) {
    const varMap: Record<string, string> = {};
    let minIdx = 0;

    const generateMinName = (): string => {
      let result = '';
      let temp = minIdx++;
      while (temp >= 0) {
        result = String.fromCharCode(97 + (temp % 26)) + result; // 97 is 'a'
        temp = Math.floor(temp / 26) - 1;
      }
      // Ensure we do not clash with reserved names
      const reserved = ['console', 'log', 'inputs', 'outputs', 'set', 'let', 'const', 'function'];
      if (reserved.includes(result)) {
        return generateMinName();
      }
      return result;
    };

    // Gather and assign minified names
    currentBody.forEach(stmt => {
      if (stmt.type === 'VariableDeclaration') {
        const decl = stmt.declarations[0];
        const oldName = decl.id.name;
        if (!varMap[oldName]) {
          varMap[oldName] = generateMinName();
        }
      } else if (stmt.type === 'CustomScriptBlock') {
        stmt.outputs.forEach((pId: string) => {
          const oldName = `res_${(stmt.nodeId || '').substring(0, 4)}_${pId}`;
          if (!varMap[oldName]) {
            varMap[oldName] = generateMinName();
          }
        });
      }
    });

    // Rename node references helper
    const renameNode = (node: ASTNode): ASTNode => {
      if (!node) return node;
      if (node.type === 'Identifier') {
        if (varMap[node.name]) {
          return { ...node, name: varMap[node.name] };
        }
        return node;
      }
      if (node.type === 'BinaryExpression') {
        return {
          ...node,
          left: renameNode(node.left),
          right: renameNode(node.right)
        };
      }
      if (node.type === 'ConditionalExpression') {
        return {
          ...node,
          test: renameNode(node.test),
          consequent: renameNode(node.consequent),
          alternate: renameNode(node.alternate)
        };
      }
      if (node.type === 'CallExpression') {
        return {
          ...node,
          arguments: node.arguments.map((arg: ASTNode) => renameNode(arg))
        };
      }
      if (node.type === 'CustomScriptBlock') {
        return {
          ...node,
          inputs: node.inputs.map((input: any) => ({
            ...input,
            value: renameNode(input.value)
          }))
        };
      }
      return node;
    };

    // Perform rename sweep
    currentBody = currentBody.map(stmt => {
      if (stmt.type === 'VariableDeclaration') {
        const decl = stmt.declarations[0];
        decl.id = renameNode(decl.id) as IdentifierNode;
        decl.init = renameNode(decl.init);
        return stmt;
      }

      if (stmt.type === 'ExpressionStatement') {
        if (stmt.expression.type === 'CallExpression') {
          stmt.expression.arguments = stmt.expression.arguments.map((arg: ASTNode) => renameNode(arg));
        }
        return stmt;
      }

      if (stmt.type === 'CustomScriptBlock') {
        stmt.inputs = stmt.inputs.map((input: any) => ({
          ...input,
          value: renameNode(input.value)
        }));
        return stmt;
      }

      return stmt;
    });

    const minifiedCount = Object.keys(varMap).length;
    if (minifiedCount > 0) {
      logs.push(`Name Minification: Obfuscated ${minifiedCount} visual variable identifiers.`);
    }
  }

  return {
    ast: {
      type: 'Program',
      body: currentBody
    },
    logs
  };
}

/**
 * Traverse the AST recursively to format and generate high-fidelity JavaScript code.
 */
export function generateCodeFromAST(program: ProgramNode): string {
  const lines: string[] = [
    `// =============================================`,
    `// SynapseFlow AST Optimized Script`,
    `// Generated: ${new Date().toLocaleTimeString()}`,
    `// =============================================\n`,
    `function runWorkflow() {`,
    `  // Optimized execution memory`
  ];

  const printNode = (node: ASTNode): string => {
    if (!node) return 'undefined';

    switch (node.type) {
      case 'Identifier':
        return node.name;

      case 'Literal':
        return node.raw || JSON.stringify(node.value);

      case 'BinaryExpression':
        return `(${printNode(node.left)} ${node.operator} ${printNode(node.right)})`;

      case 'ConditionalExpression':
        return `(${printNode(node.test)} ? ${printNode(node.consequent)} : ${printNode(node.alternate)})`;

      case 'CallExpression': {
        const calleeStr = printNode(node.callee);
        const argsStr = node.arguments.map((arg: ASTNode) => printNode(arg)).join(', ');
        return `${calleeStr}(${argsStr})`;
      }

      case 'MemberExpression':
        return `${printNode(node.object)}.${printNode(node.property)}`;

      default:
        return 'null';
    }
  };

  program.body.forEach(stmt => {
    switch (stmt.type) {
      case 'VariableDeclaration': {
        const decl = stmt.declarations[0];
        lines.push(`  let ${decl.id.name} = ${printNode(decl.init)};`);
        break;
      }

      case 'ExpressionStatement': {
        lines.push(`  ${printNode(stmt.expression)};`);
        break;
      }

      case 'CustomScriptBlock': {
        const shortId = (stmt.nodeId || '').substring(0, 4);
        lines.push(`  // Custom Script block_${shortId}`);
        stmt.outputs.forEach((pId: string) => {
          lines.push(`  let res_${shortId}_${pId} = null;`);
        });

        const inputsMapping = stmt.inputs
          .map((input: any) => `${input.name}: ${printNode(input.value)}`)
          .join(', ');

        lines.push(`  (() => {`);
        lines.push(`    const inputs = { ${inputsMapping} };`);
        lines.push(`    const outputs = {`);
        lines.push(`      set: (id, val) => {`);
        stmt.outputs.forEach((pId: string) => {
          lines.push(`        if (id === '${pId}') res_${shortId}_${pId} = val;`);
        });
        lines.push(`      }`);
        lines.push(`    };`);

        // Insert user code lines
        const userCode = stmt.code || '';
        userCode.split('\n').forEach((line: string) => {
          lines.push(`    ${line}`);
        });

        lines.push(`  })();`);
        break;
      }
    }
  });

  lines.push(`  console.log("AST optimized workflow successfully completed.");`);
  lines.push(`}`);
  lines.push(`\nrunWorkflow();`);

  return lines.join('\n');
}

/**
 * Helper to calculate depth of the AST Tree
 */
export function getASTDepth(node: ASTNode): number {
  if (!node) return 0;
  if (node.type === 'Program') {
    return 1 + (node.body.length > 0 ? Math.max(...node.body.map(getASTDepth)) : 0);
  }
  if (node.type === 'VariableDeclaration') {
    return 1 + getASTDepth(node.declarations[0]);
  }
  if (node.type === 'VariableDeclarator') {
    return 1 + getASTDepth(node.init);
  }
  if (node.type === 'BinaryExpression') {
    return 1 + Math.max(getASTDepth(node.left), getASTDepth(node.right));
  }
  if (node.type === 'ConditionalExpression') {
    return 1 + Math.max(getASTDepth(node.test), getASTDepth(node.consequent), getASTDepth(node.alternate));
  }
  if (node.type === 'CallExpression') {
    return 1 + (node.arguments.length > 0 ? Math.max(...node.arguments.map((arg: ASTNode) => getASTDepth(arg))) : 0);
  }
  if (node.type === 'ExpressionStatement') {
    return 1 + getASTDepth(node.expression);
  }
  if (node.type === 'CustomScriptBlock') {
    return 2; // Fixed depth for foreign script blocks
  }
  return 1;
}

/**
 * Counts total nodes inside the AST recursively
 */
export function getASTNodeCount(node: ASTNode): number {
  if (!node) return 0;
  let count = 1;
  if (node.type === 'Program') {
    node.body.forEach((stmt: ASTNode) => { count += getASTNodeCount(stmt); });
  } else if (node.type === 'VariableDeclaration') {
    node.declarations.forEach((decl: ASTNode) => { count += getASTNodeCount(decl); });
  } else if (node.type === 'VariableDeclarator') {
    count += getASTNodeCount(node.id) + getASTNodeCount(node.init);
  } else if (node.type === 'BinaryExpression') {
    count += getASTNodeCount(node.left) + getASTNodeCount(node.right);
  } else if (node.type === 'ConditionalExpression') {
    count += getASTNodeCount(node.test) + getASTNodeCount(node.consequent) + getASTNodeCount(node.alternate);
  } else if (node.type === 'CallExpression') {
    count += getASTNodeCount(node.callee);
    node.arguments.forEach((arg: ASTNode) => { count += getASTNodeCount(arg); });
  } else if (node.type === 'ExpressionStatement') {
    count += getASTNodeCount(node.expression);
  } else if (node.type === 'CustomScriptBlock') {
    count += 1 + node.inputs.length;
  }
  return count;
}
