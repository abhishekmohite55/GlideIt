import PropTypes from 'prop-types'
import React, { useMemo, useState } from 'react'

const GRADE_COLORS = {
  A: '#00C853',
  B: '#1E90FF',
  C: '#FF8C00',
  D: '#FF4444',
  F: '#FF4444',
}

const SEVERITY_ORDER = ['ERROR', 'WARNING', 'INFO']

function SevGroup({ severity, findings, onShowInGraph, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="health-sev-group">
      <button className="health-sev-header" onClick={() => setOpen(v => !v)}>
        <span className={`health-sev-badge health-sev-badge--${severity.toLowerCase()}`}>
          {severity}
        </span>
        <span className="health-sev-count">{findings.length}</span>
        <span className="health-sev-arrow">{open ? '\u25BC' : '\u25B6'}</span>
      </button>
      {open && (
        <div className="health-sev-body">
          {findings.map((f, i) => (
            <div key={`${f.rule_id}-${f.line}-${i}`} className="health-finding-card">
              <div className="health-finding-top">
                <code className="health-finding-rule">{f.rule_id}</code>
                {f.node_id && (
                  <button
                    className="health-show-btn"
                    onClick={() => onShowInGraph?.(f.node_id, f.file?.endsWith('.py') ? 'codeflow' : 'jsx')}
                  >
                    Show in graph
                  </button>
                )}
              </div>
              <div className="health-finding-msg">{f.message}</div>
              <div className="health-finding-file">{f.file}:{f.line}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

SevGroup.propTypes = {
  severity: PropTypes.string.isRequired,
  findings: PropTypes.array.isRequired,
  onShowInGraph: PropTypes.func,
  defaultOpen: PropTypes.bool,
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

function InstallBanner() {
  return (
    <div className="health-install-banner">
      <ShieldIcon />
      <h3 className="health-install-title">Health analysis not available</h3>
      <p className="health-install-body">Install Semgrep and re-run GlideIt to see security findings.</p>
      <pre className="health-install-code">pip install semgrep</pre>
      <pre className="health-install-code">glideit run</pre>
    </div>
  )
}

export default function SecurityHealthTab({ data, onShowInGraph }) {
  const health = data?.health

  const grouped = useMemo(() => {
    if (!health?.findings) return {}
    const g = {}
    for (const f of health.findings) {
      const sev = f.severity || 'INFO'
      if (!g[sev]) g[sev] = []
      g[sev].push(f)
    }
    return g
  }, [health])

  if (!health) {
    return <InstallBanner />
  }

  const gradeColor = GRADE_COLORS[health.grade] || '#888'
  const analyzedDate = health.analyzed_at
    ? new Date(health.analyzed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div className="health-tab">
      {/* Score card */}
      <div className="health-score-card">
        <div
          className="health-score-circle"
          style={{ borderColor: gradeColor, color: gradeColor }}
        >
          <span className="health-score-grade">{health.grade}</span>
        </div>
        <div className="health-score-meta">
          <span className="health-score-value">{health.score}/100</span>
          <span className="health-score-breakdown">
            {health.summary?.ERROR || 0} critical &middot; {health.summary?.WARNING || 0} warnings &middot; {health.summary?.INFO || 0} info
          </span>
          <span className="health-score-version">
            Semgrep {health.semgrep_version} &middot; Analyzed {analyzedDate}
          </span>
        </div>
      </div>

      {/* Findings list */}
      <div className="health-findings">
        {SEVERITY_ORDER.map(sev => {
          const items = grouped[sev]
          if (!items || items.length === 0) return null
          return (
            <SevGroup
              key={sev}
              severity={sev}
              findings={items}
              onShowInGraph={onShowInGraph}
              defaultOpen={sev === 'ERROR'}
            />
          )
        })}
      </div>
    </div>
  )
}

SecurityHealthTab.propTypes = {
  data: PropTypes.object,
  onShowInGraph: PropTypes.func,
}
