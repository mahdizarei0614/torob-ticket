import { ThemeProvider } from '@torob-ticket/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(<StrictMode><ThemeProvider language="en" variant="admin"><App /></ThemeProvider></StrictMode>);
