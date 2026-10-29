import { createContext } from 'react';
import type { AdminControlConfig, CatalogSnapshot } from '@torob-ticket/contracts';

export interface AdminContextValue {
  epoch: number;
  config?: AdminControlConfig;
  catalog?: CatalogSnapshot;
  busy: boolean;
  problem?: unknown;
  resume: () => Promise<void>;
  feedback: string;
  error: string;
  run: <T>(action: () => Promise<T>, done?: (value: T) => void) => Promise<void>;
  refresh: () => void;
  reset: () => Promise<void>;
}

// Keep the provider identity independent of client/domain implementation changes.
export const AdminContext = createContext<AdminContextValue | undefined>(undefined);
