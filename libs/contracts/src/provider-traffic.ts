import {z} from 'zod';
import {IdSchema,ISOInstantSchema,LocalDateSchema,NonnegativeIntegerSchema,PositiveIntegerSchema} from './common';

export const ReferralTierSchema=z.strictObject({upTo:PositiveIntegerSchema.nullable(),rateRial:NonnegativeIntegerSchema.nullable()});
export const ReferralTiersSchema=z.array(ReferralTierSchema).min(1).max(12).superRefine((tiers,c)=>{
 let prior=0;for(let i=0;i<tiers.length;i++){const t=tiers[i]!;if(i===tiers.length-1?t.upTo!==null:t.upTo===null||t.upTo<=prior)c.addIssue({code:'custom',path:[i,'upTo'],message:'ascending-finite-tiers-with-unbounded-last-required'});if(t.upTo!==null)prior=t.upTo;}
});
export const ProviderTariffSchema=z.strictObject({providerId:IdSchema,revision:IdSchema,tiers:ReferralTiersSchema,updatedAt:ISOInstantSchema.nullable()});
export type ProviderTariff=z.infer<typeof ProviderTariffSchema>;
export const UpdateProviderTariffSchema=z.strictObject({baseRevision:IdSchema,tiers:ReferralTiersSchema});
export type UpdateProviderTariff=z.infer<typeof UpdateProviderTariffSchema>;
export const TrafficQuerySchema=z.strictObject({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),providerId:IdSchema.optional(),kind:z.enum(['transport','hotel']).optional(),from:ISOInstantSchema.optional(),to:ISOInstantSchema.optional(),offset:z.coerce.number().int().min(0).max(100000).optional().default(0),limit:z.coerce.number().int().min(1).max(100).optional().default(25)}).refine(x=>!x.from||!x.to||Date.parse(x.from)<Date.parse(x.to),'invalid-half-open-range');
export type TrafficQuery=z.infer<typeof TrafficQuerySchema>;
export const TrafficCountsSchema=z.strictObject({outbound:NonnegativeIntegerSchema,uniqueVisitorSessions:NonnegativeIntegerSchema,billable:NonnegativeIntegerSchema,repeats:NonnegativeIntegerSchema,knownFeeRial:NonnegativeIntegerSchema,unpricedBillable:NonnegativeIntegerSchema,transport:NonnegativeIntegerSchema,hotel:NonnegativeIntegerSchema});
export type TrafficCounts=z.infer<typeof TrafficCountsSchema>;
export const OutboundReferralSchema=z.strictObject({referralId:IdSchema,providerId:IdSchema,kind:z.enum(['transport','hotel']),redirectedAt:ISOInstantSchema,billable:z.boolean(),reason:z.enum(['eligible','repeat-within-hour']),monthKey:z.string(),monthOrdinal:PositiveIntegerSchema.nullable(),rateRial:NonnegativeIntegerSchema.nullable(),tariffRevision:IdSchema,tierIndex:NonnegativeIntegerSchema.nullable()});
export type OutboundReferral=z.infer<typeof OutboundReferralSchema>;
export const ProviderTrafficSchema=z.strictObject({period:z.strictObject({monthKey:z.string(),currentMonthKey:z.string(),from:ISOInstantSchema,to:ISOInstantSchema,timeZone:z.literal('Asia/Tehran'),calendar:z.literal('persian')}),policy:z.strictObject({windowMinutes:z.literal(60),pricing:z.literal('graduated'),uniqueVisitorBasis:z.literal('visitor-session'),eventBasis:z.literal('redirect-issued')}),totals:TrafficCountsSchema,providers:z.array(z.strictObject({providerId:IdSchema,counts:TrafficCountsSchema,lastOutboundAt:ISOInstantSchema.nullable(),tariff:ProviderTariffSchema,billingMonthBillable:NonnegativeIntegerSchema})),daily:z.array(z.strictObject({date:LocalDateSchema,counts:TrafficCountsSchema})),events:z.strictObject({offset:NonnegativeIntegerSchema,limit:PositiveIntegerSchema,total:NonnegativeIntegerSchema,items:z.array(OutboundReferralSchema)}),availableMonths:z.array(z.string())});
export type ProviderTraffic=z.infer<typeof ProviderTrafficSchema>;
