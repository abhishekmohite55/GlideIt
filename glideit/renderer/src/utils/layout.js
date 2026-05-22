/**
 * Layout utilities for React Flow node/edge conversion and styling.
 */

const NODE_WIDTH = 260
const NODE_HEIGHT = 90

/**
 * Convert graph-data.json nodes → React Flow node format.
 */
export function toFlowNodes(graphNodes, selectedId = null, clusterColorMap = {}, onToggleExpanded = null) {
  // Build O(1) lookup map for finding main node
  const nodeByName = new Map()
  const nodeById = new Map()
  for (const n of graphNodes) {
    nodeByName.set(n.name, n)
    nodeById.set(n.id, n)
  }

  // Find main node using O(1) lookups
  let mainNodeId = null
  if (nodeByName.has('main')) {
    mainNodeId = nodeByName.get('main').id
  } else {
    // Check for ID ending with ':main'
    for (const id of nodeById.keys()) {
      if (id.endsWith(':main')) {
        mainNodeId = id
        break
      }
    }
  }

  return graphNodes.map(n => ({
    id: n.id,
    type: 'glideNode',
    data: {
      ...n,
      selected: n.id === selectedId,
      clusterColor: clusterColorMap[n.id] ?? null,
      onToggleExpanded,
      isMainNode: n.id === mainNodeId,
    },
    position: { x: 0, y: 0 },
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    draggable: true,
  }))
}

/**
 * Convert graph-data.json edges → React Flow edge format.
 */
export function toFlowEdges(graphEdges, clusterColorMap = {}) {
  // Track how many edges connect the exact same source/target to fan them out
  const edgeCounts = {};
  
  return graphEdges.map(e => {
    // We sort the keys so A->B and B->A share the same routing offset lane
    const pairKey = [e.source, e.target].sort((a, b) => a < b ? -1 : a > b ? 1 : 0).join('|');
    if (!edgeCounts[pairKey]) edgeCounts[pairKey] = 0;
    
    // Assign lane offset
    const offset = edgeCounts[pairKey];
    edgeCounts[pairKey]++;

    const clusterColor = clusterColorMap[e.source] ?? '#3A3A3A';

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.variable_name || '',
      type: e.type === 'circular_call' ? 'selfconnecting' : 'parallel',
      animated: false,
      style: {
        stroke: clusterColor,
        strokeWidth: e.type === 'nested_call' ? 1 : 1.5,
        strokeDasharray: e.type === 'nested_call' ? '5,4' : undefined,
        opacity: 0.65,
      },
      labelStyle: { fill: '#888', fontSize: 10 },
      labelBgStyle: { fill: 'transparent' },
      markerEnd: { type: 'arrowclosed', color: clusterColor },
      data: { edgeType: e.type, offset: offset },
    }
  })
}

/**
 * Apply styling (opacities, selections, cluster colors) to laid out flow graph.
 */
export function applyFlowStyles(nodes, edges, selectedId = null, clusterColorMap = {}, highlightedPathIds = null, highlightedEdgeKeys = null) {
  // Find direct child nodes of the selected parent
  const directChildrenIds = new Set();
  if (selectedId) {
    edges.forEach(e => {
      if (e.source === selectedId) {
        directChildrenIds.add(e.target);
      }
    });
  }

  const styledNodes = nodes.map(n => {
    let opacity = 1;
    if (highlightedPathIds) {
      if (highlightedPathIds.has(n.id)) {
        opacity = 1;
      } else {
        opacity = 0.2;
      }
    } else if (selectedId) {
      if (n.id === selectedId || directChildrenIds.has(n.id)) {
        opacity = 1;
      } else {
        opacity = 0.35;
      }
    }

    return {
      ...n,
      data: {
        ...n.data,
        selected: n.id === selectedId,
      },
      style: {
        ...n.style,
        opacity,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }
    };
  });

  const styledEdges = edges.map(e => {
    const clusterColor = clusterColorMap[e.source] ?? '#3A3A3A';
    let style = { ...e.style, stroke: clusterColor };
    let animated = e.animated;
    let markerEnd = { ...e.markerEnd };

    if (highlightedPathIds && highlightedEdgeKeys) {
      const isPathEdge = highlightedEdgeKeys.has(`${e.source}->${e.target}`);
      if (isPathEdge) {
        style = { ...style, stroke: clusterColor, strokeWidth: 2.5, opacity: 1 };
        animated = true;
        markerEnd = { ...markerEnd, color: clusterColor };
      } else {
        style = { ...style, opacity: 0.05 };
        animated = false;
      }
    } else if (selectedId) {
      if (e.source === selectedId) {
        style = { ...style, stroke: clusterColor, strokeWidth: 2.5, opacity: 1 };
        animated = true;
        markerEnd = { ...markerEnd, color: clusterColor };
      } else {
        style = { ...style, opacity: 0.1 };
        animated = false;
      }
    } else {
      style = { ...style, opacity: 0.65 };
    }

    return {
      ...e,
      style,
      animated,
      markerEnd,
    };
  });

  return { nodes: styledNodes, edges: styledEdges };
}
