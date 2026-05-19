/**
 * GlideNode — custom React Flow node component.
 * Renders a node card for python_function, flask_route,
 * react_component, external_call, and python_class types.
 */
import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'

const TYPE_LABELS = {
  python_function: 'fn',
  flask_route:     'route',
  react_component: 'component',
  external_call:   'external',
  python_class:    'class',
}

const METHOD_COLORS = {
  GET:    '#00C853',
  POST:   '#1E90FF',
  PUT:    '#FF8C00',
  DELETE: '#FF3333',
  PATCH:  '#AA00FF',
}

function NodeBadge({ type }) {
  return <span className={`node-badge node-badge--${type}`}>{TYPE_LABELS[type] || type}</span>
}

function HttpMethodBadge({ method }) {
  if (!method) return null
  const methods = method.split(',')
  return (
    <span className="http-method-group">
      {methods.map(m => (
        <span
          key={m}
          className="http-method-badge"
          style={{ background: METHOD_COLORS[m.trim()] || '#555' }}
        >
          {m.trim()}
        </span>
      ))}
    </span>
  )
}

export default function GlideNode({ data }) {
  const [localExpanded, setLocalExpanded] = useState(false)

  const {
    name,
    type,
    file,
    line,
    params = [],
    returns,
    docstring,
    http_method,
    route_path,
    hooks = [],
    props = [],
    depth,
    selected,
  } = data

  const expanded = data.expanded !== undefined ? data.expanded : localExpanded

  const setExpanded = (val) => {
    if (data.onToggleExpanded) {
      data.onToggleExpanded(data.id)
    } else {
      setLocalExpanded(val)
    }
  }

  const isFlask = type === 'flask_route'
  const isExternal = type === 'external_call'

  const paramStr = params.length > 0
    ? params.map(p => p.type_hint ? `${p.name}: ${p.type_hint}` : p.name).join(', ')
    : null

  const returnStr = returns?.type_hint || null

  const handleClick = (e) => {
    e.stopPropagation()
    setExpanded(prev => !prev)
  }

  const NODE_STYLES = {
    python_function: { background: '#1A1A2E', borderColor: '#1E90FF' },
    flask_route:     { background: '#1A2E1A', borderColor: '#00C853' },
    react_component: { background: '#2E1A2E', borderColor: '#AA00FF' },
    external_call:   { background: '#2A2A2A', borderColor: '#555555' },
    python_class:    { background: '#2A1A1A', borderColor: '#FF8C00' },
  }

  const typeStyle = NODE_STYLES[type] || { background: '#161616', borderColor: '#2A2A2A' }
  const isEntryPoint = depth === 0
  const clusterColor = data.clusterColor ?? null

  const cardStyle = {
    background: typeStyle.background,
    borderColor: typeStyle.borderColor,
    borderLeftColor: typeStyle.borderColor,
    outline: isEntryPoint && clusterColor ? `2px solid ${clusterColor}` : 'none',
    outlineOffset: '3px',
    borderRadius: '8px',
  }

  return (
    <div
      className={`glideit-node glideit-node--${type} ${expanded ? 'expanded' : ''} ${selected ? 'node-selected' : ''}`}
      style={cardStyle}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`${name} — ${type}`}
      onKeyDown={e => e.key === 'Enter' && setExpanded(p => !p)}
    >
      <Handle type="target" position={Position.Top} className="node-handle" />

      {/* Header row */}
      <div className="node-header">
        <div className="node-header-left">
          <NodeBadge type={type} />
          {isFlask && <HttpMethodBadge method={http_method} />}
        </div>
        <span className="node-depth">d{depth}</span>
      </div>

      {/* Name */}
      <div className="node-name">
        {isFlask && route_path ? (
          <>
            <span className="node-route-path">{route_path}</span>
            <span className="node-route-handler"> → {name}</span>
          </>
        ) : name}
      </div>

      {/* File + line */}
      <div className="node-file">
        {file}{line ? `:${line}` : ''}
      </div>

      {/* Params row */}
      {paramStr && (
        <div className="node-params">
          <span className="node-params-label">({paramStr})</span>
          {returnStr && <span className="node-return"> → {returnStr}</span>}
        </div>
      )}

      {/* Collapsed footer */}
      {!expanded && !isExternal && (
        <div className="node-footer">
          {params.length > 0 && <span>{params.length} param{params.length !== 1 ? 's' : ''}</span>}
          {hooks.length > 0 && <span>{hooks.length} hook{hooks.length !== 1 ? 's' : ''}</span>}
          <span className="node-expand-hint">Click to expand</span>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="node-detail">
          <div className="node-detail-separator" />

          {/* Docstring */}
          {docstring && (
            <div className="node-docstring">
              <span className="node-detail-label">Description</span>
              <p>{docstring}</p>
            </div>
          )}

          {/* Full params */}
          {params.length > 0 && (
            <div className="node-detail-section">
              <span className="node-detail-label">Parameters</span>
              {params.map((p, i) => (
                <div key={i} className="node-detail-row">
                  <code className="param-name">{p.name}</code>
                  {p.type_hint && <span className="param-type">: {p.type_hint}</span>}
                  {p.default_value && <span className="param-default"> = {p.default_value}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Return */}
          {returns?.type_hint && (
            <div className="node-detail-section">
              <span className="node-detail-label">Returns</span>
              <div className="node-detail-row">
                <code>{returns.variable_name || '_'}</code>
                <span className="param-type">: {returns.type_hint}</span>
              </div>
            </div>
          )}

          {/* Hooks */}
          {hooks.length > 0 && (
            <div className="node-detail-section">
              <span className="node-detail-label">Hooks</span>
              <div className="node-detail-row hooks-list">
                {hooks.map((h, i) => <code key={i} className="hook-tag">{h}</code>)}
              </div>
            </div>
          )}

          {/* Props */}
          {props.length > 0 && (
            <div className="node-detail-section">
              <span className="node-detail-label">Props</span>
              {props.map((p, i) => (
                <div key={i} className="node-detail-row">
                  <code className="param-name">{p.name}</code>
                  {p.type_hint && <span className="param-type">: {p.type_hint}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Route path for Flask */}
          {isFlask && route_path && (
            <div className="node-detail-section">
              <span className="node-detail-label">Route</span>
              <code className="route-path-full">{route_path}</code>
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  )
}
