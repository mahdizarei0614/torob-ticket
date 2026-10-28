import {useId,useState} from 'react';
import type {Mode} from '@torob-ticket/contracts';
import {TransportGlyph} from './transport-icons';
import {resolveAirlineBrand} from '../presentation/airline-brands';
import s from './icons.module.css';
import airlineStyles from './airline-mark.module.css';
export interface ProviderMarkProps {providerId?:string;operatorId?:string;mode?:Mode;label?:string;size?:24|32|40;className?:string}
const marks=[
 <path key="arch" d="M7 22V12l9-5 9 5v10M12 22v-7l4-2 4 2v7M6 25h20"/>,
 <path key="fold" d="m7 10 9-4 9 4-9 5-9-5Zm0 6 9 5 9-5M7 22l9 5 9-5"/>,
 <path key="ticket" d="M6 9h20v5a3 3 0 0 0 0 6v4H6v-4a3 3 0 0 0 0-6V9Zm11 2v2m0 3v2m0 3v1"/>,
 <path key="join" d="M7 24 19 8m-6 0L7 8v6m12 10h6v-6M7 16l6 8m6-16 6 8"/>,
 <><path key="wave" d="M6 21c4-14 7-14 11 0s7 10 9-7M7 25c4-4 8-4 12 0"/><circle key="dot" cx="24" cy="8" r="2"/></>,
 <path key="compass" d="m16 5 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Zm0 8v6m-3-3h6"/>,
];
/** Presentation only: a known authored ID chooses a local mark; it never establishes provider/source authority. */
export function ProviderMark({providerId,operatorId,mode,label,size=32,className}:ProviderMarkProps) {
 const id=useId(),named=Boolean(label?.trim());
 const [failedAirline,setFailedAirline]=useState<string|null>(null);
 const airline=!providerId&&operatorId&&mode?resolveAirlineBrand(operatorId,mode):undefined;
 if(airline&&failedAirline!==airline.id)return <img className={[airlineStyles.airlineMark,className].filter(Boolean).join(' ')} src={airline.assets[64]} srcSet={`${airline.assets[64]} 1x, ${airline.assets[128]} 2x`} width={size} height={size} alt={named?label:''} aria-hidden={named?undefined:true} data-provider-mark={`airline-${airline.id}`} data-airline-brand={airline.id} decoding="async" draggable={false} onError={()=>setFailedAirline(airline.id)}/>;
 const provider=!operatorId&&providerId?/^demo-provider-0([1-6])$/.exec(providerId):null;
 const operator=!providerId&&operatorId&&mode?/^demo-operator-(flight|train|bus)-([0-2])$/.exec(operatorId):null;
 const knownOperator=!airline&&(Boolean(operator&&operator[1]===mode)||!providerId&&operatorId==='demo-transfer-operator'&&mode==='bus');
 const mark=provider?`provider-${provider[1]}`:knownOperator?`operator-${mode}-${operator?.[2]??'transfer'}`:'unknown';
 return <svg className={[s.mark,className].filter(Boolean).join(' ')} width={size} height={size} viewBox="0 0 32 32" focusable="false" aria-hidden={named?undefined:true} role={named?'img':undefined} aria-labelledby={named?id:undefined} data-provider-mark={mark}>{named&&<title id={id}>{label}</title>}<rect x="1" y="1" width="30" height="30" rx="9" fill="var(--accent-soft)"/><g fill="none" stroke="var(--accent)" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{provider?marks[Number(provider[1])-1]:knownOperator?<g transform="translate(6 6) scale(.8333)"><TransportGlyph mode={mode!}/></g>:<><circle cx="16" cy="16" r="8" strokeDasharray="2 3"/><path d="M12 16h8"/></>}</g></svg>;
}
