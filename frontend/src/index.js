import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import './theme.css';
import ErrorBoundary from './ErrorBoundary';
import { initNative } from './native';

initNative();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);