import {IllustrationFrame,RouteDots,type IllustrationProps} from './illustration-frame';
export type HotelStayIllustrationProps=IllustrationProps;
/** Local decorative architecture; never a photograph, exact property or source amenity claim. */
export function HotelStayIllustration(props:HotelStayIllustrationProps) {
 return <IllustrationFrame {...props} name="hotel-stay"><RouteDots/>
  <path d="M29 149h304" stroke="var(--border)" strokeWidth="1.5"/>
  <path d="M91 147V45h124v102M83 45h140m-119 0V31h98v14" fill="var(--surface-subtle)" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinejoin="round"/>
  <rect x="130" y="111" width="47" height="36" rx="2" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5"/>
  <path d="M153 113v34m-33-36h67" stroke="var(--border-strong)" strokeWidth="1.5"/>
  <path d="M117 102h73l-7 12h-59z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"/>
  {[0,1].flatMap(row=>[0,1,2,3].map(col=><rect key={`${row}-${col}`} x={107+col*27} y={57+row*24} width="13" height="14" rx="2" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.3"/>))}
  <path d="M143 37h21" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"/>
  <path d="M239 102c0-16 11-28 26-28s26 12 26 28c0 20-26 38-26 38s-26-18-26-38Z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.8"/>
  <g fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"><path d="M251 105V91m0 9h28v11m-28-5h28M255 95h8v5h-8zm10 0h9a5 5 0 0 1 5 5h-14"/></g>
  <rect x="62" y="118" width="23" height="30" rx="5" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5"/>
  <path d="M68 118v-9h10v9m-10 10v11m10-11v11M49 147v-28m0 10-8-7m8 16 9-10" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
  <circle cx="67" cy="150" r="2" fill="var(--border-strong)"/><circle cx="80" cy="150" r="2" fill="var(--border-strong)"/>
  <path d="M310 147v-26m0 10-9-6m9 13 9-9" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round"/>
 </IllustrationFrame>;
}
