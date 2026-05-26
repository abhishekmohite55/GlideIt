import PropTypes from 'prop-types';
import React, { useState } from 'react';

// Node type legend items
const NODE_LEGEND = [
  { label: 'Python function', bg: '#1A1A2E', border: '#1E90FF' },
  { label: 'Flask route',     bg: '#1A2E1A', border: '#00C853' },
  { label: 'React component', bg: '#2E1A2E', border: '#AA00FF' },
  { label: 'External call',   bg: '#2A2A2A', border: '#555555' },
];

// Edge type legend items
const EDGE_LEGEND = [
  { label: 'Direct call',   style: 'solid',  color: '#1E90FF' },
  { label: 'Nested call',   style: 'dashed', color: '#888888' },
  { label: 'Data flow',     style: 'solid',  color: '#F59E0B' },
  { label: 'Render (JSX)',  style: 'solid',  color: '#AA00FF' },
];

// Keyboard shortcuts
const SHORTCUTS = [
  { keys: ['Space', 'drag'],          action: 'Pan canvas' },
  { keys: ['Alt', 'drag'],            action: 'Move selected node' },
  { keys: ['Shift', 'click'],         action: 'Highlight call chain' },
  { keys: ['Space', 'scroll'],        action: 'Scroll vertically' },
  { keys: ['Shift', 'scroll'],        action: 'Scroll horizontally' },
  { keys: ['Drag on empty canvas'],   action: 'Box-select nodes' },
  { keys: ['Ctrl', '+'],              action: 'Zoom in' },
  { keys: ['Ctrl', '-'],              action: 'Zoom out' },
  { keys: ['Ctrl', 'Shift', 'F'],    action: 'Fit all to screen' },
  { keys: ['Ctrl', 'Home'],           action: 'Jump to entry points' },
  { keys: ['Esc'],                    action: 'Deselect / collapse' },
  { keys: ['Enter'],                  action: 'Expand selected node' },
  { keys: ['P'],                      action: 'Pin / unpin node' },
  { keys: ['M'],                      action: 'Toggle minimap' },

  { keys: ['L'],                      action: 'Toggle layout direction' },
  { keys: ['Ctrl', 'Shift', 'R'],    action: 'Reset layout' },
  { keys: ['?'],                      action: 'Toggle this panel' },
];

// Simple SVG lines to show edge styles
EdgeSample.propTypes = {
  style: PropTypes.string,
  color: PropTypes.string,
}

function EdgeSample({ style, color }) {
  const isDashed = style === 'dashed';
  return (
    <svg width="32" height="12" style={{ display: 'block', flexShrink: 0 }}>
      <line
        x1="2" y1="6" x2="30" y2="6"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={isDashed ? '4,3' : undefined}
      />
      <polygon points="28,3 32,6 28,9" fill={color} />
    </svg>
  );
}

// Small colored box to show node type
NodeSample.propTypes = {
  bg: PropTypes.string,
  border: PropTypes.string,
}

function NodeSample({ bg, border }) {
  return (
    <div style={{
      width: '18px',
      height: '14px',
      background: bg,
      border: `2px solid ${border}`,
      borderRadius: '3px',
      flexShrink: 0,
    }} />
  );
}

// Keyboard key pill
Key.propTypes = {
  label: PropTypes.string,
}

function Key({ label }) {
  return (
    <span style={{
      fontFamily: 'monospace',
      fontSize: '10px',
      background: '#2a2a2a',
      border: '1px solid #444',
      borderRadius: '3px',
      padding: '1px 5px',
      color: '#ccc',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

LegendPanel.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
}

export function LegendPanel({ isOpen, onClose }) {
  const [tab, setTab] = useState('legend'); // 'legend' or 'shortcuts'

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: '80px',         // sits above the toolbar
      left: '60px',
      zIndex: 20,
      width: '260px',
      background: 'rgba(20, 20, 20, 0.96)',
      border: '1px solid #333',
      borderRadius: '10px',
      backdropFilter: 'blur(10px)',
      overflow: 'hidden',
      color: '#F0F0F0',
      fontSize: '12px',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px 0',
      }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0' }}>
          {['legend', 'shortcuts'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 10px 6px',
                fontSize: '12px',
                cursor: 'pointer',
                color: tab === t ? '#F0F0F0' : '#666',
                borderBottom: tab === t ? '2px solid #1E90FF' : '2px solid transparent',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Close button */}
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
          title="Close (press ? to reopen)"
        >
          ×
        </button>
      </div>

      {/* Tab content */}
      <div style={{ padding: '12px 14px 14px' }}>

        {tab === 'legend' && (
          <>
            {/* Node types */}
            <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Node types
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '16px' }}>
              {NODE_LEGEND.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <NodeSample bg={item.bg} border={item.border} />
                  <span style={{ color: '#ccc' }}>{item.label}</span>
                </div>
              ))}
              {/* Entry point ring explanation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '18px', height: '14px',
                  background: '#1A1A2E',
                  border: '2px solid #1E90FF',
                  outline: '2px solid #3B82F6',
                  outlineOffset: '2px',
                  borderRadius: '3px',
                  flexShrink: 0,
                }} />
                <span style={{ color: '#ccc' }}>Entry point (ring = cluster)</span>
              </div>
            </div>

            {/* Edge types */}
            <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Edges
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {EDGE_LEGEND.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <EdgeSample style={item.style} color={item.color} />
                  <span style={{ color: '#ccc' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'shortcuts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {SHORTCUTS.map(sc => (
              <div key={sc.action} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ color: '#888', fontSize: '11px' }}>{sc.action}</span>
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
                  {sc.keys.map((k, i) => (
                    <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      {i > 0 && <span style={{ color: '#444', fontSize: '9px' }}>+</span>}
                      <Key label={k} />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Footer hint */}
      <div style={{
        borderTop: '1px solid #2a2a2a',
        padding: '6px 14px',
        color: '#555',
        fontSize: '10px',
        textAlign: 'center',
      }}>
        Press <Key label="?" /> to toggle this panel
      </div>

    </div>
  );
}
