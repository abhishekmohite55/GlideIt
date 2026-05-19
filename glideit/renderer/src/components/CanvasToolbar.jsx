import React from 'react';

export function CanvasToolbar({
  visibleDepth,
  maxDepth,
  onDepthChange,
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
      {/* Depth slider row */}
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
        <span style={{ color: '#888', fontSize: '12px', whiteSpace: 'nowrap', userSelect: 'none' }}>
          Depth
        </span>
        <input
          type="range"
          min={0}
          max={maxDepth}
          value={visibleDepth > maxDepth ? maxDepth : visibleDepth}
          onChange={e => onDepthChange(Number(e.target.value))}
          style={{
            width: '120px',
            accentColor: '#1E90FF',
            cursor: 'pointer',
          }}
        />
        <span style={{ color: '#F0F0F0', fontSize: '12px', minWidth: '40px', textAlign: 'center', userSelect: 'none' }}>
          {visibleDepth >= maxDepth ? 'All' : `≤ ${visibleDepth}`}
        </span>

        {/* Divider */}
        <div style={{ width: '1px', height: '16px', background: '#333', margin: '0 4px' }} />

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
      </div>

      {/* Node/edge count badge */}
      <div style={{
        background: 'rgba(26, 26, 26, 0.85)',
        border: '1px solid #333',
        borderRadius: '999px',
        padding: '4px 14px',
        color: '#888',
        fontSize: '12px',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {nodeCount} nodes · {edgeCount} edges
      </div>
    </div>
  );
}
