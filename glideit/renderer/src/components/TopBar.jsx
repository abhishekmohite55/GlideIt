import PropTypes from 'prop-types'
import React, { useState } from 'react'
import ArchiveSelector from './ArchiveSelector.jsx'
import logoUrl from '../Logo.png'

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

function extractRepoName(remote) {
  if (!remote) return null
  let path = remote
  if (remote.includes('git@')) {
    path = remote.split(':').slice(1).join(':')
  }
  path = path.replace(/\.git$/, '').replace(/\/$/, '')
  const parts = path.split('/')
  return parts[parts.length - 1] || null
}

function sshToHttps(remote) {
  if (!remote) return null
  if (remote.startsWith('http')) {
    return remote.replace(/\.git$/, '')
  }
  const match = remote.match(/git@([^:]+):(.+)/)
  if (match) {
    return `https://${match[1]}/${match[2].replace(/\.git$/, '')}`
  }
  return null
}

export default function TopBar({ archives, activeArchive, onSelectArchive, onDeleteArchive, gitInfo }) {
  const remote = gitInfo?.remote || null
  const branch = gitInfo?.branch || null
  const allBranches = gitInfo?.all_branches || []
  const [branchOpen, setBranchOpen] = useState(false)

  const repoName = extractRepoName(remote)
  const httpsUrl = sshToHttps(remote)

  let remoteDisplay = null
  if (remote) {
    try {
      const u = new URL(remote)
      remoteDisplay = u.host + u.pathname.replace(/\.git$/, '')
    } catch {
      remoteDisplay = remote
    }
  }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo">
          <img src={logoUrl} alt="GlideIt Logo" width="22" height="22" style={{ borderRadius: '3px', objectFit: 'contain' }} />
          <span className="topbar-wordmark">GlideIt</span>
          {repoName && <span className="topbar-repo-name">{repoName}</span>}
        </div>
      </div>

      <div className="topbar-right">
        <ArchiveSelector
          archives={archives}
          activeArchive={activeArchive}
          onSelect={onSelectArchive}
          onDelete={onDeleteArchive}
        />

        <a
          className="topbar-github"
          href="https://github.com/abhishekmohite55/GlideIt"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View GlideIt on GitHub"
        >
          <GitHubIcon />
          <span>GitHub</span>
        </a>

        {remoteDisplay && (
          <a
            className="topbar-remote topbar-remote--link"
            href={httpsUrl || remote}
            target="_blank"
            rel="noopener noreferrer"
            title={remote}
          >
            {remoteDisplay}
          </a>
        )}

        {branch && (
          <div className="topbar-branch-selector" onMouseLeave={() => setBranchOpen(false)}>
            <button
              className="topbar-branch-trigger"
              onClick={() => setBranchOpen(v => !v)}
            >
              {'\u2387'} {branch}
            </button>
            {branchOpen && allBranches.length > 0 && (
              <div className="topbar-branch-dropdown">
                {allBranches.map(b => (
                  <div
                    key={b}
                    className={`topbar-branch-item ${b === branch ? 'active' : ''}`}
                    onClick={() => setBranchOpen(false)}
                  >
                    {b === branch ? '\u2713 ' : '\u2387 '}{b}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

TopBar.propTypes = {
  archives: PropTypes.array,
  activeArchive: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    filename: PropTypes.string.isRequired,
  }),
  onSelectArchive: PropTypes.func,
  onDeleteArchive: PropTypes.func,
  gitInfo: PropTypes.shape({
    branch: PropTypes.string,
    remote: PropTypes.string,
    all_branches: PropTypes.arrayOf(PropTypes.string),
  }),
}
