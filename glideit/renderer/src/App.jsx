import React, { useState, useEffect, useCallback } from 'react'
import TopBar from './components/TopBar.jsx'
import LeftPanel from './components/LeftPanel.jsx'
import GraphCanvasPage from './components/GraphCanvasPage.jsx'
import RightPanel from './components/RightPanel.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import logoUrl from './Logo.png'

async function fetchJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url} (${r.status})`)
  return r.json()
}

const ARCHIVES_URL = './archives/index.json'

const PYTHON_NODE_TYPES = new Set([
  'python_function',
  'flask_route',
  'python_class',
  'external_call',
])

function pythonMinimapColor(node) {
  switch (node.data?.type) {
    case 'flask_route': return '#00C853'
    case 'python_function': return '#1E90FF'
    case 'python_class': return '#FF8C00'
    case 'external_call': return '#555555'
    default: return '#3A3A3A'
  }
}

function reactMinimapColor() {
  return '#AA00FF'
}

const PANEL_MIN = { left: 220, right: 280 }
const PANEL_MAX = { left: 400, right: 500 }
const PANEL_DEFAULT = { left: 260, right: 340 }

export default function App() {
  const [canvasToggle, setCanvasToggle] = useState('codeflow')
  const [apiViewMode, setApiViewMode] = useState('graph')
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [archives, setArchives] = useState([])
  const [activeArchive, setActiveArchive] = useState(null)
  const [activeRightTab, setActiveRightTab] = useState('health')
  const [highlightNodeId, setHighlightNodeId] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [leftPanelWidth, setLeftPanelWidth] = useState(PANEL_DEFAULT.left)
  const [rightPanelWidth, setRightPanelWidth] = useState(PANEL_DEFAULT.right)
  const [activeFile, setActiveFile] = useState(null)
  const [navigationOrigin, setNavigationOrigin] = useState(null)
  const [expandToPath, setExpandToPath] = useState(null)

  const gitInfo = graphData?.meta?.git || null
  const allNodes = graphData?.nodes || []
  const allEdges = graphData?.edges || []

  const selectedNode = allNodes.find(n => n.id === selectedNodeId) ?? null

  // ── Graph filters based on canvasToggle ──
  const graphFilters = (() => {
    if (canvasToggle === 'codeflow') {
      return {
        nodeTypeFilter: PYTHON_NODE_TYPES,
        edgeTypeFilter: null,
        emptyStateTitle: 'No Python nodes found',
        emptyStateMessage: 'Run GlideIt against a Python codebase to see the Code Flow graph.',
        minimapNodeColor: pythonMinimapColor,
        focalZoomStrategy: 'python',
      }
    }
    if (canvasToggle === 'jsx') {
      return {
        nodeTypeFilter: n => n.type === 'react_component',
        edgeTypeFilter: (e, nodeIds) => e.type === 'render' && nodeIds.has(e.source) && nodeIds.has(e.target),
        emptyStateTitle: 'No React components found',
        emptyStateMessage: 'Run GlideIt against a React/JSX codebase to see your component tree here.',
        minimapNodeColor: reactMinimapColor,
        focalZoomStrategy: 'react',
      }
    }
    // api view
    return {
      nodeTypeFilter: new Set(['flask_route']),
      edgeTypeFilter: null,
      emptyStateTitle: 'No API routes found',
      emptyStateMessage: 'Run GlideIt against a Flask project to see API endpoints.',
      minimapNodeColor: pythonMinimapColor,
      focalZoomStrategy: 'python',
    }
  })()

  // ── Data loading ──
  const loadCurrentGraph = useCallback(() => {
    if (globalThis.__GLIDEIT_DATA__) {
      setGraphData(globalThis.__GLIDEIT_DATA__)
      setActiveArchive(null)
      setLoading(false)
      return Promise.resolve()
    }
    return fetchJson('./graph-data.json')
      .then(data => {
        setGraphData(data)
        setActiveArchive(null)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchJson(ARCHIVES_URL)
      .then(list => setArchives(list))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadCurrentGraph()
  }, [loadCurrentGraph])

  function handleSelectArchive(archive) {
    if (!archive) { loadCurrentGraph(); return }
    setLoading(true)
    fetchJson(`./archives/${archive.filename}`)
      .then(data => {
        setGraphData(data)
        setActiveArchive(archive)
        setLoading(false)
      })
      .catch(err => {
        setError(`Failed to load archive: ${err.message}`)
        setLoading(false)
      })
  }

  function handleDeleteArchive(archiveId) {
    fetch(`/api/archives/${archiveId}`, { method: 'DELETE' })
      .then(r => {
        if (!r.ok) throw new Error('Delete failed')
        setArchives(prev => prev.filter(a => a.id !== archiveId))
        if (activeArchive?.id === archiveId) loadCurrentGraph()
      })
      .catch(() => {
        alert('Deletion is only supported when running locally (glideit serve).')
      })
  }

  // ── Cross-panel navigation ──
  const handleFileSelect = useCallback((filePath) => {
    setActiveFile(filePath)
    const firstNode = allNodes.find(n => n.file === filePath)
    if (firstNode) {
      setHighlightNodeId(firstNode.id)
      const targetType = filePath?.endsWith('.py') ? 'codeflow' : 'jsx'
      setCanvasToggle(targetType)
      setApiViewMode('graph')
    }
  }, [allNodes])

  const handleShowInGraph = useCallback((nodeId, targetToggle) => {
    setHighlightNodeId(nodeId)
    if (targetToggle) setCanvasToggle(targetToggle)
    setApiViewMode('graph')
    setNavigationOrigin('issue')
    setActiveRightTab('code')
    const node = allNodes.find(n => n.id === nodeId)
    if (node?.file) {
      setExpandToPath(node.file)
      setActiveFile(node.file)
    }
  }, [allNodes])

  const handleHighlightConsumed = useCallback(() => {
    setHighlightNodeId(null)
  }, [])

  const handleBackToIssues = useCallback(() => {
    setActiveRightTab('health')
  }, [])

  const handleExpandToPathConsumed = useCallback(() => {
    setExpandToPath(null)
  }, [])

  // ── Resizable panel handlers ──
  const [resizing, setResizing] = useState(null)

  const handleMouseDown = useCallback((panel) => (e) => {
    e.preventDefault()
    setResizing(panel)
  }, [])

  useEffect(() => {
    if (!resizing) return
    const handleMouseMove = (e) => {
      if (resizing === 'left') {
        setLeftPanelWidth(w => Math.max(PANEL_MIN.left, Math.min(PANEL_MAX.left, w + e.movementX)))
      } else if (resizing === 'right') {
        setRightPanelWidth(w => Math.max(PANEL_MIN.right, Math.min(PANEL_MAX.right, w - e.movementX)))
      }
    }
    const handleMouseUp = () => setResizing(null)
    globalThis.addEventListener('mousemove', handleMouseMove)
    globalThis.addEventListener('mouseup', handleMouseUp)
    return () => {
      globalThis.removeEventListener('mousemove', handleMouseMove)
      globalThis.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing])

  // ── Selected node change from canvas ──
  const handleSelectedNodeChange = useCallback((nodeId) => {
    setSelectedNodeId(nodeId)
    if (nodeId) {
      setActiveRightTab('code')
      setNavigationOrigin('node')
    }
  }, [])

  // ── Render ──
  if (loading) {
    return (
      <div className="loading-screen">
        <img src={logoUrl} alt="GlideIt" className="loading-logo" />
        <span className="loading-text">Analyzing your codebase</span>
        <div className="loading-shimmer-bar" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>{'\u26A0'} Failed to load graph data</h2>
        <p>{error}</p>
        <p className="error-hint">
          Make sure <code>graph-data.json</code> is in the same directory as this file.
        </p>
      </div>
    )
  }

  if (!graphData) return null

  return (
    <div className="app-root">
      {/* Top Bar */}
      <TopBar
        archives={archives}
        activeArchive={activeArchive}
        onSelectArchive={handleSelectArchive}
        onDeleteArchive={handleDeleteArchive}
        gitInfo={gitInfo}
      />

      {/* Main 3-panel layout */}
      <div className="main-layout">
        {/* Left panel */}
        <div className="main-left" style={{ width: leftPanelWidth }}>
          <LeftPanel
            data={graphData}
            gitInfo={gitInfo}
            activeFile={activeFile}
            onFileSelect={handleFileSelect}
            expandToPath={expandToPath}
            onExpandToPathConsumed={handleExpandToPathConsumed}
          />
        </div>

        {/* Left drag handle */}
        <div
          className="panel-drag-handle"
          onMouseDown={handleMouseDown('left')}
          style={{ cursor: 'col-resize' }}
        />

        {/* Center canvas */}
        <div className="main-center">
          <ErrorBoundary>
            <GraphCanvasPage
              data={graphData}
              {...graphFilters}
              canvasToggle={canvasToggle}
              onToggleChange={setCanvasToggle}
              apiViewMode={apiViewMode}
              onApiViewModeChange={setApiViewMode}
              highlightNodeId={highlightNodeId}
              onHighlightConsumed={handleHighlightConsumed}
              selectedNodeId={selectedNodeId}
              onSelectedNodeChange={handleSelectedNodeChange}
            />
          </ErrorBoundary>
        </div>

        {/* Right drag handle */}
        <div
          className="panel-drag-handle"
          onMouseDown={handleMouseDown('right')}
          style={{ cursor: 'col-resize' }}
        />

        {/* Right panel */}
        <div className="main-right" style={{ width: rightPanelWidth }}>
          <RightPanel
            activeTab={activeRightTab}
            onTabChange={setActiveRightTab}
            data={graphData}
            selectedNode={selectedNode}
            allNodes={allNodes}
            allEdges={allEdges}
            isServerMode={typeof globalThis.__GLIDEIT_DATA__ === 'undefined'}
            onNavigateToNode={handleShowInGraph}
            onShowInGraph={handleShowInGraph}
            onClose={() => setSelectedNodeId(null)}
            navigationOrigin={navigationOrigin}
            onBackToIssues={handleBackToIssues}
          />
        </div>
      </div>
    </div>
  )
}
