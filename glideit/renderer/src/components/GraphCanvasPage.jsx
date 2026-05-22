/**
 * GraphCanvasPage — unified canvas component for both Python and React component graphs.
 * Accepts props to customize node filtering, focal zoom behavior, and legend descriptions.
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
import { findPathToRoot } from '../utils/findPathToRoot.js'
import { BreadcrumbBar } from './BreadcrumbBar.jsx'

const NODE_TYPES = { glideNode: GlideNode }
const EDGE_TYPES = { parallel: ParallelEdge }

function GraphCanvasContent({
  data,
  nodeTypeFilter,         // Set of node types to include, or a function
  edgeTypeFilter,         // Function to filter edges: (edge, nodeIds) => bool
  emptyStateTitle,
  emptyStateMessage,
  minimapNodeColor,       // Function: (node) => color string
  focalZoomStrategy,      // 'python' | 'react' | custom function
}) {
  const { nodes: graphNodes, edges: graphEdges } = data
  const { fitView, setViewport, getViewport, getNode, setCenter } = useReactFlow()

  // Filter nodes based on provided type filter
  const filteredNodes = useMemo(() => {
    if (typeof nodeTypeFilter === 'function') {
      return graphNodes.filter(nodeTypeFilter)
    }
    if (nodeTypeFilter instanceof Set) {
      return graphNodes.filter(n => nodeTypeFilter.has(n.type))
    }
    return graphNodes
  }, [graphNodes, nodeTypeFilter])

  const nodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes])

  // Filter edges based on provided edge filter
  const filteredEdges = useMemo(() => {
    if (typeof edgeTypeFilter === 'function') {
      return graphEdges.filter(e => edgeTypeFilter(e, nodeIds))
    }
    return graphEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
  }, [graphEdges, nodeIds, edgeTypeFilter])

  const clusterColorMap = useMemo(
    () => buildClusterColorMap(filteredNodes, filteredEdges),
    [filteredNodes, filteredEdges]
  )

  const [selectedId, setSelectedId] = useState(null)
  const [showMinimap, setShowMinimap] = useState(true)
  const [showLegend, setShowLegend] = useState(false)
  const [layoutDir, setLayoutDir] = useState('DOWN')
  const [layoutTrigger, setLayoutTrigger] = useState(0)

  useEffect(() => {
    const seen = localStorage.getItem('glideit-legend-seen')
    if (!seen) {
      setShowLegend(true)
      localStorage.setItem('glideit-legend-seen', '1')
    }
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const [layoutedNodes, setLayoutedNodes] = useState([])
  const [layoutedEdges, setLayoutedEdges] = useState([])
  const [layoutLoading, setLayoutLoading] = useState(true)

  const [hoveredPath, setHoveredPath] = useState([])
  const [lockedPath, setLockedPath] = useState(null)
  const hoverTimeoutRef = useRef(null)
  const pathCacheRef = useRef(new Map())

  useEffect(() => {
    pathCacheRef.current = new Map()
  }, [filteredNodes, filteredEdges])

  const getCachedPathToRoot = useCallback((nodeId) => {
    const cache = pathCacheRef.current
    if (cache.has(nodeId)) return cache.get(nodeId)
    const path = findPathToRoot(nodeId, filteredNodes, filteredEdges)
    cache.set(nodeId, path)
    return path
  }, [filteredNodes, filteredEdges])

  const highlightedPathIds = useMemo(() => {
    const path = hoveredPath.length > 0 ? hoveredPath : lockedPath
    if (!path || path.length === 0) return null
    return new Set(path.map(n => n.id))
  }, [hoveredPath, lockedPath])

  const highlightedEdgeKeys = useMemo(() => {
    const path = hoveredPath.length > 0 ? hoveredPath : lockedPath
    if (!path || path.length < 2) return null
    const keys = new Set()
    for (let i = 0; i < path.length - 1; i++) {
      const sourceId = path[i].id
      const targetId = path[i+1].id
      keys.add(`${sourceId}->${targetId}`)
    }
    return keys
  }, [hoveredPath, lockedPath])

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

  // Layout runner
  useEffect(() => {
    if (rawNodes.length === 0) return
    setLayoutLoading(true)

    getElkLayout(rawNodes, rawEdges, layoutDir)
      .then(({ nodes: outNodes, edges: outEdges }) => {
        setLayoutedNodes(outNodes)
        setLayoutedEdges(outEdges)
        setLayoutLoading(false)
      })
      .catch(err => {
        console.error('ELK layout failed:', err)
        setLayoutLoading(false)
      })
  }, [rawNodes, rawEdges, layoutDir, layoutTrigger])

  // Styling applier
  useEffect(() => {
    if (layoutedNodes.length === 0) return
    const { nodes: styledNodes, edges: styledEdges } = applyFlowStyles(
      layoutedNodes,
      layoutedEdges,
      selectedId,
      clusterColorMap,
      highlightedPathIds,
      highlightedEdgeKeys
    )
    setNodes(styledNodes)
    setEdges(styledEdges)
  }, [layoutedNodes, layoutedEdges, selectedId, clusterColorMap, highlightedPathIds, highlightedEdgeKeys, setNodes, setEdges])

  const isPanning = useSpacePan()

  // Keybindings wiring
  const handleFitView = useCallback(() => {
    fitView({ duration: 400, padding: 0.15 })
  }, [fitView])

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
    setLockedPath(null)
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
      const { dx = 0, dy = 0 } = e.detail
      const vp = getViewport()
      setViewport({ x: vp.x - dx, y: vp.y - dy }, { duration: 100 })
    }
    window.addEventListener('glideit-scroll', handleScroll)
    return () => window.removeEventListener('glideit-scroll', handleScroll)
  }, [setViewport, getViewport])

  const hasFocalZoomed = useRef(false)

  // Focal Zoom effect on initial load
  useEffect(() => {
    if (nodes.length === 0 || layoutLoading || hasFocalZoomed.current) return

    let nodesToFocus = []

    if (typeof focalZoomStrategy === 'function') {
      nodesToFocus = focalZoomStrategy(nodes, edges)
    } else if (focalZoomStrategy === 'python') {
      let focalNode = nodes.find(n => n.id.endsWith(':main') || n.id === 'main')
      if (!focalNode) {
        focalNode = nodes.find(n => n.data?.type === 'flask_route')
      }
      if (!focalNode && nodes.length > 0) {
        focalNode = nodes[0]
      }
      if (focalNode) {
        const connectedTargets = edges.filter(e => e.source === focalNode.id).map(e => e.target)
        const connectedSources = edges.filter(e => e.target === focalNode.id).map(e => e.source)
        const connectedIds = new Set([focalNode.id, ...connectedTargets, ...connectedSources])
        nodesToFocus = nodes.filter(n => connectedIds.has(n.id))
      }
    } else if (focalZoomStrategy === 'react') {
      const incomingEdgeTargets = new Set(edges.map(e => e.target))
      let roots = nodes.filter(n => !incomingEdgeTargets.has(n.id))
      if (roots.length === 0 && nodes.length > 0) {
        roots = [nodes[0]]
      }
      if (roots.length > 0) {
        const rootIds = new Set(roots.map(r => r.id))
        edges.filter(e => rootIds.has(e.source)).forEach(e => rootIds.add(e.target))
        nodesToFocus = nodes.filter(n => rootIds.has(n.id))
      }
    }

    if (nodesToFocus.length > 0) {
      hasFocalZoomed.current = true
      const timer = setTimeout(() => {
        fitView({
          nodes: nodesToFocus,
          duration: 1000,
          padding: 0.3,
        })
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [nodes, edges, fitView, layoutLoading, focalZoomStrategy])

  const handleBreadcrumbNodeClick = useCallback((nodeId) => {
    const node = getNode(nodeId)
    if (!node) return
    setCenter(
      node.position.x + (node.width ?? 260) / 2,
      node.position.y + (node.height ?? 90) / 2,
      { zoom: 1.2, duration: 400 }
    )
  }, [getNode, setCenter])

  const onNodeClick = useCallback((e, node) => {
    if (e.shiftKey) {
      setLockedPath(prev => {
        if (prev && prev[prev.length - 1]?.id === node.id) {
          return null
        }
        return findPathToRoot(node.id, filteredNodes, filteredEdges)
      })
    } else {
      setSelectedId(prev => prev === node.id ? null : node.id)
    }
  }, [filteredNodes, filteredEdges])

  const onPaneClick = useCallback(() => {
    setSelectedId(null)
    setLockedPath(null)
  }, [])

  const wrapperRef = useRef(null)

  // Prevent page scroll on wheel events inside the canvas
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const handleWheel = (e) => {
      e.preventDefault()

      if (e.shiftKey || e.altKey) {
        e.stopPropagation()
        const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        const vp = getViewport()
        setViewport({ ...vp, x: vp.x - dx }, { duration: 0 })
      }
    }

    wrapper.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    return () => wrapper.removeEventListener('wheel', handleWheel, { capture: true })
  }, [getViewport, setViewport])

  // Clear hover timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  if (filteredNodes.length === 0) {
    return (
      <div className="empty-state">
        <h2>{emptyStateTitle}</h2>
        <p>{emptyStateMessage}</p>
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
      <BreadcrumbBar
        path={hoveredPath.length > 0 ? hoveredPath : (lockedPath || [])}
        onNodeClick={handleBreadcrumbNodeClick}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeMouseEnter={(_, node) => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
          }
          hoverTimeoutRef.current = setTimeout(() => {
            setHoveredPath(getCachedPathToRoot(node.id))
          }, 500)
        }}
        onNodeMouseLeave={() => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
          }
          setHoveredPath([])
        }}
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

      {layoutLoading && (
        <div className="layout-loading-overlay">
          <div className="loading-spinner" />
          <span>Computing layout…</span>
        </div>
      )}

      <CanvasToolbar
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

export default function GraphCanvasPage(props) {
  return (
    <ReactFlowProvider>
      <GraphCanvasContent {...props} />
    </ReactFlowProvider>
  )
}
