import PropTypes from 'prop-types'
import React, { useState, useRef, useEffect } from 'react'

function ArchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function ArchiveSelector({ archives, activeArchive, onSelect, onDelete }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  function handleSelect(item) {
    onSelect(item)
    setOpen(false)
  }

  function handleDelete(e, archiveId) {
    e.stopPropagation()
    onDelete(archiveId)
  }

  return (
    <div className="archive-selector" ref={menuRef}>
      <button
        className="archive-selector-trigger"
        onClick={() => setOpen(v => !v)}
        title="Archives"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ArchiveIcon />
        <span className="archive-selector-label">
          {activeArchive ? activeArchive.name : 'Archives'}
        </span>
      </button>

      {open && (
        <div className="archive-selector-dropdown" role="listbox">
          <button
            className={`archive-selector-item ${!activeArchive ? 'active' : ''}`}
            onClick={() => handleSelect(null)}
            role="option"
            aria-selected={!activeArchive}
          >
            <span className="archive-selector-item-name">
              {!activeArchive && <CheckIcon />}
              Current Graph
            </span>
          </button>

          {archives.length === 0 && (
            <div className="archive-selector-empty">
              No archives yet. Run <code>glideit archive</code> to create one.
            </div>
          )}

          {archives.map(arch => (
            <div key={arch.id} className="archive-selector-item-row">
              <button
                className={`archive-selector-item ${activeArchive?.id === arch.id ? 'active' : ''}`}
                onClick={() => handleSelect(arch)}
                role="option"
                aria-selected={activeArchive?.id === arch.id}
              >
                <span className="archive-selector-item-name">
                  {activeArchive?.id === arch.id && <CheckIcon />}
                  {arch.name}
                </span>
                <span className="archive-selector-item-time">{arch.timestamp}</span>
              </button>
              <button
                className="archive-selector-delete"
                onClick={e => handleDelete(e, arch.id)}
                title="Delete archive"
                aria-label={`Delete ${arch.name}`}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

ArchiveSelector.propTypes = {
  archives: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    filename: PropTypes.string.isRequired,
    timestamp: PropTypes.string,
  })).isRequired,
  activeArchive: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    filename: PropTypes.string.isRequired,
  }),
  onSelect: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
}
