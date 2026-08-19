import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check for service worker updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // every hour

      // Handle push notifications
      if ('Notification' in window && 'PushManager' in window) {
        // Request notification permission on first visit
        if (Notification.permission === 'default') {
          // Don't auto-request, wait for user action
        }
      }

      // Listen for sync messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'TRIGGER_SYNC') {
          // Trigger sync in the app
          window.dispatchEvent(new CustomEvent('sw-sync-trigger'));
        }
      });
    }).catch(() => {});
  });
}
