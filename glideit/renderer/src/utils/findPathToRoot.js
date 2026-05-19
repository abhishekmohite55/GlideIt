/**
 * Given a node ID, trace the call chain backwards to the nearest entry point.
 * Returns an array of node objects ordered from entry point → hovered node.
 *
 * @param {string} nodeId     - the ID of the node being hovered
 * @param {Array}  allNodes   - full node array from page's filtered nodes
 * @param {Array}  allEdges   - full edge array from page's filtered edges
 * @returns {Array} ordered array of node objects [entryPoint, ..., hoveredNode]
 */
export function findPathToRoot(nodeId, allNodes, allEdges) {
  // Build reverse adjacency: target -> [sources]
  const reverseAdj = {};
  allEdges.forEach(e => {
    const target = e.target?.id || e.target;
    const source = e.source?.id || e.source;
    if (!reverseAdj[target]) reverseAdj[target] = [];
    reverseAdj[target].push(source);
  });

  // Build node lookup by ID
  const nodeById = {};
  allNodes.forEach(n => {
    nodeById[n.id] = n;
  });

  // Walk backwards from nodeId to find path to a depth-0 node
  // Use BFS to find shortest path to root
  const visited = new Set();
  const queue = [[nodeId]]; // each item is a path array of IDs

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[0];

    if (visited.has(current)) continue;
    visited.add(current);

    const currentNode = nodeById[current];

    // If we reached an entry point (depth 0) or a node with no parents, stop
    if (!currentNode || currentNode.depth === 0 || !reverseAdj[current] || reverseAdj[current].length === 0) {
      // Return path from root to hovered node (reverse so entry point is first)
      return path.reverse().map(id => nodeById[id]).filter(Boolean);
    }

    const parents = reverseAdj[current] || [];
    parents.forEach(parentId => {
      if (!visited.has(parentId)) {
        queue.push([parentId, ...path]);
      }
    });
  }

  // Fallback: just return the hovered node alone
  return [nodeById[nodeId]].filter(Boolean);
}
