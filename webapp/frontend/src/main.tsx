import React from 'react';
import ReactDOM from 'react-dom/client';
import { FujinThemeProvider, FujinToastProvider } from '@fujin';

import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FujinThemeProvider preset="violet" defaultMode="dark">
      <FujinToastProvider>
        <App />
      </FujinToastProvider>
    </FujinThemeProvider>
  </React.StrictMode>
);
