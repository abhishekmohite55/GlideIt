import PropTypes from 'prop-types'
import React, { useEffect, useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'
import javascript from 'highlight.js/lib/languages/javascript'
import 'highlight.js/styles/github-dark.css'

hljs.registerLanguage('python', python)
hljs.registerLanguage('javascript', javascript)

function detectLang(file) {
  if (!file) return 'javascript'
  return file.endsWith('.py') ? 'python' : 'javascript'
}

const NODE_TYPE_COLORS = {
  python_function: { background: '#1A1A2E', borderColor: '#1E90FF' },
  flask_route: { background: '#1A2E1A', borderColor: '#00C853' },
  react_component: { background: '#2E1A2E', borderColor: '#AA00FF' },
  external_call: { background: '#2A2A2A', borderColor: '#555555' },
  python_class: { background: '#2A1A1A', borderColor: '#FF8C00' },
}

export default function CodeSnippetTab({ node, allNodes, allEdges, onNavigateToNode, isServerMode, onClose, navigationOrigin, onBackToIssues }) {
  const [sourceCode, setSourceCode] = useState(null)
  const [sourceLoading, setSourceLoading] = useState(false)

  useEffect(() => {
    setSourceCode(null)
    setSourceLoading(false)
    if (!node) return

    const chunk = node.source_chunk ?? null
    if (chunk) {
      setSourceCode(chunk)
      return
    }
    if (!isServerMode) return

    setSourceLoading(true)
    fetch(`/api/source?file=${encodeURIComponent(node.file)}`)
      .then(r => r.json())
      .then(data => {
        const lines = data.source.split('\n')
        const sliced = lines.slice(node.line - 1, node.line + 59).join('\n')
        setSourceCode(sliced)
        setSourceLoading(false)
      })
      .catch(() => {
        setSourceCode(null)
        setSourceLoading(false)
      })
  }, [node, isServerMode])

  const callers = useMemo(() => {
    if (!node) return []
    return allEdges
      .filter(e => e.target === node.id)
      .map(e => allNodes.find(n => n.id === e.source))
      .filter(Boolean)
  }, [node, allEdges, allNodes])

  const callees = useMemo(() => {
    if (!node) return []
    return allEdges
      .filter(e => e.source === node.id)
      .map(e => allNodes.find(n => n.id === e.target))
      .filter(Boolean)
  }, [node, allEdges, allNodes])

  const highlightedHtml = useMemo(() => {
    if (!sourceCode) return null
    try {
      return hljs.highlight(sourceCode, { language: detectLang(node?.file) }).value
    } catch {
      return null
    }
  }, [sourceCode, node?.file])

  if (!node) {
    return (
      <div className="code-tab-empty">
        <p>Select a node on the graph to see its code details here.</p>
      </div>
    )
  }

  const nodeStyle = NODE_TYPE_COLORS[node.type] || { background: '#2A2A2A', borderColor: '#555' }
  const paramsStr = (node.params || [])
    .map(p => p.type_hint ? `${p.name}: ${p.type_hint}` : p.name)
    .join(', ')
  const returnType = node.returns?.type_hint
  const isPython = node.file?.endsWith('.py')
  const signature = isPython
    ? `def ${node.name}(${paramsStr})${returnType ? ` -> ${returnType}` : ''}`
    : `function ${node.name}(${paramsStr})`
  const lineCount = sourceCode ? sourceCode.split('\n').length : 0
  const connectionsCount = callers.length + callees.length

  return (
    <div className="code-tab">
      {/* Header */}
      <div className="code-tab-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span
              className="code-tab-badge"
              style={{
                background: nodeStyle.background,
                borderColor: nodeStyle.borderColor,
                color: nodeStyle.borderColor,
              }}
            >
              {node.type}
            </span>
            <span className="code-tab-connections">Connections: {connectionsCount}</span>
          </div>
          {navigationOrigin === 'issue' && (
            <button className="code-tab-back-btn" onClick={onBackToIssues}>
              {'\u2190'} Back to Issues
            </button>
          )}
          <div className="code-tab-name">{node.name}</div>
          <div className="code-tab-file">{node.file}:{node.line}</div>
        </div>
        <button
          className="code-tab-close"
          onClick={onClose}
          title="Close"
        >
          &times;
        </button>
      </div>

      <div className="code-tab-body">
        {/* Signature */}
        <div className="code-tab-section">
          <div className="code-tab-section-label">Signature</div>
          <code className="code-tab-signature">{signature}</code>
        </div>

        {/* Docstring */}
        {node.docstring && node.docstring !== 'No description available.' && (
          <div className="code-tab-section">
            <div className="code-tab-section-label">Description</div>
            <p className="code-tab-docstring">{node.docstring}</p>
          </div>
        )}

        {/* Callers */}
        <div className="code-tab-section">
          <div className="code-tab-section-row">
            <span className="code-tab-section-label">Called by</span>
            <span className="code-tab-count">{callers.length}</span>
          </div>
          {callers.length === 0 ? (
            <span className="code-tab-muted">No callers detected</span>
          ) : (
            <div className="code-tab-chips">
              {callers.map(caller => (
                <button
                  key={caller.id}
                  className="code-tab-chip code-tab-chip-caller"
                  onClick={() => onNavigateToNode?.(caller.id)}
                >
                  {caller.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Callees */}
        <div className="code-tab-section">
          <div className="code-tab-section-row">
            <span className="code-tab-section-label">Calls</span>
            <span className="code-tab-count">{callees.length}</span>
          </div>
          {callees.length === 0 ? (
            <span className="code-tab-muted">No callees detected</span>
          ) : (
            <div className="code-tab-chips">
              {callees.map(callee => (
                <button
                  key={callee.id}
                  className="code-tab-chip code-tab-chip-callee"
                  onClick={() => onNavigateToNode?.(callee.id)}
                >
                  {callee.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Source */}
        <div className="code-tab-section">
          <div className="code-tab-section-row">
            <span className="code-tab-section-label">Source</span>
            {lineCount > 0 && <span className="code-tab-count">{lineCount} lines</span>}
          </div>
          {sourceLoading ? (
            <div className="code-tab-loading">Loading source...</div>
          ) : !sourceCode ? (
            <p className="code-tab-muted">Source not available in this mode.</p>
          ) : (
            <pre
              className="code-tab-source"
              dangerouslySetInnerHTML={highlightedHtml ? { __html: highlightedHtml } : undefined}
            >
              {!highlightedHtml ? sourceCode : undefined}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

CodeSnippetTab.propTypes = {
  node: PropTypes.object,
  allNodes: PropTypes.array.isRequired,
  allEdges: PropTypes.array.isRequired,
  onNavigateToNode: PropTypes.func,
  isServerMode: PropTypes.bool,
  onClose: PropTypes.func,
  navigationOrigin: PropTypes.string,
  onBackToIssues: PropTypes.func,
}
