import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { requestNotificationPermission } from './lib/notifications'
import './index.css'

// Request notification permission on app load
requestNotificationPermission()

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element not found. Ensure there is a <div id="root"> in index.html.')
}
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
