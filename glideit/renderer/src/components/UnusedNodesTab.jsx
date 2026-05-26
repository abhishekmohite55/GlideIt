import PropTypes from 'prop-types'
import React, { useMemo } from 'react'

export default function UnusedNodesTab({ data, onNavigateToNode }) {
  const unused = useMemo(() => {
    if (!data) return []
    const { nodes, edges } = data
    return nodes.filter(n => {
      if (n.type !== 'python_function') return false
      const hasIncoming = edges.some(e => e.target === n.id)
      if (hasIncoming) return false
      if (n.name === 'main' || n.id.endsWith(':main')) return false
      return true
    })
  }, [data])

  if (unused.length === 0) {
    return (
      <div className="unused-empty">
        <p>No possibly unused functions detected.</p>
      </div>
    )
  }

  return (
    <div className="unused-tab">
      <div className="unused-header">
        <span className="unused-title">Possibly unused</span>
        <span className="unused-count">{unused.length}</span>
      </div>
      <div className="unused-list">
        {unused.map(node => (
          <button
            key={node.id}
            className="unused-item"
            onClick={() => onNavigateToNode?.(node.id)}
          >
            <code className="unused-item-name">{node.name}</code>
            <span className="unused-item-file">{node.file}:{node.line}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

UnusedNodesTab.propTypes = {
  data: PropTypes.object,
  onNavigateToNode: PropTypes.func,
}
