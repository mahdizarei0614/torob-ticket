import {BrowserRouter} from 'react-router';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import { ThemeProvider } from '@torob-ticket/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(<StrictMode><ThemeProvider language="en" variant="admin"><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BrowserRouter basename="/admin"><App /></BrowserRouter></QueryClientProvider></ThemeProvider></StrictMode>);
