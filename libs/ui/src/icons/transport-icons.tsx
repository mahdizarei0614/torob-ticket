import {useId} from 'react';
import type {Mode} from '@torob-ticket/contracts';
import s from './icons.module.css';
export interface TransportIconProps {mode:Mode;label?:string;size?:16|20|24|32;className?:string}
export function TransportGlyph({mode}:{mode:Mode}) {
 if(mode==='flight')return <><path d="m12 2 2 7 7 4v2l-7-2v5l3 2v1l-5-1-5 1v-1l3-2v-5l-7 2v-2l7-4z"/><path d="M11 5h2"/></>;
 if(mode==='train')return <><rect x="5" y="2.5" width="14" height="16" rx="4"/><path d="M5 11h14M9 6h6M8.5 18.5 6 22m9.5-3.5L18 22M8 21h8"/><circle cx="8.5" cy="14.5" r=".8"/><circle cx="15.5" cy="14.5" r=".8"/></>;
 return <><rect x="4.5" y="3" width="15" height="17" rx="3"/><path d="M4.5 12h15M9 6h6M2 8v5m20-5v5M7.5 20v2m9-2v2"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></>;
}
/** Decorative beside text; label opts into one accessible image name. */
export function TransportIcon({mode,label,size=20,className}:TransportIconProps) {
 const id=useId(),named=Boolean(label?.trim());
 return <svg className={[s.icon,className].filter(Boolean).join(' ')} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" focusable="false" aria-hidden={named?undefined:true} role={named?'img':undefined} aria-labelledby={named?id:undefined} data-transport-icon={mode}>{named&&<title id={id}>{label}</title>}<TransportGlyph mode={mode}/></svg>;
}
