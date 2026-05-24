import React, { useState, useEffect, useCallback } from 'react'
import Navbar from './components/Navbar.jsx'
import CodeFlowPage from './components/CodeFlowPage.jsx'
import ApiPage from './components/ApiPage.jsx'
import JsxPage from './components/JsxPage.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

async function fetchJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url} (${r.status})`)
  return r.json()
}

const ARCHIVES_URL = './archives/index.json'

export default function App() {
  const [activePage, setActivePage] = useState('codeflow')
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [archives, setArchives] = useState([])
  const [activeArchive, setActiveArchive] = useState(null)

  // Load the current graph data
  const loadCurrentGraph = useCallback(() => {
    if (globalThis.__GLIDEIT_DATA__) {
      setGraphData(globalThis.__GLIDEIT_DATA__)
      setActiveArchive(null)
      setLoading(false)
      return Promise.resolve()
    }

    return fetchJson('./graph-data.json')
      .then(data => {
        setGraphData(data)
        setActiveArchive(null)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Load archives list
  useEffect(() => {
    fetchJson(ARCHIVES_URL)
      .then(list => setArchives(list))
      .catch(() => {})  // silently fail — no archives yet
  }, [])

  // Load initial graph
  useEffect(() => {
    loadCurrentGraph()
  }, [loadCurrentGraph])

  function handleSelectArchive(archive) {
    if (!archive) {
      loadCurrentGraph()
      return
    }

    setLoading(true)
    fetchJson(`./archives/${archive.filename}`)
      .then(data => {
        setGraphData(data)
        setActiveArchive(archive)
        setLoading(false)
      })
      .catch(err => {
        setError(`Failed to load archive: ${err.message}`)
        setLoading(false)
      })
  }

  function handleDeleteArchive(archiveId) {
    fetch(`/api/archives/${archiveId}`, { method: 'DELETE' })
      .then(r => {
        if (!r.ok) throw new Error('Delete failed')
        setArchives(prev => prev.filter(a => a.id !== archiveId))
        if (activeArchive?.id === archiveId) {
          loadCurrentGraph()
        }
      })
      .catch(() => {
        alert('Deletion is only supported when running locally (glideit serve).')
      })
  }

  return (
    <div className="app-root">
      <Navbar
        activePage={activePage}
        onNavigate={setActivePage}
        archives={archives}
        activeArchive={activeArchive}
        onSelectArchive={handleSelectArchive}
        onDeleteArchive={handleDeleteArchive}
      />

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
