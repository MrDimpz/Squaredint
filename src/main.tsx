import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress Vite HMR dev server WebSocket transport warnings in iframe environment per runtime constraints
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event?.reason?.message || event?.reason || '');
    if (
      reasonStr.includes('createWebSocketModuleRunnerTransport') ||
      reasonStr.includes('WebSocket') ||
      reasonStr.includes('@vite/client')
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
