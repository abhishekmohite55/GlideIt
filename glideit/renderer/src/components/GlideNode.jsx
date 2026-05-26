/**
 * GlideNode — custom React Flow node component.
 * Renders a node card for python_function, flask_route,
 * react_component, external_call, and python_class types.
 */
import PropTypes from 'prop-types'
import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useToggle } from '../utils/ToggleContext.js'

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

/* NODE_STYLES removed — per-type backgrounds are now CSS gradients in index.css */

function NodeBadge({ type }) {
  return <span className={`node-badge node-badge--${type}`}>{TYPE_LABELS[type] || type}</span>
}

NodeBadge.propTypes = {
  type: PropTypes.string.isRequired,
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
    isMainNode,
  } = data

  const toggleNode = useToggle()
  const expanded = data.expanded ?? localExpanded

  const setExpanded = (val) => {
    if (toggleNode) {
      toggleNode(data.id)
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

  const toggleExpanded = () => {
    setExpanded(prev => !prev)
  }

  const isEntryPoint = depth === 0
  const clusterColor = data.clusterColor ?? null

  let outlineVal = 'none'
  if (isMainNode) {
    outlineVal = '2px solid #FFD700'
  } else if (isEntryPoint && clusterColor) {
    outlineVal = `2px solid ${clusterColor}`
  }

  const cardStyle = {
    outline: outlineVal,
    outlineOffset: '3px',
    boxShadow: isMainNode
      ? '0 0 12px rgba(255, 215, 0, 0.3), 0 0 24px rgba(255, 215, 0, 0.1)'
      : undefined,
  }

  return (
    <div
      className={`glideit-node glideit-node--${type} ${expanded ? 'expanded' : ''} ${selected ? 'node-selected' : ''}`}
      style={cardStyle}
      aria-label={`${name} — ${type}`}
    >
      <Handle type="target" position={Position.Top} className="node-handle" />

      {/* Header row */}
      <div className="node-header">
        <div className="node-header-left">
          <NodeBadge type={type} />
          {isFlask && <HttpMethodBadge method={http_method} />}
          {isMainNode && (
            <span className="main-badge" style={{
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              color: '#000',
              fontSize: '9px',
              fontWeight: 'bold',
              padding: '1px 6px',
              borderRadius: '4px',
              letterSpacing: '0.05em',
            }}>
              MAIN
            </span>
          )}
        </div>
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
          <span className="node-expand-hint" onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}>Click to expand</span>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="node-detail">
          <div
            className="node-collapse-hint"
            onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
          >
            Click to collapse
          </div>
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
              {params.map(p => (
                <div key={p.name} className="node-detail-row">
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
                {hooks.map(h => <code key={h} className="hook-tag">{h}</code>)}
              </div>
            </div>
          )}

          {/* Props */}
          {props.length > 0 && (
            <div className="node-detail-section">
              <span className="node-detail-label">Props</span>
              {props.map(p => (
                <div key={p.name} className="node-detail-row">
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

HttpMethodBadge.propTypes = {
  method: PropTypes.string,
}

GlideNode.propTypes = {
  data: PropTypes.shape({
    name: PropTypes.string,
    type: PropTypes.string,
    file: PropTypes.string,
    line: PropTypes.number,
    params: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      type_hint: PropTypes.string,
      default_value: PropTypes.string,
    })),
    returns: PropTypes.shape({
      type_hint: PropTypes.string,
      variable_name: PropTypes.string,
      description: PropTypes.string,
    }),
    docstring: PropTypes.string,
    http_method: PropTypes.string,
    route_path: PropTypes.string,
    hooks: PropTypes.arrayOf(PropTypes.string),
    props: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      type_hint: PropTypes.string,
    })),
    depth: PropTypes.number,
    selected: PropTypes.bool,
    isMainNode: PropTypes.bool,
    expanded: PropTypes.bool,
    id: PropTypes.string,
    clusterColor: PropTypes.string,
  }).isRequired,
}
