/**
 * ApiPage — shows only Flask route nodes.
 * Grouped by blueprint prefix if present.
 * Each card shows HTTP method badge, route path, handler name.
 * Expanding shows the call chain detected from the graph.
 */
import PropTypes from 'prop-types'
import { useMemo, useState } from 'react'

const METHOD_COLORS = {
  GET:    { bg: 'rgba(0,200,83,0.15)', border: '#00C853', text: '#00C853' },
  POST:   { bg: 'rgba(30,144,255,0.15)', border: '#1E90FF', text: '#1E90FF' },
  PUT:    { bg: 'rgba(255,140,0,0.15)', border: '#FF8C00', text: '#FF8C00' },
  DELETE: { bg: 'rgba(255,51,51,0.15)', border: '#FF3333', text: '#FF3333' },
  PATCH:  { bg: 'rgba(170,0,255,0.15)', border: '#AA00FF', text: '#AA00FF' },
}

HttpBadge.propTypes = {
  method: PropTypes.string,
}

function HttpBadge({ method }) {
  const m = (method || 'GET').split(',')[0].trim()
  const style = METHOD_COLORS[m] || METHOD_COLORS.GET
  return (
    <span
      className="api-method-badge"
      style={{ background: style.bg, borderColor: style.border, color: style.text }}
    >
      {m}
    </span>
  )
}

RouteCard.propTypes = {
  route: PropTypes.object,
  allNodes: PropTypes.array,
  allEdges: PropTypes.array,
}

function RouteCard({ route, allNodes, allEdges }) {
  const [expanded, setExpanded] = useState(false)

  // Find outgoing calls from this route
  const outEdges = useMemo(
    () => allEdges.filter(e => e.source === route.id && e.type !== 'circular_call'),
    [allEdges, route.id]
  )
  const callChain = useMemo(
    () => outEdges.map(e => allNodes.find(n => n.id === e.target)).filter(Boolean),
    [outEdges, allNodes]
  )

  const methods = (route.http_method || 'GET').split(',').map(m => m.trim())

  return (
    <div
      className={`api-card ${expanded ? 'api-card--expanded' : ''}`}
      id={`api-route-${route.id.replaceAll(/[^a-zA-Z0-9]/g, '-')}`}
    >
      {/* Card header */}
      <button
        className="api-card-header"
        onClick={() => setExpanded(p => !p)}
        aria-expanded={expanded}
      >
        <div className="api-card-methods">
          {methods.map(m => <HttpBadge key={m} method={m} />)}
        </div>
        <div className="api-card-path">{route.route_path || '/'}</div>
        <div className="api-card-handler">{route.name}</div>
        <span className="api-card-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="api-card-detail">
          {/* File info */}
          <div className="api-detail-row">
            <span className="api-detail-label">File</span>
            <code className="api-detail-value">{route.file}:{route.line}</code>
          </div>

          {/* Parameters */}
          {route.params?.length > 0 && (
            <div className="api-detail-row">
              <span className="api-detail-label">Parameters</span>
              <div>
                {route.params.map(p => (
                  <div key={p.name} className="api-detail-param">
                    <code>{p.name}</code>
                    {p.type_hint && <span className="param-type">: {p.type_hint}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Docstring */}
          {route.docstring && route.docstring !== 'No description available.' && (
            <div className="api-detail-row">
              <span className="api-detail-label">Description</span>
              <p className="api-detail-docstring">{route.docstring}</p>
            </div>
          )}

          {/* Call chain */}
          {callChain.length > 0 && (
            <div className="api-detail-row">
              <span className="api-detail-label">Calls</span>
              <div className="api-call-chain">
                {callChain.map((n) => (
                  <div key={n.id} className="api-call-chain-item">
                    <span className="call-chain-arrow">→</span>
                    <code className="call-chain-name">{n.name}</code>
                    <span className="call-chain-file">{n.file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ApiPage({ data }) {
  const { nodes, edges } = data

  const routes = useMemo(
    () => nodes.filter(n => n.type === 'flask_route'),
    [nodes]
  )

  // Group by blueprint prefix (first path segment)
  const grouped = useMemo(() => {
    const groups = {}
    for (const route of routes) {
      const path = route.route_path || '/'
      const segments = path.split('/').filter(Boolean)
      const prefix = segments.length > 1 ? `/${segments[0]}` : '/'
      if (!groups[prefix]) groups[prefix] = []
      groups[prefix].push(route)
    }
    return groups
  }, [routes])

  if (routes.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Flask routes found</h2>
        <p>
          GlideIt detects <code>@app.route</code> and <code>@blueprint.route</code> decorators.
          Run against a Flask project to see your API endpoints here.
        </p>
      </div>
    )
  }

  return (
    <div className="api-page">
      <div className="api-page-header">
        <h1 className="api-page-title">API Routes</h1>
        <span className="api-page-count">{routes.length} endpoint{routes.length !== 1 ? 's' : ''}</span>
      </div>

      {Object.entries(grouped).map(([prefix, groupRoutes]) => (
        <section key={prefix} className="api-group">
          <h2 className="api-group-label">{prefix}</h2>
          <div className="api-group-cards">
            {groupRoutes.map(route => (
              <RouteCard
                key={route.id}
                route={route}
                allNodes={nodes}
                allEdges={edges}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

ApiPage.propTypes = {
  data: PropTypes.shape({
    nodes: PropTypes.array,
    edges: PropTypes.array,
  }).isRequired,
}
