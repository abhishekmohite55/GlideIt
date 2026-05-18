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
  const [expanded, setExpanded] = useState(false)

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

  const cardStyle = {};
  if (data.clusterColor) {
    cardStyle.borderLeftColor = data.clusterColor;
  }
  if (selected && data.clusterColor) {
    cardStyle.borderColor = data.clusterColor;
    cardStyle.boxShadow = `0 0 25px ${data.clusterColor}3d, inset 0 0 12px ${data.clusterColor}14`;
    cardStyle.background = `radial-gradient(circle at top left, ${data.clusterColor}0d, #1A1A1A 80%)`;
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
