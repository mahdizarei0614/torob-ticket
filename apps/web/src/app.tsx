import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ConsumerRoutes } from './routes';
import {ProviderHandoffBoundary} from './features/referral/provider-handoff';
export function App() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } }));
  return <QueryClientProvider client={client}><ProviderHandoffBoundary><ConsumerRoutes /></ProviderHandoffBoundary></QueryClientProvider>;
}
