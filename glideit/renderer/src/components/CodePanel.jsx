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

function CodePanel({ node, allNodes, allEdges, onNavigateToNode, isServerMode, onClose }) {
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
        const chunk = lines.slice(node.line - 1, node.line + 59).join('\n')
        setSourceCode(chunk)
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
    const lang = detectLang(node?.file)
    try {
      return hljs.highlight(sourceCode, { language: lang }).value
    } catch {
      return null
    }
  }, [sourceCode, node?.file])

  if (!node) return null

  const nodeStyle = NODE_TYPE_COLORS[node.type] || { background: '#2A2A2A', borderColor: '#555555' }
  const paramsStr = (node.params || [])
    .map(p => p.type_hint ? `${p.name}: ${p.type_hint}` : p.name)
    .join(', ')
  const returnType = node.returns?.type_hint
  const isPython = node.file?.endsWith('.py')
  const signature = isPython
    ? `def ${node.name}(${paramsStr})${returnType ? ` -> ${returnType}` : ''}`
    : `function ${node.name}(${paramsStr})`
  const lineCount = sourceCode ? sourceCode.split('\n').length : 0

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '340px',
      height: '100%',
      background: 'rgba(14, 14, 14, 0.97)',
      borderLeft: '1px solid #2A2A2A',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 25,
      overflowY: 'hidden',
      color: '#F0F0F0',
      fontSize: '12px',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #2A2A2A',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexShrink: 0,
      }}>
        <div>
          <span style={{
            display: 'inline-block',
            background: nodeStyle.background,
            border: `1px solid ${nodeStyle.borderColor}`,
            borderRadius: '3px',
            padding: '1px 6px',
            fontSize: '10px',
            color: '#888',
            textTransform: 'uppercase',
          }}>
            {node.type}
          </span>
          <div style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#F0F0F0',
            marginTop: '4px',
          }}>
            {node.name}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#555',
            fontFamily: 'var(--font-mono)',
          }}>
            {node.file}:{node.line}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '2px 4px',
          }}
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px',
      }}>
        {/* Signature */}
        <div style={{ marginTop: '14px' }}>
          <div style={{
            fontSize: '10px',
            color: '#555',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '6px',
          }}>
            Signature
          </div>
          <code style={{
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: '#ccc',
            background: '#111',
            borderRadius: '6px',
            padding: '8px 10px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {signature}
          </code>
        </div>

        {/* Docstring */}
        {node.docstring && node.docstring !== 'No description available.' && (
          <div style={{ marginTop: '16px' }}>
            <div style={{
              fontSize: '10px',
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '6px',
            }}>
              Description
            </div>
            <p style={{
              fontSize: '12px',
              color: '#888',
              lineHeight: 1.6,
              fontStyle: 'italic',
            }}>
              {node.docstring}
            </p>
          </div>
        )}

        {/* Callers */}
        <div style={{ marginTop: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
          }}>
            <span style={{
              fontSize: '10px',
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Called by
            </span>
            <span style={{
              background: '#1A1A2E',
              color: '#1E90FF',
              borderRadius: '3px',
              padding: '0 5px',
              fontSize: '10px',
            }}>
              {callers.length}
            </span>
          </div>
          {callers.length === 0 ? (
            <span style={{ color: '#555', fontSize: '12px' }}>No callers detected</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {callers.map(caller => (
                <button
                  key={caller.id}
                  onClick={() => onNavigateToNode(caller.id)}
                  style={{
                    display: 'inline-flex',
                    background: '#1A1A1A',
                    border: '1px solid #2A2A2A',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    color: '#888',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#1E90FF'
                    e.currentTarget.style.color = '#F0F0F0'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#2A2A2A'
                    e.currentTarget.style.color = '#888'
                  }}
                >
                  {caller.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Callees */}
        <div style={{ marginTop: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
          }}>
            <span style={{
              fontSize: '10px',
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Calls
            </span>
            <span style={{
              background: '#1A1A2E',
              color: '#1E90FF',
              borderRadius: '3px',
              padding: '0 5px',
              fontSize: '10px',
            }}>
              {callees.length}
            </span>
          </div>
          {callees.length === 0 ? (
            <span style={{ color: '#555', fontSize: '12px' }}>No callees detected</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {callees.map(callee => (
                <button
                  key={callee.id}
                  onClick={() => onNavigateToNode(callee.id)}
                  style={{
                    display: 'inline-flex',
                    background: '#1A1A1A',
                    border: '1px solid #2A2A2A',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    color: '#888',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#00C853'
                    e.currentTarget.style.color = '#F0F0F0'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#2A2A2A'
                    e.currentTarget.style.color = '#888'
                  }}
                >
                  {callee.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Source */}
        <div style={{ marginTop: '16px', marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
          }}>
            <span style={{
              fontSize: '10px',
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Source
            </span>
            {lineCount > 0 && (
              <span style={{
                background: '#1A1A1A',
                color: '#888',
                borderRadius: '3px',
                padding: '0 5px',
                fontSize: '10px',
              }}>
                {lineCount} lines
              </span>
            )}
          </div>
          {sourceLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
              <div className="loading-spinner" style={{ width: '14px', height: '14px' }} />
              <span style={{ color: '#555', fontSize: '12px' }}>Loading source...</span>
            </div>
          ) : !sourceCode ? (
            <p style={{ color: '#555', fontSize: '12px' }}>
              Source not available in this mode.
            </p>
          ) : (
            <pre style={{
              margin: 0,
              padding: '10px 12px',
              borderRadius: '6px',
              background: '#0A0A0A',
              border: '1px solid #1A1A1A',
              fontSize: '11px',
              lineHeight: 1.6,
              overflowX: 'auto',
              maxHeight: '320px',
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              color: '#ccc',
            }}
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

CodePanel.propTypes = {
  node: PropTypes.object,
  allNodes: PropTypes.array.isRequired,
  allEdges: PropTypes.array.isRequired,
  onNavigateToNode: PropTypes.func.isRequired,
  isServerMode: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
}

export { CodePanel }
