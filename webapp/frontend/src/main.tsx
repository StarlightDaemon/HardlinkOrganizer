import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { FujinThemeProvider, FujinToastProvider } from '@fujin';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider>
      <FujinThemeProvider defaultMode="dark">
        <FujinToastProvider>
          <App />
        </FujinToastProvider>
      </FujinThemeProvider>
    </MantineProvider>
  </React.StrictMode>
);
