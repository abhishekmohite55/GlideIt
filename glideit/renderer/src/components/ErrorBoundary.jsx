import PropTypes from 'prop-types';
import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          color: '#f87171',
          fontFamily: 'monospace',
          background: '#1a1a2e',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <h2 style={{ color: '#fb923c', marginBottom: '8px' }}>⚠ Visualization Error</h2>
          <p style={{ color: '#e2e8f0', marginBottom: '16px' }}>Something went wrong rendering this view.</p>
          <pre style={{
            background: '#0f0f1a',
            padding: '16px',
            borderRadius: '8px',
            color: '#94a3b8',
            maxWidth: '600px',
            overflowX: 'auto',
            border: '1px solid #334155',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '20px',
              padding: '8px 24px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
}

export default ErrorBoundary;
