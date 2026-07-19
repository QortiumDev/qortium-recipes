import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { applyDisplaySettings, getInitialDisplaySettings } from './displaySettings';
import '@fontsource-variable/lexend/wght.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/comic-neue/latin-400.css';
import '@fontsource/comic-neue/latin-700.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './styles.css';

applyDisplaySettings(getInitialDisplaySettings());

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
