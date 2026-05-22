/**
 * JsxPage — React component nodes on a pannable canvas.
 * Uses the unified GraphCanvasPage component.
 */
import PropTypes from 'prop-types'
import React from 'react'
import GraphCanvasPage from './GraphCanvasPage.jsx'

function minimapNodeColor() {
  return '#AA00FF'
}

JsxPage.propTypes = {
  data: PropTypes.object.isRequired,
}

export default function JsxPage({ data }) {
  return (
    <GraphCanvasPage
      data={data}
      nodeTypeFilter={n => n.type === 'react_component'}
      edgeTypeFilter={(e, nodeIds) => e.type === 'render' && nodeIds.has(e.source) && nodeIds.has(e.target)}
      emptyStateTitle="No React components found"
      emptyStateMessage="Run GlideIt against a React/JSX codebase to see your component tree here."
      minimapNodeColor={minimapNodeColor}
      focalZoomStrategy="react"
    />
  )
}
