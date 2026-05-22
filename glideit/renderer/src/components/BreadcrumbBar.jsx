
/**
 * Displays the call chain path at the top of the canvas.
 * path is an array of node objects ordered from entry point to hovered node.
 */
import PropTypes from 'prop-types'

BreadcrumbBar.propTypes = {
  path: PropTypes.array,
  onNodeClick: PropTypes.func,
}

export function BreadcrumbBar({ path, onNodeClick }) {
  if (!path || path.length === 0) return null;

  // Color by node type — matches the node border colors from design doc
  const typeColor = {
    'flask_route':      '#00C853',
    'react_component':  '#AA00FF',
    'python_function':  '#1E90FF',
    'external_call':    '#555555',
    'python_class':     '#FF8C00',
  };

  return (
    <div style={{
      position: 'absolute',
      top: '60px',              // below the navbar
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      background: 'rgba(20, 20, 20, 0.92)',
      border: '1px solid #2a2a2a',
      borderRadius: '999px',
      padding: '5px 14px',
      backdropFilter: 'blur(8px)',
      maxWidth: '80vw',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      // pointer-events: none is overridden per item if interactive
      pointerEvents: onNodeClick ? 'auto' : 'none',
    }}>
      {path.map((node, index) => {
        const color = typeColor[node.type] ?? '#888';
        const isLast = index === path.length - 1;

        return (
          <span key={node.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Separator arrow (not shown before first item) */}
            {index > 0 && (
              <span style={{ color: '#444', fontSize: '11px', margin: '0 2px' }}>→</span>
            )}

            {/* Node name with type color */}
            <button
              type="button"
              onClick={() => onNodeClick?.(node.id)}
              onKeyDown={e => e.key === 'Enter' && onNodeClick?.(node.id)}
              style={{
                fontSize: '12px',
                color: isLast ? '#F0F0F0' : color,
                fontWeight: isLast ? '600' : '400',
                fontFamily: 'monospace',
                cursor: onNodeClick ? 'pointer' : 'default',
                pointerEvents: 'auto',
                transition: 'color 0.2s',
                textDecoration: onNodeClick && !isLast ? 'underline' : 'none',
                textDecorationColor: 'rgba(255, 255, 255, 0.15)',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
              title={onNodeClick ? `Click to center on ${node.name}` : undefined}
            >
              {node.name}
            </button>
          </span>
        );
      })}
    </div>
  );
}
