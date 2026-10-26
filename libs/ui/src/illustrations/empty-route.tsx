import type {Mode,Scope} from '@torob-ticket/contracts';
import {TransportGlyph} from '../icons/transport-icons';
import {IllustrationFrame,RouteDots,type IllustrationProps} from './illustration-frame';
export type EmptyRouteIllustrationProps=IllustrationProps&{mode?:Mode;scope?:Scope};
/** Abstract scenery, not route availability, geographic evidence or a loading progress meter. */
export function EmptyRouteIllustration({mode='flight',scope='domestic',...props}:EmptyRouteIllustrationProps) {
 return <IllustrationFrame {...props} name="empty-route"><RouteDots/>
  <path d="M26 146h308" stroke="var(--border)" strokeWidth="1.5"/>
  <path d="M42 140V87l27-18 27 18v53M48 140V99h42v41" fill="var(--surface-subtle)" stroke="var(--border-strong)" strokeWidth="1.5"/>
  <path d="M58 79V52h22v27M54 52h30M61 99v41m15-41v41M51 113h37" fill="none" stroke="var(--border-strong)" strokeWidth="1.5"/>
  <path d="M250 140V87h44v53M257 87V65h28v22m-22-22V49h16v16M254 104h36m-36 16h36M265 91v49m14-49v49" fill="var(--surface-subtle)" stroke="var(--border-strong)" strokeWidth="1.5"/>
  <path d="M101 126c31 0 35-78 81-78s47 78 69 78" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray={mode==='flight'?'3 6':mode==='train'?'10 5':'2 5'}/>
  <circle cx="103" cy="126" r="6" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2"/><circle cx="250" cy="126" r="6" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2"/>
  <circle cx="180" cy="53" r="22" fill="var(--accent-soft)"/>
  <g transform="translate(168 41)" fill="none" stroke="var(--accent)" strokeWidth="1.65" strokeLinejoin="round" strokeLinecap="round"><TransportGlyph mode={mode}/></g>
  {scope==='international'?<g fill="none" stroke="var(--border-strong)" strokeWidth="1.4"><circle cx="119" cy="42" r="15"/><ellipse cx="119" cy="42" rx="6" ry="15"/><path d="M104 42h30m-28-7h26m-26 14h26"/></g>:<g fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round"><path d="M104 49h29m-24-7h18m-13-7h8M222 33h26m-21 7h16"/></g>}
  <path d="M45 146v-17m0 7-7-6m7 11 7-9M315 146v-22m0 11-8-9m8 15 8-10" fill="none" stroke="var(--border-strong)" strokeWidth="1.7" strokeLinecap="round"/>
  <rect x="127" y="143" width="106" height="17" rx="8.5" fill="var(--surface)" stroke="var(--border)"/>
  <path d="M143 152h36m8 0h13m8 0h8" stroke="var(--border-strong)" strokeWidth="2" strokeLinecap="round"/>
 </IllustrationFrame>;
}
