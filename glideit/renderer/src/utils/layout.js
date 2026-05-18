/**
 * Layout utility using d3-force physics for organic, non-overlapping node placement.
 */
import * as d3 from 'd3-force';

const NODE_WIDTH = 260
const NODE_HEIGHT = 90

/**
 * Compute organic physics layout for nodes/edges.
 * Replaces hierarchical dagre layout to fix flat lines and overlapping.
 */
export function applyForceLayout(nodes, edges) {
  // 1. BFS to partition nodes into connected components (clusters)
  const adj = {};
  nodes.forEach(n => {
    adj[n.id] = [];
  });
  edges.forEach(e => {
    if (adj[e.source] && adj[e.target]) {
      adj[e.source].push(e.target);
      adj[e.target].push(e.source);
    }
  });

  const visited = new Set();
  const clusters = [];
  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      const cluster = [];
      const queue = [n.id];
      visited.add(n.id);
      while (queue.length > 0) {
        const curr = queue.shift();
        cluster.push(curr);
        const neighbors = adj[curr] || [];
        neighbors.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
      clusters.push(cluster);
    }
  });

  // Sort by size descending
  clusters.sort((a, b) => b.length - a.length);

  const PALETTE = [
    '#1E90FF', // Neon Blue
    '#00C853', // Emerald Green
    '#AA00FF', // Indigo Purple
    '#FF8C00', // Amber Gold
    '#FF2E93', // Rose Pink
    '#00BFA5', // Ocean Teal
    '#FF3D00', // Coral Red
  ];

  const nodeClusterColors = {};
  clusters.forEach((cluster, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    cluster.forEach(nodeId => {
      nodeClusterColors[nodeId] = color;
    });
  });

  // 2. Identify the selected node
  const selectedNode = nodes.find(n => n.data?.selected);
  const selectedId = selectedNode ? selectedNode.id : null;

  // Find direct child nodes of the selected parent
  const directChildrenIds = new Set();
  if (selectedId) {
    edges.forEach(e => {
      if (e.source === selectedId) {
        directChildrenIds.add(e.target);
      }
    });
  }

  // 3. Deep clone nodes to avoid mutating React state objects directly in d3
  const simNodes = nodes.map(n => ({ ...n, x: 0, y: 0 }))
  
  // Create edges mapping
  const simEdges = edges.map(e => ({ source: e.source, target: e.target }))

  // Run a static physics simulation to instantly settle nodes
  const simulation = d3.forceSimulation(simNodes)
    .force('charge', d3.forceManyBody().strength(-800)) // Balanced repulsion
    .force('collide', d3.forceCollide().radius(140)) // Tighten collision boundary to keep nodes snug
    .force('center', d3.forceCenter(0, 0)) // Pool connected components in center
    .force('link', d3.forceLink(simEdges).id(d => d.id).distance(180).strength(1.2)) // Tightly pull connected nodes
    .force('x', d3.forceX(0).strength(0.08)) // Horizontal gravity to keep nodes compact
    .force('y', d3.forceY(0).strength(0.08)) // Vertical gravity to keep nodes compact
    .stop();

  // Tick the simulation offline to compute final static coordinates
  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  // 4. Map computed coordinates, cluster colors, and dynamic opacities to nodes
  const positionedNodes = nodes.map((n, i) => {
    const color = nodeClusterColors[n.id] || '#3A3A3A';
    
    let opacity = 1.0;
    if (selectedId) {
      if (n.id === selectedId || directChildrenIds.has(n.id)) {
        opacity = 1.0;
      } else {
        opacity = 0.35;
      }
    }

    return {
      ...n,
      data: {
        ...n.data,
        clusterColor: color,
        selected: n.id === selectedId,
      },
      style: {
        ...n.style,
        opacity: opacity,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      },
      position: {
        x: simNodes[i].x - NODE_WIDTH / 2,
        y: simNodes[i].y - NODE_HEIGHT / 2,
      }
    };
  });

  // 5. Update edges styling dynamically based on selection
  const updatedEdges = edges.map(e => {
    let style = { ...e.style };
    let animated = e.animated;
    let markerEnd = { ...e.markerEnd };

    if (selectedId) {
      if (e.source === selectedId) {
        const color = nodeClusterColors[selectedId] || '#1E90FF';
        style = {
          ...style,
          stroke: color,
          strokeWidth: 2.5,
          opacity: 1.0,
        };
        animated = true;
        markerEnd = {
          ...markerEnd,
          color: color,
        };
      } else {
        style = {
          ...style,
          opacity: 0.1,
        };
        animated = false;
      }
    }

    return {
      ...e,
      style,
      animated,
      markerEnd,
    };
  });

  return { nodes: positionedNodes, edges: updatedEdges };
}

/**
 * Convert graph-data.json nodes → React Flow node format.
 */
export function toFlowNodes(graphNodes, selectedId = null) {
  return graphNodes.map(n => ({
    id: n.id,
    type: 'glideNode',
    data: { ...n, selected: n.id === selectedId },
    position: { x: 0, y: 0 }, // overwritten by physics engine
    draggable: true,
  }))
}

/**
 * Convert graph-data.json edges → React Flow edge format.
 */
export function toFlowEdges(graphEdges) {
  // Track how many edges connect the exact same source/target to fan them out
  const edgeCounts = {};
  
  return graphEdges.map(e => {
    // We sort the keys so A->B and B->A share the same routing offset lane
    const pairKey = [e.source, e.target].sort().join('|');
    if (!edgeCounts[pairKey]) edgeCounts[pairKey] = 0;
    
    // Assign lane offset
    const offset = edgeCounts[pairKey];
    edgeCounts[pairKey]++;

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.variable_name || '',
      type: e.type === 'circular_call' ? 'selfconnecting' : 'parallel',
      animated: false,
      style: edgeStyle(e.type),
      labelStyle: { fill: '#888', fontSize: 10 },
      labelBgStyle: { fill: 'transparent' },
      markerEnd: { type: 'arrowclosed', color: edgeColor(e.type) },
      data: { edgeType: e.type, offset: offset },
    }
  })
}

function edgeColor(type) {
  switch (type) {
    case 'circular_call': return '#ff4444'
    case 'render': return '#AA00FF'
    case 'call': return '#3A3A3A'
    default: return '#3A3A3A'
  }
}

function edgeStyle(type) {
  const base = { strokeWidth: 1.5 }
  switch (type) {
    case 'circular_call':
      return { ...base, stroke: '#ff4444', strokeDasharray: '5,3' }
    case 'nested_call':
      return { ...base, stroke: '#555555', strokeDasharray: '6,3' }
    case 'render':
      return { ...base, stroke: '#AA00FF' }
    case 'call':
      return { ...base, stroke: '#3A3A3A' }
    default:
      return { ...base, stroke: '#3A3A3A' }
  }
}
