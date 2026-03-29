import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

window.addEventListener('error', e => {
    console.error('Global error:', e);
    alert('React Crash: ' + e.message + '\nAt: ' + e.filename + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', e => {
    console.error('Unhandled rejection:', e);
    alert('Promise Rejection: ' + e.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
