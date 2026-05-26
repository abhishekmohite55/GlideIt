// 8 distinct cluster colors — muted, not saturated
// These are stroke/ring colors, used at low opacity on edges
// and as outline rings on entry-point nodes only
export const CLUSTER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#F97316', // orange
  '#EC4899', // pink
];

/**
 * Returns a color for the given cluster index.
 * Uses the base palette for the first 8 clusters,
 * then generates additional colors by spacing hues dynamically.
 *
 * @param {number} index - the cluster/subsystem index
 * @returns {string} HSL or Hex color string
 */
export function getClusterColor(index) {
  if (index < CLUSTER_COLORS.length) {
    return CLUSTER_COLORS[index];
  }
  // Generate a color by spacing hue dynamically using golden angle spacing
  const extraIndex = index - CLUSTER_COLORS.length;
  const hue = Math.round((extraIndex * 137.5) % 360);
  return `hsl(${hue}, 70%, 60%)`;
}

/**
 * Assigns a cluster color to every node, based on which entry-point node
 * is the "ancestor" of that node.
 *
 * @param {Array} nodes  - raw nodes from graph-data.json
 * @param {Array} edges  - raw edges from graph-data.json
 * @returns {Object} map of nodeId -> clusterColor string
 */
export function buildClusterColorMap(nodes, edges) {
  // Find all entry point nodes (depth === 0)
  const entryPoints = nodes.filter(n => n.depth === 0);

  // Build an adjacency list: source -> [targets]
  const adjacency = {};
  edges.forEach(e => {
    if (!adjacency[e.source]) adjacency[e.source] = [];
    adjacency[e.source].push(e.target);
  });

  const colorMap = {};

  entryPoints.forEach((ep, index) => {
    const color = getClusterColor(index);

    // BFS from this entry point to find all reachable nodes
    const visited = new Set();
    const queue = [ep.id];
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++];
      if (visited.has(current)) continue;
      visited.add(current);

      // Assign color (entry point gets it; only set if not already set)
      if (!colorMap[current]) {
        colorMap[current] = color;
      }

      const neighbors = adjacency[current] || [];
      neighbors.forEach(n => {
        if (!visited.has(n)) queue.push(n);
      });
    }
  });

  return colorMap;
}
