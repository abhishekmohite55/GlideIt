import PropTypes from 'prop-types'
import React from 'react'
import SecurityHealthTab from './SecurityHealthTab.jsx'
import CodeSnippetTab from './CodeSnippetTab.jsx'
import UnusedNodesTab from './UnusedNodesTab.jsx'

const TABS = [
  { id: 'health', label: 'Health', icon: '\uD83D\uDEE1\uFE0F' },
  { id: 'code', label: 'Code', icon: '\u2039/\u203A' },
  { id: 'unused', label: 'Unused', icon: '\u26A0' },
]

export default function RightPanel({
  activeTab,
  onTabChange,
  data,
  selectedNode,
  allNodes,
  allEdges,
  isServerMode,
  onNavigateToNode,
  onShowInGraph,
  onClose,
  navigationOrigin,
  onBackToIssues,
}) {
  const health = data?.health || null
  const errorCount = health?.summary?.ERROR || 0
  const warnCount = health?.summary?.WARNING || 0
  const edges = data?.edges || []
  const nodes = data?.nodes || []
  const targets = new Set(edges.map(e => e.target))
  const unusedCount = nodes.filter(n => !targets.has(n.id)).length

  function getDotColor(tabId) {
    if (tabId === 'health') {
      if (errorCount > 0) return '#FF4444'
      if (warnCount > 0) return '#FF8C00'
      return null
    }
    if (tabId === 'unused') {
      return unusedCount > 0 ? '#FBBF24' : null
    }
    return null
  }

  return (
    <div className="right-panel">
      <div className="right-panel-tabs">
        {TABS.map(tab => {
          const dotColor = getDotColor(tab.id)
          return (
            <button
              key={tab.id}
              className={`right-panel-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
              {dotColor && <span className="tab-dot" style={{ background: dotColor }} />}
            </button>
          )
        })}
      </div>

      <div className="right-panel-content">
        {activeTab === 'health' && (
          <SecurityHealthTab
            data={data}
            onShowInGraph={onShowInGraph}
          />
        )}
        {activeTab === 'code' && (
          <CodeSnippetTab
            node={selectedNode}
            allNodes={allNodes}
            allEdges={allEdges}
            onNavigateToNode={onNavigateToNode}
            isServerMode={isServerMode}
            onClose={onClose}
            navigationOrigin={navigationOrigin}
            onBackToIssues={onBackToIssues}
          />
        )}
        {activeTab === 'unused' && (
          <UnusedNodesTab
            data={data}
            onNavigateToNode={onNavigateToNode}
          />
        )}
      </div>
    </div>
  )
}

RightPanel.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  data: PropTypes.object,
  selectedNode: PropTypes.object,
  allNodes: PropTypes.array,
  allEdges: PropTypes.array,
  isServerMode: PropTypes.bool,
  onNavigateToNode: PropTypes.func,
  onShowInGraph: PropTypes.func,
  onClose: PropTypes.func,
  navigationOrigin: PropTypes.string,
  onBackToIssues: PropTypes.func,
}
