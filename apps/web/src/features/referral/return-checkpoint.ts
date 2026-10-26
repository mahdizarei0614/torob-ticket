import {z} from 'zod';
import {GeoPointSchema,LocalDateSchema,TransportSearchQuerySchema,type TransportSearchQuery} from '@torob-ticket/contracts';
import type {HotelDraft} from '../hotels/hotel-state';
import {serializeSearchUrl} from '../search/search-url';

/** UI intent only. Receipt/search/hotel GETs must establish cookie-scoped authority before hydration. */
export interface ReturnCheckpoint {
 version:1;referralId:string;transportReferralId?:string;returnSearch:string;searchId:string;generation:string;draft:TransportSearchQuery;
 adoptedSequence:number;frozen:boolean;dismissedSuggestion:boolean;
 selected?:{groupId:string;quoteId:string;version:number};pinItineraryId?:string;direction:'outbound'|'return';
 camera?:{x:number;y:number;width:number;height:number;zoom:number};scrollY:number;
 hotel?:{open:boolean;stale?:boolean;referralId?:string;hotelSearchId?:string;draft:HotelDraft;selected?:{quoteId:string;version:number};scrollTop:number};
}
type CheckpointStorage=Pick<Storage,'getItem'|'setItem'>;
const MAX_RECORD_LENGTH=65536;
const id=z.string().min(1).max(200).refine(value=>value===value.trim());
const integer=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const position=z.number().finite().min(0).max(1e7);
const draftDate=z.union([z.literal(''),LocalDateSchema]);
function canonicalSearch(value:string){
 if(!value.startsWith('?')||value.length>12000)return false;
 try{
  const params=new URLSearchParams(value);
  if([...params.keys()].some(key=>key!=='q')||params.getAll('q').length!==1)return false;
  const parsed=TransportSearchQuerySchema.safeParse(JSON.parse(params.get('q')??''));
  return parsed.success&&serializeSearchUrl(parsed.data)===value;
 }catch{return false;}
}
const checkpointSchema=z.strictObject({
 version:z.literal(1),referralId:id,transportReferralId:id.optional(),returnSearch:z.string().refine(canonicalSearch),searchId:id,generation:id,
 draft:TransportSearchQuerySchema,adoptedSequence:integer,frozen:z.boolean(),dismissedSuggestion:z.boolean(),
 selected:z.strictObject({groupId:id,quoteId:id,version:integer.min(1)}).optional(),pinItineraryId:id.optional(),
 direction:z.enum(['outbound','return']),
 camera:z.strictObject({x:z.number().finite().min(-1e7).max(1e7),y:z.number().finite().min(-1e7).max(1e7),width:z.number().finite().positive().max(1e7),height:z.number().finite().positive().max(1e7),zoom:z.number().finite().min(0.01).max(100)}).optional(),scrollY:position,
 hotel:z.strictObject({
  open:z.boolean(),stale:z.boolean().optional(),referralId:id.optional(),hotelSearchId:id.optional(),
  draft:z.strictObject({checkIn:draftDate,checkOut:draftDate,rooms:z.number().int().min(1).max(20),childAges:z.array(z.string().refine(age=>age===''||/^\d{1,2}$/.test(age)&&Number(age)<=17)).max(8),arrivalConfirmed:z.boolean(),sort:z.enum(['cheapest','stars','arrival-distance','location-distance']),arrivalPlaceId:id.optional(),customPoint:GeoPointSchema.optional()}),
  selected:z.strictObject({quoteId:id,version:integer.min(1)}).optional(),scrollTop:position,
 }).optional(),
});
const storageKey=(referralId:string)=>`torob-ticket:return:v1:${referralId}`;

/** Invalid/foreign/blocked records are ignored; they never trigger a request or confirmation. */
export function readReturnCheckpoint(referralId:string,storage?:CheckpointStorage):ReturnCheckpoint|undefined{
 if(!id.safeParse(referralId).success)return undefined;
 try{
  const raw=(storage??globalThis.sessionStorage).getItem(storageKey(referralId));
  if(!raw||raw.length>MAX_RECORD_LENGTH)return undefined;
  const parsed=checkpointSchema.safeParse(JSON.parse(raw));
  return parsed.success&&parsed.data.referralId===referralId?parsed.data:undefined;
 }catch{return undefined;}
}
/** Denied or full storage is a truthful absence of restoration, never a failed referral. */
export function writeReturnCheckpoint(checkpoint:ReturnCheckpoint,storage?:CheckpointStorage):boolean{
 try{
  const parsed=checkpointSchema.safeParse(checkpoint);
  if(!parsed.success)return false;
  const raw=JSON.stringify(parsed.data);
  if(raw.length>MAX_RECORD_LENGTH)return false;
  (storage??globalThis.sessionStorage).setItem(storageKey(parsed.data.referralId),raw);
  return true;
 }catch{return false;}
}
