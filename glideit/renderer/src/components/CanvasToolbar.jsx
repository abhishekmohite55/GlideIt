import PropTypes from 'prop-types'
import React from 'react'

export function CanvasToolbar({
  layoutDirection,
  onLayoutToggle,
  nodeCount,
  edgeCount,
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      pointerEvents: 'none',
    }}>
      {/* Layout direction toggle + node/edge count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(26, 26, 26, 0.92)',
        border: '1px solid #333',
        borderRadius: '999px',
        padding: '6px 16px',
        pointerEvents: 'all',
        backdropFilter: 'blur(8px)',
      }}>
        {/* Layout direction toggle */}
        <button
          onClick={onLayoutToggle}
          title="Toggle layout direction (L)"
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '2px 6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            outline: 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#F0F0F0'}
          onMouseLeave={e => e.currentTarget.style.color = '#888'}
        >
          {layoutDirection === 'DOWN' ? '↕ TB' : '↔ LR'}
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '16px', background: '#333', margin: '0 4px' }} />

        {/* Node/edge count badge */}
        <span style={{
          color: '#888',
          fontSize: '12px',
          userSelect: 'none',
        }}>
          {nodeCount} nodes · {edgeCount} edges
        </span>
      </div>
    </div>
  );
}

CanvasToolbar.propTypes = {
  layoutDirection: PropTypes.string.isRequired,
  onLayoutToggle: PropTypes.func.isRequired,
  nodeCount: PropTypes.number.isRequired,
  edgeCount: PropTypes.number.isRequired,
}
