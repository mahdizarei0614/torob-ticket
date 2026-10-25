import type {ReferralIntent} from '@torob-ticket/contracts';
export type ReferralPayload=ReferralIntent['quote'];
export function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value);
}
export function complete(payload:ReferralPayload,now:number){const q=payload.quote;return q.completeness.status==='complete'&&q.eligibility.status==='eligible'&&Date.parse(q.observedAt)<=now&&Date.parse(q.expiresAt)>now;}
export function sameLineage(old:ReferralPayload,next:ReferralPayload){
 if(old.kind!==next.kind||old.quote.quoteId!==next.quote.quoteId||next.quote.version<=old.quote.version||old.quote.providerId!==next.quote.providerId)return false;
 if(old.kind==='transport'&&next.kind==='transport')return old.quote.fareId===next.quote.fareId&&old.quote.itineraryId===next.quote.itineraryId&&canonical(old.itinerary)===canonical(next.itinerary)&&canonical(old.quote.party)===canonical(next.quote.party)&&old.quote.conditions.outbound.classCode===next.quote.conditions.outbound.classCode&&old.quote.conditions.return?.classCode===next.quote.conditions.return?.classCode;
 return old.kind==='hotel'&&next.kind==='hotel'&&old.quote.hotelId===next.quote.hotelId&&canonical(old.quote.query)===canonical(next.quote.query)&&canonical(old.quote.roomAllocation)===canonical(next.quote.roomAllocation);
}
export function sameFacts(old:ReferralPayload,next:ReferralPayload){
 if(old.kind!==next.kind)return false;
 if(old.kind==='transport'&&next.kind==='transport')return canonical([old.quote.total,old.quote.breakdown,old.quote.conditions])===canonical([next.quote.total,next.quote.breakdown,next.quote.conditions]);
 return old.kind==='hotel'&&next.kind==='hotel'&&canonical([old.quote.total,old.quote.breakdown,old.quote.terms,old.quote.roomAllocation,old.quote.roomDetails])===canonical([next.quote.total,next.quote.breakdown,next.quote.terms,next.quote.roomAllocation,next.quote.roomDetails]);
}
