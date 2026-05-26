import PropTypes from 'prop-types'
import React, { useEffect, useMemo, useState } from 'react'

function buildTree(filePaths) {
  const root = { name: '/', children: {}, files: [] }
  for (const fp of filePaths) {
    const parts = fp.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.children[parts[i]]) {
        node.children[parts[i]] = { name: parts[i], children: {}, files: [] }
      }
      node = node.children[parts[i]]
    }
    node.files.push(parts[parts.length - 1])
  }
  return root
}

function sortTree(node) {
  const dirs = Object.values(node.children).map(sortTree)
  dirs.sort((a, b) => a.name.localeCompare(b.name))
  const files = [...node.files].sort((a, b) => a.localeCompare(b))
  return { ...node, dirs, files }
}

function TreeNode({ node, depth, prefixPath, activeFile, onFileSelect, initiallyExpanded }) {
  const [collapsed, setCollapsed] = useState(!initiallyExpanded)
  const indent = depth * 16
  const dirPrefix = prefixPath ? prefixPath + '/' + node.name : node.name

  useEffect(() => {
    if (initiallyExpanded && collapsed) {
      setCollapsed(false)
    }
  }, [initiallyExpanded]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {depth >= 0 && (
        <div
          className="filetree-folder-row"
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => setCollapsed(v => !v)}
        >
          <span className="filetree-arrow">{collapsed ? '\u25B6' : '\u25BC'}</span>
          <span className="filetree-folder-name">{node.name}</span>
        </div>
      )}
      {!collapsed && (
        <>
          {node.dirs.map(dir => (
            <TreeNode key={dir.name} node={dir} depth={depth + 1} prefixPath={dirPrefix}
              activeFile={activeFile} onFileSelect={onFileSelect} />
          ))}
          {node.files.map(f => {
            const fullPath = prefixPath ? prefixPath + '/' + f : f
            const isActive = activeFile === fullPath
            return (
              <div
                key={f}
                className={`filetree-file-row ${isActive ? 'filetree-file-row--active' : ''}`}
                style={{ paddingLeft: `${indent + 24}px` }}
                onClick={(e) => {
                  e.stopPropagation()
                  onFileSelect?.(fullPath)
                }}
              >
                <span className="filetree-file-name">{f}</span>
              </div>
            )
          })}
        </>
      )}
    </>
  )
}

TreeNode.propTypes = {
  node: PropTypes.object.isRequired,
  depth: PropTypes.number.isRequired,
  prefixPath: PropTypes.string,
  activeFile: PropTypes.string,
  onFileSelect: PropTypes.func,
  initiallyExpanded: PropTypes.bool,
}

function buildExpandPath(path) {
  const parts = path.split('/')
  const expansions = new Set()
  for (let i = 1; i <= parts.length; i++) {
    expansions.add(parts.slice(0, i).join('/'))
  }
  return expansions
}

export default function FileTree({ nodes, activeFile, onFileSelect, expandToPath, onExpandToPathConsumed }) {
  const filePaths = useMemo(() => {
    const seen = new Set()
    for (const n of nodes) {
      const f = n.file
      if (f && !seen.has(f)) {
        seen.add(f)
      }
    }
    return [...seen].sort()
  }, [nodes])

  const tree = useMemo(() => {
    const raw = buildTree(filePaths)
    return sortTree(raw)
  }, [filePaths])

  const [consumedPath, setConsumedPath] = useState(null)

  const expandTargets = useMemo(() => {
    if (!expandToPath || expandToPath === consumedPath) return null
    return buildExpandPath(expandToPath)
  }, [expandToPath, consumedPath])

  useEffect(() => {
    if (expandToPath && expandToPath !== consumedPath) {
      setConsumedPath(expandToPath)
      onExpandToPathConsumed?.()
    }
  }, [expandToPath]) // eslint-disable-line react-hooks/exhaustive-deps

  if (filePaths.length === 0) {
    return (
      <div className="filetree-empty">
        No files with extracted nodes.
      </div>
    )
  }

  return (
    <div className="filetree">
      {tree.files.map(f => {
        const isActive = activeFile === f
        return (
          <div
            key={f}
            className={`filetree-file-row ${isActive ? 'filetree-file-row--active' : ''}`}
            style={{ paddingLeft: '24px' }}
            onClick={(e) => {
              e.stopPropagation()
              onFileSelect?.(f)
            }}
          >
            <span className="filetree-file-name">{f}</span>
          </div>
        )
      })}
      {tree.dirs.map(dir => (
        <TreeNode
          key={dir.name}
          node={dir}
          depth={0}
          prefixPath=""
          activeFile={activeFile}
          onFileSelect={onFileSelect}
          initiallyExpanded={expandTargets?.has(dir.name)}
        />
      ))}
    </div>
  )
}

FileTree.propTypes = {
  nodes: PropTypes.array.isRequired,
  activeFile: PropTypes.string,
  onFileSelect: PropTypes.func,
  expandToPath: PropTypes.string,
  onExpandToPathConsumed: PropTypes.func,
}
