import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

// Default ELK options for a clean hierarchical layout
const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '60',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.edgeRouting': 'ORTHOGONAL',
};

/**
 * Takes ReactFlow nodes and edges arrays.
 * Returns a Promise that resolves to { nodes, edges } with x/y positions set.
 *
 * @param {Array} nodes   - ReactFlow node objects
 * @param {Array} edges   - ReactFlow edge objects
 * @param {'DOWN'|'RIGHT'} direction - layout direction
 */
export async function getElkLayout(nodes, edges, direction = 'DOWN') {
  const options = { ...ELK_OPTIONS, 'elk.direction': direction };

  // Build the ELK graph format
  const elkGraph = {
    id: 'root',
    layoutOptions: options,
    children: nodes.map(node => ({
      id: node.id,
      width: node.width ?? 220,
      height: node.height ?? 80,
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  // Run the layout
  const layouted = await elk.layout(elkGraph);

  // Map the computed positions back onto the ReactFlow node objects
  const layoutedNodes = nodes.map(node => {
    const elkNode = layouted.children.find(c => c.id === node.id);
    return {
      ...node,
      position: {
        x: elkNode?.x ?? node.position?.x ?? 0,
        y: elkNode?.y ?? node.position?.y ?? 0,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
