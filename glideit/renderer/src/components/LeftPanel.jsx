import PropTypes from 'prop-types'
import React, { useMemo, useState } from 'react'
import FileTree from './FileTree.jsx'

const GRADE_COLORS = {
  A: '#00C853',
  B: '#1E90FF',
  C: '#FF8C00',
  D: '#FF4444',
  F: '#FF4444',
}

const LANG_COLORS = {
  py: '#3572A5',
  js: '#F7DF1E',
  jsx: '#61DAFB',
  ts: '#3178C6',
  tsx: '#3178C6',
  sql: '#DA5B0B',
  dockerfile: '#384D54',
  sh: '#89E051',
}

function ShieldIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5">
      <path d="M12 2L3 7v5c0 5.25 3.83 10.15 9 11 5.17-.85 9-5.75 9-11V7l-9-5z" />
      <path d="M12 8v4" stroke="#888" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="#888" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" />
      <path d="M9 1v4h4" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 4L2 8l3.5 4" />
      <path d="M10.5 4L14 8l-3.5 4" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5l-1 1" />
      <path d="M9.5 6.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1L1 14h14L8 1z" />
      <path d="M8 6v3" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" />
    </svg>
  )
}

function LinesIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 3h10M3 6h7M3 9h10M3 12h5" />
    </svg>
  )
}

function HealthRingSVG({ grade, score, color }) {
  const radius = 20
  const circumference = 2 * Math.PI * radius // ~125.66
  const pct = (score || 0) / 100
  const offset = circumference * (1 - pct)

  return (
    <div className="stats-health-ring-wrapper">
      <svg className="stats-health-ring-svg" viewBox="0 0 48 48">
        <circle className="stats-health-ring-bg" cx="24" cy="24" r={radius} />
        <circle
          className="stats-health-ring-fg"
          cx="24" cy="24" r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="stats-health-ring-label" style={{ color, transform: 'rotate(0deg)' }}>{grade}</span>
    </div>
  )
}

HealthRingSVG.propTypes = {
  grade: PropTypes.string,
  score: PropTypes.number,
  color: PropTypes.string,
}

const STAT_ICONS = [
  { icon: FileIcon, color: 'var(--color-stat-files)' },
  { icon: CodeIcon, color: 'var(--color-stat-functions)' },
  { icon: LinkIcon, color: 'var(--color-stat-links)' },
  { icon: WarningIcon, color: 'var(--color-stat-unused)' },
  { icon: LinesIcon, color: 'var(--color-stat-lines)' },
]

