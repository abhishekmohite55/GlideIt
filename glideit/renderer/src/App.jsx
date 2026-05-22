import React, { useState, useEffect } from 'react'
import Navbar from './components/Navbar.jsx'
import CodeFlowPage from './components/CodeFlowPage.jsx'
import ApiPage from './components/ApiPage.jsx'
import JsxPage from './components/JsxPage.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

export default function App() {
  const [activePage, setActivePage] = useState('codeflow')
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (globalThis.__GLIDEIT_DATA__) {
      setGraphData(globalThis.__GLIDEIT_DATA__)
      setLoading(false)
      return
    }

    fetch('./graph-data.json')
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load graph-data.json (${r.status})`)
        return r.json()
      })
      .then(data => {
        setGraphData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return (
    <div className="app-root">
      <Navbar activePage={activePage} onNavigate={setActivePage} />

      {loading && (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Loading graph data...</p>
        </div>
      )}

      {error && (
        <div className="error-screen">
          <h2>⚠ Failed to load graph data</h2>
          <p>{error}</p>
          <p className="error-hint">
            Make sure <code>graph-data.json</code> is in the same directory as this file.
          </p>
        </div>
      )}

      {!loading && !error && graphData && (
        <div className="page-container">
          {activePage === 'codeflow' && (
            <ErrorBoundary>
              <CodeFlowPage data={graphData} />
            </ErrorBoundary>
          )}
          {activePage === 'api' && (
            <ErrorBoundary>
              <ApiPage data={graphData} />
            </ErrorBoundary>
          )}
          {activePage === 'jsx' && (
            <ErrorBoundary>
              <JsxPage data={graphData} />
            </ErrorBoundary>
          )}
        </div>
      )}
    </div>
  )
}
