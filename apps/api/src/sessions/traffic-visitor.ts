import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import type {CookieResponse} from './session-context';
export const TRAFFIC_VISITOR_COOKIE_PREFIX='torob_traffic_visitor_';
const identifier=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Namespace names prevent a late response from an old reset scope clobbering the current browser ID. */
export function trafficVisitorCookieName(sessionId:string){return TRAFFIC_VISITOR_COOKIE_PREFIX+createHash('sha256').update(sessionId).digest('hex').slice(0,32);}
function signature(sessionId:string,secret:string,visitorId:string){return createHmac('sha256',secret).update('torob-ticket:traffic-visitor:v1\0'+sessionId+'\0'+visitorId).digest();}
export function mintTrafficVisitor(sessionId:string,secret:string){const visitorId=randomUUID();return {visitorId,value:visitorId+'.'+signature(sessionId,secret,visitorId).toString('base64url')};}
export function verifyTrafficVisitor(header:string|undefined,sessionId:string,secret:string|undefined):string|undefined {
 if(!secret)return undefined;
 const name=trafficVisitorCookieName(sessionId),matches=(header??'').split(';').map(part=>part.trim()).filter(part=>part.startsWith(name+'='));
 if(matches.length!==1)return undefined;
 const value=matches[0]!.slice(name.length+1),parts=value.split('.');
 if(parts.length!==2||!identifier.test(parts[0]!)||!/^[A-Za-z0-9_-]{43}$/.test(parts[1]!))return undefined;
 const received=Buffer.from(parts[1]!,'base64url'),expected=signature(sessionId,secret,parts[0]!);
 return received.length===expected.length&&timingSafeEqual(received,expected)?parts[0]:undefined;
}
/** Browser-session lifetime matches auth; the live namespace enforces expiry/revocation server-side. */
export function trafficVisitorCookie(sessionId:string,value:string,secure:boolean){return `${trafficVisitorCookieName(sessionId)}=${value}; Path=/api; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;}
export function appendTrafficVisitorCookie(response:CookieResponse,cookie:string){
 if(response.appendHeader){response.appendHeader('Set-Cookie',cookie);return;}
 const previous=response.getHeader?.('Set-Cookie');
 response.setHeader('Set-Cookie',Array.isArray(previous)?[...previous,cookie]:typeof previous==='string'?[previous,cookie]:cookie);
}
