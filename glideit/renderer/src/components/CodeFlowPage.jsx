/**
 * CodeFlowPage — all Python function nodes on a pannable/zoomable canvas.
 * Uses React Flow + force-directed physics layout.
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

const PYTHON_NODE_TYPES = new Set([
  'python_function',
  'flask_route',
  'python_class',
  'external_call',
])

function CodeFlowContent({ data }) {
  const { nodes: graphNodes, edges: graphEdges } = data
  const { fitView } = useReactFlow()

  // Filter to Python-relevant nodes
  const filteredNodes = useMemo(
    () => graphNodes.filter(n => PYTHON_NODE_TYPES.has(n.type)),
    [graphNodes]
  )
  const nodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes])
  const filteredEdges = useMemo(
    () => graphEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)),
    [graphEdges, nodeIds]
  )

  const [selectedId, setSelectedId] = useState(null)

  const { nodes: laid, edges: laidEdges } = useMemo(() => {
    const flowNodes = toFlowNodes(filteredNodes, selectedId)
    const flowEdges = toFlowEdges(filteredEdges)
    // Apply organic force layout instead of dagre
    return applyForceLayout(flowNodes, flowEdges)
  }, [filteredNodes, filteredEdges, selectedId])

  const [nodes, setNodes, onNodesChange] = useNodesState(laid)
  const [edges, setEdges, onEdgesChange] = useEdgesState(laidEdges)

  useEffect(() => {
    setNodes(laid)
    setEdges(laidEdges)
  }, [laid, laidEdges])

  // Focal Zoom effect on initial load
  useEffect(() => {
    let focalNode = laid.find(n => n.id.endsWith(':main') || n.id === 'main')
    if (!focalNode) {
      focalNode = laid.find(n => n.data?.type === 'flask_route')
    }
    if (!focalNode && laid.length > 0) {
      focalNode = laid[0]
    }

    if (focalNode) {
      const connectedTargets = laidEdges.filter(e => e.source === focalNode.id).map(e => e.target)
      const connectedSources = laidEdges.filter(e => e.target === focalNode.id).map(e => e.source)
      const connectedIds = new Set([focalNode.id, ...connectedTargets, ...connectedSources])
      
      const nodesToFocus = laid.filter(n => connectedIds.has(n.id))
      
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
        <h2>No Python nodes found</h2>
        <p>Run GlideIt against a Python codebase to see the Code Flow graph.</p>
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
        <Controls
          className="flow-controls"
          showInteractive={false}
        />
        <MiniMap
          className="flow-minimap"
          nodeColor={minimapNodeColor}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: '#1A1A1A', border: '1px solid #333' }}
          width={160}
          height={100}
        />
      </ReactFlow>

      <div className="canvas-stats">
        <span>{filteredNodes.length} nodes</span>
        <span className="stats-sep">·</span>
        <span>{filteredEdges.length} edges</span>
        {selectedId && (
          <>
            <span className="stats-sep">·</span>
            <span className="stats-selected">1 selected</span>
          </>
        )}
      </div>
    </div>
  )
}

function minimapNodeColor(node) {
  switch (node.data?.type) {
    case 'flask_route': return '#00C853'
    case 'python_function': return '#1E90FF'
    case 'python_class': return '#FF8C00'
    case 'external_call': return '#555555'
    default: return '#3A3A3A'
  }
}

export default function CodeFlowPage({ data }) {
  return (
    <ReactFlowProvider>
      <CodeFlowContent data={data} />
    </ReactFlowProvider>
  )
}
