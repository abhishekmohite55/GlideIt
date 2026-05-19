/**
 * CodeFlowPage — all Python function nodes on a pannable/zoomable canvas.
 * Uses React Flow + force-directed physics layout.
 */
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
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
import { toFlowEdges, toFlowNodes, applyFlowStyles } from '../utils/layout.js'
import { getElkLayout } from '../layout.js'
import { buildClusterColorMap } from '../clusterColors.js'
import { useSpacePan } from '../hooks/useSpacePan.js'
import { useKeyBindings } from '../hooks/useKeyBindings.js'
import { CanvasToolbar } from './CanvasToolbar.jsx'
import { LegendPanel } from './LegendPanel.jsx'

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
  const { fitView, setViewport, getViewport } = useReactFlow()

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

  const clusterColorMap = useMemo(
    () => buildClusterColorMap(filteredNodes, filteredEdges),
    [filteredNodes, filteredEdges]
  )

  const [selectedId, setSelectedId] = useState(null)
  const [showMinimap, setShowMinimap] = useState(true)
  const [showLegend, setShowLegend] = useState(false)
  const [layoutDir, setLayoutDir] = useState('DOWN')
  const [layoutTrigger, setLayoutTrigger] = useState(0)

  const [visibleDepth, setVisibleDepth] = useState(999)
  const maxDepth = useMemo(() => {
    return filteredNodes.reduce((max, n) => Math.max(max, n.depth ?? 0), 0)
  }, [filteredNodes])

  useEffect(() => {
    if (filteredNodes.length === 0) return
    const max = filteredNodes.reduce((m, n) => Math.max(m, n.depth ?? 0), 0)
    setVisibleDepth(max)
  }, [filteredNodes])

  useEffect(() => {
    const seen = localStorage.getItem('glideit-legend-seen')
    if (!seen) {
      setShowLegend(true)
      localStorage.setItem('glideit-legend-seen', '1')
    }
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const onToggleExpanded = useCallback((id) => {
    setNodes(nds => nds.map(n => {
      if (n.id === id) {
        return {
          ...n,
          data: {
            ...n.data,
            expanded: !n.data.expanded
          }
        }
      }
      return n
    }))
  }, [setNodes])

  const rawNodes = useMemo(
    () => toFlowNodes(filteredNodes, selectedId, clusterColorMap, onToggleExpanded),
    [filteredNodes, selectedId, clusterColorMap, onToggleExpanded]
  )
  const rawEdges = useMemo(
    () => toFlowEdges(filteredEdges, clusterColorMap),
    [filteredEdges, clusterColorMap]
  )

  useEffect(() => {
    if (rawNodes.length === 0) return

    const vNodes = rawNodes.filter(n => (n.data?.depth ?? 0) <= visibleDepth)
    const vNodeIds = new Set(vNodes.map(n => n.id))
    const vEdges = rawEdges.filter(e => vNodeIds.has(e.source) && vNodeIds.has(e.target))

    getElkLayout(vNodes, vEdges, layoutDir)
      .then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
        const { nodes: styledNodes, edges: styledEdges } = applyFlowStyles(layoutedNodes, layoutedEdges, selectedId, clusterColorMap)
        setNodes(styledNodes)
        setEdges(styledEdges)
      })
      .catch(err => console.error('ELK layout failed:', err))
  }, [rawNodes, rawEdges, selectedId, clusterColorMap, layoutDir, layoutTrigger, visibleDepth])

  const isPanning = useSpacePan()

  // Keybindings wiring
  const handleFitView = useCallback(() => {
    setVisibleDepth(maxDepth)
    fitView({ duration: 400, padding: 0.15 })
  }, [fitView, maxDepth])

  const handleSelectAll = useCallback(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      selected: true,
      style: { ...n.style, opacity: 1.0 }
    })))
  }, [setNodes])

  const handleDeselectAll = useCallback(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      selected: false,
      data: { ...n.data, expanded: false }
    })))
    setSelectedId(null)
  }, [setNodes])

  const handleExpandSelected = useCallback(() => {
    setNodes(nds => nds.map(n => {
      if (n.selected) {
        return {
          ...n,
          data: {
            ...n.data,
            expanded: !n.data.expanded
          }
        }
      }
      return n
    }))
  }, [setNodes])

  const handleJumpToEntries = useCallback(() => {
    const entryNodes = nodes.filter(n => n.data?.depth === 0)
    if (entryNodes.length > 0) {
      fitView({ nodes: entryNodes, duration: 500, padding: 0.2 })
    }
  }, [nodes, fitView])

  const handleResetLayout = useCallback(() => {
    setLayoutTrigger(prev => prev + 1)
  }, [])

  useKeyBindings({
    onFitView: handleFitView,
    onSelectAll: handleSelectAll,
    onDeselectAll: handleDeselectAll,
    onExpandSelected: handleExpandSelected,
    onToggleMinimap: () => setShowMinimap(v => !v),
    onToggleLegend: () => setShowLegend(v => !v),
    onToggleLayout: () => setLayoutDir(d => d === 'DOWN' ? 'RIGHT' : 'DOWN'),
    onResetLayout: handleResetLayout,
    onJumpToEntries: handleJumpToEntries,
  })

  // Arrow key scrolling listener
  useEffect(() => {
    const handleScroll = (e) => {
      const { dy } = e.detail
      const vp = getViewport()
      setViewport({ ...vp, y: vp.y - dy }, { duration: 100 })
    }
    window.addEventListener('glideit-scroll', handleScroll)
    return () => window.removeEventListener('glideit-scroll', handleScroll)
  }, [setViewport, getViewport])

  const hasFocalZoomed = useRef(false)

  // Focal Zoom effect on initial load
  useEffect(() => {
    if (nodes.length === 0 || hasFocalZoomed.current) return

    let focalNode = nodes.find(n => n.id.endsWith(':main') || n.id === 'main')
    if (!focalNode) {
      focalNode = nodes.find(n => n.data?.type === 'flask_route')
    }
    if (!focalNode && nodes.length > 0) {
      focalNode = nodes[0]
    }

    if (focalNode) {
      hasFocalZoomed.current = true
      const connectedTargets = edges.filter(e => e.source === focalNode.id).map(e => e.target)
      const connectedSources = edges.filter(e => e.target === focalNode.id).map(e => e.source)
      const connectedIds = new Set([focalNode.id, ...connectedTargets, ...connectedSources])
      
      const nodesToFocus = nodes.filter(n => connectedIds.has(n.id))
      
      const timer = setTimeout(() => {
        fitView({
          nodes: nodesToFocus,
          duration: 1000,
          padding: 0.3,
        })
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [nodes, edges, fitView])

  const onNodeClick = useCallback((_, node) => {
    setSelectedId(prev => prev === node.id ? null : node.id)
  }, [])

  const onPaneClick = useCallback(() => setSelectedId(null), [])
  const wrapperRef = useRef(null)

  // Native wheel event interceptor for Shift+Scroll horizontal pan
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const handleWheel = (e) => {
      if (e.shiftKey || e.altKey) {
        // Prevent ReactFlow's zoom
        e.stopPropagation()
        e.preventDefault()
        
        // Use deltaY for horizontal panning since mouse wheels often only have Y
        const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        const vp = getViewport()
        setViewport({ ...vp, x: vp.x - dx }, { duration: 0 })
      }
    }

    // Use capture: true to intercept before ReactFlow (d3-zoom)
    wrapper.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    return () => wrapper.removeEventListener('wheel', handleWheel, { capture: true })
  }, [getViewport, setViewport])

  if (filteredNodes.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Python nodes found</h2>
        <p>Run GlideIt against a Python codebase to see the Code Flow graph.</p>
      </div>
    )
  }

  return (
    <div
      ref={wrapperRef}
      className="flow-canvas-wrapper"
      style={{
        cursor: isPanning ? 'grab' : 'default',
        width: '100%',
        height: '100%',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        panOnDrag={isPanning}
        nodesDraggable={!isPanning}
        selectionOnDrag={!isPanning}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: { strokeWidth: 1.5 },
        }}
        attributionPosition="bottom-left"
        style={{ background: '#0F0F0F' }}
      >
        <Background color="#1a1a1a" gap={24} size={1} />
        <Controls
          className="flow-controls"
          showInteractive={false}
        />
        {showMinimap && (
          <MiniMap
            className="flow-minimap"
            nodeColor={minimapNodeColor}
            maskColor="rgba(0,0,0,0.6)"
            style={{ background: '#1A1A1A', border: '1px solid #333' }}
            width={160}
            height={100}
          />
        )}
      </ReactFlow>

      <CanvasToolbar
        visibleDepth={visibleDepth}
        maxDepth={maxDepth}
        onDepthChange={setVisibleDepth}
        layoutDirection={layoutDir}
        onLayoutToggle={() => setLayoutDir(d => d === 'DOWN' ? 'RIGHT' : 'DOWN')}
        nodeCount={nodes.length}
        edgeCount={edges.length}
      />

      {/* Legend toggle button */}
      <button
        onClick={() => setShowLegend(v => !v)}
        title="Legend & shortcuts (?)"
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '60px',
          zIndex: 20,
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: showLegend ? '#1E90FF' : 'rgba(26, 26, 26, 0.92)',
          border: '1px solid #333',
          color: showLegend ? '#fff' : '#888',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}
      >
        ?
      </button>

      {/* Legend panel */}
      <LegendPanel
        isOpen={showLegend}
        onClose={() => setShowLegend(false)}
      />
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
