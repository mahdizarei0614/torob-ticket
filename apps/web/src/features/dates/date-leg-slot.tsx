import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Placement only. DateExplorer keeps the leg/calendar/interaction owner.
 * Undefined means standalone; null means a composed host is mounting. */
export const DateLegSlotContext = createContext<HTMLElement | null | undefined>(undefined);
export function DateLegControl({ children }: { children: ReactNode }) {
 const host = useContext(DateLegSlotContext);
 return host === undefined ? children : host ? createPortal(children, host) : null;
}
