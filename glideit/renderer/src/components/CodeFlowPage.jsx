/**
 * CodeFlowPage — all Python function nodes on a pannable/zoomable canvas.
 * Uses the unified GraphCanvasPage component.
 */
import PropTypes from 'prop-types'
import React from 'react'
import GraphCanvasPage from './GraphCanvasPage.jsx'

const PYTHON_NODE_TYPES = new Set([
  'python_function',
  'flask_route',
  'python_class',
  'external_call',
])

function minimapNodeColor(node) {
  switch (node.data?.type) {
    case 'flask_route': return '#00C853'
    case 'python_function': return '#1E90FF'
    case 'python_class': return '#FF8C00'
    case 'external_call': return '#555555'
    default: return '#3A3A3A'
  }
}

CodeFlowPage.propTypes = {
  data: PropTypes.object.isRequired,
}

export default function CodeFlowPage({ data }) {
  return (
    <GraphCanvasPage
      data={data}
      nodeTypeFilter={PYTHON_NODE_TYPES}
      edgeTypeFilter={null}
      emptyStateTitle="No Python nodes found"
      emptyStateMessage="Run GlideIt against a Python codebase to see the Code Flow graph."
      minimapNodeColor={minimapNodeColor}
      focalZoomStrategy="python"
    />
  )
}
