import {useId,type ReactNode} from 'react';
import s from './illustrations.module.css';
export interface IllustrationProps {label?:string;className?:string;size?:'compact'|'full'}
export function IllustrationFrame({children,label,className,size='full',name}:{children:ReactNode;name:string}&IllustrationProps) {
 const id=useId(),named=Boolean(label?.trim());
 return <svg viewBox="0 0 360 180" className={[s.art,className].filter(Boolean).join(' ')} focusable="false" aria-hidden={named?undefined:true} role={named?'img':undefined} aria-labelledby={named?id:undefined} data-illustration={name} data-size={size}>{named&&<title id={id}>{label}</title>}{children}</svg>;
}
export function RouteDots(){return <g fill="var(--border-strong)" opacity=".45">{[0,1,2,3,4].flatMap(row=>[0,1,2,3,4,5].map(col=><circle key={`${row}-${col}`} cx={278+col*7} cy={26+row*7} r=".9"/>))}</g>;}
