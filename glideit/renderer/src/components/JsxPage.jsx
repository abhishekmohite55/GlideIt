/**
 * JsxPage — React component nodes on a pannable canvas.
 * Page-level components (not rendered by any other) are root nodes.
 * Edges represent render relationships.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import GlideNode from './GlideNode.jsx'
import ParallelEdge from './ParallelEdge.jsx'
import { applyForceLayout, toFlowEdges, toFlowNodes } from '../utils/layout.js'

const NODE_TYPES = { glideNode: GlideNode }
const EDGE_TYPES = { parallel: ParallelEdge }

function JsxContent({ data }) {
  const { nodes: graphNodes, edges: graphEdges } = data
  const { fitView } = useReactFlow()

  const filteredNodes = useMemo(
    () => graphNodes.filter(n => n.type === 'react_component'),
    [graphNodes]
  )
  const nodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes])
  const filteredEdges = useMemo(
    () => graphEdges.filter(
      e => e.type === 'render' && nodeIds.has(e.source) && nodeIds.has(e.target)
    ),
    [graphEdges, nodeIds]
  )

  const [selectedId, setSelectedId] = useState(null)

  const { nodes: laid, edges: laidEdges } = useMemo(() => {
    const flowNodes = toFlowNodes(filteredNodes, selectedId)
    const flowEdges = toFlowEdges(filteredEdges)
    return applyForceLayout(flowNodes, flowEdges)
  }, [filteredNodes, filteredEdges, selectedId])

  const [nodes, setNodes, onNodesChange] = useNodesState(laid)
  const [edges, setEdges, onEdgesChange] = useEdgesState(laidEdges)

  useEffect(() => {
    setNodes(laid)
    setEdges(laidEdges)
  }, [laid, laidEdges])

  // Focal Zoom effect for React components
  useEffect(() => {
    // Find page/root components (depth = 0 or lowest in-degree)
    const incomingEdgeTargets = new Set(laidEdges.map(e => e.target))
    let roots = laid.filter(n => !incomingEdgeTargets.has(n.id))
    
    // Fallback if there are circular references or no obvious roots
    if (roots.length === 0 && laid.length > 0) {
      roots = [laid[0]]
    }

    if (roots.length > 0) {
      const rootIds = new Set(roots.map(r => r.id))
      // Add first-level children
      laidEdges.filter(e => rootIds.has(e.source)).forEach(e => rootIds.add(e.target))
      
      const nodesToFocus = laid.filter(n => rootIds.has(n.id))
      
      const timer = setTimeout(() => {
        fitView({
          nodes: nodesToFocus,
          duration: 1000,
          padding: 0.3,
        })
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [laid, laidEdges, fitView])

  const onNodeClick = useCallback((_, node) => {
    setSelectedId(prev => prev === node.id ? null : node.id)
  }, [])

  const onPaneClick = useCallback(() => setSelectedId(null), [])

  if (filteredNodes.length === 0) {
    return (
      <div className="empty-state">
        <h2>No React components found</h2>
        <p>Run GlideIt against a React/JSX codebase to see your component tree here.</p>
      </div>
    )
  }

  return (
    <div className="flow-canvas-wrapper">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
        style={{ background: '#0F0F0F' }}
      >
        <Background color="#1a1a1a" gap={24} size={1} />
        <Controls className="flow-controls" showInteractive={false} />
        <MiniMap
          className="flow-minimap"
          nodeColor={() => '#AA00FF'}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: '#1A1A1A', border: '1px solid #333' }}
          width={160}
          height={100}
        />
      </ReactFlow>

      <div className="canvas-stats">
        <span>{filteredNodes.length} components</span>
        <span className="stats-sep">·</span>
        <span>{filteredEdges.length} render relationships</span>
      </div>
    </div>
  )
}

export default function JsxPage({ data }) {
  return (
    <ReactFlowProvider>
      <JsxContent data={data} />
    </ReactFlowProvider>
  )
}
