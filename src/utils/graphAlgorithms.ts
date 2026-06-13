import type { Node, Connection } from '../types/graph';

/**
 * Performs Kahn's algorithm to obtain topological sorting of the nodes.
 * If a cycle is detected, returns an empty array or throws an error.
 */
export function topologicalSort(nodes: Node[], connections: Connection[]): { order: string[]; hasCycle: boolean } {
  const nodeIds = nodes.map(n => n.id);
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  // Initialize
  nodeIds.forEach(id => {
    inDegree[id] = 0;
    adjList[id] = [];
  });

  // Build Adjacency List & compute in-degrees
  connections.forEach(conn => {
    // Only connect if both nodes exist in the current list
    if (adjList[conn.fromNodeId] && adjList[conn.toNodeId]) {
      adjList[conn.fromNodeId].push(conn.toNodeId);
      inDegree[conn.toNodeId]++;
    }
  });

  // Queue of nodes with in-degree 0
  const queue: string[] = nodeIds.filter(id => inDegree[id] === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);

    const neighbors = adjList[u];
    neighbors.forEach(v => {
      inDegree[v]--;
      if (inDegree[v] === 0) {
        queue.push(v);
      }
    });
  }

  const hasCycle = order.length < nodes.length;

  return {
    order: hasCycle ? [] : order,
    hasCycle
  };
}

/**
 * Compile a set of nodes and connections into functional JavaScript code.
 * Crawls through the topological sort of nodes, tracks variable assignments,
 * and generates clean, indented JS output.
 */
export function synthesizeCode(nodes: Node[], connections: Connection[]): string {
  const { order, hasCycle } = topologicalSort(nodes, connections);

  if (hasCycle) {
    return `// ERROR: Cycle detected in graph!\n// Please remove loops to generate clean procedural code.`;
  }

  if (nodes.length === 0) {
    return `// Graph is empty. Drag and drop nodes to write code.`;
  }

  let codeLines: string[] = [
    `// =============================================`,
    `// SynapseFlow Synthesized Script`,
    `// Generated: ${new Date().toLocaleTimeString()}`,
    `// =============================================\n`,
    `function runWorkflow() {`,
    `  // Memory initialization`
  ];

  // Store map of port values
  const portToVar: Record<string, string> = {};

  // Keep track of declared variables to avoid redeclaring
  const declaredVars = new Set<string>();

  // Process nodes in topological order
  order.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Help map node connection inputs
    const getInputValue = (portId: string, fallback: any = null): string => {
      const conn = connections.find(c => c.toNodeId === nodeId && c.toPortId === portId);
      if (conn) {
        return portToVar[`${conn.fromNodeId}-${conn.fromPortId}`] || 'undefined';
      }
      return JSON.stringify(fallback);
    };

    switch (node.type) {
      case 'input':
      case 'variable': {
        const val = node.data.value !== undefined ? node.data.value : 0;
        const cleanName = node.label.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        const varName = `var_${cleanName}_${node.id.substring(0, 4)}`;
        
        codeLines.push(`  // ${node.label}`);
        codeLines.push(`  let ${varName} = ${JSON.stringify(val)};`);
        declaredVars.add(varName);

        // Map output port
        const outPort = node.outputs[0]?.id;
        if (outPort) {
          portToVar[`${node.id}-${outPort}`] = varName;
        }
        break;
      }

      case 'operator': {
        const valA = getInputValue('a', 0);
        const valB = getInputValue('b', 0);
        const op = node.data.operator || '+';
        const varName = `res_${node.id.substring(0, 4)}`;

        codeLines.push(`  // Operation: ${op}`);
        codeLines.push(`  const ${varName} = ${valA} ${op} ${valB};`);
        declaredVars.add(varName);

        // Map output port
        const outPort = node.outputs[0]?.id;
        if (outPort) {
          portToVar[`${node.id}-${outPort}`] = varName;
        }
        break;
      }

      case 'conditional': {
        const condVal = getInputValue('condition', false);
        const trueVal = getInputValue('if_true', 'null');
        const falseVal = getInputValue('if_false', 'null');
        const varName = `cond_${node.id.substring(0, 4)}`;

        codeLines.push(`  // Conditional Branching`);
        codeLines.push(`  const ${varName} = ${condVal} ? ${trueVal} : ${falseVal};`);
        
        // Map both outputs to the same computed variable or respective branches
        const outTruePort = node.outputs.find(o => o.id === 'out_true')?.id;
        const outFalsePort = node.outputs.find(o => o.id === 'out_false')?.id;
        const outResultPort = node.outputs.find(o => o.id === 'result')?.id;

        if (outTruePort) portToVar[`${node.id}-${outTruePort}`] = `${condVal} ? ${trueVal} : undefined`;
        if (outFalsePort) portToVar[`${node.id}-${outFalsePort}`] = `!${condVal} ? ${falseVal} : undefined`;
        if (outResultPort) portToVar[`${node.id}-${outResultPort}`] = varName;
        break;
      }

      case 'logger': {
        const msg = node.data.logPrefix || 'Output:';
        const val = getInputValue('input_val', '');
        codeLines.push(`  // Logging Output`);
        codeLines.push(`  console.log(${JSON.stringify(msg)}, ${val});`);
        break;
      }

      case 'custom': {
        codeLines.push(`  // Custom Script Block: ${node.label}`);
        const inputPortMappings = node.inputs.map(p => `${p.id}: ${getInputValue(p.id, null)}`).join(', ');
        
        node.outputs.forEach(p => {
          codeLines.push(`  let res_${node.id.substring(0, 4)}_${p.id} = null;`);
        });
        
        codeLines.push(`  (() => {`);
        codeLines.push(`    const inputs = { ${inputPortMappings} };`);
        codeLines.push(`    const outputs = {`);
        codeLines.push(`      set: (id, val) => {`);
        node.outputs.forEach(p => {
          codeLines.push(`        if (id === '${p.id}') res_${node.id.substring(0, 4)}_${p.id} = val;`);
        });
        codeLines.push(`      }`);
        codeLines.push(`    };`);
        
        const userCodeLines = (node.data.code || '')
          .split('\n')
          .map(line => `    ${line}`)
          .join('\n');
        codeLines.push(userCodeLines);
        codeLines.push(`  })();`);
        
        node.outputs.forEach(p => {
          const varName = `res_${node.id.substring(0, 4)}_${p.id}`;
          portToVar[`${node.id}-${p.id}`] = varName;
        });
        break;
      }
    }
  });

  codeLines.push(`  console.log("Workflow execution finished successfully.");`);
  codeLines.push(`}`);
  codeLines.push(`\nrunWorkflow();`);

  return codeLines.join('\n');
}