function StatsSection({ nodes, edges, health }) {
  const stats = useMemo(() => {
    const funcTypes = new Set(['python_function', 'flask_route', 'react_component', 'python_class'])
    const functions = nodes.filter(n => funcTypes.has(n.type)).length
    const links = edges.length
    const targets = new Set(edges.map(e => e.target))
    const unused = nodes.filter(n => !targets.has(n.id)).length
    const lines = nodes.reduce((sum, n) => sum + (n.source_chunk ? n.source_chunk.split('\n').length : 0), 0)
    const files = new Set(nodes.map(n => n.file).filter(Boolean)).size

    const langCounts = {}
    for (const n of nodes) {
      if (!n.file) continue
      const ext = n.file.split('.').pop() || 'other'
      const lang = ext.toLowerCase()
      langCounts[lang] = (langCounts[lang] || 0) + 1
    }
    const totalLang = Object.values(langCounts).reduce((a, b) => a + b, 0) || 1

    return { functions, links, unused, lines, files, langCounts, totalLang }
  }, [nodes, edges])

  const gradeColor = health ? (GRADE_COLORS[health.grade] || '#888') : null

  const statCards = [
    { label: 'Files', value: stats.files },
    { label: 'Functions', value: stats.functions },
    { label: 'Links', value: stats.links },
    { label: 'Unused', value: stats.unused },
    { label: 'Lines', value: stats.lines },
  ]

  return (
    <div className="left-panel-stats">
      {/* Health ring */}
      <div className="stats-health-row">
        {health ? (
          <HealthRingSVG grade={health.grade} score={health.score} color={gradeColor} />
        ) : (
          <ShieldIcon />
        )}
        {health && (
          <span className="stats-health-score" style={{ color: gradeColor }}>{health.score}/100</span>
        )}
      </div>

      {/* Stat cards */}
      <div className="stats-cards">
        {statCards.map((s, i) => {
          const IconComp = STAT_ICONS[i].icon
          const iconColor = STAT_ICONS[i].color
          return (
            <div className="stats-card" key={s.label}>
              <span className="stats-card-icon" style={{ color: iconColor }}><IconComp /></span>
              <span className="stats-card-value" style={{ color: iconColor }}>{s.value}</span>
              <span className="stats-card-label">{s.label}</span>
            </div>
          )
        })}
      </div>

      {/* Language breakdown bar */}
      {Object.keys(stats.langCounts).length > 0 && (
        <div className="stats-lang-bar">
          {Object.entries(stats.langCounts).map(([lang, count]) => (
            <div
              key={lang}
              className="stats-lang-segment"
              style={{
                width: `${(count / stats.totalLang) * 100}%`,
                backgroundColor: LANG_COLORS[lang] || '#888',
              }}
              title={`${lang}: ${count} nodes`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

StatsSection.propTypes = {
  nodes: PropTypes.array.isRequired,
  edges: PropTypes.array.isRequired,
  health: PropTypes.object,
}

function ClearFilterChip({ activeFile, onClear }) {
  if (!activeFile) return null
  const basename = activeFile.split('/').pop() || activeFile
  return (
    <div className="clear-filter-chip">
      <span className="clear-filter-label">Filtering: {basename}</span>
      <button className="clear-filter-btn" onClick={onClear}>&times; Clear</button>
    </div>
  )
}

ClearFilterChip.propTypes = {
  activeFile: PropTypes.string,
  onClear: PropTypes.func,
}

export default function LeftPanel({ data, gitInfo, activeFile, onFileSelect, expandToPath, onExpandToPathConsumed }) {
  const [tab, setTab] = useState('repo')
  const nodes = data?.nodes || []
  const edges = data?.edges || []
  const health = data?.health || null
  const branches = gitInfo?.branch ? [gitInfo.branch] : []

  return (
    <div className="left-panel">
      <StatsSection nodes={nodes} edges={edges} health={health} />
      <div className="left-panel-tabs">
        <button className={`left-panel-tab ${tab === 'repo' ? 'active' : ''}`} onClick={() => setTab('repo')}>Repo Dir</button>
        <button className={`left-panel-tab ${tab === 'branches' ? 'active' : ''}`} onClick={() => setTab('branches')}>Branches</button>
      </div>
      <ClearFilterChip activeFile={activeFile} onClear={() => onFileSelect?.(null)} />
      <div className="left-panel-content">
        {tab === 'repo' && (
          <FileTree
            nodes={nodes}
            activeFile={activeFile}
            onFileSelect={onFileSelect}
            expandToPath={expandToPath}
            onExpandToPathConsumed={onExpandToPathConsumed}
          />
        )}
        {tab === 'branches' && (
          <div className="left-panel-branches">
            {branches.length === 0 ? (
              <div className="filetree-empty">No branch info available</div>
            ) : (
              branches.map(b => (
                <div key={b} className="left-panel-branch-row">
                  <span className="left-panel-branch-icon">{'\u2387'}</span>
                  <span className="left-panel-branch-name">{b}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

LeftPanel.propTypes = {
  data: PropTypes.object,
  gitInfo: PropTypes.shape({
    branch: PropTypes.string,
    remote: PropTypes.string,
  }),
  activeFile: PropTypes.string,
  onFileSelect: PropTypes.func,
  expandToPath: PropTypes.string,
  onExpandToPathConsumed: PropTypes.func,
}
