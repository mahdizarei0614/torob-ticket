import { z } from 'zod';
import { IdSchema, JourneyLegSchema, NonnegativeIntegerSchema, PartySchema, RawProviderRecordSchema, type RawProviderRecord } from '@torob-ticket/contracts';
import type { DecodedProviderRecord } from '@torob-ticket/domain';
const money = z.union([z.string().min(1),z.number().finite()]);
const decodedSchema = z.object({
  serviceKey:IdSchema, outbound:JourneyLegSchema, inbound:JourneyLegSchema.optional(),
  originAlias:IdSchema,destinationAlias:IdSchema,amount:money,unit:IdSchema,
  mandatoryCharge:money.nullish().transform(v=>v??null),classCode:IdSchema,
  baggageKg:z.number().nonnegative().nullish().transform(v=>v??null),
  refundable:z.boolean().nullish().transform(v=>v??null),available:z.boolean(),seats:NonnegativeIntegerSchema,party:PartySchema,
  sourceRevision:IdSchema,mappingRevision:IdSchema,fixtureVersion:IdSchema,
});
type Fields = Record<'serviceKey'|'outbound'|'inbound'|'originAlias'|'destinationAlias'|'amount'|'unit'|'mandatoryCharge'|'classCode'|'baggageKg'|'refundable'|'seats'|'party'|'revision',string>;
const dialects:Record<string,{marker:[string,unknown];fields:Fields;available?:string}> = {
  'demo-provider-01':{marker:['schema','p01/v1'],fields:{serviceKey:'service',outbound:'itinerary.outbound',inbound:'itinerary.return',originAlias:'labels.0',destinationAlias:'labels.1',amount:'fare.amount',unit:'fare.currency',mandatoryCharge:'fare.mandatory',classCode:'fare.class',baggageKg:'terms.bag',refundable:'terms.refund',seats:'inventory.seats',party:'passengers',revision:'revision'},available:'inventory.available'},
  'demo-provider-02':{marker:['format','p02/1'],fields:{serviceKey:'ticket_id',outbound:'trips.0',inbound:'trips.1',originAlias:'from_name',destinationAlias:'to_name',amount:'ticket.price',unit:'ticket.unit',mandatoryCharge:'ticket.tax',classCode:'ticket.cabin',baggageKg:'ticket.luggage',refundable:'ticket.cancellable',seats:'stock',party:'party',revision:'version'}},
  'demo-provider-03':{marker:['dialect','p03'],fields:{serviceKey:'key',outbound:'journeys.go',inbound:'journeys.back',originAlias:'names.origin',destinationAlias:'names.destination',amount:'cost.payable',unit:'cost.moneyUnit',mandatoryCharge:'cost.fees',classCode:'options.classCode',baggageKg:'options.checkedKg',refundable:'options.refundAllowed',seats:'sale.remaining',party:'travelers',revision:'evidence'},available:'sale.open'},
  'demo-provider-04':{marker:['schemaVersion',1],fields:{serviceKey:'reference',outbound:'legs.0.journey',inbound:'legs.1.journey',originAlias:'cityAliases.0',destinationAlias:'cityAliases.1',amount:'pricing.0.value',unit:'pricing.0.unit',mandatoryCharge:'pricing.0.mandatoryFees',classCode:'rules.class',baggageKg:'rules.bagKg',refundable:'rules.refundable',seats:'availability.count',party:'counts',revision:'source'},available:'availability.enabled'},
  'demo-provider-05':{marker:['api','five-v1'],fields:{serviceKey:'service_ref',outbound:'services.out',inbound:'services.in',originAlias:'endpoints.0',destinationAlias:'endpoints.1',amount:'payment.total',unit:'payment.denomination',mandatoryCharge:'payment.mandatory_charge',classCode:'conditions.seat_class',baggageKg:'conditions.baggage',refundable:'conditions.cancel',seats:'capacity.seats',party:'group',revision:'revisions'},available:'capacity.saleable'},
  'demo-provider-06':{marker:['type','six.inventory'],fields:{serviceKey:'id',outbound:'route.forward',inbound:'route.reverse',originAlias:'placeNames.0',destinationAlias:'placeNames.1',amount:'amounts.gross',unit:'amounts.unitAlias',mandatoryCharge:'amounts.charges',classCode:'attributes.0.class',baggageKg:'attributes.0.luggageKg',refundable:'attributes.0.refund',seats:'remaining',party:'partyCounts',revision:'meta'}},
};
function at(value:unknown,path:string):unknown {
  return path.split('.').reduce<unknown>((item,key)=>item!==null&&typeof item==='object'?(item as Record<string,unknown>)[key]:undefined,value);
}
export class RawDecodeError extends Error {
  constructor(readonly fieldPaths:(string|number)[][]) { super('MALFORMED_RAW'); }
}
/** Only source structure is decoded here; domain owns identity, units and terms. */
export function decodeRawRecord(record:RawProviderRecord):DecodedProviderRecord {
  const envelope=RawProviderRecordSchema.safeParse(record);
  if(!envelope.success) throw new RawDecodeError(envelope.error.issues.map(i=>i.path.map(String)));
  const dialect=dialects[record.providerId];
  if(!dialect||record.sourceNamespace!==`${record.providerId}/v1`||at(record.payload,dialect.marker[0])!==dialect.marker[1]) throw new RawDecodeError([['payload']]);
  if(record.providerId==='demo-provider-04' && (at(record.payload,'legs.0.direction')!=='OUT'||at(record.payload,'legs.1')!==undefined&&at(record.payload,'legs.1.direction')!=='IN')) throw new RawDecodeError([['payload','legs']]);
  const legArray=record.providerId==='demo-provider-02'?'trips':record.providerId==='demo-provider-04'?'legs':undefined;
  if(legArray) {const legs=at(record.payload,legArray);if(!Array.isArray(legs)||legs.length<1||legs.length>2) throw new RawDecodeError([['payload',legArray]]);}
  const fields=Object.fromEntries(Object.entries(dialect.fields).map(([field,path])=>[field,at(record.payload,path)]));
  const revision=fields['revision'];
  const parsed=decodedSchema.safeParse({...fields,available:dialect.available?at(record.payload,dialect.available):typeof fields['seats']==='number'&&fields['seats']>0,sourceRevision:at(revision,'sourceRevision'),mappingRevision:at(revision,'mappingRevision'),fixtureVersion:at(revision,'fixtureVersion')});
  if(!parsed.success) throw new RawDecodeError(parsed.error.issues.map(i=>['payload',...i.path.map(String)]));
  return {...parsed.data,raw:record,sourceRawRecordId:record.rawRecordId};
}
