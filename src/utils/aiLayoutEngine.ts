export interface LayoutNode {
  key: string;
}

export interface LayoutConnection {
  fromKey: string;
  toKey: string;
}

export interface LayoutCoords {
  x: number;
  y: number;
}

/**
 * Advanced Rank-Based Topological Graph Auto-Layout Coordinator.
 * Positions nodes along horizontal and vertical columns based on topological rank depths to avoid visual overlaps.
 */
export function computeAutoLayout(
  nodes: LayoutNode[],
  connections: LayoutConnection[],
  startX: number = 80,
  startY: number = 80,
  colWidth: number = 280,
  rowHeight: number = 160
): Record<string, LayoutCoords> {
  const nodeIds = nodes.map(n => n.key);
  const ranks: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  // Initialize
  nodeIds.forEach(id => {
    ranks[id] = 0;
    adjList[id] = [];
    inDegree[id] = 0;
  });

  // Build Adjacency List & compute in-degrees
  connections.forEach(conn => {
    const from = conn.fromKey;
    const to = conn.toKey;
    if (adjList[from] && adjList[to]) {
      adjList[from].push(to);
      inDegree[to]++;
    }
  });

  // Queue of nodes with in-degree 0 (Starting Sources)
  const queue: string[] = nodeIds.filter(id => inDegree[id] === 0);

  // Set initial ranks for source nodes to 0
  queue.forEach(id => {
    ranks[id] = 0;
  });

  // Topologically compute ranks
  while (queue.length > 0) {
    const u = queue.shift()!;
    const uRank = ranks[u];

    const neighbors = adjList[u];
    neighbors.forEach(v => {
      // The rank of neighbor is at least rank of parent + 1
      ranks[v] = Math.max(ranks[v], uRank + 1);
      
      inDegree[v]--;
      if (inDegree[v] === 0) {
        queue.push(v);
      }
    });
  }

  // Handle remaining/disjoint cycles by checking if inDegrees weren't fully cleared
  nodeIds.forEach(id => {
    if (ranks[id] === undefined) {
      ranks[id] = 0;
    }
  });

  // Group node keys by their rank column
  const rankGroups: Record<number, string[]> = {};
  nodeIds.forEach(id => {
    const rank = ranks[id];
    if (!rankGroups[rank]) {
      rankGroups[rank] = [];
    }
    rankGroups[rank].push(id);
  });

  // Map each node key to custom grid coordinates
  const coordMap: Record<string, LayoutCoords> = {};

  // Find max rank column to center canvas visually
  const columns = Object.keys(rankGroups).map(Number);
  const maxColumnYCount = Math.max(...Object.values(rankGroups).map(arr => arr.length), 1);
  const centerY = startY + (maxColumnYCount * rowHeight) / 2;

  columns.forEach(col => {
    const nodeKeys = rankGroups[col];
    const colCount = nodeKeys.length;
    const colX = startX + col * colWidth;

    nodeKeys.forEach((key, idx) => {
      // Center items inside the column vertically
      const totalColHeight = (colCount - 1) * rowHeight;
      const colY = centerY - totalColHeight / 2 + idx * rowHeight;

      coordMap[key] = {
        x: colX,
        y: Math.max(colY, 60) // Keep safe margin from header
      };
    });
  });

  return coordMap;
}
