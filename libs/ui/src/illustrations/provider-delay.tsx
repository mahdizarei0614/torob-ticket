import type {Mode} from '@torob-ticket/contracts';
import {TransportGlyph} from '../icons/transport-icons';
import {IllustrationFrame,RouteDots,type IllustrationProps} from './illustration-frame';
export type ProviderDelayIllustrationProps=IllustrationProps&{mode?:Mode};
/** A still waiting-room composition; clock hands intentionally do not encode a real delay estimate. */
export function ProviderDelayIllustration({mode='flight',...props}:ProviderDelayIllustrationProps) {
 return <IllustrationFrame {...props} name="provider-delay"><RouteDots/>
  <path d="M32 149h296" stroke="var(--border)" strokeWidth="1.5"/>
  <path d="M80 148V52h153v96" fill="var(--surface-subtle)" stroke="var(--border-strong)" strokeWidth="1.5"/>
  <path d="M71 52h171M93 42h31m7 0h9" stroke="var(--border-strong)" strokeWidth="1.7" strokeLinecap="round"/>
  <rect x="96" y="67" width="121" height="21" rx="5" fill="var(--surface)"/>
  <rect x="96" y="95" width="121" height="21" rx="5" fill="var(--surface)"/>
  <rect x="96" y="123" width="121" height="15" rx="5" fill="var(--surface)"/>
  <g stroke="var(--border-strong)" strokeWidth="2" strokeLinecap="round"><path d="M123 77h37m12 0h20M123 105h27m12 0h30M108 130h52m12 0h20"/></g>
  <g transform="translate(102 70) scale(.6)" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><TransportGlyph mode={mode}/></g>
  <circle cx="109" cy="105" r="4" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.3"/>
  <circle cx="250" cy="69" r="33" fill="var(--accent-soft)"/>
  <circle cx="250" cy="69" r="24" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2"/>
  <path d="M250 52v17l10 6m-10-28v4m0 36v4m-22-22h4m36 0h4" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
  <path d="M254 107c15 0 25 13 25 25v16m-9-23 9 8 8-12" fill="none" stroke="var(--border-strong)" strokeWidth="1.6" strokeLinecap="round"/>
  <rect x="44" y="116" width="23" height="32" rx="5" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.6"/>
  <path d="M51 116v-7h9v7m-12 12h15m-15 7h15" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round"/>
  <circle cx="50" cy="150" r="2" fill="var(--border-strong)"/><circle cx="61" cy="150" r="2" fill="var(--border-strong)"/>
 </IllustrationFrame>;
}
