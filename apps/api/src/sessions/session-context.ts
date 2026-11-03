import type { SessionInfo } from '@torob-ticket/contracts';
import type { DataScope } from '@torob-ticket/data-access';
import type { DemoClock } from '@torob-ticket/domain';
export interface SessionContext {
  readonly sessionId: string;
  readonly visitorId?: string;
  readonly scope: DataScope;
  readonly info: SessionInfo;
  readonly demoClock: DemoClock;
}
/** Express-compatible subset, without leaking framework types into libraries. */
export interface SessionRequest {
  headers: { cookie?: string };
  query?: Record<string, unknown>;
  body?: unknown;
  secure?: boolean;
  sessionContext?: SessionContext;
}
export interface CookieResponse {
 setHeader(name:string,value:string|string[]):void;
 appendHeader?(name:string,value:string|string[]):void;
 getHeader?(name:string):number|string|string[]|undefined;
}
